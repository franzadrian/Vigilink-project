from django.core.management.base import BaseCommand
from django.utils import timezone
from settings_panel.models import Subscription
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete all data for expired trial subscriptions that have passed their 1-month grace period'

    def handle(self, *args, **options):
        """Delete trial data for subscriptions where data_deletion_date has passed"""
        now = timezone.now()
        
        # Find all trial subscriptions where data_deletion_date has passed
        expired_trials = Subscription.objects.filter(
            is_trial=True,
            data_deletion_date__isnull=False,
            data_deletion_date__lte=now
        )
        
        deleted_count = 0
        error_count = 0
        
        for subscription in expired_trials:
            try:
                self.stdout.write(f"Deleting trial data for user: {subscription.user.username} (Subscription ID: {subscription.id})")
                subscription.delete_trial_data()
                deleted_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully deleted trial data for {subscription.user.username}')
                )
            except Exception as e:
                error_count += 1
                logger.error(f"Error deleting trial data for subscription {subscription.id}: {str(e)}", exc_info=True)
                self.stdout.write(
                    self.style.ERROR(f'Error deleting trial data for {subscription.user.username}: {str(e)}')
                )
        
        if deleted_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'\nSuccessfully deleted data for {deleted_count} expired trial(s).')
            )
        else:
            self.stdout.write(self.style.SUCCESS('No expired trial data to delete.'))
        
        if error_count > 0:
            self.stdout.write(
                self.style.WARNING(f'\nEncountered {error_count} error(s) during deletion.')
            )

