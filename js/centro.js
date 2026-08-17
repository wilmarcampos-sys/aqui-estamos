/* ============================================================
   Registrar centro de acopio (auto-servicio). Bilingüe.
   Cualquiera puede proponer; entra como pendiente (activo=false)
   y un admin lo aprueba por MCP. En persona y/o por Amazon.
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const store=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const load =k =>{try{return localStorage.getItem(k);}catch(e){return null;}};

let LANG = load('ae_lang');
if(LANG!=='en' && LANG!=='es') LANG = (navigator.language||'').toLowerCase().startsWith('en') ? 'en' : 'es';
const t = o => (o && (o[LANG]||o.es)) || '';

const CT = {
  kick:   {es:'Sé parte de la ayuda', en:'Be part of the help'},
  titulo: {es:'Registra tu centro de acopio', en:'Register your drop-off center'},
  sub:    {es:'Recibe donaciones para Pereira en tu ciudad. Al enviar, revisamos y lo publicamos en el mapa de donantes.',
           en:'Receive donations for Pereira in your city. After you submit, we review it and publish it on the donor map.'},
  tipo:   {es:'¿Cómo reciben la ayuda?', en:'How will you receive help?'},
  m_persona:{es:'En persona', en:'In person'},
  m_amazon: {es:'Por Amazon', en:'Via Amazon'},
  m_ambos:  {es:'Ambos', en:'Both'},
  ciudad: {es:'Ciudad y estado', en:'City and state'},
  nombre: {es:'Nombre del centro (opcional)', en:'Center name (optional)'},
  h_nombre:{es:'Ej. "Casa de Ana", una iglesia, un negocio. Si lo dejas vacío usamos la ciudad.',
            en:'E.g. "Ana\'s house", a church, a business. If blank we use the city.'},
  coord:  {es:'Coordinador (nombre y apellido)', en:'Coordinator (full name)'},
  tel:    {es:'WhatsApp', en:'WhatsApp'},
  h_tel:  {es:'Con código de país. Ej: +1 305 000 0000', en:'With country code. E.g: +1 305 000 0000'},
  dir:    {es:'Dirección completa', en:'Full address'},
  h_dir:  {es:'Calle, ciudad, estado y ZIP — donde la gente lleva las cosas.', en:'Street, city, state and ZIP — where people drop things off.'},
  amz:    {es:'Link de tu lista de Amazon', en:'Your Amazon list link'},
  h_amz:  {es:'Wish List o Registro. Ponle una dirección de envío a la lista para que las compras te lleguen.',
           en:'Wish List or Registry. Add a shipping address to the list so purchases reach you.'},
  recibe: {es:'¿Qué reciben?', en:'What do you accept?'},
  cond:   {es:'¿Cómo debe llegar la ayuda?', en:'How should help arrive?'},
  h_cond: {es:'Tus reglas. Ej: clasificada y en cajas pequeñas, rotulada; sin agua a granel; sin ropa usada.',
           en:'Your rules. E.g: sorted and in small boxes, labeled; no bulk water; no used clothing.'},
  clasif: {es:'La ayuda debe llegar clasificada y en cajas pequeñas', en:'Help must arrive sorted and in small boxes'},
  hora:   {es:'Horario para recibir (opcional)', en:'Drop-off hours (optional)'},
  enviar: {es:'Registrar centro', en:'Register center'},
  privx:  {es:'Tus datos serán públicos en el mapa para que la gente sepa dónde llevar la ayuda.',
           en:'Your details will be public on the map so people know where to bring help.'},
  need:   {es:'Completa ciudad, coordinador y WhatsApp.', en:'Please fill city, coordinator and WhatsApp.'},
  need_dir:{es:'Falta la dirección para recibir en persona.', en:'Address is required for in-person drop-off.'},
  need_amz:{es:'Falta el link de tu lista de Amazon.', en:'Your Amazon list link is required.'},
  err:    {es:'No se pudo enviar. Revisa tu conexión e intenta de nuevo.', en:'Could not submit. Check your connection and try again.'},
  ok_t:   {es:'¡Gracias! Recibido', en:'Thank you! Received'},
  ok_p:   {es:'Revisamos tu centro y lo publicamos en el mapa muy pronto. Que Dios te bendiga.',
           en:'We will review your center and publish it on the map very soon. God bless you.'},
  ok_volver:{es:'Volver a donar', en:'Back to donate'},
  ph_ciudad:{es:'Ej. Miami, FL', en:'e.g. Miami, FL'},
  ph_nombre:{es:'Ej. Casa de Ana · Iglesia El Redentor', en:'e.g. Ana\'s house · Redeemer Church'},
  ph_coord: {es:'Ej. Ana María Restrepo', en:'e.g. Ana María Restrepo'},
  ph_tel:   {es:'+1 305 000 0000', en:'+1 305 000 0000'},
  ph_dir:   {es:'Calle, ciudad, estado y ZIP', en:'Street, city, state and ZIP'},
  ph_amz:   {es:'https://www.amazon.com/…', en:'https://www.amazon.com/…'},
  ph_cond:  {es:'Ej. Clasificada y en cajas pequeñas, rotulada por categoría. Sin agua a granel ni ropa usada.',
             en:'e.g. Sorted and in small boxes, labeled by category. No bulk water or used clothing.'},
  ph_hora:  {es:'Ej. Lun a Sáb, 9am–6pm', en:'e.g. Mon–Sat, 9am–6pm'},
};
const CATS = [
  {k:'medicamentos', es:'Medicamentos y primeros auxilios', en:'Medications & first aid'},
  {k:'higiene',      es:'Higiene y cuidado personal', en:'Hygiene & personal care'},
  {k:'herramientas', es:'Herramientas / respuesta', en:'Tools / response'},
  {k:'emergencia',   es:'Artículos de emergencia', en:'Emergency items'},
  {k:'medico',       es:'Equipo médico', en:'Medical equipment'},
];

let TIPO = 'persona';
const val = id => (($('#'+id)||{}).value||'').trim();

function pinta(){
  document.documentElement.lang = LANG;
  $('#c-kick').textContent = t(CT.kick);
  $('#c-titulo').textContent = t(CT.titulo);
  $('#c-sub').textContent = t(CT.sub);
  $('#l-tipo').textContent = t(CT.tipo);
  const seg=$('#c-tipo').children;
  seg[0].textContent=t(CT.m_persona); seg[1].textContent=t(CT.m_amazon); seg[2].textContent=t(CT.m_ambos);
  $('#l-ciudad').textContent=t(CT.ciudad); $('#l-nombre').textContent=t(CT.nombre); $('#h-nombre').textContent=t(CT.h_nombre);
  $('#l-coord').textContent=t(CT.coord); $('#l-tel').textContent=t(CT.tel); $('#h-tel').textContent=t(CT.h_tel);
  $('#l-dir').textContent=t(CT.dir);
  $('#l-amz').textContent=t(CT.amz); $('#h-amz').textContent=t(CT.h_amz);
  $('#l-recibe').textContent=t(CT.recibe); $('#l-cond').textContent=t(CT.cond); $('#h-cond').textContent=t(CT.h_cond);
  $('#l-clasif').textContent=t(CT.clasif); $('#l-hora').textContent=t(CT.hora);
  $('#c-enviar').textContent=t(CT.enviar); $('#c-privx').textContent=t(CT.privx);
  $('#ok-t').textContent=t(CT.ok_t); $('#ok-p').textContent=t(CT.ok_p); $('#ok-volver').textContent=t(CT.ok_volver);
  const ph=(id,txt)=>{const e=$('#'+id); if(e) e.placeholder=txt;};
  ph('c-ciudad',t(CT.ph_ciudad)); ph('c-nombre',t(CT.ph_nombre)); ph('c-coord',t(CT.ph_coord));
  ph('c-tel',t(CT.ph_tel)); ph('c-dir',t(CT.ph_dir)); ph('c-amz',t(CT.ph_amz));
  ph('c-cond',t(CT.ph_cond)); ph('c-hora',t(CT.ph_hora));
  $('#c-recibe').innerHTML = CATS.map(c=>`<button type="button" class="cchip" data-k="${c.k}">${esc(LANG==='en'?c.en:c.es)}</button>`).join('');
  document.querySelectorAll('#langtog button').forEach(b=>b.classList.toggle('on', b.dataset.l===LANG));
  aplicaTipo();
}
function aplicaTipo(){
  document.querySelectorAll('#c-tipo button').forEach(b=>b.classList.toggle('on', b.dataset.m===TIPO));
  $('#g-dir').hidden = (TIPO==='amazon');
  $('#g-amz').hidden = (TIPO==='persona');
}
function toast(m){ const e=$('#d-toast'); e.textContent=m; e.hidden=false; e.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(()=>{e.classList.remove('on'); setTimeout(()=>e.hidden=true,250);},2600); }

/* eventos */
document.querySelectorAll('#langtog button').forEach(b=>b.onclick=()=>{ LANG=b.dataset.l; store('ae_lang',LANG); pinta(); });
$('#c-tipo').addEventListener('click', e=>{ const b=e.target.closest('button[data-m]'); if(b){ TIPO=b.dataset.m; aplicaTipo(); } });
$('#c-recibe').addEventListener('click', e=>{ const b=e.target.closest('.cchip'); if(b) b.classList.toggle('on'); });

