document.addEventListener('DOMContentLoaded', function() {
    // Get password fields
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const usernameInput = document.getElementById('username');
    const form = document.querySelector('form');
    
    // Only proceed if we're on a page with these elements (registration form)
    if (passwordInput && confirmPasswordInput && form) {
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
        
        // Check if username is already taken
        let usernameTimer;
        
        usernameInput.addEventListener('input', function() {
            const username = this.value.trim();
            
            // Clear any existing timer
            clearTimeout(usernameTimer);
            
            // Remove any existing messages
            removeError(this);
            const parent = this.parentNode;
            const successDiv = parent.querySelector('.input-success');
            if (successDiv) {
                parent.removeChild(successDiv);
            }
            
            // Remove success class
            this.classList.remove('input-success-field');
            
            // Don't check empty usernames
            if (username === '') {
                return;
            }
            
            // Set a timer to check username after user stops typing
            usernameTimer = setTimeout(function() {
                // Make AJAX request to check username
                fetch(`/check-username/?username=${encodeURIComponent(username)}`)
                    .then(response => response.json())
                    .then(data => {
                        // Remove any existing messages first
                        removeError(usernameInput);
                        const parent = usernameInput.parentNode;
                        const successDiv = parent.querySelector('.input-success');
                        if (successDiv) {
                            parent.removeChild(successDiv);
                        }
                        
                        if (data.available) {
                            // Username is available
                            usernameInput.classList.add('input-success-field');
                        } else {
                            // Username is taken
                            usernameInput.classList.remove('input-success-field');
                            showError(usernameInput, data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Error checking username:', error);
                    });
            }, 500); // Wait 500ms after user stops typing
        });
        
        // Show success message only when username field loses focus
        usernameInput.addEventListener('blur', function() {
            const username = this.value.trim();
            
            if (username !== '' && this.classList.contains('input-success-field')) {
                // Remove any existing error messages first
                removeError(this);
                showSuccess(this, 'Username is available');
            }
        });
        
        // Function to validate password length (at least 8 characters)
        function validatePasswordLength(password) {
            return password.length >= 8;
        }
        
        // Real-time password validation
        function validatePassword() {
            const password = passwordInput.value;
            
            if (password === '') {
                removeError(passwordInput);
                return true;
            }
            
            if (!validatePasswordLength(password)) {
                const charsNeeded = 8 - password.length;
                showError(passwordInput, `Password must be at least 8 characters. ${charsNeeded} more character${charsNeeded !== 1 ? 's' : ''} needed.`);
                return false;
            } else {
                removeError(passwordInput);
                passwordInput.classList.add('input-success-field');
                return true;
            }
        }
        
        // Real-time password matching validation
        function checkPasswordsMatch() {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            if (confirmPassword === '') {
                removeError(confirmPasswordInput);
                return true;
            }
            
            if (password !== confirmPassword) {
                showError(confirmPasswordInput, 'Passwords do not match');
                return false;
            } else {
                // Only add success class during typing
                confirmPasswordInput.classList.add('input-success-field');
                return true;
            }
        }
        
        // Add input event listeners for real-time validation
        passwordInput.addEventListener('input', function() {
            // If field is empty, remove success message too
            if (this.value === '') {
                removeError(this);
                // Remove success message
                const parent = this.parentNode;
                const successDiv = parent.querySelector('.input-success');
                if (successDiv) {
                    parent.removeChild(successDiv);
                }
                this.classList.remove('input-success-field');
                // Clear all validation messages and classes when field is empty
                const successElements = document.querySelectorAll('.success-message');
                successElements.forEach(el => el.remove());
            } else {
                validatePassword();
                checkPasswordsMatch();
            }
        });
        confirmPasswordInput.addEventListener('input', function() {
            // If field is empty, remove success message too
            if (this.value === '') {
                removeError(this);
                // Remove success message
                const parent = this.parentNode;
                const successDiv = parent.querySelector('.input-success');
                if (successDiv) {
                    parent.removeChild(successDiv);
                }
                this.classList.remove('input-success-field');
                // Clear all validation messages and classes when field is empty
                const successElements = document.querySelectorAll('.success-message');
                successElements.forEach(el => el.remove());
            } else {
                checkPasswordsMatch();
            }
        });
        
        // Show success message when password field loses focus
        passwordInput.addEventListener('blur', function() {
            const password = this.value;
            
            if (password !== '' && validatePasswordLength(password)) {
                showSuccess(this, 'Password meets minimum length requirement');
            }
        });
        
        // Show success message only when confirm password field loses focus
        confirmPasswordInput.addEventListener('blur', function() {
            const password = passwordInput.value;
            const confirmPassword = this.value;
            
            if (confirmPassword !== '' && password === confirmPassword) {
                showSuccess(this, 'Passwords match');
            }
        });
        
        // Add form submission event listener
        form.addEventListener('submit', function(event) {
            // Validate password length
            if (!validatePassword()) {
                event.preventDefault();
                passwordInput.focus();
                return;
            }
            
            // Validate passwords match
            if (!checkPasswordsMatch()) {
                event.preventDefault();
                confirmPasswordInput.focus();
                // Don't reset other form fields
            }
        });
    }
});