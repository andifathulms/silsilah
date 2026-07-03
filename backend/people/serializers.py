from rest_framework import serializers

from trees.models import TreeMembership

from .models import (
    Comment,
    LifeEvent,
    MediaItem,
    Person,
    PersonChangeLog,
    Relationship,
    ShareLink,
)

# Fields hidden from Viewers / anonymous public-link visitors when the person
# is still living (PRD #20).
PRIVATE_LIVING_FIELDS = ["birth_date", "photo", "notes"]

EDITOR_ROLES = {TreeMembership.ROLE_OWNER, TreeMembership.ROLE_EDITOR}


class PersonSerializer(serializers.ModelSerializer):
    """Serializes a Person, stripping private fields for living people when the
    requester is a Viewer or anonymous (public link).

    Privacy is enforced here — never rely on the frontend to hide fields it was
    already sent. The requester's role is passed in via ``context['role']``.
    """

    class Meta:
        model = Person
        fields = [
            "id",
            "tree",
            "name",
            "gender",
            "birth_date",
            "death_date",
            "is_living",
            "photo",
            "notes",
            "is_archived",
            "created_at",
        ]
        read_only_fields = ["id", "tree", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        role = self.context.get("role")
        is_editor = role in EDITOR_ROLES
        if instance.is_living and not is_editor:
            for field in PRIVATE_LIVING_FIELDS:
                data[field] = None
            data["_private_redacted"] = True
        return data

    def create(self, validated_data):
        request = self.context.get("request")
        instance = Person(**validated_data)
        if request and request.user.is_authenticated:
            instance._changed_by = request.user
        instance.save()
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            instance._changed_by = request.user
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class RelationshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Relationship
        fields = [
            "id",
            "tree",
            "type",
            "person_a",
            "person_b",
            "start_date",
            "end_date",
            "is_biological",
        ]
        read_only_fields = ["id", "tree"]

    def validate(self, attrs):
        # Build a transient instance and run model-level validation so cycle
        # prevention lives in one place (the model), not duplicated here.
        tree = self.context.get("tree")
        instance = Relationship(
            tree=tree,
            type=attrs.get("type", getattr(self.instance, "type", None)),
            person_a=attrs.get("person_a", getattr(self.instance, "person_a", None)),
            person_b=attrs.get("person_b", getattr(self.instance, "person_b", None)),
            start_date=attrs.get("start_date"),
            end_date=attrs.get("end_date"),
            is_biological=attrs.get("is_biological", True),
        )
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return attrs


class PersonChangeLogSerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(
        source="changed_by.username", read_only=True, default=None
    )

    class Meta:
        model = PersonChangeLog
        fields = ["id", "person", "changed_by", "changed_by_username", "changed_at", "diff"]


class MediaItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaItem
        fields = ["id", "person", "image", "caption", "event_date", "created_at"]
        read_only_fields = ["id", "person", "created_at"]


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(
        source="author.username", read_only=True, default=None
    )

    class Meta:
        model = Comment
        fields = ["id", "person", "author", "author_username", "body", "created_at"]
        read_only_fields = ["id", "person", "author", "created_at"]


class LifeEventSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = LifeEvent
        fields = [
            "id",
            "person",
            "type",
            "type_display",
            "title",
            "date",
            "place",
            "description",
            "created_at",
        ]
        read_only_fields = ["id", "person", "created_at"]


class ShareLinkSerializer(serializers.ModelSerializer):
    root_person_name = serializers.CharField(
        source="root_person.name", read_only=True, default=None
    )
    scope = serializers.SerializerMethodField()

    class Meta:
        model = ShareLink
        fields = [
            "id",
            "token",
            "root_person",
            "root_person_name",
            "include_ancestors",
            "scope",
            "created_at",
        ]
        read_only_fields = ["id", "token", "created_at"]

    def get_scope(self, obj):
        return "branch" if obj.root_person_id else "whole_tree"

    def validate_root_person(self, value):
        tree = self.context.get("tree")
        if value and tree and value.tree_id != tree.id:
            raise serializers.ValidationError(
                "root_person must belong to this tree."
            )
        return value


class PublicPersonSerializer(serializers.ModelSerializer):
    """Read-only person representation for anonymous share-link visitors.

    Applies the same living-person redaction a Viewer gets — never trust the
    frontend to hide it.
    """

    media = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "name",
            "gender",
            "birth_date",
            "death_date",
            "is_living",
            "photo",
            "notes",
            "media",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_living:
            for field in PRIVATE_LIVING_FIELDS:
                data[field] = None
            data["media"] = []
            data["_private_redacted"] = True
        return data

    def get_media(self, instance):
        if instance.is_living:
            return []
        request = self.context.get("request")
        return MediaItemSerializer(
            instance.media.all(), many=True, context={"request": request}
        ).data
