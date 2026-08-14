/* ============================================================
   CONFIGURACIÓN
   ============================================================
   SUPABASE_ANON_KEY lleva la clave *publishable* del proyecto.
   Es pública a propósito: viaja en el navegador de cualquiera que
   abra la app. Quien protege la base no es esta clave sino el RLS
   de schema.sql, que solo permite leer e insertar — nunca editar
   ni borrar. La clave secreta (sb_secret_...) NO va nunca aquí.

   Si estos campos quedan vacíos la app sigue funcionando, pero en
   modo demostración: los datos se quedan en el teléfono.          */
const CONFIG = {
  SUPABASE_URL:      'https://iknscwnuvlggibkmuhcv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_UeJRpwzSaddEvYwmXRUShg_tBDFyBn-',
  WHATSAPP_SOPORTE:  '572322314100',     // soporte y verificación de coordinadores
  CIUDAD:            'Pereira',
};
