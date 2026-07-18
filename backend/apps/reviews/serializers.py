from rest_framework import serializers

from apps.orders.models import Order, OrderItem

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="user.full_name", read_only=True)
    product_title = serializers.CharField(source="product.title", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "product", "product_title", "author", "rating", "title",
            "body", "is_approved", "created_at",
        ]
        read_only_fields = ["id", "is_approved", "created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        product = attrs.get("product") or (self.instance.product if self.instance else None)
        if self.instance is None:
            # Only verified purchasers may review.
            purchased = OrderItem.objects.filter(
                order__user=request.user,
                order__status=Order.Status.DELIVERED,
                product=product,
            ).exists()
            if not purchased:
                raise serializers.ValidationError("You can review a product after it has been delivered to you.")
            if Review.objects.filter(user=request.user, product=product).exists():
                raise serializers.ValidationError("You have already reviewed this product. Edit your review instead.")
        return attrs
