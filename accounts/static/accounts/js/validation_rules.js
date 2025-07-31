document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const form = document.querySelector('form');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email') || document.getElementById('email'); // Works for both login and register forms
    
    // Determine if this is a registration form or login form
    const isRegistrationForm = !!document.getElementById('fullName');
    
    // Function to create or update error message
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
        successDiv.setAttribute('data-validation-message', 'true');
        
        // Insert after the input
        input.parentNode.insertBefore(successDiv, input.nextSibling);
        
        // Add success class to input
        input.classList.add('input-success-field');
    }
    
    if (form) {
        // Function to validate name (only words and spaces allowed)
        function validateName(name) {
            if (!name) return true; // Empty is handled by required attribute
            
            // Check if name contains only letters and spaces
            return /^[A-Za-z\s]+$/.test(name);
        }
        
        // Function to validate email domain
        function validateEmailDomain(email) {
            if (!email) return true; // Empty is handled by required attribute
            
            // List of valid email domains
            const validDomains = [
                'gmail.com',
                'yahoo.com',
                'outlook.com',
                'hotmail.com',
                'aol.com',
                'icloud.com',
                'protonmail.com',
                'mail.com',
                'zoho.com',
                'yandex.com',
                'live.com',
                'msn.com',
                'me.com',
                'gmx.com',
                'mail.ru'
                // Add more domains as needed
            ];
            
            // Extract domain from email
            const domain = email.split('@')[1];
            
            // Check if domain is in the list of valid domains
            return validDomains.includes(domain);
        }
        
        // Function to validate full name length (at least 12 characters total)
        function validateFullNameLength(fullName) {
            const fullNameLength = (fullName || '').trim().length;
            return fullNameLength >= 12;
        }
        
        // Add input event listeners for real-time validation
        if (isRegistrationForm && fullNameInput) {
            // Function to check and update full name validation message
            function updateFullNameValidation() {
                const fullName = fullNameInput ? fullNameInput.value.trim() : '';
                
                const fullNameLength = fullName.length;
                const charsNeeded = Math.max(0, 12 - fullNameLength);
                
                // Clear all validation when field is empty
                if (fullName === '') {
                    removeError(fullNameInput);
                    fullNameInput.classList.remove('input-success-field');
                    const parent = fullNameInput.parentNode;
                    const successDiv = parent.querySelector('.input-success');
                    if (successDiv) {
                        parent.removeChild(successDiv);
                    }
                    return;
                }
                
                // Check for invalid characters in full name
                if (!validateName(fullName)) {
                    showError(fullNameInput, 'Full name can only contain letters and spaces.');
                    return;
                }
                
                // Show character count message
                if (charsNeeded > 0) {
                    showError(fullNameInput, `${charsNeeded} more character${charsNeeded !== 1 ? 's' : ''} needed in full name.`);
                } else {
                    // Only add success class during typing
                    removeError(fullNameInput);
                    fullNameInput.classList.add('input-success-field');
                }
            }
            
            fullNameInput.addEventListener('input', updateFullNameValidation);
            
            // Show success message only when field loses focus
            fullNameInput.addEventListener('blur', function() {
                const fullName = fullNameInput ? fullNameInput.value.trim() : '';
                
                if (fullName !== '' && validateName(fullName)) {
                    if (fullName.length >= 12) {
                        showSuccess(this, 'Valid full name');
                    }
                }
            });
        }
        
        // Middle name and last name fields have been removed
        
        if (emailInput) {
            emailInput.addEventListener('input', function() {
                if (this.value.trim() === '') {
                    removeError(this);
                    // Also remove success message when field is cleared
                    const parent = this.parentNode;
                    const successDiv = parent.querySelector('.input-success');
                    if (successDiv) {
                        parent.removeChild(successDiv);
                    }
                    this.classList.remove('input-success-field');
                } else if (this.value.includes('@') && !validateEmailDomain(this.value.trim())) {
                    showError(this, 'Please use a valid email domain (e.g., gmail.com, yahoo.com, outlook.com).');
                } else if (this.value.includes('@')) {
                    // Only show success message on blur (when user finishes typing)
                    this.classList.add('input-success-field');
                } else {
                    removeError(this);
                }
            });
            
            // Show success message only when field loses focus
            emailInput.addEventListener('blur', function() {
                if (this.value.trim() !== '' && this.value.includes('@') && validateEmailDomain(this.value.trim())) {
                    showSuccess(this, 'Valid email');
                }
            });
        }
        
        // Add form submission event listener
        form.addEventListener('submit', function(event) {
            let hasError = false;
            
            // Only validate name fields on registration form
            if (isRegistrationForm) {
                // Validate full name
                if (fullNameInput) {
                    const fullName = fullNameInput.value.trim();
                    
                    // Check if full name contains invalid characters
                    if (!validateName(fullName)) {
                        event.preventDefault();
                        showError(fullNameInput, 'Full name can only contain letters and spaces.');
                        fullNameInput.focus();
                        hasError = true;
                    }
                    // Check if full name meets minimum length requirement
                    else if (!validateFullNameLength(fullName)) {
                        event.preventDefault();
                        const charsNeeded = 12 - fullName.length;
                        showError(fullNameInput, `Full name must be at least 12 characters. ${charsNeeded} more character${charsNeeded !== 1 ? 's' : ''} needed.`);
                        fullNameInput.focus();
                        hasError = true;
                    }
                }
            }
            
            // Validate email domain on both forms if it's an email (not a username)
            if (!hasError && emailInput && emailInput.value.includes('@') && !validateEmailDomain(emailInput.value.trim())) {
                event.preventDefault();
                showError(emailInput, 'Please use a valid email domain (e.g., gmail.com, yahoo.com, outlook.com).');
                emailInput.focus();
                hasError = true;
            }
        });
    }
});