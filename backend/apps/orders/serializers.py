from rest_framework import serializers

from apps.accounts.models import Address

from .models import Order, OrderItem, OrderStatusEvent


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.FloatField(read_only=True)
    price = serializers.FloatField(read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "title", "slug", "size", "color", "image_url",
            "price", "quantity", "line_total",
        ]


class OrderStatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusEvent
        fields = ["status", "note", "created_at"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    events = OrderStatusEventSerializer(many=True, read_only=True)
    subtotal = serializers.FloatField(read_only=True)
    discount = serializers.FloatField(read_only=True)
    shipping = serializers.FloatField(read_only=True)
    tax = serializers.FloatField(read_only=True)
    total = serializers.FloatField(read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "subtotal", "discount", "shipping",
            "tax", "total", "coupon_code", "payment_method", "payment_status",
            "shipping_address", "billing_address", "notes", "tracking_number",
            "items", "events", "can_cancel", "created_at",
        ]

    def get_can_cancel(self, obj):
        return obj.status in Order.CANCELLABLE


class AdminOrderSerializer(OrderSerializer):
    customer_email = serializers.CharField(source="user.email", read_only=True)
    customer_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ["customer_email", "customer_name"]


class CheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField()
    billing_address_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(
        choices=Order.PaymentMethod.choices, default=Order.PaymentMethod.COD
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        user = self.context["request"].user
        try:
            attrs["shipping_address"] = Address.objects.get(pk=attrs["shipping_address_id"], user=user)
        except Address.DoesNotExist:
            raise serializers.ValidationError({"shipping_address_id": "Address not found."})
        billing_id = attrs.get("billing_address_id")
        if billing_id:
            try:
                attrs["billing_address"] = Address.objects.get(pk=billing_id, user=user)
            except Address.DoesNotExist:
                raise serializers.ValidationError({"billing_address_id": "Address not found."})
        else:
            attrs["billing_address"] = None
        return attrs


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
    tracking_number = serializers.CharField(required=False, allow_blank=True, max_length=100)
