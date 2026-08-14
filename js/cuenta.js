/* ============================================================
   AQUÍ ESTAMOS · cuenta con celular y PIN
   ------------------------------------------------------------
   La persona no necesita correo ni contraseña larga. Su cuenta es
   su celular y un PIN de 4 dígitos que ella misma escoge. Con eso
   vuelve a entrar desde cualquier teléfono y arregla lo suyo sin
   tener que pedirle permiso a nadie.

   El PIN nunca viaja ni se guarda como texto: el servidor lo cifra.
   Ni el administrador puede verlo.
   ============================================================ */

const SESION_K = 'ae_sesion_v1';
let YO = null;          // {token, tel, nombre, foto, zonas:[]}

/* ---------- la sesión vive en el teléfono ---------- */
function sesionLeer(){
  try{ return JSON.parse(localStorage.getItem(SESION_K) || 'null'); }catch(e){ return null; }
}
function sesionGuardar(o){
  try{ localStorage.setItem(SESION_K, JSON.stringify(o)); }catch(e){}
}
function sesionBorrar(){
  try{ localStorage.removeItem(SESION_K); }catch(e){}
  YO = null;
}

/* ---------- hablar con el servidor ---------- */
async function rpc(fn, args){
  if(!EN_LINEA) return {ok:false, error:'Sin señal. Inténtelo cuando vuelva la conexión.'};
  try{
    const {data, error} = await db.rpc(fn, args);
    if(error) return {ok:false, error: error.message || 'No se pudo conectar.'};
    return data || {ok:false, error:'El servidor no respondió.'};
  }catch(e){
    return {ok:false, error:'No se pudo conectar. Revise la señal.'};
  }
}

/* Trae lo mío desde el servidor. Si la sesión venció, la borra en silencio. */
async function yoCargar(){
  const s = sesionLeer();
  if(!s || !s.token){ YO = null; return null; }
  const r = await rpc('ae_mis_datos', {p_token: s.token});
  if(!r.ok){
    if(/vencid/i.test(r.error||'')) sesionBorrar();
    return null;
  }
  YO = {token:s.token, tel:r.cuenta.tel, nombre:r.cuenta.nombre,
        foto:r.cuenta.foto || '', zonas:r.zonas || []};
  return YO;
}

/* Después de crear cuenta o entrar: guardar sesión y refrescar */
async function sesionAbrir(r){
  sesionGuardar({token:r.token, tel:r.tel});
  await yoCargar();
  if(typeof render === 'function') render();
}

/* ============================================================
   PIEZAS DE FORMULARIO
   El +57 va FUERA del campo, como etiqueta fija. Así es imposible
   escribirlo dos veces: ese fue el bug que dejó números mezclados.
   ============================================================ */
function campoTel(id, label, ayuda){
  return `
    <label class="f" for="${id}">${label}</label>
    <div class="telbox">
      <span class="telpre">+57</span>
      <input id="${id}" class="telnum" type="tel" inputmode="numeric"
             maxlength="14" placeholder="300 000 0000" autocomplete="off">
    </div>
    <div class="telhint" id="${id}-h">${ayuda || 'Diez dígitos, empieza por 3.'}</div>`;
}

/* Formatea 300 000 0000 mientras escribe.
   Si de todos modos vuelve a teclear el 57 (pasa, y mucho), aquí se descarta:
   el prefijo ya está afuera del campo, así que adentro solo caben 10 dígitos. */
function telCampo10(v){
  let d = String(v||'').replace(/\D/g,'');
  if(d.startsWith('00')) d = d.slice(2);
  // Ningún celular colombiano empieza por 57: si aparece, es el indicativo
  // repetido y sobra. Se quita de una, no cuando ya sea tarde.
  while(d.startsWith('57')) d = d.slice(2);
  d = d.slice(0, 10);
  if(!d.length) return '';
  let out = d.slice(0,3);
  if(d.length > 3) out += ' ' + d.slice(3,6);
  if(d.length > 6) out += ' ' + d.slice(6,10);
  return out;
}
function telVivo(id, alCambiar){
  const el = $('#'+id); if(!el) return;
  el.oninput = ()=>{
    const fin = el.selectionStart === el.value.length;
    el.value = telCampo10(el.value);
    if(fin) el.setSelectionRange(el.value.length, el.value.length);
    if(alCambiar) alCambiar();
  };
  el.onblur = ()=>{ el.value = telCampo10(el.value); if(alCambiar) alCambiar(); };
}
const telCrudo = id => ($('#'+id) ? $('#'+id).value.replace(/\D/g,'').slice(0,10) : '');
const telOK    = d  => d.length === 10 && d[0] === '3';

