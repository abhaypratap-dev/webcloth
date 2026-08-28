from rest_framework import mixins, parsers, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.orders.models import Order

from . import services
from .gateways import GatewayError, get_gateway
from .models import Payment, PaymentMethodConfig
from .serializers import (
    AdminPaymentSerializer,
    PaymentMethodAdminSerializer,
    PaymentMethodPublicSerializer,
    PaymentSerializer,
    ReviewSerializer,
    SubmitPaymentSerializer,
)


class PaymentMethodListView(APIView):
    """Enabled payment methods, for the checkout screen. Public."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        methods = PaymentMethodConfig.objects.filter(is_enabled=True)
        return Response(
            PaymentMethodPublicSerializer(methods, many=True, context={"request": request}).data
        )


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
            payment = gateway.create(order, request=request)
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


class SubmitPaymentProofView(APIView):
    """Customer declares they have paid a manual method (UPI / bank transfer)."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        serializer = SubmitPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payments = Payment.objects.filter(order__user=request.user).select_related("order")
        if data.get("payment_id"):
            payment = payments.filter(pk=data["payment_id"]).first()
        else:
            payment = payments.filter(order_id=data["order_id"]).order_by("-created_at").first()
        if payment is None:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = services.submit_for_review(
                payment, data["reference"], proof=data.get("proof")
            )
        except services.PaymentError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PaymentSerializer(payment, context={"request": request}).data)


class AdminPaymentMethodViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Toggle methods on/off and hold their pay-to details.

    List/retrieve/update only — the rows are seeded by migration so the set of
    methods stays in step with what the gateways can actually handle.
    """

    serializer_class = PaymentMethodAdminSerializer
    permission_classes = [IsAdmin]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    queryset = PaymentMethodConfig.objects.all()
    pagination_class = None


class AdminPaymentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Review queue for manually-settled payments."""

    serializer_class = AdminPaymentSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "gateway"]
    search_fields = ["reference", "order__order_number", "order__user__email"]
    ordering_fields = ["created_at", "submitted_at"]

    def get_queryset(self):
        return Payment.objects.select_related("order", "order__user", "reviewed_by")

    def _review(self, request, pk, handler):
        payment = self.get_object()
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = handler(
                payment, user=request.user, note=serializer.validated_data.get("note", "")
            )
        except services.PaymentError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payment = self.get_queryset().get(pk=payment.pk)
        return Response(AdminPaymentSerializer(payment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._review(request, pk, services.approve)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._review(request, pk, services.reject)
