import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Address
from apps.orders.models import Order
from apps.payments.models import Payment, PaymentMethodConfig
from apps.products.models import Product, ProductVariant


def png_upload(name="proof.png"):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "black").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), "image/png")


class PaymentMethodConfigTests(TestCase):
    """The seed migration must leave the store in a working state."""

    def test_seeded_with_cod_enabled_and_the_rest_off(self):
        self.assertEqual(PaymentMethodConfig.objects.count(), 5)
        self.assertEqual(PaymentMethodConfig.enabled_methods(), ["cod"])

    def test_upi_and_bank_are_manual_methods(self):
        by_method = {c.method: c for c in PaymentMethodConfig.objects.all()}
        self.assertTrue(by_method["upi"].is_manual)
        self.assertTrue(by_method["bank"].is_manual)
        self.assertFalse(by_method["cod"].is_manual)


class AdminPaymentMethodApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            get_user_model().objects.create_superuser("admin@cutcult.test", "pw", full_name="A")
        )
        self.upi = PaymentMethodConfig.objects.get(method="upi")
        self.bank = PaymentMethodConfig.objects.get(method="bank")

    def patch(self, config, **body):
        return self.client.patch(f"/api/payments/admin/methods/{config.id}/", body, format="json")

    def test_list_returns_every_method(self):
        response = self.client.get("/api/payments/admin/methods/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 5)

    def test_cannot_enable_upi_without_a_upi_id(self):
        response = self.patch(self.upi, is_enabled=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn("UPI ID", str(response.data))

    def test_enabling_upi_with_details_in_one_request_works(self):
        response = self.patch(self.upi, is_enabled=True, upi_id="cutcult@okhdfc")
        self.assertEqual(response.status_code, 200, response.data)
        self.upi.refresh_from_db()
        self.assertTrue(self.upi.is_enabled)

    def test_cannot_enable_bank_without_account_details(self):
        self.assertEqual(self.patch(self.bank, is_enabled=True).status_code, 400)
        response = self.patch(
            self.bank, is_enabled=True, bank_account_name="Cut & Cult",
            bank_account_number="000111222333", bank_ifsc="HDFC0000001",
        )
        self.assertEqual(response.status_code, 200)

    def test_cannot_enable_a_gateway_with_no_api_keys(self):
        razorpay = PaymentMethodConfig.objects.get(method="razorpay")
        response = self.patch(razorpay, is_enabled=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn("RAZORPAY_KEY_ID", str(response.data))

    def test_qr_upload(self):
        response = self.client.patch(
            f"/api/payments/admin/methods/{self.upi.id}/",
            {"upi_id": "cutcult@okhdfc", "upi_qr": png_upload("qr.png")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["upi_qr_url"])

    def test_method_cannot_be_renamed(self):
        # Orders record the method string; renaming a row would orphan them.
        self.patch(self.upi, method="something-else")
        self.upi.refresh_from_db()
        self.assertEqual(self.upi.method, "upi")

    def test_staff_only(self):
        self.client.force_authenticate(
            get_user_model().objects.create_user("shopper@cutcult.test", "pw", full_name="S")
        )
        self.assertEqual(self.client.get("/api/payments/admin/methods/").status_code, 403)


class ManualPaymentFlowTests(TestCase):
    """Customer pays by UPI outside the site; an admin confirms it."""

    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            "admin@cutcult.test", "pw", full_name="Admin"
        )
        self.user = get_user_model().objects.create_user(
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

    def place_upi_order(self):
        self.client.post(
            "/api/cart/items/",
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 1},
            format="json",
        )
        response = self.client.post(
            "/api/orders/checkout/",
            {"shipping_address_id": self.address.id, "payment_method": "upi"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Order.objects.get(pk=response.data["id"])

    def as_admin(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        return client

    # --- storefront ---

    def test_only_enabled_methods_are_listed(self):
        methods = self.client.get("/api/payments/methods/").data
        self.assertEqual({m["method"] for m in methods}, {"cod", "upi"})

    def test_listed_upi_carries_the_pay_to_details(self):
        upi = next(m for m in self.client.get("/api/payments/methods/").data if m["method"] == "upi")
        self.assertEqual(upi["pay_to"]["upi_id"], "cutcult@okhdfc")
        self.assertTrue(upi["is_manual"])

    def test_a_disabled_method_is_refused_at_checkout(self):
        self.client.post(
            "/api/cart/items/",
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 1},
            format="json",
        )
        response = self.client.post(
            "/api/orders/checkout/",
            {"shipping_address_id": self.address.id, "payment_method": "stripe"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    # --- the flow ---

    def test_order_is_held_awaiting_confirmation_with_stock_reserved(self):
        order = self.place_upi_order()
        self.assertEqual(order.payment_status, Order.PaymentStatus.AWAITING)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 2)

    def test_create_payment_returns_the_pay_to_details(self):
        order = self.place_upi_order()
        response = self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["payload"]["pay_to"]["upi_id"], "cutcult@okhdfc")

    def test_customer_cannot_self_verify_a_manual_payment(self):
        # Otherwise anyone could mark their own unpaid order as paid.
        order = self.place_upi_order()
        payment_id = self.client.post(
            "/api/payments/create/", {"order_id": order.id}, format="json"
        ).data["payment_id"]

        response = self.client.post(
            "/api/payments/verify/", {"payment_id": payment_id}, format="json"
        )
        self.assertFalse(response.data["verified"])
        order.refresh_from_db()
        self.assertNotEqual(order.payment_status, Order.PaymentStatus.PAID)

    def test_submit_then_approve(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")

        submit = self.client.post(
            "/api/payments/submit/",
            {"order_id": order.id, "reference": "412700001234", "proof": png_upload()},
            format="multipart",
        )
        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data["status"], Payment.Status.SUBMITTED)
        self.assertTrue(submit.data["proof_url"])

        payment_id = submit.data["id"]
        approve = self.as_admin().post(f"/api/payments/admin/{payment_id}/approve/", {}, format="json")
        self.assertEqual(approve.status_code, 200)

        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.status, Order.Status.CONFIRMED)
        self.assertTrue(order.events.filter(note__icontains="confirmed").exists())

    def test_reject_cancels_the_order_and_returns_stock(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")
        payment_id = self.client.post(
            "/api/payments/submit/", {"order_id": order.id, "reference": "bogus"}, format="json"
        ).data["id"]

        response = self.as_admin().post(
            f"/api/payments/admin/{payment_id}/reject/", {"note": "Nothing received"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.FAILED)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 3)

    def test_approving_twice_is_refused(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")
        payment_id = self.client.post(
            "/api/payments/submit/", {"order_id": order.id, "reference": "1"}, format="json"
        ).data["id"]

        admin = self.as_admin()
        self.assertEqual(admin.post(f"/api/payments/admin/{payment_id}/approve/").status_code, 200)
        self.assertEqual(admin.post(f"/api/payments/admin/{payment_id}/approve/").status_code, 400)

    def test_customer_cannot_approve(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")
        payment_id = self.client.post(
            "/api/payments/submit/", {"order_id": order.id, "reference": "1"}, format="json"
        ).data["id"]
        self.assertEqual(
            self.client.post(f"/api/payments/admin/{payment_id}/approve/").status_code, 403
        )

    def test_cannot_submit_against_someone_elses_order(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")

        intruder = APIClient()
        intruder.force_authenticate(
            get_user_model().objects.create_user("other@cutcult.test", "pw", full_name="O")
        )
        response = intruder.post(
            "/api/payments/submit/", {"order_id": order.id, "reference": "x"}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_order_payload_carries_pay_to_details_for_manual_orders(self):
        # The orders screen offers "pay now" straight from history, so the
        # details have to travel with the order, not just the checkout response.
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")

        row = next(
            o for o in self.client.get("/api/orders/").data["results"] if o["id"] == order.id
        )
        self.assertEqual(row["manual_payment"]["pay_to"]["upi_id"], "cutcult@okhdfc")
        self.assertEqual(row["manual_payment"]["status"], Payment.Status.PENDING)

    def test_order_payload_omits_pay_to_for_self_settling_methods(self):
        self.client.post(
            "/api/cart/items/",
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": 1},
            format="json",
        )
        response = self.client.post(
            "/api/orders/checkout/",
            {"shipping_address_id": self.address.id, "payment_method": "cod"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["manual_payment"])

    def test_admin_review_queue_lists_submitted_payments(self):
        order = self.place_upi_order()
        self.client.post("/api/payments/create/", {"order_id": order.id}, format="json")
        self.client.post(
            "/api/payments/submit/", {"order_id": order.id, "reference": "412700001234"},
            format="json",
        )
        response = self.as_admin().get("/api/payments/admin/?status=submitted")
        self.assertEqual(response.status_code, 200)
        row = response.data["results"][0]
        self.assertEqual(row["reference"], "412700001234")
        self.assertEqual(row["order_number"], order.order_number)
        self.assertEqual(row["customer_email"], self.user.email)
