from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.coupons.models import Coupon
from apps.products.models import Product, ProductVariant


class Cart(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="cart", on_delete=models.CASCADE)
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"Cart<{self.user}>"

    @classmethod
    def for_user(cls, user) -> "Cart":
        cart, _ = cls.objects.get_or_create(user=user)
        return cart


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["cart", "product", "variant"], name="unique_cart_line")
        ]

    def __str__(self):
        return f"{self.product} x{self.quantity}"
