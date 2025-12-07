"""
SendGrid HTTP API backend for Django email
Uses SendGrid's HTTP API instead of SMTP (works on Render free tier)
"""
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import logging

logger = logging.getLogger(__name__)


class SendGridEmailBackend(BaseEmailBackend):
    """
    SendGrid HTTP API email backend
    Works on Render free tier because it uses HTTP instead of SMTP
    """
    
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)
        self.api_key = getattr(settings, 'SENDGRID_API_KEY', None) or getattr(settings, 'EMAIL_HOST_PASSWORD', None)
        if not self.api_key:
            if not self.fail_silently:
                raise ValueError("SENDGRID_API_KEY or EMAIL_HOST_PASSWORD must be set")
            logger.warning("SendGrid API key not configured")
    
    def send_messages(self, email_messages):
        """
        Send one or more EmailMessage objects and return the number of emails sent.
        """
        if not email_messages:
            return 0
        
        if not self.api_key:
            if not self.fail_silently:
                raise ValueError("SendGrid API key not configured")
            return 0
        
        num_sent = 0
        try:
            sg = SendGridAPIClient(self.api_key)
            
            for message in email_messages:
                try:
                    # Create SendGrid Mail object
                    mail = Mail(
                        from_email=message.from_email or settings.DEFAULT_FROM_EMAIL,
                        to_emails=message.to,
                        subject=message.subject,
                        plain_text_content=message.body
                    )
                    
                    # Add CC and BCC if present
                    if message.cc:
                        mail.cc = message.cc
                    if message.bcc:
                        mail.bcc = message.bcc
                    
                    # Send email
                    response = sg.send(mail)
                    
                    # Check response status
                    if response.status_code in [200, 201, 202]:
                        num_sent += 1
                        logger.info(f"Email sent successfully via SendGrid to {message.to}")
                    else:
                        error_msg = f"SendGrid API returned status {response.status_code}: {response.body}"
                        logger.error(error_msg)
                        if not self.fail_silently:
                            raise Exception(error_msg)
                
                except Exception as e:
                    logger.error(f"Error sending email via SendGrid: {str(e)}")
                    if not self.fail_silently:
                        raise
        
        except Exception as e:
            logger.error(f"SendGrid backend error: {str(e)}")
            if not self.fail_silently:
                raise
        
        return num_sent

