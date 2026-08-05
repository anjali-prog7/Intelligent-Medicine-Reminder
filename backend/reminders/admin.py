from django.contrib import admin
from .models import Reminder, NotificationLog


class ReminderAdmin(admin.ModelAdmin):
    list_display = ["medicine", "user", "reminder_date", "reminder_time", "status", "notification_sent"]
    list_filter = ["status", "is_recurring"]
    search_fields = ["medicine__medicine_name", "user__username"]


class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ["channel", "reminder", "user", "status", "sent_at"]
    list_filter = ["channel", "status"]
    search_fields = ["user__username", "recipient"]


admin.site.register(Reminder, ReminderAdmin)
admin.site.register(NotificationLog, NotificationLogAdmin)
