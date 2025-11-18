from django.shortcuts import render, get_object_or_404, redirect
import csv, io, json, statistics, re
import matplotlib
matplotlib.use("Agg")  # backend sin ventana
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from math import sqrt, pi, exp

# BASE DE DATOS - MONGODB
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import Maestro, Alumno
from .decorators import maestro_login_required, solo_maestro_required  # ← AGREGAR ESTE IMPORT


def home(request):
    contexto = {
        'maestro_id': request.session.get('maestro_id'),
        'maestro_correo': request.session.get('maestro_correo'),
        'alumno_id': request.session.get('alumno_id'),
        'alumno_correo': request.session.get('alumno_correo'),
        'tipo_usuario': request.session.get('tipo_usuario'),
        'nombre_usuario': request.session.get('nombre_usuario'),
    }
    
    # Redirigir según el tipo de usuario
    if request.session.get('tipo_usuario') == 'alumno':
        return render(request, 'page/home_alumno.html', contexto)
    elif request.session.get('tipo_usuario') == 'maestro':
        return render(request, 'page/home.html', contexto)
    
    # Si no hay sesión, mostrar la página de inicio general
    return render(request, 'page/home.html', contexto)


def estratificacion(request):
    """
    Estratificación por Carrera × Semestre.
    - Sube CSV y se habilitan filtros dinámicos en el cliente.
    - Detecta columnas: calificación (0–10), carrera, semestre.
    - El cliente calcula los promedios por (carrera, semestre) y grafica.
    Encabezados aceptados:
      calificación: calificacion, calificaciones, nota, notas, grade, grades, puntaje, puntuacion
      carrera: carrera, programa, especialidad, major, degree, escuela
      semestre: semestre, term, periodo
    """
    context = {
        'page_title': 'Estratificación',
        'message': 'Sube un CSV con columnas de carrera, semestre y calificación (0–10).',
        'data_json': '[]',      # filas originales (ya normalizadas)
        'carreras': [],         # lista única para poblar controles
        'semestres': []         # lista única (orden ascendente)
    }

    if request.method == 'POST':
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            context['message'] = 'Adjunta un archivo CSV.'
            return render(request, 'page/estratificacion.html', context)

        # Leer CSV con detección de delimitador
        try:
            text_stream = io.TextIOWrapper(csv_file.file, encoding='utf-8', errors='replace')
            sample = text_stream.read(4096); text_stream.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t,")
            except Exception:
                class SimpleDialect(csv.Dialect):
                    delimiter = ','
                    quotechar = '"'
                    escapechar = None
                    doublequote = True
                    skipinitialspace = True
                    lineterminator = '\n'
                dialect = SimpleDialect()
            reader = csv.DictReader(text_stream, dialect=dialect)
            rows = list(reader)
            headers = [h for h in (reader.fieldnames or []) if h]
        except Exception as e:
            context['message'] = f'No se pudo leer el CSV: {e}'
            return render(request, 'page/estratificacion.html', context)

        if not rows or not headers:
            context['message'] = 'El CSV parece vacío o sin encabezados.'
            return render(request, 'page/estratificacion.html', context)

        # Normalizador
        def norm(s: str) -> str:
            s = (s or '').strip().lower()
            trans = str.maketrans('áéíóúüñ', 'aeiouun')
            return s.translate(trans)

        cali_targets  = {'calificacion','calificaciones','nota','notas','grade','grades','puntaje','puntuacion'}
        carrera_targets = {'carrera','programa','especialidad','major','degree','escuela'}
        semestre_targets = {'semestre','term','periodo'}

        header_map = {h: norm(h) for h in headers}
        col_calif   = next((orig for orig, nrm in header_map.items() if nrm in cali_targets), None)
        col_carrera = next((orig for orig, nrm in header_map.items() if nrm in carrera_targets), None)
        col_sem     = next((orig for orig, nrm in header_map.items() if nrm in semestre_targets), None)

        missing = []
        if not col_calif:   missing.append('calificación')
        if not col_carrera: missing.append('carrera')
        if not col_sem:     missing.append('semestre')
        if missing:
            context['message'] = 'Faltan columnas: ' + ', '.join(missing) + '.'
            return render(request, 'page/estratificacion.html', context)

        # Normalizar filas: carrera (str), semestre (int), calificacion (0–10 float)
        data = []
        carreras_set, sem_set = set(), set()
        ignored = 0
        for r in rows:
            carrera = (r.get(col_carrera) or '').strip()
            sem_raw = (r.get(col_sem) or '').strip()
            cal_raw = (r.get(col_calif) or '').strip().replace(',', '.')

            if carrera == '' or sem_raw == '' or cal_raw == '':
                continue

            # semestre a int (permitimos "Semestre 3", "3", etc.)
            try:
                # extraer primer número
                import re
                m = re.search(r'-?\d+', sem_raw)
                semestre = int(m.group()) if m else int(sem_raw)
            except Exception:
                ignored += 1
                continue

            try:
                cal = float(cal_raw)
            except ValueError:
                ignored += 1
                continue

            if not (0 <= cal <= 10):
                ignored += 1
                continue

            data.append({'carrera': str(carrera), 'semestre': int(semestre), 'calificacion': float(cal)})
            carreras_set.add(str(carrera))
            sem_set.add(int(semestre))

        if not data:
            context['message'] = 'No se encontraron registros válidos (carrera, semestre, calificación 0–10).'
            return render(request, 'page/estratificacion.html', context)

        context.update({
            'data_json': json.dumps(data),
            'carreras': sorted(list(carreras_set)),
            'semestres': sorted(list(sem_set)),
            'message': f'Registros válidos: {len(data)}. Ignorados: {ignored}.'
        })

    return render(request, 'page/estratificacion.html', context)

