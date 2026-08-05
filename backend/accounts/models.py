from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models


# Indian mobile number validator
# Accepts: optional +91 or 0 prefix, then exactly 10 digits starting with 6-9
indian_phone_validator = RegexValidator(
    regex=r"^(?:\+91|0)?[6-9]\d{9}$",
    message="Enter a valid Indian mobile number (10 digits starting with 6-9, optional +91 or 0 prefix).",
)


class User(AbstractUser):

    ROLE_CHOICES = (
        ("PATIENT", "Patient"),
        ("CAREGIVER", "Caregiver"),
        ("ADMIN", "Admin"),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="PATIENT"
    )

    phone = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        null=True,
        validators=[indian_phone_validator],
        help_text="Indian mobile number: 10 digits starting with 6-9, optional +91 or 0 prefix.",
    )

    def __str__(self):
        return self.username