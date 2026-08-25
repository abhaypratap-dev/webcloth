from decimal import Decimal

from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator
from django.db import models

from apps.brands.models import Brand
from apps.categories.models import Category
from apps.common.models import TimeStampedModel
from apps.common.text import unique_slugify


class ProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status=Product.Status.ACTIVE)

    def storefront(self):
        return (
            self.active()
            .select_related("category", "subcategory", "brand")
            .prefetch_related("images", "variants")
        )


class Product(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    sku = models.CharField(max_length=64, unique=True, null=True, blank=True)
    description = models.TextField(blank=True)
    short_description = models.CharField(max_length=300, blank=True)

    brand = models.ForeignKey(Brand, null=True, blank=True, related_name="products", on_delete=models.SET_NULL)
    category = models.ForeignKey(Category, null=True, blank=True, related_name="products", on_delete=models.SET_NULL)
    subcategory = models.ForeignKey(
        Category, null=True, blank=True, related_name="subcategory_products", on_delete=models.SET_NULL
    )

    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    offer_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0"))]
    )

    material = models.CharField(max_length=200, blank=True)
    care_instructions = models.TextField(blank=True)
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    weight_grams = models.PositiveIntegerField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    featured = models.BooleanField(default=False, db_index=True)
    new_arrival = models.BooleanField(default=False, db_index=True)
    best_seller = models.BooleanField(default=False, db_index=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["price"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, self.title, fallback="product")
        # `sku` is unique but optional. An empty string is a *value* as far as
        # Postgres is concerned, so a second SKU-less product would collide on
        # ""; NULLs do not collide with each other, so store the absence as one.
        if not self.sku:
            self.sku = None
        if self.offer_price is not None and self.offer_price >= self.price:
            self.offer_price = None
        super().save(*args, **kwargs)

    @property
    def total_stock(self) -> int:
        return sum(v.stock for v in self.variants.all())

    @property
    def in_stock(self) -> bool:
        return self.total_stock > 0


class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name="images", on_delete=models.CASCADE)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    # Seed/CDN images that are not uploaded files.
    external_url = models.CharField(max_length=500, blank=True)
    alt = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.product} image #{self.sort_order}"

    @property
    def url(self) -> str:
        if self.image:
            return self.image.url
        return self.external_url


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, related_name="variants", on_delete=models.CASCADE)
    size = models.CharField(max_length=20, blank=True)
    color = models.CharField(max_length=50, blank=True)
    color_hex = models.CharField(max_length=9, blank=True)
    sku = models.CharField(max_length=64, blank=True)
    stock = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "size", "color"], name="unique_product_variant")
        ]

    def __str__(self):
        bits = [self.product.title, self.size, self.color]
        return " / ".join(b for b in bits if b)

    @property
    def is_low_stock(self) -> bool:
        return 0 < self.stock <= self.low_stock_threshold
