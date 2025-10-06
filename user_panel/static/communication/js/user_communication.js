// Global state
let selectedUser = null;
let messages = [];
let isMobile = window.innerWidth < 768;
let csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

// DOM elements
const userList = document.querySelector('.user-list');
const userItems = document.querySelectorAll('.user-item');
const searchInput = document.querySelector('#user-search');
const messagesList = document.querySelector('#messages-list');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-btn');
const welcomeScreen = document.querySelector('#welcome-screen');
const chatMessages = document.querySelector('#chat-messages');
const backButton = document.querySelector('#back-to-users');
const messageForm = document.querySelector('#message-form');
const scrollToBottomBtn = document.querySelector('#scroll-to-bottom');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // If messages list exists, scroll to bottom on page load
    if (messagesList) {
        scrollToBottom();
        // Multiple delayed scrolls to ensure it works with any dynamic content
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
        setTimeout(scrollToBottom, 500);
        setTimeout(scrollToBottom, 1000);
        
        // Add event delegation for edit and delete buttons
        messagesList.addEventListener('click', function(e) {
            // Check if edit button was clicked
            if (e.target.closest('.edit-btn')) {
                const messageItem = e.target.closest('.message-item');
                if (messageItem) {
                    const messageId = messageItem.dataset.messageId;
                    startEditingMessage(messageItem, messageId);
                }
            }
            
            // Check if delete button was clicked
            if (e.target.closest('.delete-btn')) {
                const messageItem = e.target.closest('.message-item');
                if (messageItem) {
                    const messageId = messageItem.dataset.messageId;
                    deleteMessage(messageItem, messageId);
                }
            }
        });
    }
    
    // Set up event listeners
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    if (messageInput) {
        // Set maxlength attribute to limit input to 500 characters
        messageInput.setAttribute('maxlength', '500');
        messageInput.addEventListener('input', () => {
            updateSendButton();
            updateCharCount();
        });
        // Initialize character counter
        updateCharCount();
    }

    if (backButton) {
        backButton.addEventListener('click', deselectUser);
    }

    if (scrollToBottomBtn) {
        scrollToBottomBtn.addEventListener('click', scrollToBottom);
    }
    
    // Add scroll event listener to messages list to show/hide scroll-to-bottom button
    if (messagesList) {
        messagesList.addEventListener('scroll', () => {
            // Show button when not at bottom
            const isAtBottom = messagesList.scrollHeight - messagesList.scrollTop <= messagesList.clientHeight + 100;
            if (scrollToBottomBtn) {
                scrollToBottomBtn.classList.toggle('visible', !isAtBottom);
            }
        });
    }

    // Add click event to user items
    userItems.forEach(item => {
        item.addEventListener('click', () => {
            const userId = parseInt(item.dataset.userId);
            selectUser(userId);
        });
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
    });

    // Initialize send button state
    updateSendButton();
    
    // Show welcome screen by default on desktop
    if (!isMobile) {
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden');
        }
        if (chatMessages) {
            chatMessages.classList.add('hidden');
        }
    }
    
    // Auto-select user if URL has user_id parameter
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('user_id');
    if (userIdParam) {
        const userId = parseInt(userIdParam);
        const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
        if (userItem) {
            selectUser(userId);
        }
    }
});

// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const searchResults = document.getElementById('search-results');
    
    if (searchTerm.length < 2) {
        // If search term is too short, restore original user list
        // First, hide any dynamically created search results
        const dynamicResults = document.querySelectorAll('.search-result-item');
        dynamicResults.forEach(item => item.remove());
        
        // Show original user items
        userItems.forEach(item => {
            item.style.display = 'flex';
        });
        
        // Hide no results message
        const noResultsElement = document.querySelector('.no-users');
        if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }
        return;
    }
    
    // If search term is long enough, fetch users from server
    fetch(`/user/search-users/?term=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.users) {
                // First, hide all original user items
                userItems.forEach(item => {
                    item.style.display = 'none';
                });
                
                // Remove any previous search result items
                const dynamicResults = document.querySelectorAll('.search-result-item');
                dynamicResults.forEach(item => item.remove());
                
                // Add users to search results
                if (data.users.length > 0) {
                    data.users.forEach(user => {
                        const userItem = createUserItem(user);
                        userItem.classList.add('search-result-item'); // Mark as search result
                        searchResults.appendChild(userItem);
                    });
                    
                    // Hide no results message
                    const noUsersElement = document.querySelector('.no-users');
                    if (noUsersElement) {
                        noUsersElement.style.display = 'none';
                    }
                } else {
                    // Show no results message
                    let noUsersElement = document.querySelector('.no-users');
                    if (noUsersElement) {
                        noUsersElement.style.display = 'block';
                        noUsersElement.textContent = 'No users found matching your search';
                    } else {
                        noUsersElement = document.createElement('div');
                        noUsersElement.className = 'no-users';
                        noUsersElement.textContent = 'No users found matching your search';
                        searchResults.appendChild(noUsersElement);
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error searching users:', error);
        });
}

// Create user item element
function createUserItem(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = user.id;
    userItem.dataset.username = user.username;
    userItem.dataset.fullname = user.full_name || '';
    userItem.dataset.email = user.email || '';
    
    // Create avatar
    const userAvatar = document.createElement('div');
    userAvatar.className = 'user-avatar';
    
    const avatarText = document.createElement('span');
    avatarText.className = 'avatar-text';
    const initials = user.full_name ? 
        user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 
        user.username.substring(0, 2).toUpperCase();
    avatarText.textContent = initials;
    
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator';
    
    userAvatar.appendChild(avatarText);
    userAvatar.appendChild(statusIndicator);
    
    // Create user info
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = user.full_name || user.username;
    
    const lastMessage = document.createElement('div');
    lastMessage.className = 'last-message';
    lastMessage.textContent = 'No messages yet';
    
    userInfo.appendChild(userName);
    userInfo.appendChild(lastMessage);
    
    // Create message time
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    
    // Assemble user item
    userItem.appendChild(userAvatar);
    userItem.appendChild(userInfo);
    userItem.appendChild(messageTime);
    
    // Add click event
    userItem.addEventListener('click', () => {
        selectUser(user.id);
    });
    
    return userItem;
}

// Scroll to bottom of messages
function scrollToBottom() {
    if (messagesList) {
        // Force layout recalculation to get accurate scrollHeight
        const scrollHeight = messagesList.scrollHeight;
        messagesList.scrollTop = scrollHeight;
        
        // Force scroll to bottom with multiple attempts
        // Try immediately
        requestAnimationFrame(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        });
        
        // Try with increasing delays to ensure it works
        setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 50);
        
        setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 100);
        
        // Add more aggressive attempts with longer delays
        setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 200);
        
        setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 300);
    }
}

// Update last message in user list
function updateLastMessage(userId, message) {
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (userItem) {
        const lastMessageElement = userItem.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message;
        }
        
        const lastMessageTimeElement = userItem.querySelector('.message-time');
        if (lastMessageTimeElement) {
            lastMessageTimeElement.textContent = 'Just now';
        }
        
        // Move user to top of list
        const parent = userItem.parentNode;
        if (parent) {
            parent.prepend(userItem);
        }
    }
}

// Update send button state
function updateSendButton() {
    if (sendButton) {
        sendButton.disabled = !messageInput.value.trim();
        sendButton.classList.toggle('disabled', !messageInput.value.trim());
    }
}

// Update character count
function updateCharCount() {
    const charCount = document.getElementById('char-count');
    if (charCount && messageInput) {
        const currentLength = messageInput.value.length;
        const maxLength = messageInput.getAttribute('maxlength');
        const remainingChars = maxLength - currentLength;
        charCount.textContent = remainingChars;
        
        // Change color when approaching the limit
        charCount.classList.remove('warning', 'danger');
        if (remainingChars <= 100) {
            charCount.classList.add('warning');
        }
        if (remainingChars <= 50) {
            charCount.classList.add('danger');
        }
    }
}

// Format time
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Start editing a message
function startEditingMessage(messageItem, messageId) {
    // Don't allow editing temporary messages
    if (messageId.toString().startsWith('temp-')) {
        return;
    }
    
    // Get the message content
    const messageContent = messageItem.querySelector('.message-content');
    const messageParagraph = messageContent.querySelector('p');
    const originalText = messageParagraph.textContent;
    
    // Create edit form
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-message-container';
    editContainer.innerHTML = `
        <textarea class="edit-message-input">${originalText}</textarea>
        <div class="edit-message-actions">
            <button class="edit-message-btn save-edit-btn">Save</button>
            <button class="edit-message-btn cancel-edit-btn">Cancel</button>
        </div>
    `;
    
    // Replace message content with edit form
    messageContent.innerHTML = '';
    messageContent.appendChild(editContainer);
    
    // Focus on textarea
    const textarea = editContainer.querySelector('.edit-message-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // Add event listeners for save and cancel buttons
    const saveBtn = editContainer.querySelector('.save-edit-btn');
    const cancelBtn = editContainer.querySelector('.cancel-edit-btn');
    
    saveBtn.addEventListener('click', () => {
        saveMessageEdit(messageItem, messageId, textarea.value.trim(), originalText);
    });
    
    cancelBtn.addEventListener('click', () => {
        cancelMessageEdit(messageItem, originalText);
    });
    
    // Add event listener for Enter key
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveMessageEdit(messageItem, messageId, textarea.value.trim(), originalText);
        }
        if (e.key === 'Escape') {
            cancelMessageEdit(messageItem, originalText);
        }
    });
}

// Save message edit
function saveMessageEdit(messageItem, messageId, newText, originalText) {
    // Don't save if text is empty or unchanged
    if (!newText || newText === originalText) {
        cancelMessageEdit(messageItem, originalText);
        return;
    }
    
    // Send edit to server
    fetch('/user/communication/edit-message/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message_id: messageId,
            new_content: newText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update message in DOM
            const messageContent = messageItem.querySelector('.message-content');
            
            messageContent.innerHTML = `
                <p>${newText}</p>
                <span class="edited-indicator">edited</span>
                <div class="message-actions">
                    <button class="message-action-btn more-options-btn" title="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="message-options-menu hidden">
                        <button class="message-option edit-btn" title="Edit message">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="message-option delete-btn" title="Delete message">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners for the new buttons
            const moreOptionsBtn = messageContent.querySelector('.more-options-btn');
            const optionsMenu = messageContent.querySelector('.message-options-menu');
            const editBtn = messageContent.querySelector('.edit-btn');
            const deleteBtn = messageContent.querySelector('.delete-btn');
            
            if (moreOptionsBtn && optionsMenu) {
                moreOptionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.toggle('hidden');
                });
            }
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.add('hidden');
                    startEditingMessage(messageItem, messageId);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.add('hidden');
                    deleteMessage(messageItem, messageId);
                });
            }
            
            // Show success alert
            const alertOverlay = document.createElement('div');
            alertOverlay.className = 'custom-alert-overlay';
            alertOverlay.innerHTML = `
                <div class="custom-alert success">
                    <div class="custom-alert-header">
                        <h3>Success</h3>
                    </div>
                    <div class="custom-alert-body">
                        <p>Message edited successfully!</p>
                    </div>
                    <div class="custom-alert-footer">
                        <button class="custom-alert-btn confirm-btn">OK</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(alertOverlay);
            
            // Auto-dismiss after 2 seconds
            setTimeout(() => {
                if (document.body.contains(alertOverlay)) {
                    document.body.removeChild(alertOverlay);
                }
            }, 2000);
            
            // Add event listener for OK button
            const okBtn = alertOverlay.querySelector('.confirm-btn');
            okBtn.addEventListener('click', () => {
                if (document.body.contains(alertOverlay)) {
                    document.body.removeChild(alertOverlay);
                }
            });
            
            // Update message in memory
            const message = messages.find(m => m.id === messageId);
            if (message) {
                message.message = newText;
                message.is_edited = true;
            }
        } else {
            // Show error and revert
            alert('Failed to edit message: ' + (data.error || 'Unknown error'));
            cancelMessageEdit(messageItem, originalText);
        }
    })
    .catch(error => {
        console.error('Error editing message:', error);
        alert('Failed to edit message. Please try again.');
        cancelMessageEdit(messageItem, originalText);
    });
}

// Cancel message edit
function cancelMessageEdit(messageItem, originalText) {
    const messageContent = messageItem.querySelector('.message-content');
    const message = messages.find(m => m.id === messageItem.dataset.messageId);
    
    messageContent.innerHTML = `
         ${message && message.is_edited ? '<div class="edited-indicator">edited</div>' : ''}
        <p>${originalText}</p>
        <div class="message-actions">
            <button class="message-action-btn more-options-btn" title="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="message-options-menu hidden">
                <button class="message-option edit-btn" title="Edit message">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="message-option delete-btn" title="Delete message">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners for the new buttons
    const moreOptionsBtn = messageContent.querySelector('.more-options-btn');
    const optionsMenu = messageContent.querySelector('.message-options-menu');
    const editBtn = messageContent.querySelector('.edit-btn');
    const deleteBtn = messageContent.querySelector('.delete-btn');
    
    if (moreOptionsBtn && optionsMenu) {
        moreOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsMenu.classList.toggle('hidden');
        });
    }
    
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsMenu.classList.add('hidden');
            startEditingMessage(messageItem, messageItem.dataset.messageId);
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsMenu.classList.add('hidden');
            deleteMessage(messageItem, messageItem.dataset.messageId);
        });
    }
}

