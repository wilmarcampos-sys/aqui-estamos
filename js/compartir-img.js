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

const SIS_MUERTOS = '321', SIS_VIVIENDAS = '1.450';

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
function envolver(ctx, t, x, y, ancho, alto, maxLineas){
  const pal = String(t).split(' '); const lineas = [];
  let linea = '';
  pal.forEach(p=>{
    const prueba = linea ? linea+' '+p : p;
    if(ctx.measureText(prueba).width > ancho && linea){ lineas.push(linea); linea = p; }
    else linea = prueba;
  });
  if(linea) lineas.push(linea);
  const usar = maxLineas ? lineas.slice(0, maxLineas) : lineas;
  if(maxLineas && lineas.length > maxLineas) usar[usar.length-1] = usar[usar.length-1].replace(/[.,;]?$/,'…');
  usar.forEach((l,i)=>ctx.fillText(l, x, y + i*alto));
  return y + usar.length*alto;
}
function redondo(x, rx, ry, w, h, r){
  x.beginPath();
  x.moveTo(rx+r, ry); x.arcTo(rx+w, ry, rx+w, ry+h, r);
  x.arcTo(rx+w, ry+h, rx, ry+h, r); x.arcTo(rx, ry+h, rx, ry, r);
  x.arcTo(rx, ry, rx+w, ry, r); x.closePath();
}

/* El pin de la marca, dibujado a mano: dos mitades de color y las dos manos
   que se encuentran. Mismo dibujo del sitio, en coordenadas de 24 px. */
