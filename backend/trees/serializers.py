from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Tree, TreeMembership


class TreeMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = TreeMembership
        fields = ["id", "user", "username", "email", "role"]
        read_only_fields = ["id", "user"]


class TreeSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            "id",
            "name",
            "owner",
            "is_public_link_enabled",
            "created_at",
            "my_role",
            "member_count",
        ]
        read_only_fields = ["id", "owner", "created_at"]

    def get_my_role(self, obj):
        request = self.context.get("request")
        return obj.role_for(request.user) if request else None

    def get_member_count(self, obj):
        return obj.memberships.count()


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[TreeMembership.ROLE_EDITOR, TreeMembership.ROLE_VIEWER]
    )

    def validate_email(self, value):
        user = User.objects.filter(email__iexact=value).first()
        if not user:
            raise serializers.ValidationError(
                "No user with this email. They must sign up first."
            )
        self.context["invited_user"] = user
        return value
