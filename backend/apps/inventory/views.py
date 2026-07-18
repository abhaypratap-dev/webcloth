from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.products.models import ProductVariant

from . import services
from .models import StockMovement
from .serializers import (
    InventoryVariantSerializer,
    StockAdjustSerializer,
    StockMovementSerializer,
)


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin inventory overview across all variants."""

    serializer_class = InventoryVariantSerializer
    permission_classes = [IsAdmin]
    search_fields = ["product__title", "sku", "size", "color"]
    ordering_fields = ["stock"]

    def get_queryset(self):
        return ProductVariant.objects.select_related("product").order_by("product__title", "id")


class StockMovementListView(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["reason", "variant"]

    def get_queryset(self):
        return StockMovement.objects.select_related("variant__product", "created_by")


class StockAdjustView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            variant = ProductVariant.objects.get(pk=data["variant_id"])
        except ProductVariant.DoesNotExist:
            return Response({"detail": "Variant not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            variant = services.adjust_stock(
                variant, data["delta"], data["reason"], data.get("note", ""), request.user
            )
        except services.OutOfStockError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InventoryVariantSerializer(variant).data)


class LowStockView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(
            {
                "low_stock": InventoryVariantSerializer(services.low_stock_variants(), many=True).data,
                "out_of_stock": InventoryVariantSerializer(services.out_of_stock_variants(), many=True).data,
            }
        )
