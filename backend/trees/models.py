from django.contrib.auth.models import User
from django.db import models


class Tree(models.Model):
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="owned_trees"
    )
    is_public_link_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def role_for(self, user):
        """Return the requesting user's role in this tree, or None."""
        if not user or not user.is_authenticated:
            return None
        membership = self.memberships.filter(user=user).first()
        return membership.role if membership else None


class TreeMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_EDITOR = "editor"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_EDITOR, "Editor"),
        (ROLE_VIEWER, "Viewer"),
    ]
    tree = models.ForeignKey(
        Tree, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    class Meta:
        unique_together = ("tree", "user")

    def __str__(self):
        return f"{self.user} — {self.role} of {self.tree}"
