from django.shortcuts import redirect
from django.conf import settings
from django.urls import resolve
import logging

# Set up logging
logger = logging.getLogger(__name__)

class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get the current URL path
        path = request.path_info
        
        logger.info(f"LoginRequiredMiddleware processing: {path} for user {request.user}")
        
        # Check if the user is authenticated
        if not request.user.is_authenticated:
            # Check if the path starts with /user/ (dashboard-related URLs)
            # Exclude informational pages like About, Contact, Pricing, Terms, and Privacy
            if path.startswith('/user/') and not (path.startswith('/user/about/') or path.startswith('/user/contact/') or path.startswith('/user/pricing/') or path.startswith('/user/terms/') or path.startswith('/user/privacy/')):
                logger.warning(f"Unauthenticated access attempt to {path}, redirecting to login")
                # Redirect to login page with next parameter
                return redirect(f'{settings.LOGIN_URL}?next={path}')
        
        # Continue with the request
        response = self.get_response(request)
        return response