// Delete message
function deleteMessage(messageItem, messageId) {
    // Don't allow deleting temporary messages
    if (messageId.toString().startsWith('temp-')) {
        return;
    }
    
    // Create custom alert for deletion confirmation
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'custom-alert-overlay';
    alertOverlay.innerHTML = `
        <div class="custom-alert">
            <div class="custom-alert-header">
                <h3>Delete Message</h3>
            </div>
            <div class="custom-alert-body">
                <p>Are you sure you want to delete this message?</p>
            </div>
            <div class="custom-alert-footer">
                <button class="custom-alert-btn cancel-btn">Cancel</button>
                <button class="custom-alert-btn confirm-btn">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(alertOverlay);
    
    // Add event listeners for buttons
    const cancelBtn = alertOverlay.querySelector('.cancel-btn');
    const confirmBtn = alertOverlay.querySelector('.confirm-btn');
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(alertOverlay);
    });
    
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(alertOverlay);
        
        // Send delete request to server
        fetch('/user/communication/delete-message/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message_id: messageId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update message in DOM
                const messageContent = messageItem.querySelector('.message-content');
                
                // Show success alert
                const successAlert = document.createElement('div');
                successAlert.className = 'custom-alert-overlay';
                successAlert.innerHTML = `
                    <div class="custom-alert success">
                        <div class="custom-alert-header">
                            <h3>Success</h3>
                        </div>
                        <div class="custom-alert-body">
                            <p>Message deleted successfully!</p>
                        </div>
                        <div class="custom-alert-footer">
                            <button class="custom-alert-btn confirm-btn">OK</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(successAlert);
                
                // Auto-dismiss after 2 seconds
                setTimeout(() => {
                    if (document.body.contains(successAlert)) {
                        document.body.removeChild(successAlert);
                    }
                }, 2000);
                
                // Add event listener for OK button
                const deleteSuccessBtn = successAlert.querySelector('.confirm-btn');
                deleteSuccessBtn.addEventListener('click', () => {
                    if (document.body.contains(successAlert)) {
                        document.body.removeChild(successAlert);
                    }
                });
                
                messageContent.innerHTML = `
                    <p class="deleted-message" style="color: #6b7280; font-style: italic; padding: 8px 12px; text-align: center; margin: 5px 0; background-color: white;">This message has been deleted</p>
                `;
                
                // Update message in memory
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    message.is_deleted = true;
                    // Keep the message content for reference but mark as deleted
                    // This ensures the deleted state persists after refresh
                }
            } else {
                // Show error
                alert('Failed to delete message: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
            alert('Failed to delete message. Please try again.');
        });
    });
}

