/* ============================================================
   7. EVENTOS Y VISTAS
   ============================================================ */
/* ---------- delegación de eventos en la hoja ---------- */
$('#sheet-body').addEventListener('click', e=>{
  const g=e.target.closest('[data-gps]');
  if(g) return pickerGPS(g.dataset.gps);
  const t=e.target.closest('[data-new],[data-deliv],[data-coord],[data-ent],[data-close-btn]');
  if(!t) return;
  if(t.hasAttribute('data-close-btn')) return cerrarSheet();
  if(t.dataset.new) return abrirReporte(t.dataset.new);
  if(t.dataset.deliv) return abrirEntrega(t.dataset.deliv);
  if(t.dataset.coord) return abrirCoord(t.dataset.coord);
  if(t.dataset.ent) return abrirEntrega(t.dataset.z, t.dataset.ent);
});

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

/* Entrar / ver mi cuenta desde cualquier parte */
document.addEventListener('click', e=>{
  if(e.target.closest('[data-cuenta]')) abrirCuenta();
});

/* ---------- vistas ---------- */
let filtro='todas';
document.querySelectorAll('#filtros button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#filtros button').forEach(x=>x.classList.toggle('on',x===b));
  filtro=b.dataset.f; render();
});

function render(){
  pintarMapa();
  const todos = ZONAS.map(estadoZona);

  // KPIs
  const conRep = todos.filter(s=>s.lista.length);
  const criticas = todos.filter(s=>s.idx>=60).length;
  const sinNada = todos.filter(s=>s.lista.length && !s.ultEnt).length;
  const personas = todos.reduce((a,s)=>a+s.pend.reduce((x,p)=>x+p.personas,0),0);
  const orf = huerfanos();
  $('#kpis').innerHTML = `
    <div class="kpi"><b style="color:#dc2626">${criticas}</b><span>zonas críticas</span></div>
    <div class="kpi"><b style="color:#8b1a1a">${orf.length}</b><span>puntos sin coordinador</span></div>
    <div class="kpi"><b>${personas.toLocaleString('es-CO')}</b><span>personas sin cubrir</span></div>`;
  // ---- MI CUENTA: que nadie pierda su registro ----
  // El registro no depende del navegador: vive en la cuenta (celular + PIN).
  // Por eso desde cualquier teléfono se recupera con solo entrar.
  seccion('sec-mias','lista-mias', ico('user') + (YO ? ' Mi cuenta' : ' Su registro'),
    YO
      ? `<div class="fila-mia ok">
           <div class="row">
             ${avatar({foto:YO.foto, nombre:YO.nombre})}
             <div class="grow">
               <div style="font-weight:700">${esc(YO.nombre)}</div>
               <div class="cnt">${esc(telBonito(YO.tel))} ·
                 ${(YO.zonas||[]).length} sector(es) a su cargo</div>
             </div>
           </div>
           <div class="fbtns">
             <button type="button" class="mini go" data-cuenta>Ver y corregir lo mío</button>
           </div>
         </div>`
      : `<div class="fila-mia">
           <div class="cnt">Si ya se inscribió antes, entre con su celular y su PIN y
             recupera todo, así sea desde otro teléfono.</div>
           <div class="fbtns">
             <button type="button" class="mini go" data-cuenta>Entrar a mi cuenta</button>
           </div>
         </div>`);

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
        <span class="lnk" data-coordpt="${f.lat},${f.lng}">Hacerme cargo</span>
      </div>
      <div>${f.needs.slice(0,4).map(x=>`<span class="chip ${x.u===3?'u3':x.u===2?'u2':''}">${esc(NEED[x.k]?.n||x.k)}${x.n>1?` ×${x.n}`:''}</span>`).join('')}</div>
    </div>`).join('') : (S.reportes.length
      ? '<p class="muted">Todos los puntos reportados tienen alguien a cargo.</p>'
      : vacio('Todavía nadie ha reportado',
              'Cuando alguien pida ayuda, aquí van a salir los sitios donde no hay quien responda.'));

  // lista de zonas
  let lz = todos.filter(s=>s.lista.length).sort((a,b)=>b.idx-a.idx);
  if(filtro==='comuna') lz=lz.filter(s=>s.z.t==='comuna');
  if(filtro==='corregimiento') lz=lz.filter(s=>s.z.t==='corregimiento');
  if(filtro==='critica') lz=lz.filter(s=>s.idx>=60);
  $('#lista-zonas').innerHTML = lz.map((s,i)=>`
    <div class="card" data-zona="${s.z.id}" style="cursor:pointer">
      <div class="row">
        <div class="rank" style="background:${color(s.idx)};color:#fff">${s.idx}</div>
        <div class="grow">
          <div class="row"><h3 class="grow trunc">${esc(s.z.n)}</h3>
            <span class="muted">${etiqueta(s.idx)}</span></div>
          <div class="muted">${s.z.t==='corregimiento'?'Rural · ':''}${s.ultEnt?`última ayuda ${hace(s.ultEnt)}`:'nunca ha llegado ayuda'} ·
            ${s.nCoord} coordinador${s.nCoord===1?'':'es'}</div>
        </div>
      </div>
      <div class="bar"><span style="width:${s.idx}%;background:${color(s.idx)}"></span></div>
      <div>${s.pend.slice(0,5).map(p=>`<span class="chip ${p.u===3?'u3':p.u===2?'u2':''}">${esc(NEED[p.k]?.n||p.k)}${p.corrob>1?` ×${p.corrob}`:''}${p.subio?' ↑':''}</span>`).join('')}
      ${s.pend.length>5?`<span class="chip">+${s.pend.length-5} más</span>`:''}</div>
    </div>`).join('') || vacio('El mapa está limpio',
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
        <span class="lnk" data-coordpt="${f.lat},${f.lng}">Sumarme</span>
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
  document.querySelectorAll('.sec').forEach(el=>{
    if(el.textContent.trim()==='Reparto de la coordinación'){
      el.style.display = htmlPers ? '' : 'none';
      const p = el.nextElementSibling; if(p && p.tagName==='P') p.style.display = htmlPers ? '' : 'none';
    }
    if(el.textContent.trim()==='Coordinadores por zona') el.style.display = htmlPers ? '' : 'none';
    if(el.textContent.trim()==='Últimas entregas registradas')
      el.style.display = S.entregas.length ? '' : 'none';
  });

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

  // entregas
  $('#lista-entregas').innerHTML = S.entregas.slice().sort((a,b)=>b.ts-a.ts).slice(0,15).map(e=>`
    <div class="need-line">
      <span class="dot" style="background:#3f8f5f"></span>
      <div class="grow"><div style="font-size:13px">${esc(NEED[e.k]?.n||e.k)} → ${esc(ZONAS.find(z=>z.id===e.z)?.n||e.z)}</div>
      <div class="cnt">${esc(e.quien)}${e.cant?' · '+esc(e.cant):''} · ${hace(e.ts)}</div></div>
    </div>`).join('');
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
    <button class="btn flat" data-close-btn>Cerrar</button>
  `);
  let tipo = TIPOS_SOPORTE[0];
  const armar = ()=>{
    const extra = $('#s-txt').value.trim();
    const ctx = `\n\n---\nZona del pin: ${mainPt ? (ZONAS.find(z=>z.id===mainPt.z)?.n || '-') : '-'}`;
    $('#s-send').href = waLink(SOPORTE_WA,
      `Aquí Estamos — reporte de la app\nTipo: ${tipo}` + (extra ? `\nDetalle: ${extra}` : '') + ctx);
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
    text: 'Aquí Estamos — mapa abierto para la emergencia. Reporte lo que hace falta y vea dónde no ha llegado ayuda:',
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
$('#btn-add-coord').onclick = ()=>{ const pt = mainPt || ptDe('centro'); abrirCoord(pt.z, pt); };

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
