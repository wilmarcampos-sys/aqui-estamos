# -*- coding: utf-8 -*-
"""
NORMALIZADOR DE DIRECCIONES Y TELÉFONOS · Aquí Estamos
=======================================================
Se usa al importar un archivo de censo nuevo, ANTES de subirlo.

Regla de oro: nunca inventa datos. Solo unifica la forma de lo que ya está.
Lo que no reconoce lo deja igual, porque una dirección rara pero cierta vale
más que una bonita pero inventada.

Uso:
    python3 normalizar.py entrada.csv salida.csv
    python3 normalizar.py --probar        # corre los ejemplos de abajo
"""
import re, sys, csv

# ---------------------------------------------------------------- direcciones

# Lo pegado se separa primero: "M11", "K31", "Cra12bis", "Mz4"
PEGADO = (r'\b(cra|cr|kra|kr|cll|cl|clle|mz|mza|mnz|man|manz|dg|tv|av|bl|blq'
          r'|cs|apto|apt|m|c|k|t)(?=\d)')

VIA = [
    (r'\b(cra|cr|kra|kr|k|carrera|carr)\b\.?',   'Carrera'),
    (r'\b(cll|cl|clle|calle)\b\.?',              'Calle'),
    (r'\b(dg|diag|diagonal)\b\.?',               'Diagonal'),
    (r'\b(tv|trans|transv|transversal)\b\.?',    'Transversal'),
    (r'\b(av|avda|avenida)\b\.?',                'Avenida'),
    (r'\b(mz|mza|mnz|man|manz|manzana)\b\.?',    'Manzana'),
    (r'\b(cs|csa|casa)\b\.?',                    'Casa'),
    (r'\b(apto|apt|apart|apartamento|apr)\b\.?', 'Apto'),
    (r'\b(blq|bloque)\b\.?',                     'Bloque'),
    (r'\b(torre)\b\.?',                          'Torre'),
    (r'\b(piso)\b\.?',                           'Piso'),
    (r'\b(lote)\b\.?',                           'Lote'),
    (r'\b(urb|urbanizacion|urbanización)\b\.?',  'Urbanización'),
    (r'\b(bo|br|bro|barrio)\b\.?',               'Barrio'),
    (r'\b(edif|edificio)\b\.?',                  'Edificio'),
]

def normalizar_direccion(d):
    if not d:
        return d
    t = ' ' + re.sub(r'\s+', ' ', str(d).strip()) + ' '
    t = re.sub(PEGADO, lambda m: m.group(1) + ' ', t, flags=re.I)

    # Una M o C sueltas delante de un número: manzana y casa.
    # Ojo: "MZ c" NO es Calle, es la manzana C — los barrios de Pereira
    # numeran las manzanas con letras (A, B, C, D...).
    t = re.sub(r'\bm\b(?=\s*\d)', 'Manzana', t, flags=re.I)
    t = re.sub(r'\bc\b(?=\s*\d)', 'Casa',    t, flags=re.I)
    t = re.sub(r'\bt\b(?=\s*\d)', 'Torre',   t, flags=re.I)

    t = re.sub(r'\b(n[oº°]?\.?|num(ero)?\.?)\s*(?=\d)', '# ', t, flags=re.I)
    t = re.sub(r'\s*[_/]\s*(?=\d)', '-', t)

    for pat, rep in VIA:
        t = re.sub(r'(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])' + pat + r'(?=\s|\d|$)',
                   rep, t, flags=re.I)

    t = re.sub(r'\s*#\s*', ' # ', t)
    t = re.sub(r'(#\s*\d+[A-Za-z]?)\s+(\d+)', r'\1-\2', t)
    t = re.sub(r'\b(Carrera|Calle|Diagonal|Transversal|Avenida)\s+'
               r'(\d+[A-Za-z]?)\s+(\d+[A-Za-z]?-\d+)', r'\1 \2 # \3', t)
    # la letra del número y la de la manzana, en mayúscula
    t = re.sub(r'(?<=\d)([a-z])(?=\b|-|\s|#)', lambda m: m.group(1).upper(), t)
    t = re.sub(r'\b(Manzana|Casa|Torre|Bloque)\s+([a-z])\b',
               lambda m: f'{m.group(1)} {m.group(2).upper()}', t)
    t = re.sub(r'\s*-\s*', '-', t)
    return re.sub(r'\s+', ' ', t).strip(' .,')


