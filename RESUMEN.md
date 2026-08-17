# Aquí Estamos — Resumen para rediseño desde cero

> Coordinación abierta de ayuda para el terremoto de Pereira (agosto 2026).
> aquiestamos.co · Sitio estático, sin backend propio (Supabase como datos).

---

## 1. Qué es y para quién

App web abierta para coordinar la ayuda tras el terremoto. La regla de oro:
**la abre gente NO técnica, muchas veces en crisis, en teléfonos baratos y con mala señal.**
Todo el diseño se somete a eso: un paso claro por pantalla, dibujos, palabras simples, tono humano, y que funcione offline.

Cinco tipos de usuario:

| Usuario | Qué hace |
|---|---|
| Afectado | Reporta lo que necesita; se registra en el censo |
| Ayudante local | Tiene algo para dar y quiere saber a dónde llevarlo |
| Donante desde USA | Compra por listas de Amazon de los centros |
| Coordinador | Se hace cargo de una zona, abre un centro de acopio, registra entregas |
| Autoridad | Recibe el censo (export privado) para verificar y llevar ayuda |

---

## 2. Principios de producto (no negociables)

1. **Un solo camino claro por pantalla.** Nada de menús que haya que descifrar.
2. **Funciona sin señal.** Cálculos y decisiones en el propio teléfono; mapa con respaldo offline.
3. **Confianza primero.** Anti-duplicados, verificación, prueba de entrega.
4. **Privacidad por diseño.** Los datos sensibles nunca son públicos (ver sección 6).
5. **La app no mueve dinero.** Solo conecta con enlaces (Amazon, WhatsApp). No cobra, no paga.
6. **Se verifica en la app corriendo, no leyendo el código.**

---

## 3. Funciones actuales

### Mapa (pantalla principal)
- Leaflet. Puntos de necesidad (anónimos) con escala de urgencia `c0..c4`.
- Zonas con índice de desatención.
- Respaldo SVG offline cuando no carga el mapa.
- Botones flotantes: "Ubícame", "+ Necesidad", "+ Vivienda" (censo).
- Barra "Donar desde USA" que lleva a /donar.

### Zonas olvidadas
- Lista filtrable de puntos: `zonas`, `albergues`, `censo`, `entregas`, `solo altas`.

### Coordinación
- Inscribirse como coordinador con **PIN** (sin correo ni contraseña larga).
- Hacerse cargo de micro-zonas y de "puntos sin nadie a cargo".
- Tarjeta de acceso al Censo.

### Albergues
- Capacidad + necesidades por albergue (ej. Mejía Robledo: "mesas y sillas para niños").

### Censo (privado)
- Registro de persona/familia: nombre, cédula, teléfono, dirección, barrio, personas, necesidades, ubicación opcional.
- Consentimiento obligatorio (Ley 1581).
- Se marca "atendido" solo cuando hay una entrega cercana (≤300 m, ≤7 días).
- Opt-in para publicar **solo el teléfono** (nunca nombre/cédula), mostrado como un coordinador (apellido + WhatsApp/copiar, número nunca visible).

### Donaciones — /donar (bilingüe ES/EN)
- Catálogo de necesidades (`CATALOGO`).
- Centros de acopio: en persona y/o por lista de Amazon.
- Al elegir "Donar por Amazon": selector del centro más cercano; abre su lista con `?sort=priority`.
- Compartir centro con imagen + QR (/compartir).

### Utilidades
- **/centro**: autogestión para que alguien cree su propio centro (persona / amazon / ambos).
- **/compartir**: genera imagen con QR + enlace de la tienda Amazon de un centro (sin dirección, por privacidad).

---

## 4. En diseño (aprobado, aún sin construir)

### #1 — "Tengo algo para dar" (cerrar el ciclo oferta↔demanda)
Flujo de 4 pantallas: dos caminos (necesito / tengo) → qué traes (íconos) → **un solo destino** ("Llévalo aquí") → gracias + foto.

**Cómo se decide el destino:** puntaje transparente calculado en el teléfono (sin IA, offline, explicable):
```
puntaje = urgencia×40 + familias×8 + (nadie_ha_llegado?30:0) − distancia_km×6 − ya_muchos_van×15
```
Se muestra el punto de mayor puntaje que necesita justo lo que traes, con el "por qué".
El factor "reparte" evita saturar un solo punto.

### #5 — Confirmar entrega con foto
Al entregar, foto opcional como prueba. El punto se pone verde. Recomendación de privacidad: guardar la foto para el coordinador, no publicarla; en el mapa solo "entregado con foto ✓".

