from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.categories.models import Category
from apps.common.models import TimeStampedModel
from apps.products.models import Product


class Coupon(TimeStampedModel):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percentage"
        FLAT = "flat", "Flat Amount"
        FREE_SHIPPING = "free_shipping", "Free Shipping"

    code = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=255, blank=True)
    discount_type = models.CharField(max_length=15, choices=DiscountType.choices)
    discount_value = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))]
    )
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Total redemptions allowed")
    per_user_limit = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    products = models.ManyToManyField(Product, blank=True, related_name="coupons")
    categories = models.ManyToManyField(Category, blank=True, related_name="coupons")
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at < timezone.now()

    @property
    def is_exhausted(self) -> bool:
        return self.usage_limit is not None and self.used_count >= self.usage_limit
