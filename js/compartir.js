/* ============================================================
   Compartir centro: arma una imagen (QR + link + datos del centro)
   para mandar por mensaje. El QR apunta a la lista de Amazon del
   centro; quien la escanea dona y llega directo ahí.
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s??'');

let LISTA = [], SEL = null;

function toast(m){ const e=$('#d-toast'); e.textContent=m; e.hidden=false; e.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(()=>{e.classList.remove('on'); setTimeout(()=>e.hidden=true,250);},2200); }

/* ---- cargar centros con lista de Amazon ---- */
async function cargar(){
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data, error } = await db.from('centros_acopio').select('*').eq('activo',true).order('orden').order('creado');
    if(error) throw error;
    LISTA = (data||[]).filter(c=>c.amazon_url);
  }catch(e){ LISTA=[]; }
  const sel = $('#c-sel');
  if(!LISTA.length){ sel.innerHTML='<option>No hay centros con lista de Amazon</option>'; $('#c-noamz').hidden=false; return; }
  sel.innerHTML = LISTA.map((c,i)=>`<option value="${i}">${esc(c.nombre)}${c.ciudad?' · '+esc(c.ciudad):''}</option>`).join('');
  sel.onchange = ()=>elegir(LISTA[+sel.value]);
  // centro pre-seleccionado desde el link (?c=<id>)
  let start = 0;
  try{ const pre = new URLSearchParams(location.search).get('c');
       if(pre){ const i = LISTA.findIndex(c=>c.id===pre); if(i>=0) start=i; } }catch(e){}
  sel.value = start;
  elegir(LISTA[start]);
}
function elegir(c){ SEL=c; dibujar(c); $('#c-prevwrap').hidden=false; $('#c-btns').hidden=false; $('#c-noamz').hidden=true; }

/* ---- QR sobre el canvas ---- */
function drawQR(x, url, ox, oy, size){
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), cell = size / n;
  x.fillStyle = '#ffffff'; x.fillRect(ox-26, oy-26, size+52, size+52);
  x.fillStyle = '#111111';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c))
    x.fillRect(Math.floor(ox+c*cell), Math.floor(oy+r*cell), Math.ceil(cell), Math.ceil(cell));
}
function wrap(x, txt, ox, oy, maxW, lh){
  const words = String(txt).split(' '); let line='', y=oy;
  for(const w of words){ const t=line?line+' '+w:w;
    if(x.measureText(t).width>maxW && line){ x.fillText(line, ox, y); line=w; y+=lh; } else line=t; }
  if(line) x.fillText(line, ox, y); return y;
}

/* ---- tarjeta para compartir ---- */
function dibujar(c){
  const cv=$('#c-canvas'), W=1080, H=1350; cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  x.fillStyle='#ffffff'; x.fillRect(0,0,W,H);
  const g=x.createLinearGradient(0,0,W,0); g.addColorStop(0,'#F2B705'); g.addColorStop(.55,'#F97316'); g.addColorStop(1,'#D62828');
  x.fillStyle=g; x.fillRect(0,0,W,18);
  x.textAlign='left'; x.textBaseline='alphabetic';
  const F='system-ui,-apple-system,"Segoe UI",Arial';
  x.fillStyle='#0e1729'; x.font=`800 46px ${F}`; x.fillText('Aquí Estamos', 70, 110);
  x.fillStyle='#8a97a8'; x.font=`600 26px ${F}`; x.fillText('aquiestamos.co/donar', 70, 148);
  x.fillStyle='#D62828'; x.font=`800 34px ${F}`; x.fillText('DONA PARA PEREIRA', 70, 220);
  x.fillStyle='#0e1729'; x.font=`800 58px ${F}`; x.fillText('Centro: '+c.nombre, 70, 296);
  x.fillStyle='#334155'; x.font=`400 28px ${F}`; let ay=340;
  if(c.ciudad){ x.fillText(c.ciudad+(c.pais?' · '+c.pais:''), 70, ay); ay+=42; }
  if(c.coordinador){ x.fillStyle='#7c3aed'; x.font=`800 32px ${F}`; x.fillText('Coordina: '+c.coordinador, 70, ay); ay+=44; x.fillStyle='#334155'; x.font=`400 28px ${F}`; }
  if(c.direccion){ ay = wrap(x, c.direccion, 70, ay, W-140, 36)+8; }
  const qs=600, qx=(W-qs)/2, qy=Math.max(470, ay+30);
  drawQR(x, c.amazon_url, qx, qy, qs);
  x.textAlign='center';
  x.fillStyle='#0e1729'; x.font=`800 44px ${F}`; x.fillText('Escanea para donar por Amazon', W/2, qy+qs+82);
  x.fillStyle='#475569'; x.font=`400 27px ${F}`; x.fillText('Tu compra llega directo a este centro', W/2, qy+qs+126);
  x.fillStyle='#8a97a8'; x.font=`600 24px ${F}`; x.fillText('aquiestamos.co/donar', W/2, H-52);
  x.textAlign='left';
}

/* ---- compartir / descargar / copiar ---- */
function bajar(blob){ const u=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=u; a.download='centro-'+(SEL&&SEL.nombre?SEL.nombre.replace(/\s+/g,'-'):'amazon')+'.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); }

$('#c-share').onclick = ()=>{
  $('#c-canvas').toBlob(async blob=>{
    if(!blob) return;
    const file = new File([blob], 'centro-pereira.png', {type:'image/png'});
    const txt = `Dona para Pereira en el centro ${SEL.nombre}. Escanea el QR o entra: ${SEL.amazon_url}`;
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title:'Dona para Pereira', text:txt}); return; }catch(e){ if(e&&e.name==='AbortError') return; }
    }
    bajar(blob); toast('Imagen descargada para compartir.');
  }, 'image/png');
};
$('#c-dl').onclick = ()=>$('#c-canvas').toBlob(b=>{ if(b){ bajar(b); toast('Imagen descargada.'); } }, 'image/png');
$('#c-copy').onclick = async ()=>{ try{ await navigator.clipboard.writeText(SEL.amazon_url); toast('Link copiado.'); }
  catch(e){ toast('Copia el link a mano.'); } };

if(typeof pintarVersion==='function') pintarVersion();
cargar();
