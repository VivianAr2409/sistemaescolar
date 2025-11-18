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
    correo = models.CharField(max_length=100, unique=True)
    contraseña = models.CharField(max_length=100)
    nombreAlumno = models.CharField(max_length=100)
    matricula = models.CharField(max_length=20, unique=True)
    carrera = models.CharField(max_length=100)
    semestre = models.IntegerField()
    
    class Meta:
        db_table = 'alumno'
    
    def __str__(self):
        return f"{self.nombreAlumno} ({self.matricula})"