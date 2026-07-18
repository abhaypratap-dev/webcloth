from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsOwner

from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    """Public read of approved reviews (filter by product); owners manage their own."""

    serializer_class = ReviewSerializer
    filterset_fields = ["product", "rating"]
    ordering_fields = ["created_at", "rating"]

    def get_queryset(self):
        qs = Review.objects.select_related("user", "product")
        user = self.request.user
        if self.action in ("list", "retrieve"):
            if user.is_authenticated and self.request.query_params.get("mine"):
                return qs.filter(user=user)
            return qs.filter(is_approved=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsOwner()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Edits go back through moderation.
        serializer.save(is_approved=False)


class AdminReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["is_approved", "rating", "product"]
    search_fields = ["title", "body", "user__email", "product__title"]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Review.objects.select_related("user", "product")

    @action(detail=True, methods=["patch"])
    def approve(self, request, pk=None):
        review = self.get_object()
        review.is_approved = True
        review.save(update_fields=["is_approved"])
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=["patch"])
    def reject(self, request, pk=None):
        review = self.get_object()
        review.is_approved = False
        review.save(update_fields=["is_approved"])
        return Response(self.get_serializer(review).data)
