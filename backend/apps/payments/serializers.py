from rest_framework import serializers

from .models import Payment, PaymentMethodConfig


class PaymentMethodPublicSerializer(serializers.ModelSerializer):
    """What the checkout screen needs: the label, and where to send money."""

    label = serializers.CharField(read_only=True)
    is_manual = serializers.BooleanField(read_only=True)
    pay_to = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethodConfig
        fields = ["method", "label", "description", "instructions", "is_manual", "pay_to"]

    def get_pay_to(self, obj):
        return obj.pay_to_details(self.context.get("request"))


class PaymentMethodAdminSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    is_manual = serializers.BooleanField(read_only=True)
    configuration_error = serializers.CharField(read_only=True)
    upi_qr_url = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethodConfig
        fields = [
            "id", "method", "label", "is_enabled", "display_name", "description",
            "instructions", "sort_order", "is_manual", "configuration_error",
            "upi_id", "upi_qr", "upi_qr_url",
            "bank_account_name", "bank_account_number", "bank_ifsc",
            "bank_name", "bank_branch",
        ]
        # `method` identifies the row and is seeded by migration — renaming it
        # would orphan every order that already recorded it.
        read_only_fields = ["id", "method"]
        extra_kwargs = {"upi_qr": {"write_only": True, "required": False}}

    def get_upi_qr_url(self, obj):
        if not obj.upi_qr:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.upi_qr.url) if request else obj.upi_qr.url

    def validate(self, attrs):
        # Rows are seeded by migration and this serializer is update-only, so
        # there is always an instance; guard anyway rather than crash if a
        # create route is ever added.
        if self.instance is None:
            return attrs
        # Check the *result* of the patch, so enabling and filling in the
        # details in one request works.
        merged = PaymentMethodConfig(
            **{f.name: getattr(self.instance, f.name) for f in PaymentMethodConfig._meta.fields}
        )
        for key, value in attrs.items():
            setattr(merged, key, value)
        if merged.is_enabled and merged.configuration_error:
            raise serializers.ValidationError({"is_enabled": merged.configuration_error})
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    amount = serializers.FloatField(read_only=True)
    proof_url = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "gateway", "amount", "currency", "status", "client_payload",
            "reference", "proof_url", "submitted_at", "reviewed_at",
            "review_note", "created_at",
        ]
        read_only_fields = fields

    def get_proof_url(self, obj):
        if not obj.proof:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.proof.url) if request else obj.proof.url


class AdminPaymentSerializer(PaymentSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    order_id = serializers.IntegerField(source="order.id", read_only=True)
    order_status = serializers.CharField(source="order.status", read_only=True)
    order_payment_status = serializers.CharField(source="order.payment_status", read_only=True)
    customer_email = serializers.CharField(source="order.user.email", read_only=True)
    customer_name = serializers.CharField(source="order.user.full_name", read_only=True)
    reviewed_by_email = serializers.CharField(source="reviewed_by.email", read_only=True, default=None)

    class Meta(PaymentSerializer.Meta):
        fields = PaymentSerializer.Meta.fields + [
            "order_id", "order_number", "order_status", "order_payment_status",
            "customer_email", "customer_name", "reviewed_by_email",
        ]
        read_only_fields = fields


class SubmitPaymentSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField(required=False)
    order_id = serializers.IntegerField(required=False)
    reference = serializers.CharField(max_length=120)
    proof = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("payment_id") and not attrs.get("order_id"):
            raise serializers.ValidationError("Provide payment_id or order_id.")
        return attrs


class ReviewSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
