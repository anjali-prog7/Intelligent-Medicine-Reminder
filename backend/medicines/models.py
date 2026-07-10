from django.db import models
from accounts.models import User


class Medicine(models.Model):

    MEDICINE_TYPE = (
        ("TABLET", "Tablet"),
        ("CAPSULE", "Capsule"),
        ("SYRUP", "Syrup"),
        ("INJECTION", "Injection"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="medicines"
    )

    medicine_name = models.CharField(max_length=100)

    medicine_type = models.CharField(
        max_length=20,
        choices=MEDICINE_TYPE
    )

    dosage = models.CharField(max_length=50)

    frequency = models.CharField(max_length=50)

    start_date = models.DateField()

    end_date = models.DateField()

    instructions = models.TextField(
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.medicine_name