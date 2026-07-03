from django.urls import path

from .views import (
    MediaItemViewSet,
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

rel_list = RelationshipViewSet.as_view({"get": "list", "post": "create"})
rel_detail = RelationshipViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

media_list = MediaItemViewSet.as_view({"get": "list", "post": "create"})
media_detail = MediaItemViewSet.as_view({"delete": "destroy"})

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
    # Owner-managed share links
    path("trees/<int:tree_id>/share-links/", share_list, name="sharelink-list"),
    path(
        "trees/<int:tree_id>/share-links/<int:pk>/",
        share_detail,
        name="sharelink-detail",
    ),
    # Public, tokenized, anonymous read-only access
    path("share/<str:token>/", PublicShareView.as_view(), name="public-share"),
]
