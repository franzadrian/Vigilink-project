// DOM Elements and Global Variables
const userSearch = document.getElementById('user-search');
const searchResults = document.getElementById('search-results');
const messagesList = document.getElementById('messages-list');
const welcomeScreen = document.getElementById('welcome-screen');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const searchInput = document.getElementById('user-search-input');

// State management
let currentRecipient = null;
let currentChat = null;

function getUserInitials(name) {
    if (!name) return '??';
    const words = name.split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }
    return '';
}

function displaySearchResults(users) {
    if (!Array.isArray(users)) {
        console.error('Expected array of users');
        return;
    }
    
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    const resultsHtml = users.map(user => `
        <div class="user-item" onclick="openUserChat(${user.id}, '${user.name}')" data-user-id="${user.id}">
            <div class="user-avatar">
                ${user.avatar ? 
                    `<img src="${user.avatar}" alt="${user.name}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="avatar-text" style="display:none">${getUserInitials(user.name || user.username)}</div>` :
                    `<div class="avatar-text">${getUserInitials(user.name || user.username)}</div>`
                }
            </div>
            <div class="user-info">
                <div class="user-name">${user.name || user.username}</div>
                <div class="user-email">${user.email}</div>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = resultsHtml;
}

function displayMessages(messages, append = false) {
    if (!messagesList) return;

    if (!append) {
        messagesList.innerHTML = '';
    }

    if (!messages || messages.length === 0) {
        if (!append) {
            messagesList.innerHTML = '<div class="no-messages">No messages yet. Start a conversation!</div>';
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(message => {
        if (!message) return; // Skip invalid messages

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.is_own ? 'own-message' : 'other-message'}`;

        // Get message text from either content or message field
        const messageText = message.content || message.message || '';
        const senderName = message.sender_name || '';
        
        if (!messageText) return; // Skip messages with no content

        const formattedTime = message.sent_at ? 
            new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            '';
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${messageText}</div>
                <div class="message-meta">
                    <span class="message-time">${formattedTime}</span>
                    ${!message.is_own && senderName ? `<span class="message-sender">${senderName}</span>` : ''}
                </div>
            </div>
        `;
        fragment.appendChild(messageElement);
    });

    messagesList.appendChild(fragment);

    // Scroll to the bottom of the messages with a slight delay to ensure content is rendered
    setTimeout(() => {
        messagesList.scrollTop = messagesList.scrollHeight;
    }, 100);
}

async function loadChatMessages(userId) {
    if (!userId) {
        console.error('No user ID provided');
        return;
    }

    try {
        const response = await fetch(`/user/communication/messages/?user_id=${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            credentials: 'include'
        });

        if (response.redirected) {
            window.location.href = response.url;
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load messages');
        }
        
        let data;
        try {
            if (response.status === 403) {
                window.location.href = '/accounts/login/';
                return;
            }
            
            if (!response.ok) {
                throw new Error('Server error. Please try again.');
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format from server');
            }

            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing server response:', parseError);
            messagesList.innerHTML = '<div class="error">Server error. Please try again.</div>';
            return;
        }

        if (Array.isArray(data)) {
            displayMessages(data);
        } else if (data.error) {
            console.error('Server error:', data.error);
            messagesList.innerHTML = `<div class="error">${data.error}</div>`;
        } else {
            console.error('Invalid message data format');
            messagesList.innerHTML = '<div class="no-messages">No messages yet. Start a conversation!</div>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        if (messagesList) {
            messagesList.innerHTML = '<div class="no-messages">Could not load messages. Please try again.</div>';
        }
    }
}

async function openUserChat(userId, userName) {
    if (!userId) {
        console.error('No user ID provided');
        return;
    }
    currentRecipient = userId;
    
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');
    
    const headerName = document.getElementById('chat-header-name');
    if (headerName) headerName.textContent = userName;
    
    try {
        await loadChatMessages(userId);
    } catch (error) {
        console.error('Error opening chat:', error);
    }
}

function setupEventListeners() {
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentRecipient || !messageInput) return;
            
            const messageText = messageInput.value.trim();
            if (!messageText) return;
            
            try {
                const response = await fetch('/user/communication/send/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': getCSRFToken(),
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        receiver: currentRecipient,
                        message: messageText
                    })
                });

                messageInput.value = '';
                
                if (response.status === 403) {
                    window.location.href = '/accounts/login/';
                    return;
                }

                if (!response.ok) {
                    if (response.headers.get('content-type')?.includes('application/json')) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to send message');
                    } else {
                        throw new Error('Server error. Please try again.');
                    }
                }
                
                const messageData = await response.json();
                
                // Remove 'No messages' div if it exists
                const noMessagesDiv = messagesList.querySelector('.no-messages');
                if (noMessagesDiv) {
                    noMessagesDiv.remove();
                }

                // Display the new message immediately
                displayMessages([{
                    ...messageData,
                    content: messageData.content || messageData.message,  // Handle both field names
                    is_own: true
                }], true);  // Append the new message
                
            } catch (error) {
                console.error('Error sending message:', error);
                alert('Failed to send message. Please try again.');
            }
        });
    }
    
    // Search input handling
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const searchTerm = e.target.value.trim();
            if (searchTerm.length < 2) {
                displaySearchResults([]);
                return;
            }
            
            try {
                const response = await fetch(`/user/global-user-search/?term=${encodeURIComponent(searchTerm)}`);
                if (!response.ok) throw new Error('Search failed');
                
                const data = await response.json();
                displaySearchResults(data);
            } catch (error) {
                console.error('Error searching users:', error);
                displaySearchResults([]);
            }
        });
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', setupEventListeners);

// Recent Chats Display
async function loadRecentChats() {
    try {
        const response = await fetch('/user/communication/recent-chats/', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load recent chats');
        
        const users = await response.json();
        displayRecentChats(users);
    } catch (error) {
        console.error('Error loading recent chats:', error);
        if (searchResults) {
            searchResults.innerHTML = '<div class="error">Could not load recent chats</div>';
        }
    }
}

function displayRecentChats(users) {
    if (!searchResults) return;

    if (!users || users.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No recent chats</div>';
        return;
    }

    const recentChatsHtml = users.map(user => `
        <div class="user-item recent-chat" onclick="openUserChat(${user.id}, '${user.name.replace(/'/g, "\\'")}')">
            <div class="user-avatar">
                ${user.avatar ? 
                    `<img src="${user.avatar}" alt="${user.name}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="avatar-text" style="display:none">${getUserInitials(user.name)}</div>` :
                    `<div class="avatar-text">${getUserInitials(user.name)}</div>`
                }
            </div>
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="last-message">${user.last_message || 'No messages yet'}</div>
                <div class="last-message-time">${user.last_message_time ? new Date(user.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
        </div>
    `).join('');

    searchResults.innerHTML = recentChatsHtml;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Initialize with recent chats
    loadRecentChats();
    
    // Add search input handler
    if (userSearch) {
        userSearch.addEventListener('input', debounce(async (e) => {
            const searchTerm = e.target.value.trim();
            
            if (searchTerm.length < 2) {
                // If search is cleared or too short, show recent chats
                loadRecentChats();
                return;
            }
            
            // Otherwise, perform search
            try {
                const response = await fetch(`/user/global-user-search/?term=${encodeURIComponent(searchTerm)}`);
                if (!response.ok) throw new Error('Search failed');
                
                const users = await response.json();
                displaySearchResults(users);
            } catch (error) {
                console.error('Error searching users:', error);
                searchResults.innerHTML = '<div class="error">Error searching users</div>';
            }
        }, 300));
    }
});

// Search functionality
function initializeSearch() {
    let searchTimeout;
    
    userSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const searchTerm = e.target.value.trim();
        
        // Clear results if search is empty
        if (!searchTerm) {
            searchResults.innerHTML = '';
            return;
        }
        
        // Debounce search requests
        searchTimeout = setTimeout(() => {
            searchUsers(searchTerm);
        }, 300);
    });
}

async function searchUsers(term) {
    try {
        const response = await fetch(`/user/global-user-search/?term=${encodeURIComponent(term)}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
        });
        const users = await response.json();
        displaySearchResults(users);
    } catch (error) {
        console.error('Error searching users:', error);
        searchResults.innerHTML = '<div class="no-results">Error searching users. Please try again.</div>';
    }
}

function displaySearchResults(users) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
        console.error('Search results container not found');
        return;
    }

    if (!Array.isArray(users)) {
        console.error('Expected array of users');
        resultsContainer.innerHTML = '<div class="error">An error occurred while displaying results</div>';
        return;
    }

    if (users.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
        return;
    }

    try {
        const resultsHtml = users.map(user => {
            if (!user || !user.id) {
                console.error('Invalid user data:', user);
                return '';
            }

            const name = user.name || user.username || 'Unknown User';
            const email = user.email || 'No email provided';
            const avatarHtml = user.avatar ? 
                `<img src="${user.avatar}" alt="${name}" class="avatar-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; this.remove();">
                 <div class="avatar-text" style="display:none">${getUserInitials(name)}</div>` :
                `<div class="avatar-text">${getUserInitials(name)}</div>`;

            return `
                <div class="user-item" onclick="openUserChat(${user.id}, '${name.replace(/'/g, "\\'")}')">
                    <div class="user-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${name}</div>
                        <div class="user-email">${email}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.innerHTML = resultsHtml;
    } catch (error) {
        console.error('Error displaying search results:', error);
        resultsContainer.innerHTML = '<div class="error">An error occurred while displaying results</div>';
    }
}

function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
            return value;
        }
    }
    return '';
}

function displayMessages(messages) {
    const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '';

    if (!messages || messages.length === 0) {
        messagesList.innerHTML = '<div class="no-messages">No messages yet. Start a conversation!</div>';
        return;
    }

    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.is_own ? 'own-message' : 'other-message'}`;
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${message.content}</div>
                <div class="message-meta">
                    <span class="message-time">${new Date(message.sent_at).toLocaleTimeString()}</span>
                    <span class="message-sender">${message.sender_name}</span>
                </div>
            </div>
        `;
        messagesList.appendChild(messageElement);
    });

    // Scroll to the bottom of the messages
    messagesList.scrollTop = messagesList.scrollHeight;
}









// User Search and Display
async function handleUserSearch() {
    const searchTerm = userSearch.value.trim();
    
    try {
        // If search is empty, load all users
        const response = await fetch(`/user/global-user-search/?term=${encodeURIComponent(searchTerm)}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="search-error">Error searching users. Please try again.</div>';
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/user_panel/get_all_users/', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Load users error:', error);
        searchResults.innerHTML = '<div class="search-error">Error loading users. Please refresh the page.</div>';
    }
}

