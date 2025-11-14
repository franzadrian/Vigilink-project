from django.core.management.base import BaseCommand
from admin_panel.models import SafetyTip
from accounts.models import User


class Command(BaseCommand):
    help = 'Add default safety tips to the database'

    def handle(self, *args, **options):
        # Subdivision/Community-specific safety tips
        default_tips = [
            'Do not share your subdivision gate codes with unknown persons or post them publicly on social media.',
            'Do not let strangers tailgate into the subdivision - always verify access and report unauthorized entry immediately.',
            'Report suspicious vehicles or individuals loitering in the subdivision to security or community management.',
            'Keep your subdivision access card or key fob secure and report lost or stolen cards immediately.',
            'Participate in your community\'s neighborhood watch program to help keep the subdivision safe.',
            'Know your neighbors and exchange contact information for emergencies and mutual assistance.',
            'Always verify the identity of service personnel, delivery drivers, or contractors before allowing them into the subdivision.',
            'Keep porch lights and exterior lights on at night to improve visibility and deter criminal activity.',
            'Secure packages and deliveries - request deliveries when you are home or use secure package lockers if available.',
            'Never leave your garage door open when not in use, especially at night or when away from home.',
            'Report broken streetlights, damaged fences, or security issues to community management promptly.',
            'Keep your house number clearly visible from the street for emergency responders.',
            'Trim hedges and bushes around your property to eliminate hiding spots and improve line of sight.',
            'Store valuables out of sight in vehicles and never leave keys in unattended vehicles.',
            'Lock all doors and windows before leaving your home, even for short periods.',
            'Install motion-sensor lights around your property perimeter to deter intruders.',
            'Be cautious when sharing vacation plans or extended absences on social media.',
            'Ensure all family members know the emergency evacuation plan and meeting points.',
            'Test your smoke alarms monthly and replace batteries as needed.',
            'Keep emergency numbers saved in your phone, including subdivision security and community management.',
            'Regularly check that all locks, security systems, and gates are functioning properly.',
            'Never leave spare keys in obvious places like under doormats, flower pots, or mailboxes.',
            'Keep important documents in a fireproof safe or secure location.',
            'If you notice any security cameras or gates not working properly, report it to community management immediately.',
        ]

        # Get or create an admin user for created_by (or use None if no admin exists)
        admin_user = User.objects.filter(role='admin').first()
        if not admin_user:
            admin_user = User.objects.filter(is_superuser=True).first()

        # Check if tips already exist
        existing_count = SafetyTip.objects.count()
        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'There are already {existing_count} safety tip(s) in the database. '
                    'Adding new tips anyway...'
                )
            )

        # Create safety tips (skip if exact content already exists)
        created_count = 0
        skipped_count = 0
        for tip_content in default_tips:
            # Check if this exact tip already exists
            if SafetyTip.objects.filter(content=tip_content).exists():
                skipped_count += 1
                continue
            
            SafetyTip.objects.create(
                content=tip_content,
                created_by=admin_user
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {created_count} default safety tips.'
            )
        )

