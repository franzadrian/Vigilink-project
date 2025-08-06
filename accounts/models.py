from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import datetime

class CustomUserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        if not username:
            raise ValueError('The Username field must be set')
        
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(username, email, password, **extra_fields)

class City(models.Model):
    name = models.CharField(max_length=100)
    
    class Meta:
        verbose_name = _('city')
        verbose_name_plural = _('cities')
    
    def __str__(self):
        return self.name

class District(models.Model):
    name = models.CharField(max_length=100)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='districts')
    
    class Meta:
        verbose_name = _('district')
        verbose_name_plural = _('districts')
    
    def __str__(self):
        return f"{self.name}, {self.city.name}"

class IPLoginAttempt(models.Model):
    ip_address = models.GenericIPAddressField()
    login_attempts = models.IntegerField(default=0)
    last_attempt_time = models.DateTimeField(auto_now=True)
    is_blocked = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = _('IP login attempt')
        verbose_name_plural = _('IP login attempts')
    
    def __str__(self):
        return f"{self.ip_address} - {self.login_attempts} attempts"
    
    def is_blocked_now(self):
        """Check if the IP is currently blocked"""
        if not self.is_blocked:
            return False
        
        # Check if 5 minutes have passed since last attempt
        if self.last_attempt_time + datetime.timedelta(minutes=5) < timezone.now():
            # Reset block if 5 minutes have passed
            self.is_blocked = False
            self.login_attempts = 0
            self.save()
            return False
        return True
    
    def get_remaining_time(self):
        """Get remaining time in the block in human-readable format"""
        if not self.is_blocked:
            return ""
            
        remaining_time = self.last_attempt_time + datetime.timedelta(minutes=5) - timezone.now()
        remaining_minutes = int(remaining_time.total_seconds() // 60)
        remaining_seconds = int(remaining_time.total_seconds() % 60)
        
        if remaining_minutes > 0:
            time_msg = f"{remaining_minutes} minute{'s' if remaining_minutes != 1 else ''}"
        else:
            time_msg = f"{remaining_seconds} second{'s' if remaining_seconds != 1 else ''}"
        
        return time_msg

class User(AbstractUser):
    # Remove first_name and last_name fields from AbstractUser
    first_name = None
    last_name = None
    
    full_name = models.CharField(max_length=300, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    district = models.ForeignKey(District, on_delete=models.SET_NULL, null=True, blank=True)
    contact = models.CharField(max_length=50, blank=True)
    is_verified = models.BooleanField(default=False)
    verification_code = models.CharField(max_length=6, blank=True, null=True)
    verification_code_created = models.DateTimeField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', default='accounts/static/accounts/images/profile.png')
    
    objects = CustomUserManager()
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'full_name']
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        
    def __str__(self):
        return self.username
