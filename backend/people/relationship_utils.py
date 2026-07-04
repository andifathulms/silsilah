"""Compute the relationship between two people.

The graph walk finds the closest common ancestor and classifies the pair. It
returns a *structured* descriptor (kind + generations up/down + gender) so the
frontend can compose a localized label; ``describe_relationship`` builds the
English label from that same structure for API consumers.
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


def _gender_code(gender):
    g = (gender or "").lower()
    if g.startswith("m"):
        return "M"
    if g.startswith("f") or g.startswith("w"):
        return "F"
    return ""


def _ancestor_depths(start_id, parent_map):
    """BFS upward: return {ancestor_id: min_depth}, including start at 0."""
    depths = {start_id: 0}
    frontier = [start_id]
    d = 0
    while frontier:
        d += 1
        nxt = []
        for pid in frontier:
            for parent in parent_map.get(pid, ()):
                if parent not in depths:
                    depths[parent] = d
                    nxt.append(parent)
        frontier = nxt
    return depths


def relationship_structure(person, other, tree_id):
    """Return {kind, up, down, gender} describing how `other` relates to
    `person`. `up` = generations from person to the common ancestor, `down` =
    from other to it. `kind` is one of: self, spouse, ancestor, descendant,
    sibling, pibling (aunt/uncle), nibling (niece/nephew), cousin, unrelated.
    """
    gender = _gender_code(other.gender)

    if person.id == other.id:
        return {"kind": "self", "up": 0, "down": 0, "gender": gender}

    is_spouse = Relationship.objects.filter(
        tree_id=tree_id, type=Relationship.TYPE_SPOUSE
    ).filter(
        Q(person_a=person, person_b=other) | Q(person_a=other, person_b=person)
    ).exists()
    if is_spouse:
        return {"kind": "spouse", "up": 0, "down": 0, "gender": gender}

    parent_map = {}
    for a_id, b_id in Relationship.objects.filter(
        tree_id=tree_id, type=Relationship.TYPE_PARENT_CHILD
    ).values_list("person_a_id", "person_b_id"):
        parent_map.setdefault(b_id, set()).add(a_id)

    da = _ancestor_depths(person.id, parent_map)
    db = _ancestor_depths(other.id, parent_map)
    common = set(da) & set(db)
    if not common:
        return {"kind": "unrelated", "up": 0, "down": 0, "gender": gender}

    c = min(common, key=lambda x: (da[x] + db[x], max(da[x], db[x])))
    dp, do = da[c], db[c]

    if dp == 0:
        kind = "descendant"
    elif do == 0:
        kind = "ancestor"
    elif dp == 1 and do == 1:
        kind = "sibling"
    elif do == 1:
        kind = "pibling"
    elif dp == 1:
        kind = "nibling"
    else:
        kind = "cousin"
    return {"kind": kind, "up": dp, "down": do, "gender": gender}


def _by_gender(g, male, female, neutral):
    return male if g == "M" else female if g == "F" else neutral


def describe_relationship(person, other, tree_id):
    """English label for `other` relative to `person` (built from structure)."""
    s = relationship_structure(person, other, tree_id)
    kind, up, down, g = s["kind"], s["up"], s["down"], s["gender"]

    if kind == "self":
        return "the same person"
    if kind == "unrelated":
        return "not directly related by blood"
    if kind == "spouse":
        return _by_gender(g, "husband", "wife", "spouse")
    if kind == "descendant":
        if down == 1:
            return _by_gender(g, "son", "daughter", "child")
        if down == 2:
            return _by_gender(g, "grandson", "granddaughter", "grandchild")
        return _greats(down - 1) + _by_gender(g, "grandson", "granddaughter", "grandchild")
    if kind == "ancestor":
        if up == 1:
            return _by_gender(g, "father", "mother", "parent")
        if up == 2:
            return _by_gender(g, "grandfather", "grandmother", "grandparent")
        return _greats(up - 1) + _by_gender(g, "grandfather", "grandmother", "grandparent")
    if kind == "sibling":
        return _by_gender(g, "brother", "sister", "sibling")
    if kind == "pibling":
        base = _by_gender(g, "uncle", "aunt", "aunt or uncle")
        if up >= 3:
            return (_greats(up - 2) + "grand" + base) if up >= 4 else "grand" + base
        return base
    if kind == "nibling":
        base = _by_gender(g, "nephew", "niece", "niece or nephew")
        if down >= 3:
            return (_greats(down - 2) + "grand" + base) if down >= 4 else "grand" + base
        return base
    # cousin
    degree = min(up, down) - 1
    removal = abs(up - down)
    label = f"{_ordinal(degree)} cousin"
    if removal == 1:
        label += " once removed"
    elif removal == 2:
        label += " twice removed"
    elif removal >= 3:
        label += f" {removal} times removed"
    return label
