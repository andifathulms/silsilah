# Silsilah — Product Requirements Document

> Working name: "Silsilah" (Indonesian for lineage/genealogy). Rename freely.

## 1. Overview

Silsilah is a multi-user platform where anyone can create a family tree, add people
and relationships (parent-child, spouse), invite relatives to view or contribute,
and see the result rendered as an interactive family tree.

v1 is intentionally scoped to **one tree, contributed to by an invited group** — not
a global genealogy database. Cross-tree discovery and merging (two trees turning out
to share an ancestor) is a deliberate v2+ feature, not v1. Building that well requires
duplicate-person detection and conflict resolution that would otherwise stall v1.

## 2. Problem & Goals

Families lose track of lineage — who's related to whom, especially across
generations, remarriages, and branches that live in different cities or countries.
Existing tools (paper charts, WhatsApp group photos of trees) don't scale past a
few dozen people and can't be collaboratively maintained.

Goals for v1:
- A person can create a tree and add family members without needing to understand
  a rigid template (nuclear family only, etc.)
- Multiple relatives can be invited to view and contribute to the same tree
- The tree renders as a legible, interactive diagram — not just a list
- Real family shapes are supported: divorce, remarriage, adoption, unknown parent,
  half-siblings
- Living people's personal data is private by default

Non-goals for v1: public genealogy discovery, DNA/matching, merging independent
trees, GEDCOM import/export (candidate for v1.1 if cheap to add).

## 3. Users & Roles

- **Owner** — created the tree. Full control: edit anyone, manage members, delete tree.
- **Editor** — invited contributor. Can add/edit people and relationships. Cannot
  delete the tree or remove other members.
- **Viewer** — invited to see the tree, read-only.

A user can belong to multiple trees (their own family, their spouse's family, etc.)
with a different role in each.

Edits from Editors to existing people/relationships should be visible as a change
(who changed what, when) rather than a silent overwrite — family data is often
contested ("I thought grandpa was born in 1955, not 1953"). v1 can keep this simple:
a changelog per person is enough; a full approval workflow is v2.

## 4. Core Concepts / Data Model

Two entities carry almost everything:

- **Person** — an individual. name, gender, birth date, death date (nullable),
  is_living (bool), photo, free-text bio/notes, belongs to a Tree.
- **Relationship** — an edge between two Persons. type is `parent_child` or
  `spouse`. For `parent_child`, person_a is the parent, person_b is the child.
  For `spouse`, order doesn't matter. Optional: start_date, end_date (marriage/
  divorce), is_biological / is_adoptive (for parent_child).

Everything else is derived, not stored:
- **Siblings** — two Persons who share at least one parent via `parent_child` edges.
  Full vs half sibling is computed from how many parents are shared.
- **Grandparents, cousins, aunts/uncles** — computed by walking the relationship
  graph outward from a Person.

A **Tree** groups a set of People and Relationships and owns membership/roles.
A Person belongs to exactly one Tree in v1 (no shared people across trees yet —
that's the merging problem, deferred).

## 5. Functional Requirements

### Auth & account
1. Users sign up / log in with email (password or OAuth — implementer's choice).
2. A user can belong to multiple trees with independent roles per tree.

### Tree management
3. A user can create a new tree, becoming its Owner.
4. Owner can invite others by email/link, assigning Editor or Viewer role.
5. Owner can change a member's role or remove them.
6. Owner can rename or delete the tree (delete requires confirmation).

### Person management
7. Editor+ can add a Person with: name, gender, birth date, death date, is_living,
   photo, notes.
8. Editor+ can edit or archive (soft-delete) a Person.
9. Every edit to a Person is recorded with who made it and when (simple changelog,
   visible to Editor+).
10. Adding a Person does not require specifying any relationship — a person can
    exist standalone and be connected later.

### Relationship management
11. Editor+ can create a `parent_child` relationship between two existing People,
    or between a new Person and an existing one in a single flow.
12. Editor+ can create a `spouse` relationship, with optional start/end dates.
13. A Person can have more than one spouse relationship over time (remarriage).
14. A Person can have zero, one, or two `parent_child` edges pointing to them as
    child (supports unknown-parent cases).
15. The system prevents relationship cycles (a person cannot be their own
    ancestor) — validated on write.
16. Deleting a Relationship does not delete the People it connected.

### Tree visualization
17. The tree renders as an interactive diagram: pan/zoom, click a person to see
    their detail panel, expand/collapse branches.
18. From any Person, the view can be re-centered on them (useful for large trees —
    "show me my branch").
19. Siblings, grandparents, and other derived relationships are shown in the
    detail panel without requiring the user to manually trace edges.

### Privacy
20. A Person marked `is_living = true` has birth date, contact info, and photo
    hidden from Viewers by default; only Editor+ within the same tree see full
    detail.
21. Owner can mark the whole tree as private (invite-only) or shareable via a
    read-only link.

### Media
22. Photos can be attached to a Person (profile photo) and optionally to specific
    life events/notes.

## 6. Non-Functional Requirements

- Trees should stay responsive up to at least ~500 people without a full page
  reload; virtualize/lazy-load branches if needed rather than rendering
  everything at once.
- All write operations (person/relationship create-edit-delete) are logged with
  actor + timestamp for the changelog requirement (#9).
- Mobile-usable for viewing at minimum; editing can be desktop-first for v1.

## 7. Out of Scope (v1)

- Cross-tree linking/merging and duplicate-person detection
- Public search/discovery of trees or people
- DNA matching or integration with DNA services
- GEDCOM import/export
- Approval workflow for edits (changelog only, no revert/approve UI)
- Real-time collaborative editing (last-write-wins is acceptable for v1)

## 8. Success Metrics

- A new user can create a tree and add 10 people with correct relationships in
  under 10 minutes without documentation.
- Invited relatives actually contribute (measure: % of invited members who add
  or edit at least one Person within 30 days).
- Tree renders and stays legible at 100+ people without manual layout fiddling.

## 9. Open Questions

- OAuth providers to support, or email/password only for v1?
- Read-only public share links: full tree or a single branch only?
- Should archived (soft-deleted) People still count toward other people's
  sibling/ancestor computations, or are they fully excluded?
