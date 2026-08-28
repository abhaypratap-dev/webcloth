"""Notification service layer.

Delivery is channel-based: every event fans out to all registered channels.
EmailChannel is implemented; SMS and push channels can be added by
implementing `send(user, subject, body, link)` and appending to CHANNELS.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger("apps.notifications")


class EmailChannel:
    def send(self, user, subject: str, body: str, link: str = ""):
        try:
            send_mail(
                subject,
                body + (f"\n\n{link}" if link else ""),
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Email delivery failed for %s", user.email)


CHANNELS = [EmailChannel()]


def _notify(user, kind: str, title: str, body: str, link: str = ""):
    Notification.objects.create(user=user, kind=kind, title=title, body=body, link=link)
    for channel in CHANNELS:
        channel.send(user, title, body, link)


def send_password_reset_email(user, uid: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    _notify(
        user,
        Notification.Kind.PASSWORD_RESET,
        "Reset your password",
        f"Hi {user.full_name},\n\nUse the link below to set a new password. "
        "If you didn't request this, you can ignore this message.",
        link,
    )


def order_placed(order):
    _notify(
        order.user,
        Notification.Kind.ORDER_CONFIRMATION,
        f"Order {order.order_number} confirmed",
        f"Hi {order.user.full_name},\n\nWe've received your order "
        f"{order.order_number} for {order.total}. We'll let you know when it ships.",
        f"{settings.FRONTEND_URL}/account/orders",
    )


def payment_approved(order):
    _notify(
        order.user,
        Notification.Kind.PAYMENT_UPDATE,
        f"Payment confirmed for order {order.order_number}",
        f"Hi {order.user.full_name},\n\nWe've confirmed your "
        f"{order.get_payment_method_display()} payment for order "
        f"{order.order_number}. It's now being prepared.",
        f"{settings.FRONTEND_URL}/account/orders",
    )


def payment_rejected(order, reason: str = ""):
    _notify(
        order.user,
        Notification.Kind.PAYMENT_UPDATE,
        f"Payment could not be confirmed for order {order.order_number}",
        f"Hi {order.user.full_name},\n\nWe couldn't confirm your payment for "
        f"order {order.order_number}, so it has been cancelled and any reserved "
        f"stock released."
        + (f"\n\nReason: {reason}" if reason else "")
        + "\n\nIf you believe this is a mistake, reply to this email with your "
        "payment reference and we'll take another look.",
        f"{settings.FRONTEND_URL}/account/orders",
    )


def order_status_changed(order):
    kind = Notification.Kind.SHIPPING_UPDATE
    if order.status in ("delivered", "out_for_delivery"):
        kind = Notification.Kind.DELIVERY_UPDATE
    _notify(
        order.user,
        kind,
        f"Order {order.order_number}: {order.get_status_display()}",
        f"Hi {order.user.full_name},\n\nYour order {order.order_number} is now "
        f"{order.get_status_display().lower()}."
        + (f"\nTracking number: {order.tracking_number}" if order.tracking_number else ""),
        f"{settings.FRONTEND_URL}/account/orders",
    )