function campoPin(id, label, ayuda){
  return `
    <label class="f" for="${id}">${label}</label>
    <input id="${id}" class="pin" type="password" inputmode="numeric"
           maxlength="6" placeholder="••••" autocomplete="off">
    <div class="telhint" id="${id}-h">${ayuda || 'Cuatro números. No use su fecha de nacimiento.'}</div>`;
}

/* Aviso debajo de un campo: verde si está bien, ámbar si falta algo */
function pista(id, estado, texto){
  const h = $('#'+id+'-h'); if(!h) return;
  h.className = 'telhint ' + (estado || '');
  h.innerHTML = (estado === 'ok' ? ico('check') + ' ' : estado === 'bad' ? ico('alert') + ' ' : '') + texto;
}

/* Botón que se bloquea mientras el servidor responde */
async function conEspera(btn, texto, fn){
  const antes = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = texto;
  try{ return await fn(); }
  finally{ btn.disabled = false; btn.innerHTML = antes; }
}

/* ============================================================
   PUERTA DE ENTRADA
   ============================================================ */
function abrirCuenta(despues){
  if(YO) return abrirMiCuenta();
  abrirSheet(`
    <h3>Su cuenta</h3>
    <p class="muted">Con su celular y un PIN que usted escoge. Sin correo, sin contraseñas
      largas. Sirve para volver a entrar desde cualquier teléfono y arreglar lo suyo.</p>
    <button class="btn" id="k-nueva">Crear mi cuenta</button>
    <button class="btn flat" id="k-entrar">Ya me inscribí, quiero entrar</button>
  `);
  $('#k-nueva').onclick  = ()=>abrirRegistro(despues);
  $('#k-entrar').onclick = ()=>abrirEntrar(despues);
}

/* ============================================================
   CREAR CUENTA · celular dos veces, PIN dos veces
   ============================================================ */