$('#cform').addEventListener('submit', async e=>{
  e.preventDefault();
  const ciudad=val('c-ciudad'), coord=val('c-coord'), telRaw=val('c-tel');
  const dir=val('c-dir'), amz=val('c-amz'), cond=val('c-cond'), hora=val('c-hora');
  const nombre = val('c-nombre') || ciudad;
  const tel = telRaw.replace(/[^0-9]/g,'');
  if(!ciudad || !coord || !tel){ toast(t(CT.need)); return; }
  if((TIPO==='persona'||TIPO==='ambos') && !dir){ toast(t(CT.need_dir)); return; }
  if((TIPO==='amazon'||TIPO==='ambos') && !amz){ toast(t(CT.need_amz)); return; }
  const acepta = [...document.querySelectorAll('#c-recibe .cchip.on')].map(c=>c.dataset.k);
  const tel_e164 = (tel.length===10) ? '1'+tel : tel;
  const payload = {
    nombre, ciudad, pais:'USA',
    direccion: (TIPO!=='amazon') ? dir : '',
    coordinador: coord, tel_e164,
    amazon_url: (TIPO!=='persona') ? amz : '',
    acepta,
    condiciones_es: cond, condiciones_en: cond,
    clasificar: $('#c-clasif').checked,
    horario: hora, tipo: TIPO, activo: false, orden: 99,
  };
  const btn=$('#c-enviar'); btn.disabled=true; const old=btn.textContent; btn.textContent='…';
  try{
    const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { error } = await db.from('centros_acopio').insert([payload]);
    if(error) throw error;
    $('#cform').hidden = true;
    const ok=$('#c-ok'); ok.hidden=false; ok.querySelector('.dw-mark').innerHTML =
      '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.7 8.9 2 5.5 5.2 5c1.9-.3 3.7.7 4.8 2.2C11.1 5.7 12.9 4.7 14.8 5 18 5.5 19.3 8.9 22 11.7 19.5 16.4 12 21 12 21z"/></svg>';
    window.scrollTo?.(0,0); const v=$('.view.on'); if(v) v.scrollTop=0;
  }catch(err){ toast(t(CT.err)); btn.disabled=false; btn.textContent=old; }
});

if(typeof pintarVersion==='function') pintarVersion();
pinta();
