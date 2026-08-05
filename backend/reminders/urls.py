from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReminderViewSet, NotificationLogViewSet

router = DefaultRouter()
router.register(r"", ReminderViewSet, basename="reminder")
router.register(r"notification-logs", NotificationLogViewSet, basename="notification-log")

urlpatterns = [
    path("", include(router.urls)),
]
