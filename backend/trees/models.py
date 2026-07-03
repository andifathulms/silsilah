import uuid

from django.contrib.auth.models import User
from django.db import models


def _invite_token():
    return uuid.uuid4().hex


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


class Invitation(models.Model):
    """A shareable invite link that grants a role on acceptance.

    Unlike the direct email invite (which requires the person to already have
    an account), an Invitation is a token anyone can open, sign up through, and
    accept — removing the onboarding wall.
    """

    tree = models.ForeignKey(
        Tree, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField(blank=True)  # optional target hint
    role = models.CharField(
        max_length=10,
        choices=[
            (TreeMembership.ROLE_EDITOR, "Editor"),
            (TreeMembership.ROLE_VIEWER, "Viewer"),
        ],
    )
    token = models.CharField(max_length=32, unique=True, default=_invite_token)
    invited_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="sent_invitations"
    )
    accepted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="accepted_invitations",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite to {self.tree} as {self.role}"

    @property
    def is_accepted(self):
        return self.accepted_by_id is not None
