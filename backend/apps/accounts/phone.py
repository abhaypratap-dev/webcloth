"""
Indian mobile number handling.

Numbers are normalized to E.164 (+91XXXXXXXXXX) at the API boundary and stored
in that canonical form — this is also the format SMS/OTP gateways (MSG91,
Twilio, etc.) expect, so no extra conversion is needed when OTP auth is added.
"""

import re

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

# Canonical stored form: +91 followed by a 10-digit number starting 6-9.
INDIAN_MOBILE_REGEX = r"^\+91[6-9]\d{9}$"

indian_mobile_validator = RegexValidator(
    INDIAN_MOBILE_REGEX,
    "Enter a valid Indian mobile number (10 digits, starting with 6-9).",
)


def normalize_indian_mobile(raw: str) -> str:
    """Accepts common input shapes and returns canonical +91XXXXXXXXXX.

    Accepted: "9876543210", "+919876543210", "919876543210", "09876543210",
    with optional spaces/hyphens. Raises ValidationError if it can't resolve
    to a valid 10-digit Indian mobile number.
    """
    digits = re.sub(r"[\s\-()]", "", raw)

    if digits.startswith("+91"):
        digits = digits[3:]
    elif digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValidationError(
            "Enter a valid Indian mobile number (10 digits, starting with 6-9)."
        )
    return f"+91{digits}"
