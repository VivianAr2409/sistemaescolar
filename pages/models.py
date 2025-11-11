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