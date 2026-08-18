/* ============================================================
   Página para donantes — bilingüe. Catálogo (código) + centros de
   acopio (Supabase). Vista rápida "Fácil de conseguir", categorías
   colapsables, y "Mi lista" (marcar y copiar como texto o imagen).
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const store = (k,v)=>{ try{ v===undefined?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(e){} };
const load  = k =>{ try{ return localStorage.getItem(k);}catch(e){ return null; } };

let LANG = load('ae_lang');
if(LANG!=='en' && LANG!=='es') LANG = (navigator.language||'').toLowerCase().startsWith('en') ? 'en' : 'es';
const t = o => (o && (o[LANG]||o.es)) || '';
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

let MODE = load('ae_donar_modo')==='facil' ? 'facil' : 'todo';
let OPEN = new Set((load('ae_donar_open')||'').split(',').filter(Boolean));
if(!load('ae_donar_open')) OPEN = new Set([DONAR_CAT[0].key]);   // primera abierta al inicio
let SEL  = new Set((load('ae_donar_sel')||'').split('\n').filter(Boolean));

const itemKey = (ck,it)=> ck+'|'+it.es;
const ITEMX = {};                                   // key -> {ck, es, en, catEs, catEn}
DONAR_CAT.forEach(c=>c.items.forEach(it=>ITEMX[itemKey(c.key,it)]={ck:c.key,es:it.es,en:it.en,catEs:c.es,catEn:c.en}));
const CATNOM = {}; DONAR_CAT.forEach(c=>CATNOM[c.key]={es:c.es,en:c.en});
const CMK = ['#0ea5e9','#e11d48','#7c3aed','#d97706','#0d9488','#2563eb'];   // color de marcador por centro

/* ---- íconos ---- */
function dico(k){ return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DICONS[k]||''}</svg>`; }
function chev(){ return '<svg class="ic chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'; }
function tick(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'; }
function waIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4 4.1-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.4.8.8-2.4-.2-.3A8 8 0 0 1 12 4zm-2.7 3.6c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.2s.9 2.5 1 2.7c.2.2 1.8 2.9 4.5 3.9 2.2.8 2.7.7 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.5.1-.7-.3-1.4-.6-2.1-1.4-.5-.6-.9-1.3-1-1.5-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4z"/></svg>'; }
function pinIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'; }
function locIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>'; }
function boxIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>'; }
/* logo de Amazon (la "sonrisa"/flecha a→z) */
function amzIcon(){ return '<svg class="ic amzlogo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 11c3.3 3 7.6 4.5 11.5 4.5 3.2 0 6.3-.9 9-2.7"/><path d="M18.6 14.6c1.8-1.1 3.7-1.3 4-.9.4.4-.2 2.5-1.4 3.6"/></svg>'; }
function heartIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.7 8.9 2 5.5 5.2 5c1.9-.3 3.7.7 4.8 2.2C11.1 5.7 12.9 4.7 14.8 5 18 5.5 19.3 8.9 22 11.7 19.5 16.4 12 21 12 21z"/></svg>'; }
function arrowRight(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; }
function xIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/></svg>'; }

/* teléfono internacional */
function telDig(v){ return String(v||'').replace(/[^0-9]/g,''); }
function waHref(v){ const d=telDig(v); return d?('https://wa.me/'+d):'#'; }
/* la lista de Amazon siempre abre ordenada por prioridad (alta primero) */
function amazonSort(u){ if(!u) return u; if(/[?&]sort=/.test(u)) return u; return u + (u.includes('?')?'&':'?') + 'sort=priority'; }
function telFmt(v){ const d=telDig(v); if(!d) return '';
  if(d.length===11 && d[0]==='1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if(d.startsWith('57') && d.length===12) return `+57 ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`;
  return '+'+d;
}

/* ---- selector de modo ---- */
/* ---- pestañas del hub: Amazon / En persona ---- */
let DTAB = (function(){ try{ return localStorage.getItem('ae_donar_tab')||'amazon'; }catch(e){ return 'amazon'; } })();
function renderTabs(){
  $('#d-tabs').innerHTML = `
    <button data-t="amazon" aria-selected="${DTAB==='amazon'}">${amzIcon()}<span>${esc(t(DONAR_UI.tab_amazon))}</span></button>
    <button data-t="persona" aria-selected="${DTAB==='persona'}">${pinIcon()}<span>${esc(t(DONAR_UI.tab_persona))}</span></button>`;
}
function renderGuia(){
  $('#d-guia').innerHTML = `
    <p class="dhint">${arrowRight()} <b>${esc(t(DONAR_UI.guia_hint))}</b></p>
    <div class="sec">${esc(t(DONAR_UI.guia_t))}</div>
    <ol class="dhow">
      <li>${t(DONAR_UI.paso1)}</li><li>${t(DONAR_UI.paso2)}</li>
      <li>${t(DONAR_UI.paso3)}</li><li>${t(DONAR_UI.paso4)}</li>
    </ol>
    <button type="button" class="damz-big" id="d-guia-amz">${amzIcon()} ${esc(t(DONAR_UI.abrir_lista))}</button>`;
  const b=$('#d-guia-amz'); if(b) b.onclick=()=>irAmazon();
}
function aplicarTab(){
  const amz = DTAB==='amazon';
  const show=(id,v)=>{ const e=$(id); if(e) e.hidden=!v; };
  show('#d-guia', amz); show('#d-modo', amz); show('#d-cats', amz); show('#d-busca-wrap', amz); show('#d-catlab', amz);
  show('#d-ubicame', !amz); show('#d-centros-h', !amz); show('#d-centros', !amz);
  const sub=$('#d-centros-sub'); if(sub) sub.hidden=amz;
}
function setTab(x){ DTAB=x; try{ localStorage.setItem('ae_donar_tab',x); }catch(e){}
  renderTabs(); aplicarTab(); }

function renderModo(){
  $('#d-modo').innerHTML =
    `<div class="dseg" role="group">
       <button data-m="todo"  class="${MODE==='todo'?'on':''}">${esc(t(DONAR_UI.modo_todo))}</button>
       <button data-m="facil" class="${MODE==='facil'?'on':''}">${esc(t(DONAR_UI.modo_facil))}</button>
     </div>` +
    (MODE==='facil' ? `<p class="dmodo-sub">${esc(t(DONAR_UI.facil_sub))}</p>` : '');
}

/* ---- categorías (colapsables + seleccionables) ---- */
const DCAT_GRAD = {medico:'linear-gradient(155deg,#F87171,#DC2626)', medicamentos:'linear-gradient(155deg,#FBBF24,#F59E0B)',
  higiene:'linear-gradient(155deg,#60A5FA,#2563EB)', herramientas:'linear-gradient(155deg,#34D399,#059669)',
  emergencia:'linear-gradient(155deg,#A78BFA,#6D28D9)'};
function renderCats(q){
  const nqn = norm((q||'').trim());
  const searching = !!nqn;
  let html='';
  DONAR_CAT.forEach(c=>{
    let its = c.items;
    if(searching) its = its.filter(i=> norm(i.es+' '+i.en).includes(nqn));
    else if(MODE==='facil') its = its.filter(i=> i.r);
    if(!its.length) return;
    const open = searching || MODE==='facil' || OPEN.has(c.key);
    const rows = its.map(i=>{
      const k = itemKey(c.key,i), on = SEL.has(k);
      return `<button class="ditem${on?' on':''}" data-k="${esc(k)}" aria-pressed="${on}">
        <span class="dchk">${tick()}</span><span class="dtxt">${esc(t(i))}</span></button>`;
    }).join('');
    html += `<section class="dcat dcat--${c.key}${open?' open':''}">
      <button class="dcat-h" data-cat="${c.key}" aria-expanded="${open}">
        <span class="dcat-ic" style="background:${DCAT_GRAD[c.key]||'var(--chip)'};color:#fff">${dico(c.key)}</span>
        <span class="dcat-t">${esc(t(c))}${c.sub?`<small>${esc(t(c.sub))}</small>`:''}</span>
        <span class="dcat-n">${its.length}</span>${chev()}
      </button>
      <div class="dgrid">${rows}
        <button type="button" class="amzcat" data-amzcat>${amzIcon()} ${esc(t(DONAR_UI.abrir_lista))}</button>
      </div>
    </section>`;
  });
  $('#d-cats').innerHTML = html || `<p class="muted dnores">${esc(t(DONAR_UI.sinres))}</p>`;
}

/* ---- NO recibimos ---- */
function renderNo(){
  $('#d-no').innerHTML = `<div class="sec">${esc(t(DONAR_UI.norecibe))}</div>
    <div class="dnogrid">${DONAR_NO.map(n=>`<div class="dnoitem">${xIcon()}<span>${esc(t(n))}</span></div>`).join('')}</div>`;
}

/* ---- centros de acopio (Supabase) ---- */
let CENTROS=[], USERLOC=null;
function haversine(la1,lo1,la2,lo2){ const R=6371,r=Math.PI/180;
  const dLa=(la2-la1)*r, dLo=(lo2-lo1)*r;
  const s=Math.sin(dLa/2)**2 + Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s)); }
function kmTxt(km){ const n = km<1 ? '<1' : (km<100 ? Math.round(km) : Math.round(km).toLocaleString());
  return LANG==='en' ? n+' km away' : 'a '+n+' km'; }
async function cargarCentros(){
  $('#d-centros').innerHTML = `<p class="muted">${esc(t(DONAR_UI.cargando))}</p>`;
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const {data,error} = await db.from('centros_publico').select('*').order('orden').order('creado');
    if(error) throw error;
    CENTROS = data||[];
  }catch(e){ CENTROS=[]; }
  renderCentros(); renderStat();
}
function renderCentros(){
  if(!CENTROS.length){ $('#d-centros').innerHTML = `<p class="muted">—</p>`; return; }
  let list = CENTROS.slice();
  if(USERLOC){
    list.forEach(c=> c._d = (c.lat&&c.lng) ? haversine(USERLOC.lat,USERLOC.lng,c.lat,c.lng) : Infinity);
    list.sort((a,b)=> a._d-b._d);
  }
  $('#d-centros').innerHTML = list.map((c,idx)=>{
    const acepta = (c.acepta||[]).map(k=>`<span class="chip">${esc(t(CATNOM[k]||{es:k,en:k}))}</span>`).join('');
    const cond = LANG==='en' ? (c.condiciones_en||c.condiciones_es) : (c.condiciones_es||c.condiciones_en);
    const donde = [c.ciudad, c.pais].filter(Boolean).join(' · ');
    const tel = c.tel_e164;
    const near = USERLOC && idx===0 && isFinite(c._d);
    const dist = USERLOC && isFinite(c._d) ? `<span class="cdist${near?' near':''}">${near?pinIcon()+' ':''}${esc(kmTxt(c._d))}${near?` · ${esc(t(DONAR_UI.cercano))}`:''}</span>` : '';
    const mk = CMK[idx % CMK.length];
    return `<div class="ccard${near?' isnear':''}">
      <div class="crow">
        <span class="cmark" style="--mk:${mk}">${pinIcon()}</span>
        <div class="grow">
          <h3>${esc(c.nombre)}</h3>
          ${donde?`<div class="cloc">${esc(donde)}</div>`:''}
          ${c.coordinador?`<div class="ccoord"><span class="muted">Coordina:</span> <b>${esc(c.coordinador)}</b>${tel?` · <span class="muted">${esc(telFmt(tel))}</span>`:''}</div>`:''}
          ${dist}
        </div>
      </div>
      ${c.direccion?`<div class="cdir">${pinIcon()} ${esc(c.direccion)}</div>`:''}
      ${acepta?`<div class="clab">${esc(t(DONAR_UI.acepta))}</div><div class="opts">${acepta}</div>`:''}
      ${c.clasificar?`<div class="cclasif">${boxIcon()} ${esc(t(DONAR_UI.clasificar))}</div>`:''}
      ${cond?`<div class="clab">${esc(t(DONAR_UI.condiciones))}</div><p class="ccond">${esc(cond)}</p>`:''}
      <div class="cacts">
        ${tel?`<a class="wa" href="${waHref(tel)}" target="_blank" rel="noopener">${waIcon()} ${esc(t(DONAR_UI.wa))}</a>`:''}
        ${c.amazon_url?`<a class="amz" href="${esc(amazonSort(c.amazon_url))}" target="_blank" rel="noopener">${amzIcon()} ${esc(t(DONAR_UI.amazon))}</a>`:''}
        ${c.amazon_url?`<a class="cshare" href="/compartir?c=${esc(c.id)}">${shareIcon()} ${esc(t(DONAR_UI.compartir))}</a>`:''}
      </div>
    </div>`;
  }).join('');
}

/* ---- línea de datos del hero ---- */
function renderStat(){
  const nItems = DONAR_CAT.reduce((n,c)=>n+c.items.length,0);
  const nCats  = DONAR_CAT.length, nCen = CENTROS.length;
  const cenLbl = nCen===1 ? t(DONAR_UI.cen1) : t(DONAR_UI.cen);
  const cl=$('#d-catlab'); if(cl) cl.textContent = `${t(DONAR_UI.catlab)} · ${nItems} ${t(DONAR_UI.art)}`;
  $('#d-stat').innerHTML =
    `<div class="hstat"><b>${nItems}</b><small>${esc(t(DONAR_UI.art))}</small></div>
     <div class="hstat"><b>${nCats}</b><small>${esc(t(DONAR_UI.cat))}</small></div>
     ${nCen?`<div class="hstat"><b>${nCen}</b><small>${esc(cenLbl)}</small></div>`:''}`;
}

/* ---- Mi lista (barra flotante) ---- */
function renderLista(){
  const bar = $('#d-lista'), n = SEL.size;
  const view = $('.view.on'); if(view) view.classList.toggle('withbar', !!n);
  if(!n){ bar.hidden = true; bar.innerHTML=''; return; }
  bar.hidden = false;
  bar.innerHTML =
    `<div class="dl-info"><b>${n}</b> <span>${esc(t(DONAR_UI.seleccion))}</span></div>
     <div class="dl-acts">
       <button class="dl-btn" data-a="share">${shareIcon()} ${esc(t(DONAR_UI.compartir))}</button>
       <button class="dl-btn ghost" data-a="vaciar">${esc(t(DONAR_UI.vaciar))}</button>
     </div>`;
}
function shareIcon(){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'; }

/* hoja para elegir cómo compartir */
function optIco(k){ const p={
  texto:'<path d="M5 4h14M5 9h14M5 14h10M5 19h6"/>',
  imagen:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m4 18 5-5 4 3 3-2 4 4"/>',
  pdf:'<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M8.5 14.5h1a1.2 1.2 0 0 0 0-2.4h-1zM8.5 17v-4.9M13 17v-4.9h1.2a1.6 1.6 0 0 1 0 3.2H13"/>'
}; return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[k]||''}</svg>`; }

