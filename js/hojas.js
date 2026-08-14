/* ============================================================
   6. UI
   ============================================================ */
const $ = s=>document.querySelector(s);
const esc = s=>String(s??'').replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const iniciales = n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const avatar = c => c.foto
  ? `<div class="avatar" style="background-image:url('${c.foto}')"></div>`
  : `<div class="avatar">${esc(iniciales(c.nom || c.nombre))}</div>`;
let toastT;
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2600); }

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on', v.id==='v-'+b.dataset.v));
  if(b.dataset.v==='map' && map) setTimeout(()=>map.invalidateSize(),60);
  render();
});

function abrirSheet(html){
  if(pickMap){ try{pickMap.remove();}catch(e){} pickMap=null; }
  $('#sheet-body').innerHTML=html; $('#sheet').classList.add('on'); $('.panel').scrollTop=0;
}
function cerrarSheet(){ $('#sheet').classList.remove('on'); }
$('#sheet').addEventListener('click', e=>{ if(e.target.hasAttribute('data-close')) cerrarSheet(); });

/* ---------- ficha de zona ---------- */
function abrirZona(zid){
  const st = estadoZona(ZONAS.find(z=>z.id===zid));
  const coords = S.coords.filter(c=>c.z===zid);
  const needs = st.lista.map(p=>`
    <div class="need-line">
      <span class="dot" style="background:${p.cubierta?'#3f8f5f':(p.u===3?'#dc2626':p.u===2?'#d97706':'#c9a227')}"></span>
      <div class="grow">
        <div style="font-size:14px">${esc(NEED[p.k]?.n||p.k)}</div>
        <div class="cnt">${p.n} reporte${p.n>1?'s':''}${p.personas?` · ~${p.personas} personas`:''} ·
          ${p.cubierta?`entregado ${hace(p.ultimaEnt)} por ${esc(p.quien)}`:`sin entrega${p.ultimaEnt?` desde ${hace(p.ultimaEnt)}`:''}`}
          ${p.subio?`<b style="color:#fca5a5"> · ↑ subió por ${p.corrob} reportes en el mismo punto</b>`:''}</div>
      </div>
      ${p.cubierta?'<span class="chip ok">OK</span>'
        :`<button class="mini go" data-ent="${p.k}" data-z="${zid}">Ya llegó</button>`}
    </div>`).join('') || '<p class="muted">Todavía nadie ha reportado necesidades en esta zona.</p>';

  const fs = focos(zid);
  const fl = fs.map(f=>{
    const cb = cubridores(f.lat, f.lng, zid);
    return `
    <div class="foco ${cb.length?'':'orf'}" data-focopt="${f.lat},${f.lng}">
      <div class="row">
        <div class="fbadge" style="background:${UCOL[f.u]}">${f.n}</div>
        <div class="grow">
          <div style="font-size:14px;font-weight:600">${esc(f.ref || 'Punto sin nombre')}</div>
          <div class="cnt">${f.n} reporte${f.n>1?'s':''}${f.personas?` · ~${f.personas} personas`:''} · ${hace(f.ts)}</div>
        </div>
        ${f.subio?'<span class="chip u3">↑ urgencia</span>':''}
      </div>
      <div>${f.needs.map(x=>`<span class="chip ${x.u===3?'u3':x.u===2?'u2':''}">${esc(NEED[x.k]?.n||x.k)}${x.n>1?` ×${x.n}`:''}</span>`).join('')}</div>
      <div class="cnt" style="margin-top:7px">${cb.length
        ? `<span class="sdot" style="background:${cb.length>1?'#3f8f5f':'#d97706'}"></span> A cargo: ` + cb.map(c=>esc(c.nom)+' <span class="muted">('+esc(c.micro||'micro-zona')+', '+Math.round(dist(f.lat,f.lng,c.lat,c.lng))+' m)</span>').join(' · ')
          + (cb.length===1?' · <b style="color:#fcd34d">solo una persona</b> <span class="lnk" data-coordpt="'+f.lat+','+f.lng+'">Sumarme</span>':'')
        : '<b style="color:#fca5a5">' + ico('alert') + ' Nadie responde por este punto.</b> <span class="lnk" data-coordpt="'+f.lat+','+f.lng+'">Hacerme cargo</span>'}</div>
      <div class="fbtns">
        <button type="button" class="mini" data-newpt="${f.lat},${f.lng}" data-ref="${esc(f.ref||'')}">${ico('plus')} Necesidad aquí</button>
        <button type="button" class="mini go" data-delivpt="${f.lat},${f.lng}">${ico('check')} Llegó ayuda aquí</button>
        <button type="button" class="mini" data-verpt="${f.lat},${f.lng}">${ico('zoom')} Ver en el mapa</button>
      </div>
    </div>`;}).join('');

  const cl = coords.map(c=>`
    <div class="card" style="margin-bottom:8px">
      <div class="row">
        ${avatar(c)}
        <div class="grow">
          <div style="font-weight:700;font-size:14px">${esc(c.nom)}
            ${c.ver?'<span class="verif">verificado</span>':'<span class="pend">sin verificar</span>'}</div>
          <div class="muted">${esc(c.micro||'Sin micro-zona')} · radio ${c.radio||500} m</div>
          <div class="muted">${esc(c.rol)}${c.nota?' · '+esc(c.nota):''}</div>
        </div>
        <a class="mini" href="${waLink(c.tel)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </div>`).join('') || '<p class="muted">Nadie coordina esta zona todavía. Si usted está allá, inscríbase.</p>';

  abrirSheet(`
    <div class="zhead">
      <div class="row">
        <div class="rank" style="background:${color(st.idx)};color:#fff">${st.idx}</div>
        <div class="grow">
          <h3 style="margin:0">${esc(st.z.n)}</h3>
          <div class="muted">${st.z.t==='comuna'?'Comuna':'Zona rural'} · ${etiqueta(st.idx)} ·
            última ayuda ${hace(st.ultEnt)}</div>
        </div>
      </div>
      <div class="bar"><span style="width:${st.idx}%;background:${color(st.idx)}"></span></div>
      <div class="btn2">
        <button class="btn red" data-new="${zid}">${ico('plus')} Reportar necesidad</button>
        <button class="btn green" data-deliv="${zid}">${ico('check')} Registrar entrega</button>
      </div>
    </div>

    ${fs.length?`<div class="sec">Puntos exactos dentro de la zona (${fs.length})</div>
      <p class="muted" style="margin:0 0 8px">Sitios concretos dentro de ${esc(st.z.n)}.</p>${fl}`:''}

    <div class="sec">Resumen de necesidades de la zona</div>
    ${needs}

    <div class="sec">Coordinadores de la zona (${coords.length})</div>
    ${cl}
    <button class="btn flat" data-coord="${zid}">Inscribirme aquí</button>
  `);
}

