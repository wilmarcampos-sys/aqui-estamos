/* ============================================================
   4. CÁLCULO: índice de desatención por zona
   0 = atendida · 100 = pidió ayuda y nunca llegó nada
   ============================================================ */
function estadoZona(z){
  const reps = S.reportes.filter(r=>r.z===z.id);
  const ents = S.entregas.filter(e=>e.z===z.id);
  const porNecesidad = {};
  reps.forEach(r=>{
    const p = porNecesidad[r.k] || (porNecesidad[r.k]={k:r.k,u:0,uBase:0,n:0,personas:0,ultimoRep:0,cel:{},corrob:1});
    p.uBase = Math.max(p.uBase, r.u); p.n++; p.personas += r.personas||0;
    p.ultimoRep = Math.max(p.ultimoRep, r.ts);
    const c = r.ref ? 'r:'+norm(r.ref) : (r.lat ? 'c:'+celda(r.lat, r.lng) : 'sc');
    p.cel[c] = p.cel[c] || {n:0, u:0};
    p.cel[c].n++; p.cel[c].u = Math.max(p.cel[c].u, r.u);
  });
  // la urgencia efectiva es la del punto más corroborado
  Object.values(porNecesidad).forEach(p=>{
    const cs = Object.values(p.cel);
    p.u = Math.max(p.uBase, ...cs.map(c=>escalar(c.u, c.n)));
    p.corrob = Math.max(...cs.map(c=>c.n));
    p.subio = p.u > p.uBase;
  });
  Object.values(porNecesidad).forEach(p=>{
    const e = ents.filter(x=>x.k===p.k).sort((a,b)=>b.ts-a.ts)[0];
    p.ultimaEnt = e ? e.ts : 0;
    p.quien = e ? e.quien : '';
    // cubierta si llegó algo DESPUÉS del reporte y hace menos de 24h
    p.cubierta = !!e && e.ts > p.ultimoRep - 2*H && (now()-e.ts) < 24*H;
  });
  const lista = Object.values(porNecesidad).sort((a,b)=> b.u-a.u || b.personas-a.personas);
  const pend = lista.filter(p=>!p.cubierta);
  const pendCrit = pend.filter(p=>p.u===3);
  const personas = lista.reduce((s,p)=>s+p.personas,0);
  const ultEnt = ents.length ? Math.max(...ents.map(e=>e.ts)) : 0;
  const horasSinAyuda = ultEnt ? (now()-ultEnt)/H : (reps.length ? 999 : 0);

  // índice
  let idx = 0;
  if (reps.length){
    const gravedad = Math.min(1, (pendCrit.length*2 + pend.length) / 8);      // 0-1
    const abandono = Math.min(1, horasSinAyuda / 30);                          // 0-1
    const escala   = Math.min(1, personas / 900);                              // 0-1
    idx = Math.round(100 * (0.45*gravedad + 0.40*abandono + 0.15*escala));
    if (!ents.length && pendCrit.length) idx = Math.max(idx, 78);
  }
  return {z, lista, pend, pendCrit, personas, ultEnt, horasSinAyuda, idx,
          nCoord: S.coords.filter(c=>c.z===z.id && c.ver).length};
}
/* zona más cercana a un punto — así el punto del mapa define la comuna solo */
function zonaDe(lat,lng){
  let best=ZONAS[0], bd=1e9;
  ZONAS.forEach(z=>{ const d=(z.lat-lat)**2+((z.lng-lng)*0.9965)**2; if(d<bd){bd=d;best=z;} });
  return best;
}
/* ---- FOCOS: agrupar reportes por punto (~180 m) dentro de la zona ----
   Una comuna como Cuba es enorme; lo útil no es "Cuba necesita agua" sino
   "5 personas piden agua en la cancha de Ciudad Jardín".                  */
const CELL = 0.0016;                                  // ~180 m
const celda = (lat,lng)=> Math.round(lat/CELL)+'_'+Math.round(lng/CELL);

/* Regla de corroboración: entre más gente distinta reporte lo mismo
   en el mismo punto, más sube la urgencia (hasta el tope). */
function escalar(u, n){ return Math.min(3, u + (n>=5 ? 2 : n>=3 ? 1 : 0)); }

const norm = s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');

/* ---- TELÉFONO: casi toda la coordinación pasa por WhatsApp ----
   Se normaliza a formato internacional para que el enlace wa.me siempre abra. */
