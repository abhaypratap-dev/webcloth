from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminReviewViewSet, ReviewViewSet

router = DefaultRouter()
router.register("admin", AdminReviewViewSet, basename="admin-review")
router.register("", ReviewViewSet, basename="review")

urlpatterns = [path("", include(router.urls))]