function abrirRegistro(despues){
  abrirSheet(`
    <h3>Crear mi cuenta</h3>
    <p class="muted">El celular se escribe dos veces a propósito: si queda mal, nadie
      lo puede contactar por WhatsApp y su trabajo no sirve de nada.</p>

    <label class="f" for="k-nom">Nombre completo</label>
    <input id="k-nom" placeholder="Como lo conoce la comunidad" autocomplete="name">

    ${campoTel('k-tel1', 'Celular de WhatsApp', 'Diez dígitos, empieza por 3.')}
    ${campoTel('k-tel2', 'Escríbalo otra vez', 'Para estar seguros de que quedó bien.')}

    ${campoPin('k-pin1', 'Cree un PIN', 'Cuatro números que solo usted sepa.')}
    ${campoPin('k-pin2', 'Repita el PIN', 'Los dos tienen que ser iguales.')}

    <details class="fold">
      <summary>Agregar mi foto (opcional)</summary>
      <div class="foldbody">
        <div class="row">
          <div class="avatar big" id="k-prev">+</div>
          <div class="grow">
            <p class="muted" style="margin:0 0 7px">Para que la gente lo reconozca en la calle
              y en los puntos de entrega.</p>
            <button class="btn flat" id="k-foto-btn" style="margin:0">Tomar o elegir foto</button>
            <input id="k-foto" type="file" accept="image/*" capture="environment" hidden>
          </div>
        </div>
      </div>
    </details>

    <button class="btn" id="k-crear">Crear cuenta y entrar</button>
    <button class="btn flat" id="k-ya">Ya tengo cuenta</button>
  `);

  let foto = '';
  fotoCampo('k-foto', 'k-foto-btn', 'k-prev', v=>{ foto = v; });

  const revisar = ()=>{
    const d1 = telCrudo('k-tel1'), d2 = telCrudo('k-tel2');
    if(!d1.length) pista('k-tel1','','Diez dígitos, empieza por 3.');
    else if(telOK(d1)) pista('k-tel1','ok','Le va a llegar el WhatsApp a <b>'+telBonito('57'+d1)+'</b>');
    else pista('k-tel1','bad','Faltan dígitos. En Colombia son 10 y empieza por 3.');

    if(!d2.length) pista('k-tel2','','Para estar seguros de que quedó bien.');
    else if(d2 === d1 && telOK(d1)) pista('k-tel2','ok','Los dos números coinciden.');
    else pista('k-tel2','bad','No coincide con el de arriba.');
  };
  telVivo('k-tel1', revisar); telVivo('k-tel2', revisar);

  const revisarPin = ()=>{
    const p1 = $('#k-pin1').value, p2 = $('#k-pin2').value;
    if(!p1.length) pista('k-pin1','','Cuatro números que solo usted sepa.');
    else if(/^\d{4,6}$/.test(p1)) pista('k-pin1','ok','PIN válido.');
    else pista('k-pin1','bad','Solo números, entre 4 y 6.');
    if(!p2.length) pista('k-pin2','','Los dos tienen que ser iguales.');
    else if(p1 === p2) pista('k-pin2','ok','Los dos PIN coinciden.');
    else pista('k-pin2','bad','No coincide con el de arriba.');
  };
  $('#k-pin1').oninput = revisarPin; $('#k-pin2').oninput = revisarPin;

  $('#k-ya').onclick = ()=>abrirEntrar(despues);
  $('#k-crear').onclick = async (e)=>{
    const nom = $('#k-nom').value.trim();
    const d1 = telCrudo('k-tel1'), d2 = telCrudo('k-tel2');
    const p1 = $('#k-pin1').value, p2 = $('#k-pin2').value;

    if(nom.length < 3){ $('#k-nom').focus(); return toast('Escriba su nombre completo.'); }
    if(!telOK(d1)){ revisar(); $('#k-tel1').focus(); return toast('Revise el celular.'); }
    if(d1 !== d2){ revisar(); $('#k-tel2').focus(); return toast('Los dos celulares no coinciden.'); }
    if(!/^\d{4,6}$/.test(p1)){ revisarPin(); $('#k-pin1').focus(); return toast('El PIN son 4 números.'); }
    if(p1 !== p2){ revisarPin(); $('#k-pin2').focus(); return toast('Los dos PIN no coinciden.'); }

    const r = await conEspera(e.target, 'Creando…', ()=>
      rpc('ae_registrar', {p_tel:'57'+d1, p_pin:p1, p_nombre:nom, p_foto:foto}));

    if(!r.ok){
      if(r.ya_existe) return abrirEntrar(despues, '57'+d1, r.error);
      return toast(r.error);
    }
    await sesionAbrir(r);
    toast('Cuenta creada. Ya quedó adentro.');
    despues ? despues() : abrirMiCuenta();
  };
}

/* ============================================================
   ENTRAR
   ============================================================ */
function abrirEntrar(despues, telPrevio, aviso){
  abrirSheet(`
    <h3>Entrar a mi cuenta</h3>
    ${aviso ? `<div class="avisoej">${esc(aviso)}</div>` : ''}
    <p class="muted">Con el celular que registró y su PIN.</p>
    ${campoTel('e-tel', 'Celular', 'El mismo con el que se inscribió.')}
    ${campoPin('e-pin', 'Su PIN', 'Los cuatro números que escogió.')}
    <button class="btn" id="e-entrar">Entrar</button>
    <button class="btn flat" id="e-nueva">No tengo cuenta todavía</button>
    <details class="fold">
      <summary>Se me olvidó el PIN</summary>
      <div class="foldbody">
        <p class="muted" style="margin:0 0 10px">Nadie puede verlo, ni nosotros: se guarda cifrado.
          Escríbanos por WhatsApp desde el mismo celular que registró y le devolvemos la cuenta.</p>
        <a class="btn wa" id="e-wa" target="_blank" rel="noopener" href="#">${icoWA()} Escribir por WhatsApp</a>
      </div>
    </details>
  `);
  if(telPrevio) $('#e-tel').value = telCampo10(telPrevio);
  telVivo('e-tel');
  const wa = $('#e-wa');
  if(wa) wa.href = waLink(CONFIG.WHATSAPP_SOPORTE,
    'Hola, se me olvidó el PIN de mi cuenta en Aquí Estamos. Les escribo desde el celular que registré.');

  $('#e-nueva').onclick = ()=>abrirRegistro(despues);
  $('#e-entrar').onclick = async (e)=>{
    const d = telCrudo('e-tel'), p = $('#e-pin').value;
    if(!telOK(d)){ pista('e-tel','bad','Diez dígitos, empieza por 3.'); return; }
    if(!p){ $('#e-pin').focus(); return toast('Escriba su PIN.'); }
    const r = await conEspera(e.target, 'Entrando…', ()=>rpc('ae_entrar', {p_tel:'57'+d, p_pin:p}));
    if(!r.ok){ $('#e-pin').value=''; pista('e-pin','bad', esc(r.error)); return; }
    await sesionAbrir(r);
    toast('Bienvenido de vuelta, ' + (r.nombre||'').split(' ')[0] + '.');
    despues ? despues() : abrirMiCuenta();
  };
}

