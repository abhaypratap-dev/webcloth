import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Count, DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.permissions import IsAdmin
from apps.notifications.services import send_password_reset_email

from .models import Address
from .serializers import (
    AddressSerializer,
    AdminCustomerSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)

logger = logging.getLogger("apps.accounts")
User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        logger.info("New user registered: %s", user.email)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_scope = "auth"


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass  # already expired/blacklisted — logout is idempotent
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"]).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_password_reset_email(user, uid, token)
        # Same response either way — don't leak which emails exist.
        return Response({"detail": "If that email exists, a reset link has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(data["uid"])))
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, data["token"]):
            return Response({"detail": "Reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password has been reset. You can sign in now."})


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AdminCustomerViewSet(viewsets.ModelViewSet):
    """Customer management for the admin dashboard (list / block / unblock)."""

    serializer_class = AdminCustomerSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "patch", "head", "options"]
    search_fields = ["full_name", "email", "mobile"]
    ordering_fields = ["date_joined", "full_name", "orders_count", "total_spent"]
    filterset_fields = ["is_blocked", "is_staff"]

    def get_queryset(self):
        return User.objects.annotate(
            orders_count=Count("orders", distinct=True),
            total_spent=Coalesce(
                Sum("orders__total"), Value(0), output_field=DecimalField(max_digits=12, decimal_places=2)
            ),
        )

    @action(detail=True, methods=["patch"])
    def block(self, request, pk=None):
        user = self.get_object()
        user.is_blocked = True
        user.save(update_fields=["is_blocked"])
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["patch"])
    def unblock(self, request, pk=None):
        user = self.get_object()
        user.is_blocked = False
        user.save(update_fields=["is_blocked"])
        return Response(self.get_serializer(user).data)