const SOPORTE_WA = CONFIG.WHATSAPP_SOPORTE;   // un solo sitio manda: config.js

/* Deja solo dígitos y quita indicativos repetidos. Esto último importa:
   si el campo ya traía "+57" y la persona vuelve a escribir el 57, antes
   quedaba un número corrido tipo +57 573 105 5501. */
function telSoloDigitos(v){
  let d = String(v||'').replace(/\D/g,'');
  if(d.startsWith('00')) d = d.slice(2);
  // 57 + celular colombiano son 12 dígitos. Si hay más, sobra un indicativo
  // repetido. Con 12 o menos NO se toca: 573232314100 es un número válido
  // y quitarle el 57 lo dejaba en 3232314100, que ya no lleva indicativo.
  while(d.length > 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}
function telDigitos(v){
  const d = telSoloDigitos(v);
  if(d.length === 10 && d[0] === '3') return '57' + d;          // celular colombiano
  if(d.length === 12 && d.startsWith('57') && d[2] === '3') return d;
  if(d.length >= 11 && d.length <= 15) return d;                // otro país, con indicativo
  return null;
}
function telBonito(v){
  const d = telDigitos(v);
  if(!d) return String(v||'');
  if(d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`;
  return '+' + d;
}
/* Número enmascarado para MOSTRAR: solo los primeros 3 dígitos del móvil, el
   resto en X. Contra el scraping visual. El WhatsApp y el botón Copiar siguen
   usando el número completo. */
function telEnmascarado(v){
  const d = telDigitos(v);
  if(!d) return '';
  if(d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2,5)} XXX XXXX`;
  return '+' + d.slice(0,3) + 'X'.repeat(Math.max(0, d.length - 3));
}
const waLink = (v, msg)=>{
  const d = telDigitos(v); if(!d) return '#';
  return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : '');
};
/* Formateo en vivo. El campo NO lleva el +57 adentro: va como prefijo fijo
   al lado, para que sea imposible escribirlo dos veces. */
function telFormatoVivo(v){
  const d = telSoloDigitos(v).slice(-10);
  if(!d.length) return '';
  let out = d.slice(0,3);
  if(d.length > 3) out += ' ' + d.slice(3,6);
  if(d.length > 6) out += ' ' + d.slice(6,10);
  return out;
}

/* Referencias ya nombradas cerca de un punto — máximo 5, las más cercanas.
   Escoger una en vez de escribirla hace que el reporte caiga en el mismo foco. */
function refsCerca(lat, lng, max=5, radio=1500){
  const vistos = {};
  S.reportes.forEach(r=>{
    if(!r.ref || !r.lat) return;
    const d = dist(lat, lng, r.lat, r.lng);
    if(d > radio) return;
    const k = norm(r.ref);
    if(!vistos[k] || d < vistos[k].d) vistos[k] = {ref:r.ref, d, lat:r.lat, lng:r.lng};
  });
  S.coords.forEach(c=>{
    if(!c.micro || !c.lat) return;
    const d = dist(lat, lng, c.lat, c.lng);
    if(d > radio) return;
    const k = norm(c.micro);
    if(!vistos[k]) vistos[k] = {ref:c.micro, d, lat:c.lat, lng:c.lng};
  });
  return Object.values(vistos).sort((a,b)=>a.d-b.d).slice(0, max);
}
function focos(zid){
  const g = {};
  S.reportes.filter(r=>r.z===zid && r.lat).forEach(r=>{
    // mismo nombre de referencia = mismo sitio; si no hay nombre, se agrupa por cercanía
    const c = r.ref ? 'r:'+norm(r.ref) : 'c:'+celda(r.lat, r.lng);
    (g[c] = g[c] || {c, reps:[]}).reps.push(r);
  });
  return Object.values(g).map(f=>{
    f.n   = f.reps.length;
    f.lat = f.reps.reduce((s,r)=>s+r.lat,0)/f.n;
    f.lng = f.reps.reduce((s,r)=>s+r.lng,0)/f.n;
    f.ref = (f.reps.find(r=>r.ref)||{}).ref || '';
    f.ts  = Math.max(...f.reps.map(r=>r.ts));
    const byK = {};
    f.reps.forEach(r=>{ const e = byK[r.k] = byK[r.k] || {k:r.k, n:0, uBase:0, personas:0};
      e.n++; e.uBase = Math.max(e.uBase, r.u); e.personas += r.personas||0; });
    f.needs = Object.values(byK).map(e=>({...e, u:escalar(e.uBase, e.n), subio:escalar(e.uBase,e.n)>e.uBase}))
                                .sort((a,b)=>b.u-a.u || b.n-a.n);
    f.u        = Math.max(...f.needs.map(x=>x.u));
    f.subio    = f.needs.some(x=>x.subio);
    f.personas = f.needs.reduce((s,x)=>s+x.personas,0);
    return f;
  }).sort((a,b)=> b.u-a.u || b.n-a.n);
}
/* ---- MICRO-ZONAS: cada coordinador cubre un punto con radio (máx 1 km) ---- */
const RADIOS = [200, 300, 500, 750, 1000];
function dist(a1,o1,a2,o2){                       // metros, aproximación plana (suficiente a esta escala)
  const dy=(a2-a1)*110574, dx=(o2-o1)*111320*Math.cos((a1+a2)/2*Math.PI/180);
  return Math.sqrt(dx*dx+dy*dy);
}
function cubridores(lat,lng,zid){
  return S.coords.filter(c=>c.lat && dist(lat,lng,c.lat,c.lng) <= (c.radio||500))
                 .sort((a,b)=> (b.ver?1:0)-(a.ver?1:0) || dist(lat,lng,a.lat,a.lng)-dist(lat,lng,b.lat,b.lng));
}
function huerfanos(){                              // focos con necesidades pendientes y sin nadie a cargo
  const out=[];
  ZONAS.forEach(z=>focos(z.id).forEach(f=>{ if(!cubridores(f.lat,f.lng,z.id).length) out.push({...f, zona:z}); }));
  return out.sort((a,b)=> b.u-a.u || b.n-a.n);
}
function solitarios(){                             // focos con UNA sola persona a cargo → falta comunidad
  const out=[];
  ZONAS.forEach(z=>focos(z.id).forEach(f=>{
    const cb = cubridores(f.lat,f.lng,z.id);
    if(cb.length===1) out.push({...f, zona:z, solo:cb[0]});
  }));
  return out.sort((a,b)=> b.u-a.u || b.n-a.n);
}

/* ---- PERSONAS: una misma persona puede cubrir varias micro-zonas ----
   Se agrupa por correo o celular. Los traslapes son bienvenidos:
   mejor dos personas mirando el mismo sector que ninguna.               */
const personaKey = c => telDigitos(c.tel) || norm(c.email||'');
function porPersona(){
  const g = {};
  S.coords.forEach(c=>{ const k = personaKey(c); (g[k] = g[k] || {k, nom:c.nom, foto:c.foto, ver:c.ver, zonas:[]}).zonas.push(c);
    if(c.ver) g[k].ver = true; if(c.foto) g[k].foto = c.foto; });
  return Object.values(g).map(p=>({...p,
    n: p.zonas.length,
    entregas: S.entregas.filter(e=>norm(e.quien)===norm(p.nom)).length,
    exceso: p.zonas.length > 3
  })).sort((a,b)=>b.n-a.n);
}
const MAX_MICRO = 3;   // umbral blando: no bloquea, solo avisa
/* La escala de color del índice depende del tema: sobre tiles claros los
   hex del oscuro pierden contraste (el amarillo queda ilegible). */
const _SCALE_D = ['#3f8f5f','#c9a227','#d97706','#dc2626','#8b1a1a'];
const _SCALE_L = ['#26714A','#8A6508','#B45309','#C11B1B','#7A1616'];
function temaClaro(){ return document.documentElement.getAttribute('data-eff') === 'light'; }
function color(i){ const s = temaClaro() ? _SCALE_L : _SCALE_D;
  return i>=80?s[4] : i>=60?s[3] : i>=40?s[2] : i>=20?s[1] : s[0]; }
function etiqueta(i){ return i>=80?'Sin ayuda' : i>=60?'Crítica' : i>=40?'Rezagada' : i>=20?'Parcial' : 'Atendida'; }
function hace(ts){
  if(!ts) return 'nunca';
  const h=(now()-ts)/H;
  if(h<1) return 'hace '+Math.max(1,Math.round(h*60))+' min';
  if(h<48) return 'hace '+Math.round(h)+' h';
  return 'hace '+Math.round(h/24)+' días';
}
