from django.db import models

from apps.common.models import TimeStampedModel
from apps.orders.models import Order


class Payment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey(Order, related_name="payments", on_delete=models.CASCADE)
    gateway = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CREATED)
    # Gateway-side identifiers / payloads
    external_id = models.CharField(max_length=200, blank=True, db_index=True)
    client_payload = models.JSONField(default=dict, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.gateway} {self.amount} for {self.order}"
