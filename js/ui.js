/* ============================================================
   7. EVENTOS Y VISTAS
   ============================================================ */
/* ---------- delegación de eventos en la hoja ---------- */
$('#sheet-body').addEventListener('click', e=>{
  const g=e.target.closest('[data-gps]');
  if(g) return pickerGPS(g.dataset.gps);
  // selección múltiple de necesidades → un solo "Ya llegó"
  const ym=e.target.closest('#ya-multi');
  if(ym){
    const keys=[...document.querySelectorAll('#sheet-body .nec-card.sel[data-nsel]')].map(c=>c.getAttribute('data-nsel'));
    if(!keys.length) return toast('Marque al menos una necesidad.');
    const [la,lo]=ym.dataset.pt.split(',').map(Number);
    return abrirEntrega(ym.dataset.z, keys, {z:ym.dataset.z, lat:la, lng:lo});
  }
  const ns=e.target.closest('.nec-card[data-nsel]');
  if(ns){ ns.classList.toggle('sel'); actualizarYaMulti(); return; }
  const t=e.target.closest('[data-new],[data-deliv],[data-coord],[data-ent],[data-close-btn]');
  if(!t) return;
  if(t.hasAttribute('data-close-btn')) return cerrarSheet();
  if(t.dataset.new) return abrirReporte(t.dataset.new);
  if(t.dataset.deliv) return abrirEntrega(t.dataset.deliv);
  if(t.dataset.coord) return abrirCoord(t.dataset.coord);
  if(t.dataset.ent) return abrirEntrega(t.dataset.z, t.dataset.ent);
});

/* actualiza el botón "Ya llegó (N)" según cuántas necesidades hay marcadas */
function actualizarYaMulti(){
  const b=document.getElementById('ya-multi'); if(!b) return;
  const n=document.querySelectorAll('#sheet-body .nec-card.sel[data-nsel]').length;
  b.disabled=n===0;
  b.innerHTML=n ? `${ico('check')} Ya llegó (${n})` : 'Marque lo que llegó';
}

/* focos y "hacerme cargo" funcionan igual dentro de la hoja o en la lista general */
const xy = s => s.split(',').map(Number);
document.addEventListener('click', e=>{
  const cp = e.target.closest('[data-coordpt]');
  if(cp){ const [la,lo]=xy(cp.dataset.coordpt); return abrirCoord(zonaDe(la,lo).id,{lat:la,lng:lo}); }

  const np = e.target.closest('[data-newpt]');
  if(np){ const [la,lo]=xy(np.dataset.newpt);
    return abrirReporte(zonaDe(la,lo).id, {z:zonaDe(la,lo).id, lat:la, lng:lo}, np.dataset.ref||''); }

  const dp = e.target.closest('[data-delivpt]');
  if(dp){ const [la,lo]=xy(dp.dataset.delivpt);
    return abrirEntrega(zonaDe(la,lo).id, dp.dataset.k||null, {z:zonaDe(la,lo).id, lat:la, lng:lo}); }

  const zb = e.target.closest('[data-zona]');
  if(zb) return abrirZona(zb.dataset.zona);

  const fp = e.target.closest('[data-focopt]');
  if(fp){ const [la,lo]=xy(fp.dataset.focopt); return abrirFoco(zonaDe(la,lo).id, la, lo); }

  const vp = e.target.closest('[data-verpt],[data-foco]');
  if(vp && map && !modoSVG){
    const [la,lo] = xy(vp.dataset.verpt || vp.dataset.foco);
    cerrarSheet();
    document.querySelector('nav button[data-v="map"]').click();
    map.flyTo([la,lo], 16.5, {duration:.8});
    toast('Enfocado en el punto');
  }
});

/* Un encabezado sin nada debajo es basura visual: se esconde la sección entera. */
function seccion(idSec, idLista, titulo, html, subtitulo){
  const sec = document.getElementById(idSec), lista = document.getElementById(idLista);
  if(!sec || !lista) return;
  const hay = !!html;
  sec.innerHTML   = hay ? titulo : '';
  sec.style.display = hay ? '' : 'none';
  lista.innerHTML = html || '';
  if(subtitulo){
    const p = sec.nextElementSibling;
    if(p && p.tagName === 'P') p.style.display = hay ? '' : 'none';
  }
}

/* Estados vacíos: una base sin datos no es un error, pero tiene que decirlo
   con palabras y no con un rectángulo negro. */
function vacio(titulo, texto, boton){
  return `<div class="vacio">
    <div class="vic">${ico('search')}</div>
    <b>${esc(titulo)}</b>
    <p>${esc(texto)}</p>
    ${boton?`<button class="btn red" onclick="document.querySelector('nav button[data-v=\\'map\\']').click()">${esc(boton)}</button>`:''}
  </div>`;
}

/* La marca es el camino de vuelta: desde cualquier pantalla lleva al mapa. */
const irAlMapa = ()=>{ cerrarSheet(); document.querySelector('nav button[data-v="map"]').click();
  setTimeout(()=>{ if(map) map.invalidateSize(); }, 120); };
const bMarca = document.getElementById('ir-mapa');
if(bMarca) bMarca.onclick = irAlMapa;