function dibujarMarca(x, cx, cy, tam){
  const k = tam/24;
  x.save(); x.translate(cx, cy); x.scale(k,k);
  x.beginPath();
  x.moveTo(12,1.6);
  x.bezierCurveTo(7.4,1.6,3.7,5.3,3.7,9.9);
  x.bezierCurveTo(3.7,15.8,12,22.4,12,22.4);
  x.bezierCurveTo(12,22.4,20.3,15.8,20.3,9.9);
  x.bezierCurveTo(20.3,5.3,16.6,1.6,12,1.6);
  x.closePath(); x.clip();
  x.fillStyle = '#F2B705'; x.fillRect(0,0,12,24);
  x.fillStyle = '#D62828'; x.fillRect(12,0,12,24);
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(5.9,9.1); x.lineTo(12.3,9.1);
  x.arc(12.3,10.45,1.35,-Math.PI/2,Math.PI/2); x.lineTo(5.9,11.8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(18.1,12.2); x.lineTo(11.7,12.2);
  x.arc(11.7,13.55,1.35,Math.PI/2,-Math.PI/2); x.lineTo(18.1,14.9); x.closePath(); x.fill();
  x.restore();
}

/* La foto se carga una vez y se reutiliza en cada imagen. */
let FOTO = null;
function cargarFoto(){
  if(FOTO) return Promise.resolve(FOTO);
  return new Promise(res=>{
    const im = new Image();
    im.onload = ()=>{ FOTO = im; res(im); };
    im.onerror = ()=>res(null);
    im.src = 'img/wck-1.jpg';
  });
}
function dibujarCover(x, im, dx, dy, dw, dh){
  const ri = im.width/im.height, rd = dw/dh;
  let sw, sh, sx, sy;
  if(ri > rd){ sh = im.height; sw = sh*rd; sx = (im.width-sw)/2; sy = 0; }
  else { sw = im.width; sh = sw/rd; sx = 0; sy = (im.height-sh)*0.38; }
  x.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* Dibuja la tarjeta. `alto`: 1350 publicación, 1920 estado. */
function dibujarTarjeta(alto){
  const W = 1080, H = alto, M = 72;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const largo = H > 1500;

  x.fillStyle = '#F6F4F0'; x.fillRect(0,0,W,H);
  x.textBaseline = 'alphabetic';

  /* ---- hero fotográfico ---- */
  const heroH = largo ? 560 : 470;
  if(FOTO) dibujarCover(x, FOTO, 0, 0, W, heroH);
  else { x.fillStyle = '#0B1220'; x.fillRect(0,0,W,heroH); }
  const g = x.createLinearGradient(0,0,0,heroH);
  g.addColorStop(0,'rgba(8,14,24,.55)'); g.addColorStop(.42,'rgba(8,14,24,.28)');
  g.addColorStop(.82,'rgba(8,14,24,.88)'); g.addColorStop(1,'rgba(8,14,24,.97)');
  x.fillStyle = g; x.fillRect(0,0,W,heroH);

  x.fillStyle = '#fff';
  x.font = '900 66px Inter, system-ui, sans-serif';
  x.fillText('Terremoto del', M, heroH-176);
  x.fillStyle = '#FF6B60';
  x.fillText('10 de agosto', M, heroH-104);
  x.fillStyle = 'rgba(255,255,255,.72)';
  x.font = '600 24px Inter, system-ui, sans-serif';
  x.fillText('Pereira · Dosquebradas · La Virginia', M, heroH-52);
  x.fillStyle = 'rgba(255,255,255,.5)';
  x.font = '600 17px Inter, system-ui, sans-serif';
  x.fillText('Foto: World Central Kitchen · CC BY 4.0', M, heroH-20);

  // marca arriba a la derecha: pin al borde y el nombre a su izquierda
  const pinT = 40, pinX = W - M - pinT, pinY = 44;
  dibujarMarca(x, pinX, pinY, pinT);
  x.font = '900 28px Inter, system-ui, sans-serif';
  const t1 = 'Aquí ', t2 = 'Estamos';
  const w1 = x.measureText(t1).width, w2 = x.measureText(t2).width;
  const baseY = pinY + 28, ini = pinX - 14 - (w1 + w2);
  x.fillStyle = '#fff';    x.fillText(t1, ini, baseY);
  x.fillStyle = '#E8A33D'; x.fillText(t2, ini + w1, baseY);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 16px Inter, system-ui, sans-serif';
  const wu = x.measureText('aquiestamos.co').width;
  x.fillText('aquiestamos.co', pinX - 14 - wu, baseY + 24);

  let y = heroH + 74;

  /* ---- tres cifras del sismo ---- */
  const cifras = [['7.4','MAGNITUD'], [SIS_MUERTOS,'FALLECIDOS'], [SIS_VIVIENDAS,'VIVIENDAS AFECTADAS']];
  const colX = [M, M+300, M+620];
  cifras.forEach(([n,l],i)=>{
    x.fillStyle = '#141D29'; x.font = '900 62px Inter, system-ui, sans-serif';
    x.fillText(n, colX[i], y);
    x.fillStyle = '#68738A'; x.font = '800 20px Inter, system-ui, sans-serif';
    x.fillText(l, colX[i], y+32);
  });
  y += 78;
  x.strokeStyle = '#E2E5EA'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(M,y); x.lineTo(W-M,y); x.stroke();
  y += 62;

  /* ---- lo que piden ---- */
  x.fillStyle = '#141D29'; x.font = '900 42px Inter, system-ui, sans-serif';
  x.fillText('Lo que piden hoy', M, y);
  x.fillStyle = '#68738A'; x.font = '600 24px Inter, system-ui, sans-serif';
  x.fillText(CIF.viviendas+' viviendas censadas · '+CIF.personas+' personas', M, y+36);
  y += 84;

  const cuantas = largo ? 6 : 4;
  const lista = CIF.top.slice(0, cuantas);
  const max = lista[0] ? lista[0][1] : 1;
  const etW = 250, numW = 84, bx = M + etW + 18;
  const bw = W - M - numW - 12 - bx;
  lista.forEach(([t,n],i)=>{
    x.fillStyle = '#141D29'; x.font = '700 27px Inter, system-ui, sans-serif';
    x.fillText(t, M, y+27);
    x.fillStyle = '#EAE7E2'; redondo(x, bx, y+6, bw, 28, 6); x.fill();
    const gg = x.createLinearGradient(bx,0,bx+bw,0);
    const tono = i<2 ? ['#B01717','#E8453C'] : i<4 ? ['#C98B22','#E8A33D'] : ['#7E889B','#A7B0BF'];
    gg.addColorStop(0,tono[0]); gg.addColorStop(1,tono[1]);
    x.fillStyle = gg; redondo(x, bx, y+6, Math.max(26, bw*(n/max)), 28, 6); x.fill();
    x.fillStyle = '#141D29'; x.font = '900 31px Inter, system-ui, sans-serif';
    const tw = x.measureText(String(n)).width;
    x.fillText(String(n), W - M - tw, y+31);
    y += 52;
  });

  /* ---- una historia real, si cabe sin pisar el pie ---- */
  const pieH0 = 190;
  const h = (window.__HISTORIAS && window.__HISTORIAS.length)
    ? window.__HISTORIAS[Math.floor(Math.random()*window.__HISTORIAS.length)] : null;
  const filaRiesgo = 96;
  let libre = (H - pieH0 - 34) - y;          // lo que queda antes del pie
  const cajaIdeal = largo ? 250 : 210;
  const cabeHistoria = h && libre >= cajaIdeal + filaRiesgo + 60;
  if(cabeHistoria){
    y += 30;
    const cajaH = Math.min(cajaIdeal, libre - filaRiesgo - 40);
    x.fillStyle = '#101A28'; redondo(x, M, y, W-M*2, cajaH, 18); x.fill();
    x.fillStyle = '#E8A33D'; x.font = '800 20px Inter, system-ui, sans-serif';
    x.fillText('UNA DE ELLAS', M+30, y+46);
    x.fillStyle = '#EEF2F8'; x.font = '600 29px Inter, system-ui, sans-serif';
    envolver(x, h.historia, M+30, y+92, W-M*2-60, 40, Math.max(2, Math.floor((cajaH-130)/40)));
    x.fillStyle = '#93A3BD'; x.font = '700 21px Inter, system-ui, sans-serif';
    const lugar = [...new Set([h.barrio,h.ciudad].filter(Boolean))].join(' · ') || 'Pereira';
    x.fillText(lugar, M+30, y+cajaH-26);
    y += cajaH + 34;
  }

  /* ---- quiénes están en riesgo: centrado en el aire que sobre ---- */
  libre = (H - pieH0) - y;
  if(libre > filaRiesgo) y += Math.min(40, (libre - filaRiesgo)/2);
  const rz = [[CIF.urgentes,'CASOS URGENTES','#C81E1E'],
              [CIF.menores,'MENORES DE 5','#B8790F'],
              [CIF.vulnerables,'HOGARES VULNERABLES','#6D4AA8']];
  rz.forEach(([n,l,col],i)=>{
    const cx = M + i*(W-M*2)/3;
    x.fillStyle = col; x.font = '900 54px Inter, system-ui, sans-serif';
    x.fillText(String(n), cx, y+46);
    x.fillStyle = '#68738A'; x.font = '800 18px Inter, system-ui, sans-serif';
    x.fillText(l, cx, y+76);
  });

  /* ---- pie: marca e instituciones ---- */
  const pieH = 190, pieY = H - pieH;
  x.fillStyle = '#101A28'; x.fillRect(0, pieY, W, pieH);
  x.fillStyle = '#fff'; x.font = '900 44px Inter, system-ui, sans-serif';
  x.fillText('aquiestamos.co', M, pieY+62);
  x.fillStyle = '#E8A33D'; x.font = '700 24px Inter, system-ui, sans-serif';
  x.fillText('Mira qué falta y dónde · Entrega directo a la familia', M, pieY+98);
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(M, pieY+124); x.lineTo(W-M, pieY+124); x.stroke();
  x.fillStyle = '#8FA0B8'; x.font = '600 19px Inter, system-ui, sans-serif';
  x.fillText('Censo levantado en terreno por', M, pieY+152);
  x.fillStyle = '#fff'; x.font = '800 21px Inter, system-ui, sans-serif';
  x.fillText('Red de iglesias AMCER  ·  Asociación CREA', M, pieY+180);

  return c;
}

function canvasABlob(c){
  return new Promise(r=>c.toBlob(b=>r(b), 'image/png', 0.94));
}

async function compartirImagen(formato){
  const msg = document.getElementById('sh-msg');
  if(msg) msg.textContent = 'Preparando la imagen…';
  cifrasVivas();
  await cargarFoto();
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
    url:'https://aquiestamos.co/reporte'};
  if(navigator.share){
    try{ await navigator.share(datos); if(msg) msg.textContent=''; return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(datos.url);
    if(msg) msg.textContent = 'Enlace copiado: aquiestamos.co/reporte';
  }catch(e){ if(msg) msg.textContent = 'Comparte este enlace: aquiestamos.co/reporte'; }
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
