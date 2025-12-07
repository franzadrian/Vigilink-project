document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const form = document.querySelector('form');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email') || document.getElementById('email'); // Works for both login and register forms
    
    // Determine if this is a registration form or login form
    const isRegistrationForm = !!document.getElementById('fullName');
    const isLoginForm = document.querySelector('form').action.includes('login');
    
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
        
        // Function to validate full name length (between 4 and 30 characters total)
function validateFullNameLength(fullName) {
    const minLength = 4;
    const maxLength = 30;
    const fullNameLength = (fullName || '').trim().length;
    return fullNameLength >= minLength && fullNameLength <= maxLength;
}
        
        // Add input event listeners for real-time validation
        if (isRegistrationForm && fullNameInput) {
            // Function to check and update full name validation message
            function updateFullNameValidation() {
                const fullName = fullNameInput ? fullNameInput.value.trim() : '';
                
                const fullNameLength = fullName.length;
                const charsNeeded = Math.max(0, 4 - fullNameLength);
                
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
                if (fullNameLength < 4) {
                    const charsNeeded = 4 - fullNameLength;
                    showError(fullNameInput, `${charsNeeded} more character${charsNeeded !== 1 ? 's' : ''} needed in full name.`);
                } else if (fullNameLength > 30) {
                    const charsExcess = fullNameLength - 30;
                    showError(fullNameInput, `Full name too long. Please remove ${charsExcess} character${charsExcess !== 1 ? 's' : ''}.`);
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
                    if (fullName.length >= 4 && fullName.length <= 30) {
                        showSuccess(this, 'Valid full name');
                    }
                }
            });
        }

        // Emergency contact (optional) – digits only, exactly 11 when provided
        const emergencyContactInput = document.getElementById('emergencyContact');
        if (isRegistrationForm && emergencyContactInput) {
            function updateEmergencyContactValidation() {
                const raw = emergencyContactInput.value.trim();

                if (raw === '') {
                    removeError(emergencyContactInput);
                    emergencyContactInput.classList.remove('input-success-field');
                    return;
                }

                if (!/^\d+$/.test(raw)) {
                    showError(emergencyContactInput, 'Numbers only (0-9).');
                    return;
                }

                if (raw.length < 11) {
                    const needed = 11 - raw.length;
                    showError(emergencyContactInput, `${needed} more digit${needed !== 1 ? 's' : ''} needed.`);
                } else if (raw.length > 11) {
                    const excess = raw.length - 11;
                    showError(emergencyContactInput, `Too many digits. Remove ${excess}.`);
                } else {
                    removeError(emergencyContactInput);
                    emergencyContactInput.classList.add('input-success-field');
                }
            }

            emergencyContactInput.addEventListener('input', updateEmergencyContactValidation);
            emergencyContactInput.addEventListener('blur', function() {
                const raw = emergencyContactInput.value.trim();
                if (raw !== '' && /^\d{11}$/.test(raw)) {
                    showSuccess(emergencyContactInput, 'Valid emergency contact');
                }
            });
        }

        // Middle name and last name fields have been removed
        
        if (emailInput) {
            // Timer for email validation
            let emailTimer;
            
            emailInput.addEventListener('input', function() {
                const email = this.value.trim();
                
                // Clear any existing timer
                clearTimeout(emailTimer);
                
                if (email === '') {
                    removeError(this);
                    // Also remove success message when field is cleared
                    const parent = this.parentNode;
                    const successDiv = parent.querySelector('.input-success');
                    if (successDiv) {
                        parent.removeChild(successDiv);
                    }
                    this.classList.remove('input-success-field');
                } else if (!isLoginForm && email.includes('@') && !validateEmailDomain(email)) {
                    showError(this, 'Please use a valid email domain (e.g., gmail.com, yahoo.com, outlook.com).');
                } else if (email.includes('@') && isRegistrationForm) {
                    // Only check for existing emails on registration form, not login form
                    // Set a timer to check email after user stops typing
                    emailTimer = setTimeout(function() {
                        // Make AJAX request to check if email exists
                        fetch(`/check-email/?email=${encodeURIComponent(email)}`)
                            .then(response => response.json())
                            .then(data => {
                                // Remove any existing messages first
                                removeError(emailInput);
                                const parent = emailInput.parentNode;
                                const successDiv = parent.querySelector('.input-success');
                                if (successDiv) {
                                    parent.removeChild(successDiv);
                                }
                                
                                if (data.available) {
                                    // Email is available
                                    emailInput.classList.add('input-success-field');
                                } else {
                                    // Email is already registered
                                    emailInput.classList.remove('input-success-field');
                                    showError(emailInput, 'This email is already registered. Please use a different email or login.');
                                }
                            })
                            .catch(error => {
                                console.error('Error checking email:', error);
                            });
                    }, 500); // Wait 500ms after user stops typing
                } else if (email.includes('@')) {
                    // For login form, just validate the email format
                    removeError(this);
                    // Don't add success class for login form - keep it neutral
                } else {
                    removeError(this);
                }
            });
            
            // Show success message only when field loses focus
            emailInput.addEventListener('blur', function() {
                const email = this.value.trim();
                
                // For registration form, show success message if email is valid and available
                if (isRegistrationForm && email !== '' && email.includes('@') && validateEmailDomain(email) && this.classList.contains('input-success-field')) {
                    showSuccess(this, 'Valid email');
                }
                
                // For login form, don't add success styling - keep it neutral
                // Removed: this.classList.add('input-success-field');
            });
        }
        
        // Function to check if all fields are valid
        function areAllFieldsValid() {
            // Check if there are any error messages displayed
            const errorMessages = document.querySelectorAll('.input-error');
            if (errorMessages.length > 0) {
                return false;
            }
            
            // For login form, just check basic requirements
            if (isLoginForm) {
                // Check email format
                if (emailInput) {
                    const email = emailInput.value.trim();
                    if (!email.includes('@')) {
                        return false;
                    }
                }
                
                // Check password is not empty
                const passwordInput = document.getElementById('password');
                if (passwordInput && !passwordInput.value.trim()) {
                    return false;
                }
                
                return true;
            }
            
            // For registration form, check all required fields
            if (isRegistrationForm) {
                // Check full name
                if (fullNameInput) {
                    const fullName = fullNameInput.value.trim();
                    if (!validateName(fullName) || !validateFullNameLength(fullName)) {
                        return false;
                    }
                }
                
                // Check email
                if (emailInput) {
                    const email = emailInput.value.trim();
                    if (!email.includes('@') || !validateEmailDomain(email) || !emailInput.classList.contains('input-success-field')) {
                        return false;
                    }
                }
                
                // Check password and confirm password
                const passwordInput = document.getElementById('password');
                const confirmPasswordInput = document.getElementById('confirmPassword');
                if (passwordInput && confirmPasswordInput) {
                    if (!passwordInput.classList.contains('input-success-field') || !confirmPasswordInput.classList.contains('input-success-field')) {
                        return false;
                    }
                }
                
                // Check username
                const usernameInput = document.getElementById('username');
                if (usernameInput) {
                    const username = usernameInput.value.trim();
                    // Import validateUsername function from password_validation.js
                    if (typeof validateUsername === 'function') {
                        const usernameValidation = validateUsername(username);
                        if (!usernameValidation.valid || !usernameInput.classList.contains('input-success-field')) {
                            return false;
                        }
                    } else if (!usernameInput.classList.contains('input-success-field')) {
                        return false;
                    }
                }
                
                // Check if city and district are selected
                const citySelect = document.getElementById('city');
                const districtSelect = document.getElementById('district');
                if (citySelect && districtSelect) {
                    if (!citySelect.value || !districtSelect.value) {
                        return false;
                    }
                }
                
                // Check emergency contact (optional): if present, must be exactly 11 digits
                const emergencyContactInput = document.getElementById('emergencyContact');
                if (emergencyContactInput) {
                    const val = emergencyContactInput.value.trim();
                    if (val !== '' && !/^\d{11}$/.test(val)) {
                        return false;
                    }
                }
            }
            
            return true;
        }
        
        // Function to update submit button state
        function updateSubmitButtonState() {
            if (isRegistrationForm) {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    if (areAllFieldsValid()) {
                        submitButton.disabled = false;
                        submitButton.classList.remove('disabled-btn');
                    } else {
                        submitButton.disabled = true;
                        submitButton.classList.add('disabled-btn');
                    }
                }
            }
        }
        
        // Add event listeners to all form inputs to update submit button state
        if (isRegistrationForm) {
            const formInputs = form.querySelectorAll('input, select');
            formInputs.forEach(input => {
                input.addEventListener('input', updateSubmitButtonState);
                input.addEventListener('change', updateSubmitButtonState);
                input.addEventListener('blur', updateSubmitButtonState);
            });
            
            // Initial state
            document.addEventListener('DOMContentLoaded', function() {
                updateSubmitButtonState();
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
                    // Check if full name meets length requirement (4-30 characters)
                    else if (!validateFullNameLength(fullName)) {
                        event.preventDefault();
                        if (fullName.length < 4) {
                            const charsNeeded = 4 - fullName.length;
                            showError(fullNameInput, `Full name must be at least 4 characters. ${charsNeeded} more character${charsNeeded !== 1 ? 's' : ''} needed.`);
                        } else if (fullName.length > 30) {
                            const charsExcess = fullName.length - 30;
                            showError(fullNameInput, `Full name must be at most 30 characters. Please remove ${charsExcess} character${charsExcess !== 1 ? 's' : ''}.`);
                        }
                        fullNameInput.focus();
                        hasError = true;
                    }
                }
                
                // Validate emergency contact (optional)
                const emergencyContactInput = document.getElementById('emergencyContact');
                if (!hasError && emergencyContactInput) {
                    const val = emergencyContactInput.value.trim();
                    if (val !== '' && !/^\d{11}$/.test(val)) {
                        event.preventDefault();
                        showError(emergencyContactInput, 'Emergency contact must be exactly 11 digits (numbers only).');
                        emergencyContactInput.focus();
                        hasError = true;
                    }
                }

                // Check if all fields are valid
                if (!areAllFieldsValid()) {
                    event.preventDefault();
                    hasError = true;
                }
            }
            
            // Validate email domain only on registration form; allow any email on login
            if (!hasError && !isLoginForm && emailInput && emailInput.value.includes('@') && !validateEmailDomain(emailInput.value.trim())) {
                event.preventDefault();
                showError(emailInput, 'Please use a valid email domain (e.g., gmail.com, yahoo.com, outlook.com).');
                emailInput.focus();
                hasError = true;
            }
        });
    }
});
