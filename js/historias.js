/* ============================================================
   HISTORIAS DEL CENSO — carrusel de la pestaña Ayudar
   ============================================================
   Lo que cada familia contó, sin nombre ni dirección: la persona
   autorizó su censo para coordinar ayuda, no para una campaña.
   El nombre solo aparece si además autorizó publicarlo (`publicar_nombre`),
   y por eso la vista pública lo devuelve en nulo casi siempre.
   ============================================================ */

window.__HISTORIAS = [];
let hIdx = 0, hTimer = null;

const H_COND = {grave:'Enfermedad grave en tratamiento', embarazo:'Embarazo o lactancia',
  discapacidad:'Discapacidad o movilidad reducida', sensorial:'Discapacidad auditiva o visual',
  cronica:'Enfermedad crónica', sin_empleo:'Sin empleo por el terremoto', mascotas:'Con mascotas'};
const H_NEC = {agua:'Agua', alimentos:'Mercado', medicamentos:'Medicinas', ropa:'Carpas y cobijas',
  bebes:'Pañales y bebés', aseo:'Aseo', albergue:'Albergue', arriendo:'Arriendo',
  estructural:'Evaluación', servicios:'Servicios públicos', movilidad:'Silla de ruedas',
  materiales:'Materiales', utensilios:'Utensilios', transporte:'Transporte', mascotas:'Comida para mascotas'};

async function cargarHistorias(){
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const {data, error} = await db.from('historias_publicas').select('*');
    if(error || !data || !data.length) return;
    // orden variable: que no siempre encabece la misma familia
    window.__HISTORIAS = data.sort(()=>Math.random()-0.5);
    pintarHistorias();
  }catch(e){ /* si no cargan, la sección simplemente no aparece */ }
}

