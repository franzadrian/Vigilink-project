document.addEventListener('DOMContentLoaded', function() {
    const middleNameInput = document.getElementById('middleName');
    const form = document.querySelector('form');
    
    if (middleNameInput && form) {
        // Function to validate middle name (not just initials)
        function validateMiddleName(middleName) {
            if (!middleName) return true; // Middle name is optional
            
            // Check if it's just a single letter or initials (e.g., "A" or "A." or "A.B.")
            const initialsPattern = /^[A-Z](\.[A-Z])*\.?$/;
            const singleLetterPattern = /^[A-Z]$/;
            
            if (initialsPattern.test(middleName) || singleLetterPattern.test(middleName)) {
                return false; // It's just initials or a single letter
            }
            
            return true; // It's a full name
        }
        
        // Add form submission event listener
        form.addEventListener('submit', function(event) {
            const middleName = middleNameInput.value.trim();
            
            if (middleName && !validateMiddleName(middleName)) {
                event.preventDefault();
                alert('Please enter your full middle name, not just initials.');
                middleNameInput.focus();
            }
        });
    }
});