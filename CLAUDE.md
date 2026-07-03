# CLAUDE.md — Silsilah engineering guide

This file orients Claude Code inside this repo. Read PRD.md first for product
scope; this file is about how to build it.

## Stack

- **Backend**: Django + Django REST Framework, PostgreSQL
- **Frontend**: Next.js (App Router), TypeScript
- **Tree rendering**: `family-chart` (npm) as the default choice — it does the
  layout math for multi-marriage, multi-generation trees out of the box. Only
  reach for custom D3 if `family-chart`'s styling can't be pushed far enough
  visually; don't build a layout engine from scratch.
- **Media storage**: S3-compatible (MinIO in dev, matching other projects) for
  Person photos.
- **Auth**: Django sessions or DRF token auth to start; add OAuth later if
  needed (see PRD open question).

## Project structure

```
backend/
  trees/          # Tree, TreeMembership models + views
  people/          # Person, Relationship models + views
  accounts/        # auth
frontend/
  app/
    trees/[treeId]/           # tree view page
    trees/[treeId]/person/[id]/  # person detail
  components/
    tree-view/        # wraps family-chart
    person-form/
    relationship-form/
```

## Data model (Django)

Keep `Relationship` self-referencing and generic — this is the load-bearing
decision in the whole app. Do not add `father` / `mother` fields to `Person`.

```python
class Tree(models.Model):
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_trees")
    is_public_link_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class TreeMembership(models.Model):
    ROLE_CHOICES = [("owner", "Owner"), ("editor", "Editor"), ("viewer", "Viewer")]
    tree = models.ForeignKey(Tree, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    class Meta:
        unique_together = ("tree", "user")


class Person(models.Model):
    tree = models.ForeignKey(Tree, on_delete=models.CASCADE, related_name="people")
    name = models.CharField(max_length=200)
    gender = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    death_date = models.DateField(null=True, blank=True)
    is_living = models.BooleanField(default=True)
    photo = models.ImageField(upload_to="people/", null=True, blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class Relationship(models.Model):
    TYPE_CHOICES = [("parent_child", "Parent-child"), ("spouse", "Spouse")]
    tree = models.ForeignKey(Tree, on_delete=models.CASCADE, related_name="relationships")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    # parent_child: person_a = parent, person_b = child. spouse: order doesn't matter.
    person_a = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="relationships_as_a")
    person_b = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="relationships_as_b")
    start_date = models.DateField(null=True, blank=True)   # marriage date, etc.
    end_date = models.DateField(null=True, blank=True)     # divorce/death
    is_biological = models.BooleanField(default=True)      # parent_child only

    class Meta:
        constraints = [
            models.CheckConstraint(check=~models.Q(person_a=models.F("person_b")), name="no_self_relationship"),
        ]


class PersonChangeLog(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="change_log")
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    diff = models.JSONField()  # {"field": [old, new], ...}
```

## Key business logic notes

- **Cycle prevention (PRD #15)**: before saving a `parent_child` Relationship,
  walk up from the proposed parent through existing `parent_child` edges — if
  the proposed child appears in that ancestor chain, reject the write. Do this
  in a model `clean()` / serializer `validate()`, not just in the frontend.
- **Deriving siblings**: given a Person, find all `parent_child` edges where
  they're `person_b`, collect the `person_a` set (their parents), then find all
  other People who share at least one parent in that set. Full sibling = both
  parents shared; half sibling = exactly one shared. Compute this on read, don't
  store it — it will drift out of sync with the underlying edges otherwise.
- **Privacy filtering (PRD #20)**: build this as a serializer-level concern —
  a `PersonSerializer` that takes the requesting user's role in the tree and
  strips `birth_date`, `photo`, contact fields when `is_living=True` and the
  requester is a Viewer (or anonymous, via a public link). Don't rely on the
  frontend to hide fields it already received.
- **Changelog (PRD #9)**: simplest correct approach is a `pre_save` signal on
  `Person` that diffs the incoming instance against the DB copy and writes a
  `PersonChangeLog` row. Keep it dumb (field-level diff) rather than building
  approval/revert in v1.

## API shape (DRF)

REST, scoped under a tree:

```
GET/POST   /api/trees/
GET/PATCH/DELETE /api/trees/{id}/
POST       /api/trees/{id}/invite/            {email, role}
GET/POST   /api/trees/{id}/people/
GET/PATCH  /api/trees/{id}/people/{id}/
GET        /api/trees/{id}/people/{id}/siblings/   # derived, computed
GET/POST   /api/trees/{id}/relationships/
DELETE     /api/trees/{id}/relationships/{id}/
```

Permission checks (Owner/Editor/Viewer) belong in a shared DRF permission
class checked against `TreeMembership`, applied consistently across all of the
above — don't scatter role checks inline in each view.

## Frontend notes

- `family-chart` expects a specific person/relationship JSON shape — write a
  thin adapter that transforms API responses into that shape rather than
  contorting the Django models to match the library.
- Tree view should lazy-load: fetch the requested person's immediate family
  first, expand outward on interaction, rather than pulling the whole tree for
  large families (NFR in PRD — 500+ people).
- Person detail panel calls the `/siblings/` (and equivalent grandparent/
  cousin) derived endpoints rather than recomputing the graph walk in the
  frontend.

## Dev conventions

- Match existing stack conventions: Django + DRF + PostgreSQL + Next.js +
  Docker, consistent with other projects in this workspace.
- Migrations: one migration per logical schema change, not squashed, so the
  cycle-prevention constraint and changelog table are each easy to trace later.
- Seed script: include a fixture that generates a multi-generation, multi-
  marriage test family (at minimum: 2 marriages for one person, one adopted
  child, one unknown-parent case) — the edge cases are the whole point of this
  data model and need to be exercised in dev, not discovered in production.
