# Aquí Estamos

Mapa abierto de necesidades y coordinación para emergencias.
Nace por el terremoto de Pereira de agosto de 2026.

**El problema que resuelve:** en una emergencia todo el mundo sabe pedir ayuda,
pero nadie sabe **dónde no ha llegado nada**. Aquí Estamos hace visible ese hueco.

---

## Cómo funciona

- Cualquiera reporta una necesidad en 3 toques, sin registrarse y sin dar su nombre.
- Cualquiera marca cuando **llegó** la ayuda. Esas dos señales juntas son las que
  mantienen el mapa honesto.
- Cada zona recibe un **índice de desatención** (0–100): qué tan grave es lo pendiente,
  cuántas horas lleva sin recibir nada, y a cuánta gente afecta. Eso ordena la pestaña
  *Zonas olvidadas*: arriba está adonde hay que ir primero.
- Dentro de cada comuna los reportes se agrupan en **puntos concretos**
  ("la cancha de Ciudad Jardín"). Cuando varias personas reportan lo mismo en el mismo
  punto, **la urgencia sube sola** por corroboración.
- Los coordinadores cubren **micro-zonas**: un punto y un radio de máximo 1 km.
  Se pueden traslapar, una persona puede tener varias, y nadie puede sacar a nadie.
  La app señala los puntos donde **no responde nadie**.

---

## Puesta en marcha (15 minutos)

### 1. Base de datos

1. Cree un proyecto gratis en [supabase.com](https://supabase.com) — región `South America (São Paulo)`.
2. **SQL Editor → New query** → pegue todo `schema.sql` → **Run**.
3. Otra query → pegue todo `mantenimiento.sql` → **Run**. Agrega el poder
   retirarse de un sector y la tabla de administradores. **Cambie el correo**
   de la sección 2 por el suyo antes de correrlo.
4. Otra query → pegue todo `cuentas.sql` → **Run**. Las cuentas con celular
   y PIN, y las funciones por las que pasa todo lo que escribe un coordinador.
5. **Settings → API** → copie `Project URL` y la clave `anon public`.

Los tres archivos SQL hay que correrlos **en ese orden**: cada uno corrige o
amplía cosas del anterior. Ninguno borra datos, así que se pueden volver a correr.

### 2. Configurar la app

En `js/config.js`:

```js
const CONFIG = {
  SUPABASE_URL:      'https://xxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  WHATSAPP_SOPORTE:  '572322314100',
  CIUDAD:            'Pereira',
};
```

Con esos campos vacíos la app funciona igual, pero en **modo demostración**:
los datos se quedan en el teléfono y no se comparten.

### 3. Publicar

Es un sitio estático sin compilación: se sube tal cual.

| Opción | Cómo | Actualizaciones |
|---|---|---|
| **Netlify Drop** | Arrastre la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop) | Volver a arrastrar |
| **Cloudflare Pages** | Conectar el repositorio de GitHub | Automáticas en cada `push` |
| **GitHub Pages** | Settings → Pages → rama `main` | Automáticas en cada `push` |

La opción con repositorio es la buena si el código se va a seguir cambiando:
se edita, se hace `push`, y en ~30 segundos está en vivo sin tocar nada más.

---

## Verificación por WhatsApp

No se le envía un código a la persona: **la persona nos envía el código**.

Mandar mensajes desde un negocio exige plantillas aprobadas por Meta, que pueden
tardar semanas. **Recibir es gratis y no necesita ninguna aprobación.** Además esto
comprueba lo que de verdad importa: que ese WhatsApp existe y que la persona lo usa.

1. La app genera un código (`AE-482913`) y lo guarda en `coordinadores.codigo`.
2. La persona toca *Abrir WhatsApp y enviar* — el chat abre con el mensaje escrito.
3. El número de Aquí Estamos recibe el mensaje.
4. Quien administra abre **`/admin.html`**, busca ese código en *Esperando autorización*
   y toca **Autorizar**. Ahí mismo se ve el celular, para comprobar que coincide
   con el que escribió.

Al panel se entra con un enlace que llega al correo — sin contraseñas que compartir.
Solo entran los correos de la tabla `admins`, que se llena en `mantenimiento.sql`.

Sin abrir el panel, la misma operación desde el SQL Editor:

```sql
select verificar_coordinador('AE-482913', '+57 310 555 0142');
```

**Para arrancar hoy no hace falta ninguna API.** Basta la app WhatsApp Business en un
celular y alguien pendiente del panel cuando llegan los códigos. Cuando haya tiempo
se automatiza con el webhook del Cloud API de Meta sin cambiar nada de la app.

---

## La cuenta del coordinador

Celular y un **PIN de 4 dígitos** que la persona escoge. Sin correo, sin contraseñas
largas. Con eso vuelve a entrar desde cualquier teléfono y corrige lo suyo.

Es lo único que hoy permite recuperar un registro. Mientras la verificación por
WhatsApp sea manual, si la cuenta dependiera del teléfono, cambiar de aparato o
borrar los datos del navegador significaría perder el registro para siempre.

