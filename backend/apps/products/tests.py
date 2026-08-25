from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.categories.models import Category
from apps.products.models import Product

# What src/routes/admin.products.tsx sends when the dashboard's "New product"
# form is submitted with only a title and price filled in.
NEW_PRODUCT = {
    "title": "Raglan Tee", "slug": "", "sku": None, "description": "",
    "short_description": "", "brand": None, "category": None, "subcategory": None,
    "price": "999", "offer_price": None, "material": "", "care_instructions": "",
    "tags": [], "status": "active", "featured": False, "new_arrival": False,
    "best_seller": False, "variants": [],
}


class AdminProductApiTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            "admin@cutcult.test", "pw", full_name="Admin"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def create(self, **overrides):
        return self.client.post(
            "/api/products/admin/", {**NEW_PRODUCT, **overrides}, format="json"
        )

    def test_create_product(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["slug"], "raglan-tee")

    def test_creating_two_products_with_the_same_title_succeeds(self):
        # Regression: the second POST used to hit the unique constraint on the
        # generated slug and return 500 ("request failed").
        self.assertEqual(self.create().status_code, 201)
        second = self.create()
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["slug"], "raglan-tee-2")

    def test_creating_two_products_without_a_sku_succeeds(self):
        self.assertEqual(self.create(title="A", sku="").status_code, 201)
        self.assertEqual(self.create(title="B", sku="").status_code, 201)

    def test_duplicate_sku_is_rejected_as_400_not_500(self):
        self.assertEqual(self.create(title="A", sku="CC-1").status_code, 201)
        response = self.create(title="B", sku="CC-1")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sku", response.data["errors"])

    def test_offer_price_above_price_is_rejected(self):
        # Product.save() silently discards it, which from the dashboard looked
        # like the field refusing to save with no explanation.
        response = self.create(price="100", offer_price="500")
        self.assertEqual(response.status_code, 400)
        self.assertIn("offer_price", response.data["errors"])

    def test_create_with_variants_and_category(self):
        category = Category.objects.create(name="Tees")
        response = self.create(category=category.id, variants=[
            {"size": "M", "color": "Black", "color_hex": "#000000", "sku": "",
             "stock": 3, "low_stock_threshold": 5},
        ])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["total_stock"], 3)

    def test_unslugifiable_title_still_creates(self):
        response = self.create(title="कुरता")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["slug"])

    def test_staff_only(self):
        self.client.force_authenticate(
            get_user_model().objects.create_user("shopper@cutcult.test", "pw", full_name="S")
        )
        self.assertEqual(self.create().status_code, 403)


class StorefrontApiTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(title="Raglan Tee", price=999)

    def test_list_and_detail_are_public(self):
        self.assertEqual(self.client.get("/api/products/").status_code, 200)
        self.assertEqual(
            self.client.get(f"/api/products/{self.product.slug}/").status_code, 200
        )

    def test_unknown_slug_is_404(self):
        self.assertEqual(self.client.get("/api/products/nope/").status_code, 404)
