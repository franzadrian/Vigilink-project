from django.urls import path
from . import views

app_name = 'settings_panel'

urlpatterns = [
    path('', views.settings_page, name='settings'),
    path('cancel-subscription/', views.cancel_subscription, name='cancel_subscription'),
    path('update-notification-sound/', views.update_notification_sound, name='update_notification_sound'),
]

