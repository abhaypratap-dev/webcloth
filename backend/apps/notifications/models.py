from django.conf import settings
from django.db import models


class Notification(models.Model):
    """In-app notification log; email/SMS/push delivery goes through channels."""

    class Kind(models.TextChoices):
        ORDER_CONFIRMATION = "order_confirmation", "Order Confirmation"
        SHIPPING_UPDATE = "shipping_update", "Shipping Update"
        DELIVERY_UPDATE = "delivery_update", "Delivery Update"
        PAYMENT_UPDATE = "payment_update", "Payment Update"
        PASSWORD_RESET = "password_reset", "Password Reset"
        PROMO = "promo", "Promotional"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="notifications", on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=300, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} → {self.user}"
