document.addEventListener('DOMContentLoaded', function() {
    // Get emergency contact field
    const emergencyContactInput = document.getElementById('emergencyContact');
    const form = document.querySelector('form');
    
    // Create country code dropdown if it doesn't exist
    if (emergencyContactInput && !document.getElementById('countryCode')) {
        // Create container for country code and phone
        const contactContainer = document.createElement('div');
        contactContainer.className = 'contact-container';
        contactContainer.style.display = 'flex';
        contactContainer.style.gap = '10px';
        
        // Create country code dropdown
        const countryCodeSelect = document.createElement('select');
        countryCodeSelect.id = 'countryCode';
        countryCodeSelect.name = 'countryCode';
        countryCodeSelect.className = 'form-input';
        countryCodeSelect.style.width = '120px';
        countryCodeSelect.required = true;
        
        // Add country codes
        const countryCodes = [
            { code: '+1', country: 'USA/Canada' },
            { code: '+44', country: 'UK' },
            { code: '+61', country: 'Australia' },
            { code: '+63', country: 'Philippines' },
            { code: '+65', country: 'Singapore' },
            { code: '+81', country: 'Japan' },
            { code: '+82', country: 'South Korea' },
            { code: '+91', country: 'India' },
            { code: '+86', country: 'China' },
            { code: '+49', country: 'Germany' },
            { code: '+33', country: 'France' },
            { code: '+39', country: 'Italy' },
            { code: '+34', country: 'Spain' },
            { code: '+55', country: 'Brazil' },
            { code: '+52', country: 'Mexico' },
            { code: '+971', country: 'UAE' },
            { code: '+966', country: 'Saudi Arabia' },
            { code: '+27', country: 'South Africa' },
            { code: '+234', country: 'Nigeria' },
            { code: '+20', country: 'Egypt' }
        ];
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select';
        countryCodeSelect.appendChild(defaultOption);
        
        // Add country code options
        countryCodes.forEach(function(country) {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = `${country.code} ${country.country}`;
            countryCodeSelect.appendChild(option);
        });
        
        // Function to show error (reusing from validation_rules.js)
        function showError(input, message) {
            // Remove any existing error message
            removeError(input);
            
            // Create error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'input-error';
            errorDiv.textContent = message;
            
            // Insert after the input
            input.parentNode.insertBefore(errorDiv, input.nextSibling);
            
            // Add error class to input
            input.classList.add('input-error-field');
        }
        
        // Function to remove error message
        function removeError(input) {
            // Find and remove any existing error message
            const parent = input.parentNode;
            const errorDiv = parent.querySelector('.input-error');
            if (errorDiv) {
                parent.removeChild(errorDiv);
            }
            
            // Remove error class from input
            input.classList.remove('input-error-field');
        }
        
        // Function to show success message
        function showSuccess(input, message) {
            // Remove any existing error message
            removeError(input);
            
            // Remove any existing success message
            const parent = input.parentNode;
            const existingSuccessDiv = parent.querySelector('.input-success');
            if (existingSuccessDiv) {
                parent.removeChild(existingSuccessDiv);
            }
            
            // Create success message element
            const successDiv = document.createElement('div');
            successDiv.className = 'input-success';
            successDiv.textContent = message;
            
            // Insert after the input
            input.parentNode.insertBefore(successDiv, input.nextSibling);
            
            // Add success class to input
            input.classList.add('input-success-field');
        }
        
        // Function to validate phone number
        function validatePhoneNumber(phoneNumber, countryCode) {
            if (!phoneNumber) return false;
            
            // Remove any non-digit characters except for the plus sign
            const cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
            
            // Different validation patterns based on country code
            switch(countryCode) {
                case '+1': // USA/Canada
                    return /^\d{10}$/.test(cleanedNumber); // 10 digits
                case '+63': // Philippines
                    return /^\d{10}$/.test(cleanedNumber); // 10 digits
                case '+44': // UK
                    return /^\d{10,11}$/.test(cleanedNumber); // 10-11 digits
                default:
                    return cleanedNumber.length >= 7 && cleanedNumber.length <= 15; // General international format
            }
        }
        
        // Replace the emergency contact input with the new container
        const parentNode = emergencyContactInput.parentNode;
        
        // Create a new phone input
        const phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.id = 'phoneNumber';
        phoneInput.name = 'phoneNumber';
        phoneInput.className = 'form-input';
        phoneInput.placeholder = 'Enter phone number';
        phoneInput.required = true;
        phoneInput.style.flex = '1';
        
        // Add the country code and phone input to the container
        contactContainer.appendChild(countryCodeSelect);
        contactContainer.appendChild(phoneInput);
        
        // Replace the original input with our container
        parentNode.replaceChild(contactContainer, emergencyContactInput);
        
        // Add validation for phone number
        phoneInput.addEventListener('input', function() {
            const countryCode = countryCodeSelect.value;
            const phoneNumber = this.value.trim();
            
            if (phoneNumber === '') {
                removeError(this);
            } else if (countryCode === '') {
                showError(this, 'Please select a country code first');
            } else if (!validatePhoneNumber(phoneNumber, countryCode)) {
                showError(this, 'Please enter a valid phone number for the selected country');
            } else {
                // Only add success class during typing
                this.classList.add('input-success-field');
            }
        });
        
        // Show success message only when field loses focus
        phoneInput.addEventListener('blur', function() {
            const countryCode = countryCodeSelect.value;
            const phoneNumber = this.value.trim();
            
            if (phoneNumber !== '' && countryCode !== '' && validatePhoneNumber(phoneNumber, countryCode)) {
                showSuccess(this, 'Valid phone number');
            }
        });
        
        // Add form submission validation
        if (form) {
            form.addEventListener('submit', function(event) {
                const countryCode = countryCodeSelect.value;
                const phoneNumber = phoneInput.value.trim();
                
                if (phoneNumber && (countryCode === '' || !validatePhoneNumber(phoneNumber, countryCode))) {
                    event.preventDefault();
                    showError(phoneInput, 'Please enter a valid phone number with country code');
                    phoneInput.focus();
                }
                
                // Combine country code and phone number into the original emergency contact field
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'emergencyContact';
                hiddenInput.value = countryCode + phoneNumber;
                form.appendChild(hiddenInput);
            });
        }
    }
});