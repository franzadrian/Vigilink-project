from django.db import models
from django.conf import settings
import secrets
import string
from django.db.models.functions import Lower


class CommunityProfile(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='community_profile')
    community_name = models.CharField(max_length=255, blank=True)
    community_address = models.CharField(max_length=500, blank=True)
    secret_code = models.CharField(max_length=24, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.community_name or 'Unnamed Community'} ({self.owner.username})"

    @staticmethod
    def generate_secret_code(length: int = 16) -> str:
        alphabet = string.ascii_uppercase + string.digits
        raw = ''.join(secrets.choice(alphabet) for _ in range(length))
        # format like XXXX-XXXX-XXXX-XXXX for 16
        if length == 16:
            return f"{raw[0:4]}-{raw[4:8]}-{raw[8:12]}-{raw[12:16]}"
        return raw

    class Meta:
        constraints = [
            # Enforce case-insensitive uniqueness of community_name
            models.UniqueConstraint(Lower('community_name'), name='uniq_lower_community_name')
        ]

# Create your models here.


class CommunityMembership(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_membership',
    )
    community = models.ForeignKey(
        CommunityProfile,
        on_delete=models.CASCADE,
        related_name='members',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} -> {self.community.community_name or 'Unnamed Community'}"

    class Meta:
        verbose_name = 'community membership'
        verbose_name_plural = 'community memberships'


class EmergencyContact(models.Model):
    community = models.ForeignKey(
        CommunityProfile,
        on_delete=models.CASCADE,
        related_name='emergency_contacts',
    )
    label = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.label}: {self.phone}"

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'emergency contact'
        verbose_name_plural = 'emergency contacts'