/* ---------- ficha de un punto concreto ----------
   Todas las necesidades de ese sitio, con botones para agregar más
   o marcar entregado, una por una.                                  */
function abrirFoco(zid, la, lo){
  const z = ZONAS.find(x=>x.id===zid);
  let f = null, bd = 1e9;
  focos(zid).forEach(x=>{ const d = dist(la, lo, x.lat, x.lng); if(d < bd){ bd = d; f = x; } });
  if(!f) return abrirZona(zid);

  const cb = cubridores(f.lat, f.lng, zid);
  // ¿llegó algo a ESTE punto (no a la comuna entera)?
  const estadoDe = k=>{
    const ultRep = Math.max(...f.reps.filter(r=>r.k===k).map(r=>r.ts));
    const e = S.entregas.filter(x=>x.k===k && x.lat && dist(f.lat,f.lng,x.lat,x.lng) < 400)
                        .sort((a,b)=>b.ts-a.ts)[0];
    return {e, ok: !!e && e.ts > ultRep - 2*H && (now()-e.ts) < 24*H};
  };

  const filas = f.needs.map(x=>{
    const {e, ok} = estadoDe(x.k);
    return `<div class="need-line">
      <span class="dot" style="background:${ok?'#3f8f5f':UCOL[x.u]}"></span>
      <div class="grow">
        <div style="font-size:14px">${esc(NEED[x.k]?.n||x.k)}${x.n>1?` <b style="color:#fca5a5">×${x.n}</b>`:''}</div>
        <div class="cnt">${NEED[x.k]?.cat||''}${x.personas?` · ~${x.personas} personas`:''}
          ${x.subio?' · <b style="color:#fca5a5">↑ urgencia por corroboración</b>':''}
          ${ok?` · <b style="color:#86efac">entregado ${hace(e.ts)} por ${esc(e.quien)}</b>`:' · pendiente'}</div>
      </div>
      ${ok ? '<span class="chip ok">OK</span>'
           : `<button type="button" class="mini go" data-delivpt="${f.lat},${f.lng}" data-k="${x.k}">Ya llegó</button>`}
    </div>`;
  }).join('');

  abrirSheet(`
    <div class="zhead">
      <div class="row">
        <div class="fbadge" style="background:${UCOL[f.u]};width:40px;height:40px;border-radius:12px;font-size:16px">${f.n}</div>
        <div class="grow">
          <h3 style="margin:0">${esc(f.ref || 'Punto sin nombre')}</h3>
          <div class="muted">${esc(z.n)}${z.t==='corregimiento'?' (rural)':''} ·
            ${f.n} reporte${f.n>1?'s':''}${f.personas?` · ~${f.personas} personas`:''} · ${hace(f.ts)}</div>
        </div>
      </div>
      <div class="btn2">
        <button class="btn red" data-newpt="${f.lat},${f.lng}" data-ref="${esc(f.ref||'')}">${ico('plus')} Otra necesidad aquí</button>
        <button class="btn green" data-delivpt="${f.lat},${f.lng}">${ico('check')} Registrar entrega</button>
      </div>
    </div>

    <div class="sec">Lo que se necesita en este punto (${f.needs.length})</div>
    ${filas}

    <div class="sec">Quién responde por este punto</div>
    ${cb.length ? cb.map(c=>`
      <div class="need-line">
        ${avatar(c)}
        <div class="grow">
          <div style="font-size:14px">${esc(c.nom)}
            ${c.ver?'<span class="verif">verificado</span>':'<span class="pend">sin verificar</span>'}</div>
          <div class="cnt">${esc(c.micro||'micro-zona')} · a ${Math.round(dist(f.lat,f.lng,c.lat,c.lng))} m · ${esc(c.rol)}</div>
        </div>
        <a class="mini" href="${waLink(c.tel)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>`).join('')
      : `<div class="foco orf"><b style="color:#fca5a5">${ico('alert')} Nadie responde por este punto.</b>
         <div class="cnt" style="margin-top:6px">Si usted está por acá, puede quedar como referencia del sector.</div>
         <div class="fbtns"><button type="button" class="mini" data-coordpt="${f.lat},${f.lng}">Hacerme cargo de este sector</button></div></div>`}

    <div class="fbtns" style="margin-top:14px">
      <button type="button" class="mini" data-verpt="${f.lat},${f.lng}">${ico('zoom')} Ver en el mapa</button>
      <button type="button" class="mini" data-zona="${zid}">Ver toda la zona ${esc(z.n)}</button>
    </div>
    <button class="btn flat" data-close-btn>Cerrar</button>
  `);
}

/* ---------- reportar necesidad ---------- */
let sel = new Set(), urg = 3;
/* top de necesidades más pedidas — atajo para no buscar nada */
function topPedidos(n=10){
  const c={}; S.reportes.forEach(r=>c[r.k]=(c[r.k]||0)+1);
  return Object.keys(c).filter(k=>NEED[k]).sort((a,b)=>c[b]-c[a]).slice(0,n);
}
const optHTML = k=>`<button type="button" class="opt ${sel.has(k)?'sel':''}" data-k="${k}">${esc(NEED[k]?.n||k)}</button>`;
function itemsHTML(q, cat){
  const nq = NORM(q||'');
  let html = '';
  if(!nq && !cat){
    const top = topPedidos(10);
    if(top.length) html += `<div class="sec">${ico('bolt')} Lo más pedido ahora</div>
      <div class="opts">${top.map(optHTML).join('')}</div>`;
  }
  CATALOGO.forEach(c=>{
    if(cat && cat!==c.cat) return;
    const its = c.items.filter(i=>!nq || NORM(i.n+' '+(i.s||'')+' '+c.cat).includes(nq));
    if(!its.length) return;
    html += `<div class="sec">${ico(c.ic)} ${c.cat}</div>
      <div class="opts">${its.map(i=>optHTML(i.k)).join('')}</div>`;
  });
  return html || `<p class="muted">No encontramos "${esc(q)}". Escríbalo en la nota de abajo
    y el coordinador de la zona lo verá igual.</p>`;
}

function abrirReporte(zid, pt, refPrev){
  sel = new Set(); urg = 3;
  abrirSheet(`
    <h3>¿Qué se necesita?</h3>
    <p class="muted">Sin registro y sin dar su nombre.</p>
    ${pickerHTML('r-map', zid)}

    <div class="sec">Punto de referencia</div>
    <div id="r-sug" class="sug"></div>
    <input id="r-ref" placeholder="…o escríbalo: la cancha, el salón comunal, la tienda de don Óscar">

    <div class="sec">Qué tan urgente</div>
    <div class="urg" id="r-urg">
      <button data-u="3" class="sel">Hoy mismo</button>
      <button data-u="2">En 24 horas</button>
      <button data-u="1">Puede esperar</button>
    </div>

    <div class="sec">¿Qué hace falta?</div>
    <input id="r-busca" type="search" placeholder="Buscar: gasas, pañales, linterna, agua…">
    <div class="cats" id="r-cats">
      <button class="on" data-c="">Todo</button>
      ${CATALOGO.map(c=>`<button data-c="${esc(c.cat)}">${ico(c.ic)} ${esc(c.cat)}</button>`).join('')}
    </div>
    <div id="r-items"></div>

    <label class="f">¿Cuántas personas aproximadamente?</label>
    <input id="r-pers" type="number" inputmode="numeric" min="1" placeholder="Ej: 40">
    <label class="f">Algo más que ayude a llegar (opcional)</label>
    <textarea id="r-nota" placeholder="Ej: la vía está bloqueada, solo entra moto, hay un adulto mayor solo"></textarea>
    <button class="btn flat" data-close-btn>Cancelar</button>

    <div class="selbar">
      <span class="grow" id="r-cnt">Nada seleccionado</span>
      <button class="btn red" id="r-send" disabled>Enviar</button>
    </div>
  `);

  const body=$('#sheet-body');
  // sugerencias de referencia cercanas al pin — se recalculan al moverlo
  const pintarSug = (la, lo)=>{
    const rs = refsCerca(la, lo, 5);
    $('#r-sug').innerHTML = rs.length
      ? rs.map(r=>`<button type="button" class="sugb" data-ref="${esc(r.ref)}"
           data-rlat="${r.lat}" data-rlng="${r.lng}">${esc(r.ref)}
           <span class="muted">${Math.round(r.d)} m</span></button>`).join('')
      : '<span class="muted" style="font-size:13px">No hay sitios ya nombrados cerca. Escriba uno abajo.</span>';
  };
  pickerInit('r-map', zid, pt || ptDe(zid), pintarSug);
  if(modoSVG) pintarSug((ZONAS.find(z=>z.id===zid)||ZONAS[0]).lat, (ZONAS.find(z=>z.id===zid)||ZONAS[0]).lng);
  if(refPrev){                       // viene desde un punto que ya tiene nombre
    $('#r-ref').value = refPrev;
    body.querySelectorAll('.sugb').forEach(x=>x.classList.toggle('sel', x.dataset.ref===refPrev));
  }

  $('#r-sug').onclick = e=>{
    const b = e.target.closest('[data-ref]'); if(!b) return;
    $('#r-ref').value = b.dataset.ref;
    body.querySelectorAll('.sugb').forEach(x=>x.classList.toggle('sel', x===b));
    // al escoger un sitio conocido, el pin se va exactamente allá
    const la=+b.dataset.rlat, lo=+b.dataset.rlng;
    if(!modoSVG && pickMk){ pickMk.setLatLng([la,lo]); pickMap.panTo([la,lo]); pickMk.fire('dragend',{target:pickMk}); }
    toast('Punto fijado en ' + b.dataset.ref);
  };

  // buscador + categorías
  const repintar = ()=>{ $('#r-items').innerHTML = itemsHTML($('#r-busca').value,
      body.querySelector('#r-cats button.on').dataset.c); };
  $('#r-busca').oninput = repintar;
  $('#r-cats').onclick = e=>{
    const b=e.target.closest('button'); if(!b) return;
    body.querySelectorAll('#r-cats button').forEach(x=>x.classList.toggle('on', x===b));
    repintar();
  };
  const actualizarBarra = ()=>{
    $('#r-cnt').textContent = sel.size
      ? `${sel.size} seleccionada${sel.size>1?'s':''}: ` + [...sel].slice(0,3).map(k=>NEED[k]?.n||k).join(', ') + (sel.size>3?'…':'')
      : 'Nada seleccionado';
    $('#r-send').disabled = sel.size===0;
    $('#r-send').textContent = sel.size ? `Enviar ${sel.size}` : 'Enviar';
  };
  $('#r-items').onclick = e=>{
    const o = e.target.closest('.opt'); if(!o) return;
    const k = o.dataset.k;
    sel.has(k) ? sel.delete(k) : sel.add(k);
    body.querySelectorAll(`.opt[data-k="${k}"]`).forEach(x=>x.classList.toggle('sel', sel.has(k)));
    actualizarBarra();
  };
  repintar();
  body.querySelectorAll('#r-urg button').forEach(b=>b.onclick=()=>{
    body.querySelectorAll('#r-urg button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); urg=+b.dataset.u;
  });
  $('#r-send').onclick=()=>{
    const pt = pickerVal('r-map');
    if(!pt || !pt.z) return toast('Toque el mapa para marcar dónde es.');
    const p=parseInt($('#r-pers').value||'0',10)||0, nota=$('#r-nota').value.trim(), ref=$('#r-ref').value.trim();
    const firma = pt.z+'|'+ref+'|'+[...sel].sort().join(',');
    if(repetido(firma)){ cerrarSheet(); return toast('Ese mismo reporte se acaba de enviar.'); }
    cerrarSheet();
    sel.forEach(k=>guardar('reportes',
      {zona:pt.z, necesidad:k, urgencia:urg, lat:pt.lat, lng:pt.lng,
       referencia:ref, personas:p, nota, device:DEVICE},
      {id:uid(), z:pt.z, lat:pt.lat, lng:pt.lng, k, u:urg, ts:now(), personas:p, nota, ref}));
    render();
    // ¿el reporte cayó en un foco que ya existía?
    const f = focos(pt.z).find(x=>x.reps.some(r=>r.lat===pt.lat && r.lng===pt.lng));
    toast(f && f.n>1
      ? `Reporte #${f.n} en este punto. La urgencia subió.`
      : 'Reporte enviado desde ' + (ZONAS.find(z=>z.id===pt.z)?.n||'') + '. Gracias.');
  };
}

