-- ============================================================
-- Aquí Estamos · sembrar la NECESIDAD de instalación en cada albergue
-- ------------------------------------------------------------
-- Deja en cada uno de los 5 albergues tres necesidades rastreables:
--   · Instalar lavadoras / equipos   (instalequipo)
--   · Electricista (con norma)        (electricista)
--   · Plomero / fontanero             (plomero)
-- Así la instalación se ve en el mapa y en la ficha, y se puede marcar
-- cuando ya llegó el técnico (Registrar entrega).
--
-- Idempotente: se puede volver a correr (borra y reinserta las de
-- device='seed-albergue-need'). No toca reportes reales.
-- Correr en el SQL Editor de Supabase.
-- ============================================================

begin;

alter table reportes disable trigger tg_freno_reportes;
delete from reportes where device = 'seed-albergue-need';

insert into reportes (zona, necesidad, urgencia, lat, lng, referencia, nota, device) values
  -- 1. Cancha Barrio Mejía Robledo (Olímpica)
  ('olimpica','instalequipo',2,4.806830,-75.696631,'Cancha Barrio Mejía Robledo','2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.','seed-albergue-need'),
  ('olimpica','electricista',2,4.806830,-75.696631,'Cancha Barrio Mejía Robledo','Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.','seed-albergue-need'),
  ('olimpica','plomero',2,4.806830,-75.696631,'Cancha Barrio Mejía Robledo','Entradas de agua fría y desagüe por bomba (2").','seed-albergue-need'),

  -- 2. Coliseo Menor (Centro)
  ('centro','instalequipo',2,4.817335,-75.694007,'Coliseo Menor','2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.','seed-albergue-need'),
  ('centro','electricista',2,4.817335,-75.694007,'Coliseo Menor','Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.','seed-albergue-need'),
  ('centro','plomero',2,4.817335,-75.694007,'Coliseo Menor','Entradas de agua fría y desagüe por bomba (2").','seed-albergue-need'),

  -- 3. Coliseo Mayor Rafael Cuartas Gaviria (San Nicolás)
  ('sannicolas','instalequipo',2,4.815366,-75.708989,'Coliseo Mayor Rafael Cuartas Gaviria','2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.','seed-albergue-need'),
  ('sannicolas','electricista',2,4.815366,-75.708989,'Coliseo Mayor Rafael Cuartas Gaviria','Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.','seed-albergue-need'),
  ('sannicolas','plomero',2,4.815366,-75.708989,'Coliseo Mayor Rafael Cuartas Gaviria','Entradas de agua fría y desagüe por bomba (2").','seed-albergue-need'),

  -- 4. Caseta Comuna del Café, Sector A (Perla del Otún)
  ('perla','instalequipo',2,4.823609,-75.727002,'Caseta Comuna del Café, Sector A','2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.','seed-albergue-need'),
  ('perla','electricista',2,4.823609,-75.727002,'Caseta Comuna del Café, Sector A','Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.','seed-albergue-need'),
  ('perla','plomero',2,4.823609,-75.727002,'Caseta Comuna del Café, Sector A','Entradas de agua fría y desagüe por bomba (2").','seed-albergue-need'),

  -- 5. Estadio Mora Mora (Villa Santana)
  ('villasanta','instalequipo',2,4.807313,-75.670479,'Estadio Mora Mora','2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.','seed-albergue-need'),
  ('villasanta','electricista',2,4.807313,-75.670479,'Estadio Mora Mora','Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.','seed-albergue-need'),
  ('villasanta','plomero',2,4.807313,-75.670479,'Estadio Mora Mora','Entradas de agua fría y desagüe por bomba (2").','seed-albergue-need');

alter table reportes enable trigger tg_freno_reportes;

commit;

-- Comprobación:
--   select referencia, necesidad from reportes where device='seed-albergue-need' order by referencia;
--   → 15 filas (3 por albergue)
