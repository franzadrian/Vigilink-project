document.addEventListener('DOMContentLoaded', function() {
    // Define all modal elements first
    // Modal elements
    const viewMessageModal = document.getElementById('viewMessageModal');
    const sendMessageModal = document.getElementById('sendMessageModal');
    const deleteMessageModal = document.getElementById('deleteMessageModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const closeSendModal = document.getElementById('closeSendModal');
    const cancelSendBtn = document.getElementById('cancelSendBtn');
    const replyBtn = document.getElementById('replyBtn');
    const newMessageBtn = document.querySelector('.new-message-btn');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    
    // Message detail elements
    const messageFrom = document.getElementById('messageFrom');
    const messageEmail = document.getElementById('messageEmail');
    const messageSubject = document.getElementById('messageSubject');
    const messageDate = document.getElementById('messageDate');
    const messageContent = document.getElementById('messageContent');
    
    // Send message form elements
    const recipientName = document.getElementById('recipientName');
    const recipientEmail = document.getElementById('recipientEmail');
    const messageSubjectInput = document.getElementById('messageSubjectInput');
    const messageTextarea = document.getElementById('messageTextarea');
    
    // Pagination variables
    let currentPage = 1;
    const rowsPerPage = 10;
    let totalItems = 0;
    let currentMessageToDelete = null;
    
    // Real-time updates variables
    let lastMessageTimestamp = Date.now();
    let unreadMessageCount = 0;
    const pollingInterval = 10000; // Poll every 10 seconds
    
    // Pagination elements
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageNumbersContainer = document.getElementById('pageNumbers');
    
    // Message filtering functionality
    const filterAll = document.getElementById('filter-all');
    const filterInquiry = document.getElementById('filter-inquiry');
    const filterFeedback = document.getElementById('filter-feedback');
    const filterReport = document.getElementById('filter-report');
    const messageRows = document.querySelectorAll('#message-table-body tr:not(.no-messages)');
    const noMessagesRow = document.getElementById('no-messages-row');
    
    // Sidebar toggle functionality
    const sidebarToggleBtn = document.querySelector('.mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    // Function to sort messages - unread first, then by date
    function sortMessages() {
        const rows = Array.from(document.getElementById('message-table-body').querySelectorAll('tr:not(#no-messages-row)'));
        
        // Sort rows: unread first, then by date (newest first)
        rows.sort((a, b) => {
            const aIsRead = a.getAttribute('data-is-read') === 'true';
            const bIsRead = b.getAttribute('data-is-read') === 'true';
            
            // If read status is different, unread comes first
            if (aIsRead !== bIsRead) {
                return aIsRead ? 1 : -1;
            }
            
            // If both have same read status, sort by date (newest first)
            const aDate = parseInt(a.getAttribute('data-date'));
            const bDate = parseInt(b.getAttribute('data-date'));
            return bDate - aDate;
        });
        
        // Reattach rows in the new order
        rows.forEach(row => document.getElementById('message-table-body').appendChild(row));
    }
    
    // Function to filter messages by type
    function filterMessages(type) {
        const messageTableBody = document.getElementById('message-table-body');
        const rows = messageTableBody.querySelectorAll('tr:not(.no-messages):not(.no-messages-dynamic)');
        const noMessagesRow = document.getElementById('no-messages-row');
        let visibleCount = 0;
        
        // Remove any dynamically created no-messages rows first
        const dynamicNoMessages = messageTableBody.querySelectorAll('.no-messages-dynamic');
        dynamicNoMessages.forEach(row => row.remove());
        
        rows.forEach(row => {
            const messageType = row.getAttribute('data-message-type');
            if (type === 'all' || (messageType && messageType.toLowerCase() === type.toLowerCase())) {
                // Show rows that match the filter
                row.style.display = '';
                row.classList.add('filtered-in');
                row.classList.remove('filtered-out');
                visibleCount++;
            } else {
                // Hide rows that don't match the filter
                row.style.display = 'none';
                row.classList.add('filtered-out');
                row.classList.remove('filtered-in');
            }
        });
        
    
        // Show or hide the "No messages found" row
        if (noMessagesRow) {
            if (visibleCount === 0) {
                noMessagesRow.style.display = '';
                noMessagesRow.cells[0].textContent = `No ${type !== 'all' ? type + ' ' : ''}messages found`;
            } else {
                noMessagesRow.style.display = 'none';
            }
        } else if (visibleCount === 0) {
            // Create a new no messages row with a different class to distinguish it
            const newRow = document.createElement('tr');
            newRow.className = 'no-messages-dynamic';
            const cell = document.createElement('td');
            cell.setAttribute('colspan', '6');
            cell.style.textAlign = 'center';
            cell.textContent = `No ${type !== 'all' ? type + ' ' : ''}messages found`;
            newRow.appendChild(cell);
            messageTableBody.appendChild(newRow);
        }
        
        // After filtering, sort to maintain unread at top
        sortMessages();
        
        // Reset to first page and apply pagination
        currentPage = 1;
        applyPagination();
    }
    
    // Simple filter function for the filter buttons
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
    
    // Real-time updates function
    function fetchNewMessages() {
        // Add timestamp to prevent caching and track last request
        const url = `/admin-panel/communication/new-messages/?last_timestamp=${lastMessageTimestamp}`;
        
        fetch(url)
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
                    
                    // If there are new messages, add them to the table
                    if (data.messages && data.messages.length > 0) {
                        const messageTableBody = document.getElementById('message-table-body');
                        let newMessagesAdded = false;
                        
                        // Process messages and update lastMessageTimestamp
                        data.messages.forEach(msg => {
                            // Update last message timestamp if newer
                            const msgTimestamp = new Date(msg.created_at).getTime();
                            if (msgTimestamp > lastMessageTimestamp) {
                                lastMessageTimestamp = msgTimestamp;
                            }
                            
                            // Check if message already exists in the table by ID
                            const existingRow = document.querySelector(`tr[data-message-id="${msg.id}"]`);
                            if (!existingRow) {
                                // Create new row for the message
                                const newRow = createMessageRow(msg);
                                messageTableBody.insertBefore(newRow, messageTableBody.firstChild);
                                newMessagesAdded = true;
                                
                                // Show notification for new message
                                showNotification(`New message received from ${msg.name}`, 'info');
                            }
                        });
                        
                        // Only re-sort and paginate if new messages were added
                        if (newMessagesAdded) {
                            sortMessages();
                            applyPagination();
                        }
                    }
                    
                    console.log("Checked for new messages. Unread count: " + unreadMessageCount);
                }
            })
            .catch(error => {
                console.error('Error fetching new messages:', error);
            })
            .finally(() => {
                // Schedule the next check regardless of success or failure
                setTimeout(fetchNewMessages, pollingInterval);
            });
    }
    
    // Helper function to create a new message row
    function createMessageRow(msg) {
        const row = document.createElement('tr');
        row.setAttribute('data-message-id', msg.id);
        row.setAttribute('data-is-read', msg.is_read.toString());
        row.setAttribute('data-date', new Date(msg.created_at).getTime());
        row.setAttribute('data-message-type', msg.subject.toLowerCase());
        row.className = msg.is_read ? 'read-row' : 'unread-row';
        
        // Format the date
        const date = new Date(msg.created_at);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        const formattedDate = date.toLocaleDateString('en-US', options);
        
        // Create the row content - match the exact structure from the template
        row.innerHTML = `
            <td>${msg.name}</td>
            <td>${msg.subject}</td>
            <td>${msg.message.substring(0, 20)}${msg.message.length > 20 ? '...' : ''}</td>
            <td>${formattedDate}</td>
            <td><span class="${msg.is_read ? 'status-read' : 'status-unread'}">${msg.is_read ? 'Read' : 'Unread'}</span></td>
            <td class="action-buttons">
                <button class="view-btn" data-id="${msg.id}">View</button>
                <button class="delete-btn" data-id="${msg.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners to the new buttons
        row.querySelector('.view-btn').addEventListener('click', function() {
            viewMessage(this.getAttribute('data-id'));
        });
        
        row.querySelector('.delete-btn').addEventListener('click', function() {
            showDeleteConfirmation(this.getAttribute('data-id'));
        });
        
        return row;
    }
    
    // Update unread message badge
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
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) {
            // Create notification element if it doesn't exist
            const notif = document.createElement('div');
            notif.id = 'notification';
            notif.className = `notification ${type}`;
            document.body.appendChild(notif);
        }
        
        const notif = document.getElementById('notification');
        notif.textContent = message;
        notif.className = `notification ${type} show`;
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notif.className = notif.className.replace('show', '');
        }, 3000);
    }
    
    // Handle view message click
    function handleViewMessage() {
        const messageId = this.getAttribute('data-id');
        const row = this.closest('tr');
        const name = row.cells[0].textContent;
        const subject = row.cells[1].textContent;
        // Get the date from the row and ensure it's in the correct format
        const date = row.cells[3].textContent;
        
        // Fetch the full message details from the server
        fetch(`/admin-panel/communication/message/${messageId}/`, {
            method: 'GET',
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            // Populate modal with message details
            if (messageFrom) messageFrom.textContent = name;
            if (messageSubject) messageSubject.textContent = subject;
            if (messageDate) messageDate.textContent = date;
            if (messageContent) messageContent.textContent = data.message || 'Message content not available';
            if (messageEmail) messageEmail.textContent = data.email || 'Email not available';
            
            // Check if user is registered
            const userStatus = document.getElementById('userStatus');
            if (userStatus) {
                if (data.is_registered) {
                    userStatus.textContent = 'Registered User';
                    userStatus.className = 'user-status registered-user';
                } else {
                    userStatus.textContent = 'Guest User';
                    userStatus.className = 'user-status unregistered-user';
                }
            }
        })
        .catch(error => {
            console.error('Error fetching message details:', error);
            // Fallback to preview if fetch fails
            if (messageFrom) messageFrom.textContent = name;
            if (messageSubject) messageSubject.textContent = subject;
            if (messageDate) messageDate.textContent = date;
            if (messageContent && row.cells[2]) messageContent.textContent = row.cells[2].textContent;
            if (messageEmail) messageEmail.textContent = 'Email not available';
            
            const userStatus = document.getElementById('userStatus');
            if (userStatus) {
                userStatus.textContent = 'Unknown';
                userStatus.className = 'user-status unregistered-user';
            }
        });
        
        // Show the modal
        if (viewMessageModal) viewMessageModal.style.display = 'block';
        
        // Mark message as read
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        const markReadUrl = `/admin-panel/communication/mark-read/${messageId}/`;
        
        fetch(markReadUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Update UI to show message as read
                const statusCell = row.querySelector('td:nth-child(5)');
                if (statusCell) statusCell.innerHTML = '<span class="status-read">Read</span>';
                
                // Remove the unread-row class
                row.classList.remove('unread-row');
                
                // Update data attribute
                row.setAttribute('data-is-read', 'true');
                
                // Decrement unread count if this was an unread message
                if (unreadMessageCount > 0) {
                    unreadMessageCount--;
                    updateUnreadBadge();
                }
                
                // Re-sort messages
                sortMessages();
            }
        })
        .catch(error => {
            console.error('Error marking message as read:', error);
        });
    }
    
    // Handle delete message click
function handleDeleteMessage() {
    const messageId = this.getAttribute('data-id');
    currentMessageToDelete = messageId;
    
    // Show the delete confirmation modal
    if (deleteMessageModal) deleteMessageModal.style.display = 'block';
}

// Function to show delete confirmation modal
function showDeleteConfirmation(messageId) {
    currentMessageToDelete = messageId;
    
    // Show the delete confirmation modal
    if (deleteMessageModal) deleteMessageModal.style.display = 'block';
}
    
    // Pagination functions
    function applyPagination() {
        const messageTableBody = document.getElementById('message-table-body');
        const rows = Array.from(messageTableBody.querySelectorAll('tr:not(.no-messages):not(.no-messages-dynamic)'));
        const visibleRows = rows.filter(row => !row.classList.contains('filtered-out'));
        totalItems = visibleRows.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        
        // For filtered rows, we already set their display to 'none' in filterMessages
        // So we only need to handle pagination for visible rows
        
        // Hide all visible rows first
        visibleRows.forEach(row => {
            row.style.display = 'none';
        });
        
        // Show rows for current page
        for (let i = (currentPage - 1) * rowsPerPage; i < currentPage * rowsPerPage && i < visibleRows.length; i++) {
            visibleRows[i].style.display = '';
        }
        
        // Update pagination info
        const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
        const endIndex = Math.min(currentPage * rowsPerPage, totalItems);
        const startIndexEl = document.getElementById('startIndex');
        const endIndexEl = document.getElementById('endIndex');
        const totalItemsEl = document.getElementById('totalItems');
        
        if (startIndexEl && endIndexEl && totalItemsEl) {
            startIndexEl.textContent = startIndex;
            endIndexEl.textContent = endIndex;
            totalItemsEl.textContent = totalItems;
        }
        
        // Update page number buttons
        updatePageNumbers(totalPages);
    }
    
    function updatePageNumbers(totalPages) {
        if (!pageNumbersContainer) return;
        
        pageNumbersContainer.innerHTML = '';
        
        // Only show current page number as unclickable display
        const pageDisplay = document.createElement('div');
        pageDisplay.textContent = currentPage;
        pageDisplay.style.minWidth = '36px';
        pageDisplay.style.height = '36px';
        pageDisplay.style.backgroundColor = '#2563EB';
        pageDisplay.style.color = 'white';
        pageDisplay.style.border = '2px solid #2563EB';
        pageDisplay.style.borderRadius = '6px';
        pageDisplay.style.display = 'flex';
        pageDisplay.style.alignItems = 'center';
        pageDisplay.style.justifyContent = 'center';
        pageDisplay.style.fontWeight = '600';
        pageDisplay.style.margin = '0 3px';
        pageDisplay.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
        pageNumbersContainer.appendChild(pageDisplay);
        
        // Hide/show prev/next buttons
        if (prevPageBtn) {
            if (currentPage === 1) {
                prevPageBtn.style.display = 'none';
            } else {
                prevPageBtn.style.display = '';
            }
        }
        
        if (nextPageBtn) {
            if (currentPage >= totalPages || totalPages === 0) {
                nextPageBtn.style.display = 'none';
            } else {
                nextPageBtn.style.display = '';
            }
        }
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
    
    function toggleSidebar() {
        if (!sidebar || !sidebarOverlay) return;
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        document.body.classList.toggle('sidebar-open');
    }
    
    // Set 'All Messages' as active by default
    if (filterAll) {
        filterAll.classList.add('active');
        filterAll.style.backgroundColor = '#2563eb';
        filterAll.style.color = 'white';
    }

    // Add event listeners for all buttons
    
    // Filter button event listeners
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
    
    // Sidebar toggle functionality
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    // Close sidebar when clicking on overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }
    
    // View message button click handler
    const viewButtons = document.querySelectorAll('.view-btn');
    if (viewButtons) {
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const messageId = this.getAttribute('data-id');
                const row = this.closest('tr');
                const name = row.cells[0].textContent;
                const subject = row.cells[1].textContent;
                // Get the date from the row - it's already formatted correctly
                const date = row.cells[3].textContent; // Correct index for date cell
                
                // Fetch the full message details from the server
                fetch(`/admin-panel/communication/message/${messageId}/`, {
                    method: 'GET',
                    headers: {
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    // Populate modal with message details
                    if (messageFrom) messageFrom.textContent = name;
                    if (messageSubject) messageSubject.textContent = subject;
                    if (messageDate) messageDate.textContent = date;
                    if (messageContent) messageContent.textContent = data.message || 'Message content not available';
                    if (messageEmail) messageEmail.textContent = data.email || 'Email not available';
                    
                    // Check if user is registered
                    const userStatus = document.getElementById('userStatus');
                    if (userStatus) {
                        if (data.is_registered) {
                            userStatus.textContent = 'Registered User';
                            userStatus.className = 'user-status registered-user';
                        } else {
                            userStatus.textContent = 'Guest User';
                            userStatus.className = 'user-status unregistered-user';
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching message details:', error);
                    // Fallback to preview if fetch fails
                    if (messageFrom) messageFrom.textContent = name;
                    if (messageSubject) messageSubject.textContent = subject;
                    if (messageDate) messageDate.textContent = date;
                    if (messageContent && row.cells[2]) messageContent.textContent = row.cells[2].textContent;
                    if (messageEmail) messageEmail.textContent = 'Email not available';
                    
                    const userStatus = document.getElementById('userStatus');
                    if (userStatus) {
                        userStatus.textContent = 'Unknown';
                        userStatus.className = 'user-status unregistered-user';
                    }
                });
                
                // Show the modal
                if (viewMessageModal) viewMessageModal.style.display = 'block';
                
                // Mark message as read
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                const markReadUrl = `/admin-panel/communication/mark-read/${messageId}/`;
                
                fetch(markReadUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Update UI to show message as read - ONLY update the status cell (5th column)
                        const statusCell = row.querySelector('td:nth-child(5)');
                        if (statusCell) statusCell.innerHTML = '<span class="status-read">Read</span>';
                        
                        // Remove the unread-row class to remove the red indicator
                        row.classList.remove('unread-row');
                        
                        // Update data attribute
                        row.setAttribute('data-is-read', 'true');
                        
                        // Re-sort messages to move this now-read message to its proper place
                        sortMessages();
                    }
                })
                .catch(error => {
                    console.error('Error marking message as read:', error);
                });
            });
        });
    }

        // Delete message button click handler
    const deleteButtons = document.querySelectorAll('.delete-btn');
    if (deleteButtons) {
        deleteButtons.forEach(button => {
            button.addEventListener('click', handleDeleteMessage);
        });
    }
    
    // Initialize real-time updates
    function initializeRealTimeUpdates() {
        // Count initial unread messages
        const unreadRows = document.querySelectorAll('#message-table-body tr.unread-row');
        unreadMessageCount = unreadRows.length;
        updateUnreadBadge();
        
        // Start polling for new messages
        setTimeout(fetchNewMessages, pollingInterval);
    }
    
    // Initialize on page load
    initializeRealTimeUpdates();
    
    // New message button click handler
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', function() {
            // Clear form fields
            if (recipientName) recipientName.value = '';
            if (recipientEmail) recipientEmail.value = '';
            if (messageSubjectInput) messageSubjectInput.value = '';
            if (messageTextarea) messageTextarea.value = '';
            
            // Show the send message modal
            if (sendMessageModal) sendMessageModal.style.display = 'block';
        });
    }
    
    // Reply button click handler
    if (replyBtn) {
        replyBtn.addEventListener('click', function() {
            // Pre-fill recipient info from the viewed message
            if (recipientName && messageFrom) recipientName.value = messageFrom.textContent;
            if (recipientEmail && messageEmail) recipientEmail.value = messageEmail.textContent;
            if (messageSubjectInput && messageSubject) {
                const subject = messageSubject.textContent;
                messageSubjectInput.value = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
            }
            
            // Hide view message modal and show send message modal
            if (viewMessageModal) viewMessageModal.style.display = 'none';
            if (sendMessageModal) sendMessageModal.style.display = 'block';
        });
    }
    
    // Send message button click handler
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', function() {
            // Get form values
            const name = recipientName ? recipientName.value : '';
            const email = recipientEmail ? recipientEmail.value : '';
            const subject = messageSubjectInput ? messageSubjectInput.value : '';
            const message = messageTextarea ? messageTextarea.value : '';
            
            // Validate form
            if (!name || !email || !subject || !message) {
                alert('Please fill in all fields');
                return;
            }
            
            // Send message to server
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            fetch('/admin-panel/communication/send-message/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient_name: name,
                    recipient_email: email,
                    subject: subject,
                    message: message
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Close modal and show success message
                    if (sendMessageModal) sendMessageModal.style.display = 'none';
                    alert('Message sent successfully');
                } else {
                    alert('Error sending message: ' + (data.message || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error sending message:', error);
                alert('Error sending message. Please try again.');
            });
        });
    }
    
    // Confirm delete button click handler
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (!currentMessageToDelete) {
                if (deleteMessageModal) deleteMessageModal.style.display = 'none';
                return;
            }
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const deleteUrl = `/admin-panel/communication/delete/${currentMessageToDelete}/`;
            
            fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Remove the message row from the table
                    const messageRows = document.querySelectorAll('#message-table-body tr');
                    messageRows.forEach(row => {
                        const viewBtn = row.querySelector('.view-btn');
                        if (viewBtn && viewBtn.getAttribute('data-id') === currentMessageToDelete) {
                            // Check if this was an unread message
                            if (row.classList.contains('unread-row')) {
                                // Decrement unread count
                                if (unreadMessageCount > 0) {
                                    unreadMessageCount--;
                                    updateUnreadBadge();
                                }
                            }
                            row.remove();
                        }
                    });
                    
                    // Hide the modal
                    if (deleteMessageModal) deleteMessageModal.style.display = 'none';
                    
                    // Show success notification
                    showNotification('Message deleted successfully', 'success');
                    
                    // Reset current message to delete
                    currentMessageToDelete = null;
                    
                    // Re-apply pagination
                    applyPagination();
                } else {
                    alert('Error deleting message: ' + (data.message || 'Unknown error'));
                    showNotification('Error deleting message', 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting message:', error);
                alert('Error deleting message. Please try again.');
                showNotification('Error deleting message', 'error');
            });
        });
    }
    
    // Close modal buttons
    if (closeViewModal) closeViewModal.addEventListener('click', function() { if (viewMessageModal) viewMessageModal.style.display = 'none'; });
    if (closeViewBtn) closeViewBtn.addEventListener('click', function() { if (viewMessageModal) viewMessageModal.style.display = 'none'; });
    if (closeSendModal) closeSendModal.addEventListener('click', function() { if (sendMessageModal) sendMessageModal.style.display = 'none'; });
    if (cancelSendBtn) cancelSendBtn.addEventListener('click', function() { if (sendMessageModal) sendMessageModal.style.display = 'none'; });
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', function() { if (deleteMessageModal) deleteMessageModal.style.display = 'none'; });
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', function() { if (deleteMessageModal) deleteMessageModal.style.display = 'none'; });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (viewMessageModal && event.target === viewMessageModal) {
            viewMessageModal.style.display = 'none';
        }
        if (sendMessageModal && event.target === sendMessageModal) {
            sendMessageModal.style.display = 'none';
        }
        if (deleteMessageModal && event.target === deleteMessageModal) {
            deleteMessageModal.style.display = 'none';
        }
    });
    
    // Pagination button event listeners
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                applyPagination();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(totalItems / rowsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                applyPagination();
            }
        });
    }
    
    // Initialize sorting and pagination
    sortMessages();
    applyPagination();
}); // End of DOMContentLoaded event listener