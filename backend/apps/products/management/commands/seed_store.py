"""Seed the store with initial catalog, banners, CMS pages and settings.

Idempotent — safe to run repeatedly. Product images reference the frontend's
bundled asset paths (/assets/...), which the storefront resolves to its
hashed bundle URLs.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.banners.models import Banner
from apps.brands.models import Brand
from apps.categories.models import Category
from apps.cms.models import Faq, Page
from apps.coupons.models import Coupon
from apps.products.models import Product, ProductImage, ProductVariant
from apps.store_settings.models import StoreSettings

User = get_user_model()

CATEGORIES = [
    ("Oversized Tees", "oversized-tees", "/assets/product-tee.jpg", 1),
    ("Shirts", "shirts", "/assets/product-shirt.jpg", 2),
    ("Hoodies", "hoodies", "/assets/product-hoodie.jpg", 3),
    ("Bottomwear", "bottomwear", "/assets/product-pants.jpg", 4),
    ("Accessories", "accessories", "", 5),
]

PRODUCTS = [
    {
        "title": "Oversized Heavyweight Tee — Off White",
        "slug": "oversized-tee-offwhite",
        "sku": "CC-TEE-001",
        "description": "A 320 GSM cotton tee cut for weight, drape, and time. Boxed silhouette, dropped shoulder, garment washed for softness.",
        "short_description": "320 GSM heavyweight cotton tee, boxed cut.",
        "price": Decimal("89.00"),
        "category": "oversized-tees",
        "material": "100% Heavyweight Cotton — 320 GSM",
        "care_instructions": "Machine wash cold. Tumble dry low. Do not bleach.",
        "featured": True, "best_seller": True, "new_arrival": True,
        "tags": ["essentials", "tee"],
        "image": "/assets/product-tee.jpg",
        "color": "Off White",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "stock": 25,
    },
    {
        "title": "Shadow Hoodie — Black",
        "slug": "shadow-hoodie-black",
        "sku": "CC-HOOD-001",
        "description": "A garment-dyed heavyweight hoodie. Structured hood, ribbed cuffs, matte metal tips. Made to weigh on you.",
        "short_description": "480 GSM garment-dyed heavyweight hoodie.",
        "price": Decimal("189.00"),
        "category": "hoodies",
        "material": "480 GSM Brushed Fleece",
        "care_instructions": "Machine wash cold inside out. Hang dry.",
        "featured": True, "best_seller": True, "new_arrival": True,
        "tags": ["hoodie", "signature"],
        "image": "/assets/product-hoodie.jpg",
        "color": "Black",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "stock": 20,
    },
    {
        "title": "Cargo Trouser — Black",
        "slug": "cargo-trouser-black",
        "sku": "CC-PANT-001",
        "description": "Wide-cut technical cargo. Utility pockets, drawcord hem, weightless nylon blend.",
        "short_description": "Wide-cut technical cargo trouser.",
        "price": Decimal("149.00"),
        "category": "bottomwear",
        "material": "Nylon / Cotton Blend",
        "care_instructions": "Machine wash cold. Do not iron print.",
        "featured": True, "best_seller": False, "new_arrival": True,
        "tags": ["pants", "cargo"],
        "image": "/assets/product-pants.jpg",
        "color": "Black",
        "sizes": ["30", "32", "34", "36"],
        "stock": 15,
    },
    {
        "title": "Band Collar Shirt — Cream",
        "slug": "band-collar-shirt-cream",
        "sku": "CC-SHIRT-001",
        "description": "Relaxed silk-touch shirt with a band collar. Loose in the sleeve, sharp at the shoulder.",
        "short_description": "Relaxed band-collar shirt in cream.",
        "price": Decimal("159.00"),
        "category": "shirts",
        "material": "Modal / Cotton",
        "care_instructions": "Hand wash cold. Line dry.",
        "featured": True, "best_seller": False, "new_arrival": True,
        "tags": ["shirt"],
        "image": "/assets/product-shirt.jpg",
        "color": "Cream",
        "sizes": ["S", "M", "L", "XL"],
        "stock": 12,
    },
]

PAGES = [
    ("About Us", "about-us", "Cut & Cult was born from a refusal. A refusal of noise, seasons, and shortcuts. Each piece is drafted from heavyweight fabric, cut to a boxed silhouette, and made to soften with the years — not fall apart in them."),
    ("Contact Us", "contact-us", "Reach the house at support@cutcult.example. We answer within two working days."),
    ("Privacy Policy", "privacy-policy", "We collect only what we need to fulfil your order. We never sell your data."),
    ("Terms & Conditions", "terms-and-conditions", "All sales are subject to our 14-day return policy on unworn pieces with tags attached."),
]

FAQS = [
    ("How long does shipping take?", "Orders ship within 48 hours and arrive in 3–7 working days.", 1),
    ("What is your return policy?", "14-day returns on unworn pieces with tags attached.", 2),
    ("Do you restock sold-out pieces?", "Core essentials restock. Chapter drops do not.", 3),
]


class Command(BaseCommand):
    help = "Seed the store with initial data (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--admin-email", default="admin@cutcult.local")
        parser.add_argument("--admin-password", default="admin12345")

    def handle(self, *args, **options):
        settings_ = StoreSettings.load()
        settings_.contact_email = settings_.contact_email or "support@cutcult.example"
        settings_.save()

        brand, _ = Brand.objects.get_or_create(name="Cut & Cult", defaults={"description": "The house label."})

        cats = {}
        for name, slug, image, sort in CATEGORIES:
            cat, _ = Category.objects.get_or_create(
                slug=slug, defaults={"name": name, "sort_order": sort}
            )
            cats[slug] = cat

        for data in PRODUCTS:
            product, created = Product.objects.get_or_create(
                slug=data["slug"],
                defaults={
                    "title": data["title"],
                    "sku": data["sku"],
                    "description": data["description"],
                    "short_description": data["short_description"],
                    "price": data["price"],
                    "brand": brand,
                    "category": cats[data["category"]],
                    "material": data["material"],
                    "care_instructions": data["care_instructions"],
                    "featured": data["featured"],
                    "best_seller": data["best_seller"],
                    "new_arrival": data["new_arrival"],
                    "tags": data["tags"],
                },
            )
            if created:
                ProductImage.objects.create(
                    product=product, external_url=data["image"], alt=data["title"], sort_order=0
                )
                for size in data["sizes"]:
                    ProductVariant.objects.create(
                        product=product, size=size, color=data["color"], stock=data["stock"]
                    )
                self.stdout.write(f"  + {product.title}")

        Banner.objects.get_or_create(
            kind=Banner.Kind.HERO,
            title="Cut Heavy. Built to Last.",
            defaults={
                "eyebrow": "Chapter One — SS26",
                "cta_text": "Shop Collection",
                "cta_link": "/shop",
                "external_image_url": "/assets/hero-1.jpg",
            },
        )
        Banner.objects.get_or_create(
            kind=Banner.Kind.CAMPAIGN,
            title="Enter the Cult.",
            defaults={
                "eyebrow": "Campaign 001",
                "cta_text": "Shop the campaign",
                "cta_link": "/shop",
                "external_image_url": "/assets/campaign.jpg",
            },
        )

        for title, slug, body in PAGES:
            Page.objects.get_or_create(slug=slug, defaults={"title": title, "body": body})
        for question, answer, sort in FAQS:
            Faq.objects.get_or_create(question=question, defaults={"answer": answer, "sort_order": sort})

        Coupon.objects.get_or_create(
            code="WELCOME10",
            defaults={
                "description": "10% off your first order",
                "discount_type": Coupon.DiscountType.PERCENT,
                "discount_value": Decimal("10.00"),
                "min_order_value": Decimal("50.00"),
                "per_user_limit": 1,
            },
        )

        if not User.objects.filter(email=options["admin_email"]).exists():
            User.objects.create_superuser(
                email=options["admin_email"],
                password=options["admin_password"],
                full_name="Store Admin",
            )
            self.stdout.write(self.style.WARNING(
                f"  + admin user {options['admin_email']} / {options['admin_password']} — change this password!"
            ))

        self.stdout.write(self.style.SUCCESS("Store seeded."))
