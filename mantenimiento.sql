-- ============================================================
--  AQUÍ ESTAMOS · corrección propia + administración
--  Correr en Supabase → SQL Editor. Repetible, no rompe nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PODER CORREGIR LO PROPIO
--    Faltaba: quien se inscribía con un dato malo no tenía cómo arreglarlo.
--    Se agrega "anulado". Nadie edita ni borra filas ajenas; solo se puede
--    anular una propia, y solo desde el mismo aparato que la creó.
-- ------------------------------------------------------------
alter table coordinadores add column if not exists anulado boolean not null default false;
create index if not exists ix_coord_activos on coordinadores (zona) where not anulado;

-- El navegador manda su identificador de aparato en una cabecera.
create or replace function device_actual() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true)::json->>'x-aparato',''), '')
$$;

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
-- 3. PERMISOS DE ESCRITURA CONTROLADA
--    El vecino solo puede anular lo suyo.
--    El administrador puede verificar y anular cualquiera.
-- ------------------------------------------------------------
drop policy if exists p_coo_anular on coordinadores;
create policy p_coo_anular on coordinadores
  for update to anon, authenticated
  using      (device = device_actual() and device_actual() <> '')
  with check (device = device_actual() and device_actual() <> '');

drop policy if exists p_coo_admin on coordinadores;
create policy p_coo_admin on coordinadores
  for update to authenticated
  using (es_admin()) with check (es_admin());

grant update (anulado) on coordinadores to anon;
grant update (anulado, verificado) on coordinadores to authenticated;

-- El vecino nunca puede tocar su propio "verificado"; el administrador sí.
create or replace function freno_coord_update() returns trigger
language plpgsql security definer as $$
begin
  if not es_admin() then
    new.verificado := old.verificado;
    new.tel_e164   := old.tel_e164;
    new.device     := old.device;
    new.codigo     := old.codigo;
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
-- 4. VERIFICAR POR CÓDIGO (para el bot de WhatsApp, con service_role)
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
-- 5. ARREGLAR LO QUE YA QUEDÓ MAL
-- ------------------------------------------------------------
-- ver pendientes:
--   select nombre, micro, zona, tel, codigo, creado
--     from coordinadores where not verificado and not anulado order by creado desc;
-- verificar a alguien a mano:
--   select verificar_coordinador('AE-938559', '+57 323 231 4100');
-- anular una fila mala:
--   update coordinadores set anulado = true where id = 'pegue-el-id-aqui';
