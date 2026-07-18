from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order

from .gateways import GatewayError, get_gateway
from .models import Payment


class CreatePaymentView(APIView):
    """Start collecting payment for a pending order."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("order_id")
        order = Order.objects.filter(pk=order_id, user=request.user).first()
        if order is None:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.payment_status == Order.PaymentStatus.PAID:
            return Response({"detail": "Order is already paid."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            gateway = get_gateway(order.payment_method)
            payment = gateway.create(order)
        except GatewayError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "payment_id": payment.id,
                "gateway": payment.gateway,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "payload": payment.client_payload,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    """Confirm a gateway payment and mark the order paid."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payment = Payment.objects.filter(
            pk=request.data.get("payment_id"), order__user=request.user
        ).select_related("order").first()
        if payment is None:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            ok = get_gateway(payment.gateway).verify(payment, request.data)
        except GatewayError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order = payment.order
        if ok:
            payment.status = Payment.Status.SUCCEEDED
            if payment.gateway != "cod":
                order.payment_status = Order.PaymentStatus.PAID
                order.save(update_fields=["payment_status"])
        else:
            payment.status = Payment.Status.FAILED
        payment.save()
        return Response({"verified": ok, "order_payment_status": order.payment_status})
