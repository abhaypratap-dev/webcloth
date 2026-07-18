"""Pluggable payment gateways.

Each gateway implements `create(order)` → client payload the frontend needs to
collect payment, and `verify(payment, data)` → bool (payment captured).
Register new gateways by adding a class to GATEWAYS.
"""

import base64
import hashlib
import hmac
import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings

from apps.orders.models import Order

from .models import Payment

logger = logging.getLogger("apps.payments")


class GatewayError(Exception):
    pass


class BaseGateway:
    name = "base"

    def create(self, order: Order) -> Payment:
        raise NotImplementedError

    def verify(self, payment: Payment, data: dict) -> bool:
        raise NotImplementedError

    def _new_payment(self, order: Order, **kwargs) -> Payment:
        from apps.store_settings.models import StoreSettings

        return Payment.objects.create(
            order=order,
            gateway=self.name,
            amount=order.total,
            currency=StoreSettings.load().currency,
            **kwargs,
        )


class CodGateway(BaseGateway):
    """Cash on delivery — nothing to collect online."""

    name = "cod"

    def create(self, order: Order) -> Payment:
        return self._new_payment(order, status=Payment.Status.PENDING)

    def verify(self, payment: Payment, data: dict) -> bool:
        # COD is settled on delivery (orders.services marks it paid then).
        return True


class RazorpayGateway(BaseGateway):
    name = "razorpay"
    api = "https://api.razorpay.com/v1"

    def _auth_header(self) -> str:
        if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
            raise GatewayError("Razorpay is not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.")
        raw = f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()
        return "Basic " + base64.b64encode(raw).decode()

    def create(self, order: Order) -> Payment:
        body = json.dumps(
            {
                "amount": int(order.total * 100),  # smallest currency unit
                "currency": "INR",
                "receipt": order.order_number,
            }
        ).encode()
        req = urllib.request.Request(
            f"{self.api}/orders",
            data=body,
            headers={"Authorization": self._auth_header(), "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
        except Exception as exc:  # network / API error
            logger.error("Razorpay order creation failed: %s", exc)
            raise GatewayError("Could not reach Razorpay. Try again.") from exc
        return self._new_payment(
            order,
            status=Payment.Status.PENDING,
            external_id=data["id"],
            client_payload={"razorpay_order_id": data["id"], "key_id": settings.RAZORPAY_KEY_ID,
                            "amount": data["amount"], "currency": data["currency"]},
        )

    def verify(self, payment: Payment, data: dict) -> bool:
        payment_id = data.get("razorpay_payment_id", "")
        signature = data.get("razorpay_signature", "")
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            f"{payment.external_id}|{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        ok = hmac.compare_digest(expected, signature)
        if ok:
            payment.meta["razorpay_payment_id"] = payment_id
        return ok


class StripeGateway(BaseGateway):
    name = "stripe"
    api = "https://api.stripe.com/v1"

    def _request(self, path: str, params: dict | None = None):
        if not settings.STRIPE_SECRET_KEY:
            raise GatewayError("Stripe is not configured. Set STRIPE_SECRET_KEY.")
        data = urllib.parse.urlencode(params).encode() if params is not None else None
        req = urllib.request.Request(
            f"{self.api}{path}",
            data=data,
            headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except Exception as exc:
            logger.error("Stripe request failed: %s", exc)
            raise GatewayError("Could not reach Stripe. Try again.") from exc

    def create(self, order: Order) -> Payment:
        intent = self._request(
            "/payment_intents",
            {
                "amount": int(order.total * 100),
                "currency": "usd",
                "metadata[order_number]": order.order_number,
                "automatic_payment_methods[enabled]": "true",
            },
        )
        return self._new_payment(
            order,
            status=Payment.Status.PENDING,
            external_id=intent["id"],
            client_payload={
                "client_secret": intent["client_secret"],
                "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            },
        )

    def verify(self, payment: Payment, data: dict) -> bool:
        intent = self._request(f"/payment_intents/{payment.external_id}")
        payment.meta["stripe_status"] = intent.get("status")
        return intent.get("status") == "succeeded"


GATEWAYS: dict[str, BaseGateway] = {
    g.name: g() for g in (CodGateway, RazorpayGateway, StripeGateway)
}


def get_gateway(name: str) -> BaseGateway:
    try:
        return GATEWAYS[name]
    except KeyError:
        raise GatewayError(f"Unknown payment method '{name}'.")
