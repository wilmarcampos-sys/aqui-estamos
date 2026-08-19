/* ============================================================
   8. TENGO ALGO PARA DAR — hoja "Dar" con match automático.
   El mapa NUNCA desaparece: la hoja ocupa abajo y el destino se
   encuadra arriba con una ruta punteada verde.

   El destino se decide con un puntaje transparente, calculado
   aquí mismo en el teléfono (funciona sin señal y es explicable):

     puntaje = urgencia×40 + personas×8 (tope 25)
             + 30 si nadie ha llegado − km×6

   y se filtra por el alcance que la persona elige (a pie / moto /
   carro). El "por qué" se muestra con palabras, no cajas negras.
   ============================================================ */

const DAR_CATS = [
  {id:'agua',   n:'Agua',        ic:'droplet',  keys:['agua','carrotanq','potabiliza']},
  {id:'comida', n:'Mercado',     ic:'utensils', keys:['mercado','enlatados','liviano','caliente','cocina','menaje','mascotas']},
  {id:'medic',  n:'Medicinas',   ic:'pill',     keys:[]},
  {id:'bebes',  n:'Pañales',     ic:'bottle',   keys:['formula']},
  {id:'abrigo', n:'Cobijas',     ic:'tent',     keys:[]},
  {id:'ropa',   n:'Ropa',        ic:'shirt',    keys:[]},
  {id:'aseo',   n:'Aseo',        ic:'soap',     keys:[]},
  {id:'herr',   n:'Herramientas',ic:'wrench',   keys:[]},
  {id:'otra',   n:'Otra',        ic:'plus',     keys:[]},   // todo lo demás del catálogo
];
(function(){
  const porCat = {}; CATALOGO.forEach(c=>{ porCat[c.cat] = c.items.map(i=>i.k); });
  const add=(id,cats)=>{ const g=DAR_CATS.find(x=>x.id===id);
    cats.forEach(c=>(porCat[c]||[]).forEach(k=>{ if(!g.keys.includes(k)) g.keys.push(k); })); };
  add('medic', ['Material de curación','Insumos médicos','Medicamentos']);
  add('abrigo',['Dónde dormir']);
  add('ropa',  ['Ropa y calzado']);
  add('aseo',  ['Higiene personal','Servicios y limpieza']);
  add('bebes', ['Bebés y crianza']);
  add('herr',  ['Herramientas y rescate']);
  const usadas = new Set(DAR_CATS.flatMap(c=>c.keys));
  const g=DAR_CATS.find(x=>x.id==='otra');
  Object.values(porCat).flat().forEach(k=>{ if(!usadas.has(k)) g.keys.push(k); });
})();

let gSel = new Set(), gQty = 1, gKm = 5, gStep = 1, gCand = [], gIdx = 0, gTimer = null, gOrden = 'mejor', gDest = 'todos';
let gRuta = null, gMk = null;

const G_TITLES = {0:'¿Dónde estás?', 1:'¿Qué traes?', 2:'Buscando…', 3:'Llévalo aquí'};

/* Cruce con OTRAS FUENTES: las necesidades de los acopios de alluda.online
   también son "pedir ayuda", así que entran al match. Su categoría libre se
   traduce a nuestras categorías de Dar por palabras clave. */
const ACO_CAT = [
  {rx:/agua/i, id:'agua'},
  {rx:/aliment|mercado|comida|perecedero/i, id:'comida'},
  {rx:/medic|salud|farmac|botiqu/i, id:'medic'},
  {rx:/pañal|panal|bebé|bebe|infantil|leche|f[oó]rmula/i, id:'bebes'},
  {rx:/cobija|abrigo|colchon|carpa|dormir|frazada/i, id:'abrigo'},
  {rx:/ropa|calzado|zapato/i, id:'ropa'},
  {rx:/aseo|higiene|limpieza|jab[oó]n/i, id:'aseo'},
  {rx:/herramient|construc|pala|linterna|pila/i, id:'herr'},
];
const acoCat = n => { const hit=ACO_CAT.find(x=>x.rx.test((n.cat||'')+' '+(n.desc||''))); return hit?hit.id:'otra'; };

