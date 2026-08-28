from django.db import migrations

# (method, enabled, sort_order, description, instructions).
#
# COD starts enabled because it is the only method the live store accepts
# today — seeding it off would take checkout down the moment this deploys.
# UPI and bank transfer need the admin's own details before they can be
# switched on, and the card gateways have no API keys in the environment.
SEED = [
    ("cod", True, 10, "Pay in cash when your order arrives.", ""),
    (
        "upi",
        False,
        20,
        "Pay by UPI — scan the QR or use the UPI ID.",
        "Pay the exact order total, then enter the UPI reference number below. "
        "We'll confirm your payment and start preparing your order.",
    ),
    (
        "bank",
        False,
        30,
        "Transfer directly to our bank account.",
        "Transfer the exact order total using the details above, then enter the "
        "UTR / transaction reference below. Bank transfers can take a few hours "
        "to appear, and we'll confirm as soon as it lands.",
    ),
    ("razorpay", False, 40, "UPI, cards and netbanking via Razorpay.", ""),
    ("stripe", False, 50, "International cards via Stripe.", ""),
]


def seed(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")
    for method, is_enabled, sort_order, description, instructions in SEED:
        # get_or_create, not update_or_create: `defaults` must only apply on
        # insert, or re-running this would clobber the admin's own edits.
        PaymentMethodConfig.objects.get_or_create(
            method=method,
            defaults={
                "is_enabled": is_enabled,
                "sort_order": sort_order,
                "description": description,
                "instructions": instructions,
            },
        )


def unseed(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")
    PaymentMethodConfig.objects.filter(method__in=[m for m, *_ in SEED]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_paymentmethodconfig_payment_proof_payment_reference_and_more"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