def _kde_gauss_scaled_to_counts(values, grid, bin_width=0.5):
    """
    KDE gaussiana simple (sin SciPy), escalada a 'counts' para que
    la curva quede en la misma escala del histograma (como seaborn).
    """
    x = np.asarray(values, dtype=float)
    n = len(x)
    if n == 0:
        return np.zeros_like(grid)

    # Regla de Silverman para ancho de banda
    std = np.std(x, ddof=1) if n > 1 else 0.1
    iqr = np.subtract(*np.percentile(x, [75, 25])) if n > 1 else 0.0
    sigma = min(std, iqr / 1.34) if (std > 0 and iqr > 0) else std or 0.1
    bw = 1.06 * sigma * (n ** (-1/5)) if sigma > 0 else 0.2

    grid = np.asarray(grid, dtype=float)
    inv = 1.0 / (bw * sqrt(2*pi))
    # Densidad
    dens = np.zeros_like(grid)
    for xi in x:
        dens += np.exp(-0.5 * ((grid - xi)/bw) ** 2) * inv
    dens /= n

    # Escalar a "counts" ~ densidad * n * bin_width
    counts = dens * n * bin_width
    return counts

def histograma(request):
    """
    Histograma interactivo (0–10) estilo seaborn:
      • Barras 'dodge' por carrera (si existe columna de carrera)
      • Curva KDE por carrera superpuesta (escalada a 'counts')
    CSV: columna de calificación (0–10)
         opcional: columna de carrera/programa/especialidad/major/degree/escuela
    """
    context = {
        'page_title': 'Histograma de Calificaciones (0–10)',
        'message': 'Sube un CSV con calificaciones (0–10). Si incluye columna de carrera, se comparan lado a lado.',
        'series_json': '[]',        # [{name, values:[...]}, ...]
        'kde_json': '[]',           # [{name, x:[...], y:[...]}, ...]
        'group_colname': None,
        'stats': None
    }

    if request.method == 'POST':
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            context['message'] = 'Adjunta un archivo CSV.'
            return render(request, 'page/histograma.html', context)

        # --- Leer CSV ---
        try:
            text_stream = io.TextIOWrapper(csv_file.file, encoding='utf-8', errors='replace')
            sample = text_stream.read(4096); text_stream.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t,")
            except Exception:
                class SimpleDialect(csv.Dialect):
                    delimiter = ','
                    quotechar = '"'
                    escapechar = None
                    doublequote = True
                    skipinitialspace = True
                    lineterminator = '\n'
                dialect = SimpleDialect()
            reader = csv.DictReader(text_stream, dialect=dialect)
            rows = list(reader)
            headers = [h for h in (reader.fieldnames or []) if h]
        except Exception as e:
            context['message'] = f'No se pudo leer el CSV: {e}'
            return render(request, 'page/histograma.html', context)

        if not rows or not headers:
            context['message'] = 'El CSV parece vacío o sin encabezados.'
            return render(request, 'page/histograma.html', context)

        # Normalizador simple (quita acentos / minúsculas)
        def norm(s: str) -> str:
            s = (s or '').strip().lower()
            trans = str.maketrans('áéíóúüñ', 'aeiouun')
            return s.translate(trans)

        cali_targets  = {'calificacion','calificaciones','nota','notas','grade','grades','puntaje','puntuacion'}
        group_targets = {'carrera','programa','especialidad','major','degree','escuela'}

        header_map = {h: norm(h) for h in headers}
        col_calif = next((orig for orig, nrm in header_map.items() if nrm in cali_targets), None)
        col_group = next((orig for orig, nrm in header_map.items() if nrm in group_targets), None)
        context['group_colname'] = col_group

        if not col_calif:
            context['message'] = ('No se encontró columna de calificaciones. Encabezados válidos: '
                                  'calificacion, calificaciones, nota, notas, grade, grades, puntaje, puntuacion.')
            return render(request, 'page/histograma.html', context)

        # --- Extraer valores (0–10) y agrupar ---
        all_vals, ignored = [], 0
        groups = {}  # name -> list[float]
        for r in rows:
            raw = (r.get(col_calif, '') or '').strip()
            if not raw:
                continue
            raw = raw.replace(',', '.')
            try:
                v = float(raw)
                if 0 <= v <= 10:
                    all_vals.append(v)
                    g = (r.get(col_group) or 'General') if col_group else 'General'
                    groups.setdefault(str(g), []).append(v)
                else:
                    ignored += 1
            except ValueError:
                ignored += 1

        if not all_vals:
            context['message'] = f'La columna "{col_calif}" no contiene calificaciones válidas en rango 0–10.'
            return render(request, 'page/histograma.html', context)

        # Estadísticos globales
        stats = {
            'n': len(all_vals),
            'min': round(min(all_vals), 2),
            'max': round(max(all_vals), 2),
            'mean': round(statistics.fmean(all_vals), 2),
            'median': round(statistics.median(all_vals), 2),
            'stdev': round(statistics.pstdev(all_vals), 2) if len(all_vals) > 1 else 0.0,
            'ignored': ignored
        }
        context['stats'] = stats

        # Limitar a top 8 categorías por tamaño
        ordered = sorted(groups.items(), key=lambda kv: -len(kv[1]))[:8]
        series = [{'name': k, 'values': v} for k, v in ordered]

        # KDE por categoría (grid fijo y bin_width para escalar)
        grid = np.linspace(0, 10, 201)  # cada 0.05
        bin_width = 0.5                 # hist bins de 0.5 (dodge)
        kde = []
        for s in series:
            y = _kde_gauss_scaled_to_counts(s['values'], grid, bin_width=bin_width)
            kde.append({'name': s['name'], 'x': grid.tolist(), 'y': [round(float(t), 6) for t in y]})

        context.update({
            'series_json': json.dumps(series),
            'kde_json': json.dumps(kde),
            'message': f'Detectadas {len(all_vals)} calificaciones (0–10){f" y agrupadas por {col_group}" if col_group else ""}.'
        })

    return render(request, 'page/histograma.html', context)

