from rest_framework import serializers

from .models import Brand


class BrandSerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "logo", "description", "is_active", "products_count"]
        read_only_fields = ["id"]
        extra_kwargs = {"slug": {"required": False}}
