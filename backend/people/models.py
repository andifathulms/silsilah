from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from trees.models import Tree


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

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    # --- Derived relationship queries -----------------------------------
    # These are always computed on read (never stored) so they can't drift
    # out of sync with the underlying Relationship edges.

    def parents(self):
        parent_ids = self.relationships_as_b.filter(
            type=Relationship.TYPE_PARENT_CHILD
        ).values_list("person_a_id", flat=True)
        return Person.objects.filter(pk__in=parent_ids)

    def children(self):
        child_ids = self.relationships_as_a.filter(
            type=Relationship.TYPE_PARENT_CHILD
        ).values_list("person_b_id", flat=True)
        return Person.objects.filter(pk__in=child_ids)

    def spouses(self):
        as_a = self.relationships_as_a.filter(
            type=Relationship.TYPE_SPOUSE
        ).values_list("person_b_id", flat=True)
        as_b = self.relationships_as_b.filter(
            type=Relationship.TYPE_SPOUSE
        ).values_list("person_a_id", flat=True)
        return Person.objects.filter(pk__in=set(as_a) | set(as_b))

    def siblings(self):
        """Return (full_siblings, half_siblings) querysets.

        A sibling shares at least one parent. Full = both parents shared,
        half = exactly one shared. Computed from parent_child edges.
        """
        my_parent_ids = set(self.parents().values_list("id", flat=True))
        if not my_parent_ids:
            return Person.objects.none(), Person.objects.none()

        candidate_ids = set(
            Relationship.objects.filter(
                type=Relationship.TYPE_PARENT_CHILD,
                person_a_id__in=my_parent_ids,
            )
            .exclude(person_b_id=self.id)
            .values_list("person_b_id", flat=True)
        )

        full, half = [], []
        for person in Person.objects.filter(pk__in=candidate_ids):
            their_parent_ids = set(person.parents().values_list("id", flat=True))
            shared = my_parent_ids & their_parent_ids
            if len(shared) >= 2 and len(my_parent_ids) >= 2:
                full.append(person.id)
            elif shared:
                half.append(person.id)
        return (
            Person.objects.filter(pk__in=full),
            Person.objects.filter(pk__in=half),
        )

    def grandparents(self):
        grandparent_ids = set()
        for parent in self.parents():
            grandparent_ids.update(parent.parents().values_list("id", flat=True))
        return Person.objects.filter(pk__in=grandparent_ids)


class Relationship(models.Model):
    TYPE_PARENT_CHILD = "parent_child"
    TYPE_SPOUSE = "spouse"
    TYPE_CHOICES = [
        (TYPE_PARENT_CHILD, "Parent-child"),
        (TYPE_SPOUSE, "Spouse"),
    ]
    tree = models.ForeignKey(
        Tree, on_delete=models.CASCADE, related_name="relationships"
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    # parent_child: person_a = parent, person_b = child.
    # spouse: order doesn't matter.
    person_a = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="relationships_as_a"
    )
    person_b = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="relationships_as_b"
    )
    start_date = models.DateField(null=True, blank=True)  # marriage date, etc.
    end_date = models.DateField(null=True, blank=True)  # divorce/death
    is_biological = models.BooleanField(default=True)  # parent_child only

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~models.Q(person_a=models.F("person_b")),
                name="no_self_relationship",
            ),
        ]

    def __str__(self):
        return f"{self.person_a} -[{self.type}]-> {self.person_b}"

    def clean(self):
        if self.person_a_id == self.person_b_id:
            raise ValidationError("A person cannot relate to themselves.")

        if self.person_a.tree_id != self.person_b.tree_id:
            raise ValidationError("Both people must belong to the same tree.")

        if self.tree_id and self.tree_id != self.person_a.tree_id:
            raise ValidationError("Relationship tree must match the people's tree.")

        if self.type == self.TYPE_PARENT_CHILD:
            self._validate_no_cycle()

    def _validate_no_cycle(self):
        """Reject a parent_child edge that would make a person their own
        ancestor. Walk up from the proposed parent through existing
        parent_child edges; if the proposed child appears in that ancestor
        chain, the edge closes a cycle.
        """
        proposed_parent = self.person_a_id
        proposed_child = self.person_b_id

        if proposed_parent == proposed_child:
            raise ValidationError("A person cannot be their own parent.")

        # Ancestors of the proposed parent (including itself). If the child is
        # already an ancestor of the parent, adding parent->child loops.
        visited = set()
        frontier = {proposed_parent}
        while frontier:
            current = frontier.pop()
            if current in visited:
                continue
            visited.add(current)
            if current == proposed_child:
                raise ValidationError(
                    "This relationship would create a cycle "
                    "(a person cannot be their own ancestor)."
                )
            parent_ids = Relationship.objects.filter(
                type=self.TYPE_PARENT_CHILD, person_b_id=current
            ).values_list("person_a_id", flat=True)
            frontier.update(parent_ids)

    def save(self, *args, **kwargs):
        self.full_clean(exclude=None, validate_unique=False)
        super().save(*args, **kwargs)


class PersonChangeLog(models.Model):
    person = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="change_log"
    )
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    diff = models.JSONField()  # {"field": [old, new], ...}

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self):
        return f"Change to {self.person} at {self.changed_at}"
