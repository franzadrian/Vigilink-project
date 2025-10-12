from django.core.management.base import BaseCommand
from accounts.models import City, District


class Command(BaseCommand):
    help = 'Populate database with Cebu Province cities and their districts only'

    def handle(self, *args, **options):
        # Clear existing data
        District.objects.all().delete()
        City.objects.all().delete()

        # Cebu Province cities and representative districts (barangays)
        # Note: Names are ASCII-normalized to avoid encoding issues.
        cebu_data = {
            'Cebu City': [
                'Adlaon', 'Agsungot', 'Apas', 'Babag', 'Bacayan', 'Banilad', 'Basak Pardo', 'Basak San Nicolas',
                'Binaliw', 'Bonbon', 'Budlaan', 'Buhisan', 'Bulacao', 'Buot', 'Busay', 'Calamba', 'Cambinocot',
                'Capitol Site', 'Carreta', 'Cogon Pardo', 'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita',
                'Guadalupe', 'Guba', 'Hipodromo', 'Inayawan', 'Kalubihan', 'Kamagayan', 'Kamputhaw', 'Kasambagan',
                'Kinasang-an', 'Labangon', 'Lahug', 'Lorega', 'Lusaran', 'Luz', 'Mabini', 'Mabolo', 'Malubog',
                'Mambaling', 'Pahina Central', 'Pahina San Nicolas', 'Pamutan', 'Parian', 'Paril', 'Pasil', 'Pit-os',
                'Poblacion Pardo', 'Pulangbato', 'Pung-ol Sibugay', 'Quiot', 'Sambag I', 'Sambag II', 'San Antonio',
                'San Jose', 'San Nicolas Proper', 'San Roque', 'Santa Cruz', 'Santo Nino', 'Sapangdaku',
                'Sawang Calero', 'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II', 'T. Padilla', 'Tabunan',
                'Tagba-o', 'Talamban', 'Taptap', 'Tejero', 'Tinago', 'Tisa', 'To-ong', 'Zapatera'
            ],
            'Mandaue City': [
                'Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro', 'Canduman', 'Casuntingan',
                'Centro', 'Cubacub', 'Guizo', 'Jagobiao', 'Labogon', 'Looc', 'Maguikay', 'Mantuyong', 'Opao',
                'Pakna-an', 'Pagsabungan', 'Subangdaku', 'Tabok', 'Tawason', 'Tipolo', 'Tingub', 'Umapad'
            ],
            'Lapu-Lapu City': [
                'Agus', 'Babag', 'Bankal', 'Basak', 'Buaya', 'Caubian', 'Caw-oy', 'Gun-ob', 'Ibo', 'Looc', 'Mactan',
                'Maribago', 'Marigondon', 'Pajo', 'Pajac', 'Poblacion', 'Pusok', 'Punta Engano', 'Sabang',
                'San Vicente', 'Subabasbas', 'Talima', 'Tingo', 'Tungasan'
            ],
            'Talisay City': [
                'Biasong', 'Bulacao', 'Cadulawan', 'Camp 4', 'Cansojong', 'Dumlog', 'Jaclupan', 'Lagtang',
                'Lawaan I', 'Lawaan II', 'Lawaan III', 'Linao', 'Maghaway', 'Manipis', 'Mohon', 'Poblacion', 'Pooc',
                'San Isidro', 'San Roque', 'Tabunok', 'Tangke', 'Tapul'
            ],
            'Carcar City': [
                'Bolocboloc', 'Can-asujan', 'Guadalupe', 'Liburon', 'Napo', 'Ocana', 'Perrelos', 'Poblacion I',
                'Poblacion II', 'Poblacion III', 'Poblacion IV', 'Poblacion V', 'San Isidro', 'Tuyom', 'Valladolid'
            ],
            'Danao City': [
                'Bali-ang', 'Binaliw', 'Cambanay', 'Cansuong', 'Danasan', 'Guinsay', 'Looc', 'Magtagobtob', 'Masaba',
                'Nangka', 'Poblacion', 'Sabang', 'Santa Rosa', 'Suba'
            ],
            'Naga City': [
                'Alimbuyog', 'Cantao-an', 'Colon', 'Cogon', 'Inayagan', 'Inoburan', 'Langtad', 'Lutac', 'Mainit',
                'Naalad', 'Pangdan', 'Poblacion', 'Tagjaguimit', 'Tinaan', 'Tuyan', 'Uling'
            ],
            'Toledo City': [
                'Bato', 'Bunga', 'Cabitoonan', 'Canlumampao', 'Cantabaco', 'Daanlungsod', 'Ibo', 'Ilihan', 'Ingore',
                'Media Once', 'Poblacion', 'Poog', 'Sangi', 'Talavera', 'Tubod', 'Tungkay', 'Lutopan'
            ],
            'Bogo City': [
                'Anonang Norte', 'Anonang Sur', 'Banban', 'Binabag', 'Bungtod', 'Cayang', 'Cogon', 'Dakit', 'Gairan',
                'La Paz', 'Libertad', 'Lourdes', 'Malingin', 'Masio', 'Nailon', 'Pandan', 'Poblacion', 'Polambato',
                'Sambag', 'Santo Nino', 'Santo Rosario', 'Taytayan', 'Tiptipon', 'Tominjao', 'Ubogon'
            ],
        }

        # Create cities and their districts
        for city_name, districts in cebu_data.items():
            city = City.objects.create(name=city_name)
            for d in districts:
                District.objects.create(name=d, city=city)

        self.stdout.write(self.style.SUCCESS('Successfully populated Cebu Province cities and districts'))