function displayUsers(users) {
    if (!users || users.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No users found</div>';
        return;
    }

    searchResults.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user.id}">
            <div class="user-avatar">
                ${user.profile_picture ? 
                    `<img src="/media/${user.profile_picture}" alt="${user.full_name}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="avatar-text" style="display:none">${getUserInitials(user.full_name || user.username)}</div>` :
                    `<div class="avatar-text">${getUserInitials(user.full_name || user.username)}</div>`
                }
            </div>
            <div class="user-details">
                <div class="user-details-header">
                    <h3>${user.full_name || user.username}</h3>
                    <p class="user-role">${user.role || 'User'}</p>
                </div>
                <button class="start-chat-btn" onclick="startChat(${user.id})">
                    Start Chat
                </button>
            </div>
        </div>
    `).join('');
}

// Chat Management
async function startChat(userId) {
    try {
        const response = await fetch('/api/conversations/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify({ recipient_id: userId })
        });

        if (!response.ok) throw new Error('Failed to create conversation');

        const conversation = await response.json();
        openChat(conversation.id, userId);
    } catch (error) {
        console.error('Start chat error:', error);
        // Handle error appropriately
    }
}

async function openChat(chatId, recipientId) {
    currentChat = chatId;
    currentRecipient = recipientId;
    
    // Show chat interface
    welcomeScreen.classList.add('hidden');
    chatMessages.classList.remove('hidden');
    
    await loadMessages(chatId);
    initializeWebSocket();
}

async function loadMessages(chatId) {
    try {
        const response = await fetch(`/api/conversations/${chatId}/messages/`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        });

        if (!response.ok) throw new Error('Failed to load messages');

        const messages = await response.json();
        displayMessages(messages);
    } catch (error) {
        console.error('Load messages error:', error);
        // Handle error appropriately
    }
}



// Message Handling
async function handleMessageSubmit(event) {
    event.preventDefault();
    
    const content = messageInput.value.trim();
    if (!content) {
        alert('Please enter a message first.');
        return;
    }
    
    if (!currentChat) {
        alert('Please select a chat before sending a message.');
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${currentChat}/messages/send/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to send message');
        }

        const message = await response.json();
        appendMessage(message);
        messageInput.value = '';
    } catch (error) {
        console.error('Send message error:', error);
        alert(`Failed to send message: ${error.message}. Please try again.`);
    }
}

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.is_own ? 'own' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-content">
            <p class="message-text">${message.content}</p>
            <span class="message-time">${formatMessageTime(message.timestamp)}</span>
        </div>
    `;
    
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

