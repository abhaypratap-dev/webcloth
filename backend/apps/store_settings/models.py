from decimal import Decimal

from django.db import models

from apps.common.models import TimeStampedModel


class StoreSettings(TimeStampedModel):
    """Singleton row holding storewide configuration."""

    store_name = models.CharField(max_length=120, default="Cut & Cult")
    tagline = models.CharField(max_length=255, blank=True, default="Building a culture. One cut at a time.")
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)

    instagram_url = models.URLField(blank=True)
    twitter_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)

    currency = models.CharField(max_length=3, default="USD")
    currency_symbol = models.CharField(max_length=3, default="$")
    shipping_flat_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("10.00"))
    free_shipping_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, default=Decimal("200.00")
    )
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))

    order_email_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "store settings"

    def __str__(self):
        return self.store_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "StoreSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
