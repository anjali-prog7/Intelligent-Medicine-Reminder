"""
Regression tests for the Reminder execution fix.

These tests verify the synchronous (non-Celery) execution path added to make
reminders actually trigger at the scheduled local date + time:

    1. Creating a reminder must NOT send any email.
    2. fire_reminder() sends email + marks TRIGGERED only when due.
    3. fire_reminder() skips reminders that are not due yet.
    4. Exactly-once: a fired reminder is never fired again.
    5. List catch-up (process_due_reminders) fires due reminders on page load.
    6. The trigger endpoint returns the same result as fire_reminder().
"""

from datetime import time as time_cls

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from medicines.models import Medicine
from .models import NotificationLog, Reminder
from .services import NotificationService

User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    # Prevent any real Twilio calls during tests (user has no phone anyway)
    TWILIO_ACCOUNT_SID="",
    TWILIO_AUTH_TOKEN="",
    TWILIO_PHONE_NUMBER="",
)
class ReminderExecutionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="remindertest",
            email="remindertest@example.com",
            password="testpass123",
        )
        self.medicine = Medicine.objects.create(
            user=self.user,
            medicine_name="Paracetamol",
            medicine_type="TABLET",
            dosage="500mg",
            frequency="Morning",
            start_date=timezone.localdate(),
            end_date=timezone.localdate(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _make_reminder(self, reminder_date=None, reminder_time=None, status="PENDING"):
        return Reminder.objects.create(
            user=self.user,
            medicine=self.medicine,
            reminder_date=reminder_date or timezone.localdate(),
            reminder_time=reminder_time or time_cls(9, 0),
            status=status,
        )

    # ── 1. Email must NOT be sent during reminder creation ──────────────
    def test_create_reminder_sends_no_email(self):
        response = self.client.post(
            "/api/reminders/",
            {
                "medicine": self.medicine.id,
                "reminder_time": "18:30:00",
                "reminder_date": timezone.localdate().isoformat(),
                "status": "PENDING",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 0, "No email may be sent at creation")
        reminder = Reminder.objects.get(id=response.data["id"])
        self.assertEqual(reminder.status, "PENDING")
        self.assertFalse(reminder.notification_sent)

    # ── 2. fire_reminder fires a due reminder + marks TRIGGERED ─────────
    def test_fire_reminder_when_due(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        result = NotificationService.fire_reminder(reminder)
        self.assertEqual(result["status"], "triggered")
        self.assertTrue(result["email_sent"])

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        self.assertTrue(reminder.notification_sent)

        # Email + push logs recorded
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("PillSync", mail.outbox[0].subject)
        self.assertIn("Paracetamol", mail.outbox[0].body)
        self.assertTrue(
            NotificationLog.objects.filter(
                reminder=reminder, channel="EMAIL", status="SENT"
            ).exists()
        )

    # ── 3. fire_reminder skips a reminder that is not due yet ───────────
    def test_fire_reminder_skips_not_due(self):
        tomorrow = timezone.localdate() + timezone.timedelta(days=1)
        reminder = self._make_reminder(reminder_date=tomorrow)
        result = NotificationService.fire_reminder(reminder)
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "not_due")

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "PENDING")
        self.assertFalse(reminder.notification_sent)
        self.assertEqual(len(mail.outbox), 0)

    # ── 4. Exactly-once ─────────────────────────────────────────────────
    def test_fire_reminder_exactly_once(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        first = NotificationService.fire_reminder(reminder)
        self.assertEqual(first["status"], "triggered")

        # Second call: already TRIGGERED / notification_sent -> skipped
        reminder.refresh_from_db()
        second = NotificationService.fire_reminder(reminder)
        self.assertEqual(second["status"], "skipped")
        self.assertEqual(second["reason"], "already_handled")

        self.assertEqual(len(mail.outbox), 1, "Email must be sent exactly once")

    # ── 5. List catch-up fires due reminders on page load ───────────────
    def test_list_catch_up_fires_due_reminders(self):
        now = timezone.localtime()
        due = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        tomorrow = timezone.localdate() + timezone.timedelta(days=1)
        not_due = self._make_reminder(reminder_date=tomorrow)

        response = self.client.get("/api/reminders/")
        self.assertEqual(response.status_code, 200)

        due.refresh_from_db()
        not_due.refresh_from_db()
        self.assertEqual(due.status, "TRIGGERED")
        self.assertEqual(not_due.status, "PENDING", "Future reminder must not fire")
        self.assertEqual(len(mail.outbox), 1)

    # ── 6. Trigger endpoint behaves like fire_reminder ──────────────────
    def test_trigger_endpoint(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        response = self.client.post(f"/api/reminders/{reminder.id}/trigger/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "triggered")
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        self.assertEqual(len(mail.outbox), 1)

    # ── 7. Stale past-date PENDING reminders are marked MISSED ──────────
    def test_process_due_marks_old_reminders_missed(self):
        past = timezone.localdate() - timezone.timedelta(days=2)
        stale = self._make_reminder(reminder_date=past)
        NotificationService.process_due_reminders(self.user)
        stale.refresh_from_db()
        self.assertEqual(stale.status, "MISSED")

    # ── 8. Existing endpoints still work after the list() override ──────
    def test_existing_endpoints_unchanged(self):
        reminder = self._make_reminder()

        # mark_taken
        r = self.client.patch(f"/api/reminders/{reminder.id}/mark_taken/")
        self.assertEqual(r.status_code, 200)
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TAKEN")

        # pending list (today)
        r = self.client.get("/api/reminders/pending/")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)

        # snooze
        r = self.client.patch(f"/api/reminders/{reminder.id}/snooze/")
        self.assertEqual(r.status_code, 200)
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "SNOOZED")

        # mark_missed
        reminder.status = "PENDING"
        reminder.save(update_fields=["status"])
        r = self.client.patch(f"/api/reminders/{reminder.id}/mark_missed/")
        self.assertEqual(r.status_code, 200)
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "MISSED")

    # ── 9. Trigger is exactly-once even when called twice quickly ───────
    def test_trigger_endpoint_exactly_once(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        r1 = self.client.post(f"/api/reminders/{reminder.id}/trigger/")
        r2 = self.client.post(f"/api/reminders/{reminder.id}/trigger/")
        self.assertEqual(r1.data["status"], "triggered")
        self.assertEqual(r2.data["status"], "skipped")
        self.assertEqual(len(mail.outbox), 1, "Email must be sent exactly once")

    # ── 10. User without email: reminder still fires → TRIGGERED ────────
    def test_fire_reminder_without_email_marks_triggered(self):
        no_email_user = User.objects.create_user(
            username="noemailuser",
            email="",
            password="testpass123",
        )
        medicine = Medicine.objects.create(
            user=no_email_user,
            medicine_name="Dolo",
            medicine_type="TABLET",
            dosage="650mg",
            frequency="Morning",
            start_date=timezone.localdate(),
            end_date=timezone.localdate(),
        )
        now = timezone.localtime()
        reminder = Reminder.objects.create(
            user=no_email_user,
            medicine=medicine,
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
            status="PENDING",
        )
        result = NotificationService.fire_reminder(reminder)
        self.assertEqual(result["status"], "triggered")
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        self.assertTrue(reminder.notification_sent)

    # ── 11. Email failure keeps reminder PENDING for retry ──────────────
    def test_fire_reminder_email_failure_keeps_pending(self):
        from unittest import mock

        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        # Force the email to fail; other channels stay unaffected.
        with mock.patch.object(
            NotificationService, "send_all", autospec=True
        ) as fake_send:
            fake_logs = [
                NotificationLog(
                    user=self.user,
                    reminder=reminder,
                    channel="EMAIL",
                    recipient=self.user.email,
                    status="FAILED",
                    error_message="SMTP down",
                )
            ]
            fake_send.return_value = fake_logs
            result = NotificationService.fire_reminder(reminder)

        self.assertEqual(result["status"], "email_failed_retry")
        self.assertFalse(result["email_sent"])
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "PENDING", "Must stay PENDING for retry")
        self.assertFalse(reminder.notification_sent)
        self.assertEqual(reminder.retry_count, 1)

    # ── 12. Email retries are capped — reminder closes as TRIGGERED ──────
    def test_fire_reminder_email_retries_capped_at_triggered(self):
        from unittest import mock

        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )

        def fake_send(_reminder):
            reminder.refresh_from_db()
            return [
                NotificationLog(
                    user=self.user,
                    reminder=reminder,
                    channel="EMAIL",
                    recipient=self.user.email,
                    status="FAILED",
                    error_message="SMTP auth rejected",
                )
            ]

        with mock.patch.object(
            NotificationService, "send_all", autospec=True, side_effect=fake_send
        ):
            for attempt in range(NotificationService.MAX_RETRIES):
                reminder.refresh_from_db()
                result = NotificationService.fire_reminder(reminder)
                if attempt < NotificationService.MAX_RETRIES - 1:
                    self.assertEqual(result["status"], "email_failed_retry")
                else:
                    # Last retry: reminder must close as TRIGGERED so the list
                    # catch-up never re-fires it (no duplicate SMS/push).
                    self.assertEqual(result["status"], "triggered")

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        self.assertTrue(reminder.notification_sent)
        self.assertEqual(reminder.retry_count, NotificationService.MAX_RETRIES)

    # ── 13. Missing SMTP config → CONFIGURATION_ERROR, still TRIGGERED ───
    @override_settings(EMAIL_HOST=None, EMAIL_HOST_USER=None, EMAIL_HOST_PASSWORD=None)
    def test_fire_reminder_without_smtp_config_marks_triggered(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        result = NotificationService.fire_reminder(reminder)
        self.assertEqual(result["status"], "triggered")
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        log = NotificationLog.objects.get(
            reminder=reminder, channel="EMAIL"
        )
        self.assertEqual(log.status, "CONFIGURATION_ERROR")
        self.assertIn("SMTP not configured", log.error_message)

    # ── 14. Missing Twilio config → CONFIGURATION_ERROR, reminder TRIGGERED ─
    @override_settings(
        TWILIO_ACCOUNT_SID="", TWILIO_AUTH_TOKEN="", TWILIO_PHONE_NUMBER=""
    )
    def test_sms_without_twilio_config_is_logged_not_crash(self):
        user = self.user
        user.phone = "+919876543210"
        user.save(update_fields=["phone"])
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        # Must NOT raise and must still complete the reminder.
        result = NotificationService.fire_reminder(reminder)
        self.assertEqual(result["status"], "triggered")
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, "TRIGGERED")
        sms_log = NotificationLog.objects.get(
            reminder=reminder, channel="SMS"
        )
        self.assertEqual(sms_log.status, "CONFIGURATION_ERROR")
        self.assertIn("not fully configured", sms_log.error_message)
        # Email still worked independently.
        self.assertTrue(
            NotificationLog.objects.filter(
                reminder=reminder, channel="EMAIL", status="SENT"
            ).exists()
        )

    # ── 15. Notification-log API is exposed and user-scoped ──────────────
    def test_notification_logs_endpoint_returns_own_logs_only(self):
        now = timezone.localtime()
        reminder = self._make_reminder(
            reminder_date=now.date(),
            reminder_time=time_cls(now.hour, now.minute),
        )
        NotificationService.fire_reminder(reminder)

        # The endpoint the frontend calls must NOT 404.
        response = self.client.get("/api/reminders/notification-logs/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, list))
        self.assertTrue(len(response.data) > 0)

        # pending-push feed (dash URL, not underscore) must work too.
        push = self.client.get(
            "/api/reminders/notification-logs/pending-push/"
        )
        self.assertEqual(push.status_code, 200)
        self.assertTrue(isinstance(push.data, list))

        # A different user must not see the first user's logs.
        other = User.objects.create_user(
            username="otheruser", email="other@example.com", password="x"
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other)
        other_response = other_client.get("/api/reminders/notification-logs/")
        self.assertEqual(other_response.status_code, 200)
        self.assertEqual(other_response.data, [])
