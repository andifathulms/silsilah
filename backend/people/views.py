from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from trees.models import Tree
from trees.permissions import IsTreeMember, IsTreeOwner

from .models import Comment, LifeEvent, MediaItem, Person, Relationship, ShareLink
from .serializers import (
    CommentSerializer,
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
        from .relationship_utils import describe_relationship, relationship_structure

        person = self.get_object()
        other = get_object_or_404(Person, pk=other_id, tree_id=tree_id)
        struct = relationship_structure(person, other, int(tree_id))
        label = describe_relationship(person, other, int(tree_id))
        return Response(
            {
                "person": person.id,
                "other": other.id,
                "other_name": other.name,
                # Structured descriptor — the frontend composes a localized label.
                "kind": struct["kind"],
                "up": struct["up"],
                "down": struct["down"],
                "gender": struct["gender"],
                # English fallback for non-i18n API consumers.
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


class CommentViewSet(TreeScopedMixin, viewsets.ModelViewSet):
    """Collaborative memories/stories on a Person.

    Any member reads; Editor+ posts (enforced by IsTreeMember). A comment can
    be deleted by its author or the tree owner.
    """

    serializer_class = CommentSerializer

    def get_queryset(self):
        return Comment.objects.filter(
            person_id=self.kwargs["person_id"],
            person__tree_id=self.kwargs["tree_id"],
        ).select_related("author")

    def perform_create(self, serializer):
        person = get_object_or_404(
            Person, pk=self.kwargs["person_id"], tree_id=self.kwargs["tree_id"]
        )
        serializer.save(person=person, author=self.request.user)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        is_owner = self.get_role() == "owner"
        if comment.author_id != request.user.id and not is_owner:
            return Response(
                {"detail": "Only the author or tree owner can delete this comment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


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


class PlacesView(APIView):
    """Aggregate the family's places from life events — a roots/migration map.

    Living people's events are excluded for non-Editors (privacy).
    """

    permission_classes = [AllowAny, IsTreeMember]

    def get(self, request, tree_id=None):
        tree = get_object_or_404(Tree, pk=tree_id)
        is_editor = tree.role_for(request.user) in EDITOR_ROLES

        events = LifeEvent.objects.filter(
            person__tree=tree, person__is_archived=False
        ).exclude(place="").select_related("person")
        if not is_editor:
            events = events.exclude(person__is_living=True)

        places = {}
        for e in events:
            key = e.place.strip()
            bucket = places.setdefault(key, {"place": key, "count": 0, "entries": []})
            bucket["count"] += 1
            bucket["entries"].append({
                "person": e.person_id,
                "name": e.person.name,
                "kind": e.get_type_display(),
                "date": e.date.isoformat() if e.date else None,
            })

        result = sorted(places.values(), key=lambda p: -p["count"])
        return Response({"places": result})


class GedcomView(APIView):
    """Export the tree as GEDCOM (GET) or import GEDCOM into it (POST).

    Both require Editor+ — export includes full detail, import writes data.
    """

    permission_classes = [IsAuthenticated, IsTreeMember]

    def get(self, request, tree_id=None):
        from django.http import HttpResponse

        from .gedcom import export_gedcom

        tree = get_object_or_404(Tree, pk=tree_id)
        if tree.role_for(request.user) not in EDITOR_ROLES:
            return Response(
                {"detail": "Only editors and owners can export."},
                status=status.HTTP_403_FORBIDDEN,
            )
        text = export_gedcom(tree)
        resp = HttpResponse(text, content_type="text/vnd.familysearch.gedcom")
        safe = "".join(c for c in tree.name if c.isalnum() or c in " -_").strip() or "tree"
        resp["Content-Disposition"] = f'attachment; filename="{safe}.ged"'
        return resp

    def post(self, request, tree_id=None):
        from .gedcom import import_gedcom

        tree = get_object_or_404(Tree, pk=tree_id)
        if tree.role_for(request.user) not in EDITOR_ROLES:
            return Response(
                {"detail": "Only editors and owners can import."},
                status=status.HTTP_403_FORBIDDEN,
            )
        upload = request.FILES.get("file")
        text = upload.read().decode("utf-8", errors="replace") if upload else request.data.get("text", "")
        if not text.strip():
            return Response({"detail": "No GEDCOM content provided."}, status=400)
        result = import_gedcom(tree, text, user=request.user)
        return Response(result, status=status.HTTP_201_CREATED)


class OnThisDayView(APIView):
    """Upcoming family occasions in the next ~45 days: birthdays of living
    people, wedding anniversaries, and memorial (death) anniversaries.

    Living-people birthdays are only included for Editor+ (they're private to
    Viewers), matching the field-level privacy rule.
    """

    permission_classes = [AllowAny, IsTreeMember]

    def get(self, request, tree_id=None):
        import datetime

        tree = get_object_or_404(Tree, pk=tree_id)
        role = tree.role_for(request.user)
        is_editor = role in EDITOR_ROLES
        today = timezone.localdate()
        window = 45

        def days_until(d):
            year = today.year
            month, day = d.month, d.day
            try:
                nxt = datetime.date(year, month, day)
            except ValueError:
                nxt = datetime.date(year, month, 28)
            if nxt < today:
                try:
                    nxt = datetime.date(year + 1, month, day)
                except ValueError:
                    nxt = datetime.date(year + 1, month, 28)
            return (nxt - today).days

        occasions = []
        people = tree.people.filter(is_archived=False)

        for p in people:
            if p.birth_date and p.is_living and is_editor:
                du = days_until(p.birth_date)
                if du <= window:
                    occasions.append({
                        "kind": "birthday",
                        "person": p.id,
                        "name": p.name,
                        "date": p.birth_date.replace(year=today.year).isoformat(),
                        "days_until": du,
                        "turning": today.year - p.birth_date.year,
                    })
            if p.death_date and not p.is_living:
                du = days_until(p.death_date)
                if du <= window:
                    occasions.append({
                        "kind": "memorial",
                        "person": p.id,
                        "name": p.name,
                        "date": p.death_date.replace(year=today.year).isoformat(),
                        "days_until": du,
                        "years_ago": today.year - p.death_date.year,
                    })

        spouse_rels = tree.relationships.filter(
            type=Relationship.TYPE_SPOUSE, end_date__isnull=True, start_date__isnull=False
        ).select_related("person_a", "person_b")
        for r in spouse_rels:
            du = days_until(r.start_date)
            if du <= window:
                occasions.append({
                    "kind": "anniversary",
                    "person": r.person_a_id,
                    "name": f"{r.person_a.name} & {r.person_b.name}",
                    "date": r.start_date.replace(year=today.year).isoformat(),
                    "days_until": du,
                    "years": today.year - r.start_date.year,
                })

        occasions.sort(key=lambda o: o["days_until"])
        return Response({"today": today.isoformat(), "occasions": occasions[:12]})


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
