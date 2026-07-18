from django.conf import settings
from django.db import models

from apps.products.models import ProductVariant


class StockMovement(models.Model):
    class Reason(models.TextChoices):
        MANUAL = "manual", "Manual adjustment"
        SALE = "sale", "Order placed"
        CANCEL = "cancel", "Order cancelled"
        RETURN = "return", "Return / refund"
        RESTOCK = "restock", "Restock"

    variant = models.ForeignKey(ProductVariant, related_name="movements", on_delete=models.CASCADE)
    delta = models.IntegerField()
    stock_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=10, choices=Reason.choices, default=Reason.MANUAL)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.variant} {self.delta:+d} → {self.stock_after}"
