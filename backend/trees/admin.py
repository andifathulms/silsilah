from django.contrib import admin

from .models import Invitation, Tree, TreeMembership


class TreeMembershipInline(admin.TabularInline):
    model = TreeMembership
    extra = 0


@admin.register(Tree)
class TreeAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_public_link_enabled", "created_at")
    inlines = [TreeMembershipInline]


@admin.register(TreeMembership)
class TreeMembershipAdmin(admin.ModelAdmin):
    list_display = ("tree", "user", "role")
    list_filter = ("role",)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("tree", "role", "email", "invited_by", "accepted_by", "created_at")
    list_filter = ("role", "tree")
    readonly_fields = ("token",)