**El PIN no se guarda.** Se guarda su hash bcrypt, que no se puede devolver. Ni el
administrador puede ver un PIN. Por eso "se me olvidó el PIN" se resuelve por
WhatsApp: se confirma quién es y se le pone uno nuevo (`cuentas.sql`, sección 11).

**Entrar tiene freno.** Un PIN de 4 números son 10.000 combinaciones: a pelo se
adivina en minutos. A los 5 intentos malos la cuenta se cierra 5 minutos, y la
espera crece con cada fallo hasta una hora. El mensaje es el mismo si el celular
no existe o si el PIN está malo, para que nadie averigüe qué números tienen cuenta.

**El dueño de una micro-zona es la cuenta, no el teléfono.** Todo lo que escribe un
coordinador pasa por funciones del servidor (`ae_guardar_zona`, `ae_anular_zona`)
que exigen el token de la sesión. Al navegador se le quitó el `insert` y el `update`
sobre `coordinadores`: no puede tocar esa tabla por su cuenta.

## Freno anti-abuso

En dos capas, porque la del navegador se puede saltar y la de la base no.

**Navegador** (`localStorage`): 15 reportes / 10 min, 30 entregas / 10 min,
y bloqueo de envíos idénticos repetidos.

**Base de datos** (*triggers* y funciones): 25 reportes / 10 min por dispositivo,
duplicados exactos en menos de 3 minutos, 40 entregas / 10 min, 6 micro-zonas / hora
por cuenta, una misma cuenta no repite sector, y 5 intentos de PIN antes del freno.
Además `verificado` se fuerza a `false` en cada inserción: nadie se auto-verifica.

**Permisos (RLS):** todo el mundo lee reportes, entregas y coordinadores; todo el
mundo inserta reportes y entregas; y **nadie borra nada**. Es deliberado: en una
emergencia el riesgo real es que alguien limpie el mapa, no que sobre información.

Sobre `coordinadores` el navegador no puede escribir nada: ni `insert` ni `update`.
Todo pasa por funciones que exigen el token de la sesión. Las tablas `cuentas` y
`sesiones` no se pueden ni leer — solo existen a través de esas funciones.

Los administradores, con su correo autorizado, pueden verificar y anular desde
`admin.html`, y borrar reportes o entregas falsos.

## Sin señal

Lo que **sí** funciona: reportar una necesidad y registrar una entrega. Quedan en una
cola local y se envían solos cuando vuelve la red; la cabecera avisa cuántos quedan.
Si tampoco carga el mapa de calles, la app cae a un esquema propio que sigue siendo usable.
La sesión dura 180 días y la app guarda lo último que supo de su cuenta, así que sigue
sabiendo quién es usted aunque no haya red.

Lo que **no**: crear cuenta, entrar, inscribirse en un sector, corregirlo o retirarse.
Eso vive en el servidor. La app lo dice con esas palabras en vez de fallar en silencio.

---

## Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html` | Solo el armazón y los enlaces |
| `admin.html` | Panel para autorizar coordinadores — se entra por correo |
| `css/app.css` | Todo el estilo |
| `js/config.js` | Claves y ciudad — lo único que se toca para desplegar |
| `js/data.js` | Iconos SVG, las 31 zonas de Pereira, el catálogo de 121 artículos |
| `js/estado.js` | Supabase, tiempo real, presencia, cola sin señal, freno anti-abuso |
| `js/calc.js` | Índice de desatención, focos, micro-zonas |
| `js/mapa.js` | Mapa, pin arrastrable y selector de punto |
| `js/hojas.js` | Fichas de zona y de punto, formularios |
| `js/cuenta.js` | Cuenta con celular y PIN: crear, entrar, editar |
| `js/ui.js` | Eventos, vistas y arranque |
| `schema.sql` | Tablas, frenos y permisos |
| `mantenimiento.sql` | Poder retirarse, administradores, verificación |
| `cuentas.sql` | Cuentas con PIN y todo lo que escribe un coordinador |
| `logo/` | Marca vectorial e iconos |

Está partido a propósito: así un cambio toca un archivo pequeño y no uno de 116 KB.

## Adaptarlo a otra ciudad

Todo lo específico de Pereira está en `js/data.js`:

- `ZONAS` — las 19 comunas y 12 corregimientos con sus coordenadas.
- `CATALOGO` — 121 artículos en 13 categorías, con sinónimos para el buscador.

Cambiando `ZONAS` la app sirve para cualquier municipio.

---

## Costos

| | Plan gratuito | Alcanza para |
|---|---|---|
| Supabase | 500 MB, 50.000 usuarios/mes, 200 conexiones simultáneas | Una emergencia municipal completa |
| Netlify / Cloudflare Pages | 100 GB de tráfico | De sobra |
| WhatsApp entrante | Gratis, sin aprobación | Toda la verificación |

Un proyecto gratuito de Supabase se pausa tras 7 días sin actividad.
Durante una emergencia activa no aplica; después conviene exportar los datos.