/* ---- candidatos con el puntaje transparente ---- */
function darCandidatos(){
  const keys = new Set();
  DAR_CATS.filter(c=>gSel.has(c.id)).forEach(c=>c.keys.forEach(k=>keys.add(k)));
  const org = (typeof mainPt!=='undefined' && mainPt) ? mainPt : {lat:4.8133,lng:-75.6961};
  const out = [];
  ZONAS.forEach(z=>focos(z.id).forEach(f=>{
    const match = f.needs.filter(x=>{
      if(!keys.has(x.k)) return false;
      const e = S.entregas.filter(y=>y.k===x.k && y.lat && dist(f.lat,f.lng,y.lat,y.lng)<400)
                          .sort((p,q)=>q.ts-p.ts)[0];
      return !(e && (now()-e.ts) < 7*24*H);
    });
    if(!match.length) return;
    const entCerca = S.entregas.filter(y=>y.lat && dist(f.lat,f.lng,y.lat,y.lng)<300)
                               .sort((p,q)=>q.ts-p.ts)[0];
    const nadie = !(entCerca && (now()-entCerca.ts) < 7*24*H);
    const diasSin = entCerca ? Math.round((now()-entCerca.ts)/86400000) : null;
    const km = dist(org.lat,org.lng,f.lat,f.lng)/1000;
    const u = Math.max(...match.map(x=>x.u));
    const personas = match.reduce((s,x)=>s+x.personas,0);
    const puntaje = u*40 + Math.min(personas,25)*8 + (nadie?30:0) - km*6;
    out.push({f, z, match, u, personas, nadie, diasSin, km, puntaje, org});
  }));
  // viviendas del CENSO con punto exacto y pendiente que calza: también son
  // "pedir ayuda". Las de punto aproximado NO entran (no se manda a nadie a
  // un punto inventado); entrarán cuando fijen su pin real.
  const CENSO_DAR = {agua:'agua', alimentos:'comida', medicamentos:'medic', ropa:'abrigo', bebes:'bebes', aseo:'aseo'};
  (S.censo||[]).forEach(cn=>{
    if(!cn.lat || !cn.lng || cn.aprox) return;
    const ent = S.entregas.filter(y=>y.lat && dist(cn.lat,cn.lng,y.lat,y.lng)<300).sort((p,q)=>q.ts-p.ts)[0];
    if(ent && (now()-ent.ts) < 7*24*H) return;   // ya atendida
    const match = (cn.needs||[]).filter(k=>{ const d=CENSO_DAR[k]; return d && gSel.has(d); });
    if(!match.length) return;
    const km = dist(org.lat,org.lng,cn.lat,cn.lng)/1000;
    const u = cn.urg||2;
    const zz = zonaDe(cn.lat,cn.lng);
    const puntaje = u*40 + Math.min(cn.personas||0,25)*8 + 30 - km*6;
    out.push({tipo:'censo', cn, f:{ref:cn.apellido?`Familia ${cn.apellido}`:'Vivienda censada', lat:cn.lat, lng:cn.lng},
      z:{n:cn.barrio||zz.n, id:zz.id}, match, u, personas:cn.personas||0,
      nadie:true, diasSin:null, km, puntaje, org});
  });

  // acopios aliados con pendientes que calzan con lo que traes.
  // Sin el bono de "nadie ha llegado" y con un pequeño descuento: la gente
  // que pide directo va primero; el acopio es el segundo mejor destino.
  (window.ACOPIOS||[]).forEach(a=>{
    const match = a.needs.filter(n=>gSel.has(acoCat(n)));
    if(!match.length) return;
    const km = dist(org.lat,org.lng,a.lat,a.lng)/1000;
    const u = match.some(n=>/urgente/i.test(n.prio||'')) ? 3 : 2;
    const puntaje = u*40 + Math.min(match.length*4,25) - km*6 - 10;
    out.push({tipo:'acopio', a, f:{ref:a.nom, lat:a.lat, lng:a.lng},
      z:{n:a.ciudad||'', id:null}, match, u, personas:0, nadie:false,
      diasSin:null, km, puntaje, org});
  });
  // filtro del destinatario: mismas clasificaciones del mapa
  const pool = gDest==='viviendas' ? out.filter(c=>c.tipo==='censo')
             : gDest==='acopios'   ? out.filter(c=>c.tipo==='acopio')
             : gDest==='reportes'  ? out.filter(c=>!c.tipo)
             : out;
  const dentro = pool.filter(c=>c.km <= gKm);
  const lista = dentro.length ? dentro : pool;
  // el que da elige su prioridad: mejor destino (puntaje), cercanía o urgencia
  if(gOrden==='cerca')   return lista.sort((a,b)=>a.km-b.km);
  if(gOrden==='urgente') return lista.sort((a,b)=>b.u-a.u || b.puntaje-a.puntaje);
  return lista.sort((a,b)=>b.puntaje-a.puntaje);
}