/* ---------- registrar entrega ---------- */
function abrirEntrega(zid, kfijo, pt){
  const z0 = ZONAS.find(z=>z.id===zid);
  const p0 = pt || ptDe(zid);
  // pendientes DEL PUNTO si venimos de uno; si no, los de la zona
  let f = null;
  if(p0){ let bd=1e9; focos(zid).forEach(x=>{ const d=dist(p0.lat,p0.lng,x.lat,x.lng); if(d<bd){bd=d;f=x;} });
          if(f && dist(p0.lat,p0.lng,f.lat,f.lng) > 400) f = null; }
  const st = estadoZona(z0);
  const pk = f ? f.needs.map(x=>x.k) : st.pend.map(p=>p.k);
  const sitio = f ? (f.ref || 'Punto sin nombre') : z0.n;
  const eSel = new Set(kfijo ? [kfijo] : []);

  const btn = k=>`<button type="button" class="opt ${eSel.has(k)?'sel':''}" data-k="${k}"
    data-t="${esc(NORM((NEED[k]?.n||k)+' '+(NEED[k]?.s||'')+' '+(NEED[k]?.cat||'')))}">${esc(NEED[k]?.n||k)}</button>`;

  abrirSheet(`
    <div class="zhead">
      <div class="row">
        <div class="rank" style="background:#3f8f5f;color:#fff">${ico('check')}</div>
        <div class="grow">
          <h3 style="margin:0">Registrar entrega</h3>
          <div class="muted">Marque lo que llegó. Sin esto el mapa sigue mostrando la zona como abandonada.</div>
        </div>
      </div>
    </div>

    <div class="ptline">${ico('pin')} <b>${esc(sitio)}</b>
      <span class="muted">${esc(z0.n)}${z0.t==='corregimiento'?' (rural)':''}</span></div>
    <details class="fold" id="e-foldmap">
      <summary>Cambiar el punto</summary>
      <div class="foldbody">${pickerHTML('e-map', zid)}</div>
    </details>

    <div class="sec">¿Qué llegó?</div>
    ${pk.length
      ? `<div class="opts" id="e-pend">${pk.map(btn).join('')}</div>`
      : '<p class="muted">Este punto no tiene necesidades pendientes registradas.</p>'}

    <details class="fold">
      <summary>Se entregó otra cosa que no está en la lista</summary>
      <div class="foldbody">
        <input id="e-busca" type="search" placeholder="Buscar en las ${Object.keys(NEED).length} categorías…">
        <div class="opts" id="e-otros" style="margin-top:8px">
          ${Object.keys(NEED).filter(k=>!pk.includes(k)).map(btn).join('')}
        </div>
      </div>
    </details>

    <label class="f">¿Quién entregó?</label>
    <input id="e-quien" placeholder="Cruz Roja, la JAC, un particular, una empresa…">

    <details class="fold">
      <summary>Agregar cantidad u observación</summary>
      <div class="foldbody">
        <input id="e-cant" placeholder="Ej: 200 botellones, 40 mercados, alcanzó para 30 familias">
      </div>
    </details>

    <button class="btn flat" data-close-btn>Cancelar</button>

    <div class="selbar">
      <span class="grow" id="e-cnt">Nada marcado</span>
      <button class="btn green" id="e-send" disabled>Registrar</button>
    </div>
  `);

  pickerInit('e-map', zid, p0);
  // el mapa vive dentro de un desplegable: hay que recalcularlo al abrirlo
  const fm = $('#e-foldmap');
  if(fm) fm.ontoggle = ()=>{ if(fm.open && pickMap) setTimeout(()=>pickMap.invalidateSize(), 120); };

  const body = $('#sheet-body');
  const refrescar = ()=>{
    $('#e-cnt').textContent = eSel.size
      ? [...eSel].map(k=>NEED[k]?.n||k).slice(0,3).join(', ') + (eSel.size>3?` +${eSel.size-3}`:'')
      : 'Nada marcado';
    $('#e-send').disabled = eSel.size===0;
    $('#e-send').textContent = eSel.size>1 ? `Registrar ${eSel.size}` : 'Registrar';
  };
  body.addEventListener('click', e=>{
    const o = e.target.closest('#e-pend .opt, #e-otros .opt'); if(!o) return;
    const k = o.dataset.k;
    eSel.has(k) ? eSel.delete(k) : eSel.add(k);
    body.querySelectorAll(`.opt[data-k="${k}"]`).forEach(x=>x.classList.toggle('sel', eSel.has(k)));
    refrescar();
  });
  const otros = [...body.querySelectorAll('#e-otros .opt')];
  $('#e-busca').oninput = e=>{
    const q = NORM(e.target.value);
    otros.forEach(o=>{ o.style.display = (!q || o.dataset.t.includes(q)) ? '' : 'none'; });
  };
  refrescar();

  $('#e-send').onclick=()=>{
    if(!eSel.size) return toast('Marque qué se entregó');
    const p = pickerVal('e-map');
    if(!p || !p.z) return toast('Toque el mapa para marcar dónde se entregó.');
    const quien = $('#e-quien').value.trim() || 'Anónimo';
    const cant  = $('#e-cant') ? $('#e-cant').value.trim() : '';
    cerrarSheet();
    eSel.forEach(k=>guardar('entregas',
      {zona:p.z, necesidad:k, lat:p.lat, lng:p.lng, quien, cantidad:cant, device:DEVICE},
      {id:uid(), z:p.z, lat:p.lat, lng:p.lng, k, ts:now(), quien, cant}));
    render();
    toast(`${eSel.size} entrega${eSel.size>1?'s':''} registrada${eSel.size>1?'s':''}. El mapa se actualizó.`);
  };
}


