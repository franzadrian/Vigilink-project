from django.contrib import admin
from .models import Subscription

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan_type', 'billing_cycle', 'status', 'start_date', 'expiry_date', 'created_at')
    list_filter = ('status', 'plan_type', 'billing_cycle', 'created_at')
    search_fields = ('user__username', 'user__email', 'user__full_name')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
