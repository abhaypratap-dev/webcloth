from rest_framework import viewsets

from apps.common.permissions import IsAdminOrReadOnly

from .models import Faq, Page
from .serializers import FaqSerializer, PageSerializer


class PageViewSet(viewsets.ModelViewSet):
    serializer_class = PageSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"
    pagination_class = None
    search_fields = ["title", "body"]

    def get_queryset(self):
        qs = Page.objects.all()
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_published=True)
        return qs


class FaqViewSet(viewsets.ModelViewSet):
    serializer_class = FaqSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        qs = Faq.objects.all()
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            qs = qs.filter(is_published=True)
        return qs
