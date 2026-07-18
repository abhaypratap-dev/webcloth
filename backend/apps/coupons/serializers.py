from rest_framework import serializers

from .models import Coupon


class CouponSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_exhausted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Coupon
        fields = [
            "id", "code", "description", "discount_type", "discount_value",
            "min_order_value", "max_discount", "usage_limit", "per_user_limit",
            "used_count", "products", "categories", "is_active", "expires_at",
            "is_expired", "is_exhausted", "created_at",
        ]
        read_only_fields = ["id", "used_count", "created_at"]
