from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.core.mail import send_mail
from django.conf import settings

from .models import Reminder
from .serializers import ReminderSerializer


class ReminderViewSet(viewsets.ModelViewSet):

    queryset = Reminder.objects.all()
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        print("USER =", request.user)
        print("DATA =", request.data)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):

        reminder = serializer.save(user=self.request.user)

        send_mail(
            subject="💊 PillSync Reminder",

            message=f"""
Your medicine reminder has been created successfully.

Medicine : {reminder.medicine.medicine_name}
Date : {reminder.reminder_date}
Time : {reminder.reminder_time}

Thank you for using PillSync.
""",

            from_email=settings.DEFAULT_FROM_EMAIL,

            recipient_list=[
                self.request.user.email
            ],

            fail_silently=False,
        )