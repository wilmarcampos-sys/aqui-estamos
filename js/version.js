/* ============================================================
   VERSIÓN
   ============================================================
   Sale en el pie de la app y del panel. Cuando alguien avise de
   algo raro, lo primero que hay que saber es qué código tiene
   en el teléfono: si es el de ayer, media hora de búsqueda se
   ahorra con mirar el pie.

   Se cambia a mano, en el mismo commit que lo que se despliega.
   Es el único archivo que hay que tocar para eso.

     n     — sube con cada despliegue.
             tercer número: un arreglo.
             segundo:       algo nuevo que se ve.
             primero:       la app dejó de ser la misma.
     fecha — en AAAA-MM-DD, que ordena bien y no se presta a
             confusión entre día y mes.
   ============================================================ */
const VERSION = {
  n:     '1.21.0',
  fecha: '2026-08-17',
};

/* La fecha se arma partiendo el texto, no con new Date(): "2026-08-14" se
   interpreta como medianoche UTC, y en Colombia eso es el día anterior. */
const VERSION_MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function versionTexto(){
  const [a, m, d] = String(VERSION.fecha).split('-');
  const mes = VERSION_MESES[(+m) - 1] || m;
  return `v${VERSION.n} · ${(+d)} ${mes} ${a}`;
}

/* Llena cualquier elemento con id="version". Si la página no tiene pie, no
   pasa nada: este archivo no supone nada de quien lo carga. */
function pintarVersion(){
  const e = document.getElementById('version');
  if(e) e.textContent = versionTexto();
}
if(document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', pintarVersion);
else
  pintarVersion();
