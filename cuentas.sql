-- ============================================================
--  AQUÍ ESTAMOS · cuentas con celular y PIN
--  Correr en Supabase → SQL Editor, DESPUÉS de schema.sql y de
--  mantenimiento.sql. Repetible: no borra nada, solo agrega.
--
--  Las tablas se llaman ae_cuentas y ae_sesiones, con prefijo, porque en
--  la base ya había una tabla "cuentas" de otra cosa. No se toca: son
--  nombres distintos y conviven sin estorbarse.
-- ============================================================
--
--  POR QUÉ EXISTE ESTO
--  Sin verificación automática por WhatsApp, la única forma de que
--  alguien recupere su registro desde otro teléfono es que tenga con
--  qué demostrar que es él. Eso es el celular y el PIN.
--
--  EL PIN NO SE GUARDA. Se guarda su hash bcrypt, que no se puede
--  devolver. Ni el administrador puede ver un PIN. Por eso "se me
--  olvidó el PIN" se resuelve por WhatsApp y no desde la app.
--
--  NADIE LEE ESTAS TABLAS DIRECTO. No tienen políticas y se les
--  revoca todo: al navegador solo se le dejan las funciones de abajo,
--  que son las que deciden qué puede ver y qué puede cambiar.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------
create table if not exists ae_cuentas (
  id           uuid primary key default gen_random_uuid(),
  tel_e164     text        not null,            -- solo dígitos: 573001234567
  pin_hash     text        not null,            -- bcrypt. Nunca el PIN.
  nombre       text        not null,
  foto         text        default '',
  creado       timestamptz not null default now(),
  fallos       smallint    not null default 0,  -- intentos malos seguidos
  espera_hasta timestamptz                      -- hasta cuándo está frenada
);

create table if not exists ae_sesiones (
  token  text primary key,
  cuenta uuid,
  creado timestamptz not null default now(),
  vence  timestamptz not null default now() + interval '180 days'
);

-- "create table if not exists" no arregla una tabla que ya existe con otra
-- forma: la salta callado y después revienta al no encontrar la columna.
-- Estos alter la reparan, y no hacen nada si ya está bien. Así el archivo se
-- puede correr encima de cualquier estado sin borrar ni una fila.
alter table ae_cuentas  add column if not exists tel_e164     text;
alter table ae_cuentas  add column if not exists pin_hash     text;
alter table ae_cuentas  add column if not exists nombre       text;
alter table ae_cuentas  add column if not exists foto         text default '';
alter table ae_cuentas  add column if not exists creado       timestamptz not null default now();
alter table ae_cuentas  add column if not exists fallos       smallint not null default 0;
alter table ae_cuentas  add column if not exists espera_hasta timestamptz;

alter table ae_sesiones add column if not exists cuenta uuid;
alter table ae_sesiones add column if not exists creado timestamptz not null default now();
alter table ae_sesiones add column if not exists vence  timestamptz not null default now() + interval '180 days';

-- El dueño de una micro-zona pasa a ser la cuenta, no el teléfono.
-- Así quien entra con su PIN desde otro aparato sigue mandando sobre lo suyo.
alter table coordinadores add column if not exists cuenta uuid;

-- Las llaves foráneas, solo si faltan. Y antes, una comprobación: si
-- ae_cuentas existiera con otra forma, mejor un mensaje claro que el error
-- de llave foránea que costó media tarde entender.
do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ae_cuentas'
                    and column_name = 'id') then
    raise exception 'Ya existe una tabla ae_cuentas sin columna id. Revísela antes de seguir: este archivo no la va a tocar.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sesiones_cuenta_fk') then
    alter table ae_sesiones add constraint sesiones_cuenta_fk
      foreign key (cuenta) references ae_cuentas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coordinadores_cuenta_fk') then
    alter table coordinadores add constraint coordinadores_cuenta_fk
      foreign key (cuenta) references ae_cuentas(id);
  end if;
end $$;

create unique index if not exists ix_cuentas_tel  on ae_cuentas (tel_e164);
create index        if not exists ix_sesiones_cuenta on ae_sesiones (cuenta);
create index        if not exists ix_coord_cuenta on coordinadores (cuenta);

