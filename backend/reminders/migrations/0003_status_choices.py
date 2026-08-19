"""
Adds CONFIGURATION_ERROR and SKIPPED to NotificationLog status choices so
channels that are not configured are logged with a meaningful status instead
of a generic FAILED. Choices are a model-state-only change (no DB schema
change).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reminders", "0002_add_notificationlog_and_statuses"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificationlog",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("SENT", "Sent"),
                    ("FAILED", "Failed"),
                    ("CONFIGURATION_ERROR", "Configuration Error"),
                    ("SKIPPED", "Skipped"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
