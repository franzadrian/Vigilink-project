from django.core.management.base import BaseCommand
from accounts.models import City, District

class Command(BaseCommand):
    help = 'Populates the database with sample cities and districts'

    def handle(self, *args, **options):
        # Clear existing data
        City.objects.all().delete()
        District.objects.all().delete()
        
        # Create cities
        manila = City.objects.create(name='Manila')
        quezon_city = City.objects.create(name='Quezon City')
        makati = City.objects.create(name='Makati')
        pasig = City.objects.create(name='Pasig')
        taguig = City.objects.create(name='Taguig')
        cebu_city = City.objects.create(name='Cebu City')
        davao_city = City.objects.create(name='Davao City')
        iloilo_city = City.objects.create(name='Iloilo City')
        cagayan_de_oro = City.objects.create(name='Cagayan de Oro')
        zamboanga_city = City.objects.create(name='Zamboanga City')
        bacolod = City.objects.create(name='Bacolod')
        baguio = City.objects.create(name='Baguio')
        general_santos = City.objects.create(name='General Santos')
        angeles = City.objects.create(name='Angeles')
        naga = City.objects.create(name='Naga')
        
        # Create districts for Manila
        districts_manila = [
            'Binondo', 'Ermita', 'Intramuros', 'Malate', 'Paco', 'Pandacan', 'Port Area', 'Quiapo', 'Sampaloc', 'San Andres', 'San Miguel', 'San Nicolas', 'Santa Ana', 'Santa Cruz', 'Santa Mesa', 'Tondo'
        ]
        for district in districts_manila:
            District.objects.create(name=district, city=manila)
        
        # Create districts for Quezon City
        districts_qc = [
            'Bagumbayan', 'Bahay Toro', 'Balingasa', 'Batasan Hills', 'Commonwealth', 'Cubao', 'Diliman', 'Fairview', 'Galas', 'Kamuning', 'Katipunan', 'Loyola Heights', 'New Manila', 'Novaliches', 'Project 4', 'Project 6', 'Project 8', 'San Francisco Del Monte', 'Tandang Sora', 'UP Campus'
        ]
        for district in districts_qc:
            District.objects.create(name=district, city=quezon_city)
        
        # Create districts for Makati
        districts_makati = [
            'Bangkal', 'Bel-Air', 'Carmona', 'Cembo', 'Comembo', 'Dasmariñas', 'East Rembo', 'Forbes Park', 'Guadalupe Nuevo', 'Guadalupe Viejo', 'Kasilawan', 'La Paz', 'Magallanes', 'Olympia', 'Palanan', 'Pembo', 'Pinagkaisahan', 'Pio Del Pilar', 'Poblacion', 'Rizal', 'San Antonio', 'San Isidro', 'San Lorenzo', 'Santa Cruz', 'Singkamas', 'South Cembo', 'Tejeros', 'Urdaneta', 'Valenzuela', 'West Rembo'
        ]
        for district in districts_makati:
            District.objects.create(name=district, city=makati)
        
        # Create districts for Pasig
        districts_pasig = [
            'Bagong Ilog', 'Bagong Katipunan', 'Bambang', 'Buting', 'Caniogan', 'Dela Paz', 'Kalawaan', 'Kapasigan', 'Kapitolyo', 'Malinao', 'Manggahan', 'Maybunga', 'Oranbo', 'Palatiw', 'Pinagbuhatan', 'Pineda', 'Rosario', 'Sagad', 'San Antonio', 'San Joaquin', 'San Jose', 'San Miguel', 'San Nicolas', 'Santa Cruz', 'Santa Lucia', 'Santa Rosa', 'Santo Tomas', 'Santolan', 'Sumilang', 'Ugong'
        ]
        for district in districts_pasig:
            District.objects.create(name=district, city=pasig)
        
        # Create districts for Taguig
        districts_taguig = [
            'Bagumbayan', 'Bambang', 'Calzada', 'Central Bicutan', 'Central Signal Village', 'Fort Bonifacio', 'Hagonoy', 'Ibayo-Tipas', 'Katuparan', 'Ligid-Tipas', 'Lower Bicutan', 'Maharlika Village', 'Napindan', 'New Lower Bicutan', 'North Daang Hari', 'North Signal Village', 'Palingon', 'Pinagsama', 'San Miguel', 'Santa Ana', 'South Daang Hari', 'South Signal Village', 'Tanyag', 'Tuktukan', 'Upper Bicutan', 'Ususan', 'Wawa', 'Western Bicutan'
        ]
        for district in districts_taguig:
            District.objects.create(name=district, city=taguig)
        
        # Create districts for Cebu City
        districts_cebu = [
            'Adlaon', 'Agsungot', 'Apas', 'Babag', 'Bacayan', 'Banilad', 'Basak Pardo', 'Basak San Nicolas', 'Binaliw', 'Bonbon', 'Budlaan', 'Buhisan', 'Bulacao', 'Buot', 'Busay', 'Calamba', 'Cambinocot', 'Capitol Site', 'Carreta', 'Cogon Pardo', 'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita', 'Guadalupe', 'Guba', 'Hipodromo', 'Inayawan', 'Kalubihan', 'Kamagayan', 'Kamputhaw', 'Kasambagan', 'Kinasang-an', 'Labangon', 'Lahug', 'Lorega', 'Lusaran', 'Luz', 'Mabini', 'Mabolo', 'Malubog', 'Mambaling', 'Pahina Central', 'Pahina San Nicolas', 'Pamutan', 'Parian', 'Paril', 'Pasil', 'Pit-os', 'Poblacion Pardo', 'Pulangbato', 'Pung-ol Sibugay', 'Quiot', 'Sambag I', 'Sambag II', 'San Antonio', 'San Jose', 'San Nicolas Proper', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Sapangdaku', 'Sawang Calero', 'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II', 'T. Padilla', 'Tabunan', 'Tagba-o', 'Talamban', 'Taptap', 'Tejero', 'Tinago', 'Tisa', 'To-ong', 'Zapatera'
        ]
        for district in districts_cebu:
            District.objects.create(name=district, city=cebu_city)
        
        # Create districts for Davao City
        districts_davao = [
            'Agdao', 'Baguio', 'Biao Escuela', 'Biao Guianga', 'Bucana', 'Buhangin', 'Bunawan', 'Calinan', 'Catalunan Grande', 'Catalunan Pequeño', 'Catigan', 'Centro (Poblacion)', 'Colosas', 'Daliao', 'Dumoy', 'Gumalang', 'Ilang', 'Indangan', 'Lapu-Lapu', 'Lasang', 'Maa', 'Magtuod', 'Mahayag', 'Mandug', 'Matina Aplaya', 'Matina Crossing', 'Mintal', 'Pampanga', 'Panacan', 'Paquibato', 'Sasa', 'Talomo', 'Tibungco', 'Toril', 'Tugbok', 'Ulas', 'Waan'
        ]
        for district in districts_davao:
            District.objects.create(name=district, city=davao_city)
        
        # Create districts for Iloilo City
        districts_iloilo = [
            'Arevalo', 'City Proper', 'Jaro', 'La Paz', 'Lapuz', 'Mandurriao', 'Molo'
        ]
        for district in districts_iloilo:
            District.objects.create(name=district, city=iloilo_city)
        
        # Create districts for Cagayan de Oro
        districts_cdo = [
            'Agusan', 'Balulang', 'Balubal', 'Bayabas', 'Bonbon', 'Bugo', 'Bulua', 'Camaman-an', 'Carmen', 'Consolacion', 'Cugman', 'Gusa', 'Indahag', 'Iponan', 'Kauswagan', 'Lapasan', 'Lumbia', 'Macabalan', 'Macasandig', 'Nazareth', 'Patag', 'Pigsag-an', 'Puntod', 'Puerto', 'Tablon', 'Tignapoloan', 'Tuburan', 'Tumpagon', 'Umayam'
        ]
        for district in districts_cdo:
            District.objects.create(name=district, city=cagayan_de_oro)
        
        # Create districts for Zamboanga City
        districts_zamboanga = [
            'Ayala', 'Baliwasan', 'Boalan', 'Calarian', 'Campo Islam', 'Canelar', 'Divisoria', 'Guiwan', 'La Paz', 'Lunzuran', 'Mampang', 'Manicahan', 'Pasonanca', 'Putik', 'Recodo', 'San Jose Gusu', 'San Roque', 'Santa Barbara', 'Santa Catalina', 'Santa Maria', 'Santo Niño', 'Sinunuc', 'Talon-Talon', 'Tetuan', 'Tugbungan', 'Tumaga', 'Zamboanga City Proper'
        ]
        for district in districts_zamboanga:
            District.objects.create(name=district, city=zamboanga_city)
        
        # Create districts for Bacolod
        districts_bacolod = [
            'Alangilan', 'Alijis', 'Banago', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10', 'Barangay 11', 'Barangay 12', 'Barangay 13', 'Barangay 14', 'Barangay 15', 'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19', 'Barangay 20', 'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25', 'Barangay 26', 'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30', 'Barangay 31', 'Barangay 32', 'Barangay 33', 'Barangay 34', 'Barangay 35', 'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40', 'Barangay 41', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan', 'Mansilingan', 'Montevista', 'Pahanocoy', 'Punta Taytay', 'Singcang-Airport', 'Sum-ag', 'Taculing', 'Tangub', 'Villamonte', 'Vista Alegre'
        ]
        for district in districts_bacolod:
            District.objects.create(name=district, city=bacolod)
        
        # Create districts for Baguio
        districts_baguio = [
            'Asin Road', 'Aurora Hill Proper', 'Aurora Hill North', 'Aurora Hill South', 'Bakakeng Central', 'Bakakeng North', 'Bakakeng South', 'Cabinet Hill-Teachers Camp', 'Camp 7', 'Camp 8', 'City Camp Central', 'City Camp Proper', 'Country Club Village', 'Dagsian Lower', 'Dagsian Upper', 'Dizon Subdivision', 'Dominican Hill-Mirador', 'Dontogan', 'Engineers Hill', 'Fairview Village', 'Ferdinand', 'Fort del Pilar', 'Gabriela Silang', 'General Luna', 'General Emilio F. Aguinaldo', 'Gibraltar', 'Greenwater Village', 'Guisad Central', 'Guisad Sorong', 'Happy Hollow', 'Happy Homes', 'Harrison-Claudio Carantes', 'Holy Ghost Extension', 'Holy Ghost Proper', 'Imelda Marcos', 'Imelda Village', 'Irisan', 'Kabayanihan', 'Kagitingan', 'Kias', 'Legarda-Burnham-Kisad', 'Liwanag-Loakan', 'Loakan Proper', 'Lopez Jaena', 'Lower Dagsian', 'Lower General Luna', 'Lower Lourdes Subdivision', 'Lower Magsaysay', 'Lower QM', 'Lower Rock Quarry', 'Lualhati', 'Lucnab', 'Magsaysay Private Road', 'Magsaysay Public', 'Malcolm Square', 'Manuel A. Roxas', 'Market Subdivision', 'Middle Quezon Hill Subdivision', 'Military Cut-off', 'Mines View Park', 'Modern Site', 'MRR-Queen of Peace', 'New Lucban', 'Outlook Drive', 'Pacdal', 'Padre Burgos', 'Padre Zamora', 'Pinsao Pilot Project', 'Pinsao Proper', 'Pucsusan', 'Quezon Hill Proper', 'Quezon Hill Upper', 'Quirino Hill East', 'Quirino Hill Lower', 'Quirino Hill Middle', 'Quirino Hill West', 'Quirino-Magsaysay Upper', 'Rock Quarry Lower', 'Rock Quarry Middle', 'Rock Quarry Upper', 'Saint Joseph Village', 'Salud Mitra', 'San Antonio Village', 'San Luis Village', 'San Roque Village', 'San Vicente', 'Santa Escolastica', 'Santo Rosario', 'Santo Tomas Proper', 'Santo Tomas School Area', 'Scout Barrio', 'Session Road Area', 'Slaughter House Area', 'SLU-SVP Housing Village', 'South Drive', 'Teodora Alonzo', 'Upper Dagsian', 'Upper General Luna', 'Upper Lourdes Subdivision', 'Upper Magsaysay', 'Upper Market Subdivision', 'Upper QM', 'Upper Rock Quarry', 'Victoria Village'
        ]
        for district in districts_baguio:
            District.objects.create(name=district, city=baguio)
        
        # Create districts for General Santos
        districts_gensan = [
            'Apopong', 'Baluan', 'Batomelong', 'Buayan', 'Bula', 'Calumpang', 'City Heights', 'Conel', 'Dadiangas East', 'Dadiangas North', 'Dadiangas South', 'Dadiangas West', 'Fatima', 'Katangawan', 'Labangal', 'Lagao', 'Ligaya', 'Mabuhay', 'Olympog', 'San Isidro', 'San Jose', 'Siguel', 'Sinawal', 'Tambler', 'Tinagacan', 'Upper Labay'
        ]
        for district in districts_gensan:
            District.objects.create(name=district, city=general_santos)
        
        # Create districts for Angeles
        districts_angeles = [
            'Agapito del Rosario', 'Amsic', 'Anunas', 'Balibago', 'Capaya', 'Claro M. Recto', 'Cuayan', 'Cutcut', 'Cutud', 'Lourdes North West', 'Lourdes Sur', 'Lourdes Sur East', 'Malabañas', 'Margot', 'Marisol', 'Mining', 'Ninoy Aquino', 'Pampang', 'Pandan', 'Pulungbulu', 'Pulung Cacutud', 'Pulung Maragul', 'Salapungan', 'San Jose', 'San Nicolas', 'Santa Teresita', 'Santa Trinidad', 'Santo Cristo', 'Santo Domingo', 'Santo Rosario', 'Sapalibutad', 'Sapangbato', 'Tabun', 'Virgen Delos Remedios'
        ]
        for district in districts_angeles:
            District.objects.create(name=district, city=angeles)
        
        # Create districts for Naga
        districts_naga = [
            'Abella', 'Bagumbayan Norte', 'Bagumbayan Sur', 'Balatas', 'Calauag', 'Cararayan', 'Carolina', 'Concepcion Grande', 'Concepcion Pequeña', 'Dayangdang', 'Del Rosario', 'Dinaga', 'Igualdad Interior', 'Lerma', 'Liboton', 'Mabolo', 'Pacol', 'Panicuason', 'Peñafrancia', 'Sabang', 'San Felipe', 'San Francisco', 'San Isidro', 'Santa Cruz', 'Tabuco', 'Tinago', 'Triangulo'
        ]
        for district in districts_naga:
            District.objects.create(name=district, city=naga)
        
        self.stdout.write(self.style.SUCCESS('Successfully populated cities and districts'))