/* Entrar / inscribirse desde cualquier parte (los botones se re-pintan) */
document.addEventListener('click', e=>{
  if(e.target.closest('[data-cuenta]')) return abrirCuenta();
  if(e.target.closest('[data-coord-intro]')) return abrirCoordIntro();
  if(e.target.closest('[data-inscribir]')){ const pt = mainPt || ptDe('centro'); return abrirCoord(pt.z, pt); }
});

/* Copiar al portapapeles (teléfonos, códigos): en móvil el link de WhatsApp a
   veces falla, así que el número copiable es el plan B seguro. */
function copiarFallback(txt){
  const t=document.createElement('textarea'); t.value=txt;
  t.style.position='fixed'; t.style.top='-1000px'; t.style.opacity='0';
  document.body.appendChild(t); t.focus(); t.select();
  try{ document.execCommand('copy'); toast('Copiado: '+txt); }
  catch(e){ toast('Cópielo a mano: '+txt); }
  document.body.removeChild(t);
}
function copiar(txt){
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(()=>toast('Copiado: '+txt), ()=>copiarFallback(txt));
  else copiarFallback(txt);
}
document.addEventListener('click', e=>{
  const c=e.target.closest('[data-copiar]'); if(!c) return;
  e.preventDefault(); copiar(c.getAttribute('data-copiar'));
});

/* Copia de teléfonos con freno anti-scraping: un invitado puede copiar hasta
   10 números por dispositivo (ventana de 24 h); pasado eso, tiene que entrar
   como coordinador. Los coordinadores logueados no tienen límite. */
const LIMITE_COPIA_TEL = 10, VENTANA_COPIA = 24*3600*1000;
function copiarTel(txt){
  if(typeof YO !== 'undefined' && YO) return copiar(txt);   // logueado: sin límite
  let arr=[]; try{ arr = JSON.parse(localStorage.getItem('ae_copias')||'[]'); }catch(e){}
  const ahora = Date.now();
  arr = arr.filter(t => ahora - t < VENTANA_COPIA);
  if(arr.length >= LIMITE_COPIA_TEL){
    toast('Copió varios números ya. Entre como coordinador para seguir.');
    if(typeof abrirCuenta === 'function') abrirCuenta();
    return;
  }
  arr.push(ahora);
  try{ localStorage.setItem('ae_copias', JSON.stringify(arr)); }catch(e){}
  copiar(txt);
}
document.addEventListener('click', e=>{
  const c=e.target.closest('[data-copiar-tel]'); if(!c) return;
  e.preventDefault(); copiarTel(c.getAttribute('data-copiar-tel'));
});

/* ---------- vistas ---------- */
let filtro='todas';
document.querySelectorAll('#filtros button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#filtros button').forEach(x=>x.classList.toggle('on',x===b));
  filtro=b.dataset.f; render();
});

/* La explicación de Zonas se lee una vez; se puede ocultar y no vuelve. */
(function(){
  const n=document.getElementById('zonas-nota'), x=document.getElementById('zonas-nota-x');
  if(!n) return;
  try{ if(localStorage.getItem('ae_nota_zonas')==='off') n.style.display='none'; }catch(e){}
  if(x) x.onclick=()=>{ n.style.display='none'; try{ localStorage.setItem('ae_nota_zonas','off'); }catch(e){} };
})();

/* Feed vivo: una píldora discreta sobre el mapa que rota la actividad reciente
   (reportes y entregas). Salta a lo nuevo en vivo; si no hay novedades, hace
   auto-play de lo que hay — siempre se ve movimiento, como plataforma activa. */
(function(){
  const wrap=document.getElementById('feed');
  if(!wrap) return;
  let items=[], idx=0, ultimoTop=0;
  const zN = z => (ZONAS.find(x=>x.id===z)||{}).n || '';
  function armar(){
    const reps=(S.reportes||[]).filter(r=>r.k&&r.ts).map(r=>({ts:r.ts,tipo:'rep',k:r.k,z:r.z,ref:r.ref}));
    const ents=(S.entregas||[]).filter(e=>e.k&&e.ts).map(e=>({ts:e.ts,tipo:'ent',k:e.k,z:e.z}));
    items=reps.concat(ents).sort((a,b)=>b.ts-a.ts).slice(0,25);
  }
  function texto(it){
    const need=NEED[it.k]?.n||it.k, donde=it.ref||zN(it.z);
    return it.tipo==='ent' ? `Llegó ${need}${donde?' a '+donde:''}`
                           : `${need}${donde?' en '+donde:''}`;
  }
  function lanzar(it){
    if(!it || !wrap.offsetParent) return;   // no gastar si el mapa no está a la vista
    const c=document.createElement('div'); c.className='feeditem';
    const d=document.createElement('span'); d.className='feed-dot';
    d.style.background = it.tipo==='ent' ? '#3f8f5f' : (UCOL[3]||'#dc2626');
    const t=document.createElement('span'); t.textContent=texto(it);
    c.appendChild(d); c.appendChild(t); wrap.appendChild(c);
    c.addEventListener('animationend',()=>c.remove());
    setTimeout(()=>{ if(c.parentNode) c.remove(); }, 5400);
  }
  window.feedRefrescar=function(){
    armar();
    if(items.length && items[0].ts>ultimoTop){ ultimoTop=items[0].ts; lanzar(items[0]); idx=0; }  // en vivo
  };
  // auto-play: sube una cada tanto para que siempre haya movimiento, sin apurar
  setInterval(()=>{ if(!items.length) return; idx=(idx+1)%items.length; lanzar(items[idx]); }, 6500);
  feedRefrescar();
})();