function openShare(){
  const opt=(k,tit,sub)=>`<button class="dsopt" data-s="${k}"><span class="dsopt-ic">${optIco(k)}</span>
    <span class="grow"><b>${esc(tit)}</b><small>${esc(sub)}</small></span></button>`;
  $('.dsheet-card').innerHTML =
    `<div class="dsheet-h">${esc(t(DONAR_UI.share_title))}</div>
     ${opt('texto',  t(DONAR_UI.opt_texto),  t(DONAR_UI.opt_texto_s))}
     ${opt('imagen', t(DONAR_UI.opt_imagen), t(DONAR_UI.opt_imagen_s))}
     ${opt('pdf',    t(DONAR_UI.opt_pdf),    t(DONAR_UI.opt_pdf_s))}
     <button class="dsheet-x" data-s="cancel">${esc(t(DONAR_UI.cancelar))}</button>`;
  const sh=$('#d-share'); sh.hidden=false; requestAnimationFrame(()=>sh.classList.add('on'));
}
function closeShare(){ const sh=$('#d-share'); sh.classList.remove('on'); setTimeout(()=>sh.hidden=true,220); }
function toast(msg){
  const el = $('#d-toast'); el.textContent = msg; el.hidden = false; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(()=>{ el.classList.remove('on'); setTimeout(()=>el.hidden=true,250); }, 1600);
}
/* aviso visual "se añadió" — rebota el contador + vuela un punto al carrito */
function bumpCart(){ const c=$('#d-lista')?.querySelector('.dl-info b'); if(!c) return;
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
function flyToCart(fromEl){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar=$('#d-lista'); if(!bar || bar.hidden) return;
  const src=fromEl.querySelector('.dchk')||fromEl, a=src.getBoundingClientRect(), tb=bar.getBoundingClientRect();
  const col=getComputedStyle(fromEl).getPropertyValue('--cat').trim()||'#16a34a';
  const dot=document.createElement('div'); dot.className='flydot'; dot.style.background=col;
  dot.style.left=(a.left+a.width/2-9)+'px'; dot.style.top=(a.top+a.height/2-9)+'px';
  document.body.appendChild(dot);
  const dx=(tb.left+34)-(a.left+a.width/2), dy=(tb.top+tb.height/2)-(a.top+a.height/2);
  requestAnimationFrame(()=>{ dot.style.transform=`translate(${dx}px,${dy}px) scale(.35)`; dot.style.opacity='0'; });
  setTimeout(()=>dot.remove(),480);
}

/* lista agrupada por categoría, en el idioma actual */
function listaAgrupada(){
  const out = [];
  DONAR_CAT.forEach(c=>{
    const items = c.items.filter(i=>SEL.has(itemKey(c.key,i)));
    if(items.length) out.push({ cat: LANG==='en'?c.en:c.es, items: items.map(i=> LANG==='en'?i.en:i.es) });
  });
  return out;
}
function listaTexto(){
  const g = listaAgrupada();
  let s = t(DONAR_UI.list_title) + '\n';
  g.forEach(sec=>{ s += '\n' + sec.cat.toUpperCase() + '\n' + sec.items.map(x=>'  • '+x).join('\n') + '\n'; });
  s += '\n' + t(DONAR_UI.list_foot);
  return s;
}
async function copiarPortapapeles(txt){
  try{ await navigator.clipboard.writeText(txt); }
  catch(e){ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select();
            try{document.execCommand('copy');}catch(_){} ta.remove(); }
}
async function shareTexto(){
  const txt = listaTexto();
  if(navigator.share){
    try{ await navigator.share({title:t(DONAR_UI.list_title), text:txt}); return; }catch(e){ if(e && e.name==='AbortError') return; }
  }
  await copiarPortapapeles(txt); toast(t(DONAR_UI.copiado));
}

/* imagen PNG de la lista (para repartir por foto) */
function imagenLista(){
  const g = listaAgrupada();
  const S = 2, W = 720;                            // escala retina
  const pad=48, lh=40, gap=26, catH=44, titleH=64;
  let rows=0; g.forEach(s=>{ rows += s.items.length; });
  const H = pad*2 + titleH + g.length*catH + rows*lh + (g.length-1)*gap + 70;
  const cv = document.createElement('canvas'); cv.width=W*S; cv.height=H*S;
  const x = cv.getContext('2d'); x.scale(S,S);
  // fondo
  x.fillStyle='#ffffff'; x.fillRect(0,0,W,H);
  const grd=x.createLinearGradient(0,0,W,0); grd.addColorStop(0,'#F2B705'); grd.addColorStop(.55,'#F97316'); grd.addColorStop(1,'#D62828');
  x.fillStyle=grd; x.fillRect(0,0,W,8);
  let y=pad+34;
  x.fillStyle='#0e1729'; x.font='800 30px system-ui,-apple-system,Segoe UI,Arial'; x.textBaseline='alphabetic';
  x.fillText(t(DONAR_UI.list_title), pad, y); y+=titleH-14;
  const cc={medico:'#e11d48',medicamentos:'#0d9488',higiene:'#0ea5e9',herramientas:'#d97706',emergencia:'#7c3aed'};
  const keyByName={}; DONAR_CAT.forEach(c=>{keyByName[LANG==='en'?c.en:c.es]=c.key;});
  g.forEach((sec,si)=>{
    if(si) y+=gap;
    const col=cc[keyByName[sec.cat]]||'#334155';
    x.fillStyle=col; x.beginPath(); x.arc(pad+7,y-6,7,0,7); x.fill();
    x.fillStyle=col; x.font='800 17px system-ui,-apple-system,Segoe UI,Arial';
    x.fillText(sec.cat.toUpperCase(), pad+24, y); y+=catH-24;
    sec.items.forEach(it=>{
      y+=lh-8;
      x.strokeStyle='#16a34a'; x.lineWidth=2.4; x.lineCap='round'; x.lineJoin='round';
      x.beginPath(); x.moveTo(pad+2,y-6); x.lineTo(pad+7,y-1); x.lineTo(pad+16,y-12); x.stroke();
      x.fillStyle='#0e1729'; x.font='400 18px system-ui,-apple-system,Segoe UI,Arial';
      let s=it; if(x.measureText(s).width>W-pad-40){ while(x.measureText(s+'…').width>W-pad-40 && s.length>4) s=s.slice(0,-1); s+='…'; }
      x.fillText(s, pad+30, y);
      y+=8;
    });
  });
  y=H-pad+6; x.fillStyle='#94a3b8'; x.font='600 15px system-ui,-apple-system,Segoe UI,Arial';
  x.fillText(t(DONAR_UI.list_foot), pad, y);

  cv.toBlob(async (blob)=>{
    if(!blob) return;
    const file = new File([blob], 'mi-lista-pereira.png', {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:t(DONAR_UI.list_title)}); return; }catch(e){}
    }
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='mi-lista-pereira.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  },'image/png');
}

/* PDF de la lista (jsPDF cargado solo al pedirlo) */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('load')); document.head.appendChild(s); }); }
async function pdfLista(){
  try{
    if(!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'a4'});
    const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=48, maxY=H-56;
    // barra de marca
    doc.setFillColor(242,183,5); doc.rect(0,0,W/2,7,'F');
    doc.setFillColor(214,40,40); doc.rect(W/2,0,W/2,7,'F');
    let y=64;
    doc.setTextColor(14,23,41); doc.setFont('helvetica','bold'); doc.setFontSize(20);
    doc.text(t(DONAR_UI.list_title), M, y); y+=28;
    const cc={medico:[225,29,72],medicamentos:[13,148,136],higiene:[14,165,233],herramientas:[217,119,6],emergencia:[124,58,237]};
    const keyByName={}; DONAR_CAT.forEach(c=>{keyByName[LANG==='en'?c.en:c.es]=c.key;});
    listaAgrupada().forEach((sec,si)=>{
      if(y>maxY-40){ doc.addPage(); y=64; }
      y+= si?18:14;
      const col=cc[keyByName[sec.cat]]||[51,65,85];
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(col[0],col[1],col[2]);
      doc.text(sec.cat.toUpperCase(), M, y); y+=18;
      doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.setTextColor(20,28,45);
      sec.items.forEach(it=>{
        const lines=doc.splitTextToSize('•  '+it, W-M*2-6);
        lines.forEach(ln=>{ if(y>maxY){ doc.addPage(); y=64; } doc.text(ln, M+4, y); y+=18; });
      });
    });
    if(y>maxY-24){ doc.addPage(); y=64; }
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(148,163,184);
    doc.text(t(DONAR_UI.list_foot), M, H-40);
    const blob=doc.output('blob');
    const file=new File([blob],'mi-lista-pereira.pdf',{type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:t(DONAR_UI.list_title)}); return; }catch(e){ if(e&&e.name==='AbortError') return; }
    }
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='mi-lista-pereira.pdf'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }catch(e){ toast('PDF: '+(navigator.onLine?'error':'sin conexión')); }
}

