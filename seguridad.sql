-- ============================================================
-- Aquí Estamos · cerrar la exposición de la tabla coordinadores
-- ------------------------------------------------------------
-- Hoy cualquiera con la clave publishable (que va en el JS, a la
-- vista) puede hacer:
--
--   GET /rest/v1/coordinadores?select=*
--
-- y recibe las 20 columnas de TODOS los coordinadores: nombre,
-- celular, correo, foto, nota, device, y el código de verificación
-- de WhatsApp. Verificado en vivo: HTTP 200.
--
-- Con 3 registros no pasa nada. Con 300 es una lista descargable
-- de quién coordina cada barrio, con su teléfono y su cara.
--
-- Esto lo cierra sin cambiar el front más que en una línea.
-- Correr en el SQL Editor de Supabase. No borra datos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Vista pública: solo lo que el vecino necesita ver
-- ------------------------------------------------------------
-- Se quedan fuera:  email · device · llave · cuenta · codigo · nota
-- Se queda dentro:  tel_e164, porque sin eso no hay botón de WhatsApp,
--                   que es el punto de la app.
create or replace view coordinadores_publicos as
  select id, zona, micro, radio, lat, lng,
         nombre, rol, foto, verificado, tel_e164, creado
    from coordinadores
   where not anulado;

alter view coordinadores_publicos set (security_invoker = off);
grant select on coordinadores_publicos to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Quitarle a anon el select directo sobre la tabla
-- ------------------------------------------------------------
drop policy if exists p_coo_leer on coordinadores;
revoke select on coordinadores from anon;

-- El insert se queda: así es como alguien se inscribe.
-- (verificado ya se fuerza a false por trigger, eso no cambia.)

-- Los administradores autenticados siguen viendo todo, que es lo
-- que necesita admin.html para autorizar.
create policy p_coo_leer_admin on coordinadores
  for select to authenticated using (es_admin());

-- ------------------------------------------------------------
-- 3. Reportes: sacar device de la lectura pública
-- ------------------------------------------------------------
-- device es un identificador estable del aparato. Expuesto permite
-- juntar todos los reportes de una misma persona y seguirla por el
-- mapa. La app no lo usa para pintar nada.
create or replace view reportes_publicos as
  select id, zona, necesidad, urgencia, lat, lng,
         referencia, personas, nota, creado
    from reportes;

create or replace view entregas_publicas as
  select id, zona, necesidad, lat, lng, quien, cantidad, creado
    from entregas;

alter view reportes_publicos  set (security_invoker = off);
alter view entregas_publicas  set (security_invoker = off);
grant select on reportes_publicos, entregas_publicas to anon, authenticated;

drop policy if exists p_rep_leer on reportes;
drop policy if exists p_ent_leer on entregas;
revoke select on reportes, entregas from anon;

create policy p_rep_leer_admin on reportes for select to authenticated using (es_admin());
create policy p_ent_leer_admin on entregas for select to authenticated using (es_admin());

-- ------------------------------------------------------------
-- 4. Código muerto que sigue abierto
-- ------------------------------------------------------------
-- ae_retirar() ya no lo llama el front (las cuentas de cuentas.sql
-- lo reemplazaron), pero si sigue concedida a anon y la columna llave
-- guarda un sha256 sin sal, alguien podría recalcularla y anular a esa
-- persona. Se cierra — pero solo si la función existe en este proyecto
-- (en algunos no está, y ahí no hay nada que cerrar).
do $$
begin
  revoke execute on function ae_retirar(uuid, text) from anon, authenticated;
exception
  when undefined_function then null;   -- no existe: nada que cerrar
end $$;

-- Si ya confirmó que ningún registro la usa, se puede borrar:
-- alter table coordinadores drop column llave;

-- ------------------------------------------------------------
-- 5. Comprobación
-- ------------------------------------------------------------
-- Después de correr esto, con la clave publishable:
--   /rest/v1/coordinadores          → 401
--   /rest/v1/coordinadores_publicos → 200, 12 columnas, sin codigo ni email
--   /rest/v1/reportes               → 401
--   /rest/v1/reportes_publicos      → 200, sin device
