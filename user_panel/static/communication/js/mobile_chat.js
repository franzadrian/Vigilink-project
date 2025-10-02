// Mobile Chat Navigation
document.addEventListener('DOMContentLoaded', function() {
    const userList = document.getElementById('user-list');
    const chatMessages = document.getElementById('chat-messages');
    const backButton = document.getElementById('back-to-users');
    const chatContent = document.querySelector('.chat-content');
    
    // Function to show chat and hide user list on mobile
    function showChat(userName, userInitial) {
        if (window.innerWidth <= 768) {
            chatContent.classList.add('mobile-chat-active');
            document.getElementById('selected-user-name').textContent = userName;
            document.getElementById('selected-user-avatar').textContent = userInitial;
        }
    }
    
    // Function to go back to user list
    function backToUserList() {
        chatContent.classList.remove('mobile-chat-active');
    }
    
    // Event listener for back button
    backButton.addEventListener('click', backToUserList);
    
    // Intercept user selection clicks
    document.addEventListener('click', function(e) {
        // Find if the click was on a user in the list
        const userItem = e.target.closest('.user-item');
        if (userItem) {
            const userName = userItem.querySelector('.user-name').textContent;
            const userInitial = userName.charAt(0).toUpperCase();
            showChat(userName, userInitial);
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            // Reset mobile-specific classes on desktop
            chatContent.classList.remove('mobile-chat-active');
        }
    });
});