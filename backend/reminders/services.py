"""
Notification services for the PillSync reminder system.

Provides separate service classes for each notification channel:
- EmailService: Sends HTML emails via Django send_mail()
- SMSService: Sends SMS via Twilio
- WhatsAppService: Sends WhatsApp messages via Twilio
- BrowserNotificationService: Browser push notifications
- NotificationService: Orchestrates all channels and logs results

Every email is sent to reminder.user.email — never request.user.email,
never EMAIL_HOST_USER, never DEFAULT_FROM_EMAIL.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from django.db import transaction

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.html import strip_tags

from .models import NotificationLog, Reminder

from .utils import (
    build_email_text,
    build_html_email,
    format_sms_message,
    format_whatsapp_message,
    normalize_phone_number,
    safe_log_message,
)

logger = logging.getLogger(__name__)


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
        """
        Send an HTML email using Django send_mail().

        Args:
            reminder_id: Reminder ID for logging
            medicine_name: Medicine name for logging
            recipient_email: The recipient's email address (reminder.user.email)
            subject: Email subject line
            html_content: HTML body content
            text_content: Plain text fallback (auto-generated if None)

        Returns:
            Tuple of (success: bool, smtp_response: str)
            - (True, "OK") if the email was sent successfully
            - (False, error_details) if sending failed
        """
        if not recipient_email:
            logger.warning(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"No recipient email provided. Skipping."
            )
            return (False, "No recipient email provided")

        if text_content is None:
            text_content = strip_tags(html_content)

        from_email = getattr(
            settings, "DEFAULT_FROM_EMAIL", "noreply@pillsync.com"
        )

        try:
            sent_count = send_mail(
                subject=subject,
                message=text_content,
                from_email=from_email,
                recipient_list=[recipient_email],
                html_message=html_content,
                fail_silently=False,
            )

            if sent_count == 1:
                logger.info(
                    f"Reminder {reminder_id} ({medicine_name}): "
                    f"Email sent OK to {recipient_email} | "
                    f"From={from_email}"
                )
                return (True, "OK")
            else:
                logger.warning(
                    f"Reminder {reminder_id} ({medicine_name}): "
                    f"send_mail returned {sent_count} for {recipient_email}"
                )
                return (False, f"send_mail returned {sent_count}")

        except Exception as e:
            smtp_response = str(e)
            logger.error(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"SMTP FAILED for {recipient_email} | "
                f"Error={smtp_response}"
            )
            return (False, smtp_response)


class SMSService:
    """Handles sending SMS notifications via Twilio."""

    @staticmethod
    def send(phone_number: str, message: str) -> tuple[bool, str, str]:
        """
        Send an SMS message via Twilio.

        Args:
            phone_number: Raw phone number (will be normalized to E.164)
            message: SMS body text

        Returns:
            Tuple of (success: bool, normalized_phone: str, message_sid_or_error: str)
        """
        original_number = phone_number

        if not phone_number:
            lmsg = safe_log_message(
                "SMSService: No phone number provided. Skipping SMS send."
            )
            logger.warning(lmsg)
            return (False, "", "No phone number provided")

        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
        twilio_from = getattr(settings, "TWILIO_PHONE_NUMBER", None)

        if not all([account_sid, auth_token, twilio_from]):
            lmsg = safe_log_message(
                "SMSService: Twilio credentials not fully configured. "
                f"account_sid={'SET' if account_sid else 'MISSING'} | "
                f"auth_token={'SET' if auth_token else 'MISSING'} | "
                f"twilio_from={'SET' if twilio_from else 'MISSING'}"
            )
            logger.warning(lmsg)
            return (False, "", "Twilio credentials not fully configured")

        # Normalize the phone number to E.164 (+91XXXXXXXXXX)
        normalized_number = normalize_phone_number(phone_number)
        if not normalized_number:
            lmsg = safe_log_message(
                f"SMSService: Failed to normalize phone number "
                f"Original={original_number}. Skipping SMS send."
            )
            logger.error(lmsg)
            return (False, original_number, "Phone number normalization failed")

        # Mask account SID for safe logging (show first 6 chars)
        masked_sid = f"{account_sid[:6]}..." if account_sid and len(account_sid) > 6 else "INVALID"

        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)

            lmsg = safe_log_message(
                f"SMSService: Sending SMS | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"From={twilio_from} | "
                f"Account SID={masked_sid}"
            )
            logger.info(lmsg)

            twilio_message = client.messages.create(
                body=message,
                from_=twilio_from,
                to=normalized_number,
            )

            message_sid = getattr(twilio_message, "sid", "NO_SID")

            lmsg = safe_log_message(
                f"SMSService: SMS sent successfully | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"Message SID={message_sid}"
            )
            logger.info(lmsg)

            return (True, normalized_number, message_sid)

        except Exception as e:
            error_str = str(e)
            lmsg = safe_log_message(
                f"SMSService: FAILED to send SMS | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"From={twilio_from} | "
                f"Account SID={masked_sid} | "
                f"Error={error_str}"
            )
            logger.error(lmsg)
            return (False, normalized_number or original_number, error_str)


class WhatsAppService:
    """Handles sending WhatsApp messages via Twilio."""

    @staticmethod
    def _ensure_whatsapp_prefix(number: str) -> str:
        """
        Ensure the number has exactly one "whatsapp:" prefix.

        Twilio requires the "whatsapp:" prefix on both from_ and to
        addresses. If the number already starts with "whatsapp:",
        return it unchanged to avoid double prefix.
        """
        if number.startswith("whatsapp:"):
            return number
        return f"whatsapp:{number}"

    @staticmethod
    def send(phone_number: str, message: str) -> tuple[bool, str, str]:
        """
        Send a WhatsApp message via Twilio API.

        Args:
            phone_number: Raw phone number (will be normalized to E.164)
            message: WhatsApp message body

        Returns:
            Tuple of (success: bool, normalized_phone: str, message_sid_or_error: str)
        """
        original_number = phone_number

        if not phone_number:
            lmsg = safe_log_message(
                "WhatsAppService: No phone number provided. Skipping WhatsApp send."
            )
            logger.warning(lmsg)
            return (False, "", "No phone number provided")

        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
        whatsapp_from = getattr(settings, "TWILIO_WHATSAPP_FROM", None)

        if not all([account_sid, auth_token, whatsapp_from]):
            lmsg = safe_log_message(
                "WhatsAppService: Twilio credentials not fully configured. "
                f"account_sid={'SET' if account_sid else 'MISSING'} | "
                f"auth_token={'SET' if auth_token else 'MISSING'} | "
                f"whatsapp_from={'SET' if whatsapp_from else 'MISSING'}"
            )
            logger.warning(lmsg)
            return (False, "", "Twilio credentials not fully configured")

        # Normalize the phone number to E.164 (+91XXXXXXXXXX)
        normalized_number = normalize_phone_number(phone_number)
        if not normalized_number:
            lmsg = safe_log_message(
                f"WhatsAppService: Failed to normalize phone number "
                f"Original={original_number}. Skipping WhatsApp send."
            )
            logger.error(lmsg)
            return (False, original_number, "Phone number normalization failed")

        # Ensure "whatsapp:" prefix is added only once to both addresses
        from_address = WhatsAppService._ensure_whatsapp_prefix(whatsapp_from)
        to_address = WhatsAppService._ensure_whatsapp_prefix(normalized_number)

        # Mask account SID for safe logging
        masked_sid = f"{account_sid[:6]}..." if account_sid and len(account_sid) > 6 else "INVALID"

        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)

            lmsg = safe_log_message(
                f"WhatsAppService: Sending WhatsApp | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"From={from_address} | "
                f"To={to_address} | "
                f"Account SID={masked_sid}"
            )
            logger.info(lmsg)

            twilio_message = client.messages.create(
                body=message,
                from_=from_address,
                to=to_address,
            )

            message_sid = getattr(twilio_message, "sid", "NO_SID")

            lmsg = safe_log_message(
                f"WhatsAppService: WhatsApp sent successfully | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"Message SID={message_sid}"
            )
            logger.info(lmsg)

            return (True, normalized_number, message_sid)

        except Exception as e:
            error_str = str(e)
            lmsg = safe_log_message(
                f"WhatsAppService: FAILED to send WhatsApp | "
                f"Original={original_number} | "
                f"Normalized={normalized_number} | "
                f"From={from_address} | "
                f"To={to_address} | "
                f"Account SID={masked_sid} | "
                f"Error={error_str}"
            )
            logger.error(lmsg)
            return (False, normalized_number or original_number, error_str)


class BrowserNotificationService:
    """
    Handles browser push notifications.

    Uses the Web Push API specifications. This service creates notification
    log entries that the frontend can poll to display browser notifications
    at the exact reminder time.

    IMPORTANT: The notification content (title, body) sent to the browser
    REMAINS UNCHANGED with full Unicode/emoji support. Only the log output
    is sanitized for Windows console compatibility.
    """

    @staticmethod
    def send(user_id: int, title: str, body: str, reminder_id: Optional[int] = None) -> bool:
        """
        Queue a browser push notification.

        The frontend polls for pending push notifications and displays them
        using the Notification API.

        Args:
            user_id: ID of the target user
            title: Notification title (emoji preserved for browser)
            body: Notification body text (emoji preserved for browser)
            reminder_id: Optional reminder ID for context

        Returns:
            True (notifications are always queued successfully)
        """
        # Use safe_log_message for Windows console compatibility
        # The actual notification sent to browser retains the emoji
        safe_title = safe_log_message(title)
        safe_body = safe_log_message(body)
        logger.info(
            f"Browser notification queued for user {user_id}: "
            f"[{safe_title}] {safe_body}"
        )
        # The frontend polls /api/reminders/notification-logs/pending-push/
        # to retrieve and display browser notifications
        return True


class NotificationService:
    """
    Orchestrates sending notifications across all enabled channels
    and logs every attempt in the NotificationLog model.

    Implements retry logic: failed notifications are retried up to
    MAX_RETRIES times on subsequent task runs.

    The email recipient is ALWAYS reminder.user.email — never
    request.user.email, EMAIL_HOST_USER, or DEFAULT_FROM_EMAIL.
    """

    MAX_RETRIES = 3

    @staticmethod
    def send_all(reminder: Reminder) -> list[NotificationLog]:
        """
        Send notifications for a single reminder across all channels.
        Each channel attempt is recorded in NotificationLog.

        Args:
            reminder: The Reminder instance to send notifications for

        Returns:
            List of NotificationLog entries created for this reminder
        """
        logs: list[NotificationLog] = []
        user = reminder.user
        medicine = reminder.medicine

        reminder_id = reminder.id
        patient_name = user.get_full_name() or user.username
        medicine_name = medicine.medicine_name
        recipient_email = user.email
        dosage = medicine.dosage or "—"
        reminder_time = reminder.reminder_time.strftime("%I:%M %p")
        reminder_date = reminder.reminder_date.strftime("%B %d, %Y")
        doctor_name = getattr(medicine, "doctor_name", None) or getattr(
            medicine, "prescribed_by", None
        )
        now = timezone.now()

        # -- Email (only if user has an email) --
        if recipient_email:
            subject = "💊 PillSync Medicine Reminder"
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

            logger.info(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"Attempting email to {recipient_email}"
            )

            email_success, email_smtp_response = EmailService.send(
                reminder_id=reminder_id,
                medicine_name=medicine_name,
                recipient_email=recipient_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )

            email_status = "SENT" if email_success else "FAILED"

            email_log = NotificationLog.objects.create(
                user=user,
                reminder=reminder,
                channel="EMAIL",
                recipient=recipient_email,
                status=email_status,
                sent_at=now if email_success else None,
                error_message=None if email_success else email_smtp_response,
            )
            logs.append(email_log)

            logger.info(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"Recipient Email={recipient_email} | "
                f"SMTP Response={email_smtp_response} | "
                f"Notification Status={email_status}"
            )

        else:
            logger.warning(
                f"Reminder {reminder_id} ({medicine_name}): "
                f"User {user.username} has no email address. Skipping email."
            )

        # -- SMS --
        if user.phone:
            sms_message = format_sms_message(
                medicine_name=medicine_name,
                dosage=dosage,
                reminder_time=reminder_time,
            )

            sms_success, sms_normalized_phone, sms_response = SMSService.send(
                phone_number=user.phone,
                message=sms_message,
            )

            # Store normalized phone number in NotificationLog,
            # not the raw 10-digit number from the database
            sms_recipient = sms_normalized_phone or user.phone
            sms_error = None if sms_success else sms_response

            sms_log = NotificationLog.objects.create(
                user=user,
                reminder=reminder,
                channel="SMS",
                recipient=sms_recipient,
                status="SENT" if sms_success else "FAILED",
                sent_at=now if sms_success else None,
                error_message=sms_error,
            )
            logs.append(sms_log)

        # -- WhatsApp --
        if user.phone:
            whatsapp_message = format_whatsapp_message(
                patient_name=patient_name,
                medicine_name=medicine_name,
                dosage=dosage,
                reminder_time=reminder_time,
                reminder_date=reminder_date,
                doctor_name=doctor_name,
            )

            whatsapp_success, whatsapp_normalized_phone, whatsapp_response = WhatsAppService.send(
                phone_number=user.phone,
                message=whatsapp_message,
            )

            # Store normalized phone number in NotificationLog,
            # not the raw 10-digit number from the database
            whatsapp_recipient = whatsapp_normalized_phone or user.phone
            whatsapp_error = None if whatsapp_success else whatsapp_response

            whatsapp_log = NotificationLog.objects.create(
                user=user,
                reminder=reminder,
                channel="WHATSAPP",
                recipient=whatsapp_recipient,
                status="SENT" if whatsapp_success else "FAILED",
                sent_at=now if whatsapp_success else None,
                error_message=whatsapp_error,
            )
            logs.append(whatsapp_log)

        # -- Push Notification --
        push_title = f"💊 PillSync Reminder"
        push_body = f"{medicine_name} {dosage} - {reminder_time}"

        BrowserNotificationService.send(
            user_id=user.id,
            title=push_title,
            body=push_body,
            reminder_id=reminder.id,
        )

        push_log = NotificationLog.objects.create(
            user=user,
            reminder=reminder,
            channel="PUSH",
            recipient=str(user.id),
            status="SENT",
            sent_at=now,
        )
        logs.append(push_log)

        return logs

    @staticmethod
    def fire_reminder(reminder: Reminder) -> dict:
        """
        Synchronously fire a single reminder: send all notifications (email,
        SMS, WhatsApp) and mark it TRIGGERED exactly once.

        This is the non-Celery execution path. It is invoked by:
          1. the frontend exact-time scheduler via POST /reminders/{id}/trigger/
          2. the reminders list catch-up (process_due_reminders)

        NOTE: keep the fire logic here and in tasks.send_reminder_notifications
        in sync (email-failure leaves PENDING + notification_sent=False so the
        retry semantics stay identical on both paths).

        Guards:
          - Only PENDING reminders with notification_sent=False are fired.
          - Only when Current Local DateTime >= Reminder Local DateTime.
          - Status/notification_sent are updated in the same transaction so a
            concurrent Celery run can never double-send.

        Returns:
            dict with status/reminder_id/email_sent/channels.
        """
        reminder_id = reminder.id
        now = timezone.localtime()
        now_naive = now.replace(tzinfo=None)

        # Atomic claim: lock the reminder row so a concurrent caller (Celery
        # task, another list catch-up, or a duplicate trigger POST) can never
        # double-send. The check + send + status update all happen inside the
        # same transaction while the row is locked.
        with transaction.atomic():
            locked = (
                Reminder.objects.select_for_update()
                .filter(id=reminder_id)
                .first()
            )
            if locked is None:
                return {"status": "skipped", "reason": "not_found", "reminder_id": reminder_id}

            if locked.notification_sent or locked.status != "PENDING":
                logger.info(
                    f"Reminder Skipped: id={reminder_id} | "
                    f"reason=already_handled | status={locked.status} | "
                    f"notification_sent={locked.notification_sent}"
                )
                return {"status": "skipped", "reason": "already_handled", "reminder_id": reminder_id}

            # Reminder must fire ONLY when current local datetime >= scheduled datetime
            scheduled_dt = datetime.combine(locked.reminder_date, locked.reminder_time)
            if scheduled_dt > now_naive:
                logger.info(
                    f"Reminder Skipped: id={reminder_id} | reason=not_due | "
                    f"scheduled={scheduled_dt} | now={now_naive}"
                )
                return {"status": "skipped", "reason": "not_due", "reminder_id": reminder_id}

            logger.info(
                f"Reminder Triggered: id={reminder_id} | "
                f"medicine={locked.medicine.medicine_name} | "
                f"scheduled={scheduled_dt} | now={now_naive}"
            )

            # NOTE: send_all() executes SMTP + Twilio network I/O while the
            # row is locked (exactly-once among locking callers). This is
            # intentional: a duplicate trigger / concurrent list catch-up
            # blocks here, re-reads the row (notification_sent=True) and
            # skips, so no double-email is sent. (The existing lockless Celery
            # task is unaffected; it already guards via notification_sent.)
            logs = NotificationService.send_all(locked)

            email_log = next((log for log in logs if log.channel == "EMAIL"), None)
            email_success = email_log is not None and email_log.status == "SENT"
            no_email_configured = email_log is None

            if email_success or no_email_configured:
                # Fired successfully (email sent, or there is no email to send).
                locked.status = "TRIGGERED"
                locked.notification_sent = True
                locked.save(update_fields=["status", "notification_sent"])
                fired = True
                logger.info(
                    f"Reminder Completed: id={reminder_id} | status=TRIGGERED | "
                    f"email_sent={email_success} | channels={len(logs)}"
                )
            else:
                # Email FAILED: keep PENDING + notification_sent=False so the
                # next list catch-up (or the existing Celery task) retries the
                # email, preserving the original retry semantics. Cap the retry
                # counter at MAX_RETRIES to mirror the Celery task.
                locked.retry_count = min(
                    locked.retry_count + 1, NotificationService.MAX_RETRIES
                )
                locked.save(update_fields=["retry_count", "updated_at"])
                fired = False
                logger.warning(
                    f"Reminder Email Failed: id={reminder_id} | "
                    f"kept PENDING for retry (attempt {locked.retry_count}/{NotificationService.MAX_RETRIES}) | "
                    f"error={email_log.error_message}"
                )

        return {
            "status": "triggered" if fired else "email_failed_retry",
            "reminder_id": reminder_id,
            "email_sent": email_success,
            "channels": [
                {"channel": log.channel, "status": log.status} for log in logs
            ],
        }

    @staticmethod
    def process_due_reminders(user) -> int:
        """
        Catch-up scheduler: synchronously fire every PENDING reminder owned
        by ``user`` whose scheduled local date/time has already been reached.

        Runs on every reminders-list load so reminders fire even when Celery
        Beat/Worker/Redis are not running. Past-date PENDING reminders are
        marked MISSED (mirrors the Celery handle_missed_reminders behaviour)
        so nothing stays PENDING forever.

        Returns the number of reminders fired.
        """
        now = timezone.localtime()
        today = now.date()

        # Old (past-date) PENDING reminders -> MISSED, never stuck in PENDING
        missed = Reminder.objects.filter(
            user=user,
            reminder_date__lt=today,
            status="PENDING",
            notification_sent=False,
        ).update(status="MISSED")
        if missed:
            logger.info(f"Reminder Completed: marked {missed} past reminder(s) as MISSED")

        # Due reminders today whose time has arrived
        due = Reminder.objects.filter(
            user=user,
            reminder_date=today,
            reminder_time__lte=now.time(),
            status="PENDING",
            notification_sent=False,
        ).select_related("user", "medicine")

        fired = 0
        for reminder in due:
            result = NotificationService.fire_reminder(reminder)
            if result.get("status") == "triggered":
                fired += 1

        if fired:
            logger.info(f"Reminder Completed: catch-up fired {fired} reminder(s)")
        return fired

    @staticmethod
    def get_pending_push_notifications(user_id: int) -> list[dict]:
        """
        Retrieve pending push notifications for a user.

        Used by the frontend to poll for browser notifications.

        Args:
            user_id: ID of the user to fetch notifications for

        Returns:
            List of dicts with title, body, and reminder details
        """
        cutoff = timezone.now() - timedelta(minutes=1)
        pending_logs = NotificationLog.objects.filter(
            user_id=user_id,
            channel="PUSH",
            status="SENT",
            sent_at__gte=cutoff,
        ).select_related("reminder__medicine")[:5]

        notifications = []
        for log in pending_logs:
            reminder = log.reminder
            notifications.append({
                "id": log.id,
                "title": "💊 PillSync Reminder",
                "body": f"{reminder.medicine.medicine_name} - {reminder.reminder_time.strftime('%I:%M %p')}",
                "reminder_id": reminder.id,
                "medicine": reminder.medicine.medicine_name,
                "dosage": reminder.medicine.dosage,
                "time": reminder.reminder_time.strftime("%I:%M %p"),
            })

        return notifications
