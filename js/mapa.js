/* ============================================================
   5. MAPA
   ============================================================ */
let map, capa, modoSVG = (typeof L === 'undefined');
if(!modoSVG){
  try{
    map = L.map('map',{zoomControl:false, attributionControl:false}).setView([4.803,-75.735], 11);
    L.control.zoom({position:'topright'}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18, opacity:.72}).addTo(map);
    capa = L.layerGroup().addTo(map);
  }catch(e){ modoSVG = true; }
}

/* Mapa de respaldo sin internet: esquema SVG con las mismas zonas.
   Clave en emergencia — la app sigue sirviendo aunque no cargue el mapa de calles. */
const BB = {n:4.885, s:4.680, w:-75.975, e:-75.585};
function pintarSVG(){
  const W=1000, H=Math.round(W*(BB.n-BB.s)/(BB.e-BB.w));
  const X=lng=>(lng-BB.w)/(BB.e-BB.w)*W, Y=lat=>(BB.n-lat)/(BB.n-BB.s)*H;
  const sts = ZONAS.map(estadoZona);
  const cuerpo = sts.map(s=>{
    const r = 6 + Math.sqrt(s.z.pob)/17;
    return `<g class="zsvg" data-z="${s.z.id}" style="cursor:pointer">
      <circle cx="${X(s.z.lng).toFixed(1)}" cy="${Y(s.z.lat).toFixed(1)}" r="${r.toFixed(1)}"
        fill="${color(s.idx)}" fill-opacity="${s.idx>=60?.62:.4}" stroke="${color(s.idx)}"
        stroke-width="${s.idx>=60?2.5:1.5}"/>
      <text x="${X(s.z.lng).toFixed(1)}" y="${(Y(s.z.lat)+r+11).toFixed(1)}" text-anchor="middle"
        font-size="11" font-weight="600" fill="#eaf0fa"
        style="paint-order:stroke;stroke:#0f172a;stroke-width:3.5px">${esc(s.z.n)}</text>
    </g>`;
  }).join('');
  const ZOOM = 3.0;
  $('#map').innerHTML = `
    <div id="svgwrap" style="position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;background:#162033">
      <svg viewBox="0 0 ${W} ${H}" style="width:${ZOOM*100}%;height:auto;display:block">
        <rect width="${W}" height="${H}" fill="#162033"/>
        <text x="14" y="${H-10}" font-size="12" fill="#5c6f90">Esquema sin conexión · deslice para ver toda el área</text>
        ${cuerpo}
      </svg>
    </div>`;
  const wrap = $('#svgwrap');
  const pxW = wrap.clientWidth * ZOOM;
  wrap.scrollLeft = (X(-75.705)/W)*pxW - wrap.clientWidth/2;
  wrap.scrollTop  = (Y(4.805)/H)*(pxW*H/W) - wrap.clientHeight/2;
  $('#map').querySelectorAll('.zsvg').forEach(g=>g.onclick=()=>abrirZona(g.dataset.z));
}

