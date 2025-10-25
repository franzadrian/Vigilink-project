from django.apps import AppConfig


class CommunityownerPanelConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'communityowner_panel'
    
    def ready(self):
        import communityowner_panel.views  # This will load the signals