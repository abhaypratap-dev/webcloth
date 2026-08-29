from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Address
from apps.notifications.models import Notification
from apps.payments.models import PaymentMethodConfig
from apps.products.models import Product, ProductVariant

SMTP = override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")


@SMTP
class AccountEmailTests(TestCase):
    def test_signup_sends_a_welcome_email(self):
        response = self.client.post(
            "/api/auth/register/",
            {"full_name": "New Cultist", "email": "new@cutcult.test", "mobile": "+919876543210",
             "password": "Passw0rd!123", "confirm_password": "Passw0rd!123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Welcome", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["new@cutcult.test"])
        self.assertTrue(
            Notification.objects.filter(kind=Notification.Kind.WELCOME).exists()
        )

    def test_welcome_email_has_a_branded_html_part(self):
        self.client.post(
            "/api/auth/register/",
            {"full_name": "New", "email": "html@cutcult.test", "mobile": "+919876543211",
             "password": "Passw0rd!123", "confirm_password": "Passw0rd!123"},
            content_type="application/json",
        )
        body, mimetype = mail.outbox[0].alternatives[0]
        self.assertEqual(mimetype, "text/html")
        self.assertIn("<html", body)
        self.assertIn("logo.png", body)

    def test_a_mail_failure_does_not_break_signup(self):
        # A Gmail outage must not stop people creating accounts.
        with override_settings(EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
                               EMAIL_HOST="127.0.0.1", EMAIL_PORT=1):
            response = self.client.post(
                "/api/auth/register/",
                {"full_name": "Resilient", "email": "resilient@cutcult.test",
                 "mobile": "+919876543212", "password": "Passw0rd!123",
                 "confirm_password": "Passw0rd!123"},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 201)
        # The in-app record is still written even though delivery failed.
        self.assertTrue(Notification.objects.filter(kind=Notification.Kind.WELCOME).exists())

    def test_forgot_password_sends_a_reset_link(self):
        get_user_model().objects.create_user(
            "known@cutcult.test", "pw", full_name="Known"
        )
        response = self.client.post(
            "/api/auth/forgot-password/", {"email": "known@cutcult.test"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset-password?uid=", mail.outbox[0].body)

    def test_forgot_password_for_an_unknown_email_sends_nothing(self):
        # And still answers 200, so the endpoint can't be used to enumerate users.
        response = self.client.post(
            "/api/auth/forgot-password/", {"email": "ghost@cutcult.test"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)


@SMTP
class OrderAndPaymentEmailTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser("admin@cutcult.test", "pw", full_name="Admin")
        self.user = User.objects.create_user(
            "shopper@cutcult.test", "pw", full_name="Shopper", mobile="+919876543210"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.product = Product.objects.create(title="Raglan Tee", price=999)
        self.variant = ProductVariant.objects.create(
            product=self.product, size="M", color="Black", stock=3
        )
        self.address = Address.objects.create(
            user=self.user, full_name="Shopper", phone="+919876543210",
            line1="1 Test Street", city="Delhi", state="DL", postal_code="110001",
        )
        PaymentMethodConfig.objects.filter(method="upi").update(
            is_enabled=True, upi_id="cutcult@okhdfc"
        )

    def place(self, method="upi"):
        self.client.post(
            "/api/cart/items/",
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 1},
            format="json",
        )
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                "/api/orders/checkout/",
                {"shipping_address_id": self.address.id, "payment_method": method},
                format="json",
            )

    def recipients(self):
        return [addr for m in mail.outbox for addr in m.to]

    def test_placing_an_order_emails_the_customer_and_the_staff(self):
        response = self.place("cod")
        self.assertEqual(response.status_code, 201)
        self.assertIn("shopper@cutcult.test", self.recipients())
        self.assertIn("admin@cutcult.test", self.recipients())

    def test_submitting_a_manual_payment_alerts_staff_to_review_it(self):
        order = self.place("upi").data
        self.client.post("/api/payments/create/", {"order_id": order["id"]}, format="json")
        mail.outbox.clear()

        self.client.post(
            "/api/payments/submit/",
            {"order_id": order["id"], "reference": "412700001234"}, format="json",
        )
        staff_mail = [m for m in mail.outbox if "admin@cutcult.test" in m.to]
        self.assertEqual(len(staff_mail), 1)
        self.assertIn("Payment to confirm", staff_mail[0].subject)
        self.assertIn("412700001234", staff_mail[0].body)
        self.assertIn("/admin/payments", staff_mail[0].body)

    def test_approving_a_payment_emails_the_customer(self):
        order = self.place("upi").data
        self.client.post("/api/payments/create/", {"order_id": order["id"]}, format="json")
        payment_id = self.client.post(
            "/api/payments/submit/", {"order_id": order["id"], "reference": "1"}, format="json"
        ).data["id"]
        mail.outbox.clear()

        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            admin_client.post(f"/api/payments/admin/{payment_id}/approve/", {}, format="json")

        customer_mail = [m for m in mail.outbox if "shopper@cutcult.test" in m.to]
        self.assertEqual(len(customer_mail), 1)
        self.assertIn("Payment confirmed", customer_mail[0].subject)

    def test_rejecting_a_payment_emails_the_customer_with_the_reason(self):
        order = self.place("upi").data
        self.client.post("/api/payments/create/", {"order_id": order["id"]}, format="json")
        payment_id = self.client.post(
            "/api/payments/submit/", {"order_id": order["id"], "reference": "1"}, format="json"
        ).data["id"]
        mail.outbox.clear()

        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            admin_client.post(
                f"/api/payments/admin/{payment_id}/reject/",
                {"note": "No credit found"}, format="json",
            )
        customer_mail = [m for m in mail.outbox if "shopper@cutcult.test" in m.to]
        # Exactly one: the rejection notice carries the reason, and the generic
        # "order cancelled" status mail is suppressed for this path.
        self.assertEqual(len(customer_mail), 1)
        self.assertIn("No credit found", customer_mail[0].body)

    def test_awaiting_orders_get_a_different_confirmation_than_settled_ones(self):
        self.place("upi")
        customer_mail = [m for m in mail.outbox if "shopper@cutcult.test" in m.to][0]
        self.assertIn("submit your reference", customer_mail.body)
