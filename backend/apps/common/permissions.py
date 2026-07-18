from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Store staff only (custom admin dashboard)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsAdminOrReadOnly(BasePermission):
    """Anyone may read; only staff may write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsOwner(BasePermission):
    """Object-level check for user-owned rows (expects a `user` FK)."""

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
