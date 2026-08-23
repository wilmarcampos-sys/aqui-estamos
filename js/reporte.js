/* ============================================================
   REPORTE EN VIVO — aquiestamos.co/reporte
   ============================================================
   Página pública. Todo lo que se muestra sale de vistas que no exponen
   identidad: `resumen_censo` da agregados, `censo_publico` solo posición
   aproximada y necesidades, y `historias_publicas` relatos anónimos.
   Nunca nombre, dirección ni coordenada exacta (Ley 1581 de 2012).
   ============================================================ */

const NEC = {
  alimentos:['Mercado / alimentos','carro'], aseo:['Aseo e higiene','jabon'],
  arriendo:['Subsidio de arriendo','casa'], agua:['Agua potable','gota'],
  ropa:['Carpas y cobijas','cobija'], medicamentos:['Medicamentos','pastilla'],
  utensilios:['Utensilios de cocina','olla'], bebes:['Pañales y bebés','bebe'],
  transporte:['Transporte','bus'], materiales:['Materiales de obra','ladrillo'],
  movilidad:['Silla de ruedas','silla'], servicios:['Servicios públicos','bombillo'],
  mascotas:['Comida para mascotas','pata'], estructural:['Evaluación estructural','regla'],
  albergue:['Albergue','techo']};

const COND = {grave:'Enfermedad grave en tratamiento', embarazo:'Embarazo o lactancia',
  discapacidad:'Discapacidad o movilidad reducida', sensorial:'Discapacidad auditiva o visual',
  cronica:'Enfermedad crónica', sin_empleo:'Sin empleo por el terremoto', mascotas:'Con mascotas'};

const ICO = {
  carro:'<path d="M3 4h2.2l2.4 10.4h9.6l2-7.4H7"/><circle cx="9.6" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  gota:'<path d="M12 3.2s6 6.4 6 10.2a6 6 0 0 1-12 0c0-3.8 6-10.2 6-10.2z"/>',
  jabon:'<rect x="5" y="9" width="14" height="11.5" rx="2.6"/><path d="M9 9V6.4a3 3 0 0 1 6 0V9"/><path d="M9.5 14.2h5"/>',
  casa:'<path d="M3 11l9-7 9 7"/><path d="M5.5 9.6V20h13V9.6"/>',
  cobija:'<path d="M3.5 20V8.5l8.5-4.6 8.5 4.6V20"/><path d="M3.5 12.5h17M3.5 16.5h17"/>',
  pastilla:'<rect x="3" y="9" width="18" height="6.4" rx="3.2" transform="rotate(-40 12 12)"/><path d="M8.6 8.6l6.8 6.8"/>',
  olla:'<path d="M4.5 8.5h15v7a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4v-7z"/><path d="M2.5 8.5h19M8 5.5V3M12 5.5V3M16 5.5V3"/>',
  bebe:'<circle cx="12" cy="9" r="4.5"/><path d="M4.5 20c0-3.3 3.4-5.5 7.5-5.5s7.5 2.2 7.5 5.5"/>',
  bus:'<rect x="4" y="4" width="16" height="13" rx="2.4"/><path d="M4 11h16M7 20v-2M17 20v-2"/>',
  ladrillo:'<rect x="2.5" y="5" width="19" height="5.5" rx="1"/><rect x="2.5" y="13" width="19" height="5.5" rx="1"/><path d="M9 5v5.5M15 13v5.5"/>',
  silla:'<circle cx="10" cy="17" r="4"/><path d="M14 4h2M13 4v7h4l3 6"/>',
  bombillo:'<path d="M9 17h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.4 11c.6.5 1 1.2 1 2h4.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  pata:'<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="9" r="2"/><path d="M12 11c-3 0-5 2.4-5 4.6 0 1.9 1.6 3.4 5 3.4s5-1.5 5-3.4C17 13.4 15 11 12 11z"/>',
  regla:'<rect x="3" y="8" width="18" height="8" rx="1.6"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  techo:'<path d="M2.5 11 12 4l9.5 7"/><path d="M5 13v7h14v-7"/>'};
const svgIco = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(ICO[k]||ICO.casa)+'</svg>';

let RES = null, TOP = [], PUNTOS = [], HIST = [], hIdx = 0, verTodas = false;
const $ = s => document.querySelector(s);

/* ---------- datos ---------- */
async function cargar(){
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const [r, c, h] = await Promise.all([
      db.from('resumen_censo').select('*').single(),
      db.from('censo_publico').select('*'),
      db.from('historias_publicas').select('*')]);
    if(r.data) RES = r.data;
    if(c.data){
      PUNTOS = c.data.filter(x=>x.lat && x.lng);
      const g = {};
      c.data.forEach(x=>(x.necesidades||[]).forEach(k=>g[k]=(g[k]||0)+1));
      TOP = Object.entries(g).sort((a,b)=>b[1]-a[1]);
    }
    if(h.data && h.data.length) HIST = h.data.sort(()=>Math.random()-0.5);
  }catch(e){ /* si falla la red quedan las cifras del HTML */ }
  pintar();
}

