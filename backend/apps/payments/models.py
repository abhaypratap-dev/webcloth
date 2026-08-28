from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.orders.models import Order


class PaymentMethodConfig(TimeStampedModel):
    """Admin-controlled availability and pay-to details for one payment method.

    One row per method, seeded by migration so the dashboard always has the
    full set to toggle. `cod`/`upi`/`bank` are settled by hand; `razorpay`/
    `stripe` need API keys in the environment before they can be turned on
    (see `configuration_error`).
    """

    class Method(models.TextChoices):
        COD = "cod", "Cash on Delivery"
        UPI = "upi", "UPI"
        BANK = "bank", "Bank Transfer"
        RAZORPAY = "razorpay", "Razorpay"
        STRIPE = "stripe", "Stripe"

    # Methods the customer pays outside the site, so an admin has to confirm
    # the money actually arrived before the order moves.
    MANUAL_METHODS = {Method.UPI, Method.BANK}

    method = models.CharField(max_length=20, choices=Method.choices, unique=True)
    is_enabled = models.BooleanField(default=False)
    # Overrides the choice label in the storefront when set.
    display_name = models.CharField(max_length=60, blank=True)
    description = models.CharField(max_length=200, blank=True)
    # Shown to the customer after placing a manual-payment order.
    instructions = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    # --- UPI ---
    upi_id = models.CharField(max_length=120, blank=True)
    upi_qr = models.ImageField(upload_to="payments/", blank=True, null=True)

    # --- Bank transfer ---
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=40, blank=True)
    bank_ifsc = models.CharField(max_length=20, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_branch = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["sort_order", "method"]
        verbose_name = "payment method"
        verbose_name_plural = "payment methods"

    def __str__(self):
        return f"{self.label} ({'on' if self.is_enabled else 'off'})"

    @property
    def label(self) -> str:
        return self.display_name or self.get_method_display()

    @property
    def is_manual(self) -> bool:
        return self.method in self.MANUAL_METHODS

    @property
    def configuration_error(self) -> str:
        """Why this method cannot be switched on yet, or "" when it is ready.

        Enabling a method whose details are missing would strand the customer
        on a checkout screen with nothing to pay to, so the API refuses it.
        """
        if self.method == self.Method.UPI and not self.upi_id:
            return "Add a UPI ID before enabling UPI."
        if self.method == self.Method.BANK and not (
            self.bank_account_number and self.bank_ifsc and self.bank_account_name
        ):
            return "Add the account name, account number and IFSC before enabling bank transfer."
        if self.method == self.Method.RAZORPAY and not (
            settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET
        ):
            return "Razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment."
        if self.method == self.Method.STRIPE and not settings.STRIPE_SECRET_KEY:
            return "Stripe needs STRIPE_SECRET_KEY in the environment."
        return ""

    def pay_to_details(self, request=None) -> dict:
        """What the customer needs in order to send the money."""
        if self.method == self.Method.UPI:
            qr = ""
            if self.upi_qr:
                qr = request.build_absolute_uri(self.upi_qr.url) if request else self.upi_qr.url
            return {"upi_id": self.upi_id, "upi_qr": qr}
        if self.method == self.Method.BANK:
            return {
                "account_name": self.bank_account_name,
                "account_number": self.bank_account_number,
                "ifsc": self.bank_ifsc,
                "bank_name": self.bank_name,
                "branch": self.bank_branch,
            }
        return {}

    @classmethod
    def enabled_methods(cls) -> list[str]:
        return list(cls.objects.filter(is_enabled=True).values_list("method", flat=True))


class Payment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        # Customer says they have paid a manual method and is waiting on review.
        SUBMITTED = "submitted", "Submitted for review"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey(Order, related_name="payments", on_delete=models.CASCADE)
    gateway = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CREATED)
    # Gateway-side identifiers / payloads
    external_id = models.CharField(max_length=200, blank=True, db_index=True)
    client_payload = models.JSONField(default=dict, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    # --- Manual payment (UPI / bank transfer) ---
    # The UTR or transaction reference the customer quotes, plus an optional
    # screenshot, so an admin can match it against the bank statement.
    reference = models.CharField(max_length=120, blank=True)
    proof = models.ImageField(upload_to="payments/proofs/", blank=True, null=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name="reviewed_payments", on_delete=models.SET_NULL,
    )
    review_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.gateway} {self.amount} for {self.order}"

    @property
    def awaiting_review(self) -> bool:
        return self.status == self.Status.SUBMITTED
