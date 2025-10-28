// Community Owner Events Management JavaScript

// Initialize events management when script loads
(function() {
    console.log('Events management script loading...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initEventsManagement();
        });
    } else {
        // DOM already loaded
        initEventsManagement();
    }
})();

function initEventsManagement() {
    // Ensure delete modal is hidden on initialization with a slight delay
    setTimeout(() => {
        const deleteModal = document.getElementById('co-delete-confirm-modal');
        if (deleteModal) {
            console.log('Hiding delete modal on initialization');
            deleteModal.style.display = 'none';
            deleteModal.style.visibility = 'hidden';
            deleteModal.style.opacity = '0';
            deleteModal.style.pointerEvents = 'none';
        } else {
            console.log('Delete modal not found during initialization');
        }
    }, 100);
    
    // Event creation modal
    const createEventBtnBottom = document.getElementById('co-create-event-btn-bottom');
    const eventModal = document.getElementById('co-event-modal');
    const eventModalClose = document.getElementById('co-event-modal-close');
    const eventForm = document.getElementById('co-event-form');
    
    if (createEventBtnBottom && eventModal) {
        createEventBtnBottom.addEventListener('click', function() {
            showEventModal();
        });
    }
    
    if (eventModalClose) {
        eventModalClose.addEventListener('click', hideEventModal);
    }
    
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    
    // Delete confirmation modal
    const deleteModal = document.getElementById('co-delete-confirm-modal');
    const deleteModalClose = document.getElementById('co-delete-modal-close');
    const deleteCancelBtn = document.getElementById('co-delete-cancel');
    const deleteConfirmBtn = document.getElementById('co-delete-confirm');
    
    if (deleteModalClose) {
        deleteModalClose.addEventListener('click', hideDeleteConfirmationModal);
    }
    
    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener('click', hideDeleteConfirmationModal);
    }
    
    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', confirmDeleteEvent);
    }
    
    // Close delete modal when clicking outside
    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === deleteModal) {
                hideDeleteConfirmationModal();
            }
        });
    }
    
    // Close delete modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && deleteModal && deleteModal.style.display === 'flex') {
            hideDeleteConfirmationModal();
        }
    });
    
    // Don't close modal on overlay click - only close with X button
    // if (eventModal) {
    //     eventModal.addEventListener('click', function(e) {
    //         if (e.target === eventModal) {
    //             hideEventModal();
    //         }
    //     });
    // }
    
    // Events will be loaded when the events section is shown via the main navigation script
    
    // Initialize event filters
    initEventFilters();
}

function showEventModal() {
    const modal = document.getElementById('co-event-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');
        
        // Reset form and modal for create mode
        const form = document.getElementById('co-event-form');
        const modalTitle = document.getElementById('co-event-modal-title');
        const submitBtn = document.getElementById('co-event-save');
        
        if (form) {
            form.reset();
            form.removeAttribute('data-event-id'); // Remove edit mode
        }
        
        if (modalTitle) {
            modalTitle.textContent = 'Create Event Announcement';
        }
        
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Event';
        }
        
        // Set default start date to now
        const startDateInput = document.getElementById('event_start_date');
        if (startDateInput) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            startDateInput.value = now.toISOString().slice(0, 16);
        }
        
        // Focus on title input
        const titleInput = document.getElementById('event_title');
        if (titleInput) {
            titleInput.focus();
        }
    }
}

function hideEventModal() {
    const modal = document.getElementById('co-event-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
        
        // Reset form
        const form = document.getElementById('co-event-form');
        if (form) {
            form.reset();
        }
    }
}

function handleEventSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Check if this is an edit operation
    const eventId = form.dataset.eventId;
    const isEdit = !!eventId;
    
    // Validate required fields
    const title = formData.get('title');
    const description = formData.get('description');
    const startDate = formData.get('start_date');
    
    if (!title || !description || !startDate) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }
    
    // Prepare event data
    const eventData = {
        title: title.trim(),
        description: description.trim(),
        event_type: formData.get('event_type') || 'announcement',
        start_date: new Date(startDate).toISOString(),
        location: formData.get('location') || ''
    };
    
    // Show loading state
    const submitBtn = document.getElementById('co-event-save');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEdit ? 'Updating...' : 'Creating...'}`;
    submitBtn.disabled = true;
    
    // Determine URL and method
    const apiEndpoints = document.getElementById('co-api-endpoints');
    let url, method;
    
    if (isEdit) {
        const baseUpdateUrl = apiEndpoints?.dataset.eventsUpdateUrl;
        if (!baseUpdateUrl) {
            showNotification('Update API endpoint not found.', 'error');
            resetSubmitBtn();
            return;
        }
        url = baseUpdateUrl.replace('0', eventId);
        method = 'POST';
    } else {
        url = apiEndpoints?.dataset.eventsCreateUrl;
        method = 'POST';
    }
    
    if (!url) {
        showNotification('API endpoint not found.', 'error');
        resetSubmitBtn();
        return;
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Event ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
            hideEventModal();
            loadEvents(); // Reload events list
        } else {
            showNotification(data.error || `Failed to ${isEdit ? 'update' : 'create'} event.`, 'error');
        }
    })
    .catch(error => {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} event:`, error);
        showNotification(`An error occurred while ${isEdit ? 'updating' : 'creating'} the event.`, 'error');
    })
    .finally(() => {
        resetSubmitBtn();
    });
    
    function resetSubmitBtn() {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Update events stats in the main dashboard
function updateEventsStats(eventsArray) {
    console.log('Updating events stats with:', eventsArray ? eventsArray.length : 0, 'events');
    const totalEventsEl = document.getElementById('total-events');
    if (totalEventsEl) {
        const totalEvents = Array.isArray(eventsArray) ? eventsArray.length : 0;
        console.log('Setting total events to:', totalEvents);
        
        // Update immediately without waiting for other animations
        totalEventsEl.textContent = totalEvents;
        
        // Mark as animated to prevent conflicts with main stats update
        totalEventsEl.setAttribute('data-animated', 'true');
        
        // Also update the global events array if it exists
        if (typeof window !== 'undefined' && window.events !== undefined) {
            window.events = eventsArray || [];
        }
        
        console.log('Total events updated successfully to:', totalEvents);
    } else {
        console.error('total-events element not found for stats update');
    }
}

function loadEvents() {
    console.log('loadEvents function called');
    const eventsList = document.getElementById('co-events-list');
    if (!eventsList) {
        console.log('eventsList element not found - events section may not be visible yet');
        return;
    }
    
    console.log('eventsList found, proceeding with load');
    // Show loading state
    eventsList.innerHTML = `
        <div class="events-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading events...</span>
        </div>
    `;
    
    const apiEndpoints = document.getElementById('co-api-endpoints');
    const listUrl = apiEndpoints?.dataset.eventsListUrl;
    
    console.log('API endpoints:', apiEndpoints);
    console.log('List URL:', listUrl);
    
    if (!listUrl) {
        console.log('API endpoint not found');
        showNotification('API endpoint not found.', 'error');
        return;
    }
    
    console.log('Making fetch request to:', listUrl);
    fetch(listUrl, {
        method: 'GET',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => {
        console.log('Fetch response:', response);
        return response.json();
    })
    .then(data => {
        console.log('Fetch data:', data);
        if (data.success) {
            console.log('Events loaded successfully:', data.events);
            console.log('Number of events:', data.events ? data.events.length : 0);
            renderEvents(data.events);
            
            // Update stats with events count
            updateEventsStats(data.events);
        } else {
            console.log('API returned error:', data.error);
            showNotification(data.error || 'Failed to load events.', 'error');
            eventsList.innerHTML = '<div class="no-events"><h3>Error Loading Events</h3><p>Please try again later.</p></div>';
        }
    })
    .catch(error => {
        console.error('Error loading events:', error);
        showNotification('An error occurred while loading events.', 'error');
        eventsList.innerHTML = '<div class="no-events"><h3>Error Loading Events</h3><p>Please try again later.</p></div>';
    });
}

function renderEvents(events) {
    console.log('renderEvents called with:', events);
    const eventsList = document.getElementById('co-events-list');
    if (!eventsList) {
        console.log('eventsList not found in renderEvents');
        return;
    }
    
    if (!events || events.length === 0) {
        console.log('No events to render, showing no events message');
        eventsList.innerHTML = `
            <div class="no-events">
                <div class="no-events-icon">
                    <i class="fas fa-calendar-plus"></i>
                </div>
                <h3>No Events Yet</h3>
                <p>Create your first event announcement to get started!</p>
                <div style="margin-top: 30px;">
                    <button class="action-btn edit-btn" id="no-events-create-btn" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create Your First Event
                    </button>
                </div>
                <div style="margin-top: 25px; font-size: 0.95rem; color: #94a3b8; font-style: italic; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>💡</span>
                    <span>Tip: Events help keep your community informed and engaged!</span>
                </div>
            </div>
        `;
        
        // Add event listener to the button instead of using onclick
        const noEventsBtn = document.getElementById('no-events-create-btn');
        if (noEventsBtn) {
            noEventsBtn.addEventListener('click', function() {
                showEventModal();
            });
        }
        return;
    }
    
    const eventsHtml = events.map(event => `
        <div class="co-event-card" data-event-id="${event.id}">
            <div class="co-event-header">
                <h3 class="co-event-title">${escapeHtml(event.title)}</h3>
                <div class="co-event-actions">
                    <button class="co-event-btn view" onclick="viewEvent(${event.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="co-event-btn edit" onclick="editEvent(${event.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="co-event-btn delete" onclick="deleteEvent(${event.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            
            <!-- Hidden data for view function -->
            <div style="display: none;" class="co-event-data">
                <div class="co-event-description">${escapeHtml(event.description)}</div>
                <div class="event-type">${event.event_type}</div>
                <div class="event-start-date">${formatEventDate(event.start_date)}</div>
                <div class="event-location">${escapeHtml(event.location || '')}</div>
                <div class="event-status ${event.is_upcoming ? 'upcoming' : event.is_ongoing ? 'ongoing' : 'completed'}"></div>
            </div>
        </div>
    `).join('');
    
    eventsList.innerHTML = eventsHtml;
}

function viewEvent(eventId) {
    // Find the event data from the current events list
    const eventsList = document.getElementById('co-events-list');
    const eventCard = eventsList.querySelector(`[data-event-id="${eventId}"]`);
    if (!eventCard) {
        showNotification('Event not found', 'error');
        return;
    }
    
    // Extract event data from the hidden elements
    const title = eventCard.querySelector('.co-event-title').textContent;
    const description = eventCard.querySelector('.co-event-data .co-event-description').textContent;
    const eventType = eventCard.querySelector('.co-event-data .event-type').textContent;
    const startDate = eventCard.querySelector('.co-event-data .event-start-date').textContent;
    const location = eventCard.querySelector('.co-event-data .event-location').textContent;
    const isUpcoming = eventCard.querySelector('.co-event-data .event-status.upcoming') !== null;
    const isOngoing = eventCard.querySelector('.co-event-data .event-status.ongoing') !== null;
    
    const event = {
        title: title,
        description: description,
        event_type: eventType,
        start_date: startDate,
        location: location,
        is_upcoming: isUpcoming,
        is_ongoing: isOngoing
    };
    
    // Create a detailed view modal
    const modal = document.getElementById('co-modal-overlay');
    const modalShell = document.getElementById('co-modal-shell');
    const modalTitle = document.getElementById('co-modal-title');
    
    modalTitle.textContent = 'Event Details';
    
    modalShell.innerHTML = `
        <div class="event-detail-view">
            <div class="event-detail-header">
                <h2>${escapeHtml(event.title)}</h2>
                <div class="event-detail-badges">
                    <span class="event-type-badge">${event.event_type}</span>
                    <span class="event-status-badge ${event.is_upcoming ? 'upcoming' : event.is_ongoing ? 'ongoing' : 'completed'}">
                        <i class="fas fa-${event.is_upcoming ? 'clock' : event.is_ongoing ? 'play-circle' : 'check-circle'}"></i>
                        ${event.is_upcoming ? 'Upcoming' : event.is_ongoing ? 'Ongoing' : 'Completed'}
                    </span>
                </div>
            </div>
            
            <div class="event-detail-content">
                <div class="event-detail-info-grid">
                    <div class="event-detail-info-item">
                        <h4><i class="fas fa-calendar"></i> Date</h4>
                        <p>${formatEventDate(event.start_date).split(' at ')[0]}</p>
                    </div>
                    <div class="event-detail-info-item">
                        <h4><i class="fas fa-map-marker-alt"></i> Location</h4>
                        <p>${event.location ? escapeHtml(event.location) : 'TBA'}</p>
                    </div>
                </div>
                
                <div class="event-detail-section">
                    <h3><i class="fas fa-align-left"></i> Description</h3>
                    <p>${escapeHtml(event.description)}</p>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function editEvent(eventId) {
    // Find the event data from the current events list
    const eventsList = document.getElementById('co-events-list');
    const eventCard = eventsList.querySelector(`[data-event-id="${eventId}"]`);
    if (!eventCard) {
        showNotification('Event not found', 'error');
        return;
    }
    
    // Extract event data from the hidden elements
    const title = eventCard.querySelector('.co-event-title').textContent;
    const description = eventCard.querySelector('.co-event-data .co-event-description').textContent;
    const eventType = eventCard.querySelector('.co-event-data .event-type').textContent;
    const startDate = eventCard.querySelector('.co-event-data .event-start-date').textContent;
    const location = eventCard.querySelector('.co-event-data .event-location').textContent;
    
    // Open the create event modal but pre-populate it with event data
    showEventModal();
    
    // Pre-populate the form with event data
    setTimeout(() => {
        document.getElementById('event_title').value = title;
        document.getElementById('event_description').value = description;
        document.getElementById('event_type').value = eventType.toLowerCase();
        document.getElementById('event_location').value = location;
        
        // Parse the formatted date back to datetime-local format
        const dateStr = startDate; // e.g., "Oct 28, 2025, 07:59 PM"
        const eventDate = new Date(dateStr);
        if (!isNaN(eventDate.getTime())) {
            const localDate = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000);
            document.getElementById('event_start_date').value = localDate.toISOString().slice(0, 16);
        }
        
        // Change modal title and button text
        document.getElementById('co-event-modal-title').textContent = 'Edit Event';
        document.getElementById('co-event-save').innerHTML = '<i class="fas fa-save"></i> Update Event';
        
        // Store the event ID for updating
        document.getElementById('co-event-form').dataset.eventId = eventId;
    }, 100);
}

// Global variable to store the event ID to delete
let eventToDelete = null;

function deleteEvent(eventId) {
    // Store the event ID for later use
    eventToDelete = eventId;
    
    // Show the custom confirmation modal
    showDeleteConfirmationModal();
}

function showDeleteConfirmationModal() {
    console.log('showDeleteConfirmationModal called');
    const modal = document.getElementById('co-delete-confirm-modal');
    if (modal) {
        console.log('Showing delete modal');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    } else {
        console.log('Delete modal not found');
    }
}

function hideDeleteConfirmationModal() {
    console.log('hideDeleteConfirmationModal called');
    const modal = document.getElementById('co-delete-confirm-modal');
    if (modal) {
        console.log('Hiding delete modal');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        eventToDelete = null; // Reset the event ID
    } else {
        console.log('Delete modal not found when trying to hide');
    }
}

function confirmDeleteEvent() {
    if (!eventToDelete) {
        console.error('No event ID to delete');
        return;
    }
    
    const apiEndpoints = document.getElementById('co-api-endpoints');
    const baseDeleteUrl = apiEndpoints?.dataset.eventsDeleteUrl;
    
    if (!baseDeleteUrl) {
        showNotification('API endpoint not found.', 'error');
        hideDeleteConfirmationModal();
        return;
    }
    
    // Construct the URL with the event ID
    const deleteUrl = baseDeleteUrl.replace('0', eventToDelete);
    
    fetch(deleteUrl, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Event deleted successfully!', 'success');
            loadEvents(); // Reload events list
        } else {
            showNotification(data.error || 'Failed to delete event.', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting event:', error);
        showNotification('An error occurred while deleting the event.', 'error');
    })
    .finally(() => {
        hideDeleteConfirmationModal();
    });
}

function initEventFilters() {
    const searchInput = document.getElementById('co-event-filter');
    const typeFilter = document.getElementById('co-event-type-filter');
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterEvents();
            }, 300);
        });
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', filterEvents);
    }
}

function filterEvents() {
    const searchTerm = document.getElementById('co-event-filter')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('co-event-type-filter')?.value || '';
    
    const eventCards = document.querySelectorAll('.co-event-card');
    
    eventCards.forEach(card => {
        const title = card.querySelector('.co-event-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.co-event-description')?.textContent.toLowerCase() || '';
        const eventType = card.querySelector('.event-type')?.textContent.toLowerCase() || '';
        
        const matchesSearch = !searchTerm || 
            title.includes(searchTerm) || 
            description.includes(searchTerm);
        
        const matchesType = !typeFilter || eventType.includes(typeFilter);
        
        if (matchesSearch && matchesType) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Utility functions
function formatEventDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

function showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (window.showNotification && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
        notification.style.background = '#10b981';
    } else if (type === 'error') {
        notification.style.background = '#ef4444';
    } else if (type === 'warning') {
        notification.style.background = '#f59e0b';
    } else {
        notification.style.background = '#3b82f6';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
