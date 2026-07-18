from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.offers import services as offer_services
from apps.products.views import storefront_queryset

from .models import WishlistItem
from .serializers import WishlistItemSerializer


class WishlistViewSet(viewsets.ModelViewSet):
    serializer_class = WishlistItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user).prefetch_related(
            "product__images", "product__variants", "product__category", "product__brand"
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["offers"] = offer_services.live_offers()
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, created = WishlistItem.objects.get_or_create(
            user=request.user, product=serializer.validated_data["product"]
        )
        out = self.get_serializer(item)
        return Response(out.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        item = WishlistItem.objects.filter(user=request.user, product=product).first()
        if item:
            item.delete()
            return Response({"in_wishlist": False})
        WishlistItem.objects.create(user=request.user, product=product)
        return Response({"in_wishlist": True}, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def ids(self, request):
        """Lightweight product-id list for heart-state hydration."""
        return Response(list(self.get_queryset().values_list("product_id", flat=True)))
