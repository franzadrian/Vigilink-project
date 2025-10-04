/**
 * Post Interactions JavaScript
 * Handles AJAX interactions for post reactions, replies, and shares
 */

// Make functions globally accessible
window.setupPostActions = setupPostActions;
window.setupReplyActions = setupReplyActions;
window.setupDropdownToggles = setupDropdownToggles;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Post interactions script loaded');
    
    // Setup reaction forms
    setupReactionForms();
    
    // setupShareForms removed
    
    // Setup reply buttons
    setupReplyButtons();
    
    // Setup dropdown toggles for post and reply actions
    setupDropdownToggles();
    
    // Setup post actions (edit/delete)
    setupPostActions();
    
    // Setup reply actions (edit/delete)
    setupReplyActions();

    // Initialize reply count from data attribute if available
    initializeReplyCount();
    
    // Listen for custom reply count update events
    document.addEventListener('replyCountUpdated', function(e) {
        const { postId, count } = e.detail;
        console.log(`Custom event received: update reply count for post ${postId} to ${count}`);
        
        // We no longer update the reply button text as it now just shows "Reply"
        // But we still need to keep this event listener for other functionality
    });
});

/**
 * Initialize reply count from data attribute
 */
function initializeReplyCount() {
    const repliesHeading = document.querySelector('.replies-container h3');
    if (repliesHeading) {
        const storedCount = repliesHeading.getAttribute('data-reply-count');
        if (storedCount !== null) {
            // Update the heading text with the stored count
            repliesHeading.textContent = `Comments (${storedCount})`;
            console.log(`Initialized reply count from data attribute: ${storedCount}`);
        }
    }
}

/**
 * Setup dropdown toggles for post and reply actions
 */
function setupDropdownToggles() {
    console.log('Setting up dropdown toggles in post_interactions.js');
    
    // Setup post actions dropdown toggle
    document.querySelectorAll('.post-actions-toggle').forEach(toggle => {
        // Remove any existing event listeners
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const menu = this.nextElementSibling;
            
            // Close all other menus first
            document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(openMenu => {
                openMenu.classList.remove('show');
            });
            
            // Toggle this menu
            menu.classList.toggle('show');
        });
    });
    
    // Setup reply actions dropdown toggles
    document.querySelectorAll('.reply-actions-toggle').forEach(toggle => {
        // Remove any existing event listeners
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const menu = this.nextElementSibling;
            
            // Close all other menus first
            document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(openMenu => {
                openMenu.classList.remove('show');
            });
            
            // Toggle this menu
            menu.classList.toggle('show');
        });
    });
    
    // Close all menus when clicking outside
    // Remove any existing document click listener to avoid duplicates
    document.removeEventListener('click', closeDropdownMenus, true);
    
    // Add the listener again
    document.addEventListener('click', closeDropdownMenus, true);
    
    // Return a cleanup function to remove the event listener when needed
    return function cleanup() {
        document.removeEventListener('click', closeDropdownMenus, true);
    };
}

/**
 * Close dropdown menus when clicking outside
 */
function closeDropdownMenus(e) {
    // Only close if we're not clicking on a toggle button or inside a menu
    if (!e.target.closest('.post-actions-toggle') && 
        !e.target.closest('.reply-actions-toggle') && 
        !e.target.closest('.post-actions-menu') && 
        !e.target.closest('.reply-actions-menu')) {
        
        document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
}

/**
 * Setup reaction form submissions with AJAX
 */
function setupReactionForms() {
    const reactionForms = document.querySelectorAll('.reaction-form');
    
    reactionForms.forEach(form => {
        const button = form.querySelector('.reaction-btn');
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const url = form.getAttribute('action');
            const csrfToken = form.querySelector('input[name="csrfmiddlewaretoken"]').value;
            const countSpan = this.querySelector('span');
            const heartIcon = this.querySelector('svg');
            
            // Disable button temporarily to prevent multiple clicks
            this.disabled = true;
            
            fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(data => {
                // Update the reaction count
                countSpan.textContent = `${data.count} ${data.count === 1 ? 'Like' : 'Likes'}`;
                
                // Toggle the heart icon fill and class
                if (data.status === 'added') {
                    this.classList.add('reacted');
                    heartIcon.setAttribute('fill', '#ef4444');
                    heartIcon.setAttribute('stroke', '#ef4444');
                } else {
                    this.classList.remove('reacted');
                    heartIcon.setAttribute('fill', 'none');
                    heartIcon.setAttribute('stroke', 'currentColor');
                }
            })
            .catch(error => console.error('Error:', error))
            .finally(() => {
                // Re-enable the button
                this.disabled = false;
            });
        });
    });
}

/**
 * Setup share form submissions with AJAX - REMOVED
 */
// setupShareForms function removed

/**
 * Setup reply buttons to show replies section
 */
function setupReplyButtons() {
    console.log('Setting up reply buttons');
    const replyButtons = document.querySelectorAll('.reply-btn');
    console.log(`Found ${replyButtons.length} reply buttons`);
    
    // Check if we're on the dashboard page
    const isDashboard = document.querySelector('.dashboard-posts') !== null;
    if (isDashboard) {
        console.log('On dashboard page, checking for stored reply counts');
        // Check localStorage for updated reply counts
        replyButtons.forEach(button => {
            const postId = button.getAttribute('data-post-id');
            const storedCount = localStorage.getItem(`post_${postId}_reply_count`);
            if (storedCount !== null) {
                console.log(`Found stored count ${storedCount} for post ${postId}`);
                const countSpan = button.querySelector('span');
                if (countSpan) {
                    // We no longer update the reply button text as it now just shows "Reply"
                    console.log(`Found stored count ${storedCount} for post ${postId}, but not updating button text`);
                    // Don't remove the stored count - keep it for potential page refreshes
                    // localStorage.removeItem(`post_${postId}_reply_count`);
                }
            }
        });
        
        // Set up event listener for storage events to update counts in real-time
        window.addEventListener('storage', function(e) {
            // Check if the event is for a reply count
            if (e.key && e.key.startsWith('post_') && e.key.endsWith('_reply_count')) {
                const postId = e.key.replace('post_', '').replace('_reply_count', '');
                // We no longer update the reply button text as it now just shows "Reply"
                console.log(`Real-time update received for post ${postId}`);
            }
        });
        
        // Set up event listener for custom replyCountUpdated event
        document.addEventListener('replyCountUpdated', function(e) {
            const { postId, count } = e.detail;
            console.log(`Custom event received: update reply count for post ${postId} to ${count}`);
            
            // We no longer update the reply button text as it now just shows "Reply"
            // But we still need to keep this event listener for other functionality
        });
    }
    
    replyButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const postId = this.getAttribute('data-post-id');
            console.log(`Reply button clicked for post ${postId}`);
            
            const repliesSection = document.getElementById(`replies-section-${postId}`);
            const repliesList = document.getElementById(`replies-list-${postId}`);
            
            console.log(`Replies section: ${repliesSection ? 'found' : 'not found'}`);
            console.log(`Replies list: ${repliesList ? 'found' : 'not found'}`);
            
            const postCard = this.closest('.post-card');
            
            // Toggle the replies section
            if (repliesSection.style.display === 'none') {
                console.log('Showing replies section');
                // Show the replies section
                repliesSection.style.display = 'block';
                
                // Add active class to the button
                this.classList.add('active');
                
                // Ensure the post card maintains its responsive layout
                postCard.style.width = '100%';
                postCard.style.maxWidth = '100%';
                
                // Load replies if not already loaded
                if (repliesList.children.length === 0) {
                    console.log('Loading replies for the first time');
                    loadReplies(postId, repliesList);
                } else {
                    // Check if the only child is a "no replies" message
                    const noRepliesMsg = repliesList.querySelector('.no-replies');
                    if (noRepliesMsg && repliesList.children.length === 1) {
                        console.log('Only found "no replies" message, loading replies from server');
                        loadReplies(postId, repliesList);
                    } else {
                        console.log(`Replies already loaded: ${repliesList.children.length} replies`);
                    }
                }
                
                // Force layout recalculation to maintain responsiveness
                window.dispatchEvent(new Event('resize'));
            } else {
                console.log('Hiding replies section');
                // Hide the replies section
                repliesSection.style.display = 'none';
                
                // Remove active class from the button
                this.classList.remove('active');
                
                // Reset any inline styles
                postCard.style.width = '';
                postCard.style.maxWidth = '';
                
                // Force layout recalculation to maintain responsiveness
                window.dispatchEvent(new Event('resize'));
            }
        });
    });
    
    // Setup reply form submissions
    setupReplyForms();
    console.log('Reply forms set up');
}

