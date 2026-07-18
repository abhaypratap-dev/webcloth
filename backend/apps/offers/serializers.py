from rest_framework import serializers

from .models import Offer


class OfferSerializer(serializers.ModelSerializer):
    is_live = serializers.BooleanField(read_only=True)

    class Meta:
        model = Offer
        fields = [
            "id", "name", "kind", "discount_type", "discount_value",
            "products", "categories", "start_at", "end_at", "is_active",
            "is_live", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
