from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReminderViewSet, NotificationLogViewSet

router = DefaultRouter()

# IMPORTANT: register "notification-logs" BEFORE the empty-prefix
# ReminderViewSet. The ReminderViewSet detail route is
# ^(?P<pk>[^/.]+)/$ — with an empty prefix it would otherwise capture
# "notification-logs" as a pk and return 404 for
# /api/reminders/notification-logs/.
router.register(
    r"notification-logs", NotificationLogViewSet, basename="notification-log"
)
router.register(r"", ReminderViewSet, basename="reminder")

urlpatterns = [
    path("", include(router.urls)),
]