def pareto(request):
    """
    Diagrama de Pareto por carrera con factores en columnas:
      riesgo_academico, riesgo_economico, riesgo_psicosocial,
      riesgo_institucional, riesgo_tecnologico, riesgo_contextual

    También detecta variaciones (tildes, espacios, guiones, underscores).
    La columna de carrera puede llamarse: carrera / programa / especialidad / major / degree / escuela.
    Los valores de riesgo pueden ser 0/1, números, o texto tipo 'si', 'sí', 'true' -> 1 (lo demás 0).
    """
    context = {
        'page_title': 'Diagrama de Pareto',
        'message': 'Sube un CSV con columnas de carrera y columnas de riesgo (académico, económico, psicosocial, institucional, tecnológico, contextual).',
        # [{ carrera: "Ing. Sistemas", riesgos: {"Académico": 12, ...} }]
        'agg_json': '[]',
        'carreras': [],
        'factors_display': ['Académico','Económico','Psicosocial','Institucional','Tecnológico','Contextual'],
    }

    if request.method == 'POST':
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            context['message'] = 'Adjunta un archivo CSV.'
            return render(request, 'page/pareto.html', context)

        # Leer CSV con detección de delimitador
        try:
            text = io.TextIOWrapper(csv_file.file, encoding='utf-8', errors='replace')
            sample = text.read(4096); text.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t,")
            except Exception:
                class SimpleDialect(csv.Dialect):
                    delimiter = ','
                    quotechar = '"'
                    escapechar = None
                    doublequote = True
                    skipinitialspace = True
                    lineterminator = '\n'
                dialect = SimpleDialect()
            reader = csv.DictReader(text, dialect=dialect)
            rows = list(reader)
            headers = [h for h in (reader.fieldnames or []) if h]
        except Exception as e:
            context['message'] = f'No se pudo leer el CSV: {e}'
            return render(request, 'page/pareto.html', context)

        if not rows or not headers:
            context['message'] = 'El CSV parece vacío o sin encabezados.'
            return render(request, 'page/pareto.html', context)

        # Normalizador: minúsculas, sin tildes, quitar espacios/guiones/underscores
        def norm(s: str) -> str:
            s = (s or '').strip().lower()
            trans = str.maketrans('áéíóúüñ', 'aeiouun')
            s = s.translate(trans)
            s = re.sub(r'[\s\-_]+', '', s)
            return s

        # Detectar columna de carrera
        carrera_targets = {'carrera','programa','especialidad','major','degree','escuela'}
        header_map = {h: norm(h) for h in headers}
        col_carrera = next((orig for orig, nrm in header_map.items() if nrm in carrera_targets), None)

        # Mapa de factores (variantes → canónico de despliegue)
        canonical = {
            'riesgoacademico':     'Académico',
            'riesgoeconomico':     'Económico',
            'riesgopsicosocial':   'Psicosocial',
            'riesgoinstitucional': 'Institucional',
            'riesgotecnologico':   'Tecnológico',
            'riesgocontextual':    'Contextual',
        }

        # Encontrar en el CSV las columnas que correspondan a esos factores
        factor_cols = {}  # canónico -> header original
        for orig, nrm in header_map.items():
            if nrm in canonical:
                factor_cols[canonical[nrm]] = orig

        missing = []
        if not col_carrera: missing.append('carrera')
        # Requerimos al menos 1 factor; idealmente los 6
        if len(factor_cols) == 0:
            missing.append('columnas de riesgo (académico/económico/psicosocial/institucional/tecnológico/contextual)')

        if missing:
            context['message'] = 'Faltan columnas: ' + ', '.join(missing) + '.'
            return render(request, 'page/pareto.html', context)

        # Conversión de valores: 'si','sí','true','1','x' -> 1; 'no','false','0','' -> 0; numérico -> float
        TRUES = {'si','sí','true','1','x','y','yes'}
        def to_num(v):
            v = (v or '').strip().lower()
            v = v.replace(',', '.')
            if v in TRUES:
                return 1.0
            try:
                return float(v)
            except ValueError:
                return 0.0

        # Agregar por carrera
        agg = {}         # carrera -> {canónico_display -> suma}
        carreras_set = set()
        ignored_rows = 0

        for r in rows:
            carrera = (r.get(col_carrera) or '').strip()
            if carrera == '':
                continue
            carreras_set.add(carrera)
            bucket = agg.setdefault(carrera, {k: 0.0 for k in canonical.values()})
            any_value = False
            for disp, col in factor_cols.items():
                num = to_num(r.get(col))
                if num != 0:
                    any_value = True
                bucket[disp] += num
            if not any_value and len(factor_cols) > 0:
                # No suma nada pero la fila es válida — no la contamos como ignorada
                pass

        # Estructura para el cliente
        agg_list = [{'carrera': c, 'riesgos': v} for c, v in agg.items()]
        if not agg_list:
            context['message'] = 'No se pudieron agregar factores por carrera.'
            return render(request, 'page/pareto.html', context)

        context.update({
            'agg_json': json.dumps(agg_list),
            'carreras': sorted(list(carreras_set)),
            'message': f'Carreras detectadas: {len(carreras_set)}. Factores detectados: {len(factor_cols)}.'
        })

    return render(request, 'page/pareto.html', context)

