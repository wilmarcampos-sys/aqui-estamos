/* ============================================================
   3. ESTADO
   ============================================================ */
const H = 3600e3;
let S = {reportes:[], entregas:[], coords:[], censo:[]};
const uid = () => Math.random().toString(36).slice(2,9);
const now = () => Date.now();

/* ============================================================
   3b. DATOS COMPARTIDOS (Supabase)
   Si no hay configuración, todo sigue funcionando en modo demo.
   ============================================================ */
let db = null, EN_LINEA = false;

// identidad anónima del aparato: sirve para el freno anti-abuso y para que
// la persona recupere su propia inscripción. No identifica a nadie.
const DEVICE = (()=>{ try{
  let v = localStorage.getItem('fh_device');
  if(!v){ v = uid()+uid()+uid(); localStorage.setItem('fh_device', v); }
  return v;
}catch(e){ return uid()+uid()+uid(); } })();

/* --- freno del lado del celular (el otro freno está en la base) ---
   Coordinadores no está aquí: eso ya no se inserta desde el navegador,
   pasa por ae_guardar_zona, que lleva su propio freno por cuenta. */
const LIMITES = {reportes:{n:15, ms:600e3}, entregas:{n:30, ms:600e3}};
function permitido(tabla){
  const L = LIMITES[tabla]; if(!L) return true;
  try{
    const k = 'fh_rate_'+tabla;
    const arr = JSON.parse(localStorage.getItem(k)||'[]').filter(t=>now()-t < L.ms);
    if(arr.length >= L.n) return false;
    arr.push(now()); localStorage.setItem(k, JSON.stringify(arr));
    return true;
  }catch(e){ return true; }
}
function repetido(firma){
  try{
    const k='fh_firmas', arr=JSON.parse(localStorage.getItem(k)||'[]').filter(x=>now()-x.t < 180e3);
    if(arr.some(x=>x.f===firma)) return true;
    arr.push({f:firma, t:now()}); localStorage.setItem(k, JSON.stringify(arr));
    return false;
  }catch(e){ return false; }
}

/* --- cola para cuando no hay señal: nada se pierde --- */
const colaLeer  = ()=>{ try{ return JSON.parse(localStorage.getItem('fh_cola')||'[]'); }catch(e){ return []; } };
const colaEscribir = c=>{ try{ localStorage.setItem('fh_cola', JSON.stringify(c)); }catch(e){} };
function encolar(tabla, fila){ const c=colaLeer(); c.push({tabla, fila, t:now()}); colaEscribir(c); pintarEstado(); }
async function vaciarCola(){
  if(!EN_LINEA) return;
  const c = colaLeer(); if(!c.length) return;
  const quedan = [];
  let enviados = 0, viejos = 0;
  for(const item of c){
    /* Solo reportes y entregas se encolan. Inscribirse se hacía así antes y
       ahora va por ae_guardar_zona, que exige la cuenta: al navegador se le
       quitó el insert. Lo que quedó encolado de esa época ya no entra nunca,
       y reintentarlo deja un "1 pendiente" que no baja jamás. */
    if(item.tabla !== 'reportes' && item.tabla !== 'entregas'){ viejos++; continue; }
    const {error} = await db.from(item.tabla).insert(item.fila);
    if(error && !/Demasiad|ya se envió|Ya está/.test(error.message)){ quedan.push(item); continue; }
    enviados++;
  }
  colaEscribir(quedan);
  if(enviados){ await dbCargar(); toast(`${enviados} pendiente(s) enviados`); }
  // Se le dice, no se borra callado: esa inscripción nunca llegó a existir.
  else if(viejos) toast('Una inscripción vieja no se pudo enviar. Vuelva a inscribirse: ahora es más corto.');
  pintarEstado();
}

/* --- mapeo entre las filas de Postgres y los objetos de la app --- */
const deRep  = r=>({id:r.id, z:r.zona, k:r.necesidad, u:r.urgencia, lat:+r.lat, lng:+r.lng,
                    ref:r.referencia||'', personas:r.personas||0, nota:r.nota||'', ts:+new Date(r.creado)});
