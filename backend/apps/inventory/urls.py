from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("movements", views.StockMovementListView, basename="stock-movement")
router.register("", views.InventoryViewSet, basename="inventory")

urlpatterns = [
    path("adjust/", views.StockAdjustView.as_view()),
    path("alerts/", views.LowStockView.as_view()),
    path("", include(router.urls)),
]
