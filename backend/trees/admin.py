from django.contrib import admin

from .models import Tree, TreeMembership


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