/**
 * Load replies for a post
 */
function loadReplies(postId, repliesList) {
    console.log(`Loading replies for post ${postId}`);
    // Show loading indicator
    repliesList.innerHTML = '<div class="loading-replies">Loading replies...</div>';
    
    // Clear any stored reply count to ensure we get fresh data
    const storedCount = localStorage.getItem(`post_${postId}_reply_count`);
    console.log(`Current stored count for post ${postId}: ${storedCount}`);
    
    // Fetch replies from the server using the correct URL pattern
    // This should match the URL pattern defined in urls.py with the user_panel namespace
    const url = `/user/api/post/${postId}/replies/`;
    console.log('Fetching replies from URL:', url);
    
    fetch(url)
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Replies data received:', data);
            // Clear loading indicator
            repliesList.innerHTML = '';
            
            if (data.replies && data.replies.length > 0) {
                console.log(`Found ${data.replies.length} replies`);
                // Add each reply to the list
                data.replies.forEach(reply => {
                    console.log('Creating reply element for:', reply);
                    const replyItem = createReplyElement(reply);
                    repliesList.appendChild(replyItem);
                });
                
                // Update the reply count in the heading if it exists
                const repliesHeading = document.querySelector('.replies-container h3');
                if (repliesHeading) {
                    repliesHeading.textContent = `Comments (${data.replies.length})`;
                    // Store the count in a data attribute for persistence
                    repliesHeading.setAttribute('data-reply-count', data.replies.length);
                    console.log(`Updated reply count in heading to ${data.replies.length}`);
                }
                
                // Update localStorage with the actual count from server
                localStorage.setItem(`post_${postId}_reply_count`, data.replies.length);
                console.log(`Updated localStorage with actual count from server: ${data.replies.length}`);
                
                // Dispatch a custom event to notify other parts of the page
                const updateEvent = new CustomEvent('replyCountUpdated', {
                    detail: { postId, count: data.replies.length }
                });
                document.dispatchEvent(updateEvent);
            } else {
                console.log('No replies found');
                // No replies
                repliesList.innerHTML = '<div class="no-replies">No comment yet. Be the first to comment!</div>';
                
                // Update the reply count in the heading if it exists
                const repliesHeading = document.querySelector('.replies-container h3');
                if (repliesHeading) {
                    repliesHeading.textContent = `Comments (0)`;
                    // Store the count in a data attribute for persistence
                    repliesHeading.setAttribute('data-reply-count', 0);
                    console.log(`Updated reply count in heading to 0`);
                }
                
                // Update localStorage to 0 since there are no replies
                localStorage.setItem(`post_${postId}_reply_count`, 0);
                console.log(`Updated localStorage to 0 since no replies were found`);
                
                // Dispatch a custom event to notify other parts of the page
                const updateEvent = new CustomEvent('replyCountUpdated', {
                    detail: { postId, count: 0 }
                });
                document.dispatchEvent(updateEvent);
            }
        })
        .catch(error => {
            console.error('Error loading replies:', error);
            repliesList.innerHTML = '<div class="error-loading-replies">Error loading replies. Please try again.</div>';
        });
}

/**
 * Create a reply element
 */
