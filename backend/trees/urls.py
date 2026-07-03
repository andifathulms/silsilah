from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    InvitationAcceptView,
    InvitationPreviewView,
    InvitationViewSet,
    TreeViewSet,
)

router = DefaultRouter()
router.register(r"trees", TreeViewSet, basename="tree")

invitation_list = InvitationViewSet.as_view({"get": "list", "post": "create"})
invitation_detail = InvitationViewSet.as_view({"delete": "destroy"})

urlpatterns = router.urls + [
    path(
        "trees/<int:tree_id>/invitations/",
        invitation_list,
        name="invitation-list",
    ),
    path(
        "trees/<int:tree_id>/invitations/<int:pk>/",
        invitation_detail,
        name="invitation-detail",
    ),
    path("invitations/<str:token>/", InvitationPreviewView.as_view(), name="invitation-preview"),
    path(
        "invitations/<str:token>/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
