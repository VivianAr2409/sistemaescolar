from django.urls import path
from django.views.generic import TemplateView 
from . import views
from .decorators import maestro_login_required

urlpatterns = [
    path('', views.login_maestro, name='login_root'),  
    path('login/', views.login_maestro, name='login'),
    path('registro/', views.registro, name='registro'),
    path('logout/', views.logout_maestro, name='logout'), 
    path('inicio/', maestro_login_required(views.home), name='inicio'),  # dashboard protegido
    path('estratificacion/', maestro_login_required(views.estratificacion), name='estratificacion'),
    path('histograma/', maestro_login_required(views.histograma), name='histograma'),
    path('pareto/', maestro_login_required(views.pareto), name='pareto'),
    path('control/', maestro_login_required(views.control), name='control'),
    path('documentacion/', views.documentacion, name='documentacion'),
    path('perfil/', views.perfil, name='perfil'),
]

