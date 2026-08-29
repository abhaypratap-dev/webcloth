"""Manual payment review.

UPI and bank transfers settle outside the site, so an order placed with one
sits at `payment_status = AWAITING` with its stock already reserved. An admin
then either confirms the money arrived (the order moves on as a paid,
confirmed order) or rejects it (the order is cancelled and the stock returns).
"""

import logging

from django.db import transaction
from django.utils import timezone

from apps.notifications import services as notify
from apps.orders import services as order_services
from apps.orders.models import Order, OrderStatusEvent

from .models import Payment

logger = logging.getLogger("apps.payments")


class PaymentError(Exception):
    pass


def submit_for_review(payment: Payment, reference: str, proof=None) -> Payment:
    """Customer states they have paid and hands over a reference to match."""
    if payment.order.payment_method not in Order.PaymentMethod.values:
        raise PaymentError("Unknown payment method.")
    if payment.status == Payment.Status.SUCCEEDED:
        raise PaymentError("This payment has already been confirmed.")
    if payment.order.status == Order.Status.CANCELLED:
        raise PaymentError("This order was cancelled.")

    payment.reference = reference
    if proof is not None:
        payment.proof = proof
    payment.status = Payment.Status.SUBMITTED
    payment.submitted_at = timezone.now()
    payment.save(update_fields=["reference", "proof", "status", "submitted_at", "updated_at"])

    order = payment.order
    if order.payment_status != Order.PaymentStatus.AWAITING:
        order.payment_status = Order.PaymentStatus.AWAITING
        order.save(update_fields=["payment_status"])

    logger.info(
        "Payment %s for order %s submitted for review (ref %s)",
        payment.pk, order.order_number, reference,
    )
    notify.admin_manual_payment_submitted(payment)
    return payment


@transaction.atomic
def approve(payment: Payment, user=None, note: str = "") -> Payment:
    """Confirm the money arrived: order becomes paid and moves to confirmed."""
    order = payment.order
    if payment.status == Payment.Status.SUCCEEDED:
        raise PaymentError("This payment has already been approved.")
    if order.status == Order.Status.CANCELLED:
        raise PaymentError("This order was cancelled and cannot be approved.")

    payment.status = Payment.Status.SUCCEEDED
    payment.reviewed_at = timezone.now()
    payment.reviewed_by = user
    payment.review_note = note
    payment.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_note", "updated_at"])

    order.payment_status = Order.PaymentStatus.PAID
    # A just-paid order moves off pending; anything further along keeps its
    # place, since an admin may have progressed it while the money was in
    # flight and `transition` refuses to go backwards.
    if order.status == Order.Status.PENDING:
        order.status = Order.Status.CONFIRMED
    order.save(update_fields=["payment_status", "status"])

    OrderStatusEvent.objects.create(
        order=order,
        status=order.status,
        note=note or f"{payment.gateway.upper()} payment confirmed",
        created_by=user,
    )
    logger.info("Payment %s for order %s approved by %s", payment.pk, order.order_number, user)
    transaction.on_commit(lambda: notify.payment_approved(order))
    return payment


@transaction.atomic
def reject(payment: Payment, user=None, note: str = "") -> Payment:
    """Money never arrived: fail the payment and cancel the order (restocking)."""
    order = payment.order
    if payment.status == Payment.Status.SUCCEEDED:
        raise PaymentError("This payment was already approved — refund it instead.")

    payment.status = Payment.Status.FAILED
    payment.reviewed_at = timezone.now()
    payment.reviewed_by = user
    payment.review_note = note
    payment.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_note", "updated_at"])

    if order.status != Order.Status.CANCELLED:
        # cancel() restocks and logs its own status event.
        # notify_customer=False: payment_rejected below says the same thing with
        # the reason attached, and two emails about one event is noise.
        order_services.cancel(
            order, user=user, note=note or "Payment could not be confirmed",
            notify_customer=False,
        )
    order.refresh_from_db()
    if order.payment_status != Order.PaymentStatus.FAILED:
        order.payment_status = Order.PaymentStatus.FAILED
        order.save(update_fields=["payment_status"])

    logger.info("Payment %s for order %s rejected by %s", payment.pk, order.order_number, user)
    transaction.on_commit(lambda: notify.payment_rejected(order, note))
    return payment
