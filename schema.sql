-- ============================================================
--  FLASH HELP · esquema de base de datos (Supabase / Postgres)
--  Pegue TODO este archivo en Supabase → SQL Editor → Run.
--  Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------

-- Necesidades reportadas por la comunidad. Nunca se borran ni se editan:
-- el histórico es lo que permite auditar quién pidió qué y cuándo.
create table if not exists reportes (
  id          uuid primary key default gen_random_uuid(),
  zona        text        not null,
  necesidad   text        not null,
  urgencia    smallint    not null default 3 check (urgencia between 1 and 3),
  lat         double precision not null,
  lng         double precision not null,
  referencia  text        default '',
  personas    integer     default 0 check (personas >= 0 and personas <= 100000),
  nota        text        default '',
  device      text        not null,
  creado      timestamptz not null default now()
);

-- Entregas registradas. Esto es lo que apaga las alertas del mapa.
create table if not exists entregas (
  id          uuid primary key default gen_random_uuid(),
  zona        text        not null,
  necesidad   text        not null,
  lat         double precision not null,
  lng         double precision not null,
  quien       text        default 'Anónimo',
  cantidad    text        default '',
  device      text        not null,
  creado      timestamptz not null default now()
);

-- Coordinadores de micro-zona. Una persona puede tener varias filas.
create table if not exists coordinadores (
  id          uuid primary key default gen_random_uuid(),
  zona        text        not null,
  micro       text        default '',
  radio       integer     not null default 500 check (radio between 100 and 2000),
  lat         double precision not null,
  lng         double precision not null,
  nombre      text        not null,
  rol         text        default '',
  tel         text        not null,
  tel_e164    text        not null,          -- solo dígitos, para WhatsApp
  email       text        default '',
  nota        text        default '',
  foto        text        default '',        -- data URL comprimida (~20 KB)
  verificado  boolean     not null default false,
  codigo      text        default '',        -- código que debe enviar por WhatsApp
  device      text        not null,
  creado      timestamptz not null default now()
);

create index if not exists ix_reportes_zona   on reportes (zona, creado desc);
create index if not exists ix_reportes_pos    on reportes (lat, lng);
create index if not exists ix_entregas_zona   on entregas (zona, creado desc);
create index if not exists ix_coord_zona      on coordinadores (zona);
create index if not exists ix_coord_tel       on coordinadores (tel_e164);

-- ------------------------------------------------------------
-- 2. FRENO ANTI-ABUSO  (se aplica en la base, no solo en el celular)
-- ------------------------------------------------------------
-- Límites por dispositivo y ventana de tiempo. Generosos a propósito:
-- la idea es frenar un script, no a un vecino que reporta mucho.

create or replace function freno_reportes() returns trigger
language plpgsql security definer as $$
declare n integer;
begin
  select count(*) into n from reportes
   where device = new.device and creado > now() - interval '10 minutes';
  if n >= 25 then
    raise exception 'Demasiados reportes seguidos desde este dispositivo. Espere unos minutos.';
  end if;

  -- mismo aparato, misma necesidad, mismo sitio, en menos de 3 minutos = duplicado
  select count(*) into n from reportes
   where device = new.device and necesidad = new.necesidad
     and abs(lat - new.lat) < 0.0003 and abs(lng - new.lng) < 0.0003
     and creado > now() - interval '3 minutes';
  if n > 0 then
    raise exception 'Ese reporte ya se envió hace un momento.';
  end if;

  return new;
end $$;

drop trigger if exists tg_freno_reportes on reportes;
create trigger tg_freno_reportes before insert on reportes
  for each row execute function freno_reportes();

create or replace function freno_entregas() returns trigger
language plpgsql security definer as $$
declare n integer;
begin
  select count(*) into n from entregas
   where device = new.device and creado > now() - interval '10 minutes';
  if n >= 40 then
    raise exception 'Demasiadas entregas seguidas desde este dispositivo.';
  end if;
  return new;
end $$;

drop trigger if exists tg_freno_entregas on entregas;
create trigger tg_freno_entregas before insert on entregas
  for each row execute function freno_entregas();

create or replace function freno_coord() returns trigger
language plpgsql security definer as $$
declare n integer;
begin
  new.verificado := false;      -- nadie se auto-verifica desde el navegador
  select count(*) into n from coordinadores
   where device = new.device and creado > now() - interval '1 hour';
  if n >= 6 then
    raise exception 'Demasiadas inscripciones desde este dispositivo.';
  end if;
  -- una misma persona no repite la misma micro-zona
  select count(*) into n from coordinadores
   where tel_e164 = new.tel_e164 and zona = new.zona
     and lower(coalesce(micro,'')) = lower(coalesce(new.micro,''));
  if n > 0 then
    raise exception 'Ya está inscrito en esa micro-zona.';
  end if;
  return new;
end $$;

drop trigger if exists tg_freno_coord on coordinadores;
create trigger tg_freno_coord before insert on coordinadores
  for each row execute function freno_coord();

-- ------------------------------------------------------------
-- 3. PERMISOS (RLS)
--    Todo el mundo lee. Todo el mundo inserta. Nadie edita ni borra.
--    Que no se pueda borrar es deliberado: en una emergencia el riesgo
--    real es que alguien limpie el mapa, no que sobre información.
-- ------------------------------------------------------------

alter table reportes      enable row level security;
alter table entregas      enable row level security;
alter table coordinadores enable row level security;

drop policy if exists p_rep_leer  on reportes;
drop policy if exists p_rep_crear on reportes;
create policy p_rep_leer  on reportes for select to anon, authenticated using (true);
create policy p_rep_crear on reportes for insert to anon, authenticated with check (true);

drop policy if exists p_ent_leer  on entregas;
drop policy if exists p_ent_crear on entregas;
create policy p_ent_leer  on entregas for select to anon, authenticated using (true);
create policy p_ent_crear on entregas for insert to anon, authenticated with check (true);

drop policy if exists p_coo_leer  on coordinadores;
drop policy if exists p_coo_crear on coordinadores;
create policy p_coo_leer  on coordinadores for select to anon, authenticated using (true);
create policy p_coo_crear on coordinadores for insert to anon, authenticated with check (true);

-- La verificación por WhatsApp la hace el servidor con la service_role key,
-- nunca el navegador. Esta función es la que llama ese proceso.
create or replace function verificar_coordinador(p_codigo text, p_tel text)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  update coordinadores set verificado = true
   where codigo = upper(trim(p_codigo))
     and tel_e164 = regexp_replace(p_tel, '\D', '', 'g')
     and verificado = false;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function verificar_coordinador(text, text) from anon, authenticated;

-- ------------------------------------------------------------
-- 4. TIEMPO REAL
-- ------------------------------------------------------------
alter publication supabase_realtime add table reportes;
alter publication supabase_realtime add table entregas;
alter publication supabase_realtime add table coordinadores;
