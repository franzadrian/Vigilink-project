from django.contrib import admin
from .models import Post, PostReaction, PostReply  # PostShare removed

# Register your models here.
class PostAdmin(admin.ModelAdmin):
    list_display = ('post_id', 'user', 'message', 'uploaded_at')
    list_filter = ('uploaded_at', 'user')
    search_fields = ('message', 'user__username')
    date_hierarchy = 'uploaded_at'

class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'created_at')
    list_filter = ('created_at',)

class PostReplyAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'message', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('message',)

# PostShareAdmin removed

admin.site.register(Post, PostAdmin)
admin.site.register(PostReaction, PostReactionAdmin)
admin.site.register(PostReply, PostReplyAdmin)
# PostShare admin registration removed
