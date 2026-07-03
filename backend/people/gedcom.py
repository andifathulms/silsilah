"""Minimal GEDCOM 5.5.1 import/export.

Covers the common subset used to move a tree between apps: INDI (name, sex,
birth, death) and FAM (husband, wife, children). Round-trips the fields
Silsilah stores; richer GEDCOM tags are ignored on import.
"""
import datetime

from django.db import transaction

from .models import Person, Relationship

_MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}
_MONTH_NAMES = {v: k for k, v in _MONTHS.items()}


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------
def _split_name(name):
    parts = name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def _ged_date(d):
    return f"{d.day} {_MONTH_NAMES[d.month]} {d.year}"


def export_gedcom(tree):
    people = list(tree.people.filter(is_archived=False))
    people_ids = {p.id for p in people}
    rels = list(tree.relationships.all())

    # Build family structures.
    child_parents = {}      # child_id -> set(parent_ids)
    spouse_pairs = set()    # frozenset(a, b)
    for r in rels:
        if r.type == Relationship.TYPE_PARENT_CHILD:
            if r.person_a_id in people_ids and r.person_b_id in people_ids:
                child_parents.setdefault(r.person_b_id, set()).add(r.person_a_id)
        elif r.type == Relationship.TYPE_SPOUSE:
            if r.person_a_id in people_ids and r.person_b_id in people_ids:
                spouse_pairs.add(frozenset((r.person_a_id, r.person_b_id)))

    fam_children = {}       # family_key -> [child_ids]
    for child, parents in child_parents.items():
        fam_children.setdefault(frozenset(parents), []).append(child)

    fam_keys = list(set(fam_children.keys()) | spouse_pairs)
    fam_id = {key: i + 1 for i, key in enumerate(fam_keys)}

    person_fams = {}        # pid -> [family ids] (as spouse/parent)
    person_famc = {}        # pid -> family id (as child)
    for key in fam_keys:
        for pid in key:
            person_fams.setdefault(pid, []).append(fam_id[key])
    for child, parents in child_parents.items():
        person_famc[child] = fam_id[frozenset(parents)]

    people_by_id = {p.id: p for p in people}
    lines = [
        "0 HEAD",
        "1 SOUR Silsilah",
        "1 GEDC",
        "2 VERS 5.5.1",
        "2 FORM LINEAGE-LINKED",
        "1 CHAR UTF-8",
    ]

    for p in people:
        given, surname = _split_name(p.name)
        lines.append(f"0 @I{p.id}@ INDI")
        lines.append(f"1 NAME {given} /{surname}/")
        g = (p.gender or "").lower()
        if g.startswith("m"):
            lines.append("1 SEX M")
        elif g.startswith("f") or g.startswith("w"):
            lines.append("1 SEX F")
        if p.birth_date:
            lines.append("1 BIRT")
            lines.append(f"2 DATE {_ged_date(p.birth_date)}")
        if p.death_date:
            lines.append("1 DEAT")
            lines.append(f"2 DATE {_ged_date(p.death_date)}")
        for fid in person_fams.get(p.id, []):
            lines.append(f"1 FAMS @F{fid}@")
        if p.id in person_famc:
            lines.append(f"1 FAMC @F{person_famc[p.id]}@")

    for key in fam_keys:
        fid = fam_id[key]
        lines.append(f"0 @F{fid}@ FAM")
        husb = wife = None
        others = []
        for pid in key:
            g = (people_by_id[pid].gender or "").lower()
            if g.startswith("m") and husb is None:
                husb = pid
            elif (g.startswith("f") or g.startswith("w")) and wife is None:
                wife = pid
            else:
                others.append(pid)
        # Fill unknown-gender parents into free slots.
        for pid in others:
            if husb is None:
                husb = pid
            elif wife is None:
                wife = pid
        if husb:
            lines.append(f"1 HUSB @I{husb}@")
        if wife:
            lines.append(f"1 WIFE @I{wife}@")
        for child in fam_children.get(key, []):
            lines.append(f"1 CHIL @I{child}@")

    lines.append("0 TRLR")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------
def _parse_date(value):
    day = month = year = None
    for tok in value.replace(",", " ").split():
        t = tok.upper()
        if t.isdigit():
            if len(t) == 4:
                year = int(t)
            elif len(t) <= 2:
                day = int(t)
        elif t in _MONTHS:
            month = _MONTHS[t]
    if year:
        try:
            return datetime.date(year, month or 1, day or 1)
        except ValueError:
            return datetime.date(year, 1, 1)
    return None


def _parse_records(text):
    indis = {}   # xref -> dict
    fams = {}    # xref -> dict
    current = None       # (kind, dict)
    sub = None           # 'BIRT' | 'DEAT' | None

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(" ", 2)
        try:
            level = int(parts[0])
        except ValueError:
            continue
        tag = parts[1] if len(parts) > 1 else ""
        value = parts[2] if len(parts) > 2 else ""

        if level == 0:
            sub = None
            if value == "INDI":
                current = ("INDI", {"name": "", "sex": "", "birth": None, "death": None})
                indis[tag] = current[1]
            elif value == "FAM":
                current = ("FAM", {"husb": None, "wife": None, "chil": []})
                fams[tag] = current[1]
            else:
                current = None
        elif current and current[0] == "INDI":
            rec = current[1]
            if level == 1:
                sub = tag
                if tag == "NAME":
                    rec["name"] = value.replace("/", " ").strip()
                elif tag == "SEX":
                    rec["sex"] = value.strip()
            elif level == 2 and tag == "DATE":
                d = _parse_date(value)
                if sub == "BIRT":
                    rec["birth"] = d
                elif sub == "DEAT":
                    rec["death"] = d
        elif current and current[0] == "FAM":
            rec = current[1]
            if level == 1:
                if tag == "HUSB":
                    rec["husb"] = value.strip()
                elif tag == "WIFE":
                    rec["wife"] = value.strip()
                elif tag == "CHIL":
                    rec["chil"].append(value.strip())

    return indis, fams


@transaction.atomic
def import_gedcom(tree, text, user=None):
    indis, fams = _parse_records(text)

    xref_to_person = {}
    for xref, rec in indis.items():
        gender = "male" if rec["sex"].upper() == "M" else "female" if rec["sex"].upper() == "F" else ""
        person = Person(
            tree=tree,
            name=rec["name"] or "Unknown",
            gender=gender,
            birth_date=rec["birth"],
            death_date=rec["death"],
            is_living=rec["death"] is None,
        )
        if user:
            person._changed_by = user
        person.save()
        xref_to_person[xref] = person

    rel_created = 0
    skipped = 0
    for rec in fams.values():
        parents = [xref_to_person[x] for x in (rec["husb"], rec["wife"]) if x in xref_to_person]
        if len(parents) == 2:
            try:
                Relationship.objects.create(
                    tree=tree, type=Relationship.TYPE_SPOUSE,
                    person_a=parents[0], person_b=parents[1],
                )
                rel_created += 1
            except Exception:
                skipped += 1
        for child_xref in rec["chil"]:
            child = xref_to_person.get(child_xref)
            if not child:
                continue
            for parent in parents:
                try:
                    Relationship.objects.create(
                        tree=tree, type=Relationship.TYPE_PARENT_CHILD,
                        person_a=parent, person_b=child,
                    )
                    rel_created += 1
                except Exception:
                    skipped += 1

    return {
        "people_imported": len(xref_to_person),
        "relationships_imported": rel_created,
        "skipped": skipped,
    }
