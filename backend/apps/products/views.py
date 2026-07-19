from django.db import transaction
from django.db.models import Avg, Count, Max, Q
from rest_framework import parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.offers import services as offer_services

from .filters import ProductFilter
from .models import Product, ProductImage
from .serializers import (
    AdminProductSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
)


def storefront_queryset():
    return (
        Product.objects.storefront()
        .annotate(
            rating_avg=Avg("reviews__rating", filter=Q(reviews__is_approved=True)),
            reviews_count=Count("reviews", filter=Q(reviews__is_approved=True), distinct=True),
        )
    )


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Public catalog: list, retrieve, related."""

    lookup_field = "slug"
    filterset_class = ProductFilter
    search_fields = ["title", "description", "short_description", "tags"]
    ordering_fields = ["price", "created_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return storefront_queryset()

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == "retrieve" else ProductListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["offers"] = offer_services.live_offers()
        return ctx

    @action(detail=True)
    def related(self, request, slug=None):
        product = self.get_object()
        qs = (
            self.get_queryset()
            .exclude(pk=product.pk)
            .filter(Q(category=product.category) | Q(brand=product.brand))[:8]
        )
        return Response(ProductListSerializer(qs, many=True, context=self.get_serializer_context()).data)


class AdminProductViewSet(viewsets.ModelViewSet):
    """Full CRUD for the admin dashboard, including image upload."""

    serializer_class = AdminProductSerializer
    permission_classes = [IsAdmin]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    filterset_fields = ["status", "featured", "new_arrival", "best_seller", "category", "brand"]
    search_fields = ["title", "sku", "tags"]
    ordering_fields = ["created_at", "price", "title"]

    def get_queryset(self):
        return Product.objects.select_related("category", "brand").prefetch_related("images", "variants")

    def _next_sort_order(self, product):
        return (product.images.aggregate(Max("sort_order"))["sort_order__max"] or -1) + 1

    @action(detail=True, methods=["post"], url_path="images")
    def upload_image(self, request, pk=None):
        product = self.get_object()
        files = request.FILES.getlist("images")
        if files:
            # One or more files under the "images" key: validate every file
            # through the same serializer the single-image path uses (so
            # non-image uploads are rejected the same way) before writing
            # anything, so a batch is all-or-nothing.
            validated_images = []
            for f in files:
                file_serializer = ProductImageSerializer(data={"image": f}, context={"request": request})
                file_serializer.is_valid(raise_exception=True)
                validated_images.append(file_serializer.validated_data["image"])

            next_sort = self._next_sort_order(product)
            with transaction.atomic():
                created = [
                    ProductImage.objects.create(
                        product=product,
                        image=img,
                        alt=request.data.get("alt", ""),
                        sort_order=next_sort + i,
                    )
                    for i, img in enumerate(validated_images)
                ]
            serializer = ProductImageSerializer(created, many=True, context={"request": request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        serializer = ProductImageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("image") and not serializer.validated_data.get("external_url"):
            raise ValidationError({"detail": "Provide either an image file or an external_url."})
        # Append to the end unless the caller explicitly placed it.
        extra = {} if "sort_order" in request.data else {"sort_order": self._next_sort_order(product)}
        serializer.save(product=product, **extra)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="images/(?P<image_id>[0-9]+)")
    def delete_image(self, request, pk=None, image_id=None):
        self.get_object().images.filter(pk=image_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