function render(){
  pintarMapa();
  if(typeof feedRefrescar==='function') feedRefrescar();   // feed vivo de actividad
  if(typeof window.sheetPintar==='function') window.sheetPintar();   // hoja inferior del mapa
  // acceso de usuario en el encabezado: con sesión, su avatar + punto verde
  // (en línea) y entra a su cuenta; sin sesión, un ícono para entrar.
  // Solo se re-pinta cuando cambia de verdad (entrar/salir/foto), no en cada
  // render: si no, el avatar parpadea y los botones del header "saltan".
  const ya = $('#yo-avatar');
  if(ya){
    const firma = YO ? ('yo|'+(YO.foto||'')+'|'+(YO.nombre||'')) : 'anon';
    if(ya.dataset.firma !== firma){
      ya.dataset.firma = firma;
      ya.hidden = false;
      ya.classList.toggle('on', !!YO);
      ya.setAttribute('aria-label', YO ? 'Mi cuenta' : 'Entrar como coordinador');
      ya.innerHTML = YO ? avatar({foto:YO.foto, nombre:YO.nombre})
                        : `<span class="avatar">${ico('user')}</span>`;
    }
  }
  const todos = ZONAS.map(estadoZona);

  // KPIs
  const conRep = todos.filter(s=>s.lista.length);
  const criticas = todos.filter(s=>s.idx>=60).length;
  const sinNada = todos.filter(s=>s.lista.length && !s.ultEnt).length;
  const personas = todos.reduce((a,s)=>a+s.pend.reduce((x,p)=>x+p.personas,0),0);
  const orf = huerfanos();
  // Un contador en cero no es información: se muestran solo los que dicen algo.
  // Una alerta accionable, no tres stat-cards decorativas: se lidera con lo más
  // grave y el resto queda como contexto en una línea.
  const persTxt = personas.toLocaleString('es-CO');
  let zAlert;
  if(criticas){
    zAlert = `<div class="zalert crit">${ico('alert')}<div class="grow">
      <b>${criticas} zona${criticas>1?'s':''} en estado crítico</b>, sin ayuda todavía.
      <div class="muted">${orf.length} punto${orf.length===1?'':'s'} sin coordinador · ${persTxt} personas sin cubrir</div></div></div>`;
  } else if(orf.length || personas){
    zAlert = `<div class="zalert warn">${ico('alert')}<div class="grow">
      <b>${orf.length} punto${orf.length===1?'':'s'} sin coordinador</b>
      <div class="muted">${persTxt} personas sin cubrir</div></div></div>`;
  } else {
    zAlert = `<div class="zalert ok">${ico('check')}<div class="grow"><b>Todo cubierto por ahora</b>: sin zonas críticas.</div></div>`;
  }
  $('#kpis').innerHTML = zAlert;
  $('#kpis').style.display = 'block';
  // ---- ENTRADA DE COORDINACIÓN: un solo bloque claro ----
  // Sin sesión, dos caminos claros (como la hoja del avatar): inscribirse o
  // entrar. Con sesión, su cuenta y un atajo para cubrir otro sector.
  const entrada = $('#coord-entrada');
  const sinCoord = todos.filter(s=>s.lista.length && !s.nCoord).map(s=>s.z.n);
  const promo = YO ? '' : `
    <button type="button" class="promo-coord" data-coord-intro>
      <span class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 4 6v6c0 5 3.4 8.7 8 9.5 4.6-.8 8-4.5 8-9.5V6l-8-3.5Z"/><path d="m9 12 2 2 4-4"/></svg></span>
      <span class="pt"><b>Quiero coordinar mi barrio</b>
        <small>${sinCoord.length ? esc(sinCoord.slice(0,2).join(' y '))+(sinCoord.length>2?` y ${sinCoord.length-2} más`:'')+' no tienen coordinador hoy' : 'Tu barrio te necesita'}</small></span>
      <span class="pa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></span>
    </button>`;
  if(entrada) entrada.innerHTML = promo + (YO
    ? `<div class="fila-mia ok">
         <div class="row">
           ${avatar({foto:YO.foto, nombre:YO.nombre})}
           <div class="grow">
             <div style="font-weight:700">${esc(YO.nombre)}</div>
             <div class="cnt">${esc(telBonito(YO.tel))} · ${(YO.zonas||[]).length} sector(es) a su cargo</div>
           </div>
           <button type="button" class="mini go" data-cuenta>Ver y corregir</button>
         </div>
       </div>
       <button type="button" class="btn" data-inscribir>${ico('plus')} Cubrir otro sector</button>`
    : `<button type="button" class="btn flat" data-cuenta style="margin-top:0">Ya me inscribí, quiero entrar</button>
       <p class="muted" style="margin:8px 2px 0;font-size:12.5px">El registro es con tu celular y un PIN — sin correo ni contraseñas largas.</p>`);

  // estadisticas de coordinacion (diseño app): tres numeros que orientan
  const stats=$('#coord-stats');
  if(stats) stats.innerHTML = `
    <div class="stat"><b style="color:#F87171">${S.reportes.length}</b><small>Reportes abiertos</small></div>
    <div class="stat"><b style="color:#FBBF24">${S.coords.filter(c=>!c.anulado).length}</b><small>Coordinadores</small></div>
    <div class="stat"><b style="color:#5FBE8A">${S.entregas.length}</b><small>Entregas</small></div>`;

  // necesidades mas pedidas en toda la ciudad, con barra relativa
  (function(){
    const w=$('#lista-pedidas'), bl=document.getElementById('b-pedidas');
    if(!w) return;
    const g={};
    S.reportes.forEach(r=>{ const e=g[r.k]=g[r.k]||{k:r.k,n:0,u:0}; e.n++; e.u=Math.max(e.u,r.u); });
    const top=Object.values(g).sort((a,b)=>b.n-a.n).slice(0,5);
    if(bl) bl.style.display = top.length ? '' : 'none';
    const max=top.length?top[0].n:1;
    w.innerHTML = top.map((x,i)=>`
      <div class="card zcard">
        <div class="row" style="align-items:flex-start">
          <div class="grow"><h3 class="trunc" style="margin:0;font-size:15px">${esc(NEED[x.k]?.n||x.k)}</h3>
            <div class="muted" style="font-size:12px;margin-top:2px">Prioridad ${x.u===3?'1':x.u===2?'2':'3'}</div></div>
          <span class="sbadge ${x.u===3?'b3':'b2'}">${x.n} pedido${x.n>1?'s':''}</span>
        </div>
        <div class="bar zbar"><span style="width:${Math.round(x.n/max*100)}%"></span></div>
      </div>`).join('');
  })();

  const secO=$('#sec-orf'), secS=$('#sec-solo');
  if(secO) secO.innerHTML = ico('alert')+' Puntos sin nadie a cargo';
  if(secS) secS.innerHTML = ico('user')+' Sectores con una sola persona';
  $('#lista-orf').innerHTML = orf.length ? orf.slice(0,12).map(f=>`
    <div class="foco orf" data-focopt="${f.lat},${f.lng}">
      <div class="row">
        <div class="fbadge" style="background:${UCOL[f.u]}">${f.n}</div>
        <div class="grow">
          <div style="font-size:14px;font-weight:600">${esc(f.ref||'Punto sin nombre')}</div>
          <div class="cnt">${esc(f.zona.n)}${f.zona.t==='corregimiento'?' (rural)':''} ·
            ${f.n} reporte${f.n>1?'s':''}${f.personas?` · ~${f.personas} personas`:''}</div>
        </div>
        <button type="button" class="mini go" data-coordpt="${f.lat},${f.lng}">Hacerme cargo</button>
      </div>
      <div>${f.needs.slice(0,4).map(x=>`<span class="chip ${x.u===3?'u3':x.u===2?'u2':''}">${esc(NEED[x.k]?.n||x.k)}${x.n>1?` ×${x.n}`:''}</span>`).join('')}</div>
    </div>`).join('') : (S.reportes.length
      ? '<p class="muted">Todos los puntos reportados tienen alguien a cargo.</p>'
      : vacio('Todavía nadie ha reportado',
              'Cuando alguien pida ayuda, aquí van a salir los sitios donde no hay quien responda.'));

  // lista: censo, albergues o zonas según el filtro
  if(filtro==='censo'){
    const cs = (S.censo||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
    $('#lista-zonas').innerHTML = cs.map((cn,i)=>{
      const ent = S.entregas.filter(y=>y.lat && dist(cn.lat,cn.lng,y.lat,y.lng)<300).sort((p,q)=>q.ts-p.ts)[0];
      const at = !!ent && (now()-ent.ts)<7*24*H;
      const chips = (cn.needs||[]).slice(0,6).map(k=>`<span class="chip">${esc(CENSO_NEED[k]||k)}</span>`).join('');
      return `<div class="card" data-censo="${i}" style="cursor:pointer">
        <div class="row"><div class="rank" style="background:${at?'#3f8f5f':'#7c3aed'};color:#fff">${ico(at?'check':'user')}</div>
          <div class="grow"><div class="row"><h3 class="grow trunc">${esc(cn.barrio||'Vivienda registrada')}</h3>
            <span class="muted">${at?'Atendido':'Pendiente'}</span></div>
            <div class="muted">${cn.personas?`${cn.personas} persona${cn.personas>1?'s':''} · `:''}censo</div></div></div>
        ${chips?`<div style="margin-top:8px">${chips}</div>`:''}</div>`;
    }).join('');
    const regBtn = `<a class="btn" href="/censo" style="display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 14px;text-decoration:none;background:#7c3aed;color:#fff">${ico('plus')} Registrar una vivienda</a>`;
    $('#lista-zonas').innerHTML = regBtn + ($('#lista-zonas').innerHTML || vacio('Sin censo todavía','Aún no hay viviendas registradas en el censo con ubicación.',''));
    document.querySelectorAll('#lista-zonas .card').forEach(c=>c.onclick=()=>abrirCenso(cs[+c.dataset.censo]));
    return;
  }
  if(filtro==='albergues'){
    const albs = S.coords.filter(c=>c.lat && (c.rol||'')==='Albergue');
    $('#lista-zonas').innerHTML = albs.map((a,i)=>{
      let f=null,bd=1e9; focos(a.z).forEach(x=>{const d=dist(a.lat,a.lng,x.lat,x.lng); if(d<bd){bd=d;f=x;}});
      const pend = (f && bd<300) ? f.needs.filter(x=>{ const e=S.entregas.filter(y=>y.k===x.k && y.lat && dist(a.lat,a.lng,y.lat,y.lng)<400).sort((p,q)=>q.ts-p.ts)[0]; return !(e && (now()-e.ts)<7*24*H); }) : [];
      const chips = pend.slice(0,6).map(x=>`<span class="chip ${x.u===3?'u3':x.u===2?'u2':''}">${esc(NEED[x.k]?.n||x.k)}</span>`).join('');
      const cap = (a.cap!=null) ? `${a.ocup!=null?a.ocup+'/':''}${a.cap} pers.` : '';
      return `<div class="card" data-alb="${i}" style="cursor:pointer">
        <div class="row"><div class="rank" style="background:#F2B705;color:#3a1500">${ico('tent')}</div>
          <div class="grow"><div class="row"><h3 class="grow trunc">${esc(a.micro||a.nom)}</h3>
            <span class="muted">${a.ver?'Verificado':''}</span></div>
            <div class="muted">Albergue${cap?` · ${cap}`:''}${pend.length?` · ${pend.length} necesidad${pend.length>1?'es':''}`:''}</div></div></div>
        ${chips?`<div style="margin-top:8px">${chips}</div>`:''}</div>`;
    }).join('') || vacio('Sin albergues','No hay albergues registrados todavía.','');
    document.querySelectorAll('#lista-zonas .card').forEach(c=>c.onclick=()=>abrirAlbergue(albs[+c.dataset.alb]));
    return;
  }
  let lz = todos.filter(s=>s.lista.length).sort((a,b)=>b.idx-a.idx);
  if(filtro==='comuna') lz=lz.filter(s=>s.z.t==='comuna');
  if(filtro==='corregimiento') lz=lz.filter(s=>s.z.t==='corregimiento');
  if(filtro==='municipio') lz=lz.filter(s=>s.z.t==='municipio');
  if(filtro==='critica') lz=lz.filter(s=>s.idx>=60);
  $('#lista-zonas').innerHTML = lz.map((s,i)=>{
    // lenguaje humano: badge con palabra, barra de % atendido y personas
    const at = Math.max(0, 100 - s.idx);
    const [lbl, cls] = s.idx>=80 ? ['Olvidada','b3'] : s.idx>=60 ? ['Crítica','b3']
                     : s.idx>=40 ? ['Rezagada','b2'] : s.idx>=20 ? ['Parcial','b2'] : ['Atendida','bok'];
    const pers = s.pend.reduce((a,p)=>a+(p.personas||0),0);
    const frase = [
      s.z.t==='corregimiento'?'Rural':s.z.t==='municipio'?'Municipio vecino':null,
      s.ultEnt ? `última ayuda ${hace(s.ultEnt)}` : 'nunca ha llegado ayuda',
      s.nCoord ? `${s.nCoord} coordinador${s.nCoord===1?'':'es'}` : 'sin coordinador',
    ].filter(Boolean).join(' · ');
    return `
    <div class="card zcard" data-zona="${s.z.id}" style="cursor:pointer">
      <div class="row" style="align-items:flex-start">
        <div class="grow">
          <h3 class="trunc" style="margin:0">${esc(s.z.n)}</h3>
          <div class="muted" style="font-size:12.5px;margin-top:3px">${frase}</div>
        </div>
        <span class="sbadge ${cls}">${lbl}</span>
      </div>
      <div class="bar zbar"><span style="width:${at}%"></span></div>
      <div class="zfoot"><span>${at} % atendido</span><span>${pers?`${pers.toLocaleString('es-CO')} personas`:''}</span></div>
      <div>${s.pend.slice(0,5).map(p=>`<span class="chip ${p.u===3?'u3':p.u===2?'u2':''}">${esc(NEED[p.k]?.n||p.k)}${p.corrob>1?` ×${p.corrob}`:''}${p.subio?' ↑':''}</span>`).join('')}
      ${s.pend.length>5?`<span class="chip">+${s.pend.length-5} más</span>`:''}</div>
    </div>`;
  }).join('') || vacio('El mapa está limpio',
       S.reportes.length ? 'Ninguna zona coincide con este filtro.'
       : 'Nadie ha reportado necesidades todavía. Si usted sabe de un sitio que necesita ayuda, tóquelo en el mapa y repórtelo.',
       'Reportar una necesidad');
  document.querySelectorAll('#lista-zonas .card').forEach(c=>c.onclick=()=>abrirZona(c.dataset.zona));

  // sectores con una sola persona
  const sol = solitarios();
  const htmlSolo = !sol.length ? '' : sol.slice(0,10).map(f=>`
    <div class="foco" data-focopt="${f.lat},${f.lng}" style="border-color:#7c4a10;background:rgba(217,119,6,.07)">
      <div class="row">
        <div class="fbadge" style="background:${UCOL[f.u]}">${f.n}</div>
        <div class="grow">
          <div style="font-size:14px;font-weight:600">${esc(f.ref||'Punto sin nombre')}</div>
          <div class="cnt">${esc(f.zona.n)} · solo <b>${esc(f.solo.nom)}</b> a cargo</div>
        </div>
        <button type="button" class="mini go" data-coordpt="${f.lat},${f.lng}">Sumarme</button>
      </div>
    </div>`).join('');
  seccion('sec-solo','lista-solo', ico('user')+' Sectores con una sola persona', htmlSolo, true);

  // reparto de la carga entre personas
  const pers = porPersona();
  const htmlPers = !pers.length ? '' : pers.map(p=>`
    <div class="need-line">
      ${avatar(p)}
      <div class="grow">
        <div style="font-size:14px">${esc(p.nom)}
          ${p.ver?'<span class="verif">verificado</span>':'<span class="pend">sin verificar</span>'}
          ${p.exceso?'<span class="pend">carga alta</span>':''}</div>
        <div class="cnt">${p.n} micro-zona${p.n>1?'s':''} · ${p.entregas} entrega${p.entregas===1?'':'s'} registrada${p.entregas===1?'':'s'}
          · ${p.zonas.map(c=>esc(c.micro||ZONAS.find(z=>z.id===c.z)?.n||'')).join(', ')}</div>
      </div>
      <div class="bar" style="width:52px;margin:0;flex:0 0 auto"><span
        style="width:${Math.min(100, p.n/Math.max(1,pers[0].n)*100)}%;background:${p.exceso?'#d97706':'#4f9cf9'}"></span></div>
    </div>`).join('');
  $('#lista-personas').innerHTML = htmlPers;
  // cada bloque se oculta entero cuando no tiene nada que mostrar
  const verBloque = (id, hay)=>{ const el=document.getElementById(id); if(el) el.style.display = hay ? '' : 'none'; };
  verBloque('b-solo', !!htmlSolo);
  verBloque('b-personas', !!htmlPers);
  verBloque('b-coord', !!htmlPers);
  verBloque('b-salud', !!htmlSolo || !!htmlPers);   // el plegable entero, si no hay nada

  // coordinadores
  const byZone = {};
  S.coords.forEach(c=>(byZone[c.z]=byZone[c.z]||[]).push(c));
  $('#lista-coord').innerHTML = Object.keys(byZone).map(z=>{
    const zn = ZONAS.find(x=>x.id===z)?.n||z;
    return `<div class="card"><h3>${esc(zn)}</h3>${byZone[z].map(c=>`
      <div class="need-line">
        ${avatar(c)}
        <div class="grow">
          <div style="font-size:14px">${esc(c.nom)} ${c.ver?'<span class="verif">verificado</span>':'<span class="pend">sin verificar</span>'}</div>
          <div class="cnt">${esc(c.micro||'sin micro-zona')} · ${c.radio||500} m · ${esc(c.rol)}${c.nota?' · '+esc(c.nota):''}</div>
        </div>
        <a class="mini" href="${waLink(c.tel)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>`).join('')}</div>`;
  }).join('') || '';

}

/* ---------- soporte de la app por WhatsApp ---------- */
const TIPOS_SOPORTE = [
  'No me deja reportar una necesidad',
  'El mapa no carga o no encuentro mi sitio',
  'No puedo entrar a mi cuenta o se me olvidó el PIN',
  'Un dato está mal o es falso',
  'Sugerencia para mejorar la app',
  'Otro problema',
];
function abrirSoporte(){
  abrirSheet(`
    <div class="zhead">
      <div class="row">
        <div class="rank" style="background:#233149;color:#8ec1ff">${ico('help')}</div>
        <div class="grow">
          <h3 style="margin:0">Soporte de Aquí&nbsp;Estamos</h3>
          <div class="muted">Escríbanos por WhatsApp y lo revisamos.</div>
        </div>
      </div>
    </div>
    <div class="sec">¿Qué pasó?</div>
    <div class="opts" id="s-tipos">
      ${TIPOS_SOPORTE.map((t,i)=>`<button type="button" class="opt ${i===0?'sel':''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <label class="f">Cuéntenos con sus palabras (opcional)</label>
    <textarea id="s-txt" placeholder="Ej: toco el botón de enviar y no pasa nada"></textarea>
    <a class="btn wa" id="s-send" target="_blank" rel="noopener" href="#">
      ${icoWA()} Abrir WhatsApp y enviar</a>
    <p class="muted" style="margin-top:10px">Se abre WhatsApp con el mensaje ya escrito.
      Solo tiene que darle enviar.</p>
    <button class="cerrar-txt" data-close-btn>Cerrar</button>
  `);
  let tipo = TIPOS_SOPORTE[0];
  const armar = ()=>{
    const extra = $('#s-txt').value.trim();
    const ctx = `\n\n---\nZona del pin: ${mainPt ? (ZONAS.find(z=>z.id===mainPt.z)?.n || '-') : '-'}`;
    $('#s-send').href = waLink(SOPORTE_WA,
      `Aquí Estamos · reporte de la app\nTipo: ${tipo}` + (extra ? `\nDetalle: ${extra}` : '') + ctx);
  };
  $('#s-tipos').onclick = e=>{
    const b = e.target.closest('.opt'); if(!b) return;
    $('#sheet-body').querySelectorAll('#s-tipos .opt').forEach(x=>x.classList.toggle('sel', x===b));
    tipo = b.dataset.t; armar();
  };
  $('#s-txt').oninput = armar;
  armar();
}
$('#btn-soporte').onclick = abrirSoporte;
$('#btn-soporte .fic').innerHTML = ico('help');

/* Compartir la app: usa el menú nativo del celular (WhatsApp, mensajes,
   Telegram…). Si el navegador no lo tiene, cae directo a WhatsApp. */
const bShare = document.getElementById('btn-share');
if(bShare) bShare.onclick = async ()=>{
  const datos = {
    title: 'Aquí Estamos',
    text: 'Aquí Estamos · mapa abierto para la emergencia. Reporte lo que hace falta y vea dónde no ha llegado ayuda:',
    url: 'https://aquiestamos.co',
  };
  try{
    if(navigator.share){ await navigator.share(datos); }
    else {
      window.open('https://wa.me/?text=' + encodeURIComponent(datos.text + ' ' + datos.url), '_blank', 'noopener');
      toast('Se abrió WhatsApp para compartir.');
    }
  }catch(e){ /* si la persona cancela el compartir, no pasa nada */ }
};

/* Día/noche: el botón alterna el tema y lo recuerda. Si nadie elige, sigue al
   sistema. Muestra el ícono de a qué cambia (luna = pasar a noche). */
const SVG_SOL  = '<svg class="ic lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const SVG_LUNA = '<svg class="ic lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
function pintarTema(){
  const eff = window.temaEfectivo ? window.temaEfectivo() : 'dark';
  document.documentElement.setAttribute('data-eff', eff);
  const b = document.getElementById('btn-tema');
  if(b) b.innerHTML = eff==='light' ? SVG_LUNA : SVG_SOL;
}
const bTema = document.getElementById('btn-tema');
if(bTema) bTema.onclick = ()=>{
  const eff = window.temaEfectivo ? window.temaEfectivo() : 'dark';
  try{ localStorage.setItem('ae_tema', eff==='light' ? 'oscuro' : 'claro'); }catch(e){}
  pintarTema();
  if(map) map.invalidateSize();
  render();
};
pintarTema();

/* ---------- hoja inferior del mapa: arrastre + reportes cercanos ----------
   Colapsada muestra zona + acciones; arrastrando el asa (o tocándola) sube y
   deja ver los reportes recientes. Sin librerías: transform + un translateY. */
(function(){
  const sheet=document.getElementById('msheet'), handle=document.getElementById('msheet-handle');
  if(!sheet||!handle) return;
  let collapsed=0, current=0, dragging=false, startY=0, startVal=0;
  function setY(v){ current=v; sheet.style.setProperty('--sheet-y', v+'px');
    sheet.classList.toggle('open', v < collapsed/2); }
  function medir(){
    const acts=sheet.querySelector('.actions'); if(!acts) return;
    const colH=acts.offsetTop+acts.offsetHeight+14;
    collapsed=Math.max(0, sheet.offsetHeight-colH);
    setY(sheet.classList.contains('open')?0:collapsed);
  }
  function down(e){ dragging=true; sheet.classList.add('dragging');
    startY=(e.touches?e.touches[0].clientY:e.clientY); startVal=current; }
  function move(e){ if(!dragging) return;
    const y=(e.touches?e.touches[0].clientY:e.clientY);
    setY(Math.max(-16, Math.min(collapsed+24, startVal+(y-startY))));
    e.preventDefault(); }
  function up(){ if(!dragging) return; dragging=false; sheet.classList.remove('dragging');
    setY(current<collapsed/2?0:collapsed); }
  handle.addEventListener('mousedown',down);
  handle.addEventListener('touchstart',down,{passive:true});
  window.addEventListener('mousemove',move);
  window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('mouseup',up);
  window.addEventListener('touchend',up);
  handle.addEventListener('click',()=>setY(current<collapsed/2?collapsed:0));
  // al rotar o cambiar de tamaño, medir cuando el layout ya esté quieto
  let mT; window.addEventListener('resize',()=>{ clearTimeout(mT); mT=setTimeout(medir,180); });
  window.sheetMedir=medir;
  window.addEventListener('load',()=>setTimeout(medir,120));
  setTimeout(medir,300);
})();
/* Reportes cercanos dentro de la hoja: primero los de la zona del pin,
   luego el resto, siempre lo más nuevo arriba. Datos anónimos que ya son
   públicos en el mapa — aquí solo se leen más fácil. */
/* Chip de zona = dropdown: lista las zonas ordenadas por cercania al pin.
   Elegir una mueve el mapa y el pin al centro de esa zona. */
(function(){
  const chip=document.getElementById('pinbar'), menu=document.getElementById('zmenu');
  if(!chip||!menu) return;
  function pintar(){
    const o=(typeof mainPt!=='undefined'&&mainPt)?mainPt:{lat:4.8133,lng:-75.6961};
    const zs=ZONAS.map(z=>({z, d:dist(o.lat,o.lng,z.lat,z.lng)})).sort((a,b)=>a.d-b.d);
    menu.innerHTML = zs.map(x=>`<button type="button" data-z="${x.z.id}">
      ${x.z.n}${x.z.t==='corregimiento'?' <span class="muted">(rural)</span>':''}
      <span class="muted">${x.d<1000?Math.round(x.d)+' m':(x.d/1000).toFixed(1)+' km'}</span></button>`).join('');
  }
  chip.addEventListener('click', ()=>{ if(menu.hidden){ pintar(); menu.hidden=false; } else menu.hidden=true; });
  document.addEventListener('click', e=>{
    if(!menu.hidden && !e.target.closest('#zmenu') && !e.target.closest('#pinbar')) menu.hidden=true;
  });
  menu.addEventListener('click', e=>{
    const b=e.target.closest('[data-z]'); if(!b) return;
    const z=ZONAS.find(x=>x.id===b.dataset.z); if(!z) return;
    menu.hidden=true;
    if(map && !modoSVG){ map.flyTo([z.lat,z.lng], 14.6, {duration:.7}); }
    if(typeof setMainPt==='function') setMainPt(z.lat, z.lng);
    toast('Zona: '+z.n);
  });
})();
(function(){ const v=document.getElementById('ver-todos');
  if(v) v.onclick=e=>{ e.preventDefault(); document.querySelector('nav button[data-v="zonas"]').click(); };
})();
window.sheetPintar=function(){
  const lista=document.getElementById('msheet-list'); if(!lista) return;
  const reps=(S.reportes||[]).slice().sort((a,b)=>{
    const za=(typeof mainPt!=='undefined'&&mainPt)?mainPt.z:null;
    if(za && a.z!==b.z){ if(a.z===za) return -1; if(b.z===za) return 1; }
    return b.ts-a.ts;
  });
  const chip=document.getElementById('msheet-count'), n=document.getElementById('msheet-count-n');
  if(n) n.textContent=reps.length;
  if(chip) chip.hidden=!reps.length;
  const zN=z=>(ZONAS.find(x=>x.id===z)||{}).n||'';
  const hace=ts=>{const m=Math.max(1,Math.round((Date.now()-ts)/60000));
    return m<60?`hace ${m} m`:(m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`)};
  lista.innerHTML = reps.slice(0,8).map(r=>{
    const col=UCOL[r.u]||'#d97706';
    const zn = zN(r.z);
    const lugar = (r.ref && r.ref.trim().toLowerCase()!==zn.toLowerCase()) ? `${esc(r.ref)} · ${esc(zn)}` : esc(zn);
    // data-focopt: al tocar abre el detalle del punto; al cerrarlo se vuelve aquí
    const badge = r.u===3?'<span class="sbadge b3">Crítico</span>':r.u===2?'<span class="sbadge b2">Medio</span>':'<span class="sbadge b1">Bajo</span>';
    return `<div class="scard toca" data-focopt="${r.lat},${r.lng}">
      <div class="sic" style="background:${col}">${ico('alert')}</div>
      <div class="stx"><h4>${esc(NEED[r.k]?.n||r.k)}${r.personas?` · ${r.personas} personas`:''}</h4>
      <p>${lugar}${r.nota?` · ${esc(r.nota)}`:''}</p></div>
      <div class="smeta">${badge}<br>${hace(r.ts)}</div></div>`;
  }).join('') || `<p class="muted" style="font-size:13px;margin:4px 2px">Sin reportes por ahora. Si necesita algo, use el botón rojo.</p>`;
};

