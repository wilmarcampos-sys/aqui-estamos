# Importar un censo nuevo

Orden fijo. Cada paso depende del anterior, y saltarse uno se paga después
en la calle: una dirección mal escrita es media hora perdida para un equipo
de tres personas.

---

## 1. Normalizar antes de subir

```bash
python3 tools/normalizar.py entrada.csv salida.csv
```

Unifica la forma de direcciones y teléfonos y agrega cuatro columnas:

| Columna | Qué dice |
|---|---|
| `dir_utilizable` | `no` si la dirección no tiene número o es solo el barrio |
| `problema_tel` | `sin teléfono`, `fijo sin indicativo`, `incompleto`, `formato raro` |
| `duplicado_de` | la ficha con la que choca |
| `revisar` | `duplicado` |

**Nunca inventa datos.** Lo que no reconoce lo deja igual: una dirección rara
pero cierta vale más que una bonita pero inventada.

Ejemplos reales del censo de agosto:

```
Cra 17 n 22 42            →  Carrera 17 # 22-42
K31 # 15_47 barrio central →  Carrera 31 # 15-47 Barrio central
MZ c CS 12 los pinos      →  Manzana C Casa 12 los pinos
M11 C31 perla del sur     →  Manzana 11 Casa 31 perla del sur
Calle 70A #43A-26 Mz4 Cs 5 →  Calle 70A # 43A-26 Manzana 4 Casa 5
Cra12bis#14-47            →  Carrera 12bis # 14-47
```

Ojo con `MZ c`: **no** es Calle. Los barrios de Pereira numeran las manzanas
con letras, así que es la manzana C.

## 2. Geocodificar

Una cascada, en este orden, parando en el primero que responda:

1. **Nominatim** (OpenStreetMap) — máximo 1 consulta por segundo,
   `countrycodes=co`. Es el que da direcciones exactas.
2. **Photon** — para lo que Nominatim no encuentre.
3. **Gacetero local de barrios** — el diccionario de barrios de Pereira,
   Dosquebradas y La Virginia que ya está en el panel.
4. **Centroide de comuna** — último recurso.

Todo lo que salga de 3 o 4 se guarda con `ubicacion_aprox = true`. Eso
importa: son las que el armador de rutas baja en la fila, porque el punto
está en el centro del barrio y no en la casa.

## 3. Subir y revisar en el panel

Después de subir, hay tres listas de trabajo en **Ubicar**:

- **Sin ubicar** — no tienen punto. Se ubican en el mapa.
- **Aproximadas** — están al centroide. Se afinan.
- **Sin número** — la dirección no sirve para llegar. **Esto se resuelve
  llamando**, no en el mapa: se marca a la familia y se corrige la dirección
  ahí mismo.

Y en **Inicio**, la bandeja de revisión:

- **Lo que reportaron los equipos** — los comentarios de la calle. De la
  jornada de agosto, tres de cuatro eran correcciones al censo, no notas de
  visita: *"número errado"*, *"es el esposo de blanca ruby registro doble"*.
- **Posibles fichas repetidas** — mismo teléfono, dirección o nombre.

## 4. Lo que el detector NO encuentra

`Cra12bis#14-47` y `CRA 12B # 14-47 Pereira` son la misma casa. Para el
detector son distintas: teléfonos distintos, nombres distintos, direcciones
que normalizan diferente. Solo lo pilló el equipo en la puerta.

**Por eso la bandeja de reportes va primero que el detector automático.**

---

## Chequeo antes de programar una jornada

```sql
-- lo que hay que mirar despues de importar
select
  count(*)                                                      as viviendas,
  count(*) filter (where lat is null)                           as sin_ubicar,
  count(*) filter (where coalesce(ubicacion_aprox,false))       as aproximadas,
  count(*) filter (where direccion is null or direccion !~ '[0-9]') as sin_numero,
  count(*) filter (where coalesce(btrim(barrio),'') = '')       as sin_barrio,
  count(*) filter (where tel_e164 is null)                      as sin_telefono
from censo where coalesce(archivada,false) = false;

select count(*) as grupos_duplicados from duplicados_censo();
```
