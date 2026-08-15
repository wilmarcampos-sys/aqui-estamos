-- Mejía Robledo · agua y eléctrica van PRIMERO (bloquean las lavadoras)
-- Idempotente: pone el valor exacto, no acumula. Afecta 3 filas.

update reportes set urgencia = 3,
  nota = 'PRIORITARIO — bloquea la instalación de las lavadoras. Acometida 120V y 240V por norma, polo a tierra, circuitos independientes.'
 where device='seed-albergue-need' and referencia='Cancha Barrio Mejía Robledo' and necesidad='electricista';

update reportes set urgencia = 3,
  nota = 'PRIORITARIO — bloquea la instalación de las lavadoras. Entradas de agua fría y desagüe por bomba (2").'
 where device='seed-albergue-need' and referencia='Cancha Barrio Mejía Robledo' and necesidad='plomero';

update reportes set
  nota = 'No se puede instalar hasta que estén listas las instalaciones de agua y eléctrica. 2 torres lavadora/secadora. 4 circuitos: 2× 120V/20A (#12 AWG) + 2× 240V/30A (#10 AWG), tomas Leviton 3 polos.'
 where device='seed-albergue-need' and referencia='Cancha Barrio Mejía Robledo' and necesidad='instalequipo';
