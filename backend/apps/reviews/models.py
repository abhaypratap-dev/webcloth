from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel
from apps.products.models import Product


class Review(TimeStampedModel):
    product = models.ForeignKey(Product, related_name="reviews", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="reviews", on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=150, blank=True)
    body = models.TextField(blank=True)
    is_approved = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["product", "user"], name="one_review_per_product_user")
        ]

    def __str__(self):
        return f"{self.product} — {self.rating}★ by {self.user}"
