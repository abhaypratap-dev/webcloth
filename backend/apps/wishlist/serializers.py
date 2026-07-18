from rest_framework import serializers

from apps.products.models import Product
from apps.products.serializers import ProductListSerializer

from .models import WishlistItem


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.active(), source="product", write_only=True
    )

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "product_id", "created_at"]
        read_only_fields = ["id", "created_at"]
