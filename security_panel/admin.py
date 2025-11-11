from django.contrib import admin
from .models import SecurityReport, Incident

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
            'fields': ('target_type', 'target_user', 'location')
        }),
        ('Reporter Information', {
            'fields': ('reporter', 'is_anonymous', 'reporter_name')
        }),
        ('Report Content', {
            'fields': ('reasons', 'details')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'resolved_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('reporter', 'target_user', 'community')


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'incident_type', 'status', 'reporter', 'community', 'created_at')
    list_filter = ('incident_type', 'status', 'community', 'created_at')
    search_fields = ('title', 'description', 'reporter_name', 'reporter__username')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
    
    fieldsets = (
        ('Incident Information', {
            'fields': ('title', 'description', 'incident_type', 'status', 'location', 'community')
        }),
        ('Reporter Information', {
            'fields': ('reporter', 'is_anonymous', 'reporter_name')
        }),
        ('Security Management', {
            'fields': ('handled_by', 'security_report')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'resolved_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('reporter', 'community', 'handled_by', 'security_report')
