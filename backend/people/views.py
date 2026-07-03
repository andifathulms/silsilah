from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from trees.models import Tree
from trees.permissions import IsTreeMember

from .models import Person, Relationship
from .serializers import (
    PersonChangeLogSerializer,
    PersonSerializer,
    RelationshipSerializer,
)


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
