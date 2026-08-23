/* ============================================================
   COMPARTIR: enlace e imágenes generadas en el momento
   ============================================================
   La imagen no es un archivo fijo: se dibuja aquí con las cifras de hoy,
   en el formato de cada red. Así lo que se comparte nunca está vencido.

     Instagram (feed)   1080 x 1350
     WhatsApp / estado  1080 x 1920

   Se dibuja en un canvas y se entrega por el menú de compartir del
   teléfono; si el navegador no lo permite, se descarga.
   ============================================================ */

const CIF = {
  // se rellenan con datos vivos al cargar; estos son el respaldo
  viviendas: 203, personas: 694, urgentes: 62, menores: 151, vulnerables: 58,
  top: [['Mercado',167],['Aseo e higiene',114],['Arriendo',82],['Agua',52],['Medicinas',34]],
};

function cifrasVivas(){
  try{
    const cs = (typeof S!=='undefined' && S.censo) ? S.censo : [];
    if(!cs.length) return;
    CIF.viviendas = cs.length;
    CIF.personas  = cs.reduce((a,c)=>a+(c.personas||0),0) || CIF.personas;
    CIF.urgentes  = cs.filter(c=>c.urg===3).length || CIF.urgentes;
    const men = cs.reduce((a,c)=>a+(c.men5||0),0);
    if(men) CIF.menores = men;
    const vul = cs.filter(c=>(c.cond||[]).length).length;
    if(vul) CIF.vulnerables = vul;
    const g = {};
    cs.forEach(c=>(c.needs||[]).forEach(k=>g[k]=(g[k]||0)+1));
    const N = {alimentos:'Mercado', aseo:'Aseo e higiene', arriendo:'Arriendo', agua:'Agua',
      medicamentos:'Medicinas', ropa:'Carpas y cobijas', bebes:'Pañales y bebés',
      utensilios:'Utensilios', materiales:'Materiales', movilidad:'Movilidad',
      transporte:'Transporte', servicios:'Servicios', albergue:'Albergue', estructural:'Evaluación'};
    const top = Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,n])=>[N[k]||k,n]);
    if(top.length) CIF.top = top;
  }catch(e){ /* con el respaldo alcanza */ }
}

/* --- utilidades de dibujo --- */
function txtCentro(x, y, t, ctx){ ctx.fillText(t, x - ctx.measureText(t).width/2, y); }
function envolver(ctx, t, x, y, ancho, alto){
  const pal = String(t).split(' '); let linea = '', yy = y;
  pal.forEach(p=>{
    const prueba = linea ? linea+' '+p : p;
    if(ctx.measureText(prueba).width > ancho && linea){ ctx.fillText(linea, x, yy); yy += alto; linea = p; }
    else linea = prueba;
  });
  if(linea) ctx.fillText(linea, x, yy);
  return yy + alto;
}

