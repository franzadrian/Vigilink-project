// Initialize Lucide icons and sidebar functionality
document.addEventListener('DOMContentLoaded', function() {
  lucide.createIcons();
  
  // Mobile sidebar functionality
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  // Get sidebar element without redeclaring the variable
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mainContent = document.querySelector('.chat-content');

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
    
    // Toggle the sidebar icon
    const sidebarIcon = document.querySelector('.sidebar-toggle-icon path');
    if (sidebar.classList.contains('open')) {
      document.body.style.overflow = 'hidden';
      sidebarIcon.setAttribute('d', 'M15 19l-7-7 7-7');
    } else {
      document.body.style.overflow = '';
      sidebarIcon.setAttribute('d', 'M9 5l7 7-7 7');
    }
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleSidebar);
  }
  
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
  
  // Close sidebar on window resize if in mobile view
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });
});

// Mock Data
const mockUsers = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar: "",
    status: "online",
    lastMessage: "Hey! How are you doing today?",
    lastMessageTime: "2m",
    unreadCount: 2
  },
  {
    id: "2", 
    name: "Bob Smith",
    avatar: "",
    status: "away",
    lastMessage: "Sure, let's meet tomorrow at 3 PM",
    lastMessageTime: "1h",
    unreadCount: 0
  },
  {
    id: "3",
    name: "Carol Davis",
    avatar: "",
    status: "offline",
    lastMessage: "Thanks for your help with the project!",
    lastMessageTime: "3h",
    unreadCount: 1
  },
  {
    id: "4",
    name: "David Wilson",
    avatar: "",
    status: "online",
    lastMessage: "Did you see the latest updates?",
    lastMessageTime: "5h",
    unreadCount: 0
  },
  {
    id: "5",
    name: "Emma Brown",
    avatar: "",
    status: "away",
    lastMessage: "I'll send you the files in a moment",
    lastMessageTime: "1d",
    unreadCount: 3
  }
];

const mockMessages = [
  {
    id: "1",
    text: "Hi there! How's your day going?",
    timestamp: "10:30 AM",
    isOwn: false,
    sender: "Alice Johnson"
  },
  {
    id: "2", 
    text: "Pretty good, thanks! Just working on some projects. How about you?",
    timestamp: "10:32 AM",
    isOwn: true,
    sender: "You"
  },
  {
    id: "3",
    text: "Same here! I'm excited about the new features we're building.",
    timestamp: "10:33 AM", 
    isOwn: false,
    sender: "Alice Johnson"
  },
  {
    id: "4",
    text: "Yeah, it's going to be amazing! The chat interface is looking really clean.",
    timestamp: "10:35 AM",
    isOwn: true,
    sender: "You"
  },
  {
    id: "5",
    text: "I love how responsive it is across different devices. Great work!",
    timestamp: "10:36 AM",
    isOwn: false,
    sender: "Alice Johnson"
  }
];

// Global State
let selectedUser = null;
let messages = [...mockMessages];
let filteredUsers = [...mockUsers];
let isMobile = window.innerWidth < 768;
let sidebarCollapsed = false;
let showUserList = true; // For mobile view switching

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const backBtn = document.getElementById('back-btn');
const userList = document.getElementById('user-list');
const chatMessages = document.getElementById('chat-messages');
const welcomeScreen = document.getElementById('welcome-screen');
const selectedUserInfo = document.getElementById('selected-user-info');
const defaultHeaderInfo = document.getElementById('default-header-info');
const usersContainer = document.querySelector('.users-container');
const messagesList = document.getElementById('messages-list');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userSearch = document.getElementById('user-search');

// Utility Functions
function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function checkIfMobile() {
  const wasMobile = isMobile;
  isMobile = window.innerWidth < 768;
  
  if (wasMobile !== isMobile) {
    updateLayout();
  }
}

function updateLayout() {
  if (isMobile) {
    // Mobile layout
    if (selectedUser) {
      // Show chat messages, hide user list
      userList.classList.add('hidden-mobile');
      chatMessages.classList.remove('hidden-mobile');
      welcomeScreen.classList.add('hidden-mobile');
      backBtn.classList.remove('hidden');
      backBtn.classList.add('show-mobile');
      
      // Show call/video buttons for selected user
      document.querySelector('.call-btn').classList.add('show-mobile');
      document.querySelector('.video-btn').classList.add('show-mobile');
    } else {
      // Show user list, hide chat messages
      userList.classList.remove('hidden-mobile');
      chatMessages.classList.add('hidden-mobile');
      welcomeScreen.classList.add('hidden-mobile');
      backBtn.classList.add('hidden');
      backBtn.classList.remove('show-mobile');
      
      // Hide call/video buttons
      document.querySelector('.call-btn').classList.remove('show-mobile');
      document.querySelector('.video-btn').classList.remove('show-mobile');
    }
    
    // Hide sidebar on mobile
    sidebar.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.remove();
  } else {
    // Desktop layout
    userList.classList.remove('hidden-mobile');
    
    if (selectedUser) {
      chatMessages.classList.remove('hidden-mobile');
      welcomeScreen.classList.add('hidden');
    } else {
      chatMessages.classList.add('hidden');
      welcomeScreen.classList.remove('hidden');
    }
    
    backBtn.classList.add('hidden');
    backBtn.classList.remove('show-mobile');
    
    // Always show call/video buttons on desktop when user selected
    if (selectedUser) {
      document.querySelector('.call-btn').classList.remove('hidden');
      document.querySelector('.video-btn').classList.remove('hidden');
    } else {
      document.querySelector('.call-btn').classList.add('hidden');
      document.querySelector('.video-btn').classList.add('hidden'); 
    }
  }
}

