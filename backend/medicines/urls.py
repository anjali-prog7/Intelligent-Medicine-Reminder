from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MedicineViewSet
from .ocr_views import upload_prescription, ocr_health_check

router = DefaultRouter()
router.register(r"", MedicineViewSet, basename="medicine")

urlpatterns = [
    path("", include(router.urls)),

    # OCR Prescription Upload
    path("prescription/upload/", upload_prescription, name="prescription-upload"),
    path("prescription/health/", ocr_health_check, name="ocr-health-check"),
]