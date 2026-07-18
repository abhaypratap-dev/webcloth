from decimal import Decimal

from django.db import migrations


def forwards(apps, schema_editor):
    """Move any existing singleton row from the old USD defaults to INR.

    Only touches rows still sitting on the pre-conversion USD defaults —
    a store that has already been deliberately configured (any other
    currency, or custom shipping/tax numbers) is left untouched.
    """
    StoreSettings = apps.get_model("store_settings", "StoreSettings")
    StoreSettings.objects.filter(currency="USD", currency_symbol="$").update(
        currency="INR",
        currency_symbol="₹",
        shipping_flat_rate=Decimal("99.00"),
        free_shipping_threshold=Decimal("1999.00"),
        tax_percent=Decimal("18.00"),
    )


def backwards(apps, schema_editor):
    StoreSettings = apps.get_model("store_settings", "StoreSettings")
    StoreSettings.objects.filter(currency="INR", currency_symbol="₹").update(
        currency="USD",
        currency_symbol="$",
        shipping_flat_rate=Decimal("10.00"),
        free_shipping_threshold=Decimal("200.00"),
        tax_percent=Decimal("0.00"),
    )


class Migration(migrations.Migration):
    dependencies = [("store_settings", "0002_alter_storesettings_currency_and_more")]
    operations = [migrations.RunPython(forwards, backwards)]
