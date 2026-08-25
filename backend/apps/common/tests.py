from django.test import TestCase

from apps.brands.models import Brand
from apps.categories.models import Category
from apps.cms.models import Page
from apps.common.text import unique_slugify
from apps.products.models import Product


class UniqueSlugifyTests(TestCase):
    """Every model with a `unique=True` slug auto-filled from a title/name.

    Before this helper existed, each of these cases ended in an IntegrityError
    that surfaced to the dashboard as an opaque 500.
    """

    def test_repeated_names_get_numeric_suffixes(self):
        slugs = [Category.objects.create(name="Oversized Tee").slug for _ in range(3)]
        self.assertEqual(slugs, ["oversized-tee", "oversized-tee-2", "oversized-tee-3"])

    def test_names_that_slugify_to_nothing_fall_back(self):
        # Devanagari, emoji and punctuation all slugify to "" — without a
        # fallback every one of them would collide on the empty string, and any
        # that saved would have an unroutable empty slug.
        for name in ["कुरता", "🔥", "..."]:
            self.assertNotEqual(Brand.objects.create(name=name).slug, "")
        self.assertEqual(Brand.objects.count(), 3)

    def test_suffix_respects_max_length(self):
        # Exercised through the helper directly: no model's title column is
        # long enough to produce an over-length slug on its own.
        max_length = Page._meta.get_field("slug").max_length
        source = "a" * (max_length + 50)

        first = unique_slugify(Page(), source)
        self.assertEqual(len(first), max_length)

        Page.objects.create(title="taken", slug=first)
        second = unique_slugify(Page(), source)
        self.assertLessEqual(len(second), max_length)
        self.assertNotEqual(second, first)

    def test_existing_instance_does_not_collide_with_itself(self):
        product = Product.objects.create(title="Raglan", price=10)
        self.assertEqual(unique_slugify(product, "Raglan"), "raglan")

    def test_explicit_slug_is_left_alone(self):
        self.assertEqual(Category.objects.create(name="Tees", slug="custom").slug, "custom")

    def test_slug_is_stable_across_renames(self):
        # Regenerating on every save would break existing product URLs.
        product = Product.objects.create(title="Raglan", price=10)
        product.title = "Renamed"
        product.save()
        self.assertEqual(product.slug, "raglan")


class BlankUniqueFieldTests(TestCase):
    def test_products_without_a_sku_do_not_collide(self):
        # `sku` is unique but optional. "" is a value to Postgres and collides;
        # NULLs do not, so Product.save() normalises the absence to None.
        first = Product.objects.create(title="A", price=10, sku="")
        second = Product.objects.create(title="B", price=10, sku="")
        self.assertIsNone(first.sku)
        self.assertIsNone(second.sku)


class ApiExceptionHandlerTests(TestCase):
    def test_integrity_error_becomes_409_without_leaking_the_query(self):
        # Any constraint the serializer misses (or loses a race to) used to
        # escape as a 500. It is a conflict, and the raw psycopg message —
        # which echoes constraint names and column values — stays in the log.
        from django.db import IntegrityError

        from config.exceptions import api_exception_handler

        exc = IntegrityError('duplicate key value violates unique constraint "products_product_slug_key"')
        response = api_exception_handler(exc, {"view": None})

        self.assertEqual(response.status_code, 409)
        self.assertNotIn("products_product_slug_key", str(response.data))
