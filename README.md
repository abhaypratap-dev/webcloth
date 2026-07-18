# Cut & Cult — E-commerce Platform

A production-ready clothing e-commerce platform. A React (TanStack Start, SSR)
storefront powered by a modular Django REST Framework backend on PostgreSQL,
with JWT auth, a full payment architecture, and a custom admin dashboard.

Public visitors can browse the whole catalogue; adding to cart, wishlisting,
and checking out require a registered account.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TanStack Start + Router (SSR), TanStack Query, Tailwind v4, Framer Motion, Recharts |
| Backend | Django 5+/6, Django REST Framework, SimpleJWT, django-filter |
| Database | PostgreSQL |
| Auth | JWT (access + refresh, rotation & blacklist) |

---

## Project layout

```
.
├── backend/                 # Django REST API
│   ├── config/              # settings, urls, pagination, exception handler
│   ├── apps/
│   │   ├── accounts/        # custom user, JWT auth, addresses, admin customers
│   │   ├── categories/      # parent/sub categories
│   │   ├── brands/
│   │   ├── products/        # products, images, variants, filters, admin CRUD, seed
│   │   ├── inventory/       # stock movements, adjustments, low/out-of-stock alerts
│   │   ├── offers/          # automatic storefront discounts (pricing engine)
│   │   ├── coupons/         # coupon codes + validation service
│   │   ├── cart/            # server cart, totals service (shipping/tax/coupon)
│   │   ├── wishlist/
│   │   ├── orders/          # checkout, lifecycle, invoice, admin management
│   │   ├── payments/        # modular gateways: COD / Razorpay / Stripe
│   │   ├── reviews/         # verified-purchase reviews + moderation
│   │   ├── banners/         # homepage banners + aggregated homepage endpoint
│   │   ├── cms/             # static pages + FAQs
│   │   ├── store_settings/  # singleton store config (shipping, tax, social)
│   │   ├── notifications/   # channel-based notifications (email implemented)
│   │   └── dashboard/       # admin stats & charts
│   └── manage.py
└── src/                      # frontend
    ├── lib/                  # api client, auth, cart, wishlist, products, account
    ├── components/site/      # storefront components
    ├── components/admin/     # admin UI kit
    └── routes/               # file-based routes (storefront + /admin/*)
```

---

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env            # then edit DB credentials & secrets

# Create the database (PostgreSQL must be running)
createdb cutcult

# Migrate & seed
python manage.py migrate
python manage.py seed_store     # catalogue, banners, CMS pages, coupon, admin user

# Run
python manage.py runserver 8001
```

The seed creates an admin: **admin@cutcult.local / admin12345** — change this
immediately in any real deployment.

### Key environment variables (`backend/.env`)

See `backend/.env.example`. Highlights:

- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`
- `POSTGRES_*` — database connection
- `CORS_ALLOWED_ORIGINS` — must include the frontend origin (`http://localhost:8080`)
- `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`
- `RAZORPAY_*`, `STRIPE_*` — payment credentials (optional; COD always works)
- `EMAIL_*` — SMTP for notifications (defaults to console backend in dev)

---

## Frontend setup

```bash
npm install
echo 'VITE_API_URL="http://localhost:8001/api"' > .env
npm run dev            # http://localhost:8080
```

`npm run build` produces an SSR Node server build under `.output/`.

---

## Authentication & access rules

- **Public**: homepage, catalogue, categories, product details, search, filters,
  offers, banners, CMS pages, reviews.
- **Registered only**: cart, wishlist, addresses, checkout, orders, invoices,
  profile. Any gated action by a visitor redirects to `/auth`.

JWT is stored client-side; the API client auto-refreshes expired access tokens
and retries once. Blocked users cannot authenticate.

---

## Custom admin dashboard

Staff users (`is_staff`) get an **Admin** link on their account page and can
visit `/admin`. Modules:

Dashboard (revenue, orders, customers, sales charts, top products, low-stock,
recent orders) · Products (CRUD + images + variants) · Categories · Brands ·
Inventory (stock adjust + alerts) · Orders (status lifecycle, invoices) ·
Customers (block/unblock, spend) · Coupons · Offers · Reviews (approve/reject) ·
Homepage banners · CMS (pages + FAQs) · Store settings.

The legacy Django admin remains available at `/django-admin/` for superusers.

---

## API overview

All endpoints are under `/api/`. Selected routes:

| Area | Endpoint |
|------|----------|
| Auth | `POST auth/register`, `auth/login`, `auth/refresh`, `auth/logout`, `auth/forgot-password`, `auth/reset-password`, `auth/change-password`, `GET/PATCH auth/me` |
| Addresses | `auth/addresses/` (CRUD) |
| Catalogue | `products/`, `products/{slug}/`, `products/{slug}/related/`, `categories/`, `brands/` |
| Homepage | `banners/homepage/` |
| Cart | `cart/`, `cart/items/`, `cart/items/{id}/`, `cart/coupon/` |
| Wishlist | `wishlist/`, `wishlist/toggle/`, `wishlist/ids/` |
| Orders | `orders/`, `orders/checkout/`, `orders/{id}/cancel/`, `orders/{id}/invoice/` |
| Payments | `payments/create/`, `payments/verify/` |
| Reviews | `reviews/` (CRUD), `reviews/admin/` (moderation) |
| Admin | `products/admin/`, `orders/admin/`, `auth/admin/customers/`, `coupons/`, `offers/`, `inventory/`, `dashboard/stats/`, `settings/`, `banners/`, `cms/` |

Responses use standard HTTP status codes; errors are normalised to
`{ "detail": "...", "errors": {...} }`.

---

## Payments

`apps/payments/gateways.py` defines a `BaseGateway` interface with `create()`
and `verify()`. Cash on Delivery, Razorpay, and Stripe are implemented; add a
new gateway by subclassing `BaseGateway` and registering it in `GATEWAYS`.
COD works with no configuration; Razorpay/Stripe activate when their keys are set.

---

## Notes

- Product/banner images seeded with `/assets/*.jpg` paths resolve to the
  frontend's bundled assets; admin-uploaded images and external URLs pass through.
- Offer prices are computed live: a product's sale price is the best of its base
  price, its manual offer price, and any running `Offer` that targets it.
- Stock is decremented transactionally at checkout and restored on cancellation,
  with every movement recorded for the inventory history.
