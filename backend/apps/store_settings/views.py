from rest_framework import permissions
from rest_framework.generics import RetrieveUpdateAPIView

from apps.common.permissions import IsAdmin

from .models import StoreSettings
from .serializers import StoreSettingsSerializer


class StoreSettingsView(RetrieveUpdateAPIView):
    """GET is public (frontend needs shipping/tax/social config); writes are admin-only."""

    serializer_class = StoreSettingsSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsAdmin()]

    def get_object(self):
        return StoreSettings.load()
