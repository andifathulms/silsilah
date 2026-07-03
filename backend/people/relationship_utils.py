"""Compute a human-readable relationship label between two people.

Uses the parent_child edges to find the closest common ancestor and classify
the pair (parent, cousin, aunt/uncle, N-times-removed, …). Spouse edges are
checked first for the direct-marriage case.
"""
from django.db.models import Q

from .models import Relationship


def _ordinal(n):
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _greats(n):
    """n=1 -> '', n=2 -> 'great-', n=3 -> 'great-great-', ..."""
    return "great-" * (n - 1)


def _by_gender(gender, male, female, neutral):
    g = (gender or "").lower()
    if g.startswith("m"):
        return male
    if g.startswith("f") or g.startswith("w"):
        return female
    return neutral


def _ancestor_depths(start_id, parent_map):
    """BFS upward: return {ancestor_id: min_depth}, including start at 0."""
    depths = {start_id: 0}
    frontier = [start_id]
    d = 0
    while frontier:
        d += 1
        nxt = []
        for pid in frontier:
            for parent in parent_map.get(pid, ()):  # parents of pid
                if parent not in depths:
                    depths[parent] = d
                    nxt.append(parent)
        frontier = nxt
    return depths


def describe_relationship(person, other, tree_id):
    """Return a string describing how `other` is related to `person`."""
    if person.id == other.id:
        return "the same person"

    # Direct spouse?
    is_spouse = Relationship.objects.filter(
        tree_id=tree_id, type=Relationship.TYPE_SPOUSE
    ).filter(
        Q(person_a=person, person_b=other) | Q(person_a=other, person_b=person)
    ).exists()
    if is_spouse:
        return _by_gender(other.gender, "husband", "wife", "spouse")

    # Build parent map for the whole tree.
    parent_map = {}
    for a_id, b_id in Relationship.objects.filter(
        tree_id=tree_id, type=Relationship.TYPE_PARENT_CHILD
    ).values_list("person_a_id", "person_b_id"):
        parent_map.setdefault(b_id, set()).add(a_id)  # child -> parents

    da = _ancestor_depths(person.id, parent_map)
    db = _ancestor_depths(other.id, parent_map)

    common = set(da) & set(db)
    if not common:
        return "not directly related by blood"

    # Closest common ancestor: minimize combined distance.
    c = min(common, key=lambda x: (da[x] + db[x], max(da[x], db[x])))
    dp, do = da[c], db[c]  # dp = person→ancestor, do = other→ancestor

    # other is a direct descendant of person (person is the ancestor)
    if dp == 0:
        if do == 1:
            return _by_gender(other.gender, "son", "daughter", "child")
        if do == 2:
            return _by_gender(other.gender, "grandson", "granddaughter", "grandchild")
        return _greats(do - 1) + _by_gender(
            other.gender, "grandson", "granddaughter", "grandchild"
        )

    # other is a direct ancestor of person
    if do == 0:
        if dp == 1:
            return _by_gender(other.gender, "father", "mother", "parent")
        if dp == 2:
            return _by_gender(other.gender, "grandfather", "grandmother", "grandparent")
        return _greats(dp - 1) + _by_gender(
            other.gender, "grandfather", "grandmother", "grandparent"
        )

    # Siblings
    if dp == 1 and do == 1:
        return _by_gender(other.gender, "brother", "sister", "sibling")

    # Aunt/uncle (other is a sibling of an ancestor of person)
    if do == 1:
        base = _by_gender(other.gender, "uncle", "aunt", "aunt or uncle")
        return _greats(dp - 2) + ("grand" + base if dp >= 3 else base) if dp >= 3 else base

    # Niece/nephew (other is a descendant of person's sibling)
    if dp == 1:
        base = _by_gender(other.gender, "nephew", "niece", "niece or nephew")
        return _greats(do - 2) + ("grand" + base if do >= 3 else base) if do >= 3 else base

    # Cousins: degree = min - 1, removal = |dp - do|
    degree = min(dp, do) - 1
    removal = abs(dp - do)
    label = f"{_ordinal(degree)} cousin"
    if removal == 1:
        label += " once removed"
    elif removal == 2:
        label += " twice removed"
    elif removal >= 3:
        label += f" {removal} times removed"
    return label
