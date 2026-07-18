from rest_framework import serializers

from apps.products.models import Product, ProductVariant
from apps.products.serializers import ProductImageSerializer


class CartLineSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="item_id")
    product_id = serializers.IntegerField(source="product.id")
    slug = serializers.CharField(source="product.slug")
    title = serializers.CharField(source="product.title")
    image = serializers.SerializerMethodField()
    size = serializers.CharField(source="variant.size", default=None)
    color = serializers.CharField(source="variant.color", default=None)
    variant_id = serializers.IntegerField(source="variant.id", default=None)
    quantity = serializers.IntegerField()
    price = serializers.FloatField(source="unit_price")
    base_price = serializers.FloatField()
    stock = serializers.SerializerMethodField()

    def get_image(self, line):
        images = list(line.product.images.all())
        if not images:
            return ""
        return ProductImageSerializer(images[0], context=self.context).data["url"]

    def get_stock(self, line):
        return line.variant.stock if line.variant else line.product.total_stock


class CartSerializer(serializers.Serializer):
    items = CartLineSerializer(source="lines", many=True)
    subtotal = serializers.FloatField()
    discount = serializers.FloatField()
    shipping = serializers.FloatField()
    tax = serializers.FloatField()
    total = serializers.FloatField()
    coupon_code = serializers.CharField(allow_null=True)
    coupon_error = serializers.CharField(allow_null=True)


class AddToCartSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.active(), source="product"
    )
    variant_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.all(), source="variant", required=False, allow_null=True
    )
    quantity = serializers.IntegerField(min_value=1, max_value=20, default=1)

    def validate(self, attrs):
        product = attrs["product"]
        variant = attrs.get("variant")
        if variant is not None and variant.product_id != product.id:
            raise serializers.ValidationError("Variant does not belong to this product.")
        stock = variant.stock if variant else product.total_stock
        if stock < attrs["quantity"]:
            raise serializers.ValidationError("Not enough stock for this item.")
        return attrs


class UpdateQuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=20)


class ApplyCouponSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=40)
