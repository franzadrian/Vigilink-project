document.addEventListener('DOMContentLoaded', function() {
    const citySelect = document.getElementById('city');
    const districtSelect = document.getElementById('district');
    
    if (citySelect && districtSelect) {
        // Function to fetch districts for a selected city
        function fetchDistricts(cityId) {
            // Clear current options
            districtSelect.innerHTML = '<option value="">Select District</option>';
            
            if (!cityId) {
                districtSelect.disabled = true;
                return;
            }
            
            // Enable the district select
            districtSelect.disabled = false;
            
            // Fetch districts from the server
            fetch(`/get_districts/${cityId}/`)
                .then(response => response.json())
                .then(data => {
                    if (data.districts) {
                        // Add the districts to the select element
                        data.districts.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district.id;
                            option.textContent = district.name;
                            districtSelect.appendChild(option);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error fetching districts:', error);
                });
        }
        
        // Event listener for city select change
        citySelect.addEventListener('change', function() {
            fetchDistricts(this.value);
        });
        
        // Initialize districts based on initial city selection
        if (citySelect.value) {
            fetchDistricts(citySelect.value);
        } else {
            districtSelect.disabled = true;
        }
    }
});