/* ---------- INSCRIBIRSE COMO COORDINADOR ----------
   Una sola pantalla. Primero lo útil: dónde va a estar y cómo se llama
   ese sector. Debajo, lo mínimo para que el registro sea suyo y lo pueda
   recuperar: celular y un PIN.

   Rol, radio y nota salían aquí y ya no: son cosas que se ajustan después,
   con calma, desde Mi cuenta. Pedirlas de entrada era la razón por la que
   inscribirse se sentía un trámite.

   La verificación tampoco es un paso: la persona queda inscrita y en el
   mapa de una. El sello verde llega después.                            */
function abrirCoord(zid, pt, zExist){
  if(zExist) return editarMicroZona(zExist);
  zid = zid || (typeof mainPt !== 'undefined' && mainPt ? mainPt.z : 'centro');

  abrirSheet(`
    <h3>Hacerme cargo de un sector</h3>
    <p class="muted">No se coordina una comuna entera: se coordina un sector.
      Ponga el pin donde va a estar. Todo queda visible públicamente.</p>

    ${pickerHTML('c-map', zid)}
    <label class="f" for="c-micro">¿Cómo le dicen a ese sector?</label>
    <input id="c-micro" placeholder="Ej: Ciudad Jardín, Manzana 12, La Playita">
    <div class="telhint">Con el nombre que usa la gente del barrio, no el oficial.</div>

    ${YO ? `
      <div class="ptline" style="margin-top:14px">
        <div class="row">
          ${avatar({foto:YO.foto, nombre:YO.nombre})}
          <div class="grow">
            <div style="font-weight:700">${esc(YO.nombre)}</div>
            <div class="muted">${esc(telBonito(YO.tel))}</div>
          </div>
          <button class="mini" id="c-cuenta">Mi cuenta</button>
        </div>
      </div>`
    : `
      <div class="sec">Para que el registro sea suyo</div>
      <p class="muted" style="margin:0 0 4px">Con su celular y un PIN vuelve a entrar
        desde cualquier teléfono y corrige lo suyo. Si ya se inscribió antes, escriba
        los mismos y entra derecho.</p>
      <label class="f" for="c-nom">Su nombre completo</label>
      <input id="c-nom" placeholder="Como lo conoce la comunidad" autocomplete="name">
      ${campoTel('c-tel1', 'Su celular de WhatsApp', 'Diez dígitos, empieza por 3.')}
      ${campoTel('c-tel2', 'Escríbalo otra vez', 'Es por donde lo va a buscar la gente.')}
      ${campoPin('c-pin1', 'Un PIN que solo usted sepa', 'Cuatro números.')}
      ${campoPin('c-pin2', 'Repita el PIN', 'Los dos tienen que ser iguales.')}`}

    <button class="btn" id="c-next">Inscribirme en este sector</button>
    <button class="btn flat" data-close-btn>Cancelar</button>
  `);

  pickerInit('c-map', zid, pt || ptDe(zid));

  if(YO){
    $('#c-cuenta').onclick = ()=>abrirMiCuenta();
  } else {
    const revisar = ()=>{
      const d1 = telCrudo('c-tel1'), d2 = telCrudo('c-tel2');
      if(!d1.length) pista('c-tel1','','Diez dígitos, empieza por 3.');
      else if(telOK(d1)) pista('c-tel1','ok','Le va a llegar el WhatsApp a <b>'+telBonito('57'+d1)+'</b>');
      else pista('c-tel1','bad','Faltan dígitos. En Colombia son 10 y empieza por 3.');
      if(!d2.length) pista('c-tel2','','Es por donde lo va a buscar la gente.');
      else if(d2 === d1 && telOK(d1)) pista('c-tel2','ok','Los dos números coinciden.');
      else pista('c-tel2','bad','No coincide con el de arriba.');
    };
    telVivo('c-tel1', revisar); telVivo('c-tel2', revisar);
    const revisarPin = ()=>{
      const p1 = $('#c-pin1').value, p2 = $('#c-pin2').value;
      if(!p1.length) pista('c-pin1','','Cuatro números.');
      else if(/^\d{4,6}$/.test(p1)) pista('c-pin1','ok','PIN válido.');
      else pista('c-pin1','bad','Solo números, entre 4 y 6.');
      if(!p2.length) pista('c-pin2','','Los dos tienen que ser iguales.');
      else if(p1 === p2) pista('c-pin2','ok','Los dos PIN coinciden.');
      else pista('c-pin2','bad','No coincide con el de arriba.');
    };
    $('#c-pin1').oninput = revisarPin; $('#c-pin2').oninput = revisarPin;
  }

  $('#c-next').onclick = async (e)=>{
    const micro = $('#c-micro').value.trim();
    if(!micro){ $('#c-micro').focus(); return toast('Póngale nombre al sector: así lo reconoce la gente.'); }

    if(!YO){
      const nom = $('#c-nom').value.trim();
      const d1 = telCrudo('c-tel1'), d2 = telCrudo('c-tel2');
      const p1 = $('#c-pin1').value, p2 = $('#c-pin2').value;
      if(nom.length < 3){ $('#c-nom').focus(); return toast('Escriba su nombre completo.'); }
      if(!telOK(d1)){ $('#c-tel1').focus(); return toast('Revise el celular.'); }
      if(d1 !== d2){ $('#c-tel2').focus(); return toast('Los dos celulares no coinciden.'); }
      if(!/^\d{4,6}$/.test(p1)){ $('#c-pin1').focus(); return toast('El PIN son 4 números.'); }
      if(p1 !== p2){ $('#c-pin2').focus(); return toast('Los dos PIN no coinciden.'); }

      const ok = await conEspera(e.target, 'Inscribiendo…', async ()=>{
        let r = await rpc('ae_registrar', {p_tel:'57'+d1, p_pin:p1, p_nombre:nom, p_foto:''});
        // Si ya tenía cuenta, el mismo PIN la abre: no hay que devolverlo a otra pantalla.
        if(!r.ok && r.ya_existe) r = await rpc('ae_entrar', {p_tel:'57'+d1, p_pin:p1});
        if(!r.ok){ toast(r.error); return false; }
        await sesionAbrir(r);
        return true;
      });
      if(!ok) return;
    }

    const p = pickerVal('c-map');
    const r = await conEspera(e.target, 'Guardando…', ()=>rpc('ae_guardar_zona', {
      p_token: YO.token, p_id: null,
      p_zona: p.z, p_micro: micro, p_radio: 500,
      p_lat: p.lat, p_lng: p.lng,
      p_rol: 'Vecino de la zona', p_nota: '',
    }));
    if(!r.ok) return toast(r.error);

    await yoCargar(); await dbCargar(); render();
    cerrarSheet();
    toast('Listo. Ya aparece a cargo de ' + micro + '.');
    abrirMiCuenta();
  };
}