/* ---- la hoja ---- */
const gs = document.getElementById('gsheet');
function gGo(n){
  gStep = n;
  gs.querySelectorAll('.gstep').forEach(x=>x.classList.toggle('active', +x.dataset.g===n));
  document.getElementById('gs-title').textContent = G_TITLES[n]||'';
  const cta = document.getElementById('gs-next');
  cta.hidden = (n===0);
  if(n===1){ cta.textContent='Buscar dónde falta'; cta.className='cta green'; }
  if(n===2){ cta.textContent='Cancelar'; cta.className='cta soft'; }
  if(n===3){ cta.textContent='Cómo llegar'; cta.className='cta blue'; }
  gs.querySelector('.gs-body').scrollTop = 0;
  clearTimeout(gTimer);
  if(n!==3) gRutaQuitar();
  if(n===2){
    const que = DAR_CATS.filter(c=>gSel.has(c.id)).map(c=>c.n.toLowerCase()).join(', ');
    document.getElementById('gs-busca-t').textContent = `Buscando dónde falta ${que}…`;
    document.getElementById('gs-busca-s').textContent = `Cruzando ${S.reportes.length} reportes abiertos con tu ubicación`;
    gTimer = setTimeout(()=>{
      gCand = darCandidatos(); gIdx = 0;
      gCand.length ? gMatch() : gVacio();
    }, 1200);
  }
}
function gAbrir(){
  gSel = new Set(); gIdx = 0;
  gs.querySelectorAll('.mini-chip').forEach(c=>c.setAttribute('aria-pressed','false'));
  document.querySelector('.msheet')?.classList.add('tucked');
  gGo(0);
  requestAnimationFrame(()=>gs.classList.add('open'));
}
function gCerrar(){
  clearTimeout(gTimer);
  gs.classList.remove('open');
  document.querySelector('.msheet')?.classList.remove('tucked');
  gRutaQuitar();
}