/* ============================================================
   MI CUENTA
   ============================================================ */
async function abrirMiCuenta(){
  if(!YO) await yoCargar();
  if(!YO) return abrirCuenta();

  const zs = YO.zonas || [];
  abrirSheet(`
    <div class="zhead">
      <div class="row">
        ${avatar({foto:YO.foto, nombre:YO.nombre})}
        <div class="grow">
          <h3 style="margin:0">${esc(YO.nombre)}</h3>
          <div class="muted">${esc(telBonito(YO.tel))}</div>
        </div>
      </div>
      <div class="btn2">
        <button class="btn" id="m-nueva">Cubrir otra micro-zona</button>
        <button class="btn flat" id="m-editar">Editar mis datos</button>
      </div>
    </div>

    <div class="sec">Micro-zonas que cubro</div>
    ${zs.length ? zs.map(z=>`
      <div class="fila-mia">
        <div class="row">
          <div class="grow">
            <div style="font-weight:700">${esc(z.micro || 'Sin nombre')}</div>
            <div class="muted">${esc(ZONAS.find(x=>x.id===z.zona)?.n || z.zona)} · ${z.radio||500} m · ${esc(z.rol||'')}</div>
          </div>
          ${z.verificado ? '<span class="verif">verificado</span>' : '<span class="pend">esperando</span>'}
        </div>
        ${z.codigo ? `<div class="muted" style="margin-top:5px">Código <b class="cod">${esc(z.codigo)}</b></div>` : ''}
        <div class="fbtns">
          <button class="mini" data-mz-edit="${z.id}">Corregir</button>
          <button class="mini" data-mz-off="${z.id}">Retirarme</button>
        </div>
      </div>`).join('')
      : `<p class="vacio">Todavía no cubre ninguna micro-zona. Toque
           <b>Cubrir otra micro-zona</b> y ponga el pin donde va a estar.</p>`}

    <button class="btn flat" id="m-salir">Cerrar sesión en este teléfono</button>
  `);

  $('#m-nueva').onclick  = ()=>abrirCoord(null, null);
  $('#m-editar').onclick = ()=>abrirEditarCuenta();
  $('#m-salir').onclick  = ()=>{ sesionBorrar(); cerrarSheet(); render(); toast('Sesión cerrada. Su registro sigue guardado.'); };

  $('#sheet-body').querySelectorAll('[data-mz-edit]').forEach(b=>{
    b.onclick = ()=>{ const z = zs.find(x=>x.id===b.dataset.mzEdit); if(z) abrirCoord(z.zona, {lat:z.lat, lng:z.lng}, z); };
  });
  $('#sheet-body').querySelectorAll('[data-mz-off]').forEach(b=>{
    b.onclick = async ()=>{
      const r = await conEspera(b, 'Retirando…', ()=>rpc('ae_anular_zona', {p_token:YO.token, p_id:b.dataset.mzOff}));
      if(!r.ok) return toast(r.error);
      await yoCargar(); await dbCargar(); render();
      toast('Listo, ya no aparece cubriendo ese sector.');
      abrirMiCuenta();
    };
  });
}

/* ============================================================
   EDITAR MIS DATOS
   ============================================================ */
