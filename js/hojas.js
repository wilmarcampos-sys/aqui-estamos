/* ============================================================
   6. UI
   ============================================================ */
const $ = s=>document.querySelector(s);
const esc = s=>String(s??'').replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const iniciales = n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const avatar = c => c.foto
  ? `<div class="avatar" style="background-image:url('${c.foto}')"></div>`
  : `<div class="avatar">${esc(iniciales(c.nom))}</div>`;
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
      : '<span class="muted" style="font-size:12.5px">No hay sitios ya nombrados cerca. Escriba uno abajo.</span>';
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

/* ---------- inscripción de coordinador con verificación ---------- */
function abrirCoord(zid, pt){
  abrirSheet(`
    <h3>Coordinador de micro-zona</h3>
    <p class="muted">No se coordina una comuna entera: se coordina un sector.
      Ponga el pin donde va a estar y elija hasta dónde alcanza a cubrir.
      Todo queda visible públicamente.</p>
    ${pickerHTML('c-map', zid)}
    <label class="f">Nombre de la micro-zona que va a cubrir</label>
    <input id="c-micro" placeholder="Ej: Ciudad Jardín, Manzana 12, La Playita">
    <div class="sec">Radio de cobertura</div>
    <p class="muted" style="margin:0 0 7px">Entre más pequeño, mejor. Una comuna entera no la
      atiende una sola persona; varios coordinadores con radios pequeños funcionan mucho mejor.</p>
    <div class="urg" id="c-radio">
      ${RADIOS.map(r=>`<button data-r="${r}" class="${r===500?'sel':''}" style="font-size:11.5px">${r} m</button>`).join('')}
    </div>
    <div class="sec">Foto</div>
    <div class="row">
      <div class="avatar big" id="c-prev">+</div>
      <div class="grow">
        <p class="muted" style="margin:0 0 6px">Para que la gente de la zona lo reconozca en la calle
          y en los puntos de entrega.</p>
        <input id="c-foto" type="file" accept="image/*" capture="environment" style="padding:9px;font-size:13px">
      </div>
    </div>
    <label class="f">Nombre completo</label><input id="c-nom" placeholder="Como lo conoce la comunidad">
    <label class="f">Rol</label>
    <select id="c-rol">
      <option>Líder comunal / JAC</option><option>Vecino de la zona</option>
      <option>Organización / fundación</option><option>Entidad pública</option>
      <option>Voluntariado</option><option>Empresa donante</option>
    </select>
    <label class="f">Celular de WhatsApp</label>
    <input id="c-tel" type="tel" inputmode="tel" placeholder="+57 300 000 0000" autocomplete="tel">
    <div class="telhint" id="c-telhint">Así lo va a contactar la gente. Escriba los 10 dígitos.</div>
    <details class="fold">
      <summary>Agregar un correo (opcional)</summary>
      <div class="foldbody">
        <input id="c-mail" type="email" inputmode="email" placeholder="nombre@correo.com">
        <p class="muted" style="margin:8px 0 0;font-size:12px">Solo por si algún día pierde el
          WhatsApp. La coordinación del día a día no lo usa.</p>
      </div>
    </details>
    <label class="f">Nota pública (dónde lo encuentran, horario)</label>
    <textarea id="c-nota" placeholder="Ej: punto fijo en la cancha, 7am a 7pm"></textarea>
    <button class="btn" id="c-next">Continuar y verificar</button>
    <button class="btn flat" data-close-btn>Cancelar</button>
  `);
  let radio = 500, foto = null, circ = null;
  const dibujarRadio = (la, lo)=>{
    if(modoSVG || !pickMap) return;
    const c = (la!=null) ? [la,lo] : pickMk.getLatLng();
    if(circ) circ.setLatLng(c).setRadius(radio);
    else circ = L.circle(c,{radius:radio, color:'#4f9cf9', weight:2,
      fillColor:'#4f9cf9', fillOpacity:.16, interactive:false}).addTo(pickMap);
  };
  pickerInit('c-map', zid, pt || ptDe(zid), dibujarRadio);
  if(pickMap) setTimeout(()=>{ if(circ) pickMap.fitBounds(circ.getBounds().pad(0.3)); }, 260);
  $('#sheet-body').querySelectorAll('#c-radio button').forEach(b=>b.onclick=()=>{
    $('#sheet-body').querySelectorAll('#c-radio button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); b.style.background='#4f9cf9'; b.style.borderColor='#4f9cf9'; b.style.color='#04122b';
    $('#sheet-body').querySelectorAll('#c-radio button').forEach(x=>{ if(x!==b){x.style.background='';x.style.borderColor='';x.style.color='';} });
    radio = +b.dataset.r; dibujarRadio();
  });
  $('#c-foto').onchange = e=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    if(!/^image\//.test(f.type)) return toast('Debe ser una imagen');
    const fr = new FileReader();
    fr.onload = ()=>{
      const im = new Image();
      im.onload = ()=>{
        // recorte cuadrado + compresión: la app tiene que servir con datos malos
        const S0=320, cv=document.createElement('canvas'); cv.width=cv.height=S0;
        const g=cv.getContext('2d'), m=Math.min(im.width,im.height);
        g.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,S0,S0);
        foto = cv.toDataURL('image/jpeg', 0.72);
        const pv=$('#c-prev'); pv.textContent=''; pv.style.backgroundImage=`url(${foto})`;
        toast('Foto lista');
      };
      im.onerror = ()=>toast('No se pudo leer la imagen');
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  // formato de WhatsApp en vivo
  const tel = $('#c-tel'), telh = $('#c-telhint');
  const revisarTel = ()=>{
    const d = telDigitos(tel.value);
    telh.className = 'telhint ' + (d ? 'ok' : (tel.value.replace(/\D/g,'').length ? 'bad' : ''));
    telh.innerHTML = d
      ? ico('check') + ` Le llegará el SMS y el WhatsApp a <b>${telBonito(tel.value)}</b>`
      : (tel.value.replace(/\D/g,'').length
          ? ico('alert') + ' Número incompleto. En Colombia son 10 dígitos y empieza por 3.'
          : 'Así lo va a contactar la gente. Escriba los 10 dígitos.');
    return !!d;
  };
  tel.oninput = ()=>{
    const v = tel.value;
    // si escribe un número de otro país (empieza por + y no es 57) se respeta tal cual
    if(!/^\+(?!57)/.test(v.trim())) {
      const pos = tel.selectionStart === v.length;
      tel.value = telFormatoVivo(v);
      if(pos) tel.setSelectionRange(tel.value.length, tel.value.length);
    }
    revisarTel();
  };
  tel.onfocus = ()=>{ if(!tel.value.trim()) { tel.value = '+57 '; revisarTel(); } };

  $('#c-next').onclick=()=>{
    const pt = pickerVal('c-map');
    const d={z:pt.z, lat:pt.lat, lng:pt.lng, foto, radio, micro:$('#c-micro').value.trim(),
             nom:$('#c-nom').value.trim(), rol:$('#c-rol').value,
             email:($('#c-mail')?$('#c-mail').value.trim():''), tel:$('#c-tel').value.trim(),
             nota:$('#c-nota').value.trim()};
    if(!d.nom || !d.tel) return toast('El nombre y el celular son obligatorios');
    if(d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return toast('Revise el correo electrónico');
    if(!telDigitos(d.tel)){ revisarTel(); tel.focus();
      return toast('El celular no sirve para WhatsApp. Deben ser 10 dígitos.'); }
    d.tel = telBonito(d.tel);           // se guarda siempre en formato internacional
    // ¿ya está verificado? Entonces solo suma otra micro-zona, sin repetir el proceso
    const ya = S.coords.find(c=>c.ver && personaKey(c)===personaKey(d));
    if(ya){
      const p = porPersona().find(x=>x.k===personaKey(d));
      cerrarSheet();
      guardar('coordinadores',
        {zona:d.z, micro:d.micro||'', radio:d.radio||500, lat:d.lat, lng:d.lng,
         nombre:d.nom, rol:d.rol||'', tel:d.tel, tel_e164:telDigitos(d.tel)||'',
         email:d.email||'', nota:d.nota||'', foto:d.foto||ya.foto||'', device:DEVICE},
        {id:uid(), ...d, ver:true, foto:d.foto||ya.foto});
      return toast(p && p.n>=MAX_MICRO
        ? `Micro-zona añadida. Ya cubre ${p.n+1} sectores: busque quién le ayude.`
        : 'Micro-zona añadida a su nombre. Ya estaba verificado.');
    }
    verificar(d);
  };
}
/* ---- VERIFICACIÓN AL REVÉS ----
   En vez de mandarle un código (que exige plantillas aprobadas por Meta y puede
   demorar semanas), la persona NOS envía el código desde su propio WhatsApp.
   Recibir mensajes es gratis y no necesita ninguna aprobación previa.
   Y de paso comprueba lo que de verdad importa: que ese WhatsApp funciona.   */
const VERIFICA_WA = '572322314100';
function verificar(d){
  const code = 'AE-' + String(Math.floor(100000+Math.random()*900000));
  const texto = `${code}\nSoy ${d.nom} y coordino ${d.micro || ZONAS.find(z=>z.id===d.z)?.n || ''} en Aquí Estamos.`;
  abrirSheet(`
    <div class="zhead">
      <div class="row">
        ${avatar(d)}
        <div class="grow">
          <h3 style="margin:0">Verificar su WhatsApp</h3>
          <div class="muted">${esc(d.nom)} · ${esc(d.rol)}</div>
        </div>
      </div>
    </div>

    <p class="muted" style="margin:12px 0 0">No hay que esperar ningún SMS.
      Usted nos envía este código desde su WhatsApp y con eso queda verificado.</p>

    <div class="codebox">${code}</div>

    <a class="btn wa" id="v-wa" target="_blank" rel="noopener"
       href="${waLink(VERIFICA_WA, texto)}">${icoWA()} Abrir WhatsApp y enviar</a>
    <p class="muted" style="margin:9px 0 0">Se abre el chat de Aquí Estamos con el mensaje
      ya escrito. Solo dele <b>enviar</b> y vuelva a esta pantalla.</p>

    <div class="waitrow" id="v-wait" hidden>
      <span class="spin"></span> Esperando su mensaje…
    </div>

    <button class="btn" id="v-listo">Ya lo envié</button>

    <details class="fold">
      <summary>No tengo WhatsApp en este teléfono</summary>
      <div class="foldbody">
        <p class="muted" style="margin:0 0 9px">Le mandamos un enlace al correo.
          Es más lento pero funciona igual.</p>
        <input id="v-mail" type="email" inputmode="email" placeholder="nombre@correo.com"
          value="${esc(d.email||'')}">
        <button class="btn flat" id="v-mailok" style="margin-top:9px">Enviarme el enlace</button>
      </div>
    </details>

    <button class="btn flat" id="c-skip">Inscribirme sin verificar por ahora</button>
    <p class="muted" style="margin-top:10px;font-size:11.5px">Sin verificar igual aparece en la lista,
      pero marcado en amarillo. La gente confía menos.</p>
  `);

  const publicar = (ver, msg)=>{
    const email = $('#v-mail') ? $('#v-mail').value.trim() : (d.email||'');
    cerrarSheet();
    guardar('coordinadores',
      {zona:d.z, micro:d.micro||'', radio:d.radio||500, lat:d.lat, lng:d.lng,
       nombre:d.nom, rol:d.rol||'', tel:d.tel, tel_e164:telDigitos(d.tel)||'',
       email, nota:d.nota||'', foto:d.foto||'', codigo:code, device:DEVICE},
      {id:uid(), ...d, email, ver});
    toast(EN_LINEA && ver
      ? 'Inscrito. Queda verificado apenas llegue su mensaje de WhatsApp.'
      : msg);
  };
  $('#v-wa').addEventListener('click', ()=>{ $('#v-wait').hidden = false; });
  $('#v-listo').onclick = ()=>{
    // DEMO: aquí el servidor confirmaría al recibir el mensaje (webhook de WhatsApp).
    $('#v-wait').hidden = false;
    $('#v-listo').disabled = true;
    setTimeout(()=>publicar(true, 'WhatsApp verificado. Ya aparece públicamente.'), 1100);
  };
  $('#v-mailok').onclick = ()=>{
    const m = $('#v-mail').value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return toast('Revise el correo');
    publicar(true, 'Enlace enviado al correo. Quedó verificado.');
  };
  $('#c-skip').onclick = ()=>publicar(false, 'Inscrito como "sin verificar".');
}
