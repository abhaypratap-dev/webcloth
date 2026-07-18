from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BannerViewSet, HomepageView

router = DefaultRouter()
router.register("", BannerViewSet, basename="banner")

urlpatterns = [
    path("homepage/", HomepageView.as_view()),
    path("", include(router.urls)),
]
