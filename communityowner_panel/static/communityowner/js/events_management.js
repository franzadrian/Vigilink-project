// Community Owner Events Management JavaScript

// Pagination variables for events
let eventsPageSize = 10;
let eventsCurrentPage = 1;
let allEvents = []; // Store all events for pagination

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
        
        // Ensure "Create New Event" button is hidden on initialization
        const createEventBtnTop = document.getElementById('co-create-event-btn-top');
        if (createEventBtnTop) {
            createEventBtnTop.style.display = 'none';
        }
    }, 100);
    
    // Event creation modal
    const createEventBtnTop = document.getElementById('co-create-event-btn-top');
    const eventModal = document.getElementById('co-event-modal');
    const eventModalClose = document.getElementById('co-event-modal-close');
    const eventForm = document.getElementById('co-event-form');
    
    if (createEventBtnTop && eventModal) {
        createEventBtnTop.addEventListener('click', function() {
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
        
        // Lock body scroll while preserving position
        const scrollY = window.scrollY;
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.classList.add('modal-open');
        if (sbw > 0) {
            document.body.style.paddingRight = sbw + 'px';
        }
        document.body.setAttribute('data-scroll-y', scrollY);
        
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
        
        // Unlock body scroll and restore position
        const scrollY = document.body.getAttribute('data-scroll-y');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('modal-open');
        document.body.removeAttribute('data-scroll-y');
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY, 10));
        }
        
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
    
    // Hide the "Create New Event" button while loading
    const createEventBtnTop = document.getElementById('co-create-event-btn-top');
    if (createEventBtnTop) {
        createEventBtnTop.style.display = 'none';
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
        if (!response.ok) {
            // If 404 or 403, it's likely because community profile doesn't exist yet - not an error
            if (response.status === 404 || response.status === 403) {
                console.log('Community profile not set up yet - no events to load');
                allEvents = [];
                eventsCurrentPage = 1;
                renderEvents([]);
                updateEventsStats([]);
                // Hide button when no profile
                const createEventBtnTop = document.getElementById('co-create-event-btn-top');
                if (createEventBtnTop) {
                    createEventBtnTop.style.display = 'none';
                }
                return null; // Return null to skip next then block
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data) return; // Already handled in previous then
        console.log('Fetch data:', data);
        if (data.success) {
            console.log('Events loaded successfully:', data.events);
            console.log('Number of events:', data.events ? data.events.length : 0);
            // Store all events for pagination
            allEvents = data.events || [];
            eventsCurrentPage = 1; // Reset to first page when loading new events
            renderEvents(allEvents);
            
            // Update stats with events count
            updateEventsStats(allEvents);
        } else {
            console.log('API returned error:', data.error);
            // Don't show error notification if it's just because profile doesn't exist
            if (data.error && !data.error.includes('No community profile')) {
                showNotification(data.error || 'Failed to load events.', 'error');
            }
            eventsList.innerHTML = '<div class="no-events"><h3>Error Loading Events</h3><p>Please try again later.</p></div>';
            // Hide button on error
            const createEventBtnTop = document.getElementById('co-create-event-btn-top');
            if (createEventBtnTop) {
                createEventBtnTop.style.display = 'none';
            }
        }
    })
    .catch(error => {
        console.error('Error loading events:', error);
        showNotification('An error occurred while loading events.', 'error');
        eventsList.innerHTML = '<div class="no-events"><h3>Error Loading Events</h3><p>Please try again later.</p></div>';
        // Hide button on error
        const createEventBtnTop = document.getElementById('co-create-event-btn-top');
        if (createEventBtnTop) {
            createEventBtnTop.style.display = 'none';
        }
    });
}

