"""
Safe notification-configuration diagnostic for the PillSync reminder system.

Usage:
    python manage.py notification_diagnostics                     # config report only
    python manage.py notification_diagnostics --smtp-auth-test    # + live SMTP login test (no email sent)
    python manage.py notification_diagnostics --send-test-email <user>   # + real test email to a DB user

Security guarantees:
  - NEVER prints EMAIL_HOST_PASSWORD or TWILIO_AUTH_TOKEN.
  - Only prints configured/missing for secrets; masks the Twilio SID to 6 chars.
  - The test-email recipient is ALWAYS looked up from the database
    (by id, username or email) — never hardcoded.

The SMTP auth test connects to EMAIL_HOST:EMAIL_PORT, upgrades to TLS and
performs a login ONLY. It does not send any message, so it is safe to run
anytime. It answers the question "are the credentials in backend/.env
actually valid?" — the exact cause of Gmail's "535 5.7.8 Username and
Password not accepted" error.
"""

import smtplib

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


def _status(value) -> str:
    """Return 'configured' or 'missing' without revealing the value."""
    return "configured" if value else "MISSING"


def _mask_sid(sid: str) -> str:
    """Show only the first 6 chars of an Account SID (never the full value)."""
    if not sid:
        return "MISSING"
    return f"{sid[:6]}... ({len(sid)} chars)"