def control(request):
    """
    Gráfica de Control (p-chart) de REPROBACIÓN por semestre.
    Se calcula a partir de CALIFICACIONES < 7 (escala 0–10), sin columnas explícitas.

    CSV esperado (encabezados flexibles): 
      - semestre:   semestre / term / periodo
      - calificación: calificacion / calificaciones / nota / notas / grade / puntaje / puntuacion
    """

    context = {
        'page_title': 'Gráfica de Control',
        'message': 'Sube un CSV con columnas de semestre y calificación (0–10).',
        'rows_json': '[]',   # [{semestre,total,reprob}] ya agregados por semestre
    }

    if request.method == 'POST':
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            context['message'] = 'Adjunta un archivo CSV.'
            return render(request, 'page/control.html', context)

        # --- Lectura con detección de delimitador ---
        try:
            text = io.TextIOWrapper(csv_file.file, encoding='utf-8', errors='replace')
            sample = text.read(4096); text.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t,")
            except Exception:
                class SimpleDialect(csv.Dialect):
                    delimiter = ','
                    quotechar = '"'
                    escapechar = None
                    doublequote = True
                    skipinitialspace = True
                    lineterminator = '\n'
                dialect = SimpleDialect()
            reader = csv.DictReader(text, dialect=dialect)
            rows = list(reader)
            headers = [h for h in (reader.fieldnames or []) if h]
        except Exception as e:
            context['message'] = f'No se pudo leer el CSV: {e}'
            return render(request, 'page/control.html', context)

        if not rows or not headers:
            context['message'] = 'El CSV parece vacío o sin encabezados.'
            return render(request, 'page/control.html', context)

        # --- Normalización de encabezados ---
        def norm(s: str) -> str:
            s = (s or '').strip().lower()
            trans = str.maketrans('áéíóúüñ', 'aeiouun')
            s = s.translate(trans)
            s = re.sub(r'[\s\-_]+', '', s)
            return s

        header_map = {h: norm(h) for h in headers}

        semestre_targets = {'semestre','term','periodo'}
        calif_targets    = {'calificacion','calificaciones','nota','notas','grade','grades','puntaje','puntuacion'}

        col_sem  = next((orig for orig, nrm in header_map.items() if nrm in semestre_targets), None)
        col_cal  = next((orig for orig, nrm in header_map.items() if nrm in calif_targets), None)

        missing = []
        if not col_sem: missing.append('semestre')
        if not col_cal: missing.append('calificación')
        if missing:
            context['message'] = 'Faltan columnas: ' + ', '.join(missing) + '.'
            return render(request, 'page/control.html', context)

        # --- Agregación por semestre ---
        def to_float(v):
            v = (v or '').strip().replace(',', '.')
            try:
                return float(v)
            except ValueError:
                return None

        agg = {}  # sem -> {'n': total, 'x': reprobados}
        for r in rows:
            sem = (r.get(col_sem) or '').strip()
            cal = to_float(r.get(col_cal))
            if sem == '' or cal is None:
                continue
            # calificación válida 0–10
            if not (0 <= cal <= 10):
                continue

            bucket = agg.setdefault(sem, {'n': 0, 'x': 0})
            bucket['n'] += 1
            if cal < 7:
                bucket['x'] += 1

        if not agg:
            context['message'] = 'No se encontraron registros válidos (semestre y calificación 0–10).'
            return render(request, 'page/control.html', context)

        # Ordenar semestres (si son numéricos, por número; si no, alfabético)
        def sem_key(s):
            m = re.search(r'-?\d+', s)
            return (0, int(m.group())) if m else (1, s)

        rows_out = [
            {'semestre': sem, 'total': v['n'], 'reprob': v['x']}
            for sem, v in sorted(agg.items(), key=lambda kv: sem_key(kv[0]))
        ]

        context.update({
            'rows_json': json.dumps(rows_out),
            'message': f'Semestres: {len(rows_out)} | Total registros: {sum(r["total"] for r in rows_out)} | Reprobados (<7): {sum(r["reprob"] for r in rows_out)}'
        })

    return render(request, 'page/control.html', context)

