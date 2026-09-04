"""
Removes WHATSAPP from NotificationLog channel choices.

WhatsApp is no longer a supported reminder notification channel. This is a
model-state-only change (no DB schema change, since Django CharField choices
are not enforced at the database level), so existing notification log rows
that previously recorded channel="WHATSAPP" are preserved untouched.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reminders", "0003_status_choices"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificationlog",
            name="channel",
            field=models.CharField(
                choices=[
                    ("EMAIL", "Email"),
                    ("SMS", "SMS"),
                    ("PUSH", "Push"),
                ],
                max_length=20,
            ),
        ),
    ]