const UCOL = {3:'#dc2626', 2:'#d97706', 1:'#c9a227'};
function pintarMapa(){
  if(modoSVG) return pintarSVG();
  if(!capa) return;
  capa.clearLayers();
  const z = map.getZoom();

  if(z >= 14){
    /* ---- ACERCADO: focos exactos dentro de la comuna, con número de reportes ---- */
    ZONAS.forEach(zz=>focos(zz.id).forEach(f=>{
      const rad = 14 + Math.min(14, f.n*2.2);
      L.marker([f.lat,f.lng],{icon:L.divIcon({className:'', iconSize:[rad*2,rad*2], iconAnchor:[rad,rad],
        html:`<div style="width:${rad*2}px;height:${rad*2}px;border-radius:50%;
          background:${UCOL[f.u]};opacity:.9;border:2px solid #0f172a;display:grid;place-items:center;
          color:#fff;font:800 ${11+Math.min(4,f.n/2)}px system-ui;box-shadow:0 0 0 ${f.subio?'4px rgba(220,38,38,.28)':'0 transparent'}">${f.n}</div>`
      })}).addTo(capa)
        .bindTooltip(`<b>${esc(f.ref||'Punto sin nombre')}</b><br>${f.n} reporte${f.n>1?'s':''} · ${f.needs.slice(0,3).map(x=>esc(NEED[x.k]?.n||x.k)).join(', ')}${f.subio?'<br><b>Urgencia elevada por corroboración</b>':''}<br><i>Toque para ver y reportar</i>`,{direction:'top'})
        .on('click',()=>abrirFoco(zz.id, f.lat, f.lng));
    }));
    S.entregas.forEach(e=>{
      if(!e.lat) return;
      L.marker([e.lat,e.lng],{icon:L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],
        html:`<div style="width:18px;height:18px;border-radius:5px;background:#3f8f5f;border:2px solid #0f172a;
          display:grid;place-items:center;color:#fff">${ico('check')}</div>`})}).addTo(capa)
        .bindTooltip(`Entregado: ${NEED[e.k]?.n||e.k} · ${e.quien}`,{direction:'top'});
    });
    /* micro-zonas de los coordinadores */
    S.coords.filter(c=>c.lat).forEach(c=>{
      L.circle([c.lat,c.lng],{radius:c.radio||500, color:c.ver?'#4f9cf9':'#7c4a10', weight:1.5,
        dashArray:'5 5', fillColor:'#4f9cf9', fillOpacity:.07, interactive:false}).addTo(capa);
      L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',iconSize:[150,14],iconAnchor:[75,-6],
        html:`<div style="text-align:center;font:600 10px/1.1 system-ui;color:#9dc4f7;
          text-shadow:0 0 5px #0f172a">${ico('user')} ${esc(c.micro||c.nom)}</div>`})}).addTo(capa)
        .bindTooltip(`<b>${esc(c.nom)}</b><br>${esc(c.micro||'')} · ${c.radio||500} m${c.ver?'':'<br>sin verificar'}`,{direction:'bottom'});
    });
    ZONAS.forEach(zz=>L.marker([zz.lat,zz.lng],{interactive:false,icon:L.divIcon({className:'',
      iconSize:[140,16],iconAnchor:[70,8],
      html:`<div style="text-align:center;font:700 11px/1.1 system-ui;color:#cfe0fa;opacity:.5;
        text-shadow:0 0 5px #0f172a">${zz.n}</div>`})}).addTo(capa));
    return;
  }

  /* ---- ALEJADO: burbuja por zona ---- */
  ZONAS.map(estadoZona).forEach(st=>{
    const r = 260 + Math.sqrt(st.z.pob) * 4.5;
    const c = L.circle([st.z.lat, st.z.lng], {
      radius: r, color: color(st.idx), weight: st.idx>=60?2.5:1.5,
      fillColor: color(st.idx), fillOpacity: st.idx>=60?.55:.35
    }).addTo(capa);
    c.on('click', ()=>{ map.flyTo([st.z.lat, st.z.lng], 14.6, {duration:.7}); abrirZona(st.z.id); });
    L.marker([st.z.lat, st.z.lng], {icon: L.divIcon({
      className:'', iconSize:[120,16], iconAnchor:[60,8],
      html:`<div style="text-align:center;font:600 10.5px/1.1 system-ui;color:#eaf0fa;
        text-shadow:0 0 4px #0f172a,0 0 7px #0f172a;pointer-events:none">${st.z.n}</div>`
    })}).addTo(capa);
  });
}
if(map) map.on('zoomend', pintarMapa);

/* ---- PIN PRINCIPAL: vive en el mapa grande y lo hereda todo lo demás ---- */
let mainMk = null, mainPt = null;
function setMainPt(la, lo){
  const z = zonaDe(la, lo);
  mainPt = {z:z.id, lat:+la.toFixed(5), lng:+lo.toFixed(5)};
  if(mainMk) mainMk.setLatLng([la, lo]);
  const bar = document.getElementById('pinbar');
  if(bar) bar.innerHTML = `${ico('pin')} <b>${esc(z.n)}</b>${z.t==='corregimiento'?' (rural)':''}
    <span class="muted">· toque el mapa o arrastre el pin para corregir</span>`;
  const fb = document.getElementById('fab-need');
  if(fb) fb.textContent = 'Necesito ayuda en ' + z.n;
}
function initMainPin(){          // se llama al final: PIN y esc ya existen
  if(!map) return;
  mainMk = L.marker([4.8133,-75.6961],{draggable:true, autoPan:true, icon:PIN, zIndexOffset:1000}).addTo(map);
  mainMk.on('drag dragend', e=>setMainPt(e.target.getLatLng().lat, e.target.getLatLng().lng));
  map.on('click', e=>setMainPt(e.latlng.lat, e.latlng.lng));
  setMainPt(4.8133, -75.6961);
}
/* punto por defecto para una zona: el pin principal si cae dentro, si no el centro de la zona */
function ptDe(zid){
  if(mainPt && mainPt.z===zid) return mainPt;
  const z = ZONAS.find(x=>x.id===zid);
  return z ? {z:z.id, lat:z.lat, lng:z.lng} : null;
}

/* ============================================================
   5b. SELECTOR DE PUNTO EN EL MAPA
   El usuario mueve el mapa; el pin está fijo en el centro.
   La comuna se deduce sola del punto — no hay que buscarla en una lista.
   ============================================================ */
