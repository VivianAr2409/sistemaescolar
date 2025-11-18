from django.shortcuts import redirect

def maestro_login_required(view_func):
    """Decorador que permite acceso a maestros y alumnos autenticados"""
    def wrapper(request, *args, **kwargs):
        # Permitir acceso si hay sesión de maestro O alumno
        if 'maestro_id' in request.session or 'alumno_id' in request.session:
            return view_func(request, *args, **kwargs)
        return redirect('login')
    return wrapper

def solo_maestro_required(view_func):
    """Decorador que solo permite acceso a maestros"""
    def wrapper(request, *args, **kwargs):
        if 'maestro_id' in request.session:
            return view_func(request, *args, **kwargs)
        return redirect('login')
    return wrapper
