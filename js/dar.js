/* ============================================================
   8. TENGO ALGO PARA DAR
   Cierra el ciclo oferta-demanda: la persona dice QUÉ trae y la
   app le dice A DÓNDE llevarlo — un solo destino, con el porqué.

   El destino se decide con un puntaje transparente, calculado
   aquí mismo en el teléfono (funciona sin señal y es explicable):

     puntaje = urgencia×40 + personas×8 (tope 25)
             + 30 si nadie ha llegado − km×6

   Nada de cajas negras: el "por qué este punto" se le muestra
   a la persona con palabras.
   ============================================================ */

/* Qué trae la gente, en 7 grupos con dibujo grande (casi sin leer).
   Cada grupo junta las claves reales del catálogo de necesidades. */
const DAR_CATS = [
  {id:'agua',   n:'Agua',            ic:'droplet', keys:['agua','carrotanq','potabiliza']},
  {id:'comida', n:'Comida',          ic:'utensils', keys:['mercado','enlatados','liviano','caliente','cocina','menaje','mascotas']},
  {id:'abrigo', n:'Cobijas y dormir',ic:'tent',    keys:[]},   // se llena abajo con el catálogo
  {id:'ropa',   n:'Ropa y calzado',  ic:'shirt',   keys:[]},
  {id:'aseo',   n:'Aseo',            ic:'soap',    keys:[]},
  {id:'medic',  n:'Medicinas',       ic:'pill',    keys:[]},
  {id:'bebes',  n:'Para bebés',      ic:'bottle',  keys:['formula']},
];
/* Completa los grupos desde el catálogo real, para no repetir listas a mano. */
(function(){
  const porCat = {};
  CATALOGO.forEach(c=>{ porCat[c.cat] = c.items.map(i=>i.k); });
  const add = (id, cats)=>{ const g=DAR_CATS.find(x=>x.id===id);
    cats.forEach(c=>{ (porCat[c]||[]).forEach(k=>{ if(!g.keys.includes(k)) g.keys.push(k); }); }); };
  add('abrigo', ['Dónde dormir']);
  add('ropa',   ['Ropa y calzado']);
  add('aseo',   ['Higiene personal','Servicios y limpieza']);
  add('medic',  ['Material de curación','Insumos médicos','Medicamentos']);
  add('bebes',  ['Bebés y crianza']);
})();

let darSel = new Set();

/* ---- PASO 1: ¿qué tienes para dar? ---- */
function abrirDar(){
  darSel = new Set();
  abrirSheet(`
    <h2 style="margin:2px 0 4px">¿Qué tienes para dar?</h2>
    <p class="muted" style="margin:0 0 12px">Toca lo que traes. Puedes elegir varios.</p>
    <div class="dar-grid">
      ${DAR_CATS.map(c=>`<button type="button" class="dar-tile" data-dar="${c.id}">
        ${ico(c.ic,'lg')}<span>${esc(c.n)}</span></button>`).join('')}
    </div>
    <button type="button" class="btn guide" id="dar-sigue" disabled style="margin-top:14px">Continuar</button>
    <button type="button" class="btn flat" data-close style="width:100%">Cancelar</button>
  `);
  const sigue = $('#dar-sigue');
  document.querySelectorAll('.dar-tile').forEach(t=>t.onclick=()=>{
    const id=t.dataset.dar;
    darSel.has(id) ? darSel.delete(id) : darSel.add(id);
    t.classList.toggle('sel', darSel.has(id));
    sigue.disabled = !darSel.size;
    sigue.textContent = darSel.size ? `Continuar (${darSel.size})` : 'Continuar';
  });
  sigue.onclick = ()=>darDestino();
}