function pintar(){
  if(RES){
    const n = (id,v)=>{ const e=document.getElementById(id); if(e) e.dataset.fin = v; };
    ['hd-viv','k-viv'].forEach(i=>n(i,RES.viviendas));
    ['hd-urg','k-urg','p-urg'].forEach(i=>n(i,RES.urgentes));
    n('k-per',RES.personas); n('k-bar',RES.barrios);
    n('p-men',RES.menores); n('p-vul',RES.vulnerables); n('p-emp',RES.sin_empleo);
    const s1 = $('#p-men-sub'); if(s1) s1.textContent = `En ${RES.con_menores} hogares censados`;
    const s2 = $('#k-nota');
    if(s2) s2.innerHTML = `<b>${RES.ubicadas} de ${RES.viviendas}</b> viviendas ya están ubicadas en el mapa`;
    const s3 = $('#m-sub');
    if(s3) s3.textContent = `${RES.ubicadas} viviendas ya están ubicadas en el mapa`;
    const s4 = $('#n-sub');
    if(s4) s4.textContent = `Viviendas que pidieron cada ayuda · Censo de ${RES.viviendas} viviendas`;
    // los que no animan (están fuera de pantalla o ya se vieron) se ponen de una
    document.querySelectorAll('[data-fin]').forEach(e=>{
      if(!e.dataset.animando && !e.dataset.hecho) e.textContent = e.dataset.fin;
    });
  }
  pintarBarras(); pintarPuntosHistoria(); pintarHistoria(); girarHistorias();
  pintarChips(); pintarMapa();
}

/* ---------- necesidades ---------- */
function pintarBarras(){
  const w = $('#barras'); if(!w || !TOP.length) return;
  const lista = verTodas ? TOP : TOP.slice(0,6);
  const max = TOP[0][1];
  w.innerHTML = lista.map(([k,n],i)=>{
    const [et,ic] = NEC[k] || [k,'casa'];
    const tono = i<3 ? 'linear-gradient(90deg,#B01717,#E8453C)'
               : i<6 ? 'linear-gradient(90deg,#C98B22,#E8A33D)'
                     : 'linear-gradient(90deg,#7E889B,#A7B0BF)';
    return `<div class="nbar"><span class="ic">${svgIco(ic)}</span>
      <span class="et">${esc(et)}</span>
      <span class="pi"><i data-ancho="${Math.max(5,Math.round(n/max*100))}" style="background:${tono}"></i></span>
      <b>${n}</b></div>`;
  }).join('');
  // las barras crecen al entrar; si ya se vio la sección, salen puestas
  const yaVisto = $('#necesidades')?.dataset.visto;
  w.querySelectorAll('[data-ancho]').forEach(i=>{
    if(yaVisto) i.style.width = i.dataset.ancho + '%';
  });
  const b = $('#ver-todas');
  if(b) b.firstChild.textContent = verTodas ? 'Ver solo las principales ' : 'Ver todas las necesidades ';
}