const deEnt  = e=>({id:e.id, z:e.zona, k:e.necesidad, lat:+e.lat, lng:+e.lng,
                    quien:e.quien||'Anónimo', cant:e.cantidad||'', ts:+new Date(e.creado)});
// La vista pública trae tel_e164 (para WhatsApp), no el celular crudo ni el
// código; por eso tel sale de tel_e164.
const deCoo  = c=>({id:c.id, z:c.zona, micro:c.micro||'', radio:c.radio||500, lat:+c.lat, lng:+c.lng,
                    nom:c.nombre, rol:c.rol||'', tel:c.tel_e164||c.tel||'', tel_e164:c.tel_e164||'',
                    email:c.email||'', nota:c.nota||'',
                    foto:c.foto||null, ver:!!c.verificado, codigo:c.codigo||'',
                    cap:(c.capacidad!=null?+c.capacidad:null), ocup:(c.ocupacion!=null?+c.ocupacion:null),
                    device:c.device||'', anulado:!!c.anulado});
// Censo: SOLO la vista anónima (necesidad + ubicación + nº personas). Nunca
// nombre/cédula/teléfono/dirección — eso no sale de la base con la clave pública.
const deCenso = c=>({id:c.id, needs:c.necesidades||[], barrio:c.barrio||'', lat:+c.lat, lng:+c.lng,
                     personas:c.personas||0, estado:c.estado||'nuevo', tel:c.contacto_tel||'',
                     apellido:c.apellido||'', aprox:!!c.ubicacion_aprox, urg:c.urgencia||0,
                     ts:+new Date(c.creado)});

/* Modo ejemplo: carga los datos de demostración SOLO en este teléfono, para
   poder mostrar la app sin inventar necesidades falsas en el mapa real.
   Mientras está activo, no se traen ni se envían datos de la base.        */
let MODO_EJEMPLO = false;

async function dbCargar(){
  if(!EN_LINEA || MODO_EJEMPLO) return;
  const desde = new Date(now() - 30*24*H).toISOString();
  // Se lee de las VISTAS públicas, no de las tablas: no exponen device,
  // codigo, email ni el celular crudo. Ver seguridad.sql. Si la vista aún no
  // existe (SQL sin correr), cae a la tabla para no dejar la app sin datos
  // durante el despliegue; apenas se corre seguridad.sql, queda cerrada.
  const leer = async (vista, tabla, arma)=>{
    let res = await arma(db.from(vista).select('*'));
    if(res.error) res = await arma(db.from(tabla).select('*'));
    return res;
  };
  const recientes = q => q.gte('creado', desde).order('creado',{ascending:false}).limit(5000);
  const [r,e,c] = await Promise.all([
    leer('reportes_publicos',      'reportes',      recientes),
    leer('entregas_publicas',      'entregas',      recientes),
    leer('coordinadores_publicos', 'coordinadores', q=>q.order('creado',{ascending:false}).limit(2000)),
  ]);
  if(r.error||e.error||c.error){ console.warn(r.error||e.error||c.error); return; }
  S.reportes = (r.data||[]).map(deRep);
  S.entregas = (e.data||[]).map(deEnt);
  S.coords   = (c.data||[]).map(deCoo).filter(c=>!c.anulado);
  // Censo (vista pública anónima). No bloquea el resto si falla.
  try{ const cs = await recientes(db.from('censo_publico').select('*'));
       S.censo = cs.error ? [] : (cs.data||[]).map(deCenso); }
  catch(_){ S.censo = []; }
  render();
}

let recargaPendiente = null;
function dbSuscribir(){
  // '*' y no 'INSERT': si alguien borra o corrige un dato desde Supabase,
  // las pantallas abiertas también tienen que enterarse.
  db.channel('aqui-estamos')
    .on('postgres_changes', {event:'*', schema:'public'}, ()=>{
      clearTimeout(recargaPendiente);           // agrupa ráfagas de cambios
      recargaPendiente = setTimeout(dbCargar, 700);
    })
    .subscribe();
}

