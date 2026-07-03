from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Invitation, Tree, TreeMembership
from .permissions import IsTreeOwner
from .serializers import (
    InvitationSerializer,
    InviteSerializer,
    TreeMembershipSerializer,
    TreeSerializer,
)


class TreeViewSet(viewsets.ModelViewSet):
    """CRUD for trees the user can see, plus member management.

    List/retrieve are scoped to trees the user is a member of. Rename/delete
    and member management are Owner-only (enforced by IsTreeOwner).
    """

    serializer_class = TreeSerializer
    permission_classes = [IsAuthenticated, IsTreeOwner]

    def get_queryset(self):
        user = self.request.user
        return (
            Tree.objects.filter(memberships__user=user)
            .distinct()
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            tree = serializer.save(owner=self.request.user)
            TreeMembership.objects.create(
                tree=tree, user=self.request.user, role=TreeMembership.ROLE_OWNER
            )

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        tree = self.get_object()
        if request.method == "GET":
            memberships = tree.memberships.select_related("user").all()
            return Response(TreeMembershipSerializer(memberships, many=True).data)
        # POST = invite (owner only, already gated by IsTreeOwner)
        return self.invite(request, pk)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        tree = self.get_object()
        serializer = InviteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        invited_user = serializer.context["invited_user"]
        membership, created = TreeMembership.objects.update_or_create(
            tree=tree,
            user=invited_user,
            defaults={"role": serializer.validated_data["role"]},
        )
        return Response(
            TreeMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path="members/(?P<member_id>[^/.]+)",
    )
    def member_detail(self, request, pk=None, member_id=None):
        tree = self.get_object()
        membership = tree.memberships.filter(pk=member_id).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if membership.role == TreeMembership.ROLE_OWNER:
            raise ValidationError("The tree owner's membership cannot be changed here.")
        if request.method == "DELETE":
            membership.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        new_role = request.data.get("role")
        if new_role not in (TreeMembership.ROLE_EDITOR, TreeMembership.ROLE_VIEWER):
            raise ValidationError("role must be 'editor' or 'viewer'.")
        membership.role = new_role
        membership.save(update_fields=["role"])
        return Response(TreeMembershipSerializer(membership).data)


class InvitationViewSet(viewsets.ModelViewSet):
    """Owner-managed shareable invite links for a tree."""

    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, IsTreeOwner]

    def get_tree(self):
        return get_object_or_404(Tree, pk=self.kwargs["tree_id"])

    def get_queryset(self):
        return Invitation.objects.filter(tree_id=self.kwargs["tree_id"])

    def perform_create(self, serializer):
        serializer.save(tree=self.get_tree(), invited_by=self.request.user)


class InvitationPreviewView(APIView):
    """Public preview of an invite link (tree name, role, inviter)."""

    permission_classes = [AllowAny]

    def get(self, request, token=None):
        invite = get_object_or_404(Invitation, token=token)
        return Response(
            {
                "tree": {"id": invite.tree_id, "name": invite.tree.name},
                "role": invite.role,
                "invited_by": invite.invited_by.username if invite.invited_by else None,
                "already_accepted": invite.is_accepted,
                "already_member": bool(invite.tree.role_for(request.user)),
            }
        )


class InvitationAcceptView(APIView):
    """Accept an invite (auth required). Creates/updates the membership."""

    permission_classes = [IsAuthenticated]

    def post(self, request, token=None):
        invite = get_object_or_404(Invitation, token=token)
        existing_role = invite.tree.role_for(request.user)
        if existing_role == TreeMembership.ROLE_OWNER:
            return Response(
                {"detail": "You already own this tree.", "tree": invite.tree_id}
            )
        membership, _ = TreeMembership.objects.update_or_create(
            tree=invite.tree,
            user=request.user,
            defaults={"role": invite.role} if existing_role != TreeMembership.ROLE_OWNER else {},
        )
        if not invite.is_accepted:
            invite.accepted_by = request.user
            invite.accepted_at = timezone.now()
            invite.save(update_fields=["accepted_by", "accepted_at"])
        return Response({"tree": invite.tree_id, "role": membership.role})
