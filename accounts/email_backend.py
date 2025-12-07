"""
Custom email backend with timeout support to prevent blocking
"""
from django.core.mail.backends.smtp import EmailBackend
from django.conf import settings
import socket

class TimeoutEmailBackend(EmailBackend):
    """
    Custom SMTP email backend with configurable timeout
    Prevents worker timeouts when email service is unavailable
    """
    
    def __init__(self, host=None, port=None, username=None, password=None,
                 use_tls=None, fail_silently=False, use_ssl=None, timeout=None,
                 ssl_keyfile=None, ssl_certfile=None, **kwargs):
        # Get timeout from settings (default 5 seconds)
        timeout = timeout or getattr(settings, 'EMAIL_TIMEOUT', 5)
        super().__init__(
            host=host, port=port, username=username, password=password,
            use_tls=use_tls, fail_silently=fail_silently, use_ssl=use_ssl,
            timeout=timeout, ssl_keyfile=ssl_keyfile, ssl_certfile=ssl_certfile,
            **kwargs
        )