/* ---- cuánta gente está usando la app ahora mismo ----
   Sirve para dos cosas: que quien reporta sepa que no está gritando al vacío,
   y que la comunidad vea si a esta hora hay ojos puestos o no.            */
let canalPresencia = null;
function pintarEnLinea(n){
  const caja = document.getElementById('online'), num = document.getElementById('online-n');
  if(!caja || !num) return;
  caja.hidden = false;
  num.textContent = n > 999 ? '999+' : n;
  caja.title = n === 1
    ? 'Usted es la única persona con la app abierta en este momento'
    : `${n} personas con la app abierta en este momento`;
}
function presenciaIniciar(){
  canalPresencia = db.channel('presencia', {config:{presence:{key:DEVICE}}});
  canalPresencia
    .on('presence', {event:'sync'}, ()=>{
      pintarEnLinea(Object.keys(canalPresencia.presenceState()).length);
    })
    .subscribe(async estado=>{
      if(estado !== 'SUBSCRIBED') return;
      await canalPresencia.track({visto: new Date().toISOString()});
    });
  // volver a marcar presencia al regresar a la pestaña
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && canalPresencia) canalPresencia.track({visto:new Date().toISOString()});
  });
}

/* Guardar: primero se pinta local (para que se sienta instantáneo),
   luego se manda. Si falla la red, queda en cola.                     */
async function guardar(tabla, fila, local){
  if(MODO_EJEMPLO){ toast('Está en modo ejemplo: esto no se envía a nadie.'); return false; }
  if(!permitido(tabla)){ toast('Va muy rápido. Espere unos minutos.'); return false; }
  if(local) (tabla==='reportes'?S.reportes:tabla==='entregas'?S.entregas:S.coords).push(local);
  render();
  if(!EN_LINEA){ return true; }
  const {error} = await db.from(tabla).insert(fila);
  if(error){
    if(/Demasiad|ya se envió|Ya está/.test(error.message)){ toast(error.message); await dbCargar(); return false; }
    encolar(tabla, fila); toast('Sin señal: guardado y se enviará solo.');
    return true;
  }
  await dbCargar();
  return true;
}

function pintarEstado(){
  const el = document.getElementById('estado'); if(!el) return;
  const pend = colaLeer().length;
  if(!EN_LINEA){ el.className='estado demo'; el.textContent='Modo demostración · los datos no se comparten'; return; }
  if(pend){ el.className='estado cola'; el.textContent=`${pend} pendiente(s) por enviar`; return; }
  el.className='estado ok'; el.textContent='';
}

async function iniciarDatos(){
  if(!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || typeof supabase === 'undefined'){
    pintarEstado(); return false;
  }
  try{
    db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      realtime:{params:{eventsPerSecond:3}},
    });
    EN_LINEA = true;
    if(!MODO_EJEMPLO) S = {reportes:[], entregas:[], coords:[], censo:[]};   // en modo ejemplo, conservar los datos de muestra
    await dbCargar();
    dbSuscribir();
    presenciaIniciar();
    await vaciarCola();
    setInterval(vaciarCola, 45000);
    window.addEventListener('online', vaciarCola);
    pintarEstado();
    return true;
  }catch(e){ console.warn('Sin conexión a la base:', e); EN_LINEA=false; pintarEstado(); return false; }
}

