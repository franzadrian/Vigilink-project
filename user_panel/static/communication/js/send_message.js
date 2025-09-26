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
    
    // Check if we have saved conversations
    const hasConversations = localStorage.getItem('hasConversations');
    const savedUsersJSON = localStorage.getItem('savedUsers');
    let savedUsers = [];
    
    if (savedUsersJSON) {
        try {
            savedUsers = JSON.parse(savedUsersJSON);
        } catch (e) {
            console.error('Error parsing saved users:', e);
        }
    }
    
    // If we have saved conversations, restore them
    if (hasConversations === 'true' && savedUsers.length > 0) {
        const conversationsContainer = document.getElementById('conversationsContainer');
        if (conversationsContainer) {
            conversationsContainer.innerHTML = '<h3>Recent messages</h3>';
            conversationsContainer.className = 'recent-messages-header';
            
            const usersList = document.querySelector('.chat-users-list');
            if (usersList) {
                // Loop through all saved users and add them to the list
                savedUsers.forEach(user => {
                    // Create user item if it doesn't exist
                    const existingUserItem = document.querySelector(`.chat-user-item[data-user-id="${user.id}"]`);
                    if (!existingUserItem) {
                        // Check if we have a saved last message for this user
                        const lastMessage = localStorage.getItem(`lastMessage_${user.id}`);
                        const lastMessageText = lastMessage || "No conversation yet";
                        
                        // Create new user item
                        const newUserItem = document.createElement('div');
                        newUserItem.className = 'chat-user-item';
                        newUserItem.dataset.userId = user.id;
                        newUserItem.innerHTML = `
                            <div class="chat-user-avatar">
                                <img src="${user.avatar || '/static/accounts/images/profile.png'}" alt="${user.name}" onerror="this.src='/static/accounts/images/profile.png'">
                                <span class="user-status online"></span>
                            </div>
                            <div class="chat-user-info">
                                <div class="chat-user-name">${user.name}</div>
                                <div class="chat-last-message">${lastMessageText}</div>
                            </div>
                            <div class="chat-user-meta">
                                <button class="remove-chat" title="Remove conversation">×</button>
                                <div class="chat-time">Recent</div>
                            </div>
                        `;
                        
                        // Add click event to the user item
                        newUserItem.addEventListener('click', function(e) {
                            // Check if the remove button was clicked
                            if (e.target.classList.contains('remove-chat')) {
                                e.stopPropagation();
                                removeUserFromRecentMessages(user.id);
                                return;
                            }
                            
                            startConversation(user.id, user.name, user.avatar);
                        });
                        
                        // Add to the list
                        usersList.appendChild(newUserItem);
                    }
                });
            }
        }
    }
    
    // Function to remove a user from recent messages
    function removeUserFromRecentMessages(userId) {
        // Remove the user item from the UI
        const userItem = document.querySelector(`.chat-user-item[data-user-id="${userId}"]`);
        if (userItem) {
            userItem.remove();
        }
        
        // Remove the user from localStorage
        let savedUsers = [];
        const savedUsersJSON = localStorage.getItem('savedUsers');
        
        if (savedUsersJSON) {
            try {
                savedUsers = JSON.parse(savedUsersJSON);
                // Filter out the removed user
                savedUsers = savedUsers.filter(user => user.id !== userId);
                
                // Save the updated array back to localStorage
                localStorage.setItem('savedUsers', JSON.stringify(savedUsers));
                
                // If no users left, remove the hasConversations flag
                if (savedUsers.length === 0) {
                    localStorage.removeItem('hasConversations');
                    
                    // Update the UI to show no conversations
                    const conversationsContainer = document.getElementById('conversationsContainer');
                    if (conversationsContainer) {
                        conversationsContainer.innerHTML = `
                            <div class="no-conversations">
                                <p>No conversations yet. Search for users above to start chatting.</p>
                            </div>
                        `;
                        conversationsContainer.className = '';
                    }
                }
            } catch (e) {
                console.error('Error parsing saved users:', e);
            }
        }
        
        // If this was the active conversation, clear the chat area
        const chatWithName = document.getElementById('chatWithName');
        if (chatWithName && chatWithName.textContent !== 'Select a conversation') {
            const activeUserItem = document.querySelector('.chat-user-item.active');
            if (!activeUserItem || activeUserItem.dataset.userId === userId) {
                // Reset chat header
                chatWithName.textContent = 'Select a conversation';
                document.getElementById('chatWithStatus').textContent = 'No user selected';
                document.getElementById('chatWithAvatar').src = '/static/accounts/images/profile.png';
                
                // Clear chat messages
                if (chatMessagesList) {
                    chatMessagesList.innerHTML = `
                        <div class="no-chat-selected">
                            <div class="no-chat-icon">💬</div>
                            <h3>Select a conversation</h3>
                            <p>Choose a user from the list to view your conversation history</p>
                        </div>
                    `;
                }
                
                // Clear receiver ID
                if (chatReceiverId) {
                    chatReceiverId.value = '';
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
                        
                        // Save this user to the savedUsers array
                        let savedUsers = [];
                        const savedUsersJSON = localStorage.getItem('savedUsers');
                        
                        if (savedUsersJSON) {
                            try {
                                savedUsers = JSON.parse(savedUsersJSON);
                                // Remove this user if already exists (to avoid duplicates)
                                savedUsers = savedUsers.filter(user => user.id !== userId);
                            } catch (e) {
                                console.error('Error parsing saved users:', e);
                            }
                        }
                        
                        // Add the current user to the beginning of the array
                        savedUsers.unshift({
                            id: userId,
                            name: userName,
                            avatar: userAvatar || '/static/accounts/images/profile.png',
                            lastInteraction: new Date().getTime()
                        });
                        
                        // Save the updated array back to localStorage
                        localStorage.setItem('savedUsers', JSON.stringify(savedUsers));
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
                            // Start conversation with this user
                            startConversation(user.id, user.name, user.avatar);
                            
                            // Hide search results and clear search input
                            globalSearchResults.classList.remove('show');
                            globalUserSearch.value = '';
                            
                            // Check if this user is already in the recent messages list
                            const existingUserItem = document.querySelector(`.chat-user-item[data-user-id="${user.id}"]`);
                            if (!existingUserItem) {
                                // Add this user to the recent messages list
                                const usersList = document.querySelector('.chat-users-list');
                                if (usersList) {
                                    // Create new user item
                                    const newUserItem = document.createElement('div');
                                    newUserItem.className = 'chat-user-item active';
                                    newUserItem.dataset.userId = user.id;
                                    
                                    newUserItem.innerHTML = `
                                        <div class="chat-user-avatar">
                                            <img src="${user.avatar || '/static/accounts/images/profile.png'}" alt="${user.name}" onerror="this.src='/static/accounts/images/profile.png'">
                                            <span class="user-status online"></span>
                                        </div>
                                        <div class="chat-user-info">
                                            <div class="chat-user-name">${user.name}</div>
                                            <div class="chat-last-message">No conversation yet</div>
                                        </div>
                                        <div class="chat-user-meta">
                                            <div class="chat-time">Now</div>
                                        </div>
                                    `;
                                    
                                    // Add click event to the new user item
                                    newUserItem.addEventListener('click', function() {
                                        startConversation(user.id, user.name, user.avatar);
                                    });
                                    
                                    // Add to the top of the list
                                    if (usersList.firstChild) {
                                        usersList.insertBefore(newUserItem, usersList.firstChild);
                                    } else {
                                        usersList.appendChild(newUserItem);
                                    }
                                    
                                    // Make sure the "Recent messages" header is displayed
                                    const conversationsContainer = document.getElementById('conversationsContainer');
                                    if (conversationsContainer) {
                                        if (!conversationsContainer.querySelector('h3')) {
                                            conversationsContainer.innerHTML = '<h3>Recent messages</h3>';
                                            conversationsContainer.className = 'recent-messages-header';
                                        }
                                    }
                                }
                            }
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