# SQL — cambios a la base de datos

Cada cambio a Supabase vive en **un archivo `.sql`** en esta carpeta. Así el
handoff a la sesión con el conector MCP es limpio: se pasa **un archivo**, no
SQL pegado en el chat (que se enreda).

## Reglas de cada archivo
- **Autocontenido e idempotente**: se puede correr varias veces sin dañar nada
  (usa `UPDATE ... SET` con valor exacto, o `DELETE where device=... ` + `INSERT`).
- **Un cambio, un archivo**, con nombre descriptivo.
- **Sin datos personales** (teléfonos, etc.) → esos van en archivos del `.gitignore`.

## Cómo pedirle a la terminal (con MCP de Supabase) que lo corra

Pégale **exactamente** esto, cambiando el nombre del archivo:

> Ejecuta el SQL del archivo `sql/NOMBRE.sql` contra Supabase usando el conector
> MCP de Supabase (proyecto `iknscwnuvlggibkmuhcv`). **No modifiques el SQL**,
> córrelo tal cual. Dime cuántas filas afectó cada statement y muéstrame el
> resultado.

Eso evita que la terminal "interprete" o cambie el SQL: solo lee el archivo y lo
ejecuta.

## Archivos de infraestructura (en la raíz del repo)
- `seguridad.sql` — cierra la exposición de datos (vistas públicas). Ya corrido.
- `necesidades-albergues.sql` — siembra las necesidades de instalación. Ya corrido.
- `albergues.sql` — **NO versionado** (tiene teléfonos); siembra los coordinadores.