/* ---- textos e idioma ---- */
function pintarTextos(){
  document.documentElement.lang = LANG;
  $('#d-kick').textContent        = t(DONAR_UI.kick);
  $('#d-titulo').textContent      = t(DONAR_UI.titulo);
  $('#d-sub').textContent         = t(DONAR_UI.sub);
  $('#d-busca').placeholder       = t(DONAR_UI.buscar);
  const ah=$('#d-amazon-hero'); if(ah) ah.innerHTML = amzIcon()+'<span>'+esc(t(DONAR_UI.donar_amazon))+'</span>';
  const ic2=$('#d-ir-centros'); if(ic2) ic2.innerHTML = boxIcon()+'<span>'+esc(t(DONAR_UI.llevar))+'</span>';
  $('#d-ubicame').innerHTML       = locIcon()+'<span>'+esc(t(DONAR_UI.ubicame))+'</span>';
  $('#d-centros-h').textContent   = t(DONAR_UI.centros);
  $('#d-centros-sub').textContent = t(DONAR_UI.centros_sub);
  $('#d-vermapa').textContent     = t(DONAR_UI.vermapa);
  const reg=$('#d-registrar'); if(reg) reg.innerHTML = `
    <span class="rpi">${boxIcon()}</span>
    <span class="rpt"><b>${esc(t(DONAR_UI.ser_t))}</b><small>${esc(t(DONAR_UI.ser_s))}</small></span>
    <span class="rpa">${arrowRight()}</span>`;
  const nv=(id,o)=>{const e=$('#'+id); if(e) e.textContent=t(o);};
  nv('nav-donar',DONAR_UI.nav_donar); nv('nav-centro',DONAR_UI.nav_centro); nv('nav-mapa',DONAR_UI.nav_mapa);
  document.querySelectorAll('#langtog button').forEach(b=>b.classList.toggle('on', b.dataset.l===LANG));
}
function renderTodo(){
  pintarTextos(); renderTabs(); renderGuia(); renderModo(); renderCats($('#d-busca').value); renderNo(); renderCentros(); renderStat(); renderLista(); aplicarTab();
}
function setLang(l){ LANG=l; store('ae_lang',l); renderTodo(); }
function setModo(m){ MODE=m; store('ae_donar_modo',m); renderModo(); renderCats($('#d-busca').value); }

