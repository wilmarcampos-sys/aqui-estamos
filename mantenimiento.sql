-- ============================================================
--  AQUÍ ESTAMOS · corrección propia + administración
--  Correr en Supabase → SQL Editor, DESPUÉS de schema.sql.
--  Repetible: se puede volver a correr sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PODER CORREGIR LO PROPIO
--    Faltaba: quien se inscribía con un dato malo no tenía cómo arreglarlo.
--    Se agrega "anulado". Nadie edita ni borra filas ajenas; solo se puede
--    retirar una propia, y solo con la llave del teléfono que la creó.
-- ------------------------------------------------------------
alter table coordinadores add column if not exists anulado boolean not null default false;
create index if not exists ix_coord_activos on coordinadores (zona) where not anulado;

-- La llave: un número al azar que el navegador guarda y no le enseña a nadie.
-- Aquí NUNCA se guarda tal cual, solo su huella (sha256). Aunque alguien se
-- baje la tabla entera, de la huella no se puede volver a la llave.
alter table coordinadores add column if not exists llave text not null default '';

-- ------------------------------------------------------------
-- 2. QUIÉN ES ADMINISTRADOR
--    Entra con su correo por enlace mágico. Nada de contraseñas
--    compartidas ni llaves secretas metidas en el código.
-- ------------------------------------------------------------
create table if not exists admins (
  email  text primary key,
  nombre text default '',
  creado timestamptz not null default now()
);
alter table admins enable row level security;

-- >>> CAMBIE O AGREGUE LOS CORREOS DE QUIENES PUEDEN AUTORIZAR <<<
insert into admins (email, nombre) values
  ('wilmar.campos@gmail.com', 'Wilmar Campos')
on conflict (email) do nothing;

create or replace function es_admin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from admins
     where lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  )
$$;

drop policy if exists p_admins_leer on admins;
create policy p_admins_leer on admins for select to authenticated using (es_admin());

-- ------------------------------------------------------------
-- 3. LA LLAVE SE GUARDA CIFRADA
--    El navegador manda la llave en claro al inscribirse; este disparador la
--    reemplaza por su huella ANTES de que la fila toque el disco. Así la
--    columna "llave" se puede leer públicamente sin que sirva de nada.
--
--    Reemplaza el freno de schema.sql y le agrega dos cosas:
--      · cifrar la llave
--      · no contar las micro-zonas anuladas al buscar duplicados, para que
--        alguien pueda corregir su sector sin cambiarle el nombre
-- ------------------------------------------------------------
create or replace function freno_coord() returns trigger
language plpgsql security definer as $$
declare n integer;
begin
  new.verificado := false;      -- nadie se auto-verifica desde el navegador

  -- La llave nunca se guarda en claro. sha256() es de Postgres, no de pgcrypto:
  -- en Supabase las extensiones viven en otro esquema y no siempre resuelven
  -- dentro de una función.
  new.llave := case when coalesce(new.llave,'') = '' then ''
                    else encode(sha256(convert_to(new.llave, 'UTF8')), 'hex') end;

  select count(*) into n from coordinadores
   where device = new.device and creado > now() - interval '1 hour';
  if n >= 6 then
    raise exception 'Demasiadas inscripciones desde este dispositivo.';
  end if;

  -- una misma persona no repite la misma micro-zona.
  -- Las que ya se retiró no cuentan: si no, corregir sería imposible.
  select count(*) into n from coordinadores
   where tel_e164 = new.tel_e164 and zona = new.zona
     and lower(coalesce(micro,'')) = lower(coalesce(new.micro,''))
     and not anulado;
  if n > 0 then
    raise exception 'Ya está inscrito en esa micro-zona.';
  end if;

  return new;
end $$;

drop trigger if exists tg_freno_coord on coordinadores;
create trigger tg_freno_coord before insert on coordinadores
  for each row execute function freno_coord();

-- ------------------------------------------------------------
-- 4. RETIRARSE DE UN SECTOR
--    Antes esto era una política que comparaba el "device" contra una
--    cabecera que mandaba el propio navegador. No probaba nada: el device
--    se puede leer en la tabla y la cabecera se puede escribir a mano, así
--    que cualquiera podía sacar del mapa a cualquier coordinador.
--
--    Ahora es esta función y solo esta función. Sin la llave del teléfono
--    que inscribió el sector, no hay forma de anularlo.
-- ------------------------------------------------------------
drop policy if exists p_coo_anular on coordinadores;
revoke update (anulado) on coordinadores from anon;
revoke update on coordinadores from anon;
drop function if exists device_actual();

create or replace function ae_retirar(p_id uuid, p_llave text)
returns integer language plpgsql security definer
set search_path = public, pg_temp as $$
declare n integer;
begin
  if coalesce(p_llave,'') = '' then return 0; end if;
  update coordinadores set anulado = true
   where id = p_id
     and llave <> ''
     and llave = encode(sha256(convert_to(p_llave, 'UTF8')), 'hex')
     and not anulado;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function ae_retirar(uuid, text) to anon, authenticated;

-- El administrador sí puede anular y verificar cualquiera, desde admin.html
drop policy if exists p_coo_admin on coordinadores;
create policy p_coo_admin on coordinadores
  for update to authenticated
  using (es_admin()) with check (es_admin());
grant update (anulado, verificado) on coordinadores to authenticated;

-- Un administrador puede cambiar "verificado" y "anulado"; nadie más toca nada.
create or replace function freno_coord_update() returns trigger
language plpgsql security definer as $$
begin
  if not es_admin() then
    new.verificado := old.verificado;
    new.tel_e164   := old.tel_e164;
    new.device     := old.device;
    new.codigo     := old.codigo;
    new.llave      := old.llave;
  end if;
  return new;
end $$;

drop trigger if exists tg_freno_coord_update on coordinadores;
create trigger tg_freno_coord_update before update on coordinadores
  for each row execute function freno_coord_update();

-- Los administradores también pueden limpiar datos falsos
drop policy if exists p_rep_admin on reportes;
create policy p_rep_admin on reportes for delete to authenticated using (es_admin());
drop policy if exists p_ent_admin on entregas;
create policy p_ent_admin on entregas for delete to authenticated using (es_admin());
grant delete on reportes, entregas to authenticated;

-- ------------------------------------------------------------
-- 5. VERIFICAR POR CÓDIGO (para el bot de WhatsApp, con service_role)
-- ------------------------------------------------------------
create or replace function verificar_coordinador(p_codigo text, p_tel text)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  update coordinadores set verificado = true
   where codigo = upper(trim(p_codigo))
     and tel_e164 = regexp_replace(p_tel, '\D', '', 'g')
     and not verificado and not anulado;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function verificar_coordinador(text, text) from anon;

-- ------------------------------------------------------------
-- 6. ARREGLAR LO QUE YA QUEDÓ MAL
-- ------------------------------------------------------------
-- ver pendientes:
--   select nombre, micro, zona, tel, codigo, creado
--     from coordinadores where not verificado and not anulado order by creado desc;
-- verificar a alguien a mano:
--   select verificar_coordinador('AE-938559', '+57 323 231 4100');
-- anular una fila mala:
--   update coordinadores set anulado = true where id = 'pegue-el-id-aqui';
--
-- Las filas inscritas ANTES de este archivo tienen la llave vacía: su dueño no
-- se puede retirar solo desde la app. Se anulan aquí o desde admin.html.
