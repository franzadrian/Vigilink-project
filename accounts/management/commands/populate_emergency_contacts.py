from django.core.management.base import BaseCommand
from accounts.models import City, District, LocationEmergencyContact

class Command(BaseCommand):
    help = 'Populate default emergency contacts for cities and districts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--city',
            type=str,
            help='Specific city to populate contacts for',
        )
        parser.add_argument(
            '--district',
            type=str,
            help='Specific district to populate contacts for',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Populate contacts for all cities and districts',
        )

    def handle(self, *args, **options):
        if options['all']:
            self.populate_all_locations()
        elif options['city']:
            self.populate_city(options['city'])
        elif options['district']:
            self.populate_district(options['district'])
        else:
            self.stdout.write(
                self.style.WARNING('Please specify --city, --district, or --all')
            )

    def populate_all_locations(self):
        """Populate emergency contacts for all cities and districts"""
        cities = City.objects.all()
        districts = District.objects.all()
        
        for city in cities:
            self.populate_city_contacts(city)
            
        for district in districts:
            self.populate_district_contacts(district)
            
        self.stdout.write(
            self.style.SUCCESS(f'Populated emergency contacts for {cities.count()} cities and {districts.count()} districts')
        )

    def populate_city(self, city_name):
        """Populate emergency contacts for a specific city"""
        try:
            city = City.objects.get(name__iexact=city_name)
            self.populate_city_contacts(city)
            self.stdout.write(
                self.style.SUCCESS(f'Populated emergency contacts for {city.name}')
            )
        except City.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'City "{city_name}" not found')
            )

    def populate_district(self, district_name):
        """Populate emergency contacts for a specific district"""
        try:
            district = District.objects.get(name__iexact=district_name)
            self.populate_district_contacts(district)
            self.stdout.write(
                self.style.SUCCESS(f'Populated emergency contacts for {district.name}, {district.city.name}')
            )
        except District.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'District "{district_name}" not found')
            )

    def populate_city_contacts(self, city):
        """Populate default emergency contacts for a city"""
        # Check if contacts already exist
        if LocationEmergencyContact.objects.filter(city=city).exists():
            self.stdout.write(f'  Emergency contacts for {city.name} already exist, skipping...')
            return

        # Essential emergency contacts (4 contacts only)
        default_contacts = [
            {'label': 'Police Emergency', 'phone': '166', 'order': 1},
            {'label': 'Fire Department', 'phone': '160', 'order': 2},
            {'label': 'Hospital Emergency', 'phone': '161', 'order': 3},
            {'label': f'{city.name} City Hall', 'phone': '032-123-4567', 'order': 4},
        ]

        for contact_data in default_contacts:
            LocationEmergencyContact.objects.create(
                city=city,
                **contact_data
            )

        self.stdout.write(f'  Created {len(default_contacts)} emergency contacts for {city.name}')

    def populate_district_contacts(self, district):
        """Populate default emergency contacts for a district"""
        # Check if contacts already exist
        if LocationEmergencyContact.objects.filter(district=district).exists():
            self.stdout.write(f'  Emergency contacts for {district.name} already exist, skipping...')
            return

        # Cebu City district-specific emergency contacts (4 essential contacts only)
        if district.city.name.lower() == 'cebu city':
            default_contacts = [
                {'label': 'Police Emergency', 'phone': '166', 'order': 1},
                {'label': 'Fire Department', 'phone': '160', 'order': 2},
                {'label': 'Hospital Emergency', 'phone': '161', 'order': 3},
                {'label': f'{district.name} Barangay Hall', 'phone': '032-123-4567', 'order': 4},
            ]
        else:
            # Generic emergency contacts for other cities' districts (4 essential contacts only)
            default_contacts = [
                {'label': 'Police Emergency', 'phone': '166', 'order': 1},
                {'label': 'Fire Department', 'phone': '160', 'order': 2},
                {'label': 'Hospital Emergency', 'phone': '161', 'order': 3},
                {'label': f'{district.name} Barangay Hall', 'phone': '032-123-4567', 'order': 4},
            ]

        for contact_data in default_contacts:
            LocationEmergencyContact.objects.create(
                district=district,
                **contact_data
            )

        self.stdout.write(f'  Created {len(default_contacts)} emergency contacts for {district.name}, {district.city.name}')
