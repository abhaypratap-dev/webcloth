from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")
router.register("admin/customers", views.AdminCustomerViewSet, basename="admin-customer")

urlpatterns = [
    path("register/", views.RegisterView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("me/", views.MeView.as_view()),
    path("change-password/", views.ChangePasswordView.as_view()),
    path("forgot-password/", views.ForgotPasswordView.as_view()),
    path("reset-password/", views.ResetPasswordView.as_view()),
    path("", include(router.urls)),
]
