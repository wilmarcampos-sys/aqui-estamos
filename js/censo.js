/* ============================================================
   Censo de vivienda: asistente de 4 pasos (mapa primero).
   La identidad (nombre, cédula, teléfono, dirección, seña) va a la
   tabla `censo`, de SOLO ESCRITURA para la clave pública: se puede
   insertar pero nadie la lee desde el sitio. La lectura es solo
   por MCP (admin). Al mapa va únicamente la vista anónima.
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s=>String(s??'').replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

const NECS = [
  {k:'agua',        t:'Agua',            ic:'<path d="M12 2.7 6.6 8.1a7.6 7.6 0 1 0 10.8 0L12 2.7Z"/>'},
  {k:'alimentos',   t:'Mercado',         ic:'<path d="M4 3v8a3 3 0 0 0 6 0V3M7 11v10M17 3c-1.7 0-3 2.2-3 5s1.3 4 3 4v9"/>'},
  {k:'medicamentos',t:'Medicinas',       ic:'<path d="M12 7v10M7 12h10"/><rect x="3" y="3" width="18" height="18" rx="5"/>'},
  {k:'ropa',        t:'Carpas / cobijas',ic:'<path d="M4 18v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5"/><path d="M2 18h20"/>'},
  {k:'bebes',       t:'Pañales',         ic:'<path d="M8 3v4M16 3v4M4 11h16"/><rect x="3" y="5" width="18" height="16" rx="4"/>'},
  {k:'aseo',        t:'Aseo e higiene',  ic:'<path d="M7 9h8a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a2 2 0 0 1 2-2Z"/><path d="M9 9V5h4v4"/>'},
  {k:'albergue',    t:'Albergue / techo',ic:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20h14V9.8"/>'},
  {k:'estructural', t:'Evaluación estructural', ic:'<path d="m14 7 3-3 3 3-3 3M5 21l7-7M3 13l4 4"/>'},
];
const COND_TXT = {discapacidad:'discapacidad', embarazo:'embarazo', cronica:'enfermedad crónica', mascotas:'mascotas'};
const EV_TXT = {habitable:'Habitable', danos:'Con daños', inhabitable:'Inhabitable'};

let paso = 1;
let LAT=null, LNG=null;
let estadoV = null;
let pers = 1;
let cond = new Set();
let necSel = new Set();
let db = null;
let entsCerca = [];   // entregas registradas cerca del punto

const val = id => (($('#'+id)||{}).value||'').trim();
function toast(m){ const e=$('#d-toast'); e.textContent=m; e.hidden=false; e.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(()=>{e.classList.remove('on'); setTimeout(()=>e.hidden=true,250);},2800); }

/* ---- mapa real primero: tocar o arrastrar fija el punto exacto ---- */
let cmap=null, cmk=null;
try{
  cmap = L.map('cmap',{zoomControl:false, attributionControl:false, tap:true}).setView([4.8133,-75.6961], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19, subdomains:'abcd'}).addTo(cmap);
  const PIN = L.divIcon({className:'', iconSize:[34,42], iconAnchor:[17,38], html:
    `<svg viewBox="0 0 24 24" width="34" height="42" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="#7C3AED" stroke="#fff" stroke-width="1.6"/>
      <circle cx="12" cy="10" r="3" fill="#fff"/></svg>`});
  const fijar = (la,lo)=>{
    LAT=+la.toFixed(6); LNG=+lo.toFixed(6);
    if(cmk) cmk.setLatLng([la,lo]);
    else { cmk = L.marker([la,lo],{draggable:true, icon:PIN}).addTo(cmap);
           cmk.on('dragend', e=>{ const p=e.target.getLatLng(); fijar(p.lat,p.lng); }); }
    $('#cmap-hint').hidden = true;
    cargarEntregas();
  };
  cmap.on('click', e=>fijar(e.latlng.lat, e.latlng.lng));
  window.__fijar = fijar;
}catch(e){ /* sin mapa igual se puede censar (queda sin punto) */ }

