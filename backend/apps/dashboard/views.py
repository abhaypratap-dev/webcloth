from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce, TruncDate, TruncMonth
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.inventory import services as inventory_services
from apps.orders.models import Order, OrderItem
from apps.orders.serializers import AdminOrderSerializer
from apps.products.models import Product

User = get_user_model()

REVENUE_STATUSES = [
    s for s in Order.Status.values if s not in (Order.Status.CANCELLED, Order.Status.REFUNDED)
]


class DashboardStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        revenue_orders = Order.objects.filter(status__in=REVENUE_STATUSES)

        totals = revenue_orders.aggregate(
            revenue=Coalesce(Sum("total"), Value(0), output_field=DecimalField()),
            orders=Count("id"),
        )
        month = revenue_orders.filter(created_at__gte=month_start).aggregate(
            revenue=Coalesce(Sum("total"), Value(0), output_field=DecimalField()),
            orders=Count("id"),
        )

        # Last 30 days daily sales for the chart
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        daily = (
            revenue_orders.filter(created_at__gte=start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(revenue=Sum("total"), orders=Count("id"))
            .order_by("day")
        )

        # Last 12 months
        year_start = (now - timedelta(days=365)).replace(day=1)
        monthly = (
            revenue_orders.filter(created_at__gte=year_start)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("total"), orders=Count("id"))
            .order_by("month")
        )

        top_products = (
            OrderItem.objects.filter(order__status__in=REVENUE_STATUSES)
            .values("product_id", "title")
            .annotate(sold=Sum("quantity"), revenue=Sum(F("price") * F("quantity")))
            .order_by("-sold")[:10]
        )

        low = inventory_services.low_stock_variants()
        out = inventory_services.out_of_stock_variants()

        recent = Order.objects.select_related("user").prefetch_related("items", "events")[:8]

        return Response(
            {
                "revenue": float(totals["revenue"]),
                "orders_count": totals["orders"],
                "monthly_revenue": float(month["revenue"]),
                "monthly_orders": month["orders"],
                "customers_count": User.objects.filter(is_staff=False).count(),
                "products_count": Product.objects.count(),
                "pending_orders": Order.objects.filter(status=Order.Status.PENDING).count(),
                "low_stock_count": low.count(),
                "out_of_stock_count": out.count(),
                "sales_daily": [
                    {"date": d["day"], "revenue": float(d["revenue"]), "orders": d["orders"]}
                    for d in daily
                ],
                "sales_monthly": [
                    {"month": m["month"].strftime("%Y-%m"), "revenue": float(m["revenue"]), "orders": m["orders"]}
                    for m in monthly
                ],
                "top_products": [
                    {**p, "revenue": float(p["revenue"] or 0)} for p in top_products
                ],
                "recent_orders": AdminOrderSerializer(recent, many=True).data,
            }
        )