def registro(request):
    if request.method == 'POST':
        nombreMaestro = request.POST.get('nombreMaestro')
        telefonoMaestro = request.POST.get('telefonoMaestro')
        correo = request.POST.get('correo').lower()
        contraseña = request.POST.get('contraseña')
        confirmar = request.POST.get('confirmar')

        errores = []

        # --- Validaciones ---
        if any(char.isdigit() for char in nombreMaestro):
            errores.append("El nombre no puede contener números")
        if not telefonoMaestro.isdigit():
            errores.append("El teléfono solo puede contener números")
        if not (correo.endswith('@maestro.edu.mx') or correo.endswith('@alumno.edu.mx')):
            errores.append("Favor de ingresar un correo válido")
        if Maestro.objects.filter(correo=correo).exists():
            errores.append("Correo ya registrado")
        if contraseña != confirmar:
            errores.append("Las contraseñas no coinciden")
        if len(contraseña) < 8:
            errores.append("La contraseña debe tener al menos 8 caracteres")
        if not re.search(r"[A-Z]", contraseña):
            errores.append("La contraseña debe contener al menos una letra mayúscula")
        if not re.search(r"[a-z]", contraseña):
            errores.append("La contraseña debe contener al menos una letra minúscula")
        if not re.search(r"\d", contraseña):
            errores.append("La contraseña debe contener al menos un número")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", contraseña):
            errores.append("La contraseña debe contener al menos un carácter especial")

        if errores:
            for e in errores:
                messages.error(request, e)
        else:
            # Determinar si es maestro o alumno según el dominio del correo
            if correo.endswith('@maestro.edu.mx'):
                Maestro.objects.create(
                    correo=correo, 
                    contraseña=contraseña,
                    nombreMaestro=nombreMaestro,
                    telefonoMaestro=telefonoMaestro
                )
                messages.success(request, "¡Maestro registrado exitosamente!")
            elif correo.endswith('@alumno.edu.mx'):
                Alumno.objects.create(
                    correo=correo,
                    contraseña=contraseña,
                    nombreAlumno=nombreMaestro,  # Usar el mismo campo para el nombre
                    telefonoAlumno=telefonoMaestro  # Usar el mismo campo para el teléfono
                )
                messages.success(request, "¡Alumno registrado exitosamente!")

    return render(request, 'page/registro.html')

