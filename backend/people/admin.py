from django.contrib import admin

from .models import Person, PersonChangeLog, Relationship


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
