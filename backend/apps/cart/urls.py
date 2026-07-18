from django.urls import path

from . import views

urlpatterns = [
    path("", views.CartView.as_view()),
    path("items/", views.CartItemsView.as_view()),
    path("items/<int:item_id>/", views.CartItemDetailView.as_view()),
    path("coupon/", views.ApplyCouponView.as_view()),
]
