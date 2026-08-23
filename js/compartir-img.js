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
  // en /reporte los datos ya vienen del censo; en el mapa se sacan de S
  if(typeof RES !== 'undefined' && RES){
    CIF.viviendas = RES.viviendas; CIF.personas = RES.personas;
    CIF.urgentes = RES.urgentes; CIF.menores = RES.menores;
    CIF.vulnerables = RES.vulnerables;
    if(typeof TOP !== 'undefined' && TOP.length)
      CIF.top = TOP.slice(0,6).map(([k,n])=>[(NEC[k]||[k])[0].replace(' / alimentos','')
        .replace('Subsidio de ','').replace('Carpas y cobijas','Carpas'), n]);
    return;
  }
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
let FOTOS_C = [];
function cargarFoto(){
  if(FOTOS_C.length) return Promise.resolve(FOTOS_C);
  const rutas = ['img/wck-1.jpg','img/wck-4.jpg'];
  return Promise.all(rutas.map(r=>new Promise(res=>{
    const im = new Image();
    im.onload = ()=>res(im); im.onerror = ()=>res(null);
    im.src = r;
  }))).then(ims=>{ FOTOS_C = ims; return ims; });
}
function dibujarCover(x, im, dx, dy, dw, dh){
  const ri = im.width/im.height, rd = dw/dh;
  let sw, sh, sx, sy;
  if(ri > rd){ sh = im.height; sw = sh*rd; sx = (im.width-sw)/2; sy = 0; }
  else { sw = im.width; sh = sw/rd; sx = 0; sy = (im.height-sh)*0.38; }
  x.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* Dibuja la tarjeta. `alto`: 1350 publicación, 1920 estado.
   Mismo lenguaje del reporte: foto a sangre arriba, cifras sobre papel,
   la historia sobre una segunda foto y el pie con quién sostiene el censo. */
function dibujarTarjeta(alto){
  const W = 1080, H = alto, M = 76;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const largo = H > 1500;

  x.fillStyle = '#F6F4F0'; x.fillRect(0,0,W,H);
  x.textBaseline = 'alphabetic';

  /* ---------- hero ---------- */
  const heroH = Math.round(H * (largo ? .34 : .32));
  if(FOTOS_C[0]) dibujarCover(x, FOTOS_C[0], 0, 0, W, heroH);
  else { x.fillStyle = '#0B1220'; x.fillRect(0,0,W,heroH); }
  let g = x.createLinearGradient(0,0,0,heroH);
  g.addColorStop(0,'rgba(8,14,24,.62)'); g.addColorStop(.4,'rgba(8,14,24,.26)');
  g.addColorStop(.8,'rgba(8,14,24,.86)'); g.addColorStop(1,'rgba(8,14,24,.98)');
  x.fillStyle = g; x.fillRect(0,0,W,heroH);
  // un velo lateral, como en la web, para que el titular no pelee con la foto
  g = x.createLinearGradient(0,0,W,0);
  g.addColorStop(0,'rgba(8,14,24,.68)'); g.addColorStop(.55,'rgba(8,14,24,.18)');
  g.addColorStop(1,'rgba(8,14,24,0)');
  x.fillStyle = g; x.fillRect(0,0,W,heroH);

  marcaHero(x, W - M, 62);

  x.fillStyle = '#fff'; x.font = '900 68px Inter, system-ui, sans-serif';
  x.fillText('Terremoto del', M, heroH-158);
  x.fillStyle = '#FF6B60';
  x.fillText('10 de agosto', M, heroH-84);
  x.fillStyle = 'rgba(255,255,255,.74)'; x.font = '600 25px Inter, system-ui, sans-serif';
  x.fillText('Pereira · Dosquebradas · La Virginia', M, heroH-38);
  x.fillStyle = 'rgba(255,255,255,.45)'; x.font = '600 16px Inter, system-ui, sans-serif';
  x.fillText('Foto: World Central Kitchen · CC BY 4.0', M, heroH-14);

  let y = heroH + 76;

  /* ---------- tres cifras del sismo ---------- */
  const cif = [['7.4','MAGNITUD','#C81E1E'], [SIS_MUERTOS,'FALLECIDOS','#141D29'],
               [SIS_VIVIENDAS,'VIVIENDAS AFECTADAS','#141D29']];
  const colX = [M, M+296, W-M-x.measureText('1.450').width-140];
  cif.forEach(([n,l,col],i)=>{
    x.fillStyle = col; x.font = '900 60px Inter, system-ui, sans-serif';
    x.fillText(n, colX[i], y);
    x.fillStyle = '#68738A'; x.font = '800 19px Inter, system-ui, sans-serif';
    x.fillText(l, colX[i], y+31);
  });
  y += 74;
  x.strokeStyle = '#DFE3EA'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(M,y); x.lineTo(W-M,y); x.stroke();
  y += 60;

  /* ---------- lo que piden ---------- */
  x.fillStyle = '#141D29'; x.font = '900 40px Inter, system-ui, sans-serif';
  x.fillText('Lo que piden hoy', M, y);
  x.fillStyle = '#68738A'; x.font = '600 23px Inter, system-ui, sans-serif';
  x.fillText(CIF.viviendas+' viviendas censadas · '+CIF.personas+' personas', M, y+34);
  y += 80;

  const lista = CIF.top.slice(0, largo ? 6 : 3);
  const max = lista[0] ? lista[0][1] : 1;
  const bx = M + 258, bw = W - M - 96 - bx;
  lista.forEach(([t,n],i)=>{
    x.fillStyle = '#141D29'; x.font = '700 26px Inter, system-ui, sans-serif';
    x.fillText(t, M, y+26);
    x.fillStyle = '#E7E3DD'; redondo(x, bx, y+5, bw, 26, 13); x.fill();
    const gg = x.createLinearGradient(bx,0,bx+bw,0);
    const tono = i<2 ? ['#B01717','#E8453C'] : i<4 ? ['#C98B22','#E8A33D'] : ['#7E889B','#A7B0BF'];
    gg.addColorStop(0,tono[0]); gg.addColorStop(1,tono[1]);
    x.fillStyle = gg; redondo(x, bx, y+5, Math.max(26, bw*(n/max)), 26, 13); x.fill();
    x.fillStyle = '#141D29'; x.font = '900 30px Inter, system-ui, sans-serif';
    const tw = x.measureText(String(n)).width;
    x.fillText(String(n), W - M - tw, y+29);
    y += 50;
  });

  /* ---------- la historia, sobre una segunda foto ---------- */
  const pieH = 176, tope = H - pieH;
  const hs = (typeof HIST !== 'undefined' && HIST.length) ? HIST
           : (window.__HISTORIAS || []);
  const h = hs.length ? hs[Math.floor(Math.random()*hs.length)] : null;
  const filaRiesgo = 92;
  let libre = tope - y - 30;
  const cajaMin = largo ? 260 : 150;
  if(h && libre >= cajaMin + filaRiesgo){
    y += 30;
    const cajaH = Math.min(largo ? 330 : 200, libre - filaRiesgo - 16);
    // banda a sangre, no una caja dentro de la tarjeta
    if(FOTOS_C[1]) dibujarCover(x, FOTOS_C[1], 0, y, W, cajaH);
    else { x.fillStyle = '#101A28'; x.fillRect(0,y,W,cajaH); }
    const gh = x.createLinearGradient(0,0,W,0);
    gh.addColorStop(0,'rgba(10,17,28,.96)'); gh.addColorStop(.62,'rgba(10,17,28,.86)');
    gh.addColorStop(1,'rgba(10,17,28,.55)');
    x.fillStyle = gh; x.fillRect(0,y,W,cajaH);

    // la caja del formato corto es más baja: tipografía y renglones más juntos
    const cuerpo = largo ? 30 : 26, salto = largo ? 42 : 36;
    const alto1 = largo ? 44 : 38, altoTx = largo ? 92 : 76, pie = largo ? 26 : 22;
    x.fillStyle = '#E8A33D'; x.font = '800 '+(largo?19:17)+'px Inter, system-ui, sans-serif';
    x.fillText('UNA DE ELLAS', M, y+alto1);
    x.fillStyle = '#fff'; x.font = '600 '+cuerpo+'px Inter, system-ui, sans-serif';
    const espacio = cajaH - altoTx - pie - 22;
    const lineas = Math.max(2, Math.floor(espacio/salto));
    envolver(x, h.historia, M, y+altoTx, W-M*2, salto, lineas);
    x.fillStyle = '#9FB0C6'; x.font = '700 '+(largo?20:18)+'px Inter, system-ui, sans-serif';
    const lugar = [...new Set([h.barrio,h.ciudad].filter(Boolean))].join(' · ') || 'Pereira';
    x.fillText(lugar, M, y+cajaH-pie);
    y += cajaH + 30;
  }

  /* ---------- riesgo, centrado en lo que sobre ---------- */
  libre = tope - y;
  if(libre > filaRiesgo) y += Math.min(46, (libre - filaRiesgo)/2);
  [[CIF.urgentes,'CASOS URGENTES','#C81E1E'],
   [CIF.menores,'MENORES DE 5','#B8790F'],
   [CIF.vulnerables,'HOGARES VULNERABLES','#6D4AA8']].forEach(([n,l,col],i)=>{
    const cx = M + i*(W-M*2)/3;
    x.fillStyle = col; x.font = '900 52px Inter, system-ui, sans-serif';
    x.fillText(String(n), cx, y+44);
    x.fillStyle = '#68738A'; x.font = '800 17px Inter, system-ui, sans-serif';
    x.fillText(l, cx, y+72);
  });

  /* ---------- pie ---------- */
  const pieY = H - pieH;
  x.fillStyle = '#101A28'; x.fillRect(0, pieY, W, pieH);
  x.fillStyle = '#fff'; x.font = '900 42px Inter, system-ui, sans-serif';
  x.fillText('aquiestamos.co', M, pieY+58);
  x.fillStyle = '#E8A33D'; x.font = '700 23px Inter, system-ui, sans-serif';
  x.fillText('Mira qué falta y dónde · Entrega directo a la familia', M, pieY+92);
  x.strokeStyle = 'rgba(255,255,255,.15)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(M, pieY+116); x.lineTo(W-M, pieY+116); x.stroke();
  x.fillStyle = '#8FA0B8'; x.font = '600 18px Inter, system-ui, sans-serif';
  x.fillText('Censo levantado en terreno por', M, pieY+143);
  x.fillStyle = '#fff'; x.font = '800 20px Inter, system-ui, sans-serif';
  x.fillText('Red de iglesias AMCER  ·  Asociación CREA', M, pieY+169);

  return c;
}

/* la marca arriba a la derecha, sin marco: igual que en la web */
function marcaHero(x, der, base){
  x.font = '900 27px Inter, system-ui, sans-serif';
  const t1 = 'Aquí ', t2 = 'Estamos';
  const w1 = x.measureText(t1).width, w2 = x.measureText(t2).width;
  const ix = der - (30 + 12 + w1 + w2);
  x.save();
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 12; x.shadowOffsetY = 2;
  dibujarMarca(x, ix, base-28, 30);
  x.fillStyle = '#fff';    x.fillText(t1, ix+30+12, base-4);
  x.fillStyle = '#F2B705'; x.fillText(t2, ix+30+12+w1, base-4);
  x.font = '700 15px Inter, system-ui, sans-serif';
  x.fillStyle = 'rgba(255,255,255,.72)';
  const d = 'aquiestamos.co', dw = x.measureText(d).width;
  x.fillText(d, der - dw, base+18);
  x.restore();
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
