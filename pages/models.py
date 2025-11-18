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
    telefonoAlumno = models.BigIntegerField(default=0)
    matricula = models.CharField(max_length=20, unique=True, blank=True, null=True)
    carrera = models.CharField(max_length=100, blank=True, null=True, default='')
    semestre = models.IntegerField(blank=True, null=True, default=1)
    
    # Campos para calificaciones
    calificacion_parcial1 = models.FloatField(blank=True, null=True, default=0.0)
    calificacion_parcial2 = models.FloatField(blank=True, null=True, default=0.0)
    calificacion_parcial3 = models.FloatField(blank=True, null=True, default=0.0)
    promedio = models.FloatField(blank=True, null=True, default=0.0)
    
    class Meta:
        db_table = 'alumno'
    
    def __str__(self):
        return f"{self.nombreAlumno} - {self.correo}"
    
    def calcular_promedio(self):
        """Calcula el promedio de las tres calificaciones parciales"""
        calificaciones = [
            self.calificacion_parcial1 or 0,
            self.calificacion_parcial2 or 0,
            self.calificacion_parcial3 or 0
        ]
        self.promedio = sum(calificaciones) / 3
        return self.promedio