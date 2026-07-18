from django.db import models

from apps.common.models import TimeStampedModel


class Banner(TimeStampedModel):
    class Kind(models.TextChoices):
        HERO = "hero", "Hero Banner"
        PROMO = "promo", "Promotional Banner"
        CAMPAIGN = "campaign", "Campaign Banner"

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.HERO, db_index=True)
    eyebrow = models.CharField(max_length=100, blank=True)
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    cta_text = models.CharField(max_length=60, blank=True)
    cta_link = models.CharField(max_length=200, blank=True)
    image = models.ImageField(upload_to="banners/", blank=True, null=True)
    external_image_url = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "-created_at"]

    def __str__(self):
        return f"[{self.kind}] {self.title}"

    @property
    def image_url(self) -> str:
        if self.image:
            return self.image.url
        return self.external_image_url