/* ---------- AJUSTAR UNA MICRO-ZONA PROPIA ----------
   Aquí sí van el radio, el rol y la nota: son decisiones que se toman con
   calma, después, y no tienen por qué frenar a alguien que se está
   inscribiendo con el barrio encima.                                    */
function editarMicroZona(z){
  if(!YO) return abrirCuenta();
  abrirSheet(`
    <h3>Ajustar mi sector</h3>
    <p class="muted">Todo esto lo puede cambiar cuantas veces quiera.</p>

    ${pickerHTML('c-map', z.zona)}
    <label class="f" for="c-micro">¿Cómo le dicen a ese sector?</label>
    <input id="c-micro" value="${esc(z.micro||'')}" placeholder="Ej: Ciudad Jardín, Manzana 12">

    <div class="sec">Hasta dónde alcanza a cubrir</div>
    <p class="muted" style="margin:0 0 7px">Entre más pequeño, mejor. Una comuna entera no la
      atiende una sola persona; varios coordinadores con radios pequeños funcionan mucho mejor.</p>
    <div class="urg" id="c-radio">
      ${RADIOS.map(r=>`<button data-r="${r}" class="${r===(z.radio||500)?'sel':''}">${r} m</button>`).join('')}
    </div>

    <label class="f" for="c-rol">Rol</label>
    <select id="c-rol">
      ${['Vecino de la zona','Líder comunal / JAC','Organización / fundación',
         'Entidad pública','Voluntariado','Empresa donante']
        .map(o=>`<option${z.rol===o?' selected':''}>${o}</option>`).join('')}
    </select>

    <label class="f" for="c-nota">Nota pública (dónde lo encuentran, horario)</label>
    <textarea id="c-nota" placeholder="Ej: punto fijo en la cancha, 7am a 7pm">${esc(z.nota||'')}</textarea>

    <button class="btn" id="c-next">Guardar cambios</button>
    <button class="btn flat" id="c-volver">Volver</button>
  `);

  let radio = z.radio || 500, circ = null;
  const dibujarRadio = (la, lo)=>{
    if(modoSVG || !pickMap) return;
    const c = (la != null) ? [la, lo] : pickMk.getLatLng();
    if(circ) circ.setLatLng(c).setRadius(radio);
    else circ = L.circle(c, {radius:radio, color:'#4f9cf9', weight:2,
      fillColor:'#4f9cf9', fillOpacity:.16, interactive:false}).addTo(pickMap);
  };
  pickerInit('c-map', z.zona, {lat:z.lat, lng:z.lng}, dibujarRadio);
  if(pickMap) setTimeout(()=>{ if(circ) pickMap.fitBounds(circ.getBounds().pad(0.3)); }, 260);

  const btns = $('#sheet-body').querySelectorAll('#c-radio button');
  btns.forEach(b=>b.onclick = ()=>{
    btns.forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
    radio = +b.dataset.r; dibujarRadio();
  });

  $('#c-volver').onclick = ()=>abrirMiCuenta();
  $('#c-next').onclick = async (e)=>{
    const p = pickerVal('c-map');
    if(!p || !p.z) return toast('Toque el mapa para marcar dónde va a estar.');
    const micro = $('#c-micro').value.trim();
    if(!micro){ $('#c-micro').focus(); return toast('Póngale nombre al sector: así lo reconoce la gente.'); }

    /* Inscribirse y corregir pasan por el servidor, no por un insert directo.
       Así el dueño del sector es la cuenta y no el teléfono: quien entre con
       su celular y su PIN desde otro aparato sigue mandando sobre lo suyo.
       El navegador no puede escribir nada de esto por su cuenta.            */
    if(!exigeSenal()) return;

    const r = await conEspera(e.target, 'Guardando…', ()=>rpc('ae_guardar_zona', {
      p_token: YO.token, p_id: z.id,
      p_zona: p.z, p_micro: micro, p_radio: radio,
      p_lat: p.lat, p_lng: p.lng,
      p_rol: $('#c-rol').value, p_nota: $('#c-nota').value.trim(),
    }));
    if(!r.ok) return toast(r.error);
    await yoCargar(); await dbCargar(); render();
    toast('Guardado.');
    abrirMiCuenta();
  };
}