class Command(BaseCommand):
    help = (
        "Report Email/Twilio notification config status (no secrets) and "
        "optionally run a live SMTP auth test or send a test email to a "
        "database user."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--smtp-auth-test",
            action="store_true",
            help="Connect to the SMTP server and authenticate with the "
            "configured credentials. Sends NO email.",
        )
        parser.add_argument(
            "--send-test-email",
            metavar="USER",
            help="Send a test email to the email address of the given user "
            "(looked up by id, username or email from the database).",
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write("PillSync notification configuration diagnostic")
        self.stdout.write("=" * 60)

        # ── EMAIL ────────────────────────────────────────────────────────────
        self.stdout.write("\n[EMAIL]")
        email_host = getattr(settings, "EMAIL_HOST", None)
        email_user = getattr(settings, "EMAIL_HOST_USER", None)
        email_password = getattr(settings, "EMAIL_HOST_PASSWORD", None)
        email_port = getattr(settings, "EMAIL_PORT", None)
        email_tls = getattr(settings, "EMAIL_USE_TLS", None)
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

        self.stdout.write(f"  EMAIL_HOST         = {_status(email_host)}")
        self.stdout.write(f"  EMAIL_HOST_USER    = {_status(email_user)}")
        self.stdout.write(f"  EMAIL_HOST_PASSWORD= {_status(email_password)}")
        self.stdout.write(f"  EMAIL_PORT         = {email_port!r}")
        self.stdout.write(f"  EMAIL_USE_TLS      = {email_tls!r}")
        self.stdout.write(f"  DEFAULT_FROM_EMAIL = {_status(from_email)}")
        if email_host and email_user and email_password:
            self.stdout.write(
                self.style.SUCCESS(
                    "  -> SMTP settings fully populated (password never shown)"
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "  -> SMTP settings INCOMPLETE: set EMAIL_HOST, "
                    "EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in backend/.env"
                )
            )

        # ── TWILIO ───────────────────────────────────────────────────────────
        self.stdout.write("\n[TWILIO - SMS]")
        sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
        token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
        sms_from = getattr(settings, "TWILIO_PHONE_NUMBER", None)

        self.stdout.write(
            f"  TWILIO_ACCOUNT_SID  = {_status(sid)} ({_mask_sid(sid)})"
        )
        self.stdout.write(f"  TWILIO_AUTH_TOKEN   = {_status(token)}")
        self.stdout.write(
            f"  TWILIO_FROM         = {_status(sms_from)} "
            f"({'SET' if sms_from else 'MISSING'})"
        )
        if all([sid, token, sms_from]):
            self.stdout.write(
                self.style.SUCCESS("  -> SMS fully configured (token never shown)")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "  -> SMS NOT configured: set TWILIO_ACCOUNT_SID, "
                    "TWILIO_AUTH_TOKEN and TWILIO_FROM in backend/.env "
                    "(https://console.twilio.com/)"
                )
            )

        # ── Optional: live SMTP auth test (login only, no message sent) ─────
        if options["smtp_auth_test"]:
            self.stdout.write("\n[SMTP AUTH TEST]")
            self._run_smtp_auth_test()

        # ── Optional: send a real test email to a database user ─────────────
        if options["send_test_email"]:
            self.stdout.write("\n[TEST EMAIL]")
            self._send_test_email(options["send_test_email"])

        self.stdout.write("")

    def _run_smtp_auth_test(self):
        host = getattr(settings, "EMAIL_HOST", None)
        port = getattr(settings, "EMAIL_PORT", 587)
        user = getattr(settings, "EMAIL_HOST_USER", None)
        # Gmail displays app passwords as "xxxx xxxx xxxx xxxx" — strip the
        # display spaces, matching what settings.py does on load.
        password = (getattr(settings, "EMAIL_HOST_PASSWORD", None) or "").replace(
            " ", ""
        )

        if not all([host, user, password]):
            self.stdout.write(
                self.style.WARNING(
                    "  SMTP not configured — nothing to test. "
                    "Set EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD."
                )
            )
            return

        self.stdout.write(f"  Host     = {host}:{port}")
        self.stdout.write(f"  User     = {user}")
        self.stdout.write(
            f"  Password = {len(password)} chars (never printed)"
        )
        self.stdout.write("  Action   = TLS upgrade + LOGIN only (no email sent)")

        try:
            server = smtplib.SMTP(host, port, timeout=20)
            server.ehlo()
            if getattr(settings, "EMAIL_USE_TLS", True):
                server.starttls()
                server.ehlo()
            server.login(user, password)
            server.quit()
            self.stdout.write(
                self.style.SUCCESS(
                    "  RESULT: SMTP AUTH SUCCESSFUL — credentials are valid."
                )
            )
        except smtplib.SMTPAuthenticationError as e:
            self.stdout.write(
                self.style.ERROR(
                    f"  RESULT: SMTP AUTH REJECTED (code={e.smtp_code}). "
                    f"Gmail 535 means the app password in backend/.env is "
                    f"invalid/revoked. Generate a fresh one at "
                    f"https://myaccount.google.com/apppasswords (16 chars, "
                    f"2FA must be ON) and update EMAIL_HOST_PASSWORD."
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f"  RESULT: SMTP ERROR ({type(e).__name__}): {e}"
                )
            )

    def _send_test_email(self, identifier: str):
        user = self._lookup_user(identifier)
        if user is None:
            raise CommandError(
                f"User '{identifier}' not found (tried id, username, email)."
            )
        if not user.email:
            raise CommandError(
                f"User '{user.username}' (id={user.id}) has NO email address "
                f"in the database — nothing to send to."
            )

        self.stdout.write(
            f"  Recipient = {user.email} (from user '{user.username}' id={user.id} in DB)"
        )

        subject = "PillSync - SMTP diagnostic test"
        body = (
            "This is a test email from the PillSync notification diagnostic.\n"
            "If you received this, the SMTP configuration in backend/.env is working."
        )
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

        try:
            sent = send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=False,
            )
            if sent == 1:
                self.stdout.write(
                    self.style.SUCCESS(
                        "  RESULT: test email SENT successfully."
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f"  RESULT: send_mail returned {sent}")
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f"  RESULT: test email FAILED — {type(e).__name__}: {e}"
                )
            )

    @staticmethod
    def _lookup_user(identifier: str):
        """Look up a user by numeric id, then username, then email."""
        user = None
        try:
            user = User.objects.get(pk=int(identifier))
        except (ValueError, User.DoesNotExist):
            pass
        if user is None:
            user = User.objects.filter(username=identifier).first()
        if user is None:
            user = User.objects.filter(email=identifier).first()
        return user
