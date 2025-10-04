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
        messageInput.addEventListener('input', updateSendButton);
    }

    if (backButton) {
        backButton.addEventListener('click', deselectUser);
    }

    if (scrollToBottomBtn) {
        scrollToBottomBtn.addEventListener('click', scrollToBottom);
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
        messagesList.scrollTop = messagesList.scrollHeight;
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
        const userInitials = selectedUserItem.querySelector('.avatar-text').textContent;
        const isOnline = selectedUserItem.querySelector('.status-indicator').classList.contains('online');
        
        const userNameHeader = document.querySelector('#selected-user-name');
        if (userNameHeader) {
            userNameHeader.textContent = userName;
        }
        
        const userAvatarHeader = document.querySelector('#selected-user-avatar');
        if (userAvatarHeader) {
            userAvatarHeader.textContent = userInitials;
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

// Fetch messages for a user
function fetchMessages(userId) {
    fetch(`/user-panel/communication/messages/?user_id=${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                messages = data.messages;
                renderMessages();
                scrollToBottom();
            } else {
                console.error('Error fetching messages:', data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching messages:', error);
        });
}

// Render messages
function renderMessages() {
    if (!messagesList) return;
    
    // Clear messages list
    messagesList.innerHTML = '';
    
    if (messages.length === 0) {
        // Show empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-messages';
        emptyState.innerHTML = `
            <div class="empty-icon">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
            </div>
            <p>No messages yet</p>
            <p class="empty-subtitle">Start the conversation by sending a message</p>
        `;
        messagesList.appendChild(emptyState);
        return;
    }
    
    // Group messages by date
    const groupedMessages = {};
    messages.forEach(message => {
        const date = new Date(message.sent_at);
        const dateStr = date.toLocaleDateString();
        
        if (!groupedMessages[dateStr]) {
            groupedMessages[dateStr] = [];
        }
        
        groupedMessages[dateStr].push(message);
    });
    
    // Render grouped messages
    Object.keys(groupedMessages).forEach(dateStr => {
        // Add date separator
        const dateSeparator = document.createElement('div');
        dateSeparator.className = 'date-separator';
        dateSeparator.textContent = formatDateSeparator(dateStr);
        messagesList.appendChild(dateSeparator);
        
        // Add messages for this date
        groupedMessages[dateStr].forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.is_own ? 'own' : 'other'}`;
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageContent.textContent = message.message;
            
            const messageTime = document.createElement('div');
            messageTime.className = 'message-timestamp';
            messageTime.textContent = formatMessageTime(message.sent_at);
            
            messageElement.appendChild(messageContent);
            messageElement.appendChild(messageTime);
            
            messagesList.appendChild(messageElement);
        });
    });
}

// Format date separator
function formatDateSeparator(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toLocaleDateString()) {
        return 'Today';
    } else if (dateStr === yesterday.toLocaleDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
}

// Format message time
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update send button state
function updateSendButton() {
    if (sendButton) {
        const hasText = messageInput && messageInput.value.trim().length > 0;
        sendButton.classList.toggle('active', hasText);
        sendButton.disabled = !hasText;
    }
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUser) return;

    // Clear input
    messageInput.value = '';
    updateSendButton();

    // Show temporary message
    const tempMessage = {
        message: message,
        is_own: true,
        sent_at: new Date().toISOString()
    };
    messages.push(tempMessage);
    renderMessages();

    // Send to server
    fetch('/user-panel/communication/send/', {
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
            // Refresh messages
            fetchMessages(selectedUser);
        } else {
            console.error('Failed to send message:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });
}

// Update send button state
function updateSendButton() {
    if (sendButton) {
        sendButton.disabled = !messageInput.value.trim();
        sendButton.classList.toggle('disabled', !messageInput.value.trim());
    }
}

// Format time
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll to bottom of messages
function scrollToBottom() {
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
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
        const userInitials = selectedUserItem.querySelector('.avatar-text').textContent;
        const isOnline = selectedUserItem.querySelector('.status-indicator').classList.contains('online');
        
        const userNameHeader = document.querySelector('#selected-user-name');
        if (userNameHeader) {
            userNameHeader.textContent = userName;
        }
        
        const userAvatarHeader = document.querySelector('#selected-user-avatar');
        if (userAvatarHeader) {
            userAvatarHeader.textContent = userInitials;
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
    fetch(`/user-panel/communication/messages/?user_id=${userId}`, {
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

    messages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = `message-item ${message.is_own ? 'sent' : 'received'}`;

        // Format the timestamp
        const sentDate = new Date(message.sent_at);
        const formattedTime = sentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageItem.innerHTML = `
            <div class="message-content">
                <p>${message.message || message.content}</p>
                <span class="message-time">${formattedTime}</span>
            </div>
        `;

        messagesList.appendChild(messageItem);
    });

    // Scroll to bottom
    scrollToBottom();
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUser) return;

    // Clear input
    messageInput.value = '';
    updateSendButton();

    // Show temporary message
    const tempMessage = {
        message: message,
        is_own: true,
        sent_at: new Date().toISOString()
    };
    messages.push(tempMessage);
    renderMessages();

    // Send to server
    fetch('/user-panel/communication/send/', {
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
            // Refresh messages
            fetchMessages(selectedUser);
        } else {
            console.error('Failed to send message:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });
}