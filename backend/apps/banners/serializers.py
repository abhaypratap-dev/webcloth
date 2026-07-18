from rest_framework import serializers

from .models import Banner


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            "id", "kind", "eyebrow", "title", "subtitle", "cta_text", "cta_link",
            "image", "external_image_url", "image_url", "is_active", "sort_order",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "image": {"write_only": True, "required": False},
            "external_image_url": {"required": False},
        }

    def get_image_url(self, obj):
        url = obj.image_url
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return url
