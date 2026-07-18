from django.urls import path

from .views import StoreSettingsView

urlpatterns = [path("", StoreSettingsView.as_view())]
