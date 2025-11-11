from django.shortcuts import redirect

def maestro_login_required(view_func):
    def wrapper(request, *args, **kwargs):
        if 'maestro_id' in request.session:
            return view_func(request, *args, **kwargs)
        return redirect('login')
    return wrapper
