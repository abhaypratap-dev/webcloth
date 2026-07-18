from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminOrderViewSet, OrderViewSet

router = DefaultRouter()
router.register("admin", AdminOrderViewSet, basename="admin-order")
router.register("", OrderViewSet, basename="order")

urlpatterns = [path("", include(router.urls))]
