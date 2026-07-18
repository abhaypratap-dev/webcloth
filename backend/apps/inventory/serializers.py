from rest_framework import serializers

from apps.products.models import ProductVariant

from .models import StockMovement


class InventoryVariantSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            "id", "product_id", "product_title", "product_slug", "size", "color",
            "sku", "stock", "low_stock_threshold", "is_low_stock",
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    variant = InventoryVariantSerializer(read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = ["id", "variant", "delta", "stock_after", "reason", "note", "created_by_email", "created_at"]


class StockAdjustSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    delta = serializers.IntegerField()
    reason = serializers.ChoiceField(choices=StockMovement.Reason.choices, default=StockMovement.Reason.MANUAL)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