// Select user
function selectUser(userId) {
    selectedUser = userId;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.userId) === userId);
    });

    // Update header
    const selectedUserItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (selectedUserItem) {
        const userName = selectedUserItem.querySelector('.user-name').textContent;
        const userAvatarImg = selectedUserItem.querySelector('.avatar-image');
        const userInitials = selectedUserItem.querySelector('.avatar-text');
        const isOnline = false; // Status indicators were removed from user list
        
        const userNameHeader = document.querySelector('#selected-user-name');
        if (userNameHeader) {
            userNameHeader.textContent = userName;
        }
        
        const userAvatarHeader = document.querySelector('#selected-user-avatar');
        const userAvatarHeaderImg = document.querySelector('#selected-user-avatar-img');
        
        if (userAvatarImg) {
            // User has a profile picture
            if (userAvatarHeaderImg) {
                userAvatarHeaderImg.src = userAvatarImg.src;
                userAvatarHeaderImg.style.display = 'block';
                if (userAvatarHeader) {
                    userAvatarHeader.style.display = 'none';
                }
            }
        } else {
            // User has no profile picture, show initials
            if (userAvatarHeaderImg) {
                userAvatarHeaderImg.style.display = 'none';
            }
            if (userAvatarHeader && userInitials) {
                userAvatarHeader.textContent = userInitials.textContent;
                userAvatarHeader.style.display = 'block';
            }
        }
        
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        }
    }

    // Show chat and hide welcome screen
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');

    // On mobile, hide user list
    if (isMobile && userList) {
        userList.classList.add('hidden');
    }

    // Fetch and render messages
    fetchMessages(userId);
    
    // Focus on message input
    if (messageInput) messageInput.focus();
    
    // Ensure we scroll to bottom after selecting a user
    setTimeout(scrollToBottom, 300);
    setTimeout(scrollToBottom, 500);
    setTimeout(scrollToBottom, 1000);
    setTimeout(scrollToBottom, 1500);
    setTimeout(scrollToBottom, 2000);
}

