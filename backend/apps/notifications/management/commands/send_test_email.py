"""Prove the SMTP configuration works, end to end, before trusting it live."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.notifications.services import EmailChannel


class _Recipient:
    """Stands in for a User — the channel only ever reads `.email`."""

    def __init__(self, email):
        self.email = email


class Command(BaseCommand):
    help = "Send a test email through the configured backend."

    def add_arguments(self, parser):
        parser.add_argument("email", help="Where to send the test message.")

    def handle(self, *args, **options):
        backend = settings.EMAIL_BACKEND
        self.stdout.write(f"Backend:   {backend}")
        self.stdout.write(f"Host:      {settings.EMAIL_HOST or '(unset)'}:{settings.EMAIL_PORT}")
        self.stdout.write(f"TLS:       {settings.EMAIL_USE_TLS}")
        self.stdout.write(f"User:      {settings.EMAIL_HOST_USER or '(unset)'}")
        self.stdout.write(f"From:      {settings.DEFAULT_FROM_EMAIL}")

        if "console" in backend:
            self.stdout.write(self.style.WARNING(
                "\nEMAIL_BACKEND is the console backend — the message below is printed, "
                "not delivered. Set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend "
                "to send for real."
            ))
        elif not (settings.EMAIL_HOST and settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD):
            raise CommandError(
                "SMTP backend selected but EMAIL_HOST / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD "
                "are not all set. For Gmail use smtp.gmail.com:587 with an App Password "
                "(a normal account password is rejected when 2-Step Verification is on)."
            )

        # Goes through the real channel, so a template error surfaces here too.
        EmailChannel().send(
            _Recipient(options["email"]),
            "Cut & Cult — test email",
            "If you're reading this, transactional email is working.\n\n"
            "Signup, password reset, order confirmations and payment alerts "
            "all go out through this same path.",
            f"{settings.FRONTEND_URL.rstrip('/')}/shop",
            "Visit the store",
        )
        self.stdout.write(self.style.SUCCESS(f"\nSent to {options['email']} (check the log above for failures)."))
