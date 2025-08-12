from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, City, District

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'full_name', 'role', 'city', 'is_staff', 'is_verified')
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'role', 'about')}),
        ('Location', {'fields': ('city', 'district', 'address', 'block', 'lot')}),
        ('Contact', {'fields': ('contact',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_verified', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'full_name', 'role', 'about', 'city', 'district', 'address', 'block', 'lot', 'contact'),
        }),
    )
    search_fields = ('username', 'email', 'full_name')
    list_filter = ('is_staff', 'is_verified', 'city', 'district')
    ordering = ('username',)

class CityAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

class DistrictAdmin(admin.ModelAdmin):
    list_display = ('name', 'city')
    list_filter = ('city',)
    search_fields = ('name',)

admin.site.register(User, CustomUserAdmin)
admin.site.register(City, CityAdmin)
admin.site.register(District, DistrictAdmin)