/* ---- eventos ---- */
document.querySelectorAll('#langtog button').forEach(b=>b.onclick=()=>setLang(b.dataset.l));

/* al escribir: minimiza el hero y deja solo los resultados */
let _buscando=false;
function modoBusqueda(q){
  const on = !!(q||'').trim();
  document.querySelector('#app').classList.toggle('searching', on);
  if(on && !_buscando){ const v=$('.view.on'); if(v) v.scrollTop=0; }   // sube al empezar
  _buscando = on;
}
$('#d-busca').oninput = ()=>{ const q=$('#d-busca').value; if(q && DTAB!=='amazon') setTab('amazon'); modoBusqueda(q); renderCats(q); };

$('#d-modo').addEventListener('click', e=>{ const b=e.target.closest('button[data-m]'); if(b) setModo(b.dataset.m); });
$('#d-tabs').addEventListener('click', e=>{ const b=e.target.closest('button[data-t]'); if(b) setTab(b.dataset.t); });
$('#d-cats').addEventListener('click', e=>{ if(e.target.closest('[data-amzcat]')) irAmazon(); });

/* acceso rápido a centros + ubícame (el más cercano) */
function irCentros(){
  setTab('persona');
  const i=$('#d-busca'); if(i.value){ i.value=''; modoBusqueda(''); renderCats(''); }
  const h=$('#d-centros-h'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'});
}
function ubicame(cb){
  if(!navigator.geolocation){ toast(t(DONAR_UI.sin_ubi)); return; }
  const b=$('#d-ubicame'); if(b){ b.classList.add('load'); b.disabled=true; }
  navigator.geolocation.getCurrentPosition(
    p=>{ USERLOC={lat:p.coords.latitude, lng:p.coords.longitude}; if(b){ b.classList.remove('load'); b.disabled=false; }
         renderCentros(); if(typeof cb==='function') cb(); else irCentros(); },
    ()=>{ if(b){ b.classList.remove('load'); b.disabled=false; } toast(t(DONAR_UI.sin_ubi)); },
    {timeout:8000, maximumAge:60000}
  );
}
/* donar por Amazon: 0 listas → a centros; 1 → abre directo; varias → elige el más cercano */
function irAmazon(){
  const lists = CENTROS.filter(c=>c.amazon_url);
  if(lists.length===0){ irCentros(); return; }
  if(lists.length===1){ window.open(amazonSort(lists[0].amazon_url), '_blank', 'noopener'); return; }
  openAmazon();
}
function openAmazon(){
  let lists = CENTROS.filter(c=>c.amazon_url);
  if(USERLOC){
    lists.forEach(c=> c._d=(c.lat&&c.lng)?haversine(USERLOC.lat,USERLOC.lng,c.lat,c.lng):Infinity);
    lists = lists.slice().sort((a,b)=> a._d-b._d);
  }
  const rows = lists.map((c,i)=>{
    const mk = CMK[CENTROS.indexOf(c) % CMK.length];
    const donde = [c.ciudad, c.pais].filter(Boolean).join(' · ');
    const near = USERLOC && i===0 && isFinite(c._d);
    const bits = [];
    if(c.ciudad) bits.push(esc(c.ciudad));
    if(c.coordinador) bits.push(esc(c.coordinador));
    if(USERLOC && isFinite(c._d)) bits.push(esc(kmTxt(c._d))+(near?' · '+esc(t(DONAR_UI.cercano)):''));
    return `<button class="amzrow${near?' near':''}" data-url="${esc(c.amazon_url)}">
      <span class="amzrow-ic" style="background:${mk}">${pinIcon()}</span>
      <span class="amzrow-txt"><b>${esc(c.nombre)}</b>${bits.length?`<small>${bits.join(' · ')}</small>`:''}</span>
      <span class="amzcta">${amzIcon()}<span>Amazon</span>${arrowRight()}</span></button>`;
  }).join('');
  const locRow = !USERLOC
    ? `<button class="amzloc" data-loc="1">${locIcon()}<span>${esc(t(DONAR_UI.ubicame))}</span></button>`
    : '';
  $('#d-amazon .dsheet-card').innerHTML =
    `<div class="dsheet-h">${esc(t(DONAR_UI.amz_t))}</div>
     <p class="amz-sub">${esc(t(DONAR_UI.amz_p))}</p>
     ${locRow}
     <div class="amz-hint">${esc(t(DONAR_UI.amz_paso))}</div>
     ${rows}
     <button class="dsheet-x" data-x="1">${esc(t(DONAR_UI.cancelar))}</button>`;
  const sh=$('#d-amazon'); sh.hidden=false; requestAnimationFrame(()=>sh.classList.add('on'));
}
function closeAmazon(){ const sh=$('#d-amazon'); sh.classList.remove('on'); setTimeout(()=>sh.hidden=true,220); }
{ const b=$('#d-ir-centros'); if(b) b.onclick = irCentros; }
$('#d-ubicame').onclick     = ubicame;
{ const b=$('#d-amazon-hero'); if(b) b.onclick = irAmazon; }

/* bienvenida: agradecer y elegir cómo ayudar (una vez por dispositivo) */
function showBienvenida(){
  const opt=(k,cls,ico,tt,ss,fast)=>`<button class="dw-opt ${cls}" data-w="${k}">
    <span class="dw-opt-ic">${ico}</span><span class="grow"><b>${esc(tt)}${fast?` <span class="dw-fast">${esc(t(DONAR_UI.rapido))}</span>`:''}</b><small>${esc(ss)}</small></span></button>`;
  $('#d-bienvenida .dwelcome-card').innerHTML =
    `<button class="dw-x" data-w="close" aria-label="Cerrar">&times;</button>
     <span class="dw-mark">${heartIcon()}</span>
     <h2>${esc(t(DONAR_UI.bienv_t))}</h2>
     <p>${esc(t(DONAR_UI.bienv_p))}</p>
     ${opt('amazon','amazon', amzIcon(), t(DONAR_UI.op_amazon_t), t(DONAR_UI.op_amazon_s), true)}
     ${opt('llevar','primary', pinIcon(), t(DONAR_UI.op_llevar_t), t(DONAR_UI.op_llevar_s))}`;
  const w=$('#d-bienvenida'); w.hidden=false; requestAnimationFrame(()=>w.classList.add('on'));
}
function closeBienvenida(){ store('ae_donar_bienv','1'); const w=$('#d-bienvenida'); w.classList.remove('on'); setTimeout(()=>w.hidden=true,240); }
$('#d-bienvenida').addEventListener('click', e=>{
  const b=e.target.closest('[data-w]'); if(!b) return;
  const w=b.dataset.w; closeBienvenida();
  if(w==='amazon') irAmazon();
  else if(w==='llevar'){ const v=$('.view.on'); if(v) v.scrollTop=0; $('#d-busca')?.focus({preventScroll:true}); }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#d-bienvenida').hidden) closeBienvenida(); });

$('#d-cats').addEventListener('click', e=>{
  const head = e.target.closest('.dcat-h');
  if(head){ const k=head.dataset.cat; OPEN.has(k)?OPEN.delete(k):OPEN.add(k); store('ae_donar_open',[...OPEN].join(',')); renderCats($('#d-busca').value); return; }
  const it = e.target.closest('.ditem');
  if(it){ const k=it.dataset.k; const on=!SEL.has(k); on?SEL.add(k):SEL.delete(k);
          store('ae_donar_sel',[...SEL].join('\n')); it.classList.toggle('on',on); it.setAttribute('aria-pressed',on);
          renderLista(); if(on){ flyToCart(it); bumpCart(); } }
});

$('#d-lista').addEventListener('click', e=>{
  const b=e.target.closest('[data-a]'); if(!b) return;
  if(b.dataset.a==='share') openShare();
  else if(b.dataset.a==='vaciar'){ SEL.clear(); store('ae_donar_sel'); renderCats($('#d-busca').value); renderLista(); }
});
$('#d-share').addEventListener('click', e=>{
  const b=e.target.closest('[data-s]'); if(!b) return;
  const s=b.dataset.s; closeShare();
  if(s==='texto') shareTexto(); else if(s==='imagen') imagenLista(); else if(s==='pdf') pdfLista();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#d-share').hidden) closeShare(); });

$('#d-amazon').addEventListener('click', e=>{
  if(e.target.closest('[data-loc]')){ ubicame(()=>openAmazon()); return; }
  const row=e.target.closest('[data-url]');
  if(row){ const u=row.dataset.url; closeAmazon(); window.open(amazonSort(u),'_blank','noopener'); return; }
  if(e.target.closest('[data-x]')) closeAmazon();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#d-amazon').hidden) closeAmazon(); });

/* parallax suave del aura (se apaga con reduce-motion) */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.querySelector('.dhero-aura'); if(!el) return;
  const scroller = document.querySelector('.view.on');
  const top = () => scroller ? scroller.scrollTop : window.scrollY;
  let tick=false;
  function apply(){ el.style.transform = 'translate3d(0,'+(top()*0.16).toFixed(1)+'px,0)'; tick=false; }
  (scroller||window).addEventListener('scroll', function(){ if(!tick){ requestAnimationFrame(apply); tick=true; } }, {passive:true});
})();

if(typeof pintarVersion==='function') pintarVersion();
renderTodo();
cargarCentros();
if(!load('ae_donar_bienv')) showBienvenida();
