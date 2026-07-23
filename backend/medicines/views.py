from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Medicine
from .serializers import MedicineSerializer


class MedicineViewSet(viewsets.ModelViewSet):

    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Medicine.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)