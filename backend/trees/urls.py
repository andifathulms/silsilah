from rest_framework.routers import DefaultRouter

from .views import TreeViewSet

router = DefaultRouter()
router.register(r"trees", TreeViewSet, basename="tree")

urlpatterns = router.urls
