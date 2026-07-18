from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FaqViewSet, PageViewSet

router = DefaultRouter()
router.register("faqs", FaqViewSet, basename="faq")
router.register("pages", PageViewSet, basename="page")

urlpatterns = [path("", include(router.urls))]