// User List Functions - Use document fragment for better performance
function renderUsers() {
  if (!usersContainer) return;
  
  const fragment = document.createDocumentFragment();
  
  filteredUsers.forEach(user => {
    const userElement = document.createElement('button');
    userElement.className = `user-item ${selectedUser?.id === user.id ? 'selected' : ''}`;
    userElement.onclick = () => selectUser(user);
    
    userElement.innerHTML = `
      <div class="user-avatar">
        <div class="avatar-text">${getInitials(user.name)}</div>
        <div class="status-indicator ${user.status}"></div>
      </div>
      <div class="user-info">
        <div class="user-name">${user.name}</div>
        <div class="last-message">${user.lastMessage}</div>
      </div>
      <div class="user-meta">
        <div class="last-time">${user.lastMessageTime}</div>
        ${user.unreadCount > 0 ? `<div class="unread-count">${user.unreadCount}</div>` : ''}
      </div>
    `;
    
    fragment.appendChild(userElement);
  });
  
  // Clear and append in one operation
  usersContainer.innerHTML = '';
  usersContainer.appendChild(fragment);
}

function selectUser(user) {
  selectedUser = user;
  
  // Update header info
  selectedUserInfo.classList.remove('hidden');
  defaultHeaderInfo.classList.add('hidden');
  
  const avatarText = selectedUserInfo.querySelector('.avatar-text');
  const statusIndicator = selectedUserInfo.querySelector('.status-indicator');
  const userName = selectedUserInfo.querySelector('.user-name');
  const userStatus = selectedUserInfo.querySelector('.user-status');
  
  avatarText.textContent = getInitials(user.name);
  statusIndicator.className = `status-indicator ${user.status}`;
  userName.textContent = user.name;
  userStatus.textContent = user.status;
  
  // Update placeholder in message input
  messageInput.placeholder = `Message ${user.name}...`;
  
  // Render messages and users (to update selection)
  renderMessages();
  renderUsers();
  
  // Update layout for mobile
  updateLayout();
}

function deselectUser() {
  selectedUser = null;
  
  // Update header info
  selectedUserInfo.classList.add('hidden');
  defaultHeaderInfo.classList.remove('hidden');
  
  // Reset message input placeholder
  messageInput.placeholder = 'Type a message...';
  
  // Render users (to remove selection)
  renderUsers();
  
  // Update layout
  updateLayout();
}

// Message Functions
function renderMessages() {
  if (!selectedUser) {
    messagesList.innerHTML = '';
    return;
  }
  
  messagesList.innerHTML = '';
  
  messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.isOwn ? 'own' : 'received'}`;
    
    messageElement.innerHTML = `
      ${!message.isOwn ? `<div class="sender-name">${message.sender}</div>` : ''}
      <div class="message-content">
        <div class="message-text">${message.text}</div>
        <div class="message-time">${message.timestamp}</div>
      </div>
    `;
    
    messagesList.appendChild(messageElement);
  });
  
  // Scroll to bottom
  setTimeout(() => {
    messagesList.scrollTop = messagesList.scrollHeight;
  }, 100);
}

function sendMessage(text) {
  if (!selectedUser || !text.trim()) return;
  
  const newMessage = {
    id: Date.now().toString(),
    text: text.trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isOwn: true,
    sender: "You"
  };
  
  messages.push(newMessage);
  renderMessages();
  
  // Clear input
  messageInput.value = '';
  updateSendButton();
}

function updateSendButton() {
  const hasText = messageInput.value.trim().length > 0;
  sendBtn.disabled = !hasText;
  
  const icon = sendBtn.querySelector('i');
  if (hasText) {
    icon.setAttribute('data-lucide', 'send');
  } else {
    icon.setAttribute('data-lucide', 'mic');
  }
  
  // Reinitialize the icon
  lucide.createIcons();
}

// Search Functions
function filterUsers(query) {
  const searchTerm = query.toLowerCase();
  filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm)
  );
  renderUsers();
}

// Sidebar Functions
function toggleSidebar() {
  if (isMobile) {
    // Mobile sidebar overlay
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
      sidebar.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.remove();
    } else {
      sidebar.classList.add('open');
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay show';
      overlay.onclick = () => toggleSidebar();
      document.body.appendChild(overlay);
    }
  } else {
    // Desktop sidebar collapse
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
  }
}

// Event Listeners
sidebarToggle.addEventListener('click', toggleSidebar);

backBtn.addEventListener('click', () => {
  if (isMobile) {
    deselectUser();
  }
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(messageInput.value);
});

messageInput.addEventListener('input', updateSendButton);

userSearch.addEventListener('input', (e) => {
  filterUsers(e.target.value);
});

// Handle search in header (desktop)
document.querySelector('.header-right .search-input').addEventListener('input', (e) => {
  filterUsers(e.target.value);
});

// Window resize handler
window.addEventListener('resize', checkIfMobile);

// Navigation handlers
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Update active state
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    // Handle navigation based on data-page attribute
    const page = item.getAttribute('data-page');
    console.log(`Navigating to: ${page}`);
    
    // Close mobile sidebar after navigation
    if (isMobile && sidebar.classList.contains('open')) {
      toggleSidebar();
    }
  });
});

// Sign out handler
document.querySelector('.sign-out-btn').addEventListener('click', () => {
  console.log('Sign out clicked');
  // Implement sign out logic here
});

// Initialize the app
function initializeApp() {
  renderUsers();
  updateSendButton();
  updateLayout();
  
  // Initialize with first user selected for demo
  setTimeout(() => {
    if (!isMobile) {
      selectUser(mockUsers[0]);
    }
  }, 500);
}

// Start the app
initializeApp();