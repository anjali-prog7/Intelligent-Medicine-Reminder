from rest_framework import serializers
from .models import User, indian_phone_validator


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(
        required=True,
        validators=[indian_phone_validator],
        help_text="Indian mobile number: 10 digits starting with 6-9, optional +91 or 0 prefix.",
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "phone",
            "role",
            "password",
        ]

    def validate_phone(self, value):
        """Strip +91 or 0 prefix, store only the 10-digit number."""
        # Remove +91 or 0 prefix
        if value.startswith("+91"):
            value = value[3:]
        elif value.startswith("0"):
            value = value[1:]
        # Check uniqueness manually (since model allows NULL)
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("This phone number is already registered.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            phone=validated_data.get("phone"),
            role=validated_data.get("role", "PATIENT"),
            password=validated_data["password"],
        )
        return user