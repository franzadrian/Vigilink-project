// JavaScript for chat interface functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle (for About, Contact, Pricing)
    const mobileMenuBtn = document.querySelector('.mobile-menu-container .mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mobileNav.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (mobileNav && 
            mobileNav.classList.contains('active') && 
            !mobileNav.contains(event.target) && 
            !mobileMenuBtn.contains(event.target)) {
            mobileNav.classList.remove('active');
        }
    });
    
    // Chat interface functionality
    const chatUserItems = document.querySelectorAll('.chat-user-item');
    const chatMessagesList = document.getElementById('chatMessagesList');
    const chatWithName = document.getElementById('chatWithName');
    const chatWithStatus = document.getElementById('chatWithStatus');
    const chatWithAvatar = document.getElementById('chatWithAvatar');
    const chatForm = document.getElementById('chatForm');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const chatReceiverId = document.getElementById('chatReceiverId');
    const messageTemplate = document.getElementById('messageTemplate');
    let currentChatUserId = null;
    
    // Function to load chat messages for a selected user
    function loadChatMessages(userId) {
        // Clear current messages
        chatMessagesList.innerHTML = '';
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-loading';
        loadingDiv.textContent = 'Loading messages...';
        chatMessagesList.appendChild(loadingDiv);
        
        // In a real application, you would fetch messages from the server
        // For now, we'll simulate with some dummy messages
        setTimeout(() => {
            chatMessagesList.innerHTML = '';
            
            // Example messages - in a real app, these would come from an API
            const messages = [
                { id: 1, sender_id: userId, text: 'Hello there!', time: '10:30 AM', is_outgoing: false },
                { id: 2, sender_id: 'current_user', text: 'Hi! How are you?', time: '10:31 AM', is_outgoing: true },
                { id: 3, sender_id: userId, text: 'I\'m doing well, thanks for asking.', time: '10:32 AM', is_outgoing: false },
                { id: 4, sender_id: 'current_user', text: 'Great to hear! I wanted to discuss the project timeline.', time: '10:33 AM', is_outgoing: true },
                { id: 5, sender_id: userId, text: 'Sure, I\'m available now. What do you need to know?', time: '10:35 AM', is_outgoing: false }
            ];
            
            // Render messages
            messages.forEach(message => {
                const messageElement = messageTemplate.content.cloneNode(true);
                const messageDiv = messageElement.querySelector('.chat-message');
                
                if (message.is_outgoing) {
                    messageDiv.classList.add('outgoing');
                } else {
                    messageDiv.classList.add('incoming');
                }
                
                messageDiv.querySelector('.message-text').textContent = message.text;
                messageDiv.querySelector('.message-time').textContent = message.time;
                
                chatMessagesList.appendChild(messageDiv);
            });
            
            // Scroll to bottom of chat
            chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
        }, 500);
    }
    
    // Handle user selection
    chatUserItems.forEach(userItem => {
        userItem.addEventListener('click', function(e) {
            // Check if the remove button was clicked
            if (e.target.classList.contains('remove-chat')) {
                return; // This is handled in send_message.js
            }
            
            // Remove active class from all users
            chatUserItems.forEach(item => item.classList.remove('active'));
            
            // Add active class to selected user
            this.classList.add('active');
            
            // Get user info
            const userId = this.dataset.userId;
            const userName = this.querySelector('.chat-user-name').textContent;
            const userAvatar = this.querySelector('.chat-user-avatar img').src;
            
            // Update chat header
            chatWithName.textContent = userName;
            chatWithStatus.textContent = 'Online';
            chatWithAvatar.src = userAvatar;
            chatWithAvatar.alt = userName;
            
            // Set receiver ID for the form
            if (chatReceiverId) {
                chatReceiverId.value = userId;
            }
            
            // Load chat messages
            loadChatMessages(userId);
            currentChatUserId = userId;
            
            // For mobile: Switch to chat view
            if (window.innerWidth <= 768) {
                document.querySelector('.chat-container').classList.add('mobile-view-chat');
            }
        });
    });
    
    // Mobile back button functionality
    const backToUsersBtn = document.querySelector('.back-to-users');
    if (backToUsersBtn) {
        backToUsersBtn.addEventListener('click', function() {
            document.querySelector('.chat-container').classList.remove('mobile-view-chat');
        });
    }
    
    // Handle window resize for responsive behavior
    window.addEventListener('resize', function() {
        const chatContainer = document.querySelector('.chat-container');
        if (window.innerWidth > 768 && chatContainer) {
            chatContainer.classList.remove('mobile-view-chat');
        }
    });
    
    // Handle chat form submission
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const messageText = chatMessageInput.value.trim();
            
            if (messageText && currentChatUserId) {
                // Clear input
                chatMessageInput.value = '';
                
                // Create new message element
                const messageElement = messageTemplate.content.cloneNode(true);
                const messageDiv = messageElement.querySelector('.chat-message');
                messageDiv.classList.add('outgoing');
                
                messageDiv.querySelector('.message-text').textContent = messageText;
                
                // Get current time
                const now = new Date();
                const hours = now.getHours() % 12 || 12;
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
                const timeString = `${hours}:${minutes} ${ampm}`;
                
                messageDiv.querySelector('.message-time').textContent = timeString;
                
                // Add message to chat
                chatMessagesList.appendChild(messageDiv);
                
                // Scroll to bottom of chat
                chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
                
                // In a real application, you would send the message to the server here
                // For example: sendMessage(currentChatUserId, messageText);
            }
        });
    }
    
    // Auto-resize textarea as user types
    if (chatMessageInput) {
        chatMessageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
});