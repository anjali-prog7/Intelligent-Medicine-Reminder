from django.db import models
from accounts.models import User
from medicines.models import Medicine


class Reminder(models.Model):

    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("TAKEN", "Taken"),
        ("MISSED", "Missed"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reminders"
    )

    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.CASCADE,
        related_name="reminders"
    )

    reminder_time = models.TimeField()

    reminder_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    notification_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.medicine.medicine_name} - {self.reminder_time}"