"""Notification service layer.

Delivery is channel-based: every event fans out to all registered channels.
EmailChannel is implemented; SMS and push channels can be added by
implementing `send(user, subject, body, link)` and appending to CHANNELS.

Every send is best-effort. A store that cannot place an order because Gmail
is rate-limiting is worse than one that quietly logs the failure, so delivery
errors are caught and logged rather than raised — and the in-app Notification
row is written first, so nothing is lost when mail is down.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import Notification

logger = logging.getLogger("apps.notifications")


class EmailChannel:
    def send(self, user, subject: str, body: str, link: str = "", cta_label: str = ""):
        from apps.store_settings.models import StoreSettings

        try:
            store = StoreSettings.load()
            context = {
                "title": subject,
                "body": body,
                "link": link,
                "cta_label": cta_label,
                "frontend_url": settings.FRONTEND_URL.rstrip("/"),
                "store_name": store.store_name,
                "tagline": store.tagline,
                "contact_email": store.contact_email,
            }
            text = body + (f"\n\n{link}" if link else "")
            message = EmailMultiAlternatives(
                subject, text, settings.DEFAULT_FROM_EMAIL, [user.email]
            )
            message.attach_alternative(render_to_string("emails/base.html", context), "text/html")
            message.send(fail_silently=False)
        except Exception:
            logger.exception("Email delivery failed for %s (%s)", user.email, subject)


CHANNELS = [EmailChannel()]


def _notify(user, kind: str, title: str, body: str, link: str = "", cta_label: str = ""):
    Notification.objects.create(user=user, kind=kind, title=title, body=body, link=link)
    for channel in CHANNELS:
        channel.send(user, title, body, link, cta_label)


def _staff_recipients():
    """Everyone who should hear about store-side events.

    Staff accounts rather than a single configured address, so adding an admin
    is enough to start receiving alerts and nobody has to remember to update a
    settings field.
    """
    return get_user_model().objects.filter(is_staff=True, is_active=True)


def _notify_staff(kind: str, title: str, body: str, link: str = "", cta_label: str = ""):
    recipients = list(_staff_recipients())
    if not recipients:
        logger.warning("No staff accounts to notify: %s", title)
        return
    for admin in recipients:
        _notify(admin, kind, title, body, link, cta_label)


def _admin_url(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


# ---------------------------------------------------------------------------
# Account
# ---------------------------------------------------------------------------


def send_welcome_email(user):
    _notify(
        user,
        Notification.Kind.WELCOME,
        "Welcome to the cult",
        f"Hi {user.full_name},\n\nYour account is live. You can now track orders, "
        "save addresses and keep a wishlist.\n\n"
        "We don't follow trends. We build classics — glad to have you with us.",
        f"{settings.FRONTEND_URL.rstrip('/')}/shop",
        "Start shopping",
    )


def send_password_reset_email(user, uid: str, token: str):
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
    _notify(
        user,
        Notification.Kind.PASSWORD_RESET,
        "Reset your password",
        f"Hi {user.full_name},\n\nUse the button below to set a new password. "
        "The link is single-use and expires shortly.\n\n"
        "If you didn't request this, you can safely ignore this message — "
        "your password won't change.",
        link,
        "Set a new password",
    )


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


def order_placed(order):
    _notify(
        order.user,
        Notification.Kind.ORDER_CONFIRMATION,
        f"Order {order.order_number} received",
        f"Hi {order.user.full_name},\n\nWe've received your order "
        f"{order.order_number} for ₹{order.total}. "
        + (
            "It's reserved for you — send the payment and submit your reference, "
            "and we'll confirm it before dispatch."
            if order.payment_status == order.PaymentStatus.AWAITING
            else "We'll let you know when it ships."
        ),
        f"{settings.FRONTEND_URL.rstrip('/')}/account/orders",
        "Track order",
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
        f"{settings.FRONTEND_URL.rstrip('/')}/account/orders",
        "Track order",
    )


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


def payment_approved(order):
    _notify(
        order.user,
        Notification.Kind.PAYMENT_UPDATE,
        f"Payment confirmed for order {order.order_number}",
        f"Hi {order.user.full_name},\n\nWe've confirmed your "
        f"{order.get_payment_method_display()} payment for order "
        f"{order.order_number}. It's now being prepared.",
        f"{settings.FRONTEND_URL.rstrip('/')}/account/orders",
        "Track order",
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
        f"{settings.FRONTEND_URL.rstrip('/')}/account/orders",
        "View order",
    )


# ---------------------------------------------------------------------------
# Store-side alerts
# ---------------------------------------------------------------------------


def admin_order_placed(order):
    _notify_staff(
        Notification.Kind.ADMIN_ALERT,
        f"New order {order.order_number} — ₹{order.total}",
        f"{order.user.full_name} ({order.user.email}) placed order "
        f"{order.order_number} for ₹{order.total} "
        f"via {order.get_payment_method_display()}.\n\n"
        f"Items: {order.items.count()}\n"
        f"Payment status: {order.get_payment_status_display()}",
        _admin_url("/admin/orders"),
        "Open orders",
    )


def admin_manual_payment_submitted(payment):
    """A customer says they have paid by UPI / bank transfer — needs review.

    This is the one alert the store cannot afford to miss: until an admin
    confirms it, the order sits unpaid with its stock held.
    """
    order = payment.order
    _notify_staff(
        Notification.Kind.ADMIN_ALERT,
        f"Payment to confirm — order {order.order_number}",
        f"{order.user.full_name} ({order.user.email}) has submitted a "
        f"{payment.gateway.upper()} payment of ₹{payment.amount} for order "
        f"{order.order_number}.\n\n"
        f"Reference: {payment.reference or '(none given)'}\n"
        f"Screenshot: {'attached in the dashboard' if payment.proof else 'not provided'}\n\n"
        "Check it against your account, then approve or reject it. The order's "
        "stock stays reserved until you do.",
        _admin_url("/admin/payments"),
        "Review payment",
    )
