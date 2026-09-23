# Going to production

This is the multi-brand platform: one Django API serving several storefronts,
each brand in its **own Postgres database**, plus a staff-only console for
provisioning. `DEPLOYMENT.md` covers the original single-tenant Cut & Cult
setup and its Azure specifics; read this first.

## What gets deployed

| Piece | Path | Build | Runs as |
|---|---|---|---|
| API | `backend/` | — | gunicorn via `startup.sh` |
| Cut & Cult storefront | `/` | `npm run build:azure` | SSR (Nitro) |
| Orenda storefront | `orenda-atelier-main/` | `npm run build:azure` | SSR (Nitro) |
| Platform console | `saas-console/` | `npm run build` | static |

Each storefront carries its own admin at `/admin`, against its own brand. The
console is staff-only and never touches brand data directly.

---

## 1. Database

One Postgres server. Create the **control-plane** database by hand; every
brand's database is created by the app when you provision it.

```sql
CREATE DATABASE saas_master;
```

`POSTGRES_DB` points at `saas_master`. It must **never** point at a brand
database — `manage.py check --deploy` fails the boot if it does.

**Connection budget.** Persistent connections are held per brand per gunicorn
worker, so the ceiling is roughly `active brands × workers`. With 3 workers
and 5 brands that is 15 before anything else connects. This is the first
thing that breaks as you add brands:

- Set `POSTGRES_CONN_MAX_AGE=0` on cron and any process that fans out over
  every brand.
- Put PgBouncer in front once you pass ~10 brands.

## 2. Environment

Copy `backend/.env.example`. The settings that matter in production:

```bash
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(64))')
DJANGO_ALLOWED_HOSTS=api.example.com
POSTGRES_DB=saas_master            # the master, not a brand
POSTGRES_SSLMODE=require
POSTGRES_CONN_MAX_AGE=60
REDIS_URL=redis://…                # shared cache — see below
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
AZURE_STORAGE_ACCOUNT_NAME=…       # or DJANGO_MEDIA_ROOT=/home/media
CORS_ALLOWED_ORIGINS=https://console.example.com
```

`CORS_ALLOWED_ORIGINS` holds only fixed origins (the console, local dev).
**Brand storefront domains are allowed automatically** from their registered
domains, so adding a brand needs no API redeploy.

**Redis is not optional in a multi-worker deployment.** Tenant lookups and
cross-brand metrics are cached; without a shared cache each worker keeps its
own copy, so suspending a brand takes effect one worker at a time.

Run the checks before you ship — they fail the boot rather than let a bad
config through quietly:

```bash
python manage.py check --deploy
```

Covered: placeholder secret key, wildcard/empty `ALLOWED_HOSTS`, the default
database pointed at a brand, non-persistent media, mail going nowhere, and a
per-process cache.

## 3. First boot

```bash
python manage.py migrate                         # control plane only
python manage.py create_platform_admin ops@example.com --superadmin
```

`startup.sh` already runs `migrate` then `migrate_all_tenants` on every boot,
so a deploy brings every brand's schema forward. One brand failing is
reported and does not block the others or the boot.

## 4. Provisioning a brand

From the console (**New brand**), or:

```bash
python manage.py create_tenant orenda \
    --name "Label Orenda" \
    --host shop.labelorenda.com \
    --admin-email owner@labelorenda.com
```

Creates the database, runs every migration, seeds defaults and the first admin
login, and registers the host. Any failure rolls the whole thing back,
database included.

Then deploy that brand's storefront with `VITE_TENANT_SLUG=orenda` and
`VITE_API_URL` pointing at the API.

## 5. Scheduled work

Tracking sync is per brand and needs a scheduler (cron, Azure WebJob):

```bash
*/30 * * * *  python manage.py sync_shipment_tracking --all
```

`--all` walks every active brand; one brand's courier outage is logged and
does not stop the rest.

## 6. Converting the existing Cut & Cult database

The live `cutcult` database predates all of this and becomes a **brand**
database, with a new master beside it. Full steps are in
`backend/TENANCY.md` — the traps are:

- `pg_dump` first.
- `manage.py create_tenant` refuses to adopt an existing database by design;
  insert the `Tenant` row directly with `db_name='cutcult'`.
- Existing uploads keep their unprefixed paths and keep working. Don't rewrite
  stored names.
- **Deploy the API and both storefronts together.** An old frontend sends no
  `X-Tenant` header and gets a 404 on every call.

---

## Operating it

**Logs are tagged with the brand.** Every line carries `[slug]`, or `[-]` for
work outside a request. With several brands on one deployment an untagged log
line can't be acted on.

**There is no Django admin.** `django.contrib.admin` cannot exist here — its
`LogEntry` table has a foreign key to the user model, which is per brand. Use:

```bash
python manage.py tenant_shell --tenant orenda
```

**Client error reporting** is a seam, not an SDK: set `window.__errorReporter`
from the page to forward storefront crashes to Sentry or similar. Nothing
phones home by default.

## The isolation guarantees

Worth re-checking after any change to auth, routing or the database router:

| Check | Expected |
|---|---|
| Brand A's token against brand B | **401** |
| A brand token against `/api/platform/` | 401/403 |
| A platform token against a storefront | 401 |
| Request with no `X-Tenant` and an unknown Host | 404 |
| Suspended brand's storefront | 403 |
| Query with no brand in scope | raises, never falls back |
| Master database | control-plane tables only |

These are covered by tests in `backend/apps/tenants/tests.py`. Run the suite
before every deploy:

```bash
cd backend && python manage.py test
```
