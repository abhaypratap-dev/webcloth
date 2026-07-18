"""Cart pricing: lines with effective prices, coupon, shipping, tax."""

from dataclasses import dataclass
from decimal import Decimal

from apps.coupons import services as coupon_services
from apps.offers import services as offer_services
from apps.store_settings.models import StoreSettings

from .models import Cart


@dataclass
class Line:
    item_id: int
    product: object
    variant: object
    quantity: int
    unit_price: Decimal  # effective (offer-applied) price
    base_price: Decimal


@dataclass
class CartTotals:
    lines: list
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    coupon_code: str | None
    coupon_error: str | None


def build_lines(cart: Cart) -> list[Line]:
    offers = offer_services.live_offers()
    lines = []
    items = cart.items.select_related(
        "product__category", "product__brand", "variant"
    ).prefetch_related("product__images", "product__variants")
    for item in items:
        sale, _ = offer_services.effective_price(item.product, offers)
        lines.append(
            Line(
                item_id=item.id,
                product=item.product,
                variant=item.variant,
                quantity=item.quantity,
                unit_price=sale if sale is not None else item.product.price,
                base_price=item.product.price,
            )
        )
    return lines


def compute_totals(cart: Cart, lines: list[Line] | None = None) -> CartTotals:
    settings_ = StoreSettings.load()
    if lines is None:
        lines = build_lines(cart)

    subtotal = sum((l.unit_price * l.quantity for l in lines), Decimal("0"))

    shipping = Decimal("0.00")
    if lines:
        threshold = settings_.free_shipping_threshold
        if threshold is None or subtotal < threshold:
            shipping = settings_.shipping_flat_rate

    discount = Decimal("0.00")
    coupon_error = None
    coupon_code = None
    if cart.coupon_id:
        try:
            coupon = coupon_services.get_valid_coupon(cart.coupon.code, cart.user)
            discount, shipping = coupon_services.compute_discount(coupon, lines, shipping)
            coupon_code = coupon.code
        except coupon_services.CouponError as exc:
            coupon_error = str(exc)

    taxable = max(subtotal - discount, Decimal("0"))
    tax = (taxable * settings_.tax_percent / Decimal("100")).quantize(Decimal("0.01"))
    total = (taxable + shipping + tax).quantize(Decimal("0.01"))

    return CartTotals(
        lines=lines,
        subtotal=subtotal.quantize(Decimal("0.01")),
        discount=discount,
        shipping=shipping,
        tax=tax,
        total=total,
        coupon_code=coupon_code,
        coupon_error=coupon_error,
    )