-- Nadie entra a estas dos tablas por la puerta de atrás.
alter table ae_cuentas  enable row level security;
alter table ae_sesiones enable row level security;
revoke all on ae_cuentas  from anon, authenticated;
revoke all on ae_sesiones from anon, authenticated;

-- ------------------------------------------------------------
-- 2. TODA ESCRITURA DE COORDINADORES PASA POR AQUÍ
--    El navegador pierde el insert directo: si no, cualquiera podría
--    inscribir coordinadores falsos o ponerse el sello de verificado.
--    La llave por teléfono de mantenimiento.sql queda sin uso: la cuenta
--    es mejor dueño. La columna se deja quieta, no se borra nada.
-- ------------------------------------------------------------
revoke insert on coordinadores from anon;
drop function if exists ae_retirar(uuid, text);

-- Un intento anterior de cuentas dejó estas mismas funciones con el token
-- como uuid. "create or replace" no las pisa — para Postgres son funciones
-- distintas porque cambia el tipo del argumento — y quedan las dos. Entonces
-- PostgREST no sabe cuál llamar y responde PGRST203 a todo.
-- Se van las viejas. Solo son funciones: no se pierde ningún dato.
drop function if exists ae_mis_datos(uuid);
drop function if exists ae_anular_zona(uuid, uuid);
drop function if exists ae_editar_cuenta(uuid, text, text, text, text);
drop function if exists ae_guardar_zona(uuid, uuid, text, text, integer,
                                        double precision, double precision, text, text);
-- La de registrar cambió de 4 a 5 argumentos, así que también quedó doble
drop function if exists ae_registrar(text, text, text, text);

-- Ya no hace falta: el navegador no puede hacer update de ninguna columna,
-- y las funciones de abajo controlan campo por campo lo que se toca.
drop trigger if exists tg_freno_coord_update on coordinadores;

-- El freno por dispositivo tiene que dejar de contar cuando el dispositivo
-- viene vacío. Las filas que crea ae_guardar_zona no traen aparato — el dueño
-- ahora es la cuenta — y sin este cambio las seis primeras inscripciones de
-- TODA la ciudad bloquearían a todo el mundo por una hora.
create or replace function freno_coord() returns trigger
language plpgsql security definer as $$
declare n integer;
begin
  new.verificado := false;      -- nadie se auto-verifica desde el navegador

  new.llave := case when coalesce(new.llave,'') = '' then ''
                    else encode(sha256(convert_to(new.llave, 'UTF8')), 'hex') end;

  if coalesce(new.device,'') <> '' then
    select count(*) into n from coordinadores
     where device = new.device and creado > now() - interval '1 hour';
    if n >= 6 then
      raise exception 'Demasiadas inscripciones desde este dispositivo.';
    end if;
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

-- ------------------------------------------------------------
-- 3. QUIÉN ES QUIÉN
-- ------------------------------------------------------------
-- Deja solo los dígitos y le pone el 57 a un celular colombiano de 10.
create or replace function ae_tel(p text) returns text
language sql immutable as $$
  select case
    when length(regexp_replace(coalesce(p,''), '\D', '', 'g')) = 10
     and left(regexp_replace(coalesce(p,''), '\D', '', 'g'), 1) = '3'
    then '57' || regexp_replace(coalesce(p,''), '\D', '', 'g')
    else regexp_replace(coalesce(p,''), '\D', '', 'g')
  end
$$;

-- La cuenta detrás de un token, o null si venció o no existe.
create or replace function ae_cuenta_de(p_token text) returns uuid
language sql stable security definer
set search_path = public, pg_temp as $$
  select cuenta from ae_sesiones
   where token = p_token and vence > now()
$$;

-- ------------------------------------------------------------
-- 4. CREAR CUENTA
-- ------------------------------------------------------------
create or replace function ae_registrar(
  p_tel text, p_pin text, p_nombre text,
  p_foto text default '', p_device text default '')