function demo(){
  const t = now();
  const base = {};   // un mismo punto de referencia siempre cae en el mismo sitio
  const J = (z, ref) => {
    const Z = ZONAS.find(x=>x.id===z), d = Z.t==='comuna'?0.006:0.02, kk = z+'|'+(ref||uid());
    if(!base[kk]) base[kk] = {lat:Z.lat+(Math.random()-.5)*2*d, lng:Z.lng+(Math.random()-.5)*2*d};
    return {lat: base[kk].lat+(Math.random()-.5)*0.0004, lng: base[kk].lng+(Math.random()-.5)*0.0004};
  };
  const R = (z,k,u,h,p=1,ref='')=>S.reportes.push({id:uid(),z,k,u,ts:t-h*H,personas:p,nota:'',ref,...J(z,ref)});
  const E = (z,k,h,q)=>S.entregas.push({id:uid(),z,k,ts:t-h*H,quien:q,cant:'',...J(z)});
  // foco: varias personas reportando lo mismo en el mismo punto → la urgencia sube sola
  const CL = (z,k,u,h,p,ref,cnt)=>{ const b=J(z);
    for(let i=0;i<cnt;i++) S.reportes.push({id:uid(),z,k,u,ts:t-(h-i*0.4)*H,personas:p,nota:'',ref,
      lat:b.lat+(Math.random()-.5)*0.0007, lng:b.lng+(Math.random()-.5)*0.0007});
    return b; };
  S = {reportes:[],entregas:[],coords:[],censo:[]};

  // Centro / Universidad / Cuba: golpeadas pero ya con presencia institucional
  R('centro','agua',3,26,400,'Plaza de Bolívar'); R('centro','carpas',3,25,120,'Parque Olaya Herrera');
  R('centro','maquinaria',3,30,0,'Calle 19 con 7ª · edificio colapsado');
  R('centro','estructur',2,22,0,'Galería central'); R('centro','aseo',2,20,300,'Parque Olaya Herrera');
  E('centro','agua',4,'Cruz Roja'); E('centro','maquinaria',6,'Bomberos Pereira'); E('centro','caliente',3,'World Central Kitchen');

  R('univ','albergue',3,28,220,'UTP · portería principal'); R('univ','colchoneta',3,27,220,'Coliseo · albergue');
  R('univ','psico',2,14,150,'Barrio Los Alpes');
  E('univ','colchoneta',9,'Alcaldía · UTP'); E('univ','caliente',5,'Voluntarios UTP');

  R('cuba','agua',3,29,900,'Parque de Cuba'); R('cuba','mercado',3,28,700,'Colegio Aquilino Bedoya');
  R('cuba','panalb',2,24,90,'Calle 70 con 26'); R('cuba','energia',2,26,0,'Sector La Independencia');
  R('cuba','banos',2,20,0,'Parque de Cuba');
  E('cuba','agua',11,'Defensa Civil'); E('cuba','mercado',13,'Punto acopio Kennedy');

  // Villa Santana: mucha necesidad, ayuda escasa
  R('villasanta','agua',3,30,1200,'Tokio · parte alta'); R('villasanta','mercado',3,29,1100,'El Remanso · cancha');
  R('villasanta','sintecho',3,29,340,'Las Brisas'); R('villasanta','carpas',3,28,340,'Las Brisas');
  R('villasanta','medicam',2,21,60,'Intermedio · salón comunal'); R('villasanta','mayores',2,19,45,'Tokio · parte alta');
  E('villasanta','agua',22,'Junta de acción comunal');

  // El Oso / El Rocío: rezagadas
  R('eloso','agua',3,27,600,'Sector El Danubio'); R('eloso','cobijas',2,26,400,'Vía a El Oso km 2');
  R('eloso','panalb',2,24,70,'Sector El Danubio');
  E('eloso','cobijas',18,'Parroquia San José');
  R('rocio','mercado',3,26,450,'El Rocío alto · escuela'); R('rocio','carpas',3,25,180,'Sector La Y');
  R('rocio','luz-noche',2,15,0,'Sector La Y');

  // Rural: casi sin nada — el punto ciego
  R('caimalito','agua',3,31,780,'Caimalito · parque principal'); R('caimalito','mercado',3,31,780,'Escuela de Caimalito');
  R('caimalito','medico',3,30,25,'Caimalito · parque principal'); R('caimalito','via',3,31,0,'Vía Caimalito km 3');
  R('caimalito','senal',2,30,0,'Escuela de Caimalito');
  R('ptocaldas','agua',3,31,520,'Puerto Caldas · plaza'); R('ptocaldas','via',3,30,0,'Entrada por la vía férrea');
  R('ptocaldas','formula',3,28,40,'Orilla del río · sector bajo');
  R('laflorida','via',3,29,0,'Vía a La Florida km 8'); R('laflorida','mercado',3,28,300,'La Florida · centro poblado');
  R('laflorida','energia',3,29,0,'Puente sobre el Otún');
  R('arabia','mercado',3,27,260,'Arabia · parque'); R('arabia','agua',3,27,260,'Escuela de Arabia');
  R('morelia','estructur',2,24,0,'Morelia · centro'); R('morelia','mercado',2,23,180,'Morelia · centro');
  R('combia-a','agua',2,26,290,'Combia Alta · escuela'); R('combia-a','maquinaria',3,26,0,'Vía Combia km 5');
  R('tribunas','mercado',2,25,410,'Tribunas Córcega · centro'); R('tribunas','herram',2,22,0,'Escuela de Tribunas');
  E('tribunas','mercado',12,'Comité de Cafeteros');

  // Zonas con menos daño
  R('boston','estructur',1,20,0,'Parque de Boston'); E('boston','estructur',5,'DIGER');
  R('olimpica','aseo',1,18,80,'Villa Olímpica'); E('olimpica','aseo',4,'Punto acopio Ormazá');
  R('poblado','cobijas',1,19,60,'El Poblado · bloque 4'); E('poblado','cobijas',6,'Cruz Roja');

  // --- focos de corroboración (varias personas, mismo punto) ---
  const fCuba1 = CL('cuba','agua',      2, 20, 180, 'Ciudad Jardín · cancha de microfútbol', 5);
  const fCuba2 = CL('cuba','panalb',    1, 18,  40, 'Manzana 12 · salón comunal',            4);
  const fTokio = CL('villasanta','medicam',2,16, 70, 'Tokio · entrada a Las Brisas',         6);
  const fOso   = CL('eloso','agua',     2, 17, 130, 'Sector La Divisa · tanque comunitario', 4);
  const fUtp   = CL('univ','psico',     1, 12,  90, 'Coliseo · albergue',                    3);
  const fCtro  = CL('centro','estructur',2,10,   0, 'Calle 21 con 8ª · edificio agrietado',  3);

  // Coordinadores con MICRO-ZONA: punto + radio de cobertura (máx 1 km)
  const C = (z,nom,rol,tel,email,ver,micro,radio,pt,nota)=>({id:uid(),z,nom,rol,tel,email,ver,micro,radio,
    lat:pt.lat, lng:pt.lng, nota});
  S.coords = [
    C('centro','Ana María Ocampo','Líder comunal','+57 310 555 0142','ana.ocampo@ejemplo.co',true,
      'Plaza de Bolívar y alrededores',500,fCtro,'Punto fijo, 7am-7pm'),
    C('centro','Cruz Roja · turno A','Organización','+57 606 335 5555','pereira@cruzroja.ejemplo.co',true,
      'Centro histórico',1000,{lat:4.8140,lng:-75.6975},'Triage y agua'),
    C('cuba','Jhon Restrepo','JAC Cuba','+57 320 555 0198','jrestrepo@ejemplo.co',true,
      'Ciudad Jardín',600,fCuba1,'Bodega calle 70'),
    C('cuba','Marleny Ospina','Vecina','+57 318 555 0133','marleny@ejemplo.co',true,
      'Manzana 12 y La Playita',450,fCuba2,'Tiene carretilla para repartir'),
    C('villasanta','Luz Dary Gómez','Líder comunal','+57 315 555 0177','luzdary@ejemplo.co',true,
      'Villa Santana centro',700,{lat:4.8156,lng:-75.6741},'Necesita transporte urgente'),
    C('univ','Brigada UTP','Voluntariado','+57 311 555 0120','brigada@ejemplo.co',true,
      'Coliseo y albergue',800,fUtp,'Turnos 24 horas'),
    C('caimalito','Wilson Arboleda','Vecino','+57 312 555 0166','wilson.a@ejemplo.co',false,
      'Caimalito casco urbano',1000,{lat:4.8020,lng:-75.9350},'Vía destapada, solo entra 4x4'),
  ];
  // Nota: el foco de Tokio y el de El Oso quedan FUERA de todo radio → aparecen como huérfanos.
  void fTokio; void fOso;
}
demo();
