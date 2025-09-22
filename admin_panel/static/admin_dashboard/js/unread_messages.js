// Unread Messages Handler for Admin Panel
document.addEventListener('DOMContentLoaded', function() {
    // Variables
    let unreadMessageCount = 0;
    const pollingInterval = 10000; // Poll every 10 seconds
    
    // Initialize
    initUnreadBadge();
    fetchUnreadCount();
    
    // Set up polling for new messages
    setInterval(fetchUnreadCount, pollingInterval);
    
    // Initialize the unread badge
    function initUnreadBadge() {
        // Find the Communication link in the sidebar
        const communicationLink = document.querySelector('a[href*="admin_communication"]');
        
        if (communicationLink) {
            // Check if badge already exists
            let badge = communicationLink.querySelector('.unread-badge');
            
            // If badge doesn't exist, create it
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'unread-badge';
                badge.className = 'unread-badge';
                badge.style.display = 'none';
                // All other styles are now in the CSS file
                
                // Add the badge to the communication link
                communicationLink.style.position = 'relative';
                communicationLink.appendChild(badge);
            }
        }
    }
    
    // Fetch unread message count from the server
    function fetchUnreadCount() {
        fetch('/admin-panel/communication/unread-count/')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    // Update unread count
                    unreadMessageCount = data.unread_count;
                    updateUnreadBadge();
                }
            })
            .catch(error => {
                console.error('Error fetching unread count:', error);
            });
    }
    
    // Update the unread message badge
    function updateUnreadBadge() {
        const badge = document.getElementById('unread-badge');
        if (badge) {
            if (unreadMessageCount > 0) {
                badge.textContent = unreadMessageCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }
});