def login_maestro(request):
    request.session.flush()
    
    if request.method == 'POST':
        correo = request.POST['correo']  
        contraseña = request.POST['contraseña']

        # Intentar login como maestro
        try:
            maestro = Maestro.objects.get(correo=correo, contraseña=contraseña)
            request.session['maestro_id'] = maestro.id
            request.session['maestro_correo'] = maestro.correo
            request.session['tipo_usuario'] = 'maestro'
            request.session['nombre_usuario'] = maestro.nombreMaestro
            return redirect('inicio')  
        except Maestro.DoesNotExist:
            pass
        
        # Si no es maestro, intentar login como alumno
        try:
            alumno = Alumno.objects.get(correo=correo, contraseña=contraseña)
            request.session['alumno_id'] = alumno.id
            request.session['alumno_correo'] = alumno.correo
            request.session['tipo_usuario'] = 'alumno'
            request.session['nombre_usuario'] = alumno.nombreAlumno
            request.session['matricula'] = alumno.matricula
            return redirect('inicio')
        except Alumno.DoesNotExist:
            pass
        
        return render(request, 'page/login.html', {'error': 'Usuario o contraseña inválidos.'})
    
    return render(request, 'page/login.html')

def logout_maestro(request):
    request.session.flush() 
    return redirect('login')