// Deselect user
function deselectUser() {
    selectedUser = null;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show welcome screen and hide chat
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (chatMessages) chatMessages.classList.add('hidden');

    // On mobile, show user list
    if (isMobile && userList) {
        userList.classList.remove('hidden');
    }
}

// Fetch messages from server
function fetchMessages(userId) {
    if (!userId) return;
    
    // Show loading indicator
    messagesList.innerHTML = '<div class="loading-messages">Loading messages...</div>';
    
    // Fetch messages from server
    fetch(`/user/communication/messages/?user_id=${userId}`, {
        method: 'GET',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        messages = data;
        renderMessages();
    })
    .catch(error => {
        console.error('Error fetching messages:', error);
        messagesList.innerHTML = `
            <div class="error-container">
                <div class="error-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="error-text">Failed to load messages</div>
            </div>
        `;
    });
}

// Function to append a single new message to the DOM without re-rendering everything
function appendNewMessage(message) {
    if (!messagesList) return;
    
    // Initialize messages list if it's empty
    if (messages.length === 1) { // This is the first message
        messagesList.innerHTML = ''; // Clear the "No messages yet" display
    }
    
    const currentMessageDate = new Date(message.sent_at);
    
    // Check if we need to add a timestamp divider
    let needsTimestampDivider = false;
    
    if (messages.length === 1) { // This is the first message
        needsTimestampDivider = true;
    } else {
        // Find the previous message's date
        const otherMessages = messages.filter(m => m !== message);
        const sortedMessages = [...otherMessages].sort((a, b) => {
            return new Date(b.sent_at) - new Date(a.sent_at); // Newest first
        });
        
        if (sortedMessages.length > 0) {
            const lastMessageDate = new Date(sortedMessages[0].sent_at);
            // Check if there's a 10+ minute gap
            needsTimestampDivider = Math.abs(currentMessageDate - lastMessageDate) >= 10 * 60 * 1000;
        }
    }
    
    // Add timestamp divider if needed
    if (needsTimestampDivider) {
        // Format the date and time for the divider
        const options = { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        const formattedDateTime = currentMessageDate.toLocaleDateString(undefined, options);
        
        // Create and append the timestamp divider
        const timestampDivider = document.createElement('div');
        timestampDivider.className = 'timestamp-divider';
        timestampDivider.innerHTML = `<span>${formattedDateTime}</span>`;
        messagesList.appendChild(timestampDivider);
    }
    
    // Create the message item
    const messageItem = document.createElement('div');
    messageItem.className = `message-item ${message.is_own ? 'sent' : 'received'}`;
    messageItem.dataset.messageId = message.id || 'temp-' + Date.now();

    // Check if message is deleted
    if (message.is_deleted) {
        messageItem.innerHTML = `
            <div class="message-content">
                <p class="deleted-message" style="background-color: white;">This message has been deleted</p>
            </div>
        `;
        // No need to add any action buttons for deleted messages
    } else if (message.is_own) {
        // Format the message content with more options menu for own messages
        messageItem.innerHTML = `
            <div class="message-content">
                ${message.is_edited ? '<div class="edited-indicator">edited</div>' : ''}
                <p>${message.message || message.content}</p>
                <div class="message-actions">
                    <button class="message-action-btn more-options-btn" title="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="message-options-menu hidden">
                        <button class="message-option edit-btn" title="Edit message">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="message-option delete-btn" title="Delete message">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for more options button
        setTimeout(() => {
            const moreOptionsBtn = messageItem.querySelector('.more-options-btn');
            const optionsMenu = messageItem.querySelector('.message-options-menu');
            
            if (moreOptionsBtn && optionsMenu) {
                moreOptionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.toggle('hidden');
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', () => {
                    optionsMenu.classList.add('hidden');
                });
            }
        }, 0);
    } else {
        messageItem.innerHTML = `
            <div class="message-content">
                ${message.is_edited ? '<div style="text-align: right; margin-bottom: 2px;"><span class="edited-indicator" style="color: #6b7280; font-size: 11px; font-style: italic;">edited</span></div>' : ''}
                <p>${message.message || message.content}</p>
            </div>
        `;
    }
    
    // Ensure long messages don't break layout
    const messageContent = messageItem.querySelector('.message-content p');
    if (messageContent && messageContent.textContent.length > 100) {
        messageContent.style.overflowWrap = 'break-word';
        messageContent.style.wordBreak = 'break-word';
    }

    messagesList.appendChild(messageItem);
}

// Render messages
function renderMessages() {
    if (!messagesList) return;
    
    messagesList.innerHTML = '';

    if (messages.length === 0) {
        messagesList.innerHTML = `
            <div class="no-messages-container">
                <div class="no-messages-icon">
                    <i class="fas fa-comment-dots"></i>
                </div>
                <div class="no-messages-text">No messages yet</div>
            </div>
        `;
        return;
    }

    // Sort messages by timestamp (oldest first, since we're using column-reverse layout)
    const sortedMessages = [...messages].sort((a, b) => {
        const dateA = new Date(a.sent_at);
        const dateB = new Date(b.sent_at);
        return dateA - dateB; // Oldest first for column-reverse layout
    });

    let lastMessageDate = null;

    sortedMessages.forEach((message, index) => {
        const currentMessageDate = new Date(message.sent_at);
        
        // Check if we need to add a timestamp divider (10+ minute gap or first message)
        if (lastMessageDate === null || 
            (currentMessageDate - lastMessageDate) >= 10 * 60 * 1000) {
            
            // Format the date and time for the divider
            const options = { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit'
            };
            const formattedDateTime = currentMessageDate.toLocaleDateString(undefined, options);
            
            // Create and append the timestamp divider
            const timestampDivider = document.createElement('div');
            timestampDivider.className = 'timestamp-divider';
            timestampDivider.innerHTML = `<span>${formattedDateTime}</span>`;
            messagesList.appendChild(timestampDivider);
        }
        
        // Create the message item
        const messageItem = document.createElement('div');
        messageItem.className = `message-item ${message.is_own ? 'sent' : 'received'}`;
        messageItem.dataset.messageId = message.id || 'temp-' + Date.now();

        // Format the message content with more options menu for own messages
        if (message.is_own) {
            messageItem.innerHTML = `
                <div class="message-options-container">
                    ${message.is_edited ? '<div class="edited-indicator" style="color: #6b7280; font-size: 11px; font-style: italic; text-align: right; margin-bottom: 2px; position: absolute; top: 0; right: 10px;">edited</div>' : ''}
                    <div class="message-actions">
                        <button class="message-action-btn more-options-btn" title="More options">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="message-options-menu hidden">
                            <button class="message-option edit-btn" title="Edit message">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="message-option delete-btn" title="Delete message">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
                <div class="message-content">
                    <p>${message.message || message.content}</p>
                </div>
            `;
            
            // Add event listener for more options button
            const moreOptionsBtn = messageItem.querySelector('.more-options-btn');
            const optionsMenu = messageItem.querySelector('.message-options-menu');
            
            if (moreOptionsBtn && optionsMenu) {
                moreOptionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.toggle('hidden');
                });
            }
            
            // Add event listeners for edit and delete buttons
            const editBtn = messageItem.querySelector('.edit-btn');
            const deleteBtn = messageItem.querySelector('.delete-btn');
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.add('hidden');
                    startEditingMessage(messageItem, message.id);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    optionsMenu.classList.add('hidden');
                    deleteMessage(messageItem, message.id);
                });
            }
        }
        else {
            messageItem.innerHTML = `
                <div class="message-content">
                    <p>${message.message || message.content}</p>
                    ${message.is_edited ? '<span class="edited-indicator">edited</span>' : ''}
                </div>
            `;
        }
        
        // Ensure long messages don't break layout
        const messageContent = messageItem.querySelector('.message-content p');
        if (messageContent && messageContent.textContent.length > 100) {
            messageContent.style.overflowWrap = 'break-word';
            messageContent.style.wordBreak = 'break-word';
        }

        messagesList.appendChild(messageItem);
        
        // Update the last message date
        lastMessageDate = currentMessageDate;
    });

    // With column-reverse layout, scrolling is automatic, but we'll still call these
    // to ensure compatibility with any JavaScript that might affect scrolling
    scrollToBottom();
    setTimeout(scrollToBottom, 100);
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUser) return;

    // Clear input
    messageInput.value = '';
    updateSendButton();
    updateCharCount();

    // Show temporary message
    const tempMessage = {
        message: message,
        is_own: true,
        sent_at: new Date().toISOString()
    };
    messages.push(tempMessage);
    
    // Add the message directly to the DOM instead of re-rendering everything
    appendNewMessage(tempMessage);

    // Send to server
    fetch('/user/communication/send/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            receiver: selectedUser,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            // Update last message in user list
            updateLastMessage(selectedUser, message);
            // A single scroll call is sufficient
            setTimeout(scrollToBottom, 100);
        } else {
            console.error('Failed to send message:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });
}