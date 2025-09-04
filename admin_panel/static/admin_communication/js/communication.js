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
        document.querySelector('.new-message-btn').addEventListener('click', function() {
            document.querySelector('.message-textarea').value = '';
            document.querySelector('.message-textarea').focus();
        });