returns json language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_tel text; v_id uuid; v_token text;
begin
  v_tel := ae_tel(p_tel);
  if length(v_tel) < 10 then
    return json_build_object('ok', false, 'error', 'Revise el celular.');
  end if;
  if coalesce(p_pin,'') !~ '^\d{4,6}$' then
    return json_build_object('ok', false, 'error', 'El PIN son 4 números.');
  end if;
  if length(trim(coalesce(p_nombre,''))) < 3 then
    return json_build_object('ok', false, 'error', 'Escriba su nombre completo.');
  end if;

  if exists (select 1 from ae_cuentas where tel_e164 = v_tel) then
    return json_build_object('ok', false, 'ya_existe', true,
      'error', 'Ese celular ya tiene cuenta. Entre con su PIN.');
  end if;

  insert into ae_cuentas (tel_e164, pin_hash, nombre, foto)
  values (v_tel, crypt(p_pin, gen_salt('bf', 10)), trim(p_nombre), coalesce(p_foto,''))
  returning id into v_id;

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into ae_sesiones (token, cuenta) values (v_token, v_id);

  return json_build_object('ok', true, 'token', v_token, 'tel', v_tel,
                           'nombre', trim(p_nombre), 'foto', coalesce(p_foto,''));
end $$;

-- ------------------------------------------------------------
-- 5. ENTRAR
--    Un PIN de 4 números son 10.000 combinaciones: a pelo se adivina en
--    minutos. Por eso a los 5 fallos la cuenta se cierra un rato que va
--    creciendo, hasta una hora. Y el mensaje es el mismo si el celular no
--    existe o si el PIN está malo: nadie averigua qué números tienen cuenta.
-- ------------------------------------------------------------
create or replace function ae_entrar(p_tel text, p_pin text)
returns json language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare c ae_cuentas%rowtype; v_token text; v_min integer;
begin
  select * into c from ae_cuentas where tel_e164 = ae_tel(p_tel);
  if not found then
    return json_build_object('ok', false, 'error', 'Celular o PIN incorrecto.');
  end if;

  if c.espera_hasta is not null and c.espera_hasta > now() then
    v_min := greatest(1, ceil(extract(epoch from (c.espera_hasta - now())) / 60));
    return json_build_object('ok', false,
      'error', 'Demasiados intentos. Espere ' || v_min || ' minuto(s) y vuelva a probar.');
  end if;

  if c.pin_hash <> crypt(coalesce(p_pin,''), c.pin_hash) then
    update ae_cuentas
       set fallos = fallos + 1,
           espera_hasta = case when fallos + 1 >= 5
             then now() + (least(fallos + 1 - 4, 12) * interval '5 minutes')
             else null end
     where id = c.id;
    return json_build_object('ok', false, 'error', 'Celular o PIN incorrecto.');
  end if;

  update ae_cuentas set fallos = 0, espera_hasta = null where id = c.id;

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into ae_sesiones (token, cuenta) values (v_token, c.id);
  -- de paso, se limpian las sesiones vencidas de esa persona
  delete from ae_sesiones where cuenta = c.id and vence < now();

  return json_build_object('ok', true, 'token', v_token, 'tel', c.tel_e164,
                           'nombre', c.nombre, 'foto', coalesce(c.foto,''));
end $$;

-- ------------------------------------------------------------
-- 6. LO MÍO
-- ------------------------------------------------------------
create or replace function ae_mis_datos(p_token text)
returns json language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid; c ae_cuentas%rowtype;
begin
  v_id := ae_cuenta_de(p_token);
  if v_id is null then
    return json_build_object('ok', false, 'error', 'Su sesión venció. Entre otra vez.');
  end if;
  select * into c from ae_cuentas where id = v_id;

  return json_build_object(
    'ok', true,
    'cuenta', json_build_object('tel', c.tel_e164, 'nombre', c.nombre,
                                'foto', coalesce(c.foto,'')),
    'zonas', coalesce((
      select json_agg(json_build_object(
               'id', z.id, 'zona', z.zona, 'micro', z.micro, 'radio', z.radio,
               'lat', z.lat, 'lng', z.lng, 'rol', z.rol, 'nota', z.nota,
               'verificado', z.verificado, 'codigo', z.codigo)
             order by z.creado desc)
        from coordinadores z
       where z.cuenta = v_id and not z.anulado), '[]'::json));
end $$;

