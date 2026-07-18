from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminProductViewSet, ProductViewSet

router = DefaultRouter()
router.register("admin", AdminProductViewSet, basename="admin-product")
router.register("", ProductViewSet, basename="product")

urlpatterns = [path("", include(router.urls))]