def direccion_utilizable(d, barrio=''):
    """¿Se puede llegar a esta casa con lo que dejó la familia?
    'Carrera 25 # 75B-63' sí; 'San Nicolás' no: el equipo llega al sector
    y ahí empieza a preguntar, y eso se come la jornada."""
    t = (d or '').strip()
    if not t or not re.search(r'\d', t) or len(t) < 9:
        return False
    return t.lower() != (barrio or '').strip().lower()


# ---------------------------------------------------------------- teléfonos

def normalizar_telefono(v):
    """Devuelve (e164, problema). Colombia: celular de 10 dígitos que empieza
    en 3. El formato malo no se descarta: se marca, para que alguien llame y
    lo corrija en vez de perder la ficha."""
    if not v:
        return None, 'sin teléfono'
    d = re.sub(r'\D', '', str(v))
    d = re.sub(r'^0+', '', d)
    if d.startswith('57') and len(d) == 12:
        d = d[2:]
    if len(d) == 10 and d.startswith('3'):
        return '+57' + d, None
    if len(d) == 7:
        return None, 'fijo sin indicativo'
    if len(d) < 7:
        return None, 'incompleto'
    return None, 'formato raro'


# ---------------------------------------------------------------- duplicados

def clave_duplicado(fila):
    """Tres señales, de más fuerte a más débil. La misma casa aparece escrita
    de tres formas distintas, así que el texto solo no alcanza: por eso el
    panel además muestra lo que reportan los equipos en la calle."""
    tel = re.sub(r'\D', '', str(fila.get('tel_e164') or ''))
    if tel:
        return 'tel:' + tel[-10:]
    dir_ = re.sub(r'[^a-z0-9]', '',
                  normalizar_direccion(fila.get('direccion') or '').lower())
    if dir_:
        return 'dir:' + dir_ + '|' + re.sub(r'[^a-z0-9]', '',
                                            (fila.get('barrio') or '').lower())
    nom = re.sub(r'[^a-z0-9]', '',
                 (str(fila.get('nombre') or '') + str(fila.get('apellido') or '')).lower())
    return 'nom:' + nom if nom else None


EJEMPLOS = [
    "Cra 17 n 22 42", "Mz 7 casa 7 samaria 2 piso 2", "Carrera 6#17-33",
    "CRA 1 26a-71 barrio San Juan pereira", "K31 # 15_47  barrio central",
    "Cll 19D #13-15 Torres de Maracay", "Cra 31  # 84-20 apto 1184",
    "calle 10 # 17-21 torre b apto 401 edif laguitos",
    "Centenario carrera 14 23-25", "Barrio guayabal mz 94 cs 15",
    "MZ c CS 12 los pinos", "M 21 CASA 14", "Calle 37 # 2 08",
    "M11 C31 perla del sur", "Calle 70A #43A-26 Mz4 Cs 5", "Cra12bis#14-47",
    "Mz 7 casa 19 apr 301 San Fernando, Cuba",
]

if __name__ == '__main__':
    if '--probar' in sys.argv or len(sys.argv) < 3:
        an = max(len(x) for x in EJEMPLOS)
        for e in EJEMPLOS:
            n = normalizar_direccion(e)
            ok = '' if direccion_utilizable(n) else '   ← sin número, hay que llamar'
            print(f'{e:<{an}}  →  {n}{ok}')
        sys.exit(0)

    ent, sal = sys.argv[1], sys.argv[2]
    vistos, filas, dups = {}, [], 0
    with open(ent, encoding='utf-8-sig') as f:
        for fila in csv.DictReader(f):
            fila['direccion'] = normalizar_direccion(fila.get('direccion'))
            tel, prob = normalizar_telefono(fila.get('tel_e164') or fila.get('telefono'))
            fila['tel_e164'] = tel
            fila['problema_tel'] = prob or ''
            fila['dir_utilizable'] = 'si' if direccion_utilizable(
                fila['direccion'], fila.get('barrio')) else 'no'
            k = clave_duplicado(fila)
            if k and k in vistos:
                dups += 1
                fila['duplicado_de'] = vistos[k]
                fila['revisar'] = 'duplicado'
            else:
                if k: vistos[k] = fila.get('ficha') or fila.get('nombre')
                fila['duplicado_de'] = ''
                fila['revisar'] = ''
            filas.append(fila)

    with open(sal, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader(); w.writerows(filas)

    sin_num = sum(1 for x in filas if x['dir_utilizable'] == 'no')
    sin_tel = sum(1 for x in filas if x['problema_tel'])
    print(f'{len(filas)} filas · {dups} posibles duplicados · '
          f'{sin_num} sin dirección utilizable · {sin_tel} con teléfono a revisar')