let pickMap=null, pickSt=null, pickMk=null, pickCb=null;
function pickerHTML(id, zid){
  if(modoSVG){
    return `<label class="f">Zona</label>
      <select id="${id}-sel">${ZONAS.map(z=>`<option value="${z.id}" ${z.id===zid?'selected':''}>${z.n}${z.t==='corregimiento'?' (rural)':''}</option>`).join('')}</select>`;
  }
  return `<label class="f">¿Dónde es exactamente?</label>
    <div class="picker">
      <div id="${id}" class="pickmap"></div>
      <div class="pickhint" id="${id}-hint">${ico('tap')} Toque el mapa en el sitio</div>
    </div>
    <button type="button" class="btn loc" data-gps="${id}">${ico('pin')} Localízame — poner el pin donde estoy</button>
    <div class="pickinfo" id="${id}-info">…</div>
    <select id="${id}-jump" style="margin-top:8px;font-size:14px">
      <option value="">¿No encuentra el sitio? Ir a una zona…</option>
      ${ZONAS.map(z=>`<option value="${z.id}">${z.n}${z.t==='corregimiento'?' (rural)':''}</option>`).join('')}
    </select>`;
}
const PIN = modoSVG ? null : L.divIcon({className:'', iconSize:[34,34], iconAnchor:[17,30], html:
  `<div class="pinwrap"><span class="pinpulse"></span><span class="pindot"></span></div>`});
function pickerInit(id, zid, pt, onMove){
  if(modoSVG) return;
  const z0 = ZONAS.find(x=>x.id===zid) || ZONAS[0];
  const c0 = pt || z0;
  pickMap = L.map(id,{zoomControl:false, attributionControl:false, tap:true})
             .setView([c0.lat,c0.lng], pt?16.5:15);
  L.control.zoom({position:'bottomright'}).addTo(pickMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(pickMap);

  // pin real: se puede arrastrar, y tocando el mapa se mueve solo
  pickMk = L.marker([c0.lat,c0.lng],{draggable:true, autoPan:true, icon:PIN}).addTo(pickMap);
  pickCb = onMove || null;

  const info = document.getElementById(id+'-info');
  const hint = document.getElementById(id+'-hint');
  let tocado = false;
  const fijar = (la, lo, ocultarHint)=>{
    const z = zonaDe(la, lo);
    pickSt = {z:z.id, lat:+la.toFixed(5), lng:+lo.toFixed(5)};
    info.innerHTML = `${ico('pin')} <b>${esc(z.n)}</b>${z.t==='corregimiento'?' (rural)':''}`;
    if(ocultarHint && !tocado){ tocado = true; if(hint) hint.classList.add('off'); }
    if(pickCb) pickCb(la, lo);
  };
  const jump = document.getElementById(id+'-jump');
  if(jump) jump.onchange = ()=>{
    const z = ZONAS.find(x=>x.id===jump.value); if(!z) return;
    pickMap.setView([z.lat,z.lng], z.t==='comuna'?15:14);
    pickMk.setLatLng([z.lat,z.lng]); fijar(z.lat, z.lng, false);
    if(hint){ hint.classList.remove('off'); tocado=false; }
    toast('Ahora toque el punto exacto dentro de ' + z.n);
  };
  pickMap.on('click', e=>{ pickMk.setLatLng(e.latlng); fijar(e.latlng.lat, e.latlng.lng, true); });
  pickMk.on('drag',    e=>fijar(e.target.getLatLng().lat, e.target.getLatLng().lng, true));
  pickMk.on('dragend', e=>fijar(e.target.getLatLng().lat, e.target.getLatLng().lng, true));
  fijar(c0.lat, c0.lng, false);
  setTimeout(()=>{ if(pickMap) pickMap.invalidateSize(); }, 150);
}
function pickerVal(id){
  if(modoSVG){
    const v = document.getElementById(id+'-sel').value, z = ZONAS.find(x=>x.id===v);
    return {z:v, lat:z.lat, lng:z.lng};
  }
  return {...pickSt};
}
function pickerGPS(id){
  const btn = document.querySelector(`[data-gps="${id}"]`);
  if(!navigator.geolocation || !pickMap) return toast('Ubicación no disponible en este equipo');
  if(btn) btn.innerHTML = ico('clock')+' Buscando su ubicación…';
  navigator.geolocation.getCurrentPosition(p=>{
    const la=p.coords.latitude, lo=p.coords.longitude, prec=Math.round(p.coords.accuracy||0);
    pickMap.setView([la,lo], 17);
    pickMk.setLatLng([la,lo]);
    pickMk.fire('dragend', {target:pickMk});
    if(btn){ btn.classList.add('ok');
      btn.innerHTML = ico('check')+` Pin puesto donde está${prec?` (±${prec} m)`:''} — puede corregirlo`; }
    toast('Listo. Si el pin quedó corrido, arrástrelo.');
  }, err=>{
    if(btn) btn.innerHTML = ico('pin')+' Localízame — poner el pin donde estoy';
    toast(err && err.code===1
      ? 'El navegador bloqueó la ubicación. Toque el mapa en el sitio.'
      : 'No se pudo obtener la ubicación. Toque el mapa en el sitio.');
  }, {enableHighAccuracy:true, timeout:9000, maximumAge:0});
}
