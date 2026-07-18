import logging

from rest_framework.views import exception_handler

logger = logging.getLogger("apps.api")


def api_exception_handler(exc, context):
    """Normalise every API error body to {"detail": ..., "errors": ...}."""
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
