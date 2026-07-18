from django.urls import path

from .views import CreatePaymentView, VerifyPaymentView

urlpatterns = [
    path("create/", CreatePaymentView.as_view()),
    path("verify/", VerifyPaymentView.as_view()),
]
