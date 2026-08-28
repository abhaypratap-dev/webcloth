import secrets

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel
from apps.coupons.models import Coupon
from apps.products.models import Product, ProductVariant


def generate_order_number() -> str:
    return "CC-" + secrets.token_hex(4).upper()


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PROCESSING = "processing", "Processing"
        PACKED = "packed", "Packed"
        SHIPPED = "shipped", "Shipped"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for Delivery"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    class PaymentMethod(models.TextChoices):
        COD = "cod", "Cash on Delivery"
        UPI = "upi", "UPI"
        BANK = "bank", "Bank Transfer"
        RAZORPAY = "razorpay", "Razorpay"
        STRIPE = "stripe", "Stripe"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        # UPI/bank transfers are paid outside the site: the customer has said
        # they sent the money and an admin has not yet confirmed it arrived.
        AWAITING = "awaiting", "Awaiting confirmation"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    # Statuses in which a customer may still cancel.
    CANCELLABLE = {Status.PENDING, Status.CONFIRMED, Status.PROCESSING, Status.PACKED}

    order_number = models.CharField(max_length=20, unique=True, default=generate_order_number)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="orders", on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL)
    coupon_code = models.CharField(max_length=40, blank=True)

    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.COD)
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )

    # Address snapshots — orders must survive address edits/deletes.
    shipping_address = models.JSONField()
    billing_address = models.JSONField(null=True, blank=True)

    notes = models.TextField(blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["-created_at"])]

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL)
    # Snapshots
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, blank=True)
    size = models.CharField(max_length=20, blank=True)
    color = models.CharField(max_length=50, blank=True)
    image_url = models.CharField(max_length=500, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.title} x{self.quantity}"

    @property
    def line_total(self):
        return self.price * self.quantity


class OrderStatusEvent(models.Model):
    order = models.ForeignKey(Order, related_name="events", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Order.Status.choices)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.order} → {self.status}"
