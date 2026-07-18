from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.coupons import services as coupon_services

from . import services
from .models import Cart, CartItem
from .serializers import (
    AddToCartSerializer,
    ApplyCouponSerializer,
    CartSerializer,
    UpdateQuantitySerializer,
)


class CartMixin:
    permission_classes = [permissions.IsAuthenticated]

    def get_cart(self) -> Cart:
        return Cart.for_user(self.request.user)

    def cart_response(self, cart: Cart, status_code=status.HTTP_200_OK):
        totals = services.compute_totals(cart)
        return Response(
            CartSerializer(totals, context={"request": self.request}).data, status=status_code
        )


class CartView(CartMixin, APIView):
    def get(self, request):
        return self.cart_response(self.get_cart())

    def delete(self, request):
        cart = self.get_cart()
        cart.items.all().delete()
        cart.coupon = None
        cart.save(update_fields=["coupon"])
        return self.cart_response(cart)


class CartItemsView(CartMixin, APIView):
    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cart = self.get_cart()
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=data["product"],
            variant=data.get("variant"),
            defaults={"quantity": data["quantity"]},
        )
        if not created:
            stock = item.variant.stock if item.variant else item.product.total_stock
            item.quantity = min(item.quantity + data["quantity"], stock, 20)
            item.save(update_fields=["quantity"])
        return self.cart_response(cart, status.HTTP_201_CREATED)


class CartItemDetailView(CartMixin, APIView):
    def patch(self, request, item_id):
        serializer = UpdateQuantitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = self.get_cart()
        try:
            item = cart.items.select_related("variant", "product").get(pk=item_id)
        except CartItem.DoesNotExist:
            return Response({"detail": "Item not in cart."}, status=status.HTTP_404_NOT_FOUND)
        qty = serializer.validated_data["quantity"]
        if qty == 0:
            item.delete()
        else:
            stock = item.variant.stock if item.variant else item.product.total_stock
            if qty > stock:
                return Response(
                    {"detail": f"Only {stock} in stock for this item."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            item.quantity = qty
            item.save(update_fields=["quantity"])
        return self.cart_response(cart)

    def delete(self, request, item_id):
        cart = self.get_cart()
        cart.items.filter(pk=item_id).delete()
        return self.cart_response(cart)


class ApplyCouponView(CartMixin, APIView):
    def post(self, request):
        serializer = ApplyCouponSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = self.get_cart()
        try:
            coupon = coupon_services.get_valid_coupon(serializer.validated_data["code"], request.user)
            lines = services.build_lines(cart)
            totals = services.compute_totals(cart, lines)
            coupon_services.compute_discount(coupon, lines, totals.shipping)
        except coupon_services.CouponError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        cart.coupon = coupon
        cart.save(update_fields=["coupon"])
        return self.cart_response(cart)

    def delete(self, request):
        cart = self.get_cart()
        cart.coupon = None
        cart.save(update_fields=["coupon"])
        return self.cart_response(cart)
