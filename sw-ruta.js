/* ============================================================
   SERVICE WORKER DE LA RUTA
   ============================================================
   El caso que hay que resolver no es "abrir sin internet": es que alguien,
   a media jornada, en una zona sin señal, refresque sin querer y la página
   deje de existir. Sin esto el navegador muestra el dinosaurio y el equipo
   se queda sin direcciones en plena calle.

   Estrategia: red primero y guardar copia. Si la red falla, se sirve la
   copia. Nunca al revés, para que quien sí tiene señal vea lo último.
   ============================================================ */
const CACHE = 'ruta-v1';
const ESENCIALES = [
  './ruta.html',
  './css/app.css',
  './js/config.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

self.addEventListener('install', e=>{
  // addAll falla entero si un recurso falla; se piden uno por uno para que
  // un CDN caído no deje al equipo sin nada guardado.
  e.waitUntil(caches.open(CACHE).then(c=>
    Promise.all(ESENCIALES.map(u=>c.add(u).catch(()=>null)))
  ).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>
    Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e=>{
  const r = e.request;
  if(r.method !== 'GET') return;
  // Las llamadas a la base nunca se cachean: los datos viejos de una ruta
  // son peores que ningún dato. De esos se encarga la copia en el teléfono.
  if(r.url.includes('supabase.co')) return;
  // Los mapas tampoco: son cientos de teselas y llenarían el teléfono.
  if(r.url.includes('tile') || r.url.includes('basemaps')) return;

  e.respondWith(
    fetch(r).then(resp=>{
      if(resp && resp.status === 200){
        const copia = resp.clone();
        caches.open(CACHE).then(c=>c.put(r, copia)).catch(()=>{});
      }
      return resp;
    }).catch(()=> caches.match(r).then(c=> c || caches.match('./ruta.html')))
  );
});