// Utility Functions
function getUserInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
}

function formatLastMessageTime(timestamp) {
    if (!timestamp) return '';
    // Implement your time formatting logic here
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
}







function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// WebSocket Connection for Real-time Updates
function setupWebSocket() {
    const ws_scheme = window.location.protocol === "https:" ? "wss" : "ws";
    if (!currentChat) {
        console.error('No active chat selected');
        return null;
    }

    try {
        const chatSocket = new WebSocket(
            `${ws_scheme}://${window.location.host}/ws/chat/${currentChat}/`
        );

        chatSocket.onopen = function() {
            console.log('WebSocket connection established');
        };

        chatSocket.onmessage = function(e) {
            try {
                const data = JSON.parse(e.data);
                if (data.message) {
                    appendMessage({
                        content: data.message.content,
                        timestamp: data.message.timestamp,
                        is_own: data.message.user_id === currentUserId
                    });
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        chatSocket.onclose = function(e) {
            console.error('WebSocket connection closed:', e.reason);
            setTimeout(() => {
                console.log('Attempting to reconnect...');
                initializeWebSocket();
            }, 5000);
        };

        chatSocket.onerror = function(e) {
            console.error('WebSocket error:', e);
        };

        return chatSocket;
    } catch (error) {
        console.error('Error setting up WebSocket:', error);
        return null;
    }
}

// Initialize WebSocket when chat is opened
let chatSocket = null;
function initializeWebSocket() {
    if (chatSocket) {
        chatSocket.close();
    }
    chatSocket = setupWebSocket();
}