from rest_framework import serializers

from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "parent", "description", "image",
            "is_active", "sort_order", "products_count",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {"slug": {"required": False}}


class CategoryTreeSerializer(CategorySerializer):
    children = serializers.SerializerMethodField()

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ["children"]

    def get_children(self, obj):
        return CategoryTreeSerializer(
            [c for c in obj.children.all() if c.is_active], many=True, context=self.context
        ).data
