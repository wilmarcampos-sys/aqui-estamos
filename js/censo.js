/* ============================================================
   Censo de necesidades (privado). Guarda identidad (nombre, cédula,
   teléfono, dirección) en la tabla `censo`, que es de SOLO ESCRITURA
   para la clave pública: se puede insertar pero nadie la lee desde el
   sitio. La lectura/exportación es solo por MCP (admin).
   Al mapa/Zonas va solo la vista anónima (necesidad + ubicación).
   ============================================================ */
const $ = s => document.querySelector(s);

const NECS = [
  {k:'agua',        t:'Agua potable'},
  {k:'alimentos',   t:'Alimentos'},
  {k:'medicamentos',t:'Medicamentos'},
  {k:'albergue',    t:'Albergue / techo'},
  {k:'aseo',        t:'Aseo e higiene'},
  {k:'ropa',        t:'Ropa y cobijas'},
  {k:'bebes',       t:'Bebés y pañales'},
  {k:'otra',        t:'Otra'},
];

const CONSENT = 'Autorizo a los coordinadores de Aquí Estamos a tratar mis datos '
  + '(nombre, cédula, teléfono y dirección) para coordinar y verificar la entrega de '
  + 'ayudas del terremoto de Pereira, y a compartirlos con las autoridades competentes '
  + 'para ese fin. Puedo pedir consultar, corregir o eliminar mis datos. (Ley 1581 de 2012)';

let LAT=null, LNG=null;
const val = id => (($('#'+id)||{}).value||'').trim();

function toast(m){ const e=$('#d-toast'); e.textContent=m; e.hidden=false; e.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(()=>{e.classList.remove('on'); setTimeout(()=>e.hidden=true,250);},2800); }

/* chips de necesidad */
$('#q-nec').innerHTML = NECS.map(n=>`<button type="button" class="cchip" data-k="${n.k}">${n.t}</button>`).join('');
$('#q-nec').addEventListener('click', e=>{ const b=e.target.closest('.cchip'); if(b) b.classList.toggle('on'); });

$('#q-consent-txt').textContent = CONSENT;

/* ubicación para el mapa */
$('#q-ubic').onclick = ()=>{
  if(!navigator.geolocation){ toast('Tu dispositivo no permite ubicación'); return; }
  const b=$('#q-ubic'); b.disabled=true; b.textContent='Tomando ubicación…';
  navigator.geolocation.getCurrentPosition(
    p=>{ LAT=p.coords.latitude; LNG=p.coords.longitude; b.classList.add('ok');
         b.textContent='Ubicación tomada ✓'; b.disabled=false; },
    ()=>{ b.disabled=false; b.textContent='Tomar mi ubicación para el mapa'; toast('No pudimos tomar la ubicación'); },
    {enableHighAccuracy:true, timeout:9000, maximumAge:60000}
  );
};

/* enviar */
$('#cform').addEventListener('submit', async e=>{
  e.preventDefault();
  const nombre=val('q-nombre'), cedula=val('q-cedula'), telRaw=val('q-tel'), dir=val('q-dir');
  const barrio=val('q-barrio'), detalle=val('q-detalle'), por=val('q-por');
  const personas=parseInt(val('q-personas'),10);
  const nec=[...document.querySelectorAll('#q-nec .cchip.on')].map(c=>c.dataset.k);
  const consent=$('#q-consent').checked;

  if(!nombre || !cedula || !telRaw || !dir){ toast('Completa nombre, cédula, teléfono y dirección.'); return; }
  if(!consent){ toast('Necesitamos tu autorización para registrar los datos.'); return; }

  const tel=telRaw.replace(/[^0-9]/g,'');
  const tel_e164 = (tel.length===10) ? '57'+tel : tel;
  const payload = {
    nombre, cedula, tel_e164, direccion:dir, barrio,
    personas: isNaN(personas)?null:personas,
    necesidades: nec, detalle,
    lat:LAT, lng:LNG,
    consentimiento:true,
    registrado_por: por || 'persona',
  };

  const btn=$('#q-enviar'); btn.disabled=true; const old=btn.textContent; btn.textContent='Registrando…';
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { error } = await db.from('censo').insert([payload]);
    if(error) throw error;
    $('#cform').hidden=true;
    const ok=$('#c-ok'); ok.hidden=false;
    ok.querySelector('.dw-mark').innerHTML =
      '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const v=$('.view.on'); if(v) v.scrollTop=0; window.scrollTo?.(0,0);
  }catch(err){ toast('No se pudo registrar. Revisa tu conexión e intenta de nuevo.'); btn.disabled=false; btn.textContent=old; }
});

if(typeof pintarVersion==='function') pintarVersion();
