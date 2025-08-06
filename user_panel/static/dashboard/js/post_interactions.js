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
    
    // Setup share forms
    setupShareForms();
    
    // Setup reply buttons
    setupReplyButtons();
    
    // Setup dropdown toggles for post and reply actions
    setupDropdownToggles();
    
    // Setup post actions (edit/delete)
    setupPostActions();
    
    // Setup reply actions (edit/delete)
    setupReplyActions();
});

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
                if (openMenu !== menu) {
                    openMenu.classList.remove('show');
                }
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
                if (openMenu !== menu) {
                    openMenu.classList.remove('show');
                }
            });
            
            // Toggle this menu
            menu.classList.toggle('show');
        });
    });
    
    // Close all menus when clicking outside
    // Use capture phase to ensure this runs before other click handlers
    document.addEventListener('click', function(e) {
        // Only close if we're not clicking on a toggle button or inside a menu
        if (!e.target.closest('.post-actions-toggle') && 
            !e.target.closest('.reply-actions-toggle') && 
            !e.target.closest('.post-actions-menu') && 
            !e.target.closest('.reply-actions-menu')) {
            
            document.querySelectorAll('.post-actions-menu.show, .reply-actions-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    }, true);
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
 * Setup share form submissions with AJAX
 */
function setupShareForms() {
    const shareForms = document.querySelectorAll('.share-form');
    
    shareForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const url = this.getAttribute('action');
            const csrfToken = this.querySelector('input[name="csrfmiddlewaretoken"]').value;
            const postCard = this.closest('.post-card');
            const shareCountDiv = postCard.querySelector('.share-count');
            
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
                // Update the share count
                shareCountDiv.textContent = `${data.count} ${data.count === 1 ? 'Share' : 'Shares'}`;
                
                // Show a success message
                const shareButton = this.querySelector('.share-btn');
                const originalText = shareButton.innerHTML;
                
                shareButton.innerHTML = '<span>Shared!</span>';
                setTimeout(() => {
                    shareButton.innerHTML = originalText;
                }, 2000);
            })
            .catch(error => console.error('Error:', error));
        });
    });
}

/**
 * Setup reply buttons to show replies section
 */
function setupReplyButtons() {
    console.log('Setting up reply buttons');
    const replyButtons = document.querySelectorAll('.reply-btn');
    console.log(`Found ${replyButtons.length} reply buttons`);
    
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
                    console.log(`Replies already loaded: ${repliesList.children.length} replies`);
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
    
    // Fetch replies from the server
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
            } else {
                console.log('No replies found');
                // No replies
                repliesList.innerHTML = '<div class="no-replies">No replies yet. Be the first to reply!</div>';
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
    console.log('Creating reply element for reply ID:', reply.id);
    const replyItem = document.createElement('div');
    replyItem.className = 'reply-item';
    replyItem.setAttribute('data-reply-id', reply.id);
    
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
    // Force default image if user_profile_picture is null, undefined, or empty string
    const profilePicture = reply.user_profile_picture && reply.user_profile_picture !== '' ? 
        reply.user_profile_picture : '/static/accounts/images/profile.png';
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
                    <button class="edit-reply-btn" data-reply-id="${reply.id}" data-reply-message="${reply.message.replace(/"/g, '&quot;')}">Edit</button>
                    <button class="delete-reply-btn" data-reply-id="${reply.id}">Delete</button>
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
    
    // Add event listener for dropdown toggle if actions exist
    if (isAuthor) {
        console.log('Setting up action dropdown toggle');
        setTimeout(() => {
            const toggleButton = replyItem.querySelector('.reply-actions-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const menu = this.nextElementSibling;
                    menu.classList.toggle('show');
                    
                    // Close other open menus
                    document.querySelectorAll('.reply-actions-menu.show').forEach(openMenu => {
                        if (openMenu !== menu) {
                            openMenu.classList.remove('show');
                        }
                    });
                });
                console.log('Toggle button event listener added');
            }
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
            const postId = document.querySelector('.post-detail-card').getAttribute('data-post-id');
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
                        
                        // Update reply count in the heading
                        const repliesHeading = document.querySelector('.replies-container h3');
                        if (repliesHeading) {
                            const currentCount = parseInt(data.reply_count);
                            repliesHeading.textContent = `Replies (${currentCount})`;
                        }
                        
                        // If no more replies, show 'no replies' message
                        const repliesContainer = document.querySelector('.replies-container');
                        const replyCards = document.querySelectorAll('.reply-card');
                        if (replyCards.length === 0) {
                            // Remove all children except the heading
                            const heading = repliesContainer.querySelector('h3');
                            repliesContainer.innerHTML = '';
                            repliesContainer.appendChild(heading);
                            // Add no replies message
                            const noReplies = document.createElement('div');
                            noReplies.className = 'no-replies';
                            noReplies.textContent = 'No replies yet. Be the first to reply!';
                            repliesContainer.appendChild(noReplies);
                        }
                        
                        // Close the modal
                        modal.classList.remove('active');
                    } else {
                        alert(data.message || 'Error deleting reply');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error deleting reply. Please try again.');
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
                        id: data.reply_id,
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
                    
                    // Update the reply count in the button
                    const replyButton = document.querySelector(`.reply-btn[data-post-id="${postId}"]`);
                    if (replyButton) {
                        const countSpan = replyButton.querySelector('span');
                        const currentCount = parseInt(data.reply_count || 1);
                        countSpan.textContent = `${currentCount} ${currentCount === 1 ? 'Reply' : 'Replies'}`;
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