/* Dibuja la tarjeta. `alto` decide el formato: 1350 feed, 1920 estado. */
function dibujarTarjeta(alto){
  const W = 1080, H = alto, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const historia = H > 1500;   // en el formato alto cabe una historia

  // fondo
  x.fillStyle = '#F4F1EC'; x.fillRect(0,0,W,H);
  // franja superior: alta para que el titular quepa entero
  const banda = 320;
  x.fillStyle = '#C81E1E'; x.fillRect(0,0,W,banda);

  x.textBaseline = 'alphabetic';
  x.fillStyle = '#fff';
  x.font = '800 28px Inter, system-ui, sans-serif';
  x.fillText('EJE CAFETERO · COLOMBIA', 70, 96);
  x.font = '900 70px Inter, system-ui, sans-serif';
  x.fillText('Terremoto del', 70, 190);
  x.fillText('10 de agosto', 70, 262);

  let y = banda + 70;

  // cifras del sismo
  x.fillStyle = '#16202E';
  x.font = '900 120px Inter, system-ui, sans-serif';
  x.fillText('7.4', 70, y+40);
  x.fillStyle = '#6B7688';
  x.font = '700 26px Inter, system-ui, sans-serif';
  x.fillText('MAGNITUD', 70, y+80);
  x.fillStyle = '#16202E';
  x.font = '900 72px Inter, system-ui, sans-serif';
  x.fillText('321', 330, y+40);
  x.fillStyle = '#6B7688'; x.font = '700 26px Inter, system-ui, sans-serif';
  x.fillText('FALLECIDOS', 330, y+80);
  x.fillStyle = '#16202E'; x.font = '900 72px Inter, system-ui, sans-serif';
  x.fillText('1.450', 620, y+40);
  x.fillStyle = '#6B7688'; x.font = '700 26px Inter, system-ui, sans-serif';
  x.fillText('VIVIENDAS AFECTADAS', 620, y+80);

  y += 150;
  x.strokeStyle = '#DFE3EA'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(70,y); x.lineTo(W-70,y); x.stroke();
  y += 62;

  // lo que piden
  x.fillStyle = '#16202E'; x.font = '900 44px Inter, system-ui, sans-serif';
  x.fillText('Lo que piden hoy', 70, y);
  x.fillStyle = '#6B7688'; x.font = '600 26px Inter, system-ui, sans-serif';
  x.fillText(CIF.viviendas+' viviendas censadas · '+CIF.personas+' personas', 70, y+40);
  y += 92;

  const max = CIF.top[0] ? CIF.top[0][1] : 1;
  CIF.top.forEach(([t,n])=>{
    x.fillStyle = '#16202E'; x.font = '700 30px Inter, system-ui, sans-serif';
    x.fillText(t, 70, y+30);
    const bx = 430, bw = W-70-bx;
    x.fillStyle = '#E6E3DE'; x.fillRect(bx, y+6, bw, 32);
    x.fillStyle = '#C81E1E'; x.fillRect(bx, y+6, Math.max(24, bw*(n/max)), 32);
    x.fillStyle = '#16202E'; x.font = '900 34px Inter, system-ui, sans-serif';
    x.fillText(String(n), bx + bw + 10 - x.measureText(String(n)).width, y+36);
    y += 58;
  });

  // una historia real, en el formato alto
  if(historia && window.__HISTORIAS && window.__HISTORIAS.length){
    const h = window.__HISTORIAS[Math.floor(Math.random()*window.__HISTORIAS.length)];
    y += 34;
    x.fillStyle = '#fff';
    const cajaY = y, cajaH = 300;
    x.fillRect(70, cajaY, W-140, cajaH);
    x.fillStyle = '#C81E1E'; x.fillRect(70, cajaY, 8, cajaH);
    x.fillStyle = '#6B7688'; x.font = '800 24px Inter, system-ui, sans-serif';
    x.fillText('UNA DE ELLAS', 106, cajaY+50);
    x.fillStyle = '#16202E'; x.font = '600 30px Inter, system-ui, sans-serif';
    const fin = envolver(x, h.historia, 106, cajaY+100, W-250, 42);
    x.fillStyle = '#C81E1E'; x.font = '800 26px Inter, system-ui, sans-serif';
    x.fillText([h.barrio, h.ciudad].filter(Boolean).join(' · ') || 'Pereira', 106, Math.min(fin+16, cajaY+cajaH-30));
    y = cajaY + cajaH + 20;
  }

  // en el formato alto sobra sitio: se aprovecha para el dato que más pesa
  if(historia){
    const libre = (H - 150) - y;
    if(libre > 170){
      y += 20;
      x.fillStyle = '#16202E';
      x.font = '900 64px Inter, system-ui, sans-serif';
      x.fillText(String(CIF.urgentes), 70, y+50);
      x.fillText(String(CIF.menores), 400, y+50);
      x.fillText(String(CIF.vulnerables), 730, y+50);
      x.fillStyle = '#6B7688'; x.font = '700 24px Inter, system-ui, sans-serif';
      x.fillText('CASOS URGENTES', 70, y+88);
      x.fillText('MENORES DE 5', 400, y+88);
      x.fillText('HOGARES VULNERABLES', 730, y+88);
      y += 130;
    }
  }

  // pie con la marca
  const pieY = H - 150;
  x.fillStyle = '#16202E'; x.fillRect(0, pieY, W, 150);
  x.fillStyle = '#fff'; x.font = '900 46px Inter, system-ui, sans-serif';
  x.fillText('aquiestamos.co', 70, pieY+70);
  x.fillStyle = '#E8A33D'; x.font = '700 28px Inter, system-ui, sans-serif';
  x.fillText('Mira qué falta y dónde · Entrega directo a la familia', 70, pieY+112);

  return c;
}

