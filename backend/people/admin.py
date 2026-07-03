from django.contrib import admin

from .models import MediaItem, Person, PersonChangeLog, Relationship, ShareLink


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "tree", "is_living", "is_archived", "birth_date")
    list_filter = ("tree", "is_living", "is_archived")
    search_fields = ("name",)


@admin.register(Relationship)
class RelationshipAdmin(admin.ModelAdmin):
    list_display = ("tree", "type", "person_a", "person_b", "is_biological")
    list_filter = ("tree", "type")


@admin.register(PersonChangeLog)
class PersonChangeLogAdmin(admin.ModelAdmin):
    list_display = ("person", "changed_by", "changed_at")
    readonly_fields = ("person", "changed_by", "changed_at", "diff")


@admin.register(MediaItem)
class MediaItemAdmin(admin.ModelAdmin):
    list_display = ("person", "caption", "event_date", "created_at")
    list_filter = ("person__tree",)


@admin.register(ShareLink)
class ShareLinkAdmin(admin.ModelAdmin):
    list_display = ("tree", "root_person", "include_ancestors", "token", "created_at")
    list_filter = ("tree",)
    readonly_fields = ("token",)
