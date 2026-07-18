from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.store_settings.models import StoreSettings

from . import services
from .models import Order
from .serializers import (
    AdminOrderSerializer,
    CheckoutSerializer,
    OrderSerializer,
    StatusUpdateSerializer,
)


def render_invoice(order: Order) -> HttpResponse:
    html = render_to_string(
        "orders/invoice.html", {"order": order, "settings": StoreSettings.load()}
    )
    response = HttpResponse(html, content_type="text/html")
    response["Content-Disposition"] = f'inline; filename="invoice-{order.order_number}.html"'
    return response


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Customer orders: list, detail, place (checkout), cancel, invoice."""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items", "events")
        )

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            order = services.place_order(
                user=request.user,
                shipping_address=data["shipping_address"],
                billing_address=data["billing_address"],
                payment_method=data["payment_method"],
                notes=data.get("notes", ""),
            )
        except services.OrderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        try:
            order = services.cancel(order, user=request.user, note="Cancelled by customer")
        except services.OrderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)

    @action(detail=True)
    def invoice(self, request, pk=None):
        return render_invoice(self.get_object())


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin order management: list, detail, status transitions, invoice."""

    serializer_class = AdminOrderSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "payment_method", "payment_status"]
    search_fields = ["order_number", "user__email", "user__full_name"]
    ordering_fields = ["created_at", "total"]

    def get_queryset(self):
        return Order.objects.select_related("user").prefetch_related("items", "events")

    @action(detail=True, methods=["patch"])
    def set_status(self, request, pk=None):
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = self.get_object()
        tracking = serializer.validated_data.get("tracking_number")
        if tracking:
            order.tracking_number = tracking
            order.save(update_fields=["tracking_number"])
        try:
            order = services.transition(
                order,
                serializer.validated_data["status"],
                user=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        except services.OrderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        # Re-fetch so the response includes the event just written.
        order = self.get_queryset().get(pk=order.pk)
        return Response(AdminOrderSerializer(order).data)

    @action(detail=True)
    def invoice(self, request, pk=None):
        return render_invoice(self.get_object())
