/* ============================================================
   9. CENTROS ALIADOS — datos en vivo de alluda.online
   Otra red de voluntarios (alluda.online) mantiene un directorio
   abierto de centros de acopio con lo que a cada uno le falta.
   Su API de lectura es pública; aquí la mostramos EN VIVO, con
   crédito y enlace de vuelta. No copiamos a nuestra base ni
   republicamos como propio: es su trabajo, se ve tal cual y se
   linkea a su ficha (los teléfonos viven allá, no aquí).
   ============================================================ */
const ALIADO = {
  url: 'https://yjkyzfuixdpuhgthoeua.supabase.co',
  key: 'sb_publishable_hWboFTjrnhfsAn5gXDW_Gg_rqx2iGLR',
  dep: 'Risaralda',            // Pereira y alrededores
  sitio: 'https://alluda.online',
};
let ACOPIOS = [];
let mostrarAcopios = true;
let capaAcopios = (typeof map !== 'undefined' && map && !modoSVG) ? L.layerGroup().addTo(map) : null;

async function cargarAcopios(){
  if(typeof map === 'undefined' || !map || modoSVG) return;
  const h = { apikey: ALIADO.key };
  try{
    const ciu = await fetch(`${ALIADO.url}/rest/v1/ciudades?select=id,nombre&departamento=eq.${encodeURIComponent(ALIADO.dep)}&activa=eq.true`, {headers:h}).then(r=>r.json());
    const idmap = Object.fromEntries((ciu||[]).map(c=>[c.id, c.nombre]));
    const ids = (ciu||[]).map(c=>`"${c.id}"`).join(',');
    if(!ids) return;
    const [cen, nec] = await Promise.all([
      fetch(`${ALIADO.url}/rest/v1/centros?select=id,nombre,direccion,lat,lng,ciudad_id&activo=eq.true&ciudad_id=in.(${ids})`, {headers:h}).then(r=>r.json()),
      fetch(`${ALIADO.url}/rest/v1/necesidades?select=centro_id,categoria,descripcion,prioridad,estado&estado=neq.cubierta`, {headers:h}).then(r=>r.json()),
    ]);
    const byC = {};
    (nec||[]).forEach(n=>{ (byC[n.centro_id] = byC[n.centro_id] || []).push(n); });
    ACOPIOS = (cen||[]).filter(c=>c.lat && c.lng).map(c=>({
      id:c.id, nom:(c.nombre||'Centro de acopio').trim(), dir:(c.direccion||'').trim(),
      lat:+c.lat, lng:+c.lng, ciudad:idmap[c.ciudad_id]||'',
      needs:(byC[c.id]||[]).map(n=>({cat:n.categoria, desc:n.descripcion, prio:n.prioridad})),
    }));
    ACOPIOS.forEach(a=>{ try{ a.zid = zonaDe(a.lat, a.lng).id; }catch(e){} });
    window.ACOPIOS = ACOPIOS;
    pintarAcopios();
    pintarListaAcopios();
    if(typeof render==='function') render();   // los circulos de zona absorben el aporte
  }catch(e){ /* si su API no responde, la capa simplemente queda vacía */ }
}

function pintarAcopios(){
  if(!capaAcopios) return;
  capaAcopios.clearLayers();
  if(!mostrarAcopios) return;
  ACOPIOS.forEach(a=>{
    const urg = a.needs.filter(n=>/urgente/i.test(n.prio||'')).length;
    const badge = a.needs.length ? `<span style="position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 3px;
      border-radius:9px;background:${urg?'#dc2626':'#0d9488'};border:2px solid #fff;color:#fff;
      font:800 11px/15px system-ui;text-align:center">${a.needs.length}</span>` : '';
    const mk = L.marker([a.lat,a.lng],{zIndexOffset:700, icon:L.divIcon({className:'', iconSize:[30,30], iconAnchor:[15,15],
      html:`<div class="mpin mpin-aco" style="width:30px;height:30px">${ico('box')}${badge}</div>`})}).addTo(capaAcopios);
    mk.bindTooltip(`<b>${esc(a.nom)}</b>${a.ciudad?`<br>${esc(a.ciudad)}`:''}${a.needs.length?`<br><b>${a.needs.length} necesidad${a.needs.length>1?'es':''}</b>`:''}<br><i>Centro de acopio · alluda.online</i>`, {direction:'top'});
    mk.on('click', ()=>abrirAcopio(a));
  });
}
if(typeof map !== 'undefined' && map && !modoSVG){
  map.on('zoomend moveend', ()=>{ /* la capa es fija; nada que recalcular, se mantiene */ });
}

