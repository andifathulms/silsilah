from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from trees.models import Tree
from trees.permissions import IsTreeMember, IsTreeOwner

from .models import LifeEvent, MediaItem, Person, Relationship, ShareLink
from .serializers import (
    LifeEventSerializer,
    MediaItemSerializer,
    PersonChangeLogSerializer,
    PersonSerializer,
    PublicPersonSerializer,
    RelationshipSerializer,
    ShareLinkSerializer,
)

EDITOR_ROLES = ("owner", "editor")


class TreeScopedMixin:
    """Resolves the parent tree from the URL and exposes the requester's role.

    Every people/relationship endpoint is nested under a tree, so membership
    and role are resolved once here and reused for querysets + serializer
    privacy context.
    """

    permission_classes = [AllowAny, IsTreeMember]

    def get_tree(self):
        return get_object_or_404(Tree, pk=self.kwargs["tree_id"])

    def get_role(self):
        return self.get_tree().role_for(self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["role"] = self.get_role()
        ctx["tree"] = self.get_tree()
        return ctx


class PersonViewSet(TreeScopedMixin, viewsets.ModelViewSet):
    serializer_class = PersonSerializer

    def get_queryset(self):
        qs = Person.objects.filter(tree_id=self.kwargs["tree_id"])
        # Hide archived people from list unless explicitly requested.
        if self.action == "list" and self.request.query_params.get(
            "include_archived"
        ) not in ("1", "true"):
            qs = qs.filter(is_archived=False)
        return qs

    def perform_create(self, serializer):
        serializer.save(tree=self.get_tree())

    @action(detail=True, methods=["post"])
    def archive(self, request, tree_id=None, pk=None):
        person = self.get_object()
        person._changed_by = request.user
        person.is_archived = True
        person.save()
        return Response(self.get_serializer(person).data)

    @action(detail=True, methods=["get"])
    def siblings(self, request, tree_id=None, pk=None):
        person = self.get_object()
        full, half = person.siblings()
        ctx = self.get_serializer_context()
        return Response(
            {
                "full": PersonSerializer(full, many=True, context=ctx).data,
                "half": PersonSerializer(half, many=True, context=ctx).data,
            }
        )

    @action(detail=True, methods=["get"])
    def relatives(self, request, tree_id=None, pk=None):
        """Derived immediate + extended family for the detail panel."""
        person = self.get_object()
        ctx = self.get_serializer_context()
        full, half = person.siblings()

        def ser(qs):
            return PersonSerializer(qs, many=True, context=ctx).data

        return Response(
            {
                "parents": ser(person.parents()),
                "children": ser(person.children()),
                "spouses": ser(person.spouses()),
                "siblings_full": ser(full),
                "siblings_half": ser(half),
                "grandparents": ser(person.grandparents()),
            }
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="relationship-to/(?P<other_id>[0-9]+)",
    )
    def relationship_to(self, request, tree_id=None, pk=None, other_id=None):
        from .relationship_utils import describe_relationship

        person = self.get_object()
        other = get_object_or_404(Person, pk=other_id, tree_id=tree_id)
        label = describe_relationship(person, other, int(tree_id))
        return Response(
            {
                "person": person.id,
                "other": other.id,
                "other_name": other.name,
                "label": label,
                "sentence": f"{other.name} is {person.name}'s {label}."
                if label not in ("the same person", "not directly related by blood")
                else (
                    f"{other.name} and {person.name} are the same person."
                    if label == "the same person"
                    else f"{other.name} is {label} to {person.name}."
                ),
            }
        )

    @action(detail=True, methods=["get"], url_path="changelog")
    def changelog(self, request, tree_id=None, pk=None):
        # Changelog visible to Editor+ only (PRD #9).
        if self.get_role() not in ("owner", "editor"):
            return Response(
                {"detail": "Changelog is visible to editors and owners only."},
                status=status.HTTP_403_FORBIDDEN,
            )
        person = self.get_object()
        logs = person.change_log.all()
        return Response(PersonChangeLogSerializer(logs, many=True).data)


class RelationshipViewSet(TreeScopedMixin, viewsets.ModelViewSet):
    serializer_class = RelationshipSerializer

    def get_queryset(self):
        qs = Relationship.objects.filter(tree_id=self.kwargs["tree_id"])
        person_id = self.request.query_params.get("person")
        if person_id:
            qs = qs.filter(person_a_id=person_id) | qs.filter(person_b_id=person_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(tree=self.get_tree())


class MediaItemViewSet(TreeScopedMixin, viewsets.ModelViewSet):
    """Photos attached to a Person (PRD #22).

    Media of a living person is hidden from Viewers and public visitors, the
    same rule as the profile photo. Only Editor+ can upload/delete.
    """

    serializer_class = MediaItemSerializer

    def get_queryset(self):
        person = get_object_or_404(
            Person, pk=self.kwargs["person_id"], tree_id=self.kwargs["tree_id"]
        )
        if person.is_living and self.get_role() not in EDITOR_ROLES:
            return MediaItem.objects.none()
        return person.media.all()

    def perform_create(self, serializer):
        person = get_object_or_404(
            Person, pk=self.kwargs["person_id"], tree_id=self.kwargs["tree_id"]
        )
        serializer.save(person=person)


class LifeEventViewSet(TreeScopedMixin, viewsets.ModelViewSet):
    """Timeline events for a Person (birth, marriage, migration, …).

    A living person's events are hidden from Viewers and public visitors.
    """

    serializer_class = LifeEventSerializer

    def get_person(self):
        return get_object_or_404(
            Person, pk=self.kwargs["person_id"], tree_id=self.kwargs["tree_id"]
        )

    def get_queryset(self):
        person = self.get_person()
        if person.is_living and self.get_role() not in EDITOR_ROLES:
            return LifeEvent.objects.none()
        return person.events.all()

    def perform_create(self, serializer):
        serializer.save(person=self.get_person())


class ShareLinkViewSet(viewsets.ModelViewSet):
    """Owner-managed tokenized read-only links into a tree (branch or whole)."""

    serializer_class = ShareLinkSerializer
    permission_classes = [IsAuthenticated, IsTreeOwner]

    def get_tree(self):
        return get_object_or_404(Tree, pk=self.kwargs["tree_id"])

    def get_queryset(self):
        return ShareLink.objects.filter(tree_id=self.kwargs["tree_id"])

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["tree"] = self.get_tree()
        return ctx

    def perform_create(self, serializer):
        serializer.save(tree=self.get_tree(), created_by=self.request.user)


class PublicShareView(APIView):
    """Anonymous, read-only view of a shared tree/branch by token.

    Returns the tree name plus the branch's people and the relationships among
    them, with living-person fields redacted (Viewer-equivalent privacy).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token=None):
        share = get_object_or_404(ShareLink, token=token)
        allowed_ids = share.allowed_person_ids()
        people = Person.objects.filter(pk__in=allowed_ids, is_archived=False)
        # Only relationships fully inside the branch, so no edges dangle out.
        relationships = Relationship.objects.filter(
            tree=share.tree, person_a_id__in=allowed_ids, person_b_id__in=allowed_ids
        )
        return Response(
            {
                "tree": {"id": share.tree_id, "name": share.tree.name},
                "scope": "branch" if share.root_person_id else "whole_tree",
                "root_person": share.root_person_id,
                "people": PublicPersonSerializer(
                    people, many=True, context={"request": request}
                ).data,
                "relationships": RelationshipSerializer(
                    relationships, many=True
                ).data,
            }
        )
