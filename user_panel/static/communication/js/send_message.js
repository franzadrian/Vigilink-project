// send_message.js - Handles sending messages between users

document.addEventListener('DOMContentLoaded', function() {
    // Get references to the message form elements
    const messageModal = document.getElementById('messageModal');
    const messageForm = document.getElementById('messageForm');
    const receiverInput = document.getElementById('messageReceiverSearch');
    const receiverHiddenInput = document.getElementById('messageReceiver');
    const searchResults = document.getElementById('userSearchResults');
    const messageContent = document.getElementById('messageContent');
    const newMessageBtn = document.querySelector('.create-post-btn');
    
    // Add event listener to the "New Message" button
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', function() {
            // Show the message modal
            messageModal.classList.add('show');
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === messageModal) {
            messageModal.classList.remove('show');
        }
    });
    
    // Close modal when clicking the close button
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            messageModal.classList.remove('show');
        });
    });
    
    // Add user search functionality
    if (receiverInput) {
        receiverInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            
            if (searchTerm.length < 2) {
                searchResults.classList.remove('show');
                return;
            }
            
            // Get CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            // Fetch users matching the search term
            fetch('/user/communication/search-users/?term=' + encodeURIComponent(searchTerm), {
                method: 'GET',
                headers: {
                    'X-CSRFToken': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                // Clear previous results
                searchResults.innerHTML = '';
                
                if (data.users && data.users.length > 0) {
                    // Add each user to the results
                    data.users.forEach(user => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'search-result-item';
                        resultItem.textContent = user.full_name || user.username;
                        resultItem.dataset.userId = user.id;
                        
                        // Add click event to select the user
                        resultItem.addEventListener('click', function() {
                            receiverHiddenInput.value = this.dataset.userId;
                            receiverInput.value = this.textContent;
                            searchResults.classList.remove('show');
                        });
                        
                        searchResults.appendChild(resultItem);
                    });
                    
                    searchResults.classList.add('show');
                } else {
                    // No results found
                    const noResults = document.createElement('div');
                    noResults.className = 'search-result-item';
                    noResults.textContent = 'No users found';
                    searchResults.appendChild(noResults);
                    searchResults.classList.add('show');
                }
            })
            .catch(error => {
                console.error('Error searching users:', error);
            });
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(event) {
            if (event.target !== receiverInput && event.target !== searchResults) {
                searchResults.classList.remove('show');
            }
        });
    }
    
    // Handle form submission
    if (messageForm) {
        messageForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Get form data
            const receiver = receiverHiddenInput.value;
            const message = messageContent.value;
            
            // Validate form data
            if (!receiver || !message.trim()) {
                showAlert('Please select a recipient and enter a message', 'error');
                return;
            }
            
            // Create form data for submission
            const formData = new FormData();
            formData.append('receiver', receiver);
            formData.append('message', message);
            
            // Get CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            // Send the message
            fetch('/user/communication/send/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Show success message
                    showAlert('Message sent successfully', 'success');
                    
                    // Clear form
                    messageContent.value = '';
                    
                    // Close modal
                    messageModal.classList.remove('show');
                    
                    // Refresh messages list (optional)
                    location.reload();
                } else {
                    // Show error message
                    showAlert(data.message || 'Failed to send message', 'error');
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
                showAlert('An error occurred while sending the message', 'error');
            });
        });
    }
    
    // Function to show alerts
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        // Add the alert to the page
        const alertContainer = document.querySelector('.alert-container') || document.body;
        alertContainer.appendChild(alertDiv);
        
        // Remove the alert after 3 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
    
    // Mark message as read when clicked
    const messageItems = document.querySelectorAll('.message-item');
    messageItems.forEach(item => {
        item.addEventListener('click', function() {
            const messageId = this.dataset.messageId;
            if (messageId) {
                fetch(`/user/communication/mark-read/${messageId}/`, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Mark as read in UI
                        this.classList.remove('unread');
                    }
                })
                .catch(error => {
                    console.error('Error marking message as read:', error);
                });
            }
        });
    });
});