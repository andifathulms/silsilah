from django.urls import path

from .views import (
    CommentViewSet,
    LifeEventViewSet,
    MediaItemViewSet,
    OnThisDayView,
    PersonViewSet,
    PublicShareView,
    RelationshipViewSet,
    ShareLinkViewSet,
)

person_list = PersonViewSet.as_view({"get": "list", "post": "create"})
person_detail = PersonViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "put": "update", "delete": "destroy"}
)
person_siblings = PersonViewSet.as_view({"get": "siblings"})
person_relatives = PersonViewSet.as_view({"get": "relatives"})
person_changelog = PersonViewSet.as_view({"get": "changelog"})
person_archive = PersonViewSet.as_view({"post": "archive"})
person_relationship = PersonViewSet.as_view({"get": "relationship_to"})

rel_list = RelationshipViewSet.as_view({"get": "list", "post": "create"})
rel_detail = RelationshipViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

media_list = MediaItemViewSet.as_view({"get": "list", "post": "create"})
media_detail = MediaItemViewSet.as_view({"delete": "destroy"})

event_list = LifeEventViewSet.as_view({"get": "list", "post": "create"})
event_detail = LifeEventViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

comment_list = CommentViewSet.as_view({"get": "list", "post": "create"})
comment_detail = CommentViewSet.as_view({"delete": "destroy"})

share_list = ShareLinkViewSet.as_view({"get": "list", "post": "create"})
share_detail = ShareLinkViewSet.as_view({"delete": "destroy"})

urlpatterns = [
    path("trees/<int:tree_id>/people/", person_list, name="person-list"),
    path("trees/<int:tree_id>/people/<int:pk>/", person_detail, name="person-detail"),
    path(
        "trees/<int:tree_id>/people/<int:pk>/siblings/",
        person_siblings,
        name="person-siblings",
    ),
    path(
        "trees/<int:tree_id>/people/<int:pk>/relatives/",
        person_relatives,
        name="person-relatives",
    ),
    path(
        "trees/<int:tree_id>/people/<int:pk>/changelog/",
        person_changelog,
        name="person-changelog",
    ),
    path(
        "trees/<int:tree_id>/people/<int:pk>/archive/",
        person_archive,
        name="person-archive",
    ),
    path(
        "trees/<int:tree_id>/people/<int:pk>/relationship-to/<int:other_id>/",
        person_relationship,
        name="person-relationship",
    ),
    path("trees/<int:tree_id>/relationships/", rel_list, name="relationship-list"),
    path(
        "trees/<int:tree_id>/relationships/<int:pk>/",
        rel_detail,
        name="relationship-detail",
    ),
    # Per-person media (life-event photos)
    path(
        "trees/<int:tree_id>/people/<int:person_id>/media/",
        media_list,
        name="media-list",
    ),
    path(
        "trees/<int:tree_id>/people/<int:person_id>/media/<int:pk>/",
        media_detail,
        name="media-detail",
    ),
    # Per-person life events (timeline)
    path(
        "trees/<int:tree_id>/people/<int:person_id>/events/",
        event_list,
        name="event-list",
    ),
    path(
        "trees/<int:tree_id>/people/<int:person_id>/events/<int:pk>/",
        event_detail,
        name="event-detail",
    ),
    # Comments / stories
    path(
        "trees/<int:tree_id>/people/<int:person_id>/comments/",
        comment_list,
        name="comment-list",
    ),
    path(
        "trees/<int:tree_id>/people/<int:person_id>/comments/<int:pk>/",
        comment_detail,
        name="comment-detail",
    ),
    # Owner-managed share links
    path("trees/<int:tree_id>/share-links/", share_list, name="sharelink-list"),
    path(
        "trees/<int:tree_id>/share-links/<int:pk>/",
        share_detail,
        name="sharelink-detail",
    ),
    # Family occasions
    path("trees/<int:tree_id>/on-this-day/", OnThisDayView.as_view(), name="on-this-day"),
    # Public, tokenized, anonymous read-only access
    path("share/<str:token>/", PublicShareView.as_view(), name="public-share"),
]