@maestro_login_required
def perfil(request):
    contexto = {}
    
    # Verificar si es maestro
    if 'maestro_correo' in request.session:
        correo_sesion = request.session.get('maestro_correo')
        maestro = Maestro.objects.filter(correo=correo_sesion).first()
        
        if not maestro:
            messages.error(request, "No se encontró tu perfil.")
            return redirect('inicio')
        
        contexto = {
            'tipo_usuario': 'maestro',
            'usuario': maestro,
            'correo': maestro.correo,
            'nombre': maestro.nombreMaestro,
            'telefono': maestro.telefonoMaestro
        }
    
    # Verificar si es alumno
    elif 'alumno_correo' in request.session:
        correo_sesion = request.session.get('alumno_correo')
        alumno = Alumno.objects.filter(correo=correo_sesion).first()
        
        if not alumno:
            messages.error(request, "No se encontró tu perfil.")
            return redirect('inicio')
        
        contexto = {
            'tipo_usuario': 'alumno',
            'usuario': alumno,
            'correo': alumno.correo,
            'nombre': alumno.nombreAlumno,
            'matricula': alumno.matricula,
            'carrera': alumno.carrera,
            'semestre': alumno.semestre
        }
    
    return render(request, 'page/perfil.html', contexto)

def calificaciones_alumno(request):
    """Vista para que los alumnos vean sus calificaciones"""
    if 'alumno_correo' not in request.session:
        messages.error(request, "Debes iniciar sesión como alumno.")
        return redirect('login')
    
    correo_sesion = request.session.get('alumno_correo')
    alumno = Alumno.objects.filter(correo=correo_sesion).first()
    
    if not alumno:
        messages.error(request, "No se encontró tu perfil.")
        return redirect('inicio')
    
    # Calcular el promedio si no existe
    if alumno.promedio == 0 or alumno.promedio is None:
        alumno.calcular_promedio()
        alumno.save()
    
    contexto = {
        'alumno': alumno,
        'tipo_usuario': 'alumno',
        'nombre_usuario': alumno.nombreAlumno,
    }
    
    return render(request, 'page/calificaciones_alumno.html', contexto)

@maestro_login_required
def documentacion(request):
    contexto = {
        'maestro_id': request.session.get('maestro_id'),
        'maestro_correo': request.session.get('maestro_correo'),
    }
    return render(request, 'page/documentacion.html', contexto)