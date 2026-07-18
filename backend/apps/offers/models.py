from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.categories.models import Category
from apps.common.models import TimeStampedModel
from apps.products.models import Product


class OfferQuerySet(models.QuerySet):
    def live(self):
        """Offers currently in their active window (auto activation/expiry)."""
        now = timezone.now()
        return self.filter(is_active=True, start_at__lte=now).filter(
            models.Q(end_at__isnull=True) | models.Q(end_at__gte=now)
        )


class Offer(TimeStampedModel):
    class Kind(models.TextChoices):
        PRODUCT = "product", "Product Offer"
        CATEGORY = "category", "Category Offer"
        SEASONAL = "seasonal", "Seasonal Offer"
        FESTIVAL = "festival", "Festival Offer"
        FLASH = "flash", "Flash Sale"

    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percentage"
        FIXED = "fixed", "Fixed Amount"

    name = models.CharField(max_length=150)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.PRODUCT)
    discount_type = models.CharField(max_length=10, choices=DiscountType.choices, default=DiscountType.PERCENT)
    discount_value = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    products = models.ManyToManyField(Product, blank=True, related_name="offers")
    categories = models.ManyToManyField(Category, blank=True, related_name="offers")
    start_at = models.DateTimeField(default=timezone.now)
    end_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    objects = OfferQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def is_live(self) -> bool:
        now = timezone.now()
        return self.is_active and self.start_at <= now and (self.end_at is None or self.end_at >= now)

    def applies_to(self, product: Product) -> bool:
        # Site-wide (seasonal/festival/flash) offers with no scoping apply to everything.
        product_ids = {p.id for p in self.products.all()}
        category_ids = {c.id for c in self.categories.all()}
        if not product_ids and not category_ids:
            return self.kind in (self.Kind.SEASONAL, self.Kind.FESTIVAL, self.Kind.FLASH)
        if product.id in product_ids:
            return True
        return bool(category_ids & {product.category_id, product.subcategory_id})

    def discounted_price(self, price: Decimal) -> Decimal:
        if self.discount_type == self.DiscountType.PERCENT:
            discounted = price * (Decimal("100") - self.discount_value) / Decimal("100")
        else:
            discounted = price - self.discount_value
        return max(discounted.quantize(Decimal("0.01")), Decimal("0.00"))
