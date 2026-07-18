from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.categories.models import Category
from apps.categories.serializers import CategorySerializer
from apps.common.permissions import IsAdminOrReadOnly
from apps.offers import services as offer_services
from apps.offers.models import Offer
from apps.offers.serializers import OfferSerializer
from apps.products.serializers import ProductListSerializer
from apps.products.views import storefront_queryset

from .models import Banner
from .serializers import BannerSerializer


class BannerViewSet(viewsets.ModelViewSet):
    serializer_class = BannerSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None
    filterset_fields = ["kind", "is_active"]

    def get_queryset(self):
        qs = Banner.objects.all()
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_active=True)
        return qs


class HomepageView(APIView):
    """Single public endpoint powering the entire dynamic homepage."""

    permission_classes = [AllowAny]

    def get(self, request):
        offers = offer_services.live_offers()
        ctx = {"request": request, "offers": offers}
        products = storefront_queryset()

        def serialize(qs):
            return ProductListSerializer(qs, many=True, context=ctx).data

        flash_offers = [o for o in offers if o.kind == Offer.Kind.FLASH]
        banners = Banner.objects.filter(is_active=True)

        return Response(
            {
                "hero_banners": BannerSerializer(
                    [b for b in banners if b.kind == Banner.Kind.HERO], many=True, context=ctx
                ).data,
                "promo_banners": BannerSerializer(
                    [b for b in banners if b.kind == Banner.Kind.PROMO], many=True, context=ctx
                ).data,
                "campaign_banners": BannerSerializer(
                    [b for b in banners if b.kind == Banner.Kind.CAMPAIGN], many=True, context=ctx
                ).data,
                "featured": serialize(products.filter(featured=True)[:8]),
                "new_arrivals": serialize(products.filter(new_arrival=True)[:8]),
                "best_sellers": serialize(products.filter(best_seller=True)[:8]),
                "trending": serialize(products.order_by("-reviews_count", "-created_at")[:8]),
                "categories": CategorySerializer(
                    Category.objects.filter(is_active=True, parent__isnull=True),
                    many=True,
                    context=ctx,
                ).data,
                "flash_sales": OfferSerializer(flash_offers, many=True).data,
                "live_offers": OfferSerializer(offers, many=True).data,
            }
        )
