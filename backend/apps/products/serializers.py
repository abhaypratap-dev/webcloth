from rest_framework import serializers

from apps.offers import services as offer_services

from .models import Product, ProductImage, ProductVariant


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "image", "external_url", "alt", "sort_order"]
        extra_kwargs = {
            "image": {"write_only": True, "required": False},
            "external_url": {"write_only": True, "required": False},
        }

    def get_url(self, obj):
        url = obj.url
        request = self.context.get("request")
        if url and url.startswith("/media/") and request:
            return request.build_absolute_uri(url)
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return url


class ProductVariantSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = ["id", "size", "color", "color_hex", "sku", "stock", "low_stock_threshold", "is_low_stock"]


class PricingMixin(serializers.Serializer):
    """Adds resolved sale pricing. Pass `offers` (list) in context to batch."""

    discount_price = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    applied_offer = serializers.SerializerMethodField()

    def _pricing(self, obj):
        cache = self.context.setdefault("_pricing_cache", {})
        if obj.pk not in cache:
            offers = self.context.get("offers")
            if offers is None:
                offers = offer_services.live_offers()
                self.context["offers"] = offers
            cache[obj.pk] = offer_services.effective_price(obj, offers)
        return cache[obj.pk]

    def get_discount_price(self, obj):
        sale, _ = self._pricing(obj)
        return float(sale) if sale is not None else None

    def get_discount_percent(self, obj):
        sale, _ = self._pricing(obj)
        return offer_services.discount_percent(obj.price, sale)

    def get_applied_offer(self, obj):
        _, offer = self._pricing(obj)
        return offer.name if offer else None


class ProductListSerializer(PricingMixin, serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    image = serializers.SerializerMethodField()
    hover_image = serializers.SerializerMethodField()
    price = serializers.FloatField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    rating_avg = serializers.FloatField(read_only=True, default=None)
    reviews_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Product
        fields = [
            "id", "slug", "title", "price", "discount_price", "discount_percent",
            "applied_offer", "category", "category_name", "brand", "image",
            "hover_image", "new_arrival", "best_seller", "featured", "in_stock",
            "rating_avg", "reviews_count",
        ]

    def _image_at(self, obj, idx):
        images = list(obj.images.all())
        if idx >= len(images):
            return None
        return ProductImageSerializer(images[idx], context=self.context).data["url"]

    def get_image(self, obj):
        return self._image_at(obj, 0) or ""

    def get_hover_image(self, obj):
        return self._image_at(obj, 1)


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    sizes = serializers.SerializerMethodField()
    colors = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "sku", "description", "short_description", "material",
            "care_instructions", "tags", "weight_grams", "images", "variants",
            "sizes", "colors", "total_stock",
        ]

    def get_sizes(self, obj):
        seen = []
        for v in obj.variants.all():
            if v.size and v.size not in seen:
                seen.append(v.size)
        return seen

    def get_colors(self, obj):
        seen = {}
        for v in obj.variants.all():
            if v.color and v.color not in seen:
                seen[v.color] = v.color_hex
        return [{"name": name, "hex": hex_} for name, hex_ in seen.items()]


class AdminProductSerializer(serializers.ModelSerializer):
    """Write serializer for the admin dashboard, with nested variants."""

    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, required=False)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    total_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "title", "slug", "sku", "description", "short_description",
            "brand", "brand_name", "category", "category_slug", "subcategory",
            "price", "offer_price", "material", "care_instructions", "tags",
            "weight_grams", "status", "featured", "new_arrival", "best_seller",
            "images", "variants", "total_stock", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        # Product.save() quietly drops an offer_price that isn't below price,
        # which from the dashboard looks like the field silently refusing to
        # save. Reject it here so the admin is told why.
        price = attrs.get("price", getattr(self.instance, "price", None))
        offer_price = attrs.get("offer_price", getattr(self.instance, "offer_price", None))
        if price is not None and offer_price is not None and offer_price >= price:
            raise serializers.ValidationError(
                {"offer_price": "Offer price must be lower than the price."}
            )
        return attrs

    def create(self, validated_data):
        variants = validated_data.pop("variants", [])
        product = super().create(validated_data)
        for v in variants:
            ProductVariant.objects.create(product=product, **v)
        return product

    def update(self, instance, validated_data):
        variants = validated_data.pop("variants", None)
        product = super().update(instance, validated_data)
        if variants is not None:
            self._sync_variants(product, variants)
        return product

    def _sync_variants(self, product, variants):
        keep = []
        for v in variants:
            variant, _ = ProductVariant.objects.update_or_create(
                product=product,
                size=v.get("size", ""),
                color=v.get("color", ""),
                defaults={
                    "color_hex": v.get("color_hex", ""),
                    "sku": v.get("sku", ""),
                    "stock": v.get("stock", 0),
                    "low_stock_threshold": v.get("low_stock_threshold", 5),
                },
            )
            keep.append(variant.pk)
        product.variants.exclude(pk__in=keep).delete()