function canvasABlob(c){
  return new Promise(r=>c.toBlob(b=>r(b), 'image/png', 0.94));
}

async function compartirImagen(formato){
  const msg = document.getElementById('sh-msg');
  if(msg) msg.textContent = 'Preparando la imagen…';
  cifrasVivas();
  const alto = formato === 'ig' ? 1350 : 1920;
  const canvas = dibujarTarjeta(alto);
  const blob = await canvasABlob(canvas);
  const nombre = 'aqui-estamos-'+(formato==='ig'?'instagram':'whatsapp')+'.png';
  const file = new File([blob], nombre, {type:'image/png'});

  // el menú del teléfono es lo que permite pasar a WhatsApp o Instagram
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file],
        title:'Aquí Estamos · Pereira',
        text:'Así va la emergencia y esto es lo que piden las familias. aquiestamos.co'});
      if(msg) msg.textContent = '';
      return;
    }catch(e){ if(e && e.name==='AbortError'){ if(msg) msg.textContent=''; return; } }
  }
  // sin menú de compartir: se descarga y la persona la sube
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  URL.revokeObjectURL(a.href);
  if(msg) msg.textContent = 'Imagen descargada: súbela a '+(formato==='ig'?'Instagram':'WhatsApp')+'.';
}

async function compartirEnlace(){
  const msg = document.getElementById('sh-msg');
  const datos = {title:'Aquí Estamos · Pereira',
    text:'Mira qué falta y dónde tras el terremoto. Puedes ayudar directo a una familia.',
    url:'https://aquiestamos.co/'};
  if(navigator.share){
    try{ await navigator.share(datos); if(msg) msg.textContent=''; return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(datos.url);
    if(msg) msg.textContent = 'Enlace copiado: aquiestamos.co';
  }catch(e){ if(msg) msg.textContent = 'Comparte este enlace: aquiestamos.co'; }
}

document.addEventListener('click', e=>{
  if(e.target.closest('#sh-link')) return compartirEnlace();
  if(e.target.closest('#sh-ig'))   return compartirImagen('ig');
  if(e.target.closest('#sh-wa'))   return compartirImagen('wa');
});

/* El fondo se mueve más despacio que la página: da profundidad sin robar
   atención. Se apaga con prefers-reduced-motion y cuando no está a la vista. */
(function(){
  const caja = document.getElementById('heropx');
  if(!caja) return;
  const foto = caja.querySelector('.px-foto');
  if(!foto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let pedido = false;
  const cont = document.querySelector('#v-zonas') || window;
  function mover(){
    pedido = false;
    const r = caja.getBoundingClientRect();
    if(r.bottom < -100 || r.top > innerHeight + 100) return;
    const avance = (r.top + r.height/2 - innerHeight/2) / innerHeight;  // -1 … 1
    foto.style.transform = `translate3d(0, ${(avance*26).toFixed(1)}px, 0)`;
  }
  const pedir = ()=>{ if(!pedido){ pedido = true; requestAnimationFrame(mover); } };
  (cont.addEventListener ? cont : window).addEventListener('scroll', pedir, {passive:true});
  window.addEventListener('resize', pedir, {passive:true});
  mover();
})();
