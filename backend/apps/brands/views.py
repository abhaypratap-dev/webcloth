from django.db.models import Count
from rest_framework import viewsets

from apps.common.permissions import IsAdminOrReadOnly

from .models import Brand
from .serializers import BrandSerializer


class BrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    pagination_class = None
    search_fields = ["name"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        qs = Brand.objects.annotate(products_count=Count("products"))
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_active=True)
        return qs