-- ------------------------------------------------------------
-- 7. EDITAR LA CUENTA
--    p_foto null = no la toque. '' = quítela.
--    Cambiar de celular manda las micro-zonas de vuelta a "esperando":
--    el sello verde decía que ESE número era suyo, y ya no es el mismo.
-- ------------------------------------------------------------
create or replace function ae_editar_cuenta(
  p_token text, p_nombre text default null, p_foto text default null,
  p_tel_nuevo text default null, p_pin_nuevo text default null)
returns json language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_id uuid; c ae_cuentas%rowtype; v_tel text; v_cambio_tel boolean := false;
begin
  v_id := ae_cuenta_de(p_token);
  if v_id is null then
    return json_build_object('ok', false, 'error', 'Su sesión venció. Entre otra vez.');
  end if;
  select * into c from ae_cuentas where id = v_id;

  if p_nombre is not null and length(trim(p_nombre)) < 3 then
    return json_build_object('ok', false, 'error', 'Escriba su nombre completo.');
  end if;
  if p_pin_nuevo is not null and p_pin_nuevo !~ '^\d{4,6}$' then
    return json_build_object('ok', false, 'error', 'El PIN son 4 números.');
  end if;

  if p_tel_nuevo is not null then
    v_tel := ae_tel(p_tel_nuevo);
    if length(v_tel) < 10 then
      return json_build_object('ok', false, 'error', 'Revise el celular nuevo.');
    end if;
    if v_tel <> c.tel_e164 then
      if exists (select 1 from ae_cuentas where tel_e164 = v_tel) then
        return json_build_object('ok', false, 'error', 'Ese celular ya tiene otra cuenta.');
      end if;
      v_cambio_tel := true;
    end if;
  end if;

  update ae_cuentas set
    nombre   = coalesce(nullif(trim(coalesce(p_nombre,'')), ''), nombre),
    foto     = case when p_foto is null then foto else p_foto end,
    tel_e164 = case when v_cambio_tel then v_tel else tel_e164 end,
    pin_hash = case when p_pin_nuevo is null then pin_hash
                    else crypt(p_pin_nuevo, gen_salt('bf', 10)) end
   where id = v_id;

  select * into c from ae_cuentas where id = v_id;

  -- los datos que se muestran en el mapa viajan copiados en cada micro-zona
  update coordinadores set
    nombre     = c.nombre,
    foto       = c.foto,
    tel        = '+' || c.tel_e164,
    tel_e164   = c.tel_e164,
    verificado = case when v_cambio_tel then false else verificado end
   where cuenta = v_id and not anulado;

  return json_build_object('ok', true, 'tel', c.tel_e164, 'nombre', c.nombre,
                           'foto', coalesce(c.foto,''), 'reverificar', v_cambio_tel);
end $$;

-- ------------------------------------------------------------
-- 8. INSCRIBIR O CORREGIR UNA MICRO-ZONA
--    Con p_id se corrige una propia; sin p_id se inscribe una nueva.
--    Corregir el punto, el radio, el rol o la nota NO quita el sello verde:
--    lo verificado es que el teléfono sea suyo, no dónde se para.
-- ------------------------------------------------------------
create or replace function ae_guardar_zona(
  p_token text, p_id uuid, p_zona text, p_micro text, p_radio integer,
  p_lat double precision, p_lng double precision,
  p_rol text default '', p_nota text default '')
