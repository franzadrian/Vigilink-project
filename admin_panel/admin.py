from django.contrib import admin
from .models import ContactMessage

# Register your models here.
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('contact_id', 'name', 'email', 'subject', 'created_at', 'is_read')
    list_filter = ('created_at', 'is_read', 'subject')
    search_fields = ('name', 'email', 'message', 'subject')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

admin.site.register(ContactMessage, ContactMessageAdmin)
