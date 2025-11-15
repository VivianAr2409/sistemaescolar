from django.db import models

class Maestro(models.Model):
    correo = models.CharField(max_length=100, unique=True)
    contraseña= models.CharField(max_length=100)
    nombreMaestro = models.CharField(max_length=100)
    telefonoMaestro = models.BigIntegerField()
    class Meta:
        db_table = 'maestro'  # Esto asegura que use la colección exacta

    def __str__(self):
        return self.correo


class Alumno(models.Model):
    asistencias = models.BigIntegerField()
    carrera = models.CharField(max_length=100)
    contraseña= models.CharField(max_length=100)
    correo = models.CharField(max_length=100, unique=True)
    materia =  models.CharField(max_length=100)
    nombreAlumno = models.CharField(max_length=100)
    promedio = models.DecimalField(max_digits=10, decimal_places=2)
    semestre = models.BigIntegerField()
    telefonoAlumno = models.BigIntegerField()
    unidad = models.BigIntegerField()
    
    class Meta:
        db_table = 'alumno'  # Esto asegura que use la colección exacta

    def __str__(self):
        return self.correo