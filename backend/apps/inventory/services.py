from django.db import transaction
from django.db.models import F

from apps.products.models import ProductVariant

from .models import StockMovement


class OutOfStockError(Exception):
    pass


@transaction.atomic
def adjust_stock(variant: ProductVariant, delta: int, reason: str, note: str = "", user=None) -> ProductVariant:
    """Atomically apply a stock delta and record the movement."""
    variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
    new_stock = variant.stock + delta
    if new_stock < 0:
        raise OutOfStockError(f"Only {variant.stock} left for {variant}.")
    variant.stock = new_stock
    variant.save(update_fields=["stock"])
    StockMovement.objects.create(
        variant=variant, delta=delta, stock_after=new_stock, reason=reason, note=note, created_by=user
    )
    return variant


def low_stock_variants():
    return (
        ProductVariant.objects.select_related("product")
        .filter(stock__gt=0, stock__lte=F("low_stock_threshold"))
        .order_by("stock")
    )


def out_of_stock_variants():
    return ProductVariant.objects.select_related("product").filter(stock=0)
