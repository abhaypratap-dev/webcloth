"""Coupon validation and discount computation against a set of cart lines."""

from decimal import Decimal

from .models import Coupon


class CouponError(Exception):
    pass


def get_valid_coupon(code: str, user, eligible_subtotal_check=True) -> Coupon:
    coupon = Coupon.objects.filter(code__iexact=code.strip(), is_active=True).first()
    if coupon is None:
        raise CouponError("This coupon code is not valid.")
    if coupon.is_expired:
        raise CouponError("This coupon has expired.")
    if coupon.is_exhausted:
        raise CouponError("This coupon has reached its usage limit.")
    if coupon.per_user_limit is not None and user is not None and user.is_authenticated:
        from apps.orders.models import Order

        used = Order.objects.filter(user=user, coupon=coupon).exclude(status=Order.Status.CANCELLED).count()
        if used >= coupon.per_user_limit:
            raise CouponError("You have already used this coupon.")
    return coupon


def eligible_subtotal(coupon: Coupon, lines) -> Decimal:
    """Subtotal of the lines the coupon applies to.

    Each line needs: product, unit_price (effective), quantity.
    An unscoped coupon applies to the whole cart.
    """
    product_ids = set(coupon.products.values_list("id", flat=True))
    category_ids = set(coupon.categories.values_list("id", flat=True))
    if not product_ids and not category_ids:
        return sum((line.unit_price * line.quantity for line in lines), Decimal("0"))

    total = Decimal("0")
    for line in lines:
        product = line.product
        if product.id in product_ids or (
            category_ids & {product.category_id, product.subcategory_id}
        ):
            total += line.unit_price * line.quantity
    return total


def compute_discount(coupon: Coupon, lines, shipping: Decimal) -> tuple[Decimal, Decimal]:
    """Returns (discount_amount, shipping_after_coupon)."""
    base = eligible_subtotal(coupon, lines)
    cart_subtotal = sum((line.unit_price * line.quantity for line in lines), Decimal("0"))

    if cart_subtotal < coupon.min_order_value:
        raise CouponError(f"Minimum order value for this coupon is {coupon.min_order_value}.")
    if base <= 0:
        raise CouponError("This coupon does not apply to the items in your bag.")

    if coupon.discount_type == Coupon.DiscountType.FREE_SHIPPING:
        return Decimal("0.00"), Decimal("0.00")

    if coupon.discount_type == Coupon.DiscountType.PERCENT:
        discount = base * coupon.discount_value / Decimal("100")
    else:
        discount = min(coupon.discount_value, base)

    if coupon.max_discount is not None:
        discount = min(discount, coupon.max_discount)

    return discount.quantize(Decimal("0.01")), shipping