/* ---- el puntaje: a qué punto conviene llevarlo ---- */
function darCandidatos(){
  const keys = new Set();
  DAR_CATS.filter(c=>darSel.has(c.id)).forEach(c=>c.keys.forEach(k=>keys.add(k)));
  const org = (typeof mainPt!=='undefined' && mainPt) ? mainPt : {lat:4.8133,lng:-75.6961};
  const out = [];
  ZONAS.forEach(z=>focos(z.id).forEach(f=>{
    // solo lo PENDIENTE de lo que la persona trae (sin entrega reciente cerca)
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
    const km = dist(org.lat,org.lng,f.lat,f.lng)/1000;
    const u = Math.max(...match.map(x=>x.u));
    const personas = match.reduce((s,x)=>s+x.personas,0);
    const puntaje = u*40 + Math.min(personas,25)*8 + (nadie?30:0) - km*6;
    out.push({f, z, match, u, personas, nadie, km, puntaje});
  }));
  return out.sort((a,b)=>b.puntaje-a.puntaje);
}

/* ---- PASO 2: llévalo aquí (un solo destino, con el porqué) ---- */
function darDestino(iAlt){
  const cand = darCandidatos();
  if(!cand.length){
    abrirSheet(`
      <div class="vacio"><div class="vic">${ico('check')}</div>
        <b>Por ahora eso está cubierto</b>
        <p>No hay puntos pendientes que necesiten justo lo que traes. También puedes
        llevarlo a un albergue o a un centro de acopio.</p></div>
      <button type="button" class="btn" id="dar-otra">Elegir otra cosa</button>
      <button type="button" class="btn flat" data-close style="width:100%">Cerrar</button>`);
    $('#dar-otra').onclick=()=>abrirDar();
    return;
  }
  const i = Math.min(iAlt||0, cand.length-1);
  const c = cand[i];
  const kmTxt = c.km<1 ? `${Math.round(c.km*1000)} m` : `${c.km.toFixed(1)} km`;
  const porQue = [
    c.match.some(x=>x.u===3) ? 'urgencia alta' : null,
    c.personas ? `~${c.personas} persona${c.personas>1?'s':''}` : null,
    c.nadie ? 'nadie ha llegado' : null,
    `a ${kmTxt} de tu pin`,
  ].filter(Boolean).join(' · ');
  const chips = c.match.slice(0,5).map(x=>
    `<span class="chip ${x.u===3?'u3':x.u===2?'u2':''}">${esc(NEED[x.k]?.n||x.k)}</span>`).join('');
  abrirSheet(`
    <h2 style="margin:2px 0 4px">Llévalo aquí</h2>
    <p class="muted" style="margin:0 0 12px">Aquí de verdad falta lo que traes.</p>
    <div class="card" style="margin-bottom:12px">
      <div class="row">
        <div class="rank" style="background:${UCOL[c.u]||'#d97706'};color:#fff">${ico('pin')}</div>
        <div class="grow">
          <h3 class="trunc" style="margin:0">${esc(c.f.ref||c.z.n)}</h3>
          <div class="muted">${esc(c.z.n)} · ${porQue}</div>
        </div>
      </div>
      <div style="margin-top:8px">${chips}</div>
    </div>
    <a class="btn guide" style="display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none"
       href="https://www.google.com/maps/dir/?api=1&destination=${c.f.lat},${c.f.lng}" target="_blank" rel="noopener">
       ${ico('pin')} Cómo llegar</a>
    <button type="button" class="btn" id="dar-entregue"
      style="background:#2f7d4f;color:#fff">${ico('check')} Ya lo entregué</button>
    ${cand.length>i+1?`<button type="button" class="btn flat" id="dar-otro" style="width:100%">Ver otra opción</button>`:''}
    <button type="button" class="btn flat" data-close style="width:100%">Cerrar</button>
  `);
  $('#dar-entregue').onclick = ()=>abrirEntrega(c.z.id, c.match.map(x=>x.k), {z:c.z.id, lat:c.f.lat, lng:c.f.lng});
  const otro = $('#dar-otro'); if(otro) otro.onclick = ()=>darDestino(i+1);
  // enfocar el destino en el mapa de fondo, para ubicarse
  if(typeof map!=='undefined' && map && !modoSVG){ try{ map.flyTo([c.f.lat,c.f.lng], 15.5, {duration:.8}); }catch(e){} }
}

/* botón verde en la hoja del mapa */
(function(){
  const b = document.getElementById('fab-dar');
  if(b) b.onclick = ()=>abrirDar();
})();
