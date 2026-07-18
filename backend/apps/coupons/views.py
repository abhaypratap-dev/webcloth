from rest_framework import viewsets

from apps.common.permissions import IsAdmin

from .models import Coupon
from .serializers import CouponSerializer


class CouponViewSet(viewsets.ModelViewSet):
    """Admin CRUD. Customers never list coupons — they apply codes via the cart."""

    serializer_class = CouponSerializer
    permission_classes = [IsAdmin]
    search_fields = ["code", "description"]
    filterset_fields = ["discount_type", "is_active"]

    def get_queryset(self):
        return Coupon.objects.prefetch_related("products", "categories")
