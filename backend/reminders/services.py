"""
Notification services for the PillSync reminder system.

Provides separate service classes for each notification channel:
- EmailService: Sends HTML emails via Django send_mail()
- SMSService: Sends SMS via Twilio
- BrowserNotificationService: Browser push notifications
- NotificationService: Orchestrates all channels and logs results
"""

import logging
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.html import strip_tags

from .models import NotificationLog, Reminder
from .utils import (
    build_email_text,
    build_html_email,
    format_sms_message,
)

logger = logging.getLogger(__name__)


# ==========================================================
# Helper
# ==========================================================

def normalize_phone_number(phone_number: str) -> str:
    """
    Convert phone number to Twilio E.164 format.

    Examples:
        9569878743      -> +919569878743
        +919569878743   -> +919569878743
    """

    if not phone_number:
        return phone_number

    phone_number = phone_number.strip().replace(" ", "").replace("-", "")

    if phone_number.startswith("+"):
        return phone_number

    if len(phone_number) == 10:
        return f"+91{phone_number}"

    return phone_number


# ==========================================================
# Email Service
# ==========================================================

class EmailService:
    """Handles sending email notifications via Django send_mail()."""

    @staticmethod
    def send(
        reminder_id: int,
        medicine_name: str,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> tuple[bool, str]:

        if not recipient_email:
            logger.warning(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"No recipient email provided."
            )
            return False, "No recipient email"

        if text_content is None:
            text_content = strip_tags(html_content)

        from_email = getattr(
            settings,
            "DEFAULT_FROM_EMAIL",
            "noreply@pillsync.com",
        )

        try:

            sent = send_mail(
                subject=subject,
                message=text_content,
                from_email=from_email,
                recipient_list=[recipient_email],
                html_message=html_content,
                fail_silently=False,
            )

            if sent == 1:
                logger.info(
                    f"Reminder {reminder_id} ({medicine_name}) "
                    f"Email sent successfully -> {recipient_email}"
                )
                return True, "OK"

            return False, f"send_mail returned {sent}"

        except Exception as e:

            logger.exception(
                f"Reminder {reminder_id} ({medicine_name}) "
                f"Email failed -> {recipient_email}"
            )

            return False, str(e)


# ==========================================================
# SMS Service
# ==========================================================

class SMSService:
    """Handles sending SMS notifications via Twilio."""

    @staticmethod
    def send(phone_number: str, message: str) -> bool:

        if not phone_number:
            logger.warning("SMS skipped. Empty phone number.")
            return False

        phone_number = normalize_phone_number(phone_number)

        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
        twilio_from = getattr(settings, "TWILIO_PHONE_NUMBER", None)

        if not all([account_sid, auth_token, twilio_from]):
            logger.warning("Twilio SMS credentials missing.")
            return False

        try:

            from twilio.rest import Client

            logger.info("=" * 60)
            logger.info("Sending SMS")
            logger.info(f"From : {twilio_from}")
            logger.info(f"To   : {phone_number}")
            logger.info("=" * 60)

            client = Client(account_sid, auth_token)

            response = client.messages.create(
                body=message,
                from_=twilio_from,
                to=phone_number,
            )

            logger.info(
                f"SMS sent successfully. SID={response.sid}"
            )

            return True

        except Exception as e:

            logger.exception(
                f"SMS FAILED -> {phone_number}"
            )

            return False


# ==========================================================
# Browser Notification Service
# ==========================================================

class BrowserNotificationService:
    """
    Handles browser notifications.

    The frontend polls the NotificationLog table and displays
    notifications using the browser Notification API.
    """

    @staticmethod
    def send(
        user_id: int,
        title: str,
        body: str,
        reminder_id: Optional[int] = None,
    ) -> bool:

        # Emoji-safe logging (Windows console friendly)
        logger.info(
            "Browser notification queued | "
            f"User={user_id} | "
            f"Reminder={reminder_id} | "
            f"Title={title.encode('ascii', 'ignore').decode()} | "
            f"Body={body.encode('ascii', 'ignore').decode()}"
        )

        return True


# ==========================================================
# Notification Service
# ==========================================================

class NotificationService:
    """Orchestrates all notification channels and logs results."""

    MAX_RETRIES = 3

    @staticmethod
    def send_all(reminder):
        """
        Send notifications through all channels (Email, SMS, Push)
        and return a list of NotificationLog objects.
        """
        user = reminder.user
        medicine = reminder.medicine
        now = timezone.now()
        logs = []

        medicine_name = medicine.medicine_name
        dosage = medicine.dosage
        reminder_time = reminder.reminder_time.strftime("%I:%M %p")
        reminder_date = reminder.reminder_date.strftime("%Y-%m-%d")
        patient_name = user.get_full_name() or user.username
        doctor_name = getattr(medicine, "doctor_name", None)

        # ==========================================================
        # Email Notification
        # ==========================================================
        if user.email:
            # Check SMTP configuration before attempting to send
            email_host = getattr(settings, "EMAIL_HOST", None)
            email_user = getattr(settings, "EMAIL_HOST_USER", None)
            email_password = getattr(settings, "EMAIL_HOST_PASSWORD", None)

            if not all([email_host, email_user, email_password]):
                email_log = NotificationLog.objects.create(
                    user=user,
                    reminder=reminder,
                    channel="EMAIL",
                    recipient=user.email,
                    status="CONFIGURATION_ERROR",
                    error_message="SMTP not configured. Email notification skipped.",
                )
                logs.append(email_log)
                logger.warning(
                    f"Reminder {reminder.id} ({medicine_name}): "
                    f"SMTP not configured, skipping email."
                )
            else:
                subject = f"PillSync - Medicine Reminder: {medicine_name}"
                html_content = build_html_email(
                    patient_name=patient_name,
                    medicine_name=medicine_name,
                    dosage=dosage,
                    reminder_time=reminder_time,
                    reminder_date=reminder_date,
                    doctor_name=doctor_name,
                )
                text_content = build_email_text(
                    patient_name=patient_name,
                    medicine_name=medicine_name,
                    dosage=dosage,
                    reminder_time=reminder_time,
                    reminder_date=reminder_date,
                )

                email_success, email_msg = EmailService.send(
                    reminder_id=reminder.id,
                    medicine_name=medicine_name,
                    recipient_email=user.email,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                )

                email_log = NotificationLog.objects.create(
                    user=user,
                    reminder=reminder,
                    channel="EMAIL",
                    recipient=user.email,
                    status="SENT" if email_success else "FAILED",
                    sent_at=now if email_success else None,
                    error_message=None if email_success else email_msg,
                )
                logs.append(email_log)

        # ==========================================================
        # SMS Notification
        # ==========================================================
        if user.phone:
            normalized_phone = normalize_phone_number(user.phone)

            # Check Twilio configuration before attempting to send
            twilio_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
            twilio_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
            twilio_from = getattr(settings, "TWILIO_PHONE_NUMBER", None)

            if not all([twilio_sid, twilio_token, twilio_from]):
                sms_log = NotificationLog.objects.create(
                    user=user,
                    reminder=reminder,
                    channel="SMS",
                    recipient=normalized_phone or user.phone,
                    status="CONFIGURATION_ERROR",
                    error_message="Twilio SMS credentials not fully configured",
                )
                logs.append(sms_log)
                logger.warning(
                    f"Reminder {reminder.id}: "
                    f"Twilio SMS not configured, skipping SMS."
                )
            else:
                sms_message = format_sms_message(
                    medicine_name=medicine_name,
                    dosage=dosage,
                    reminder_time=reminder_time,
                )

                logger.info(
                    f"Reminder {reminder.id}: "
                    f"Preparing SMS -> {normalized_phone}"
                )

                sms_success = SMSService.send(
                    phone_number=normalized_phone,
                    message=sms_message,
                )

                sms_log = NotificationLog.objects.create(
                    user=user,
                    reminder=reminder,
                    channel="SMS",
                    recipient=normalized_phone,
                    status="SENT" if sms_success else "FAILED",
                    sent_at=now if sms_success else None,
                    error_message=None if sms_success else "SMS send failed",
                )
                logs.append(sms_log)

        # ==========================================================
        # Push Notification
        # ==========================================================
        push_success = BrowserNotificationService.send(
            user_id=user.id,
            title=f"Medicine Reminder: {medicine_name}",
            body=f"Take {medicine_name} ({dosage}) at {reminder_time}",
            reminder_id=reminder.id,
        )

        push_log = NotificationLog.objects.create(
            user=user,
            reminder=reminder,
            channel="PUSH",
            recipient=str(user.id),
            status="SENT" if push_success else "FAILED",
            sent_at=now if push_success else None,
            error_message=None if push_success else "Push notification failed",
        )
        logs.append(push_log)

        return logs

    @staticmethod
    def fire_reminder(reminder):
        """
        Synchronously fire one reminder: send email + mark TRIGGERED.

        Called by the frontend exact-time scheduler at the exact scheduled
        date+time, together with the browser notification. Exactly-once is
        guarded by status/notification_sent inside this method.
        """
        now = timezone.now()
        user = reminder.user

        # ── Check if reminder is due ──
        today = timezone.localtime().date()
        current_time = timezone.localtime().time()

        if reminder.reminder_date > today:
            return {"status": "skipped", "reason": "not_due"}

        if reminder.reminder_date == today and reminder.reminder_time > current_time:
            return {"status": "skipped", "reason": "not_due"}

        # ── Already handled? ──
        if reminder.notification_sent or reminder.status in (
            "TRIGGERED", "TAKEN", "MISSED",
        ):
            return {"status": "skipped", "reason": "already_handled"}

        # ── Send notifications via all channels ──
        logs = NotificationService.send_all(reminder)

        # ── Determine email result ──
        email_log = next(
            (log for log in logs if log.channel == "EMAIL"), None
        )
        email_sent = email_log is not None and email_log.status == "SENT"
        email_config_error = (
            email_log is not None
            and email_log.status == "CONFIGURATION_ERROR"
        )
        no_email_address = email_log is None

        # ── Handle email failure / config error / no email ──
        if not email_sent:
            if email_config_error or no_email_address:
                # Config error or no email address — not retryable
                reminder.status = "TRIGGERED"
                reminder.notification_sent = True
                reminder.save(
                    update_fields=["status", "notification_sent"]
                )
                return {"status": "triggered", "email_sent": False}

            reminder.retry_count += 1
            if reminder.retry_count >= NotificationService.MAX_RETRIES:
                # Retries exhausted — close the reminder
                reminder.status = "TRIGGERED"
                reminder.notification_sent = True
                reminder.save(
                    update_fields=[
                        "status",
                        "notification_sent",
                        "retry_count",
                    ]
                )
                return {"status": "triggered", "email_sent": False}

            reminder.save(update_fields=["retry_count"])
            return {"status": "email_failed_retry", "email_sent": False}

        # ── Success ──
        reminder.status = "TRIGGERED"
        reminder.notification_sent = True
        reminder.save(update_fields=["status", "notification_sent"])
        return {"status": "triggered", "email_sent": True}

    @staticmethod
    def process_due_reminders(user):
        """
        Process all due reminders for a user (list catch-up).

        Fires any due PENDING reminders for this user right now so
        reminders execute even when Celery Beat / Worker / Redis are
        not running.
        """
        now = timezone.localtime()
        today = now.date()
        current_time = now.time()

        # Mark old pending reminders as missed
        Reminder.objects.filter(
            user=user,
            reminder_date__lt=today,
            status="PENDING",
            notification_sent=False,
        ).update(status="MISSED")

        # Find due reminders
        due_reminders = Reminder.objects.filter(
            user=user,
            reminder_date=today,
            reminder_time__lte=current_time,
            status="PENDING",
            notification_sent=False,
        )

        fired = 0
        for reminder in due_reminders:
            result = NotificationService.fire_reminder(reminder)
            if result.get("status") == "triggered":
                fired += 1

        return fired

    @staticmethod
    def get_pending_push_notifications(user_id):
        """Get recent push notifications for browser display."""
        recent_logs = (
            NotificationLog.objects.filter(
                user_id=user_id,
                channel="PUSH",
                created_at__gte=timezone.now() - timedelta(hours=24),
            )
            .select_related("reminder__medicine")
            .order_by("-created_at")[:50]
        )

        return [
            {
                "id": log.id,
                "title": (
                    f"Medicine Reminder: "
                    f"{log.reminder.medicine.medicine_name}"
                    if log.reminder and log.reminder.medicine
                    else "Medicine Reminder"
                ),
                "body": (
                    f"Reminder for {log.reminder.medicine.medicine_name}"
                    if log.reminder and log.reminder.medicine
                    else ""
                ),
                "reminder_id": log.reminder_id,
                "created_at": log.created_at,
                "status": log.status,
            }
            for log in recent_logs
        ]
