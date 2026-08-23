/* ============================================================
   REPORTE DE LA EMERGENCIA (pestaña Emergencia)
   ============================================================
   Se dibuja en HTML, no como imagen: así se lee en el teléfono, se puede
   copiar, se traduce y cada cifra sale de los datos vivos del censo.
   La imagen queda solo para compartir.
   ============================================================ */

/* Cifras oficiales del sismo. Son de fuentes externas y preliminares:
   viven aquí, aparte, para que se vea que no salen del censo. */
const SISMO = {
  magnitud:'7.4', escala:'VIII — Severo', fecha:'10 de agosto de 2026', hora:'07:34 a.m.',
  epicentro:'San José del Palmar, Chocó', profundidad:'103 km', replicas:'+325',
  fallecidos:'321', heridos:'4.595', desaparecidos:'257',
  viviendas:'1.450', risaralda:'94', pereira:'66',
};

const REP_NEC = {alimentos:'Mercado', aseo:'Aseo e higiene', arriendo:'Subsidio de arriendo',
  agua:'Agua potable', ropa:'Carpas y cobijas', medicamentos:'Medicamentos',
  utensilios:'Utensilios de cocina', bebes:'Pañales y bebés', transporte:'Transporte',
  materiales:'Materiales de obra', movilidad:'Silla de ruedas', servicios:'Servicios públicos',
  albergue:'Albergue', estructural:'Evaluación estructural', mascotas:'Comida para mascotas'};

let RESUMEN = null, NECS_PROPIAS = null;
async function cargarResumen(){
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const {data} = await db.from('resumen_censo').select('*').single();
    if(data) RESUMEN = data;
    // fuera del mapa (página propia) no existe S: se piden las necesidades
    if(typeof S === 'undefined' || !S.censo || !S.censo.length){
      const {data:cs} = await db.from('censo_publico').select('necesidades');
      if(cs){ const g={}; cs.forEach(c=>(c.necesidades||[]).forEach(k=>g[k]=(g[k]||0)+1));
        NECS_PROPIAS = Object.entries(g).sort((a,b)=>b[1]-a[1]); }
    }
    pintarReporte();
  }catch(e){ /* sin resumen, se muestra lo que alcanza el mapa */ }
}

function repCenso(){
  const cs = (typeof S!=='undefined' && S.censo) ? S.censo : [];
  const g = {};
  cs.forEach(c=>(c.needs||[]).forEach(k=>g[k] = (g[k]||0)+1));
  const R = RESUMEN || {};
  return {
    viviendas: R.viviendas ?? cs.length,
    personas:  R.personas  ?? cs.reduce((a,c)=>a+(c.personas||0),0),
    urgentes:  R.urgentes  ?? cs.filter(c=>c.urg===3).length,
    menores:   R.menores   ?? 0,
    conMenores:R.con_menores ?? 0,
    vulnerables: R.vulnerables ?? 0,
    sinEmpleo: R.sin_empleo ?? 0,
    barrios:   R.barrios ?? new Set(cs.map(c=>c.barrio).filter(Boolean)).size,
    ubicadas:  R.ubicadas ?? cs.filter(c=>c.lat).length,
    top: (NECS_PROPIAS || Object.entries(g).sort((a,b)=>b[1]-a[1])).slice(0,9),
  };
}

