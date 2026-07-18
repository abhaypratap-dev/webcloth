from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Address
from .phone import normalize_indian_mobile

User = get_user_model()


def _normalize_or_raise(value: str) -> str:
    try:
        return normalize_indian_mobile(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages[0])


class RegisterSerializer(serializers.ModelSerializer):
    # Declared explicitly (not model-derived) so we control normalization
    # instead of the RegexValidator running on raw/blank input.
    mobile = serializers.CharField(required=True, allow_blank=False, max_length=20)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "mobile", "password", "confirm_password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_mobile(self, value):
        normalized = _normalize_or_raise(value)
        if User.objects.filter(mobile=normalized).exists():
            raise serializers.ValidationError("An account with this mobile number already exists.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password login; also allows an Indian mobile number in the email field."""

    def validate(self, attrs):
        identifier = attrs.get(self.username_field, "")
        if identifier and "@" not in identifier:
            try:
                normalized = normalize_indian_mobile(identifier)
            except DjangoValidationError:
                normalized = None
            if normalized:
                user = User.objects.filter(mobile=normalized).first()
                if user:
                    attrs[self.username_field] = user.email
        data = super().validate(attrs)
        if self.user.is_blocked:
            raise serializers.ValidationError("This account has been blocked. Contact support.")
        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "full_name", "email", "mobile", "avatar", "is_staff",
            "is_email_verified", "is_mobile_verified", "date_joined",
        ]
        read_only_fields = [
            "id", "email", "is_staff", "is_email_verified", "is_mobile_verified", "date_joined",
        ]

    def validate_mobile(self, value):
        if not value:
            return value
        normalized = _normalize_or_raise(value)
        qs = User.objects.filter(mobile=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An account with this mobile number already exists.")
        return normalized


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class AddressSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=True, allow_blank=False, max_length=20)

    class Meta:
        model = Address
        fields = [
            "id", "full_name", "phone", "line1", "line2", "city", "state",
            "postal_code", "country", "is_default", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"country": {"required": False}}

    def validate_phone(self, value):
        return _normalize_or_raise(value)

    def validate_country(self, value):
        return value or "India"


class AdminCustomerSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "full_name", "email", "mobile", "is_active", "is_blocked",
            "is_staff", "is_email_verified", "is_mobile_verified", "date_joined",
            "orders_count", "total_spent",
        ]
        read_only_fields = [
            "id", "email", "date_joined", "orders_count", "total_spent",
        ]