function pintarHistorias(){
  const hs = window.__HISTORIAS, bl = document.getElementById('b-historias');
  const pista = document.getElementById('carru-pista');
  const puntos = document.getElementById('carru-puntos');
  if(!hs.length || !pista || !bl) return;
  bl.style.display = '';

  pista.innerHTML = hs.map(h=>{
    const cond = (h.condiciones||[]).map(k=>H_COND[k]).filter(Boolean);
    const nec  = (h.necesidades||[]).map(k=>H_NEC[k]||k);
    // el barrio a veces repite la ciudad ("Dosquebradas · Dosquebradas")
    const lugar = [...new Set([h.barrio, h.ciudad].filter(Boolean)
                    .map(t=>t.trim()))].join(' · ') || 'Pereira';
    return `<article class="hcard">
      <p class="htexto">${esc(h.historia)}</p>
      ${cond.length?`<div class="hcond">${cond.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
      <div class="hpie">
        <span class="hlugar">${esc(lugar)}${h.personas?` · ${h.personas} persona${h.personas>1?'s':''}`:''}</span>
        ${nec.length?`<span class="hnec">Necesita ${esc(nec.slice(0,3).join(' · ').toLowerCase())}</span>`:''}
      </div>
    </article>`;
  }).join('');

  puntos.innerHTML = hs.map((_,i)=>`<button type="button" data-hp="${i}" aria-label="Historia ${i+1}"></button>`).join('');
  irHistoria(0);
  reiniciarTimer();
}

function irHistoria(i){
  const hs = window.__HISTORIAS; if(!hs.length) return;
  hIdx = (i + hs.length) % hs.length;
  const pista = document.getElementById('carru-pista');
  if(pista) pista.style.transform = `translateX(-${hIdx*100}%)`;
  document.querySelectorAll('[data-hp]').forEach((b,j)=>b.classList.toggle('on', j===hIdx));
}

/* Avanza solo, pero se detiene si la persona está leyendo o interactuando:
   un carrusel que cambia mientras alguien lee es una molestia, no una ayuda. */
function reiniciarTimer(){
  clearInterval(hTimer);
  hTimer = setInterval(()=>{
    const c = document.getElementById('carru');
    if(!c || c.matches(':hover') || document.hidden) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    irHistoria(hIdx+1);
  }, 7000);
}

document.addEventListener('click', e=>{
  if(e.target.closest('#carru-ant')){ irHistoria(hIdx-1); reiniciarTimer(); return; }
  if(e.target.closest('#carru-sig')){ irHistoria(hIdx+1); reiniciarTimer(); return; }
  const p = e.target.closest('[data-hp]');
  if(p){ irHistoria(+p.dataset.hp); reiniciarTimer(); }
});

// deslizar con el dedo
(function(){
  const c = document.getElementById('carru'); if(!c) return;
  let x0 = null;
  c.addEventListener('touchstart', e=>{ x0 = e.touches[0].clientX; }, {passive:true});
  c.addEventListener('touchend', e=>{
    if(x0===null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx) > 45){ irHistoria(hIdx + (dx<0?1:-1)); reiniciarTimer(); }
    x0 = null;
  }, {passive:true});
})();

setTimeout(cargarHistorias, 900);

/* La foto se mueve más despacio que la página. Misma lógica que el otro hero:
   se apaga con prefers-reduced-motion y cuando la banda no está a la vista. */
(function(){
  const banda = document.getElementById('b-historias');
  const foto  = document.getElementById('h-foto');
  if(!banda || !foto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let pedido = false;
  function mover(){
    pedido = false;
    const r = banda.getBoundingClientRect();
    if(r.bottom < -120 || r.top > innerHeight + 120) return;
    const avance = (r.top + r.height/2 - innerHeight/2) / innerHeight;
    foto.style.transform = `translate3d(0, ${(avance*34).toFixed(1)}px, 0)`;
  }
  const pedir = ()=>{ if(!pedido){ pedido = true; requestAnimationFrame(mover); } };
  const cont = document.querySelector('#v-info') || window;
  cont.addEventListener('scroll', pedir, {passive:true});
  window.addEventListener('scroll', pedir, {passive:true});
  window.addEventListener('resize', pedir, {passive:true});
  setTimeout(mover, 300);
})();

/* ============================================================
   FONDOS QUE ROTAN
   ============================================================
   Dos capas por hero: una visible y otra que entra por debajo con un
   fundido. Cambia cada 10 s, se detiene si la pestaña no está a la vista
   y no corre con prefers-reduced-motion.
   ============================================================ */
const FOTOS = ['img/wck-1.jpg','img/wck-2.jpg','img/wck-3.jpg','img/wck-4.jpg'];

(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // precargar para que el fundido no muestre un hueco
  FOTOS.forEach(f=>{ const i = new Image(); i.src = f; });

  function rotar(el, arranque){
    if(!el) return;
    const padre = el.parentElement;
    // segunda capa, clonada de la primera para heredar filtro y posición
    const b = el.cloneNode(false);
    b.id = ''; b.style.opacity = '0';
    b.style.transition = 'opacity 1.1s ease';
    el.style.transition = 'opacity 1.1s ease';
    padre.insertBefore(b, el.nextSibling);

    let i = arranque % FOTOS.length, frente = el;
    b.style.backgroundImage = `url('${FOTOS[(i+1)%FOTOS.length]}')`;

    setInterval(()=>{
      if(document.hidden) return;
      const v = padre.getBoundingClientRect();
      if(v.bottom < 0 || v.top > innerHeight) return;   // fuera de pantalla: no gastar
      i = (i+1) % FOTOS.length;
      const atras = frente === el ? b : el;
      atras.style.backgroundImage = `url('${FOTOS[i]}')`;
      atras.style.opacity = '1';
      frente.style.opacity = '0';
      frente = atras;
      // la siguiente se deja lista en la capa que quedó atrás
      setTimeout(()=>{ (frente === el ? b : el)
        .style.backgroundImage = `url('${FOTOS[(i+1)%FOTOS.length]}')`; }, 1200);
    }, 10000);
  }

  rotar(document.getElementById('h-foto'), 0);
  rotar(document.querySelector('#heropx .px-foto'), 1);   // arranca en otra foto
})();
