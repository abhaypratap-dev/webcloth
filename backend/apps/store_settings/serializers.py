from rest_framework import serializers

from .models import StoreSettings


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        exclude = ["created_at"]
        read_only_fields = ["id", "updated_at"]
