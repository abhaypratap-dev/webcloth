from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminPaymentMethodViewSet,
    AdminPaymentViewSet,
    CreatePaymentView,
    PaymentMethodListView,
    SubmitPaymentProofView,
    VerifyPaymentView,
)

router = DefaultRouter()
router.register("admin/methods", AdminPaymentMethodViewSet, basename="admin-payment-method")
router.register("admin", AdminPaymentViewSet, basename="admin-payment")

urlpatterns = [
    path("methods/", PaymentMethodListView.as_view()),
    path("create/", CreatePaymentView.as_view()),
    path("verify/", VerifyPaymentView.as_view()),
    path("submit/", SubmitPaymentProofView.as_view()),
    path("", include(router.urls)),
]
