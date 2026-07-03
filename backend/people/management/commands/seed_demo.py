"""Seed a multi-generation, multi-marriage demo family.

Exercises the edge cases the data model exists for (CLAUDE.md):
  - one person with two marriages (remarriage)
  - one adopted (non-biological) child
  - one unknown-parent case (a person with zero parent edges)
  - full vs half siblings across the two marriages

Idempotent-ish: pass --fresh to wipe the demo tree and rebuild.

Usage:
    python manage.py seed_demo [--fresh]
Login for the created owner:  demo / demopass123
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from people.models import Person, Relationship
from trees.models import Tree, TreeMembership

DEMO_TREE_NAME = "Demo Family"


class Command(BaseCommand):
    help = "Seed a multi-generation, multi-marriage demo family tree."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fresh",
            action="store_true",
            help="Delete any existing demo tree first and rebuild.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        owner, created = User.objects.get_or_create(
            username="demo", defaults={"email": "demo@example.com"}
        )
        if created:
            owner.set_password("demopass123")
            owner.save()
            self.stdout.write(self.style.SUCCESS("Created user 'demo' / demopass123"))

        editor, _ = User.objects.get_or_create(
            username="editor", defaults={"email": "editor@example.com"}
        )
        if not editor.has_usable_password():
            editor.set_password("editorpass123")
            editor.save()

        if options["fresh"]:
            Tree.objects.filter(name=DEMO_TREE_NAME, owner=owner).delete()

        if Tree.objects.filter(name=DEMO_TREE_NAME, owner=owner).exists():
            self.stdout.write(
                self.style.WARNING(
                    "Demo tree already exists. Pass --fresh to rebuild."
                )
            )
            return

        tree = Tree.objects.create(
            name=DEMO_TREE_NAME, owner=owner, is_public_link_enabled=False
        )
        TreeMembership.objects.create(tree=tree, user=owner, role="owner")
        TreeMembership.objects.create(tree=tree, user=editor, role="editor")

        def person(name, **kwargs):
            p = Person(tree=tree, name=name, **kwargs)
            p._changed_by = owner
            p.save()
            return p

        def parent_child(parent, child, biological=True):
            return Relationship.objects.create(
                tree=tree,
                type="parent_child",
                person_a=parent,
                person_b=child,
                is_biological=biological,
            )

        def spouse(a, b, start=None, end=None):
            return Relationship.objects.create(
                tree=tree,
                type="spouse",
                person_a=a,
                person_b=b,
                start_date=start,
                end_date=end,
            )

        # --- Generation 1: grandparents -----------------------------------
        grandpa = person("Bapak Rahman", gender="male", is_living=False,
                         birth_date="1940-03-12", death_date="2015-06-01")
        grandma = person("Ibu Siti", gender="female", is_living=False,
                        birth_date="1943-08-22", death_date="2020-01-15")
        spouse(grandpa, grandma, start="1962-05-01")

        # --- Generation 2: their children ---------------------------------
        # Ahmad remarries → two marriages (edge case #1).
        ahmad = person("Ahmad Rahman", gender="male", birth_date="1965-11-02")
        parent_child(grandpa, ahmad)
        parent_child(grandma, ahmad)

        siti_aunt = person("Dewi Rahman", gender="female", birth_date="1968-04-19")
        parent_child(grandpa, siti_aunt)
        parent_child(grandma, siti_aunt)

        # Ahmad's first wife (divorced) and second wife.
        wife1 = person("Nadia", gender="female", birth_date="1967-02-10")
        wife2 = person("Rina", gender="female", birth_date="1972-09-30")
        spouse(ahmad, wife1, start="1990-06-01", end="2001-03-15")
        spouse(ahmad, wife2, start="2003-07-20")

        # --- Generation 3: children across the two marriages --------------
        # With wife1: Budi and Citra (full siblings to each other).
        budi = person("Budi", gender="male", birth_date="1992-01-05")
        citra = person("Citra", gender="female", birth_date="1994-10-11")
        for kid in (budi, citra):
            parent_child(ahmad, kid)
            parent_child(wife1, kid)

        # With wife2: Eka — half sibling to Budi/Citra (shares only Ahmad).
        eka = person("Eka", gender="female", birth_date="2005-12-01")
        parent_child(ahmad, eka)
        parent_child(wife2, eka)

        # Adopted child of Ahmad + wife2 (edge case #2: non-biological).
        fajar = person("Fajar", gender="male", birth_date="2008-05-14")
        parent_child(ahmad, fajar, biological=False)
        parent_child(wife2, fajar, biological=False)

        # Unknown-parent case (edge case #3): a person with no parent edges,
        # married into the family.
        gita = person("Gita", gender="female", birth_date="1993-07-07")
        spouse(budi, gita, start="2018-11-11")

        # Great-grandchild to give depth.
        hana = person("Hana", gender="female", birth_date="2020-02-20")
        parent_child(budi, hana)
        parent_child(gita, hana)

        self.stdout.write(self.style.SUCCESS(
            f"Seeded '{tree.name}' (id={tree.id}) with "
            f"{tree.people.count()} people and {tree.relationships.count()} relationships."
        ))
        self.stdout.write(
            "  - Ahmad has two marriages (Nadia divorced, Rina current)\n"
            "  - Eka is a half-sibling of Budi/Citra\n"
            "  - Fajar is adopted (is_biological=False)\n"
            "  - Gita has unknown parents (married in)\n"
            "Owner login: demo / demopass123    Editor login: editor / editorpass123"
        )