$('#q-ubic').onclick = ()=>{
  if(!navigator.geolocation){ toast('Este navegador no permite tomar ubicación.'); return; }
  const b=$('#q-ubic'); b.disabled=true; b.textContent='Tomando ubicación…';
  navigator.geolocation.getCurrentPosition(
    p=>{ b.disabled=false; b.classList.add('ok'); b.textContent='Punto puesto donde estás ✓';
      if(cmap){ cmap.setView([p.coords.latitude,p.coords.longitude], 17); }
      if(window.__fijar) window.__fijar(p.coords.latitude, p.coords.longitude); },
    ()=>{ b.disabled=false; b.textContent='Estoy parado frente a la vivienda';
      toast('No se pudo tomar la ubicación. Puedes marcar el punto tocando el mapa.'); },
    {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
};

/* ---- estado de la vivienda ---- */
document.querySelectorAll('#q-estado .opt').forEach(o=>o.onclick=()=>{
  document.querySelectorAll('#q-estado .opt').forEach(x=>x.setAttribute('aria-checked','false'));
  o.setAttribute('aria-checked','true'); estadoV=o.dataset.ev;
  $('#h-inhab').hidden = estadoV!=='inhabitable';
});

/* ---- stepper y condiciones ---- */
const pintaN=()=>{ $('#q-pn').textContent=pers; $('#q-step small').textContent = pers===1?'en total':'en total'; };
document.querySelectorAll('#q-step button').forEach(b=>b.onclick=()=>{ pers=Math.max(1,Math.min(40,pers+(+b.dataset.d))); pintaN(); });
document.querySelectorAll('#q-cond .srow').forEach(b=>b.onclick=()=>{
  const k=b.dataset.c; cond.has(k)?cond.delete(k):cond.add(k); b.classList.toggle('on', cond.has(k)); });

/* ---- chips de necesidad ---- */
$('#q-nec').innerHTML = NECS.map(n=>`<button type="button" class="chipsel" data-k="${n.k}" aria-pressed="false">
  <span class="ci"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${n.ic}</svg></span>
  <b>${n.t}</b>
  <svg class="tick" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 14.3-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z"/></svg></button>`).join('');
$('#q-nec').addEventListener('click', e=>{
  const b=e.target.closest('.chipsel'); if(!b) return;
  const k=b.dataset.k; necSel.has(k)?necSel.delete(k):necSel.add(k);
  b.setAttribute('aria-pressed', necSel.has(k)?'true':'false');
});

/* ---- entregas ya registradas cerca del punto (anti-duplicados) ---- */
function distM(a1,o1,a2,o2){ const dy=(a2-a1)*110574, dx=(o2-o1)*111320*Math.cos((a1+a2)/2*Math.PI/180);
  return Math.sqrt(dx*dx+dy*dy); }
async function cargarEntregas(){
  if(LAT==null || !db) return;
  try{
    const {data} = await db.from('entregas').select('necesidad,quien,cantidad,creado,lat,lng')
      .not('lat','is',null).order('creado',{ascending:false}).limit(400);
    entsCerca = (data||[]).filter(e=>distM(LAT,LNG,+e.lat,+e.lng) < 150);
    pintarEntregas();
  }catch(e){}
}
function pintarEntregas(){
  const w=$('#q-ents'); if(!w) return;
  if(LAT==null){ return; }
  const hace = t=>{ const m=Math.max(1,Math.round((Date.now()-+new Date(t))/60000));
    return m<60?`hace ${m} m`:(m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`); };
  w.innerHTML = entsCerca.length ? entsCerca.slice(0,5).map(e=>`
    <div class="entcard"><span class="eic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4.5 4.5L19 7"/></svg></span>
      <span class="etx"><b>${esc(e.necesidad)}${e.cantidad?` × ${esc(e.cantidad)}`:''}</b><small>${esc(e.quien||'Anónimo')}</small></span>
      <span class="emeta">${hace(e.creado)}</span></div>`).join('')
    : '<p class="muted" style="font-size:13px;margin:2px 3px">Nada registrado cerca de este punto todavía.</p>';
  const rec = entsCerca.find(e=>(Date.now()-+new Date(e.creado)) < 7*24*3600*1000);
  const h=$('#h-dup');
  if(rec){ h.hidden=false;
    h.innerHTML = `Esta vivienda ya recibió <b>${esc(rec.necesidad)}</b> ${''+((d)=>{const m=Math.round((Date.now()-+new Date(rec.creado))/86400000);return m<1?'hoy':`hace ${m} día${m>1?'s':''}`;})()}.
      Antes de volver a entregar, verifica que de verdad haga falta.`; }
  else h.hidden=true;
}

/* ---- autorizaciones ---- */
let consent=false, pubtel=false;
$('#q-consent').onclick=()=>{ consent=!consent; $('#q-consent').classList.toggle('on',consent); };
$('#q-pubtel').onclick=()=>{ pubtel=!pubtel; $('#q-pubtel').classList.toggle('on',pubtel); };

/* ---- navegación del asistente ---- */
const TOTAL=4;
function pintarPaso(){
  document.querySelectorAll('.sbody .step').forEach(s=>s.classList.toggle('active', +s.dataset.step===paso));
  $('#w-count').textContent = paso<=TOTAL ? `${paso}/${TOTAL}` : '✓';
  $('#w-prog').style.width = (Math.min(paso,TOTAL)/TOTAL*100)+'%';
  $('#w-prev').hidden = paso===1 || paso===5;
  $('#w-next').textContent = paso===4 ? 'Guardar en el censo' : paso===5 ? 'Volver al mapa' : 'Continuar';
  if(paso===3) pintarEntregas();
  if(paso===4) pintarResumen();
  if(paso===1 && cmap) setTimeout(()=>cmap.invalidateSize(),120);
  $('#w-body').scrollTop=0;
}
function pintarResumen(){
  const nombre=val('q-nombre'), apellido=val('q-apellido');
  const necTxt=[...necSel].map(k=>NECS.find(n=>n.k===k)?.t||k).join(' · ')||'—';
  const condTxt=[...cond].map(k=>COND_TXT[k]).join(', ');
  $('#q-resumen').innerHTML = `
    <div class="srow2"><span class="k">Vivienda</span><span class="v">${esc(val('q-barrio')||'—')}${val('q-dir')?' · '+esc(val('q-dir')):''}</span></div>
    <div class="srow2"><span class="k">Estado</span><span class="v" style="color:${estadoV==='habitable'?'#2f9e5f':estadoV==='danos'?'#d97706':estadoV==='inhabitable'?'#dc2626':'inherit'}">${EV_TXT[estadoV]||'—'}</span></div>
    <div class="srow2"><span class="k">Hogar</span><span class="v">${pers} persona${pers>1?'s':''}${+val('q-men5')?` · ${val('q-men5')} menor${+val('q-men5')>1?'es':''} de 5`:''}${+val('q-may65')?` · ${val('q-may65')} mayor${+val('q-may65')>1?'es':''} de 65`:''}${condTxt?` · ${condTxt}`:''}</span></div>
    <div class="srow2"><span class="k">Jefe hogar</span><span class="v">${esc((nombre+' '+apellido).trim()||'—')}</span></div>
    <div class="srow2"><span class="k">Pendiente</span><span class="v">${esc(necTxt)}</span></div>`;
}
function validar(p){
  if(p===1){
    if(!estadoV){ toast('Marca el estado de la vivienda.'); return false; }
    if(!val('q-barrio') && !val('q-dir')){ toast('Escribe al menos el barrio o la dirección.'); return false; }
    return true;
  }
  if(p===2){
    if(!val('q-nombre') || !val('q-apellido')){ toast('Escribe el nombre del jefe o jefa de hogar.'); return false; }
    if(!val('q-cedula') || !val('q-tel')){ toast('La cédula y el celular hacen verificable el censo.'); return false; }
    return true;
  }
  if(p===3){
    if(!necSel.size){ toast('Marca al menos una necesidad pendiente.'); return false; }
    return true;
  }
  return true;
}
$('#w-prev').onclick = ()=>{ if(paso>1){ paso--; pintarPaso(); } };
$('#w-back').addEventListener('click', e=>{ if(paso>1 && paso<5){ e.preventDefault(); paso--; pintarPaso(); } });
$('#w-next').onclick = ()=>{
  if(paso===5){ location.href='/'; return; }
  if(!validar(paso)) return;
  if(paso<4){ paso++; pintarPaso(); return; }
  enviar();
};

/* ---- enviar ---- */
async function enviar(){
  if(!consent){ toast('Falta la autorización de datos (el primer interruptor).'); return; }
  const b=$('#w-next'); b.disabled=true; b.textContent='Guardando…';
  const tel = val('q-tel').replace(/[^0-9]/g,'');
  const ficha = 'CV-' + Math.random().toString(36).slice(2,6).toUpperCase();
  const payload = {
    nombre:val('q-nombre'), apellido:val('q-apellido'), cedula:val('q-cedula'),
    tel_e164: tel.length===10 ? '57'+tel : tel,
    direccion:val('q-dir'), barrio:val('q-barrio'), sena:val('q-sena'),
    personas:pers, menores5:+val('q-men5')||0, mayores65:+val('q-may65')||0,
    condiciones:[...cond], estado_vivienda:estadoV,
    necesidades:[...necSel], detalle:val('q-detalle'),
    lat:LAT, lng:LNG, ficha,
    consentimiento:true, publicar_tel:pubtel,
    registrado_por: val('q-por') || 'persona',
  };
  try{
    const { error } = await db.from('censo').insert([payload]);
    if(error) throw error;
    $('#ok-ficha').textContent = ficha;
    $('#ok-txt').textContent = `Ya quedó en el censo${val('q-barrio')?' de '+val('q-barrio'):''}. Cualquier brigada que llegue va a ver qué recibió y qué falta.`;
    $('#ok-resumen').innerHTML = `
      <div class="srow2"><span class="k">Hogar</span><span class="v">${pers} persona${pers>1?'s':''} · ${esc((val('q-nombre')+' '+val('q-apellido')).trim())}</span></div>
      <div class="srow2"><span class="k">Pendiente</span><span class="v">${esc([...necSel].map(k=>NECS.find(n=>n.k===k)?.t||k).join(' · '))}</span></div>
      ${estadoV==='inhabitable'?'<div class="srow2"><span class="k">Estructural</span><span class="v">Entra a la cola de evaluación</span></div>':''}`;
    paso=5; pintarPaso();
  }catch(err){
    toast('No se pudo guardar. Revisa la conexión e intenta de nuevo.');
    b.disabled=false; b.textContent='Guardar en el censo';
  }
}

/* ---- arranque ---- */
try{ db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY); }catch(e){}
pintarPaso();
