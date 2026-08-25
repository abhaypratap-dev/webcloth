from django.utils.text import slugify


def unique_slugify(instance, source: str, *, field_name: str = "slug", fallback: str = "item") -> str:
    """Build a slug from `source` that is unique for `instance`'s model.

    Django's `slugify` alone is not safe behind a `unique=True` slug column:
    two products called "Oversized Tee" both slugify to `oversized-tee` and
    the second INSERT raises IntegrityError, which surfaces as a 500. Worse,
    a title with no ASCII letters at all — "कुरता", an emoji, "..." — slugifies
    to the empty string, so *every* such record collides on `""` (and any that
    did save would have an unroutable empty slug in its URL).

    Collisions get a numeric suffix (`oversized-tee-2`), truncated to fit the
    field's max_length. An empty base falls back to `fallback`.
    """
    model = instance.__class__
    max_length = model._meta.get_field(field_name).max_length or 50

    base = slugify(source or "").strip("-")[:max_length].strip("-") or fallback
    candidate, suffix = base, 1

    # A concurrent insert could still take `candidate` between this check and
    # the INSERT; the DB constraint remains the real guarantee, and
    # config.exceptions turns that losing race into a 409, not a 500.
    while (
        model._default_manager.filter(**{field_name: candidate})
        .exclude(pk=instance.pk)
        .exists()
    ):
        suffix += 1
        tail = f"-{suffix}"
        candidate = f"{base[: max_length - len(tail)].rstrip('-')}{tail}"

    return candidate
