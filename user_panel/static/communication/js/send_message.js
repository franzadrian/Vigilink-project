// send_message.js - Handles sending messages between users

document.addEventListener('DOMContentLoaded', function() {
    // Get references to the chat elements
    const chatForm = document.getElementById('chatForm');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const chatReceiverId = document.getElementById('chatReceiverId');
    const chatMessagesList = document.getElementById('chatMessagesList');
    const globalUserSearch = document.getElementById('globalUserSearch');
    const globalSearchBtn = document.getElementById('globalSearchBtn');
    const globalSearchResults = document.getElementById('globalSearchResults');
    
    // Check if we have a saved conversation
    const hasConversations = localStorage.getItem('hasConversations');
    const lastSelectedUserId = localStorage.getItem('lastSelectedUserId');
    const lastSelectedUserName = localStorage.getItem('lastSelectedUserName');
    const lastSelectedUserAvatar = localStorage.getItem('lastSelectedUserAvatar');
    
    // If we have a saved conversation, restore it
    if (hasConversations === 'true' && lastSelectedUserId && lastSelectedUserName) {
        const conversationsContainer = document.getElementById('conversationsContainer');
        if (conversationsContainer) {
            conversationsContainer.innerHTML = '<h3>Recent messages</h3>';
            conversationsContainer.className = 'recent-messages-header';
            
            // Create user item if it doesn't exist
            const existingUserItem = document.querySelector(`.chat-user-item[data-user-id="${lastSelectedUserId}"]`);
            if (!existingUserItem) {
                const usersList = document.querySelector('.chat-users-list');
                if (usersList) {
                    // Check if we have a saved last message for this user
                    const lastMessage = localStorage.getItem(`lastMessage_${lastSelectedUserId}`);
                    const lastMessageText = lastMessage || "No conversation yet";
                    
                    // Create new user item
                    const newUserItem = document.createElement('div');
                    newUserItem.className = 'chat-user-item';
                    newUserItem.dataset.userId = lastSelectedUserId;
                    newUserItem.innerHTML = `
                        <div class="chat-user-avatar">
                            <img src="${lastSelectedUserAvatar || '/static/accounts/images/profile.png'}" alt="${lastSelectedUserName}" onerror="this.src='/static/accounts/images/profile.png'">
                            <span class="user-status online"></span>
                        </div>
                        <div class="chat-user-info">
                            <div class="chat-user-name">${lastSelectedUserName}</div>
                            <div class="chat-last-message">${lastMessageText}</div>
                        </div>
                        <div class="chat-user-meta">
                            <div class="chat-time">Recent</div>
                        </div>
                    `;
                    
                    // Add click event to the user item
                    newUserItem.addEventListener('click', function() {
                        startConversation(lastSelectedUserId, lastSelectedUserName, lastSelectedUserAvatar);
                    });
                    
                    // Add to the top of the list
                    if (usersList.firstChild) {
                        usersList.insertBefore(newUserItem, usersList.firstChild);
                    } else {
                        usersList.appendChild(newUserItem);
                    }
                }
            }
        }
    }
    
    // Function to start a conversation with a user
    function startConversation(userId, userName, userAvatar) {
        // Update chat header
        const chatWithName = document.getElementById('chatWithName');
        const chatWithStatus = document.getElementById('chatWithStatus');
        const chatWithAvatar = document.getElementById('chatWithAvatar');
        
        if (chatWithName && chatWithStatus && chatWithAvatar) {
            chatWithName.textContent = userName;
            chatWithStatus.textContent = 'Online';
            chatWithAvatar.src = userAvatar || '/static/accounts/images/profile.png';
            chatWithAvatar.alt = userName;
            chatWithAvatar.onerror = function() { this.src = '/static/accounts/images/profile.png'; };
        }
        
        // Set receiver ID for the chat form
        if (chatReceiverId) {
            chatReceiverId.value = userId;
        }
        
        // Check if we have saved messages for this user
        const lastMessage = localStorage.getItem(`lastMessage_${userId}`);
        
        // Clear current messages and show empty chat
        if (chatMessagesList) {
            chatMessagesList.innerHTML = '';
            const emptyChat = document.createElement('div');
            emptyChat.className = 'no-messages-yet';
            emptyChat.innerHTML = '<div class="empty-chat-content"><i class="fas fa-comment-dots empty-chat-icon"></i><p>No messages yet. Send a message to start the conversation.</p></div>';
            chatMessagesList.appendChild(emptyChat);
        }
        
        // Update the last message display if we have one saved
        if (lastMessage && existingUserItem) {
            const lastMessageEl = existingUserItem.querySelector('.chat-last-message');
            if (lastMessageEl) {
                lastMessageEl.textContent = lastMessage;
            }
        }
        
        // Focus on message input
        if (chatMessageInput) {
            chatMessageInput.focus();
        }
        
        // Highlight user in the list if exists, or add temporarily
        const existingUserItem = document.querySelector(`.chat-user-item[data-user-id="${userId}"]`);
        if (existingUserItem) {
            // Remove active class from all users
            document.querySelectorAll('.chat-user-item').forEach(item => item.classList.remove('active'));
            // Add active class to this user
            existingUserItem.classList.add('active');
        } else {
            // Create a temporary user item in the list
                const usersList = document.querySelector('.chat-users-list');
                if (usersList) {
                    // Change no conversations message to Recent messages if it exists
                    const conversationsContainer = document.getElementById('conversationsContainer');
                    if (conversationsContainer) {
                        conversationsContainer.innerHTML = '<h3>Recent messages</h3>';
                        conversationsContainer.className = 'recent-messages-header';
                        
                        // Save to localStorage that we have conversations
                        localStorage.setItem('hasConversations', 'true');
                        localStorage.setItem('lastSelectedUserId', userId);
                        localStorage.setItem('lastSelectedUserName', userName);
                        localStorage.setItem('lastSelectedUserAvatar', userAvatar || '/static/accounts/images/profile.png');
                    }
                    
                    // Remove active class from all users
                    document.querySelectorAll('.chat-user-item').forEach(item => item.classList.remove('active'));
                    
                    // Create new user item
                    const newUserItem = document.createElement('div');
                    newUserItem.className = 'chat-user-item active';
                    newUserItem.dataset.userId = userId;
                    
                    // Check if we have a saved last message for this user
                    const lastMessage = localStorage.getItem(`lastMessage_${userId}`);
                    const lastMessageText = lastMessage || "No conversation yet";
                    
                    newUserItem.innerHTML = `
                        <div class="chat-user-avatar">
                            <img src="${userAvatar || '/static/accounts/images/profile.png'}" alt="${userName}" onerror="this.src='/static/accounts/images/profile.png'">
                            <span class="user-status online"></span>
                        </div>
                        <div class="chat-user-info">
                            <div class="chat-user-name">${userName}</div>
                            <div class="chat-last-message">${lastMessageText}</div>
                        </div>
                        <div class="chat-user-meta">
                            <div class="chat-time">Now</div>
                        </div>
                    `;
                
                // Add click event to the new user item
                newUserItem.addEventListener('click', function() {
                    // Remove active class from all users
                    document.querySelectorAll('.chat-user-item').forEach(item => item.classList.remove('active'));
                    // Add active class to this user
                    this.classList.add('active');
                    
                    // Update chat header
                    if (chatWithName && chatWithStatus && chatWithAvatar) {
                        chatWithName.textContent = userName;
                        chatWithStatus.textContent = 'Online';
                        chatWithAvatar.src = userAvatar || '/static/accounts/images/profile.png';
                        chatWithAvatar.alt = userName;
                    }
                    
                    // Set receiver ID for the chat form
                    if (chatReceiverId) {
                        chatReceiverId.value = userId;
                    }
                });
                
                // Add to the top of the list
                if (usersList.firstChild) {
                    usersList.insertBefore(newUserItem, usersList.firstChild);
                } else {
                    usersList.appendChild(newUserItem);
                }
            }
        }
    }
    
    // Global user search functionality (all users)
    if (globalUserSearch) {
        // Function to perform global user search
        function performGlobalSearch() {
            const searchTerm = globalUserSearch.value.trim();
            
            if (searchTerm.length < 2) {
                globalSearchResults.classList.remove('show');
                globalSearchResults.innerHTML = '';
                return;
            }
            
            // Get CSRF token
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            // Make AJAX request to search all users
            fetch(`/user/communication/global-search/?term=${encodeURIComponent(searchTerm)}`, {
                method: 'GET',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                globalSearchResults.innerHTML = '';
                
                if (data.length === 0) {
                    globalSearchResults.innerHTML = '<div class="no-results">No users found</div>';
                } else {
                    data.forEach(user => {
                        const userItem = document.createElement('div');
                        userItem.className = 'global-search-result-item';
                        userItem.innerHTML = `
                            <div class="user-avatar">
                                <img src="${user.avatar || '/static/accounts/images/profile.png'}" alt="${user.name}" onerror="this.src='/static/accounts/images/profile.png'">
                            </div>
                            <div class="user-info">
                                <div class="user-name">${user.name}</div>
                                <div class="user-email">${user.email || user.username}</div>
                            </div>
                        `;
                        
                        // Add click event to start conversation
                        userItem.addEventListener('click', function() {
                            startConversation(user.id, user.name, user.avatar);
                            globalSearchResults.classList.remove('show');
                            globalUserSearch.value = '';
                        });
                        
                        globalSearchResults.appendChild(userItem);
                    });
                }
                
                globalSearchResults.classList.add('show');
            })
            .catch(error => {
                console.error('Error searching users:', error);
                globalSearchResults.innerHTML = '<div class="no-results">Error searching users</div>';
                globalSearchResults.classList.add('show');
            });
        }
        
        // Add event listeners for global search
        if (globalUserSearch && globalSearchBtn) {
            // Debounce function for search input
            let searchTimeout;
            
            globalUserSearch.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(performGlobalSearch, 300);
            });
            
            globalSearchBtn.addEventListener('click', performGlobalSearch);
            
            // Close search results when clicking outside
            document.addEventListener('click', function(event) {
                if (!globalUserSearch.contains(event.target) && 
                    !globalSearchResults.contains(event.target) &&
                    !globalSearchBtn.contains(event.target)) {
                    globalSearchResults.classList.remove('show');
                }
            });
        }
    }
    
    // Function to show alerts
    function showAlert(message, type) {
        const alertContainer = document.querySelector('.alert-container');
        
        if (!alertContainer) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        alertContainer.appendChild(alert);
        
        // Remove alert after 3 seconds
        setTimeout(() => {
            alert.remove();
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