/* hoja de un centro aliado: lo que le falta + enlace a su ficha real */
function abrirAcopio(a){
  const org = (typeof mainPt!=='undefined' && mainPt) ? mainPt : null;
  const km = org ? dist(org.lat,org.lng,a.lat,a.lng)/1000 : null;
  const kmTxt = km==null ? '' : (km<1?`${Math.round(km*1000)} m`:`${km.toFixed(1)} km`);
  const porCat = {};
  a.needs.forEach(n=>{ (porCat[n.cat||'Otros'] = porCat[n.cat||'Otros'] || []).push(n); });
  const cats = Object.entries(porCat).map(([cat,arr])=>{
    const urg = arr.some(n=>/urgente/i.test(n.prio||''));
    return `<div class="nec-card ${urg?'u3':'u2'}">
      <div class="grow"><h4>${esc(cat)}${urg?'<span class="upill u3">Urgente</span>':''}</h4>
        <div class="nec-sub">${esc(arr.map(n=>n.desc).filter(Boolean).slice(0,2).join(' · ')||'Necesita apoyo')}</div></div>
    </div>`;
  }).join('') || '<p class="muted" style="margin:0">Sin necesidades pendientes publicadas ahora.</p>';
  abrirSheet(`
    <div class="zhead">
      <div class="row">
        <div class="rank" style="background:#0d9488;color:#fff">${ico('box')}</div>
        <div class="grow">
          <h3 class="trunc" style="margin:0">${esc(a.nom)}</h3>
          <div class="muted">Centro de acopio${a.ciudad?` · ${esc(a.ciudad)}`:''}${kmTxt?` · a ${kmTxt}`:''}</div>
        </div>
      </div>
    </div>
    ${a.dir?`<div class="acodir">${ico('pin')} ${esc(a.dir)}</div>`:''}
    <div class="sec">Lo que le falta (${a.needs.length})</div>
    ${cats}
    <a class="btn guide" style="display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none"
       href="https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}" target="_blank" rel="noopener">${ico('pin')} Cómo llegar</a>
    <a class="btn flat" style="display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;width:100%"
       href="${ALIADO.sitio}" target="_blank" rel="noopener">Ver ficha y contacto en alluda.online ↗</a>
    <p class="muted" style="font-size:11.5px;text-align:center;margin:8px 0 0">Datos en vivo de <b>alluda.online</b>, otra red de voluntarios. Los teléfonos de coordinación viven allá.</p>
  `);
}

/* lista en la pestaña Ayudar: los acopios con más pendientes primero */
function pintarListaAcopios(){
  const w = document.getElementById('lista-acopios'), bl = document.getElementById('b-acopios');
  if(!w) return;
  const top = ACOPIOS.filter(a=>a.needs.length).sort((a,b)=>b.needs.length-a.needs.length).slice(0,8);
  if(bl) bl.style.display = top.length ? '' : 'none';
  w.innerHTML = top.map((a,i)=>{
    const urg = a.needs.filter(n=>/urgente/i.test(n.prio||'')).length;
    const cats = [...new Set(a.needs.map(n=>n.cat||'Otros'))].slice(0,4);
    return `<div class="card zcard toca" data-acopio="${i}" style="cursor:pointer">
      <div class="row" style="align-items:flex-start">
        <div class="rank" style="background:#0d9488;color:#fff">${ico('box')}</div>
        <div class="grow" style="margin-left:2px">
          <h3 class="trunc" style="margin:0;font-size:15px">${esc(a.nom)}</h3>
          <div class="muted" style="font-size:12.5px;margin-top:2px">${esc(a.ciudad||'')} · ${a.needs.length} pendiente${a.needs.length>1?'s':''}</div>
        </div>
        ${urg?`<span class="sbadge b3">${urg} urgente${urg>1?'s':''}</span>`:''}
      </div>
      <div style="margin-top:8px">${cats.map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>
    </div>`;
  }).join('');
  w.querySelectorAll('[data-acopio]').forEach(el=>el.onclick=()=>abrirAcopio(top[+el.dataset.acopio]));
}

/* toggle de la capa (checkbox en el panel de capas) */
(function(){
  const cb = document.querySelector('#capas-panel input[data-capa="acopios"]');
  if(cb){ cb.checked = mostrarAcopios;
    cb.addEventListener('change', ()=>{ mostrarAcopios = cb.checked; pintarAcopios(); }); }
})();

/* arrancar: traer los datos una vez cargado el mapa */
if(typeof map !== 'undefined' && map && !modoSVG){
  setTimeout(cargarAcopios, 1400);
}
