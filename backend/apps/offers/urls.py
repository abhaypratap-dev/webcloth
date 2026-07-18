from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OfferViewSet

router = DefaultRouter()
router.register("", OfferViewSet, basename="offer")

urlpatterns = [path("", include(router.urls))]
