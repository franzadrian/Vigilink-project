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
            
            // Message filtering functionality
            const filterAll = document.getElementById('filter-all');
            const filterInquiry = document.getElementById('filter-inquiry');
            const filterFeedback = document.getElementById('filter-feedback');
            const filterReport = document.getElementById('filter-report');
            const messageRows = document.querySelectorAll('#message-table-body tr:not(.no-messages)');
            const noMessagesRow = document.getElementById('no-messages-row');
            
            // Set 'All Messages' as active by default
            if (filterAll) {
                filterAll.classList.add('active');
                filterAll.style.backgroundColor = '#2563eb';
                filterAll.style.color = 'white';
            }
            
            function updateFilterButtons(activeButton) {
                // Remove active class from all buttons
                [filterAll, filterInquiry, filterFeedback, filterReport].forEach(btn => {
                    if (btn) {
                        btn.classList.remove('active');
                        btn.style.backgroundColor = '#e5e7eb';
                        btn.style.color = '#4b5563';
                    }
                });
                
                // Add active class to clicked button
                if (activeButton) {
                    activeButton.classList.add('active');
                    activeButton.style.backgroundColor = '#2563eb';
                    activeButton.style.color = 'white';
                }
            }
            
            function filterMessages(messageType) {
                let visibleCount = 0;
                
                messageRows.forEach(row => {
                    if (messageType === 'all' || row.getAttribute('data-message-type') === messageType) {
                        row.style.display = '';
                        visibleCount++;
                    } else {
                        row.style.display = 'none';
                    }
                });
                
                // Show or hide the "No messages found" row
                if (noMessagesRow) {
                    noMessagesRow.style.display = visibleCount === 0 ? '' : 'none';
                }
                
                // Update pagination info
                updatePaginationInfo(visibleCount);
            }
            
            function updatePaginationInfo(count) {
                const startIndex = document.getElementById('startIndex');
                const endIndex = document.getElementById('endIndex');
                const totalItems = document.getElementById('totalItems');
                
                if (startIndex && endIndex && totalItems) {
                    startIndex.textContent = count > 0 ? '1' : '0';
                    endIndex.textContent = count.toString();
                    totalItems.textContent = count.toString();
                }
            }
            
            if (filterAll) {
                filterAll.addEventListener('click', function() {
                    updateFilterButtons(this);
                    filterMessages('all');
                });
            }
            
            if (filterInquiry) {
                filterInquiry.addEventListener('click', function() {
                    updateFilterButtons(this);
                    filterMessages('inquiry');
                });
            }
            
            if (filterFeedback) {
                filterFeedback.addEventListener('click', function() {
                    updateFilterButtons(this);
                    filterMessages('feedback');
                });
            }
            
            if (filterReport) {
                filterReport.addEventListener('click', function() {
                    updateFilterButtons(this);
                    filterMessages('report');
                });
            }
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
        
        // Pagination functionality
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const pageNumbersContainer = document.getElementById('pageNumbers');
        
        let currentPage = 1;
        const itemsPerPage = 10;
        let totalPages = 1;
        
        function initPagination() {
            // Get visible messages after filtering
            const visibleMessages = Array.from(document.querySelectorAll('#message-table-body tr:not(.no-messages):not([style*="display: none"])'));
            const totalItems = visibleMessages.length;
            
            // Calculate total pages
            totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
            
            // Update pagination info
            updatePaginationInfo(totalItems);
            
            // Generate page numbers
            generatePageNumbers();
            
            // Show/hide messages based on current page
            updateVisibleMessages(visibleMessages);
            
            // Update button states
            updatePaginationButtons();
        }
        
        function generatePageNumbers() {
            // Clear existing page numbers
            pageNumbersContainer.innerHTML = '';
            
            // Generate page number buttons
            for (let i = 1; i <= totalPages; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                pageButton.classList.add('page-number');
                
                if (i === currentPage) {
                    pageButton.classList.add('active');
                }
                
                pageButton.addEventListener('click', function(e) {
                    e.preventDefault(); // Prevent page scrolling
                    currentPage = i;
                    initPagination();
                });
                
                pageNumbersContainer.appendChild(pageButton);
            }
        }
        
        function updatePaginationInfo(totalItems) {
            const startIndex = document.getElementById('startIndex');
            const endIndex = document.getElementById('endIndex');
            const totalItemsElement = document.getElementById('totalItems');
            
            if (startIndex && endIndex && totalItemsElement) {
                const startIdx = (currentPage - 1) * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
                
                startIndex.textContent = totalItems > 0 ? startIdx + 1 : '0';
                endIndex.textContent = endIdx.toString();
                totalItemsElement.textContent = totalItems.toString();
            }
        }
        
        function updateVisibleMessages(visibleMessages) {
            const startIdx = (currentPage - 1) * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, visibleMessages.length);
            
            // Hide all messages first
            visibleMessages.forEach(row => {
                row.style.display = 'none';
            });
            
            // Show only messages for current page
            for (let i = startIdx; i < endIdx; i++) {
                if (visibleMessages[i]) {
                    visibleMessages[i].style.display = '';
                }
            }
        }
        
        function updatePaginationButtons() {
            // Hide Previous button on first page
            if (prevPageBtn) {
                prevPageBtn.style.display = currentPage === 1 ? 'none' : 'flex';
            }
            
            // Hide Next button on last page
            if (nextPageBtn) {
                nextPageBtn.style.display = currentPage === totalPages ? 'none' : 'flex';
            }
        }
        
        // Event listeners for pagination buttons
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent page scrolling
                if (currentPage > 1) {
                    currentPage--;
                    initPagination();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent page scrolling
                if (currentPage < totalPages) {
                    currentPage++;
                    initPagination();
                }
            });
        }
        
        // Initialize pagination
        initPagination();
        
        // Update pagination when filtering messages
        function filterMessages(messageType) {
            let visibleCount = 0;
            
            messageRows.forEach(row => {
                if (messageType === 'all' || row.getAttribute('data-message-type') === messageType) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });
            
            // Show or hide the "No messages found" row
            if (noMessagesRow) {
                noMessagesRow.style.display = visibleCount === 0 ? '' : 'none';
            }
            
            // Reset to first page when filtering
            currentPage = 1;
            
            // Update pagination
            initPagination();
        }