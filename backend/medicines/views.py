import logging
import re

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Medicine
from .serializers import MedicineSerializer
from .ai_validator import get_validation_service

logger = logging.getLogger(__name__)


def _normalize(value: str) -> str:
    """Strip leading/trailing whitespace and collapse internal whitespace.

    "  150   mg " -> "150 mg"
    "Morning  "   -> "Morning"
    "  ACILOC "   -> "ACILOC"
    """
    return re.sub(r"\s+", " ", value.strip())


class MedicineViewSet(viewsets.ModelViewSet):

    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Medicine.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """
        Override create to validate the medicine name using the
        validation pipeline before persisting the record.

        Pipeline:
            1. Normalize input
            2. AI Assistance (optional - typo correction)
            3. Drug Database Validation (authoritative - RxNorm, OpenFDA)
            4. Duplicate Check
            5. Save

        AI is OPTIONAL and NEVER blocks medicine creation.
        Drug databases are the PRIMARY authority.

        Manual entry (source="manual") is the exception:
            Manual input ALWAYS has the highest priority. The medicine name,
            dosage and frequency are saved EXACTLY as the user entered them.
            No AI correction, no normalization, no replacement.
        """
        medicine_name = request.data.get("medicine_name", "")

        # -- MANUAL ENTRY: save exactly what the user entered ---------------
        # Never auto-correct, never replace, never normalize. This is a
        # deliberate bypass of the validation pipeline so that e.g. "Digene"
        # is never rewritten to "Pinus digenea leaf oil".
        #
        # NOTE: `source=manual` is an intentional, auth-gated escape hatch
        # (only reachable by authenticated users). It intentionally skips the
        # AI / drug-database validation pipeline because manual input always
        # has highest priority. A lightweight EXACT-name duplicate check is
        # kept so accidental re-entries of the same name are still caught.
        source = request.data.get("source", "")
        if source == "manual":
            if not medicine_name or not str(medicine_name).strip():
                return Response(
                    {"success": False, "message": "Medicine name is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Duplicate check: same user + name + dosage + frequency
            # (mirrors the validated/OCR path so both flows are consistent).
            # The name itself is still saved EXACTLY as entered — only the
            # duplicate lookup uses a stripped comparison.
            duplicate_qs = Medicine.objects.filter(
                user=request.user,
                medicine_name__iexact=str(medicine_name).strip(),
                dosage__iexact=str(request.data.get("dosage", "")).strip(),
                frequency__iexact=str(request.data.get("frequency", "")).strip(),
            )
            if duplicate_qs.exists():
                return Response(
                    {
                        "success": False,
                        "message": "This medicine with the same dosage and schedule already exists.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            logger.info(
                "Medicine SAVED (manual, exact): user=%s, medicine='%s', "
                "dosage='%s', frequency='%s'",
                request.user.username,
                medicine_name,
                request.data.get("dosage", ""),
                request.data.get("frequency", ""),
            )
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
                headers=headers,
            )

        # -- OCR / validated flow -------------------------------------------
        if not medicine_name or not medicine_name.strip():
            return Response(
                {"success": False, "message": "Medicine name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -- Validate via pipeline (Normalize → AI → Drug DB) --
        service = get_validation_service()
        result = service.validate(medicine_name)

        # -- Genuine system-level error (very rare: all DB providers down) --
        if result.get("error"):
            error_msg = result["error"]
            logger.error(
                "Validation system failure for '%s': %s",
                medicine_name,
                error_msg,
            )
            return Response(
                {
                    "success": False,
                    "message": "Medicine validation service is temporarily unavailable. Please try again later.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # -- Validation decision --
        if not result.get("valid", False):
            message = result.get("message", "Invalid medicine name. Please enter a valid medicine.")
            logger.info(
                "Rejected '%s': %s (ai_assisted=%s, drug_db=%s)",
                medicine_name,
                message,
                result.get("ai_assisted", False),
                result.get("drug_db_exists", False),
            )
            return Response(
                {
                    "success": False,
                    "message": message,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -- Valid: save with the NORMALIZED name --
        # Normalize whitespace: strip + collapse internal spaces
        normalized_name = _normalize(result.get("normalized_name", medicine_name))
        dosage = _normalize(request.data.get("dosage", ""))
        frequency = _normalize(request.data.get("frequency", ""))

        # -- Duplicate prevention: same user + normalized name + dosage + frequency --
        duplicate_qs = Medicine.objects.filter(
            user=request.user,
            medicine_name__iexact=normalized_name,
            dosage__iexact=dosage,
            frequency__iexact=frequency,
        )

        logger.info(
            "Duplicate check: user=%s, medicine='%s' (normalized), "
            "dosage='%s', frequency='%s' -> %d existing records",
            request.user.username,
            normalized_name,
            dosage,
            frequency,
            duplicate_qs.count(),
        )

        if duplicate_qs.exists():
            logger.warning(
                "Duplicate REJECTED: user=%s, medicine='%s', "
                "dosage='%s', frequency='%s'",
                request.user.username,
                normalized_name,
                dosage,
                frequency,
            )
            return Response(
                {
                    "success": False,
                    "message": "This medicine with the same dosage and schedule already exists.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(
            "Medicine '%s' validated successfully -> saved as '%s' "
            "(confidence=%.2f, time=%.0fms)",
            medicine_name,
            normalized_name,
            result.get("confidence", 0.0),
            result.get("time_taken_ms", 0),
        )

        # Override data with normalized values (strips + collapses whitespace)
        # so the database stores clean values and duplicate checking stays consistent
        mutable_data = request.data.copy()
        mutable_data["medicine_name"] = normalized_name
        mutable_data["dosage"] = dosage
        mutable_data["frequency"] = frequency

        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        logger.info(
            "Medicine SAVED: user=%s, medicine='%s', dosage='%s', frequency='%s'",
            request.user.username,
            normalized_name,
            dosage,
            frequency,
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )