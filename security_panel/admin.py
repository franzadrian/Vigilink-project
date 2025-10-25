from django.contrib import admin
from .models import SecurityReport

@admin.register(SecurityReport)
class SecurityReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'status', 'priority', 'reporter', 'target_type', 'community', 'created_at')
    list_filter = ('status', 'priority', 'target_type', 'community', 'created_at')
    search_fields = ('subject', 'message', 'reporter_name', 'reporter__username')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('subject', 'message', 'status', 'priority', 'community')
        }),
        ('Target Information', {
            'fields': ('target_type', 'target_user', 'target_description')
        }),
        ('Reporter Information', {
            'fields': ('reporter', 'is_anonymous', 'reporter_name', 'reporter_email')
        }),
        ('Report Content', {
            'fields': ('reasons', 'details')
        }),
        ('Security Management', {
            'fields': ('security_notes', 'assigned_to')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'resolved_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('reporter', 'target_user', 'community', 'assigned_to')
