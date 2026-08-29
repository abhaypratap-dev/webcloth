"""Order placement and lifecycle transitions."""

import logging

from django.db import transaction
from django.db.models import F

from apps.cart import services as cart_services
from apps.cart.models import Cart
from apps.coupons.models import Coupon
from apps.inventory import services as inventory_services
from apps.notifications import services as notify

from .models import Order, OrderItem, OrderStatusEvent

logger = logging.getLogger("apps.orders")


class OrderError(Exception):
    pass


# Forward-only progression for admin status updates (cancel/refund handled separately).
STATUS_FLOW = [
    Order.Status.PENDING,
    Order.Status.CONFIRMED,
    Order.Status.PROCESSING,
    Order.Status.PACKED,
    Order.Status.SHIPPED,
    Order.Status.OUT_FOR_DELIVERY,
    Order.Status.DELIVERED,
]


def _address_snapshot(address) -> dict:
    return {
        "full_name": address.full_name,
        "phone": address.phone,
        "line1": address.line1,
        "line2": address.line2,
        "city": address.city,
        "state": address.state,
        "postal_code": address.postal_code,
        "country": address.country,
    }


@transaction.atomic
def place_order(user, shipping_address, billing_address=None, payment_method=Order.PaymentMethod.COD, notes="") -> Order:
    cart = Cart.for_user(user)
    lines = cart_services.build_lines(cart)
    if not lines:
        raise OrderError("Your bag is empty.")

    totals = cart_services.compute_totals(cart, lines)
    if totals.coupon_error:
        raise OrderError(totals.coupon_error)

    # Reserve stock first — this raises if anything is unavailable.
    for line in lines:
        if line.variant is not None:
            inventory_services.adjust_stock(
                line.variant, -line.quantity, reason="sale", note="Order placement", user=user
            )
        elif line.product.total_stock < line.quantity:
            raise OrderError(f"'{line.product.title}' is out of stock.")

    # UPI/bank transfers are settled outside the site: the order is real and
    # its stock is reserved, but it stays unpaid until an admin confirms the
    # money arrived (apps.payments.services.approve).
    from apps.payments.models import PaymentMethodConfig

    payment_status = (
        Order.PaymentStatus.AWAITING
        if payment_method in PaymentMethodConfig.MANUAL_METHODS
        else Order.PaymentStatus.PENDING
    )

    order = Order.objects.create(
        user=user,
        payment_status=payment_status,
        subtotal=totals.subtotal,
        discount=totals.discount,
        shipping=totals.shipping,
        tax=totals.tax,
        total=totals.total,
        coupon=cart.coupon if totals.coupon_code else None,
        coupon_code=totals.coupon_code or "",
        payment_method=payment_method,
        shipping_address=_address_snapshot(shipping_address),
        billing_address=_address_snapshot(billing_address) if billing_address else None,
        notes=notes,
    )

    for line in lines:
        images = list(line.product.images.all())
        OrderItem.objects.create(
            order=order,
            product=line.product,
            variant=line.variant,
            title=line.product.title,
            slug=line.product.slug,
            size=line.variant.size if line.variant else "",
            color=line.variant.color if line.variant else "",
            image_url=images[0].url if images else "",
            price=line.unit_price,
            quantity=line.quantity,
        )

    if order.coupon_id:
        Coupon.objects.filter(pk=order.coupon_id).update(used_count=F("used_count") + 1)

    OrderStatusEvent.objects.create(order=order, status=Order.Status.PENDING, note="Order placed")

    cart.items.all().delete()
    cart.coupon = None
    cart.save(update_fields=["coupon"])

    logger.info("Order %s placed by %s (total %s)", order.order_number, user.email, order.total)
    def _announce():
        notify.order_placed(order)
        notify.admin_order_placed(order)

    transaction.on_commit(_announce)
    return order


@transaction.atomic
def transition(order: Order, new_status: str, user=None, note: str = "") -> Order:
    if new_status not in Order.Status.values:
        raise OrderError("Unknown order status.")
    if order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
        raise OrderError("This order can no longer be updated.")

    if new_status == Order.Status.CANCELLED:
        return cancel(order, user=user, note=note)
    if new_status == Order.Status.REFUNDED:
        if order.status not in (Order.Status.DELIVERED, Order.Status.CANCELLED):
            raise OrderError("Only delivered orders can be refunded.")
        order.payment_status = Order.PaymentStatus.REFUNDED
    else:
        current = STATUS_FLOW.index(order.status) if order.status in STATUS_FLOW else -1
        target = STATUS_FLOW.index(new_status) if new_status in STATUS_FLOW else -1
        if target <= current:
            raise OrderError(f"Cannot move order from {order.status} back to {new_status}.")
        if new_status == Order.Status.DELIVERED and order.payment_method == Order.PaymentMethod.COD:
            order.payment_status = Order.PaymentStatus.PAID

    order.status = new_status
    order.save()
    OrderStatusEvent.objects.create(order=order, status=new_status, note=note, created_by=user)
    transaction.on_commit(lambda: notify.order_status_changed(order))
    return order


@transaction.atomic
def cancel(order: Order, user=None, note: str = "", notify_customer: bool = True) -> Order:
    if order.status not in Order.CANCELLABLE:
        raise OrderError("This order has already shipped and can no longer be cancelled.")
    # Restock
    for item in order.items.select_related("variant"):
        if item.variant is not None:
            inventory_services.adjust_stock(
                item.variant, item.quantity, reason="cancel",
                note=f"Order {order.order_number} cancelled", user=user,
            )
    order.status = Order.Status.CANCELLED
    if order.payment_status == Order.PaymentStatus.PAID:
        order.payment_status = Order.PaymentStatus.REFUNDED
    order.save()
    OrderStatusEvent.objects.create(
        order=order, status=Order.Status.CANCELLED, note=note or "Order cancelled", created_by=user
    )
    # Callers that send their own, more specific message opt out — a rejected
    # payment should not also produce a bare "your order is now cancelled".
    if notify_customer:
        transaction.on_commit(lambda: notify.order_status_changed(order))
    return order