function createReplyElement(reply) {
    console.log('Creating reply element for reply ID:', reply.reply_id);
    const replyItem = document.createElement('div');
    replyItem.className = 'reply-item';
    replyItem.setAttribute('data-reply-id', reply.reply_id);
    
    // Use the full name if available, otherwise use username
    const authorName = reply.full_name || reply.username;
    console.log(`Author name: ${authorName}`);
    
    // Format the date
    const replyDate = new Date(reply.created_at);
    const formattedDate = reply.formatted_date || replyDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
    console.log(`Reply date: ${replyDate}, formatted: ${formattedDate}`);
    
    // Ensure profile picture has a default value
    // Check for profile_picture_url first, then profile_picture, then default
    let profilePicture = '/static/accounts/images/profile.png';
    if (reply.profile_picture_url && reply.profile_picture_url !== '') {
        profilePicture = `${reply.profile_picture_url}?t=${Date.now()}`;
    } else if (reply.profile_picture && reply.profile_picture !== '') {
        profilePicture = `${reply.profile_picture}?t=${Date.now()}`;
    }
    console.log(`Profile picture: ${profilePicture}`);
    
    // Check if the current user is the author of this reply
    const isAuthor = reply.is_author || false;
    console.log(`Is author: ${isAuthor}`);
    
    let actionsHtml = '';
    if (isAuthor) {
        console.log('Adding author actions dropdown');
        actionsHtml = `
            <div class="reply-actions-dropdown">
                <button class="reply-actions-toggle">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                    </svg>
                </button>
                <div class="reply-actions-menu">
                    <button class="edit-reply-btn" data-reply-id="${reply.reply_id}" data-reply-message="${reply.message.replace(/"/g, '&quot;')}">Edit</button>
                    <button class="delete-reply-btn" data-reply-id="${reply.reply_id}">Delete</button>
                </div>
            </div>
        `;
    }
    
    replyItem.innerHTML = `
        <div class="reply-header">
            <img src="${profilePicture}" alt="${authorName}" class="reply-avatar" onerror="this.src='/static/accounts/images/profile.png'">
            <div class="reply-header-content">
                <div class="reply-author">${authorName}</div>
                <div class="reply-date">${formattedDate}</div>
            </div>
            ${actionsHtml}
        </div>
        <div class="reply-message">${reply.message}</div>
    `;
    console.log('Reply HTML created');
    
    // Add event listeners for dropdown toggle, edit and delete buttons if actions exist
    if (isAuthor) {
        console.log('Setting up action dropdown toggle and buttons');
        setTimeout(() => {
            // Setup dropdown toggle
            const toggleButton = replyItem.querySelector('.reply-actions-toggle');
            if (toggleButton) {
                // Remove any existing event listeners
                const newToggleButton = toggleButton.cloneNode(true);
                toggleButton.parentNode.replaceChild(newToggleButton, toggleButton);
                
                newToggleButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const menu = this.nextElementSibling;
                    
                    // First close all menus
                    document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(openMenu => {
                        openMenu.classList.remove('show');
                    });
                    
                    // Then toggle this menu
                    menu.classList.toggle('show');
                });
                console.log('Toggle button event listener added');
            }
            
            // Setup edit button
            const editButton = replyItem.querySelector('.edit-reply-btn');
            if (editButton) {
                editButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const replyId = this.getAttribute('data-reply-id');
                    const replyMessage = this.getAttribute('data-reply-message');
                    const replyMessageEl = replyItem.querySelector('.reply-message');
                    
                    // Close any open dropdown menus
                    document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(menu => {
                        menu.classList.remove('show');
                    });
                    
                    // Check if an edit form already exists
                    const existingForm = replyItem.querySelector('.edit-reply-form');
                    if (existingForm) {
                        const textarea = existingForm.querySelector('textarea');
                        textarea.focus();
                        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                        return;
                    }
                    
                    // Create edit form
                    const editForm = document.createElement('div');
                    editForm.className = 'edit-reply-form';
                    editForm.innerHTML = `
                        <textarea class="edit-reply-textarea">${replyMessage}</textarea>
                        <div class="edit-form-actions">
                            <button type="button" class="cancel-edit-btn">Cancel</button>
                            <button type="button" class="save-edit-btn">Save</button>
                        </div>
                    `;
                    
                    // Replace reply message with edit form
                    replyMessageEl.style.display = 'none';
                    replyMessageEl.insertAdjacentElement('afterend', editForm);
                    
                    // Focus on textarea
                    const textarea = editForm.querySelector('textarea');
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                    
                    // Handle cancel button
                    editForm.querySelector('.cancel-edit-btn').addEventListener('click', function() {
                        replyMessageEl.style.display = '';
                        editForm.remove();
                    });
                    
                    // Handle save button
                    editForm.querySelector('.save-edit-btn').addEventListener('click', function() {
                        const newMessage = textarea.value.trim();
                        if (!newMessage) {
                            alert('Reply cannot be empty');
                            return;
                        }
                        
                        // Get CSRF token
                        const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                        
                        // Disable button while saving
                        this.disabled = true;
                        this.textContent = 'Saving...';
                        
                        // Send update to server
                        fetch(`/user/reply/${replyId}/edit/`, {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: newMessage
                            })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                // Update reply message
                                replyMessageEl.textContent = newMessage;
                                
                                // Update data attribute for future edits
                                editButton.setAttribute('data-reply-message', newMessage);
                                
                                // Remove edit form
                                replyMessageEl.style.display = '';
                                editForm.remove();
                            } else {
                                alert(data.message || 'Error updating reply');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            alert('Error updating reply. Please try again.');
                        })
                        .finally(() => {
                            this.disabled = false;
                            this.textContent = 'Save';
                        });
                    });
                });
            }
            
            // Setup delete button
            const deleteButton = replyItem.querySelector('.delete-reply-btn');
            if (deleteButton) {
                deleteButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const replyId = this.getAttribute('data-reply-id');
                    const modal = document.getElementById('confirmationModal');
                    
                    // Close any open dropdown menus
                    document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(menu => {
                        menu.classList.remove('show');
                    });
                    
                    // Show the confirmation modal
                    modal.classList.add('active');
                    
                    // Update the message for reply deletion
                    modal.querySelector('.confirmation-modal-message').textContent = 'Are you sure you want to delete this reply? This action cannot be undone.';
                    
                    // Remove any existing confirm button listener
                    const confirmButton = modal.querySelector('.confirmation-modal-confirm');
                    const newConfirmButton = confirmButton.cloneNode(true);
                    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
                    
                    // Add event listener for confirm button
                    newConfirmButton.addEventListener('click', function() {
                        // Get CSRF token
                        const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                        
                        // Disable the button to prevent multiple clicks
                        this.disabled = true;
                        this.textContent = 'Deleting...';
                        
                        // Send delete request to server
                        fetch(`/user/reply/${replyId}/delete/`, {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken,
                                'Content-Type': 'application/json'
                            }
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                // Remove reply item from DOM
                                replyItem.remove();
                                
                                // Get the post ID from the reply item's parent container
                                // First try to get from replies-section (dashboard page)
                                let repliesSection = replyItem.closest('.replies-section');
                                let postId = repliesSection ? repliesSection.id.replace('replies-section-', '') : null;
                                
                                // If null, we're likely on the view_post page, get from URL or data attribute
                                if (!postId) {
                                    // Try to get from post-detail-card data attribute
                                    const postCard = document.querySelector('.post-detail-card');
                                    if (postCard) {
                                        postId = postCard.getAttribute('data-post-id');
                                    }
                                    
                                    // If still null, try to extract from URL
                                    if (!postId) {
                                        const urlPath = window.location.pathname;
                                        const matches = urlPath.match(/\/user\/post\/(\d+)\//i);
                                        if (matches && matches.length > 1) {
                                            postId = matches[1];
                                        }
                                    }
                                }
                                console.log(`Post ID for this reply: ${postId}`);
                                
                                // Force refresh the remaining reply cards count
                                // On view_post page, look for reply-card elements
                                const currentReplyCards = postId ? 
                                    document.querySelectorAll(`#replies-list-${postId} .reply-item, .reply-card`) : 
                                    document.querySelectorAll('.reply-card, .reply-item');
                                const currentCount = currentReplyCards.length;
                                console.log(`Actual remaining reply cards: ${currentCount}`);
                                
                                // Update reply count in the heading if it exists
                                const repliesHeading = document.querySelector('.replies-container h3');
                                if (repliesHeading) {
                                    repliesHeading.textContent = `Comments (${currentCount})`;
                                    // Store the count in a data attribute for persistence
                                    repliesHeading.setAttribute('data-reply-count', currentCount);
                                    console.log(`Updated reply count in heading to ${currentCount}`);
                                }
                                
                                // Update the reply count in the button on the dashboard
                                if (postId) {
                                    // Update localStorage with the current count
                                    localStorage.setItem(`post_${postId}_reply_count`, currentCount);
                                    console.log(`Updated localStorage with count ${currentCount} for post ${postId}`);
                                    
                                    // Dispatch a custom event to notify other parts of the page
                                    const updateEvent = new CustomEvent('replyCountUpdated', {
                                        detail: { postId, count: currentCount }
                                    });
                                    document.dispatchEvent(updateEvent);
                                    
                                    // Update ALL reply buttons on the page with this post ID
                                    const replyButtons = document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`);
                                    console.log(`Found ${replyButtons.length} reply buttons to update for post ${postId}`);
                                    replyButtons.forEach(replyButton => {
                                        const countSpan = replyButton.querySelector('span');
                                        if (countSpan) {
                                            // We no longer update the reply button text as it now just shows "Reply"
                                            console.log(`Not updating reply button text for post ${postId}`);
                                        }
                                    });
                                    
                                    // Also update any reply buttons without data-post-id but on the view_post page
                                    // This handles the case where the reply button in view_post.html might not have the correct attribute
                                    if (window.location.pathname.includes('/user/post/')) {
                                        const viewPostReplyButtons = document.querySelectorAll('.reply-btn');
                                        viewPostReplyButtons.forEach(button => {
                                            if (!button.hasAttribute('data-post-id')) {
                                                const countSpan = button.querySelector('span');
                                                if (countSpan) {
                                                    // We no longer update the reply button text as it now just shows "Reply"
                                                    console.log(`Not updating view_post reply button text for post ${postId}`);
                                                }
                                            }
                                        });
                                    }
                                }
                                
                                // If no more replies, show 'no replies' message
                                const repliesContainer = document.querySelector('.replies-container');
                                if (repliesContainer) {
                                    // Check for both reply-card (view_post page) and reply-item (dashboard page)
                                    const remainingReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                    if (remainingReplyCards.length === 0) {
                                        // Remove all children except the heading
                                        const heading = repliesContainer.querySelector('h3');
                                        if (heading) {
                                            repliesContainer.innerHTML = '';
                                            repliesContainer.appendChild(heading);
                                            // Update heading to show 0 replies
                                            heading.textContent = 'Comments (0)';
                                            heading.setAttribute('data-reply-count', '0');
                                            // Add no replies message
                                            const noReplies = document.createElement('div');
                                            noReplies.className = 'no-replies';
                                            noReplies.textContent = 'No comment yet. Be the first to comment!';
                                            repliesContainer.appendChild(noReplies);
                                            
                                            // Update localStorage with 0 count if we have a postId
                                            if (postId) {
                                                localStorage.setItem(`post_${postId}_reply_count`, 0);
                                                console.log(`Updated localStorage with count 0 for post ${postId}`);
                                                
                                                // Dispatch a custom event to notify other parts of the page
                                                const updateEvent = new CustomEvent('replyCountUpdated', {
                                                    detail: { postId, count: 0 }
                                                });
                                                document.dispatchEvent(updateEvent);
                                                
                                                // Update ALL reply buttons on the page with this post ID
                                                const replyButtons = document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`);
                                                console.log(`Found ${replyButtons.length} reply buttons to update for post ${postId} (no replies case)`);
                                                replyButtons.forEach(replyButton => {
                                                    const countSpan = replyButton.querySelector('span');
                                                    if (countSpan) {
                                                        // We no longer update the reply button text as it now just shows "Reply"
                                                        console.log(`Not updating reply button text for post ${postId} (no replies case)`);
                                                    }
                                                });
                                                
                                                // Also update any reply buttons without data-post-id but on the view_post page
                                                if (window.location.pathname.includes('/user/post/')) {
                                                    const viewPostReplyButtons = document.querySelectorAll('.reply-btn');
                                                    viewPostReplyButtons.forEach(button => {
                                                        if (!button.hasAttribute('data-post-id')) {
                                                            const countSpan = button.querySelector('span');
                                                            if (countSpan) {
                                                                // We no longer update the reply button text as it now just shows "Reply"
                                                                console.log(`Not updating view_post reply button text (no replies case)`);
                                                            }
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // Close the modal
                                modal.classList.remove('active');
                            } else {
                                console.log('Error response received but not showing alert:', data.message || 'Error deleting reply');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            console.log('Error occurred but not showing alert');
                        })
                        .finally(() => {
                            // Re-enable the button
                            this.disabled = false;
                            this.textContent = 'Delete';
                            // Close the modal
                            modal.classList.remove('active');
                        });
                    });
                    
                    // Add event listener for cancel button
                    const cancelButton = modal.querySelector('.confirmation-modal-cancel');
                    cancelButton.addEventListener('click', function() {
                        modal.classList.remove('active');
                    });
                });
            }
            
            // Delete button is already set up in setupReplyActions function
        }, 0);
    }
    
    console.log('Reply element created successfully');
    return replyItem;
}

