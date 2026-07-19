import re

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from apps.common.views import HealthView

api_patterns = [
    path("auth/", include("apps.accounts.urls")),
    path("categories/", include("apps.categories.urls")),
    path("brands/", include("apps.brands.urls")),
    path("products/", include("apps.products.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("cart/", include("apps.cart.urls")),
    path("wishlist/", include("apps.wishlist.urls")),
    path("coupons/", include("apps.coupons.urls")),
    path("offers/", include("apps.offers.urls")),
    path("orders/", include("apps.orders.urls")),
    path("payments/", include("apps.payments.urls")),
    path("reviews/", include("apps.reviews.urls")),
    path("banners/", include("apps.banners.urls")),
    path("cms/", include("apps.cms.urls")),
    path("settings/", include("apps.store_settings.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
]

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("django-admin/", admin.site.urls),
    path("api/", include(api_patterns)),
    path("api/health/", HealthView.as_view()),
]

if settings.DEBUG or not settings.AZURE_STORAGE_ACCOUNT_NAME:
    # No Azure Blob Storage configured (e.g. production before it's
    # provisioned): locally-stored media has nothing else serving it, since
    # gunicorn only handles the `api_patterns`/admin routes above. Once blob
    # storage is configured, ImageField.url points straight at the blob
    # host and this route is simply never hit.
    # NB: django.conf.urls.static.static() is a no-op when DEBUG is False —
    # it can't be used here, so this hits django.views.static.serve directly.
    urlpatterns += [
        re_path(r"^%s(?P<path>.*)$" % re.escape(settings.MEDIA_URL.lstrip("/")), serve, {"document_root": settings.MEDIA_ROOT}),
    ]