function pintarReporte(){
  const w = document.getElementById('reporte'); if(!w) return;
  const c = repCenso();
  if(!c.viviendas){ w.innerHTML = '<p class="muted" style="padding:14px 3px">Cargando las cifras del censo…</p>'; return; }
  const max = c.top.length ? c.top[0][1] : 1;
  const tono = i => i<3 ? '' : (i<6 ? ' a' : ' g');

  w.innerHTML = `
    <div class="rep-bloque">
      <div class="rep-mag">
        <b>${SISMO.magnitud}</b><span>MAGNITUD Mw</span>
        <small>Intensidad ${SISMO.escala}<br>en la escala de Mercalli</small>
      </div>
      <dl class="rep-ficha">
        <div><dt>Fecha y hora</dt><dd>${SISMO.hora}<span>${SISMO.fecha}</span></dd></div>
        <div><dt>Epicentro</dt><dd>${SISMO.epicentro}<span>4.844 N · 76.242 O</span></dd></div>
        <div><dt>Profundidad</dt><dd>${SISMO.profundidad}<span>Sentido en gran parte del país</span></dd></div>
        <div><dt>Réplicas</dt><dd>${SISMO.replicas}<span>Tras el evento principal</span></dd></div>
      </dl>
    </div>

    <h3 class="rep-h">El impacto</h3>
    <p class="rep-lede">Cifras oficiales nacionales y departamentales</p>
    <div class="rep-cifras">
      <div><b>${SISMO.fallecidos}</b><span>Personas fallecidas</span>
        <small>${SISMO.risaralda} en Risaralda, ${SISMO.pereira} de ellas en Pereira</small></div>
      <div><b>${SISMO.heridos}</b><span>Heridos</span><small>Atendidos en la red hospitalaria</small></div>
      <div class="a"><b>${SISMO.desaparecidos}</b><span>Desaparecidos</span><small>Búsqueda activa entre escombros</small></div>
      <div class="g"><b>${SISMO.viviendas}</b><span>Viviendas afectadas</span><small>450 destruidas y 1.000 con daños</small></div>
    </div>

    <h3 class="rep-h">Lo que piden las familias</h3>
    <p class="rep-lede">${c.viviendas} viviendas censadas · ${c.personas} personas · ${c.barrios} barrios y veredas</p>
    <div class="rep-barras">
      ${c.top.map(([k,n],i)=>`<div class="rep-barra${tono(i)}">
        <span class="et">${esc(REP_NEC[k]||k)}</span>
        <span class="pista"><i style="width:${Math.max(4, Math.round(n/max*100))}%"></i></span>
        <b>${n}</b></div>`).join('')}
    </div>

    <h3 class="rep-h">Quiénes están en riesgo</h3>
    <p class="rep-lede">Hogares que necesitan atención prioritaria, según el censo</p>
    <div class="rep-riesgo">
      <div><b class="r">${c.urgentes}</b><span>Casos urgentes</span><small>Necesidad que no da espera</small></div>
      <div><b class="am">${c.menores}</b><span>Menores de 5 años</span><small>En ${c.conMenores} de los hogares</small></div>
      <div><b class="v">${c.vulnerables}</b><span>Hogares vulnerables</span><small>Embarazo, enfermedad grave o discapacidad</small></div>
      <div><b class="ve">${c.sinEmpleo}</b><span>Sin empleo</span><small>Perdieron trabajo o local por el sismo</small></div>
    </div>

    <h3 class="rep-h">Quiénes están detrás</h3>
    <p class="rep-lede">Este censo existe porque dos organizaciones lo sostienen en terreno</p>
    <div class="rep-orgs">
      <article>
        <b>Red de iglesias AMCER</b>
        <p>Levantó el censo puerta a puerta en Pereira, Dosquebradas y La Virginia,
          con sus iglesias como punto de encuentro de cada barrio.</p>
      </article>
      <article>
        <b>Asociación CREA</b>
        <p>Coordina el censo, ubica cada vivienda en el mapa y arma las rutas
          de entrega de cada jornada.</p>
      </article>
    </div>
    <p class="rep-aliados">Con el aporte de la <b>Fundación del Dr. Simi</b>
      (sillas de ruedas y ayudas de movilidad) y de <b>alluda.online</b>,
      red aliada de centros de acopio.<br>
      ¿Su organización está ayudando y no aparece? Escríbanos para sumarla al mapa.</p>`;
}

/* la ventana de compartir */
function abrirCompartir(a){
  const sc = document.getElementById('scrim-c'); if(!sc) return;
  sc.hidden = !a;
  document.body.style.overflow = a ? 'hidden' : '';
  if(a){ const b = sc.querySelector('.opc'); if(b) b.focus(); }
}
document.addEventListener('click', e=>{
  if(e.target.closest('#ab-compartir') || e.target.closest('[data-compartir]')) return abrirCompartir(true);
  if(e.target.closest('#cerrar-compartir') || e.target.id==='scrim-c') return abrirCompartir(false);
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && !document.getElementById('scrim-c')?.hidden) abrirCompartir(false);
});

// se pinta al entrar a la pestaña y cuando llegan los datos
document.addEventListener('click', e=>{
  if(e.target.closest('nav button[data-v="info"]')) setTimeout(pintarReporte, 60);
});
setTimeout(cargarResumen, 1000);
setTimeout(pintarReporte, 1500);
setTimeout(pintarReporte, 4000);