function abrirEditarCuenta(){
  if(!YO) return abrirCuenta();
  abrirSheet(`
    <h3>Editar mis datos</h3>
    <p class="muted">Lo que cambie aquí se actualiza en todas sus micro-zonas.</p>

    <label class="f" for="d-nom">Nombre completo</label>
    <input id="d-nom" value="${esc(YO.nombre)}" autocomplete="name">

    <div class="row" style="margin-top:12px">
      <div class="avatar big" id="d-prev" ${YO.foto?`style="background-image:url(${YO.foto})"`:''}>${YO.foto?'':'+'}</div>
      <div class="grow">
        <button class="btn flat" id="d-foto-btn" style="margin:0">Cambiar mi foto</button>
        <input id="d-foto" type="file" accept="image/*" capture="environment" hidden>
      </div>
    </div>

    <details class="fold">
      <summary>Cambiar mi celular</summary>
      <div class="foldbody">
        <p class="muted" style="margin:0 0 8px">Al cambiarlo, sus micro-zonas vuelven a
          quedar en espera de autorización. Es la forma de comprobar que el número nuevo es suyo.</p>
        ${campoTel('d-tel1', 'Celular nuevo', 'Diez dígitos, empieza por 3.')}
        ${campoTel('d-tel2', 'Escríbalo otra vez', 'Para estar seguros.')}
      </div>
    </details>

    <details class="fold">
      <summary>Cambiar mi PIN</summary>
      <div class="foldbody">
        ${campoPin('d-pin1', 'PIN nuevo', 'Cuatro números.')}
        ${campoPin('d-pin2', 'Repita el PIN nuevo', 'Los dos tienen que ser iguales.')}
      </div>
    </details>

    <button class="btn" id="d-guardar">Guardar cambios</button>
    <button class="btn flat" id="d-volver">Volver</button>
  `);

  let foto = null;
  fotoCampo('d-foto', 'd-foto-btn', 'd-prev', v=>{ foto = v; });
  telVivo('d-tel1'); telVivo('d-tel2');

  $('#d-volver').onclick = ()=>abrirMiCuenta();
  $('#d-guardar').onclick = async (e)=>{
    const nom = $('#d-nom').value.trim();
    const d1 = telCrudo('d-tel1'), d2 = telCrudo('d-tel2');
    const p1 = $('#d-pin1').value, p2 = $('#d-pin2').value;

    if(nom.length < 3){ $('#d-nom').focus(); return toast('Escriba su nombre completo.'); }
    if(d1 || d2){
      if(!telOK(d1)){ pista('d-tel1','bad','Diez dígitos, empieza por 3.'); return toast('Revise el celular nuevo.'); }
      if(d1 !== d2){ pista('d-tel2','bad','No coincide con el de arriba.'); return toast('Los dos celulares no coinciden.'); }
    }
    if(p1 || p2){
      if(!/^\d{4,6}$/.test(p1)){ pista('d-pin1','bad','Solo números, entre 4 y 6.'); return toast('Revise el PIN.'); }
      if(p1 !== p2){ pista('d-pin2','bad','No coincide.'); return toast('Los dos PIN no coinciden.'); }
    }

    const r = await conEspera(e.target, 'Guardando…', ()=>rpc('ae_editar_cuenta', {
      p_token: YO.token, p_nombre: nom,
      p_foto: (foto === null ? null : foto),
      p_tel_nuevo: d1 ? '57'+d1 : null,
      p_pin_nuevo: p1 || null,
    }));
    if(!r.ok) return toast(r.error);
    if(r.tel && r.tel !== YO.tel) sesionGuardar({token:YO.token, tel:r.tel});
    await yoCargar(); await dbCargar(); render();
    toast('Datos actualizados.');
    abrirMiCuenta();
  };
}

/* ============================================================
   FOTO · un solo sitio para todos los formularios
   Antes había que tocar "Subir" para que reaccionara; ahora el
   botón grande dispara el selector y la vista previa se ve de una.
   ============================================================ */
function fotoCampo(inputId, botonId, prevId, alListo){
  const inp = $('#'+inputId), btn = $('#'+botonId), pv = $('#'+prevId);
  if(!inp || !btn) return;
  btn.onclick = ()=>inp.click();
  if(pv) pv.onclick = ()=>inp.click();
  inp.onchange = ev=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    if(!/^image\//.test(f.type)) return toast('Ese archivo no es una imagen.');
    const fr = new FileReader();
    fr.onload = ()=>{
      const im = new Image();
      im.onload = ()=>{
        // recorte cuadrado + compresión: la app tiene que servir con datos malos
        const S0 = 320, cv = document.createElement('canvas'); cv.width = cv.height = S0;
        const g = cv.getContext('2d'), m = Math.min(im.width, im.height);
        g.drawImage(im, (im.width-m)/2, (im.height-m)/2, m, m, 0, 0, S0, S0);
        const dataURL = cv.toDataURL('image/jpeg', 0.72);
        if(pv){ pv.textContent = ''; pv.style.backgroundImage = `url(${dataURL})`; }
        alListo(dataURL);
        toast('Foto lista.');
      };
      im.onerror = ()=>toast('No se pudo leer la imagen.');
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
}
