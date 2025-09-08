document.addEventListener('DOMContentLoaded', function() {
            // Sidebar toggle functionality
            const sidebarToggleBtn = document.querySelector('.mobile-menu-btn');
            const sidebar = document.querySelector('.sidebar');
            const sidebarOverlay = document.querySelector('.sidebar-overlay');
            
            function toggleSidebar() {
                sidebar.classList.toggle('open');
                sidebarOverlay.classList.toggle('active');
                document.body.classList.toggle('sidebar-open');
            }
            
            if (sidebarToggleBtn) {
                sidebarToggleBtn.addEventListener('click', toggleSidebar);
            }
            
            // Close sidebar when clicking on overlay
            if (sidebarOverlay) {
                sidebarOverlay.addEventListener('click', toggleSidebar);
            }
            
            // Close sidebar on window resize if open
            window.addEventListener('resize', function() {
                if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            });
        });

        // Add interactivity to action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                console.log('Action clicked for message');
            });
        });

        // Add functionality to new message button
        const newMessageBtn = document.querySelector('.new-message-btn');
        if (newMessageBtn) {
            newMessageBtn.addEventListener('click', function() {
                // Show the message modal instead of trying to access non-existent elements
                const messageTextarea = document.getElementById('messageTextarea');
                if (messageTextarea) {
                    messageTextarea.value = '';
                    messageTextarea.focus();
                }
            });
        }