function renderEvents(events) {
    console.log('renderEvents called with:', events);
    const eventsList = document.getElementById('co-events-list');
    if (!eventsList) {
        console.log('eventsList not found in renderEvents');
        return;
    }
    
    // Apply filters first
    const filteredEvents = filterEventsList(events);
    
    if (!filteredEvents || filteredEvents.length === 0) {
        console.log('No events to render after filtering, showing no events message');
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
        
        // Hide the "Create New Event" button when there are no events
        const createEventBtnTop = document.getElementById('co-create-event-btn-top');
        if (createEventBtnTop) {
            createEventBtnTop.style.display = 'none';
        }
        
        // Hide pagination when no events
        renderEventsPager(0);
        
        // Add event listener to the button instead of using onclick
        const noEventsBtn = document.getElementById('no-events-create-btn');
        if (noEventsBtn) {
            noEventsBtn.addEventListener('click', function() {
                showEventModal();
            });
        }
        return;
    }
    
    // Calculate pagination
    const totalFiltered = filteredEvents.length;
    const pageCount = Math.max(1, Math.ceil(totalFiltered / eventsPageSize));
    if (eventsCurrentPage > pageCount) {
        eventsCurrentPage = pageCount;
    }
    
    const start = (eventsCurrentPage - 1) * eventsPageSize;
    const end = start + eventsPageSize;
    const paginatedEvents = filteredEvents.slice(start, end);
    
    // Render paginated events
    const eventsHtml = paginatedEvents.map(event => `
        <div class="co-event-card" data-event-id="${event.id}">
            <div class="co-event-header">
                <h3 class="co-event-title">${escapeHtml(event.title)}</h3>
                <div class="co-event-actions">
                    <button class="co-event-btn attendees" onclick="showEventAttendees(${event.id})" title="View attendees">
                        <i class="fas fa-users"></i> <span class="btn-text">Attendees</span> <span class="btn-count">(${event.attending_count || 0})</span>
                    </button>
                    <button class="co-event-btn edit" onclick="editEvent(${event.id})" title="Edit event">
                        <i class="fas fa-edit"></i> <span class="btn-text">Edit</span>
                    </button>
                    <button class="co-event-btn delete" onclick="deleteEvent(${event.id})" title="Delete event">
                        <i class="fas fa-trash"></i> <span class="btn-text">Delete</span>
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
    
    // Render pagination
    renderEventsPager(totalFiltered);
    
    // Show the "Create New Event" button when there are events
    const createEventBtnTop = document.getElementById('co-create-event-btn-top');
    if (createEventBtnTop) {
        createEventBtnTop.style.display = 'flex';
    }
}

// Filter events list based on search and type filters
function filterEventsList(events) {
    if (!events || events.length === 0) {
        return [];
    }
    
    const searchTerm = (document.getElementById('co-event-filter')?.value || '').trim().toLowerCase();
    const typeFilter = (document.getElementById('co-event-type-filter')?.value || '').toLowerCase();
    
    return events.filter(event => {
        const title = (event.title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const eventType = (event.event_type || '').toLowerCase();
        
        const matchesSearch = !searchTerm || 
            title.includes(searchTerm) || 
            description.includes(searchTerm);
        
        const matchesType = !typeFilter || eventType.includes(typeFilter);
        
        return matchesSearch && matchesType;
    });
}

// Render events pagination (similar to coRenderPager)
function renderEventsPager(total) {
    const root = document.getElementById('co-events-pagination');
    if (!root) return;
    root.innerHTML = '';
    
    // Hide pagination if no events
    if (total === 0) {
        root.style.display = 'none';
        return;
    }
    
    root.style.display = 'flex';
    const pageCount = Math.max(1, Math.ceil(total / eventsPageSize));
    
    const mk = (label, p, disabled, active, isPageNumber = false) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (active ? ' active' : '');
        b.textContent = label;
        b.style.border = '1px solid #e5e7eb';
        b.style.background = '#fff';
        b.style.color = '#374151';
        b.style.borderRadius = '8px';
        b.style.padding = '6px 10px';
        b.style.fontSize = '13px';
        
        if (isPageNumber) {
            b.style.cursor = 'default';
        } else {
            b.style.cursor = 'pointer';
        }
        
        if (active) {
            b.style.borderColor = '#2563eb';
            b.style.color = '#2563eb';
            b.style.background = '#eff6ff';
        }
        if (disabled) {
            b.disabled = true;
            b.style.opacity = '.5';
            b.style.cursor = 'default';
        } else if (!isPageNumber) {
            b.addEventListener('click', () => {
                eventsCurrentPage = p;
                renderEvents(allEvents);
            });
        }
        return b;
    };
    
    // Only show Previous button if not on first page
    if (eventsCurrentPage > 1) {
        root.appendChild(mk('Prev', Math.max(1, eventsCurrentPage - 1), false, false));
    }
    
    // Show only current page number
    root.appendChild(mk(String(eventsCurrentPage), eventsCurrentPage, false, true, true));
    
    // Only show Next button if not on last page
    if (eventsCurrentPage < pageCount) {
        root.appendChild(mk('Next', Math.min(pageCount, eventsCurrentPage + 1), false, false));
    }
}

// Declare function globally first
async function showEventAttendees(eventId) {
    console.log('showEventAttendees called with eventId:', eventId);
    try {
        const response = await fetch(`/events/api/${eventId}/attendees/`, {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Attendees data received:', data);
        
        if (!data.success) {
            showNotification(data.error || 'Failed to load attendees', 'error');
            return;
        }
        
        // Get modal elements
        const modal = document.getElementById('co-modal-overlay');
        const modalShell = document.getElementById('co-modal-shell');
        const modalTitle = document.getElementById('co-modal-title');
        
        // Check if modal elements exist
        if (!modal || !modalShell || !modalTitle) {
            console.error('Modal elements not found:', { modal: !!modal, modalShell: !!modalShell, modalTitle: !!modalTitle });
            showNotification('Modal elements not found', 'error');
            return;
        }
        
        // Close delete confirmation modal if open (but don't close the main modal yet)
        const deleteModal = document.getElementById('co-delete-confirm-modal');
        if (deleteModal) {
            deleteModal.style.display = 'none';
            deleteModal.style.visibility = 'hidden';
            deleteModal.style.opacity = '0';
        }
        
        // Set modal title
        modalTitle.textContent = `Attendees - ${escapeHtml(data.event_title)}`;
        
        // Build attendees HTML
        let attendeesHtml = '';
        if (data.attendees && data.attendees.length > 0) {
            attendeesHtml = `
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                <th style="padding: 10px; text-align: left; font-weight: 600; color: #374151;">Name</th>
                                <th style="padding: 10px; text-align: left; font-weight: 600; color: #374151;">Email</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.attendees.map(attendee => `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 10px; color: #1f2937;">${escapeHtml(attendee.full_name || attendee.username || 'N/A')}</td>
                                    <td style="padding: 10px; color: #6b7280;">${escapeHtml(attendee.email || 'N/A')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            attendeesHtml = `
                <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                    <i class="fas fa-users" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                    <p style="font-size: 1.1rem; margin: 0;">No attendees yet</p>
                    <p style="font-size: 0.9rem; margin-top: 8px;">People who click "Attending" will appear here</p>
                </div>
            `;
        }
        
        // Set modal content
        modalShell.innerHTML = `
            <div style="padding: 20px;">
                ${attendeesHtml}
            </div>
        `;
        
        // Lock body scroll using the global function if available, otherwise use manual method
        try {
            if (typeof window.lockBodyScroll === 'function') {
                window.lockBodyScroll();
            } else {
                // Fallback manual scroll lock
                const scrollY = window.scrollY;
                const sbw = window.innerWidth - document.documentElement.clientWidth;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.width = '100%';
                document.body.classList.add('modal-open');
                if (sbw > 0) {
                    document.body.style.paddingRight = sbw + 'px';
                }
                document.body.setAttribute('data-scroll-y', scrollY);
            }
        } catch (e) {
            console.error('Error locking body scroll:', e);
        }
        
        // Open the modal
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.classList.add('active', 'show');
        
        // Set up close button handler
        const closeBtn = document.getElementById('co-modal-close');
        if (closeBtn) {
            // Remove any existing listeners by cloning the button
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            // Add click listener to the new button
            const updatedCloseBtn = document.getElementById('co-modal-close');
            if (updatedCloseBtn) {
                updatedCloseBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.closeAllModals === 'function') {
                        window.closeAllModals();
                    } else {
                        // Fallback close
                        modal.style.display = 'none';
                        modal.style.visibility = 'hidden';
                        modal.style.opacity = '0';
                        modal.classList.remove('active', 'show');
                        if (typeof window.unlockBodyScroll === 'function') {
                            window.unlockBodyScroll();
                        }
                    }
                });
            }
        }
        
        // Close on overlay click (but not on modal content click)
        const overlayClickHandler = function(e) {
            if (e.target === modal) {
                if (typeof window.closeAllModals === 'function') {
                    window.closeAllModals();
                } else {
                    // Fallback close
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    modal.classList.remove('active', 'show');
                    if (typeof window.unlockBodyScroll === 'function') {
                        window.unlockBodyScroll();
                    }
                }
            }
        };
        
        // Remove old listener if exists and add new one
        modal.removeEventListener('click', overlayClickHandler);
        modal.addEventListener('click', overlayClickHandler);
    } catch (error) {
        console.error('Error fetching attendees:', error);
        showNotification('Failed to load attendees', 'error');
    }
}

// Ensure function is globally available
window.showEventAttendees = showEventAttendees;

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
        
        // Lock body scroll while preserving position
        const scrollY = window.scrollY;
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.classList.add('modal-open');
        if (sbw > 0) {
            document.body.style.paddingRight = sbw + 'px';
        }
        document.body.setAttribute('data-scroll-y', scrollY);
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
        
        // Unlock body scroll and restore position
        const scrollY = document.body.getAttribute('data-scroll-y');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('modal-open');
        document.body.removeAttribute('data-scroll-y');
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY, 10));
        }
        
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
    // Reset to first page when filtering
    eventsCurrentPage = 1;
    // Re-render events with filters applied
    renderEvents(allEvents);
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

// Ensure showEventAttendees is available globally (redundant but safe)
if (typeof window !== 'undefined') {
    window.showEventAttendees = showEventAttendees;
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

// Expose loadEvents globally for use by other scripts
if (typeof window !== 'undefined') {
    window.loadEvents = loadEvents;
}
