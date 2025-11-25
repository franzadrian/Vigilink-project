from django.core.management.base import BaseCommand
from django.utils import timezone
from security_panel.models import SecurityReport, Incident


class Command(BaseCommand):
    help = 'Update all pending reports to resolved status'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without actually updating',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Get all pending SecurityReports
        pending_security_reports = SecurityReport.objects.filter(status='pending')
        security_count = pending_security_reports.count()
        
        # Get all pending Incidents
        pending_incidents = Incident.objects.filter(status='pending')
        incident_count = pending_incidents.count()
        
        total_count = security_count + incident_count
        
        if total_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No pending reports found. All reports are already resolved or in other statuses.')
            )
            return
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would update {security_count} SecurityReport(s) and {incident_count} Incident(s) to resolved status.')
            )
            return
        
        # Update SecurityReports
        if security_count > 0:
            now = timezone.now()
            updated_security = pending_security_reports.update(
                status='resolved',
                resolved_at=now
            )
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {updated_security} SecurityReport(s) to resolved status.')
            )
        
        # Update Incidents
        if incident_count > 0:
            now = timezone.now()
            updated_incidents = pending_incidents.update(
                status='resolved',
                resolved_at=now
            )
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {updated_incidents} Incident(s) to resolved status.')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'\nTotal: {total_count} report(s) updated to resolved status.')
        )

