from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from .models import Offer
from .serializers import OfferSerializer


class OfferViewSet(viewsets.ModelViewSet):
    serializer_class = OfferSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["kind", "is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        return Offer.objects.prefetch_related("products", "categories")

    def get_permissions(self):
        if self.action == "live":
            return []
        return super().get_permissions()

    @action(detail=False)
    def live(self, request):
        """Public: offers currently running (for storefront promo strips)."""
        offers = self.get_queryset().live()
        return Response(OfferSerializer(offers, many=True).data)
