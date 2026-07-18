from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsAdminOrReadOnly

from .models import Category
from .serializers import CategorySerializer, CategoryTreeSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    pagination_class = None
    filterset_fields = ["parent", "is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        qs = Category.objects.annotate(products_count=Count("products"))
        # Public callers only see active categories; admins see everything.
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=False)
    def tree(self, request):
        roots = self.get_queryset().filter(parent__isnull=True).prefetch_related("children")
        return Response(CategoryTreeSerializer(roots, many=True, context={"request": request}).data)
