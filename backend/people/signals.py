"""Person changelog: a pre_save signal diffs the incoming Person against the
DB copy and records a field-level PersonChangeLog row.

Kept deliberately dumb (field diff only) — no approval/revert in v1. The acting
user is stashed on the instance as ``_changed_by`` by the view/serializer,
since signals have no request context.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Person, PersonChangeLog

# Fields worth tracking in the changelog (skip auto/derived fields).
TRACKED_FIELDS = [
    "name",
    "gender",
    "birth_date",
    "death_date",
    "is_living",
    "notes",
    "is_archived",
    "photo",
]

# Transient store keyed by instance id() to pass the computed diff from
# pre_save (where we can read the old row) to post_save (where the new pk and
# saved values exist for creates).
_PENDING_DIFFS = {}


def _serialize(value):
    """Make a field value JSON-safe for the diff blob."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    # ImageField / FieldFile → store its name (path), or None.
    if hasattr(value, "name"):
        return value.name or None
    return value


@receiver(pre_save, sender=Person)
def capture_person_diff(sender, instance, **kwargs):
    if instance.pk is None:
        # Creation — record all non-empty tracked fields as [null, new].
        diff = {}
        for field in TRACKED_FIELDS:
            new = _serialize(getattr(instance, field))
            if new not in (None, "", False):
                diff[field] = [None, new]
        _PENDING_DIFFS[id(instance)] = diff
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        _PENDING_DIFFS[id(instance)] = {}
        return

    diff = {}
    for field in TRACKED_FIELDS:
        old_val = _serialize(getattr(old, field))
        new_val = _serialize(getattr(instance, field))
        if old_val != new_val:
            diff[field] = [old_val, new_val]
    _PENDING_DIFFS[id(instance)] = diff


@receiver(post_save, sender=Person)
def write_person_changelog(sender, instance, created, **kwargs):
    diff = _PENDING_DIFFS.pop(id(instance), None)
    if not diff:
        return
    PersonChangeLog.objects.create(
        person=instance,
        changed_by=getattr(instance, "_changed_by", None),
        diff=diff,
    )
