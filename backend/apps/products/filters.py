import django_filters
from django.db.models import Q

from apps.categories.models import Category

from .models import Product


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(method="filter_category")
    brand = django_filters.CharFilter(field_name="brand__slug")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    size = django_filters.CharFilter(field_name="variants__size", distinct=True)
    color = django_filters.CharFilter(field_name="variants__color", lookup_expr="iexact", distinct=True)
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    tag = django_filters.CharFilter(field_name="tags", lookup_expr="contains", method="filter_tag")

    class Meta:
        model = Product
        fields = ["featured", "new_arrival", "best_seller", "status"]

    def filter_category(self, queryset, name, value):
        """Match a category slug including its subcategories."""
        cat = Category.objects.filter(slug=value).first()
        if not cat:
            return queryset.none()
        ids = [cat.id, *cat.children.values_list("id", flat=True)]
        return queryset.filter(Q(category_id__in=ids) | Q(subcategory_id__in=ids))

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(variants__stock__gt=0).distinct()
        return queryset.exclude(variants__stock__gt=0)

    def filter_tag(self, queryset, name, value):
        return queryset.filter(tags__contains=[value])
