from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Address
from apps.orders.models import Order
from apps.products.models import Product, ProductVariant


class CheckoutJourneyTests(TestCase):
    """End-to-end smoke test of the path a customer actually walks."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "shopper@cutcult.test", "pw", full_name="Shopper", mobile="+919876543210"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.product = Product.objects.create(title="Raglan Tee", price=999)
        self.variant = ProductVariant.objects.create(
            product=self.product, size="M", color="Black", stock=3
        )
        self.address = Address.objects.create(
            user=self.user, full_name="Shopper", phone="+919876543210",
            line1="1 Test Street", city="Delhi", state="DL", postal_code="110001",
        )

    def add_to_cart(self, quantity=2):
        return self.client.post(
            "/api/cart/items/",
            {"product_id": self.product.id, "variant_id": self.variant.id, "quantity": quantity},
            format="json",
        )

    def checkout(self):
        return self.client.post(
            "/api/orders/checkout/",
            {"shipping_address_id": self.address.id, "payment_method": "cod"},
            format="json",
        )

    def test_add_to_cart_then_checkout(self):
        self.assertEqual(self.add_to_cart().status_code, 201)

        response = self.checkout()
        self.assertEqual(response.status_code, 201)

        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.items.count(), 1)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 1, "checkout should reserve stock")

    def test_cannot_add_more_than_stock(self):
        response = self.add_to_cart(quantity=9)
        self.assertEqual(response.status_code, 400)

    def test_checkout_with_empty_bag_is_400(self):
        self.assertEqual(self.checkout().status_code, 400)

    def test_invoice_and_cancel(self):
        self.add_to_cart()
        order_id = self.checkout().data["id"]

        self.assertEqual(self.client.get(f"/api/orders/{order_id}/invoice/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/orders/{order_id}/cancel/").status_code, 200)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 3, "cancelling should return stock")

    def test_orders_are_scoped_to_their_owner(self):
        self.add_to_cart()
        order_id = self.checkout().data["id"]

        other = get_user_model().objects.create_user(
            "other@cutcult.test", "pw", full_name="Other"
        )
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(f"/api/orders/{order_id}/").status_code, 404)

    def test_checkout_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.checkout().status_code, 401)