/* ---------- historia ---------- */
/* Pasan solas cada 8 s. Se detienen si alguien está leyendo con el mouse
   encima, si la pestaña no está a la vista o si la banda quedó fuera de
   pantalla: un carrusel que cambia mientras se lee es una molestia. */
let hTimer = null;
function girarHistorias(){
  clearInterval(hTimer);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hTimer = setInterval(()=>{
    const c = document.getElementById('hist');
    if(!c || document.hidden || c.matches(':hover')) return;
    if(!document.getElementById('scrim-c')?.hidden) return;
    const r = c.getBoundingClientRect();
    if(r.bottom < 40 || r.top > innerHeight - 40) return;
    hIdx++; pintarHistoria();
  }, 8000);
}

function pintarHistoria(){
  if(!HIST.length) return;
  const h = HIST[hIdx % HIST.length];
  const lugar = [...new Set([h.barrio,h.ciudad].filter(Boolean).map(t=>t.trim()))].join(', ') || 'Pereira';
  $('#h-lugar').textContent = lugar;
  $('#h-texto').textContent = '“' + h.historia + '”';
  const cond = (h.condiciones||[]).map(k=>COND[k]).filter(Boolean);
  $('#h-cond').innerHTML = cond.map(t=>`<span>${esc(t)}</span>`).join('');
  // cada relato con una foto distinta, para que no se repita la imagen
  const fotos = ['img/wck-2.jpg','img/wck-1.jpg','img/wck-4.jpg','img/wck-3.jpg'];
  $('#hist-foto').style.backgroundImage = `url('${fotos[hIdx % fotos.length]}')`;
  // un fundido corto para que el cambio no sea un salto
  const c = $('#hist .cont');
  if(c){ c.classList.remove('entra'); void c.offsetWidth; c.classList.add('entra'); }
  const p = $('#h-puntos');
  if(p) p.querySelectorAll('i').forEach((b,j)=>b.classList.toggle('on', j===hIdx%HIST.length));
}

/* cuántas historias hay y en cuál vamos */
function pintarPuntosHistoria(){
  const p = $('#h-puntos'); if(!p || !HIST.length) return;
  p.innerHTML = HIST.map(()=>'<i></i>').join('');
}

/* ---------- mapa ---------- */
const FILTROS = [['','Todos'],['urg','Urgente'],['alimentos','Alimentos'],
  ['arriendo','Arriendo'],['agua','Agua'],['bebes','Bebés'],['movilidad','Movilidad']];
let filtro = '';

function pintarChips(){
  const w = $('#chips'); if(!w) return;
  w.innerHTML = FILTROS.map(([k,t])=>
    `<button type="button" class="chip${k===filtro?' on':''}" data-f="${k}">${t}</button>`).join('');
}

let mapa = null, capa = null;
function pintarMapa(){
  const el = $('#mini'); if(!el || !PUNTOS.length || typeof L === 'undefined') return;
  if(!mapa){
    mapa = L.map(el, {zoomControl:false, attributionControl:false,
      scrollWheelZoom:false, dragging:true, tap:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {maxZoom:17}).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }
  const vis = PUNTOS.filter(p=>{
    if(!filtro) return true;
    if(filtro==='urg') return p.urgencia===3;
    return (p.necesidades||[]).includes(filtro);
  });
  capa.clearLayers();
  vis.forEach(p=>{
    const col = p.urgencia===3 ? '#C81E1E'
      : (p.condiciones||[]).length ? '#6D4AA8'
      : p.urgencia===2 ? '#C98B22' : '#7E889B';
    L.circleMarker([p.lat, p.lng], {radius:6, color:'#fff', weight:2,
      fillColor:col, fillOpacity:.92}).addTo(capa);
  });
  if(vis.length){
    const b = L.latLngBounds(vis.map(p=>[p.lat,p.lng]));
    mapa.fitBounds(b, {padding:[26,26], maxZoom:14});
  }
  setTimeout(()=>mapa.invalidateSize(), 120);
}

/* ---------- microinteracciones ---------- */
/* Las cifras cuentan hacia arriba una sola vez, al entrar en pantalla. */
function contar(e){
  const fin = parseInt(e.dataset.fin || e.textContent, 10);
  if(!isFinite(fin)) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    e.textContent = fin; e.dataset.hecho = '1'; return;
  }
  e.dataset.animando = '1';
  const t0 = performance.now(), dur = 900;
  (function paso(t){
    const k = Math.min(1, (t-t0)/dur);
    e.textContent = Math.round(fin * (1 - Math.pow(1-k, 3)));
    if(k < 1) requestAnimationFrame(paso);
    else { e.textContent = fin; e.dataset.hecho = '1'; delete e.dataset.animando; }
  })(t0);
}