/* ---------- acciones globales ---------- */
$('#fab-need').onclick = ()=>{
  const pt = mainPt || ptDe('centro');
  abrirReporte(pt.z, pt);
};
$('#fab-loc').onclick = ()=>{
  if(!navigator.geolocation) return toast('Este dispositivo no da ubicación');
  toast('Buscando su ubicación...');
  navigator.geolocation.getCurrentPosition(p=>{
    const {latitude:la, longitude:lo} = p.coords;
    if(map){ map.setView([la,lo], 16); setMainPt(la,lo); toast('Pin puesto donde está'); }
    else abrirReporte(zonaDe(la,lo).id);
  }, ()=>toast('No se pudo obtener la ubicación'), {enableHighAccuracy:true, timeout:9000});
};

/* Ver ejemplo: para mostrarle la app a alguien sin ensuciar el mapa real.
   Ya no es un botón — al vecino que necesita agua no le sirve de nada y solo
   estorba. Se enciende abriendo la app con ?ejemplo=1 al final de la
   dirección. Los datos viven solo en este teléfono y no se envían a nadie.
   Exportar se fue a admin.html, que es donde se piden cifras.            */
function pintarBotonEjemplo(){
  if(!MODO_EJEMPLO) return;
  if(document.getElementById('aviso-ejemplo')) return;
  const av = document.createElement('div');
  av.id = 'aviso-ejemplo'; av.className = 'avisoej';
  av.innerHTML = ico('alert') + ' <b>Ejemplo</b> · nada de lo que ve aquí es real y nada se envía';
  document.getElementById('app').prepend(av);
}
if(/[?&]ejemplo=1/.test(location.search)){
  MODO_EJEMPLO = true;
  demo();
}

initMainPin();
render();
iniciarDatos().then(async ok=>{
  pintarBotonEjemplo();
  if(ok){ await yoCargar(); render(); }   // si ya entró antes, vuelve a entrar solo
  if(!ok){ const e=document.getElementById('estado');
    if(e){ e.className='estado demo'; e.textContent='Sin conexión · modo demostración'; } }
});
setTimeout(()=>{ if(map) map.invalidateSize(); }, 300);

/* Que el mapa se reajuste al cambiar el tamaño de la ventana o girar el
   teléfono — si no, quedan franjas grises o el mapa desalineado. */
let _rz;
function reajustar(){ clearTimeout(_rz); _rz = setTimeout(()=>{ if(map) map.invalidateSize(); }, 150); }
window.addEventListener('resize', reajustar);
window.addEventListener('orientationchange', reajustar);

/* Si el sistema cambia de día a noche (o al revés), recolorear el mapa y la
   escala, que salen del tema. */
try{ matchMedia('(prefers-color-scheme: light)').addEventListener('change',
  ()=>setTimeout(()=>{ if(typeof pintarTema==='function') pintarTema();
    if(typeof render==='function') render(); }, 60)); }catch(e){}
