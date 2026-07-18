from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Address

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "mobile", "password", "confirm_password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password login; also allows mobile number in the email field."""

    def validate(self, attrs):
        identifier = attrs.get(self.username_field, "")
        if identifier and "@" not in identifier:
            user = User.objects.filter(mobile=identifier).first()
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
        fields = ["id", "full_name", "email", "mobile", "avatar", "is_staff", "date_joined"]
        read_only_fields = ["id", "email", "is_staff", "date_joined"]


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
    class Meta:
        model = Address
        fields = [
            "id", "full_name", "phone", "line1", "line2", "city", "state",
            "postal_code", "country", "is_default", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AdminCustomerSerializer(serializers.ModelSerializer):
    orders_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "full_name", "email", "mobile", "is_active", "is_blocked",
            "is_staff", "date_joined", "orders_count", "total_spent",
        ]
        read_only_fields = ["id", "email", "date_joined", "orders_count", "total_spent"]