const ojo = new IntersectionObserver(es=>{
  es.forEach(x=>{
    if(!x.isIntersecting) return;
    const e = x.target;
    e.classList.add('on');
    if(e.id === 'necesidades'){
      e.dataset.visto = '1';
      e.querySelectorAll('[data-ancho]').forEach(i=>i.style.width = i.dataset.ancho+'%');
    }
    e.querySelectorAll('[data-cuenta]').forEach(n=>{ if(!n.dataset.hecho) contar(n); });
    if(e.hasAttribute('data-cuenta') && !e.dataset.hecho) contar(e);
    ojo.unobserve(e);
  });
}, {threshold:.2, rootMargin:'0px 0px -60px 0px'});

/* ---------- ventana de compartir ---------- */
function abrirCompartir(a){
  const sc = $('#scrim-c'); if(!sc) return;
  sc.hidden = !a;
  document.body.style.overflow = a ? 'hidden' : '';
  if(a){ const b = sc.querySelector('.opc'); if(b) b.focus(); }
}

function aviso(t){
  const e = $('#sh-msg'); if(!e) return;
  e.textContent = t; clearTimeout(aviso.t);
  aviso.t = setTimeout(()=>{ e.textContent = ''; }, 3000);
}

async function copiarEnlace(){
  const u = 'https://aquiestamos.co/reporte';
  try{ await navigator.clipboard.writeText(u); aviso('Enlace copiado.'); }
  catch(e){ aviso(u); }
}

document.addEventListener('click', e=>{
  if(e.target.closest('[data-compartir]')) return abrirCompartir(true);
  if(e.target.closest('#cerrar-compartir') || e.target.id==='scrim-c') return abrirCompartir(false);
  if(e.target.closest('#ver-todas')){ verTodas = !verTodas; pintarBarras(); return; }
  if(e.target.closest('#h-mas')){ hIdx++; pintarHistoria(); girarHistorias(); return; }
  if(e.target.closest('#sh-link2') || e.target.closest('#pie-link')) return copiarEnlace();
  if(e.target.closest('#sh-wa2') || e.target.closest('#pie-wa')){
    return void open('https://wa.me/?text=' + encodeURIComponent(
      'La emergencia en Pereira no terminó. Mira qué falta y dónde: https://aquiestamos.co/reporte'), '_blank');
  }
  if(e.target.closest('#sh-ig2')) return void (window.compartirImagen && compartirImagen('ig'));
  if(e.target.closest('#sh-est')) return void (window.compartirImagen && compartirImagen('wa'));
  const c = e.target.closest('[data-f]');
  if(c){ filtro = c.dataset.f; pintarChips(); pintarMapa(); }
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && !$('#scrim-c')?.hidden) abrirCompartir(false);
});

/* la barra se oscurece apenas se sale de la portada */
addEventListener('scroll', ()=>{
  $('#rnav').classList.toggle('pegada', scrollY > 40);
}, {passive:true});

document.querySelectorAll('.aparece, [data-cuenta], #necesidades').forEach(e=>ojo.observe(e));
cargar();