### IA (mejora posterior, en la trastienda)
Clasificar texto libre ("algo para mi bebé" → pañales), juntar reportes duplicados, resumir para autoridades. Iría en una **Supabase Edge Function** (key en el servidor, nunca en el navegador), por lotes — nunca en el ruteo en vivo.

---

## 5. Arquitectura técnica

- **Sitio estático:** HTML + CSS plano + JS vanilla. Sin framework, sin build.
- **Mapa:** Leaflet.
- **Datos:** Supabase (Postgres + RLS). Proyecto ref `iknscwnuvlggibkmuhcv`.
- **Deploy:** GitHub Pages automático desde `main`. `.nojekyll` presente.
- **QR:** `qrcode-generator` por CDN, dibujado en canvas.
- **Fuentes:** solo `system-ui, -apple-system, sans-serif` (offline-first, sin descargas).

### Estructura de archivos
```
index.html      donar.html   centro.html   censo.html   compartir.html
js/  config.js version.js estado.js mapa.js hojas.js ui.js data.js
     donar.js donar-data.js centro.js censo.js compartir.js
css/ app.css donar.css centro.css compartir.css
logo/  img/
```
Roles: `estado.js` = estado global `S {reportes, entregas, coords, censo}` y carga desde Supabase · `mapa.js` = capas y marcadores · `hojas.js` = paneles/hojas · `ui.js` = pestañas y filtros · `data.js` = catálogo.

---

## 6. Datos y privacidad (Supabase)

Patrón central: **vistas públicas anónimas + tablas de escritura para lo sensible.**

| Tabla / Vista | Contenido | Acceso anónimo |
|---|---|---|
| `reportes` | necesidades (anónimas) | lectura |
| `entregas` | entregas registradas | lectura |
| `censo` | PII: nombre, cédula, tel, dirección | **solo INSERT** (SELECT revocado) |
| `censo_publico` | necesidades, barrio, lat/lng, estado; tel/apellido solo si opt-in | lectura |
| `centros_acopio` | centros (con dirección) | SELECT revocado |
| `centros_publico` | centros; dirección en `null` para centros solo-Amazon | lectura |

Técnicas: RLS con `INSERT` permitido y `SELECT` revocado para PII; vistas con `security_invoker = off` para exponer solo campos seguros; política de inserción del censo exige `consentimiento = true`.

Reglas duras:
- Nombre / cédula / teléfono / dirección del censo **nunca** legibles con la key pública. Export solo por admin (MCP).
- Direcciones de centros solo-Amazon **no** se publican (son casas de coordinadores).
- Consentimiento antes de guardar censo.

---

## 7. Sistema de diseño

- **Tema:** oscuro por defecto + claro (`:root[data-eff="light"]`).
- **Variables:** `--card --bg --line --acc --panel --chip --c0..c4` (escala de urgencia).
- **Colores semánticos:**
  - Rojo `#dc2626` = urgencia / ayuda / necesito
  - Verde `#2f9e5f` / `#25D366` = WhatsApp / atendido / dar
  - Dorado `#F2B705` = albergue
  - Violeta `#7c3aed` = censo
  - Naranja `#FF9900` = Amazon
  - Azul `#4f9cf9` = acento
- **Materialidad:** tarjetas de contenido **sin borde** (elevación por sombra corta); controles del mapa **con borde** + sombra corta. Un solo signal por elemento.
- **Forma:** una sola escala de radios; sin mezclar.
- **Accesibilidad:** `prefers-reduced-motion` respetado, fuentes de sistema, buen contraste (WCAG AA), toques grandes.
- **Iconos:** SVG propios. **Sin emojis** en la interfaz ni en el chat.
- **Calidad:** impeccable en cero anti-patrones; revisado con el crítico de taste.

---

## 8. Coordenadas del proyecto

- Dominio: aquiestamos.co (GitHub Pages).
- Repo: `wilmarcampos-sys/aqui-estamos`, rama `main`.
- Carpeta de trabajo local: `/Users/wilmarcampos/Claude_Code/aqui-estamos`.
- Versión: `js/version.js` (bump en cada despliegue).
- Supabase URL: `https://iknscwnuvlggibkmuhcv.supabase.co`, key publishable (anon).

---

## 9. Si empezara el diseño desde cero — qué conservar

1. Los **dos caminos** de entrada (pedir / dar) como eje de todo.
2. El patrón de **vista pública anónima + tabla privada** para cualquier dato sensible.
3. **Colores semánticos** estables (un color = un significado).
4. **Offline-first**: sin fuentes externas, sin dependencias en el ruteo, respaldo de mapa.
5. Tono **humano** y un paso por pantalla.
6. La app **no toca dinero**: solo enlaces.
