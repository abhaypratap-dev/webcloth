import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

logger = logging.getLogger("apps.api")


def api_exception_handler(exc, context):
    """Normalise every API error body to {"detail": ..., "errors": ...}."""
    if isinstance(exc, IntegrityError):
        # A database constraint the serializer did not catch — a duplicate that
        # slipped through a check-then-insert race, or a NOT NULL/FK violation.
        # This is a conflict with existing data, not a server fault: returning
        # 500 both misreports it and tells the caller nothing actionable.
        # Logged at warning (not exception) since it is an expected outcome.
        logger.warning("Integrity error in %s: %s", context.get("view"), exc)
        # The raw psycopg message names the constraint and echoes the offending
        # values, so it stays in the log and out of the response body.
        set_rollback()
        return Response(
            {"detail": "That conflicts with an existing record — check for a duplicate and try again."},
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error in %s", context.get("view"), exc_info=exc)
        return None

    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        return response

    if isinstance(data, list):
        response.data = {"detail": data[0] if data else "Request failed.", "errors": data}
    elif isinstance(data, dict):
        first = next(iter(data.values()), "Request failed.")
        if isinstance(first, list) and first:
            first = first[0]
        response.data = {"detail": str(first), "errors": data}
    return response