/* ---- paso 3: el match, con ruta en el mapa ---- */
function gMatch(){
  const c = gCand[gIdx];
  const min = Math.max(1, Math.round(c.km / (gKm===1?4:gKm===5?20:30) * 60));
  const medio = gKm===1?'a pie':gKm===5?'en moto':'en carro';
  const esAco = c.tipo==='acopio', esCen = c.tipo==='censo';
  const piden = esAco
    ? [...new Set(c.match.map(n=>n.cat||'Otros'))].slice(0,3).join(' · ')
    : esCen ? c.match.slice(0,3).map(k=>CENSO_NEED[k]||k).join(' · ')
    : c.match.slice(0,3).map(x=>NEED[x.k]?.n||x.k).join(' · ');
  const cb = esAco ? null : cubridores(c.f.lat, c.f.lng, c.z.id)[0];
  const traes = DAR_CATS.filter(x=>gSel.has(x.id)).map(x=>x.n.toLowerCase()).join(', ');
  document.getElementById('gs-match').innerHTML = `
    <div class="match">
      <div class="match-h">
        <span class="mrank" style="background:${esCen?'#7c3aed':esAco?'#0d9488':(UCOL[c.u]||'#d97706')}">${
          esCen?ico('user'):esAco?ico('box'):ico('alert')}</span>
        <div class="mt"><b>${esc(c.f.ref||c.z.n)}</b>
          <small>${esAco?'Acopio · ':esCen?'Vivienda censada · ':''}${esc(c.z.n)} · ${c.km<1?Math.round(c.km*1000)+' m':c.km.toFixed(1)+' km'} · ${min} min ${medio}</small></div>
        <span class="sbadge ${c.u===3?'b3':c.u===2?'b2':'b1'}">${c.u===3?'Urgencia alta':c.u===2?'Urgente':'Puede esperar'}</span>
      </div>
      <div class="match-line"><span class="ml-k">Piden</span><span class="ml-v">${esc(piden)}${c.personas?` · ${c.personas} personas`:''}</span></div>
      <div class="match-line"><span class="ml-k">Tú traes</span><span class="ml-v ok">${esc(traes)} · ${gQty} unidad${gQty>1?'es':''}</span></div>
      <div class="match-line"><span class="ml-k">Por qué</span><span class="ml-v">${[
        c.u===3?'urgencia alta':c.u===2?'urgente':null,
        c.personas?`${c.personas} persona${c.personas>1?'s':''} esperando`:null,
        c.km<=gKm?'te queda a tu alcance':'es lo más cercano pendiente',
      ].filter(Boolean).join(' · ')}</span></div>
      ${c.nadie ? `<div class="match-line warn"><span class="ml-k">Ojo</span><span class="ml-v">${c.diasSin!=null?`Nadie ha llegado en ${c.diasSin} día${c.diasSin===1?'':'s'}`:'Aquí no ha llegado nadie todavía'}</span></div>` : ''}
      ${esCen && c.cn.tel ? `<div class="coord-mini">
        <span class="av2">${esc((c.cn.apellido||'F').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase())}</span>
        <span class="cn">${esc(c.f.ref)}<small>Contacto de la vivienda</small></span>
        <button type="button" class="wa-mini" data-wa="${esc(String(c.cn.tel).replace(/\D/g,''))}" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6a11 11 0 0 1-4.2-3.9c-.3-.5-.7-1.2-.7-1.9s.3-1.1.5-1.3c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.6c0 .1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.2 0 .5.2.3.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.8c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3v.5Z"/></svg>
        </button>
      </div>` : cb ? `<div class="coord-mini">
        <span class="av2">${esc((cb.nom||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase())}</span>
        <span class="cn">${esc(cb.nom)}<small>Coordina este sector</small></span>
        ${cb.tel?`<button type="button" class="wa-mini" data-wa="${esc(String(cb.tel).replace(/\D/g,''))}" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6a11 11 0 0 1-4.2-3.9c-.3-.5-.7-1.2-.7-1.9s.3-1.1.5-1.3c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.6c0 .1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.2 0 .5.2.3.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.8c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3v.5Z"/></svg></button>`:''}
      </div>` : esAco
        ? `<div class="match-line"><span class="ml-k">Fuente</span><span class="ml-v">Centro de acopio de la red alluda.online — recibe y clasifica</span></div>`
        : `<div class="match-line"><span class="ml-k">A cargo</span><span class="ml-v">Nadie todavía — tu entrega es doblemente valiosa</span></div>`}
    </div>
    <button type="button" class="alt-link" id="gs-alt" ${gCand.length>1?'':'hidden'}>
      ${gIdx+1 < gCand.length ? `Ver la siguiente de ${gCand.length} opciones cerca ›` : '‹ Volver a la mejor opción'}</button>
    <button type="button" class="alt-link" id="gs-entregue" style="color:#5FBE8A">${esAco?'Ver ficha del centro y contacto ›':'Ya lo entregué — registrarlo'}</button>
  `;
  const alt = document.getElementById('gs-alt');
  if(alt) alt.onclick = ()=>{ gIdx = (gIdx+1) % gCand.length; gMatch(); };
  document.getElementById('gs-entregue').onclick = ()=>{
    gCerrar();
    // a un acopio no se le "registra entrega" en nuestros focos: la
    // confirmación vive en el centro (ficha con dirección y contacto)
    if(esAco){ abrirAcopio(c.a); return; }
    if(esCen){ abrirEntrega(c.z.id, null, {z:c.z.id, lat:c.f.lat, lng:c.f.lng}); return; }
    abrirEntrega(c.z.id, c.match.map(x=>x.k), {z:c.z.id, lat:c.f.lat, lng:c.f.lng});
  };
  const wa = document.querySelector('#gs-match [data-wa]');
  if(wa) wa.onclick = ()=>{ const d=wa.dataset.wa; window.open(`https://wa.me/${d.startsWith('57')||d.startsWith('1')?d:'57'+d}`,'_blank','noopener'); };
  gGo(3);
  gRutaPintar(c);
}
function gVacio(){
  document.getElementById('gs-match').innerHTML = `
    <div class="match" style="text-align:center;padding:18px 14px">
      <b style="font-size:15px">Por ahora eso está cubierto</b>
      <p class="muted" style="margin:8px 0 0;font-size:12.8px;line-height:1.45">No hay puntos pendientes que necesiten
      justo lo que traes${gKm<20?' a ese alcance':''}. También sirve llevarlo a un albergue o centro de acopio.</p>
    </div>
    <button type="button" class="alt-link" id="gs-otra">Elegir otra cosa</button>`;
  document.getElementById('gs-otra').onclick = ()=>gGo(1);
  document.getElementById('gs-title').textContent = 'Sin pendientes';
  gs.querySelectorAll('.gstep').forEach(x=>x.classList.toggle('active', +x.dataset.g===3));
  const cta=document.getElementById('gs-next'); cta.textContent='Cerrar'; cta.className='cta soft'; gStep=3.9;
  gRutaQuitar();
}

/* ruta punteada verde de mi pin al destino; encuadre que respeta la hoja */
function gRutaPintar(c){
  if(!map || modoSVG) return;
  try{
    gRutaQuitar();
    window.__darFoco = true;           // apaga las demás capas: solo origen y destino
    if(typeof pintarMapa==='function') pintarMapa();
    gRuta = L.polyline([[c.org.lat,c.org.lng],[c.f.lat,c.f.lng]],
      {color:'#16A34A', weight:3.5, dashArray:'7 8', opacity:.9}).addTo(map);
    // el destino en el mapa lleva el color e icono de su categoria (como el filtro)
    const col = c.tipo==='censo' ? '#7c3aed' : c.tipo==='acopio' ? '#0d9488' : (UCOL[c.u]||'#d97706');
    const icn = c.tipo==='censo' ? 'user' : c.tipo==='acopio' ? 'box' : 'alert';
    gMk = L.marker([c.f.lat,c.f.lng],{zIndexOffset:1500, icon:L.divIcon({className:'',iconSize:[38,38],iconAnchor:[19,19],
      html:`<div class="mpin" style="width:38px;height:38px;background:${col}">${ico(icn)}</div>`})}).addTo(map);
    const sheetH = gs.offsetHeight || 300;
    map.fitBounds(L.latLngBounds([[c.org.lat,c.org.lng],[c.f.lat,c.f.lng]]),
      {paddingTopLeft:[46,70], paddingBottomRight:[46, sheetH+24], animate:false});
  }catch(e){}
}
function gRutaQuitar(){
  try{ if(gRuta){ map.removeLayer(gRuta); gRuta=null; }
       if(gMk){ map.removeLayer(gMk); gMk=null; } }catch(e){}
  if(window.__darFoco){ window.__darFoco=false;
    try{ if(typeof pintarMapa==='function') pintarMapa(); }catch(e){} }
}
window.darQuitar = gRutaQuitar;   // limpieza también al cerrar otros modales

/* ---- armar la hoja ---- */
(function(){
  if(!gs) return;
  document.getElementById('gs-cats').innerHTML = DAR_CATS.map(c=>
    `<button type="button" class="mini-chip" data-cat="${c.id}" aria-pressed="false">
      <span class="mi">${ico(c.ic)}</span>${esc(c.n)}</button>`).join('');
  gs.querySelectorAll('.mini-chip').forEach(b=>b.onclick=()=>{
    const id=b.dataset.cat; gSel.has(id)?gSel.delete(id):gSel.add(id);
    b.setAttribute('aria-pressed', gSel.has(id)?'true':'false');
  });
  document.querySelectorAll('#gs-qty button').forEach(b=>b.onclick=()=>{
    gQty=Math.max(1,Math.min(999,gQty+(+b.dataset.d)));
    document.getElementById('gs-qn').textContent=gQty;
  });
  document.querySelectorAll('#gs-range button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#gs-range button').forEach(x=>x.setAttribute('aria-checked','false'));
    b.setAttribute('aria-checked','true'); gKm=+b.dataset.km;
  });
  document.querySelectorAll('#gs-dest button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#gs-dest button').forEach(x=>x.setAttribute('aria-checked','false'));
    b.setAttribute('aria-checked','true'); gDest=b.dataset.de;
  });
  document.querySelectorAll('#gs-orden button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#gs-orden button').forEach(x=>x.setAttribute('aria-checked','false'));
    b.setAttribute('aria-checked','true'); gOrden=b.dataset.o;
  });
  document.getElementById('gs-close').onclick = gCerrar;
  const gl=document.getElementById('gs-local'); if(gl) gl.onclick=()=>gGo(1);
  document.getElementById('gs-next').onclick = ()=>{
    if(gStep===1){
      if(!gSel.size) return toast('Marca al menos una cosa que traes.');
      gGo(2);
    }
    else if(gStep===2){ gCerrar(); }
    else if(gStep===3){
      const c=gCand[gIdx]; if(!c) return;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const u = ios ? `https://maps.apple.com/?daddr=${c.f.lat},${c.f.lng}&dirflg=d`
                    : `https://www.google.com/maps/dir/?api=1&destination=${c.f.lat},${c.f.lng}`;
      const w=window.open(u,'_blank','noopener'); if(!w) location.href=u;
    }
    else { gCerrar(); }   // estado "sin pendientes"
  };
  const fab = document.getElementById('fab-dar');
  if(fab) fab.onclick = gAbrir;
})();