returns json language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare v_id uuid; c ae_cuentas%rowtype; v_codigo text; n integer;
begin
  v_id := ae_cuenta_de(p_token);
  if v_id is null then
    return json_build_object('ok', false, 'error', 'Su sesión venció. Entre otra vez.');
  end if;
  select * into c from ae_cuentas where id = v_id;

  if coalesce(trim(p_micro),'') = '' then
    return json_build_object('ok', false, 'error', 'Póngale nombre al sector.');
  end if;
  if p_lat is null or p_lng is null or coalesce(p_zona,'') = '' then
    return json_build_object('ok', false, 'error', 'Falta marcar el punto en el mapa.');
  end if;
  if coalesce(p_radio, 500) not between 100 and 2000 then
    return json_build_object('ok', false, 'error', 'El radio tiene que estar entre 100 y 2000 metros.');
  end if;

  -- CORREGIR una propia
  if p_id is not null then
    update coordinadores set
      zona = p_zona, micro = trim(p_micro), radio = coalesce(p_radio,500),
      lat = p_lat, lng = p_lng, rol = coalesce(p_rol,''), nota = coalesce(p_nota,'')
     where id = p_id and cuenta = v_id and not anulado;
    get diagnostics n = row_count;
    if n = 0 then
      return json_build_object('ok', false, 'error', 'Ese sector no es suyo o ya se retiró.');
    end if;
    select codigo into v_codigo from coordinadores where id = p_id;
    return json_build_object('ok', true, 'codigo', v_codigo, 'id', p_id);
  end if;

  -- INSCRIBIR una nueva
  select count(*) into n from coordinadores
   where cuenta = v_id and not anulado
     and zona = p_zona and lower(micro) = lower(trim(p_micro));
  if n > 0 then
    return json_build_object('ok', false, 'error', 'Ya está inscrito en ese sector.');
  end if;

  select count(*) into n from coordinadores
   where cuenta = v_id and creado > now() - interval '1 hour';
  if n >= 6 then
    return json_build_object('ok', false, 'error', 'Va muy rápido. Espere un rato.');
  end if;

  v_codigo := 'AE-' || lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  insert into coordinadores (zona, micro, radio, lat, lng, nombre, rol, tel, tel_e164,
                             email, nota, foto, codigo, device, cuenta)
  values (p_zona, trim(p_micro), coalesce(p_radio,500), p_lat, p_lng,
          c.nombre, coalesce(p_rol,''), '+' || c.tel_e164, c.tel_e164,
          '', coalesce(p_nota,''), coalesce(c.foto,''), v_codigo, '', v_id);

  return json_build_object('ok', true, 'codigo', v_codigo);
end $$;

-- ------------------------------------------------------------
-- 9. RETIRARSE DE UN SECTOR
--    La fila no se borra nunca: se marca anulada y el histórico queda.
-- ------------------------------------------------------------
create or replace function ae_anular_zona(p_token text, p_id uuid)
returns json language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid; n integer;
begin
  v_id := ae_cuenta_de(p_token);
  if v_id is null then
    return json_build_object('ok', false, 'error', 'Su sesión venció. Entre otra vez.');
  end if;
  update coordinadores set anulado = true
   where id = p_id and cuenta = v_id and not anulado;
  get diagnostics n = row_count;
  if n = 0 then
    return json_build_object('ok', false, 'error', 'Ese sector no es suyo o ya se retiró.');
  end if;
  return json_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- 10. PERMISOS
--     Lo único que el navegador puede llamar. Las tablas siguen cerradas.
-- ------------------------------------------------------------
grant execute on function ae_registrar(text, text, text, text, text) to anon, authenticated;
grant execute on function ae_entrar(text, text)                      to anon, authenticated;
grant execute on function ae_mis_datos(text)                         to anon, authenticated;
grant execute on function ae_editar_cuenta(text, text, text, text, text) to anon, authenticated;
grant execute on function ae_guardar_zona(text, uuid, text, text, integer,
       double precision, double precision, text, text)               to anon, authenticated;
grant execute on function ae_anular_zona(text, uuid)                 to anon, authenticated;

-- ae_cuenta_de decide de quién es cada cosa: si el navegador la pudiera
-- llamar, podría probar tokens hasta acertar. Solo la usan las de arriba.
--
-- Va "from public" y no solo "from anon": Postgres le regala EXECUTE a PUBLIC
-- a toda función nueva, y anon hereda de ahí. Revocarle a anon solo no sirve
-- de nada — la función seguía abierta. Cuesta ver y es fácil de repetir.
revoke all on function ae_cuenta_de(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 11. DEVOLVERLE LA CUENTA A ALGUIEN QUE OLVIDÓ EL PIN
--     El PIN no se puede leer, así que no hay nada que "recordarle":
--     se le pone uno nuevo, después de confirmar por WhatsApp que es él.
--     Correr a mano aquí, nunca desde el navegador.
-- ------------------------------------------------------------
-- update ae_cuentas
--    set pin_hash = crypt('1234', gen_salt('bf', 10)), fallos = 0, espera_hasta = null
--  where tel_e164 = '573105550142';
--
-- ver quién está frenado por intentos fallidos:
--   select tel_e164, nombre, fallos, espera_hasta from ae_cuentas
--    where espera_hasta > now();
