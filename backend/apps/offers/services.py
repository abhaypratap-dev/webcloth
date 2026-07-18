"""Effective-price resolution.

A product's selling price is the lowest of:
  - its base price,
  - its manual offer_price (if set),
  - the best live Offer that applies to it.

`live_offers()` is fetched once and reused across a whole product list to
avoid per-row queries.
"""

from decimal import Decimal

from apps.products.models import Product

from .models import Offer


def live_offers():
    return list(Offer.objects.live().prefetch_related("products", "categories"))


def effective_price(product: Product, offers: list[Offer] | None = None):
    """Returns (sale_price or None, applied_offer or None).

    sale_price is None when the product sells at base price.
    """
    if offers is None:
        offers = live_offers()

    best_price = None
    applied = None
    if product.offer_price is not None and product.offer_price < product.price:
        best_price = product.offer_price

    for offer in offers:
        if not offer.applies_to(product):
            continue
        candidate = offer.discounted_price(product.price)
        if candidate < (best_price if best_price is not None else product.price):
            best_price = candidate
            applied = offer

    return best_price, applied


def discount_percent(price: Decimal, sale_price: Decimal | None) -> int:
    if sale_price is None or price <= 0:
        return 0
    return round((price - sale_price) / price * 100)