/**
 * Setup reply form submissions
 */
/**
 * Setup post edit and delete functionality
 */
function setupPostActions() {
    console.log('Setting up post actions in post_interactions.js');
    // Setup edit post buttons
    document.querySelectorAll('.edit-post-btn').forEach(button => {
        button.addEventListener('click', function() {
            const postId = this.getAttribute('data-post-id');
            const postMessage = this.getAttribute('data-post-message');
            const postCard = this.closest('.post-card');
            const postContent = postCard.querySelector('.post-content');
            
            // Check if an edit form already exists for this post
            const existingForm = postCard.querySelector('.edit-post-form');
            if (existingForm) {
                // If a form already exists, just focus on its textarea
                const textarea = existingForm.querySelector('textarea');
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                return;
            }
            
            // Create edit form
            const editForm = document.createElement('div');
            editForm.className = 'edit-post-form';
            editForm.innerHTML = `
                <textarea class="edit-post-textarea">${postMessage}</textarea>
                <div class="edit-form-actions">
                    <button type="button" class="cancel-edit-btn">Cancel</button>
                    <button type="button" class="save-edit-btn">Save</button>
                </div>
            `;
            
            // Replace post content with edit form
            postContent.style.display = 'none';
            postContent.insertAdjacentElement('afterend', editForm);
            
            // Focus on textarea
            const textarea = editForm.querySelector('textarea');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            
            // Handle cancel button
            editForm.querySelector('.cancel-edit-btn').addEventListener('click', function() {
                postContent.style.display = '';
                editForm.remove();
            });
            
            // Handle save button
            editForm.querySelector('.save-edit-btn').addEventListener('click', function() {
                const newMessage = textarea.value.trim();
                if (!newMessage) {
                    alert('Post content cannot be empty');
                    return;
                }
                
                // Get CSRF token
                const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                
                // Disable buttons while saving
                this.disabled = true;
                this.textContent = 'Saving...';
                
                // Send update to server
                fetch(`/user/post/${postId}/edit/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: newMessage })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Update post content
                        postContent.textContent = newMessage;
                        postContent.style.display = '';
                        editForm.remove();
                        
                        // Update data attribute for future edits
                        postCard.querySelector('.edit-post-btn').setAttribute('data-post-message', newMessage);
                    } else {
                        alert(data.message || 'Error updating post');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error updating post. Please try again.');
                })
                .finally(() => {
                    this.disabled = false;
                    this.textContent = 'Save';
                });
            });
        });
    });
    
    // Create confirmation modal if it doesn't exist
    if (!document.getElementById('confirmationModal')) {
        const modal = document.createElement('div');
        modal.id = 'confirmationModal';
        modal.className = 'confirmation-modal';
        modal.innerHTML = `
            <div class="confirmation-modal-content">
                <div class="confirmation-modal-title">Confirm Deletion</div>
                <div class="confirmation-modal-message">Are you sure you want to delete this post? This action cannot be undone.</div>
                <div class="confirmation-modal-actions">
                    <button class="confirmation-modal-cancel">Cancel</button>
                    <button class="confirmation-modal-confirm">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listener to close modal when clicking cancel
        modal.querySelector('.confirmation-modal-cancel').addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }
    
    // Setup delete post buttons
    document.querySelectorAll('.delete-post-btn').forEach(button => {
        button.addEventListener('click', function() {
            const postId = this.getAttribute('data-post-id');
            const postCard = this.closest('.post-card');
            const modal = document.getElementById('confirmationModal');
            
            // Show the confirmation modal
            modal.classList.add('active');
            
            // Update the message if needed
            modal.querySelector('.confirmation-modal-message').textContent = 'Are you sure you want to delete this post? This action cannot be undone.';
            
            // Remove any existing confirm button listener
            const confirmButton = modal.querySelector('.confirmation-modal-confirm');
            const newConfirmButton = confirmButton.cloneNode(true);
            confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
            
            // Add event listener for confirm button
            newConfirmButton.addEventListener('click', function() {
                // Get CSRF token
                const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                
                // Disable the button to prevent multiple clicks
                this.disabled = true;
                this.textContent = 'Deleting...';
                
                // Send delete request to server
                fetch(`/user/post/${postId}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Remove post card from DOM
                        postCard.remove();
                        // Close the modal
                        modal.classList.remove('active');
                    } else {
                        alert(data.message || 'Error deleting post');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error deleting post. Please try again.');
                })
                .finally(() => {
                    // Re-enable the button
                    this.disabled = false;
                    this.textContent = 'Delete';
                    // Close the modal
                    modal.classList.remove('active');
                    console.log('Modal closed and button reset in finally block');
                });
            });
        });
    });
}

/**
 * Setup reply edit and delete functionality
 */
function setupReplyActions() {
    console.log('Setting up reply actions in post_interactions.js');
    // Re-select all buttons to ensure we catch newly added ones
    const editButtons = document.querySelectorAll('.edit-reply-btn');
    const deleteButtons = document.querySelectorAll('.delete-reply-btn');
    
    console.log(`Found ${editButtons.length} edit buttons and ${deleteButtons.length} delete buttons for replies`);
    
    // Create confirmation modal if it doesn't exist
    if (!document.getElementById('confirmationModal')) {
        const modal = document.createElement('div');
        modal.id = 'confirmationModal';
        modal.className = 'confirmation-modal';
        modal.innerHTML = `
            <div class="confirmation-modal-content">
                <div class="confirmation-modal-title">Confirm Deletion</div>
                <div class="confirmation-modal-message">Are you sure you want to delete this reply? This action cannot be undone.</div>
                <div class="confirmation-modal-actions">
                    <button class="confirmation-modal-cancel">Cancel</button>
                    <button class="confirmation-modal-confirm">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listener to close modal when clicking cancel
        modal.querySelector('.confirmation-modal-cancel').addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }
    
    // Setup edit reply buttons
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const replyId = this.getAttribute('data-reply-id');
            const replyMessage = this.getAttribute('data-reply-message');
            // Try both possible parent selectors to ensure compatibility
            const replyItem = this.closest('.reply-item') || this.closest('.reply-card');
            const replyMessageEl = replyItem.querySelector('.reply-message') || replyItem.querySelector('.reply-content');
            
            // Check if an edit form already exists for this reply
            const existingForm = replyItem.querySelector('.edit-reply-form');
            if (existingForm) {
                // If a form already exists, just focus on its textarea
                const textarea = existingForm.querySelector('textarea');
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                return;
            }
            
            // Create edit form
            const editForm = document.createElement('div');
            editForm.className = 'edit-reply-form';
            editForm.innerHTML = `
                <textarea class="edit-reply-textarea">${replyMessage}</textarea>
                <div class="edit-form-actions">
                    <button type="button" class="cancel-edit-btn">Cancel</button>
                    <button type="button" class="save-edit-btn">Save</button>
                </div>
            `;
            
            // Replace reply message with edit form
            replyMessageEl.style.display = 'none';
            replyMessageEl.insertAdjacentElement('afterend', editForm);
            
            // Focus on textarea
            const textarea = editForm.querySelector('textarea');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            
            // Handle cancel button
            editForm.querySelector('.cancel-edit-btn').addEventListener('click', function() {
                replyMessageEl.style.display = '';
                editForm.remove();
            });
            
            // Handle save button
            editForm.querySelector('.save-edit-btn').addEventListener('click', function() {
                const newMessage = textarea.value.trim();
                if (!newMessage) {
                    alert('Reply cannot be empty');
                    return;
                }
                
                // Get CSRF token
                const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                
                // Disable buttons while saving
                this.disabled = true;
                this.textContent = 'Saving...';
                
                // Send update to server
                fetch(`/user/reply/${replyId}/edit/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: newMessage })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Update reply message
                        replyMessageEl.textContent = newMessage;
                        replyMessageEl.style.display = '';
                        editForm.remove();
                        
                        // Update data attribute for future edits
                        replyItem.querySelector('.edit-reply-btn').setAttribute('data-reply-message', newMessage);
                    } else {
                        alert(data.message || 'Error updating reply');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error updating reply. Please try again.');
                })
                .finally(() => {
                    this.disabled = false;
                    this.textContent = 'Save';
                });
            });
        });
    });
    
    // Setup delete reply buttons
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const replyId = this.getAttribute('data-reply-id');
            // Try both possible parent selectors to ensure compatibility
            const replyItem = this.closest('.reply-item') || this.closest('.reply-card');
            const postDetailCard = document.querySelector('.post-detail-card');
            const postId = postDetailCard ? postDetailCard.getAttribute('data-post-id') : null;
            const modal = document.getElementById('confirmationModal');
            
            // Show the confirmation modal
            modal.classList.add('active');
            
            // Update the message for reply deletion
            modal.querySelector('.confirmation-modal-message').textContent = 'Are you sure you want to delete this reply? This action cannot be undone.';
            
            // Remove any existing confirm button listener
            const confirmButton = modal.querySelector('.confirmation-modal-confirm');
            const newConfirmButton = confirmButton.cloneNode(true);
            confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
            
            // Add event listener for confirm button
            newConfirmButton.addEventListener('click', function() {
                // Get CSRF token
                const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
                
                // Disable the button to prevent multiple clicks
                this.disabled = true;
                this.textContent = 'Deleting...';
                
                // Send delete request to server
                console.log(`Deleting reply with ID: ${replyId}`);
                console.log(`CSRF Token: ${csrfToken ? 'present' : 'missing'}`);
                
                console.log(`Deleting reply ${replyId} with CSRF token: ${csrfToken ? 'present' : 'missing'}`);
                
                // Check if CSRF token is present
                if (!csrfToken) {
                    console.error('CSRF token is missing!');
                    // Try to get it from the cookie
                    csrfToken = document.cookie.split('; ')
                        .find(row => row.startsWith('csrftoken='))
                        ?.split('=')[1];
                    console.log(`Retrieved CSRF token from cookie: ${csrfToken ? 'success' : 'failed'}`);
                }
                
                fetch(`/user/reply/${replyId}/delete/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin' // Include cookies in the request
                })
                .then(response => {
                    console.log('Response status:', response.status);
                    console.log('Response ok:', response.ok);
                    
                    // Check if the response is ok (status in the range 200-299)
                    if (!response.ok) {
                        throw new Error(`Server responded with status: ${response.status}`);
                    }
                    
                    // Check if the response has content
                    const contentType = response.headers.get('content-type');
                    console.log('Content-Type:', contentType);
                    
                    if (!contentType || !contentType.includes('application/json')) {
                        console.warn('Response is not JSON, assuming success');
                        
                        // Create a synthetic success response
                        return {
                            status: 'success',
                            message: 'Reply deleted successfully (assumed)',
                            reply_count: 'unknown' // We'll handle this in the next then block
                        };
                    }
                    
                    return response.json().catch(error => {
                        console.error('Error parsing JSON:', error);
                        // Return a synthetic success response
                        return {
                            status: 'success',
                            message: 'Reply deleted successfully (assumed after JSON parse error)',
                            reply_count: 'unknown'
                        };
                    });
                })
                .then(data => {
                    console.log('Response data:', data);
                    
                    if (data.status === 'success') {
                        console.log('Success: Removing reply from DOM');
                        // Force removal of the reply item from DOM
                        if (replyItem) {
                            console.log('Reply item found, removing it');
                            replyItem.remove();
                        } else {
                            console.log('Reply item not found by direct reference, trying to find it by ID');
                            // Try to find the reply by ID if the direct reference doesn't work
                            const replyById = document.querySelector(`.reply-card[data-reply-id="${replyId}"], .reply-item[data-reply-id="${replyId}"]`);
                            if (replyById) {
                                console.log('Found reply by ID, removing it');
                                replyById.remove();
                            } else {
                                console.error(`Could not find reply with ID ${replyId} to remove`);
                            }
                        }
                        
                        // Update reply count in the heading
                        const repliesHeading = document.querySelector('.replies-container h3');
                        if (repliesHeading) {
                            if (data.reply_count === 'unknown') {
                                // Estimate the reply count by subtracting 1 from current count
                                const currentText = repliesHeading.textContent;
                                const match = currentText.match(/\d+/);
                                if (match) {
                                    const currentCount = Math.max(0, parseInt(match[0]) - 1);
                                    repliesHeading.textContent = `Comments (${currentCount})`;
                                    // Store the count in a data attribute for persistence
                                    repliesHeading.setAttribute('data-reply-count', currentCount);
                                    console.log(`Updated reply count to ${currentCount} (estimated)`);
                                    
                                    // Force refresh the remaining reply cards count
                                    const currentReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                    console.log(`Actual remaining reply cards: ${currentReplyCards.length}`);
                                    
                                    // If counts don't match, force update the heading to match actual DOM count
                                    if (currentReplyCards.length !== currentCount) {
                                        console.log(`Count mismatch detected: estimated ${currentCount}, DOM has ${currentReplyCards.length}`);
                                        repliesHeading.textContent = `Comments (${currentReplyCards.length})`;
                                        // Store the count in a data attribute for persistence
                                        repliesHeading.setAttribute('data-reply-count', currentReplyCards.length);
                                        console.log(`Corrected reply count to ${currentReplyCards.length}`);
                                    }
                                    
                                    // Update the reply count in all dashboard buttons
                                    const postId = document.querySelector('.post-detail-card')?.getAttribute('data-post-id');
                                    if (postId) {
                                        // Get the actual count of remaining replies
                                        const finalCount = currentReplyCards.length;
                                        
                                        // Update all reply buttons with this post ID on the page
                                        document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`).forEach(replyButton => {
                                            const countSpan = replyButton.querySelector('span');
                                            if (countSpan) {
                                                // We no longer update the reply button text as it now just shows "Reply"
                                                console.log(`Not updating reply button text for post ${postId}`);
                                            }
                                        });
                                        
                                        // Store the updated count in localStorage for dashboard page
                                        localStorage.setItem(`post_${postId}_reply_count`, finalCount);
                                        console.log(`Stored reply count ${finalCount} in localStorage for post ${postId}`);
                                    }
                                    
                                    // Store the updated count in localStorage to ensure it's updated when returning to dashboard
                                    if (postId) {
                                        // Use localStorage.setItem with a different key first to trigger storage event
                                        localStorage.setItem(`post_${postId}_reply_count_temp`, finalCount);
                                        localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                        
                                        // Now set the actual value
                                        localStorage.setItem(`post_${postId}_reply_count`, finalCount);
                                        console.log(`Stored reply count ${finalCount} in localStorage for post ${postId}`);
                                        
                                        // Dispatch a custom event to notify other parts of the page
                                        const updateEvent = new CustomEvent('replyCountUpdated', {
                                            detail: { postId, count: finalCount }
                                        });
                                        document.dispatchEvent(updateEvent);
                                    }
                                    
                                    // Also update the reply count on the dashboard post card
                                    // First try to find it in the current page
                                    if (postId) {
                                        const dashboardReplyButton = document.querySelector(`.dashboard-posts .reply-btn[data-post-id="${postId}"]`);
                                        if (dashboardReplyButton) {
                                            const dashboardCountSpan = dashboardReplyButton.querySelector('span');
                                            // We no longer update the reply button text as it now just shows "Reply"
                                            console.log(`Not updating dashboard post card reply button text for post ${postId}`);
                                        }
                                    }
                                }
                            } else {
                                // Use the count from the server response
                                const currentCount = parseInt(data.reply_count);
                                repliesHeading.textContent = `Comments (${currentCount})`;
                                // Store the count in a data attribute for persistence
                                repliesHeading.setAttribute('data-reply-count', currentCount);
                                console.log(`Updated reply count to ${currentCount}`);
                                
                                // Force refresh the remaining reply cards count
                                const currentReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                console.log(`Actual remaining reply cards: ${currentReplyCards.length}`);
                                
                                // If counts don't match, force update the heading to match actual DOM count
                                if (currentReplyCards.length !== currentCount) {
                                    console.log(`Count mismatch detected: server says ${currentCount}, DOM has ${currentReplyCards.length}`);
                                    repliesHeading.textContent = `Comments (${currentReplyCards.length})`;
                                    
                                    // Update the reply count in the dashboard button
                                    const postDetailCard = document.querySelector('.post-detail-card');
                                    const postId = postDetailCard ? postDetailCard.getAttribute('data-post-id') : null;
                                    if (postId) {
                                        // Update all reply buttons with this post ID on the page
                                        document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`).forEach(replyButton => {
                                            const countSpan = replyButton.querySelector('span');
                                            if (countSpan) {
                                                const finalCount = currentReplyCards.length;
                                                // We no longer update the reply button text as it now just shows "Reply"
                                                console.log(`Not updating reply button text for post ${postId}`);
                                            }
                                        });
                                        
                                        // Store the updated count in localStorage for dashboard page
                                        localStorage.setItem(`post_${postId}_reply_count`, currentReplyCards.length);
                                        console.log(`Stored reply count ${currentReplyCards.length} in localStorage for post ${postId}`);
                                    }
                                    // Store the count in a data attribute for persistence
                                    repliesHeading.setAttribute('data-reply-count', currentReplyCards.length);
                                    console.log(`Corrected reply count to ${currentReplyCards.length}`);
                                }
                            }
                        }
                        
                        // If no more replies, show 'no replies' message
                        const repliesContainer = document.querySelector('.replies-container');
                        if (repliesContainer) {
                            // Get a fresh count of reply cards after removal
                            const remainingReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                            console.log(`Remaining reply cards: ${remainingReplyCards.length}`);
                            
                            if (remainingReplyCards.length === 0) {
                                // Remove all children except the heading
                                const heading = repliesContainer.querySelector('h3');
                                if (heading) {
                                    repliesContainer.innerHTML = '';
                                    repliesContainer.appendChild(heading);
                                    // Add no replies message
                                    const noReplies = document.createElement('div');
                                    noReplies.className = 'no-replies';
                                    noReplies.textContent = 'No comment yet. Be the first to comment!';
                                    repliesContainer.appendChild(noReplies);
                                    console.log('Added "no replies" message');
                                }
                            }
                        }
                        
                        // Close the modal
                        modal.classList.remove('active');
                        console.log('Modal closed');
                    } else {
                        console.error('Server returned error:', data.message);
                        // Don't show alert for error response
                        console.log('Error response received but not showing alert');
                    }
                })
                .catch(error => {
                    console.error('Fetch error:', error);
                    console.log('Error name:', error.name);
                    console.log('Error message:', error.message);
                    
                    // Check if the reply element still exists in the DOM
                    const replyExists = document.querySelector(`.reply-card[data-reply-id="${replyId}"]`) || 
                                       document.querySelector(`.reply-item[data-reply-id="${replyId}"]`);
                    
                    console.log(`Reply with ID ${replyId} still exists in DOM: ${replyExists ? 'yes' : 'no'}`);
                    
                    // For SyntaxError (invalid JSON), assume the server processed the request successfully
                    // but returned an invalid response
                    if (error instanceof SyntaxError) {
                        console.log('JSON parsing error - assuming successful deletion with invalid response format');
                        if (replyExists) {
                            console.log('Removing reply from DOM despite JSON parsing error');
                            replyExists.remove(); // Use the element we found, not the original reference
                            
                            // Update reply count in the heading (estimate by subtracting 1)
                            const repliesHeading = document.querySelector('.replies-container h3');
                            if (repliesHeading) {
                                const currentText = repliesHeading.textContent;
                                const match = currentText.match(/\d+/);
                                if (match) {
                                    const currentCount = Math.max(0, parseInt(match[0]) - 1);
                                    repliesHeading.textContent = `Comments (${currentCount})`;
                                    // Store the count in a data attribute for persistence
                                    repliesHeading.setAttribute('data-reply-count', currentCount);
                                    console.log(`Updated reply count to ${currentCount} (estimated)`);
                                    
                                    // Force refresh the remaining reply cards count
                                    const currentReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                    console.log(`Actual remaining reply cards: ${currentReplyCards.length}`);
                                    
                                    // If counts don't match, force update the heading to match actual DOM count
                                    if (currentReplyCards.length !== currentCount) {
                                        console.log(`Count mismatch detected: estimated ${currentCount}, DOM has ${currentReplyCards.length}`);
                                        repliesHeading.textContent = `Comments (${currentReplyCards.length})`;
                                        console.log(`Corrected reply count to ${currentReplyCards.length}`);
                                        
                                        // Update the reply count on the dashboard post card
                                        const postDetailCard = document.querySelector('.post-detail-card');
                                        const postId = postDetailCard ? postDetailCard.getAttribute('data-post-id') : null;
                                        const finalCount = currentReplyCards.length;
                                        
                                        if (postId) {
                                            // Update all reply buttons with this post ID on the page
                                            document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`).forEach(replyButton => {
                                                const countSpan = replyButton.querySelector('span');
                                                if (countSpan) {
                                                    // We no longer update the reply button text as it now just shows "Reply"
                                                    console.log(`Not updating reply button text for post ${postId}`);
                                                }
                                            });
                                            
                                            // Use localStorage.setItem with a different key first to trigger storage event
                                            localStorage.setItem(`post_${postId}_reply_count_temp`, finalCount);
                                            localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                            
                                            // Now set the actual value
                                            localStorage.setItem(`post_${postId}_reply_count`, finalCount);
                                            console.log(`Stored reply count ${finalCount} in localStorage for post ${postId}`);
                                            
                                            // Dispatch a custom event to notify other parts of the page
                                            const updateEvent = new CustomEvent('replyCountUpdated', {
                                                detail: { postId, count: finalCount }
                                            });
                                            document.dispatchEvent(updateEvent);
                                        }
                                    }
                                    
                                    // Update the reply count in all dashboard buttons
                                    const postDetailCard = document.querySelector('.post-detail-card');
                                    const postId = postDetailCard ? postDetailCard.getAttribute('data-post-id') : null;
                                    if (postId) {
                                        // Get the actual count of remaining replies
                                        const finalCount = currentReplyCards.length;
                                        
                                        // Update all reply buttons with this post ID on the page
                                        document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`).forEach(replyButton => {
                                            const countSpan = replyButton.querySelector('span');
                                            if (countSpan) {
                                                // We no longer update the reply button text as it now just shows "Reply"
                                                console.log(`Not updating reply button text for post ${postId}`);
                                            }
                                        });
                                        
                                        // Use localStorage.setItem with a different key first to trigger storage event
                                        localStorage.setItem(`post_${postId}_reply_count_temp`, finalCount);
                                        localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                        
                                        // Now set the actual value
                                        localStorage.setItem(`post_${postId}_reply_count`, finalCount);
                                        console.log(`Stored reply count ${finalCount} in localStorage for post ${postId}`);
                                        
                                        // Dispatch a custom event to notify other parts of the page
                                        const updateEvent = new CustomEvent('replyCountUpdated', {
                                            detail: { postId, count: finalCount }
                                        });
                                        document.dispatchEvent(updateEvent);
                                    }
                                }
                            }
                            
                            // Check if there are any replies left
                                const repliesContainer = document.querySelector('.replies-container');
                                const remainingReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                if (repliesContainer && remainingReplyCards.length === 0) {
                                    // Remove all children except the heading
                                    const heading = repliesContainer.querySelector('h3');
                                    if (heading) {
                                        repliesContainer.innerHTML = '';
                                        repliesContainer.appendChild(heading);
                                        // Add no replies message
                                        const noReplies = document.createElement('div');
                                        noReplies.className = 'no-replies';
                                        noReplies.textContent = 'No comment yet. Be the first to comment!';
                                        repliesContainer.appendChild(noReplies);
                                        console.log('Added "no replies" message');
                                        
                                        // Update the reply button on the view post page
                                        const replyBtn = document.querySelector('.reply-btn[data-post-id]');
                                        if (replyBtn) {
                                            const postId = replyBtn.getAttribute('data-post-id');
                                            const countSpan = replyBtn.querySelector('span');
                                            if (countSpan) {
                                                // We no longer update the reply button text as it now just shows "Reply"
                                                console.log(`Not updating reply button text for post ${postId} (no replies case)`);
                                                
                                                // Update localStorage to ensure dashboard is updated
                                                if (postId) {
                                                    // Use localStorage.setItem with a different key first to trigger storage event
                                                    localStorage.setItem(`post_${postId}_reply_count_temp`, 0);
                                                    localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                                    
                                                    // Now set the actual value
                                                    localStorage.setItem(`post_${postId}_reply_count`, 0);
                                                    console.log(`Stored reply count 0 in localStorage for post ${postId}`);
                                                    
                                                    // Dispatch a custom event to notify other parts of the page
                                                    const updateEvent = new CustomEvent('replyCountUpdated', {
                                                        detail: { postId, count: 0 }
                                                    });
                                                    document.dispatchEvent(updateEvent);
                                                }
                                            }
                                        }
                                    }
                            }
                        }
                    } else {
                        // For other errors, still remove the reply if it exists
                        // This is a workaround for cases where the server successfully deletes the reply
                        // but there's an issue with the response
                        if (replyExists) {
                            console.log('Removing reply from DOM despite error');
                            replyExists.remove(); // Use the element we found, not the original reference
                            
                            // Update reply count in the heading (estimate by subtracting 1)
                            const repliesHeading = document.querySelector('.replies-container h3');
                            if (repliesHeading) {
                                const currentText = repliesHeading.textContent;
                                const match = currentText.match(/\d+/);
                                if (match) {
                                    const currentCount = Math.max(0, parseInt(match[0]) - 1);
                                    repliesHeading.textContent = `Replies (${currentCount})`;
                                    console.log(`Updated reply count to ${currentCount} (estimated)`);
                                    
                                    // Force refresh the remaining reply cards count
                                    const currentReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                                    console.log(`Actual remaining reply cards: ${currentReplyCards.length}`);
                                    
                                    // If counts don't match, force update the heading to match actual DOM count
                                    if (currentReplyCards.length !== currentCount) {
                                        console.log(`Count mismatch detected: estimated ${currentCount}, DOM has ${currentReplyCards.length}`);
                                        repliesHeading.textContent = `Comments (${currentReplyCards.length})`;
                                        console.log(`Corrected reply count to ${currentReplyCards.length}`);
                                        
                                        // Update the reply count on all buttons for this post
                                        const postDetailCard = document.querySelector('.post-detail-card');
                                        if (postDetailCard) {
                                            const postId = postDetailCard.getAttribute('data-post-id');
                                            if (postId) {
                                                // Get the actual count of remaining replies
                                                const finalCount = currentReplyCards.length;
                                                
                                                // Update all reply buttons with this post ID on the page
                                                document.querySelectorAll(`.reply-btn[data-post-id="${postId}"]`).forEach(replyButton => {
                                                    const countSpan = replyButton.querySelector('span');
                                                    if (countSpan) {
                                                        // We no longer update the reply button text as it now just shows "Reply"
                                                        console.log(`Not updating reply button text for post ${postId}`);
                                                    }
                                                });
                                                
                                                // Use localStorage.setItem with a different key first to trigger storage event
                                                localStorage.setItem(`post_${postId}_reply_count_temp`, finalCount);
                                                localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                                
                                                // Now set the actual value
                                                localStorage.setItem(`post_${postId}_reply_count`, finalCount);
                                                console.log(`Stored reply count ${finalCount} in localStorage for post ${postId}`);
                                                
                                                // Dispatch a custom event to notify other parts of the page
                                                const updateEvent = new CustomEvent('replyCountUpdated', {
                                                    detail: { postId, count: finalCount }
                                                });
                                                document.dispatchEvent(updateEvent);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Check if there are any replies left
                            const repliesContainer = document.querySelector('.replies-container');
                            const remainingReplyCards = document.querySelectorAll('.reply-card, .reply-item');
                            if (remainingReplyCards.length === 0) {
                                // Remove all children except the heading
                                const heading = repliesContainer.querySelector('h3');
                                repliesContainer.innerHTML = '';
                                repliesContainer.appendChild(heading);
                                // Add no replies message
                                const noReplies = document.createElement('div');
                                noReplies.className = 'no-replies';
                                noReplies.textContent = 'No comment yet. Be the first to comment!';
                                repliesContainer.appendChild(noReplies);
                                console.log('Added "no replies" message');
                                
                                // Update the reply button on the view post page
                                const replyBtn = document.querySelector('.reply-btn[data-post-id]');
                                if (replyBtn) {
                                    const postId = replyBtn.getAttribute('data-post-id');
                                    const countSpan = replyBtn.querySelector('span');
                                    if (countSpan) {
                                        // We no longer update the reply button text as it now just shows "Reply"
                                        console.log(`Not updating reply button text for post ${postId} (no replies case)`);
                                        
                                        // Update localStorage to ensure dashboard is updated
                                        if (postId) {
                                            // Use localStorage.setItem with a different key first to trigger storage event
                                            localStorage.setItem(`post_${postId}_reply_count_temp`, 0);
                                            localStorage.removeItem(`post_${postId}_reply_count_temp`);
                                            
                                            // Now set the actual value
                                            localStorage.setItem(`post_${postId}_reply_count`, 0);
                                            console.log(`Stored reply count 0 in localStorage for post ${postId}`);
                                            
                                            // Dispatch a custom event to notify other parts of the page
                                            const updateEvent = new CustomEvent('replyCountUpdated', {
                                                detail: { postId, count: 0 }
                                            });
                                            document.dispatchEvent(updateEvent);
                                        }
                                    }
                                }
                            }
                        } else {
                            console.log('Reply was already removed from DOM');
                        }
                    }
                })
                .finally(() => {
                    // Re-enable the button
                    this.disabled = false;
                    this.textContent = 'Delete';
                    // Close the modal
                    modal.classList.remove('active');
                });
            });
        });
    });
}

function setupReplyForms() {
    console.log('Setting up reply forms');
    const replyForms = document.querySelectorAll('.reply-form');
    console.log(`Found ${replyForms.length} reply forms`);
    
    replyForms.forEach(form => {
        console.log('Adding submit event listener to form:', form);
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Reply form submitted');
            
            const postId = this.getAttribute('data-post-id');
            const textarea = this.querySelector('textarea[name="message"]');
            const message = textarea.value.trim();
            const csrfToken = this.querySelector('input[name="csrfmiddlewaretoken"]').value;
            const repliesList = document.getElementById(`replies-list-${postId}`);
            
            console.log(`Submitting reply for post ${postId}`);
            console.log(`Message: ${message}`);
            console.log(`CSRF Token: ${csrfToken ? 'present' : 'missing'}`);
            console.log(`Replies list element: ${repliesList ? 'found' : 'not found'}`);
            
            if (!message) {
                console.log('Empty message, showing alert');
                alert('Reply cannot be empty');
                return;
            }
            
            // Disable the form while submitting
            const submitButton = this.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            console.log('Submit button disabled, showing sending state');
            
            console.log('Sending reply:', message);
            
            // Send the reply to the server
            const url = `/user/post/${postId}/reply/`;
            console.log('Sending reply to URL:', url);
            
            fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            })
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Response data:', data);
                
                if (data.status === 'success') {
                    // Clear the textarea
                    textarea.value = '';
                    
                    // Add the new reply to the list
                    const replyData = {
                        reply_id: data.reply_id,
                        username: data.username,
                        full_name: data.full_name || data.username, // Use full_name if available, otherwise username
                        user_profile_picture: data.user_profile_picture || '/static/accounts/images/profile.png', // Use provided picture or default
                        created_at: data.created_at,
                        message: data.message,
                        is_author: true // This is a new reply by the current user
                    };
                    
                    // Format the date for display
                    const replyDate = new Date(replyData.created_at);
                    replyData.formatted_date = replyDate.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    });
                    
                    const replyItem = createReplyElement(replyData);
                    
                    // Remove 'no replies' message if it exists
                    const noRepliesMsg = repliesList.querySelector('.no-replies');
                    if (noRepliesMsg) {
                        repliesList.innerHTML = '';
                    }
                    
                    repliesList.appendChild(replyItem);
                    
                    // Setup reply actions for the new reply
                    setupReplyActions();
                    setupDropdownToggles();
                    
                    // Update the reply count in the button
                    const replyButton = document.querySelector(`.reply-btn[data-post-id="${postId}"]`);
                    if (replyButton) {
                        const countSpan = replyButton.querySelector('span');
                        const currentCount = parseInt(data.reply_count || 1);
                        // We no longer update the reply button text as it now just shows "Reply"
                        console.log(`Not updating reply button text for post ${postId}`);
                    }
                    
                    // Setup edit/delete for the new reply
                    setupReplyActions();
                } else {
                    alert(data.message || 'Error submitting reply');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error submitting reply. Please try again.');
            })
            .finally(() => {
                // Re-enable the form
                submitButton.disabled = false;
                submitButton.textContent = 'Reply';
            });
        });
    });
}