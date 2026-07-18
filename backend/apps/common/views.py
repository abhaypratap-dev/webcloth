import logging

from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger("apps.common")


class HealthView(APIView):
    """Liveness/readiness probe for Azure App Service health checks and load balancers."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            logger.exception("Health check: database connection failed")
            db_ok = False

        status_code = 200 if db_ok else 503
        return Response({"status": "ok" if db_ok else "error", "database": db_ok}, status=status_code)
