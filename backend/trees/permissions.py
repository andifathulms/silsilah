"""Shared tree-scoped permission classes.

All tree-scoped views (people, relationships, the tree itself) resolve the
requesting user's TreeMembership role and gate on it here, rather than
scattering role checks inline in each view.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Tree, TreeMembership

EDITOR_ROLES = {TreeMembership.ROLE_OWNER, TreeMembership.ROLE_EDITOR}
OWNER_ROLES = {TreeMembership.ROLE_OWNER}


def get_tree_from_view(view):
    """Resolve the Tree a view operates on from its URL kwargs."""
    tree_id = view.kwargs.get("tree_id") or view.kwargs.get("pk")
    if tree_id is None:
        return None
    return Tree.objects.filter(pk=tree_id).first()


class IsTreeMember(BasePermission):
    """Read access requires membership (or a public link for the tree);
    write access requires Editor or Owner role.

    A public (anonymous) request is allowed read-only access only when the
    tree has ``is_public_link_enabled`` set. Privacy field-stripping for
    living people is handled at the serializer level, not here.
    """

    def has_permission(self, request, view):
        tree = get_tree_from_view(view)
        if tree is None:
            # No specific tree in scope (e.g. list/create of trees) — defer to
            # object-level / view-level auth.
            return True

        role = tree.role_for(request.user)

        if request.method in SAFE_METHODS:
            return role is not None or tree.is_public_link_enabled
        return role in EDITOR_ROLES

    def has_object_permission(self, request, view, obj):
        tree = getattr(obj, "tree", None) or obj
        role = tree.role_for(request.user)
        if request.method in SAFE_METHODS:
            return role is not None or tree.is_public_link_enabled
        return role in EDITOR_ROLES


class IsTreeOwner(BasePermission):
    """Owner-only actions: rename/delete tree, manage members."""

    def has_permission(self, request, view):
        tree = get_tree_from_view(view)
        if tree is None:
            return True
        if request.method in SAFE_METHODS:
            role = tree.role_for(request.user)
            return role is not None or tree.is_public_link_enabled
        return tree.role_for(request.user) in OWNER_ROLES

    def has_object_permission(self, request, view, obj):
        tree = obj if isinstance(obj, Tree) else getattr(obj, "tree", None)
        if request.method in SAFE_METHODS:
            role = tree.role_for(request.user)
            return role is not None or tree.is_public_link_enabled
        return tree.role_for(request.user) in OWNER_ROLES
