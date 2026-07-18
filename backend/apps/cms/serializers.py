from rest_framework import serializers

from .models import Faq, Page


class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = ["id", "title", "slug", "body", "seo_title", "seo_description", "is_published", "updated_at"]
        read_only_fields = ["id", "updated_at"]
        extra_kwargs = {"slug": {"required": False}}


class FaqSerializer(serializers.ModelSerializer):
    class Meta:
        model = Faq
        fields = ["id", "question", "answer", "sort_order", "is_published"]
        read_only_fields = ["id"]
