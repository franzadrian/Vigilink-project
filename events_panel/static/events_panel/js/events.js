// Events Panel JavaScript - Simplified for viewing only

document.addEventListener('DOMContentLoaded', function() {
    // Initialize events functionality
    initEventCards();
    applyEventThemes();
    initRsvpButtons();
    initCollapsibleEvents();
    initEventFilters();
    initializeImageModal();
});

// Initialize event filter buttons
function initEventFilters() {
    const filterButtons = document.querySelectorAll('.events-filter-buttons .filter-btn');
    const platformSection = document.getElementById('platform-announcements-section');
    const communitySection = document.getElementById('community-events-section');
    
    // Function to update section visibility based on filter
    function updateSectionVisibility(filter) {
        if (filter === 'all') {
            // Show all sections
            if (platformSection) {
                platformSection.classList.remove('hidden');
                platformSection.style.display = 'block';
            }
            if (communitySection) {
                communitySection.classList.remove('hidden');
                communitySection.style.display = 'block';
            }
        } else if (filter === 'platform') {
            // Show only platform announcements
            if (platformSection) {
                platformSection.classList.remove('hidden');
                platformSection.style.display = 'block';
            }
            if (communitySection) {
                communitySection.classList.add('hidden');
                communitySection.style.display = 'none';
            }
        } else if (filter === 'community') {
            // Show only community events
            if (platformSection) {
                platformSection.classList.add('hidden');
                platformSection.style.display = 'none';
            }
            if (communitySection) {
                communitySection.classList.remove('hidden');
                communitySection.style.display = 'block';
            }
        }
    }
    
    // Initialize visibility based on active button
    const activeButton = document.querySelector('.events-filter-buttons .filter-btn.active');
    if (activeButton) {
        const initialFilter = activeButton.getAttribute('data-filter');
        updateSectionVisibility(initialFilter);
    } else {
        // If no active button, show all sections by default
        if (platformSection) {
            platformSection.classList.remove('hidden');
            platformSection.style.display = 'block';
        }
        if (communitySection) {
            communitySection.classList.remove('hidden');
            communitySection.style.display = 'block';
        }
    }
    
    // If no filter buttons, ensure sections are visible
    if (!filterButtons.length) {
        if (platformSection) {
            platformSection.classList.remove('hidden');
            platformSection.style.display = 'block';
        }
        if (communitySection) {
            communitySection.classList.remove('hidden');
            communitySection.style.display = 'block';
        }
        return;
    }
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update section visibility
            updateSectionVisibility(filter);
        });
    });
}

// Initialize event cards with hover effects and interactions
function initEventCards() {
    const eventCards = document.querySelectorAll('.event-card');
    
    eventCards.forEach(card => {
        // Add click handler for card (if needed)
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking on buttons or links
            if (e.target.closest('.event-view-btn') || e.target.closest('button')) {
                return;
            }
            
            // Optional: Navigate to event detail on card click
            const viewBtn = card.querySelector('.event-view-btn');
            if (viewBtn) {
                viewBtn.click();
            }
        });
        
        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Calendar button removed
    // View button removed from Past Events section
}

// Apply themed appearance based on event title keywords and event types
function applyEventThemes() {
    const cards = document.querySelectorAll('.event-card[data-title]');
    const knownThemes = ['theme-halloween','theme-christmas','theme-meeting','theme-social','theme-announcement','theme-maintenance','theme-emergency'];

    cards.forEach(card => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const type = (card.getAttribute('data-type') || '').toLowerCase();

        // Keyword-based themes
        if (/halloween|spooky|trick[- ]?or[- ]?treat|pumpkin|ghost|ghoul/.test(title)) {
            card.classList.add('theme-halloween');
        } else if (/christmas|xmas|holiday|santa|yuletide/.test(title)) {
            card.classList.add('theme-christmas');
        } else if (/meeting|town\s*hall|assembly|board\s*meeting|hoa/.test(title)) {
            card.classList.add('theme-meeting');
        } else if (/party|social|gathering|picnic|festival|celebration/.test(title)) {
            card.classList.add('theme-social');
        } else if (/maintenance|repair|service\s*outage|water\s*interruption|power\s*outage/.test(title)) {
            card.classList.add('theme-maintenance');
        } else if (/emergency|urgent|alert|warning/.test(title)) {
            card.classList.add('theme-emergency');
        }

        // Fallback to type-based themes
        if (!knownThemes.some(t => card.classList.contains(t)) && type) {
            switch (type) {
                case 'announcement':
                    card.classList.add('theme-announcement');
                    break;
                case 'meeting':
                    card.classList.add('theme-meeting');
                    break;
                case 'maintenance':
                    card.classList.add('theme-maintenance');
                    break;
                case 'social':
                    card.classList.add('theme-social');
                    break;
                case 'emergency':
                    card.classList.add('theme-emergency');
                    break;
                default:
                    break;
            }
        }

        // Final fallback to generic theme
        if (!knownThemes.some(t => card.classList.contains(t))) {
            card.classList.add('theme-generic');
        }
    });
}

// RSVP handling
function initRsvpButtons() {
    // Handle both .event-card and .event-row
    document.querySelectorAll('.event-card, .event-row').forEach(card => {
        const rsvp = card.querySelector('.event-rsvp');
        const buttons = rsvp ? rsvp.querySelectorAll('.event-rsvp-btn') : [];
        if (rsvp) {
            const current = rsvp.getAttribute('data-current');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-status') === current) {
                    btn.classList.add('active');
                }
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const status = btn.getAttribute('data-status');
                    const eventId = card.getAttribute('data-event-id');
                    await submitRsvp(eventId, status, buttons, card);
                });
            });
        }
        // CTA button triggers attending RSVP
        const cta = card.querySelector('.event-rsvp-cta');
        if (cta) {
            cta.addEventListener('click', async (e) => {
                e.stopPropagation();
                const status = 'attending';
                const eventId = card.getAttribute('data-event-id');
                await submitRsvp(eventId, status, buttons, card);
                // Reflect active state if RSVP group exists
                if (buttons && buttons.length) {
                    buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-status') === status));
                }
            });
        }
    });
}

async function submitRsvp(eventId, status, buttons, eventCard) {
    try {
        const csrfToken = getCookie('csrftoken');
        const res = await fetch(window.location.origin + '/events/rsvp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ event_id: eventId, status })
        });
        const data = await res.json();
        if (data && data.success) {
            buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-status') === status));
            
            // Update event badge - mark this event as seen by updating lastCheckedEventId
            // This will remove this event from the badge count
            if (data.event_id) {
                const STORAGE_KEY = 'events_last_checked_id';
                try {
                    const currentLastId = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
                    const eventId = parseInt(data.event_id, 10);
                    
                    if (isNaN(eventId)) {
                        console.error('RSVP: Invalid event_id:', data.event_id);
                        return;
                    }
                    
                    // Update to the higher of current or this event's ID
                    // Since backend uses id__gt (greater than), setting to eventId will exclude this event
                    const newLastId = Math.max(currentLastId, eventId);
                    localStorage.setItem(STORAGE_KEY, String(newLastId));
                    
                    console.log('RSVP: Updated lastCheckedEventId from', currentLastId, 'to', newLastId, 'for event', eventId);
                    
                    // Immediately refresh the badge
                    // The backend now automatically excludes events the user has RSVP'd to
                    // So we just need to trigger a refresh
                    const refreshBadgeNow = () => {
                        const badge = document.getElementById('events-unread-badge');
                        if (!badge) {
                            console.warn('RSVP: Badge element not found');
                            return;
                        }
                        
                        // Get the current lastCheckedEventId from localStorage
                        const currentId = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
                        console.log('RSVP: Refreshing badge after RSVP to event', eventId, 'current lastCheckedEventId:', currentId);
                        
                        // Call the API to check for new events
                        // Backend will automatically exclude this event since user has RSVP'd
                        fetch(`/events/api/check-new-events/?last_check_id=${currentId}&_t=${Date.now()}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                return response.json();
                            })
                            .then(badgeData => {
                                console.log('RSVP: Badge refresh response:', {
                                    unseen_events_count: badgeData.unseen_events_count,
                                    has_new_events: badgeData.has_new_events,
                                    current_max_id: badgeData.current_max_id
                                });
                                
                                // Check if notifications are enabled
                                const isEnabled = badge.getAttribute('data-notifications-enabled') === 'true' || 
                                                 (typeof window.receiveNotificationsEnabled !== 'undefined' && window.receiveNotificationsEnabled);
                                
                                if (!isEnabled) {
                                    badge.style.display = 'none';
                                    badge.removeAttribute('data-count');
                                    return;
                                }
                                
                                // Update badge based on response
                                if (typeof badgeData.unseen_events_count !== 'undefined') {
                                    if (badgeData.unseen_events_count > 0) {
                                        badge.textContent = badgeData.unseen_events_count > 99 ? '99+' : String(badgeData.unseen_events_count);
                                        badge.setAttribute('data-count', String(badgeData.unseen_events_count));
                                        badge.style.display = 'inline-flex';
                                    } else {
                                        // No unseen events - hide badge
                                        badge.style.display = 'none';
                                        badge.removeAttribute('data-count');
                                        console.log('RSVP: Badge hidden - no unseen events');
                                    }
                                } else {
                                    // No unseen_events_count in response - hide badge to be safe
                                    badge.style.display = 'none';
                                    badge.removeAttribute('data-count');
                                    console.log('RSVP: Badge hidden - no unseen_events_count in response');
                                }
                            })
                            .catch(error => {
                                console.error('RSVP: Error refreshing badge:', error);
                                // Fallback to using refreshEventBadge if available
                                if (typeof window.refreshEventBadge === 'function') {
                                    window.refreshEventBadge();
                                }
                            });
                    };
                    
                    // Refresh immediately - backend will exclude RSVP'd events
                    refreshBadgeNow();
                    
                    // Also call the standard refresh function as a backup after a short delay
                    if (typeof window.refreshEventBadge === 'function') {
                        setTimeout(() => {
                            window.refreshEventBadge();
                        }, 300);
                    }
                } catch (e) {
                    console.error('Error updating event badge:', e);
                }
            } else {
                console.warn('RSVP: No event_id in response:', data);
            }
            
            // Show themed toast notification
            let eventTitle = 'Event';
            if (eventCard) {
                const titleEl = eventCard.querySelector('.event-row-title, .event-title');
                if (titleEl) {
                    // Get text content, removing any icons or badges
                    eventTitle = titleEl.textContent?.trim() || 'Event';
                }
            }
            showThemedToast(status, eventTitle, eventCard);
        } else {
            showToast('Failed to update RSVP. Please try again.', 'error');
        }
    } catch (e) {
        console.error('Failed to RSVP:', e);
        showToast('Failed to update RSVP. Please try again.', 'error');
    }
}

// Get event theme from card
function getEventTheme(eventCard) {
    if (!eventCard) return 'generic';
    
    const themes = ['halloween', 'christmas', 'meeting', 'social', 'announcement', 'maintenance', 'emergency', 'generic'];
    for (const theme of themes) {
        if (eventCard.classList.contains(`theme-${theme}`)) {
            return theme;
        }
    }
    return 'generic';
}

// Show themed toast notification
function showThemedToast(status, eventTitle, eventCard) {
    const theme = getEventTheme(eventCard);
    const isAttending = status === 'attending';
    
    // Theme-based colors, icons, and context-specific messages
    const themeConfig = {
        halloween: {
            attending: { 
                bg: '#f97316', 
                color: '#fff', 
                icon: '🎃',
                message: `Spooky! You're attending "${eventTitle}" 🎃 Get ready for some fun!`
            },
            notAttending: { 
                bg: '#7c2d12', 
                color: '#fecaca', 
                icon: '💀',
                message: `You won't be joining "${eventTitle}". Maybe next time!`
            }
        },
        christmas: {
            attending: { 
                bg: '#dc2626', 
                color: '#fff', 
                icon: '🎄',
                message: `🎅 Ho ho ho! You're attending "${eventTitle}" 🎄 See you there!`
            },
            notAttending: { 
                bg: '#065f46', 
                color: '#ecfdf5', 
                icon: '❄️',
                message: `You won't be attending "${eventTitle}". Maybe next year!`
            }
        },
        meeting: {
            attending: { 
                bg: '#3b82f6', 
                color: '#fff', 
                icon: '👥',
                message: `You've confirmed attendance for "${eventTitle}" 👥 Looking forward to seeing you!`
            },
            notAttending: { 
                bg: '#1e40af', 
                color: '#dbeafe', 
                icon: '📋',
                message: `You've marked as not attending "${eventTitle}". Your RSVP has been updated.`
            }
        },
        social: {
            attending: { 
                bg: '#2563eb', 
                color: '#fff', 
                icon: '🎉',
                message: `Awesome! You're going to "${eventTitle}" 🎉 It's going to be fun!`
            },
            notAttending: { 
                bg: '#7c2d12', 
                color: '#fed7aa', 
                icon: '😔',
                message: `You won't be at "${eventTitle}". We'll miss you!`
            }
        },
        announcement: {
            attending: { 
                bg: '#16a34a', 
                color: '#fff', 
                icon: '📢',
                message: `You've acknowledged "${eventTitle}" 📢 Thank you for staying informed!`
            },
            notAttending: { 
                bg: '#166534', 
                color: '#dcfce7', 
                icon: '📭',
                message: `You've marked as not attending "${eventTitle}". You can update this anytime.`
            }
        },
        maintenance: {
            attending: { 
                bg: '#d97706', 
                color: '#fff', 
                icon: '🔧',
                message: `You've noted "${eventTitle}" 🔧 Thank you for your attention!`
            },
            notAttending: { 
                bg: '#78350f', 
                color: '#fef3c7', 
                icon: '⚠️',
                message: `You've marked as not attending "${eventTitle}". Your RSVP has been updated.`
            }
        },
        emergency: {
            attending: { 
                bg: '#ef4444', 
                color: '#fff', 
                icon: '🚨',
                message: `You've acknowledged "${eventTitle}" 🚨 Stay safe!`
            },
            notAttending: { 
                bg: '#991b1b', 
                color: '#fee2e2', 
                icon: '⏸️',
                message: `You've marked as not attending "${eventTitle}". Please stay informed.`
            }
        },
        generic: {
            attending: { 
                bg: '#3b82f6', 
                color: '#fff', 
                icon: '✅',
                message: `Great! You're going to "${eventTitle}" ✅ See you there!`
            },
            notAttending: { 
                bg: '#6b7280', 
                color: '#f3f4f6', 
                icon: '❌',
                message: `You've marked yourself as not attending "${eventTitle}". You can update this anytime if your plans change.`
            }
        }
    };
    
    const config = themeConfig[theme] || themeConfig.generic;
    const statusConfig = isAttending ? config.attending : config.notAttending;
    
    showToast(statusConfig.message, 'success', statusConfig.bg, statusConfig.color);
}

// Generic toast notification function
function showToast(message, type = 'info', bgColor = null, textColor = null) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.event-toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = 'event-toast';
    toast.textContent = message;
    
    // Set colors based on theme or type
    if (bgColor) {
        toast.style.backgroundColor = bgColor;
    } else {
        switch(type) {
            case 'success':
                toast.style.backgroundColor = '#10b981';
                break;
            case 'error':
                toast.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                toast.style.backgroundColor = '#f59e0b';
                break;
            default:
                toast.style.backgroundColor = '#3b82f6';
        }
    }
    
    toast.style.color = textColor || '#fff';
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Utility function to format dates
function formatEventDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility function to get relative time
function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = date.getTime() - now.getTime();
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) {
        return `${Math.abs(diffInDays)} days ago`;
    } else if (diffInDays === 0) {
        return 'Today';
    } else if (diffInDays === 1) {
        return 'Tomorrow';
    } else {
        return `In ${diffInDays} days`;
    }
}

// Show loading state
function showEventsLoading() {
    const eventsGrid = document.getElementById('events-grid');
    if (eventsGrid) {
        eventsGrid.innerHTML = `
            <div class="events-loading">
                <i class="fas fa-spinner"></i>
                <span>Loading events...</span>
            </div>
        `;
    }
}

// Hide loading state
function hideEventsLoading() {
    const loadingDiv = document.querySelector('.events-loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Show error message
function showEventsError(message) {
    const eventsGrid = document.getElementById('events-grid');
    if (eventsGrid) {
        eventsGrid.innerHTML = `
            <div class="no-events">
                <div class="no-events-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Error Loading Events</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-refresh"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Initialize animations on scroll
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out';
            }
        });
    }, { threshold: 0.1 });
    
    const eventCards = document.querySelectorAll('.event-card');
    eventCards.forEach(card => {
        observer.observe(card);
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
} else {
    initScrollAnimations();
}

// View event details modal
function viewEventDetails(id, title, startDate, location, description, eventType) {
    // Format the date for display
    const eventDate = new Date(startDate);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    // Create modal content
    const modalContent = `
        <div class="event-modal-content">
            <div class="event-modal-header">
                <h2 class="event-modal-title">${title}</h2>
                <div class="event-modal-meta">
                    <div class="event-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="event-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${formattedTime}</span>
                    </div>
                    ${location ? `
                    <div class="event-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${location}</span>
                    </div>
                    ` : ''}
                    <div class="event-meta-item">
                        <i class="fas fa-tag"></i>
                        <span class="event-type-badge">${eventType}</span>
                    </div>
                </div>
            </div>
            <div class="event-modal-body">
                <h3 class="event-modal-section-title">
                    <i class="fas fa-align-left"></i>
                    Description
                </h3>
                <div class="event-modal-description">${description}</div>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'event-details-modal';
    modal.className = 'event-modal-overlay';
    
    modal.innerHTML = `
        <div class="event-modal">
            <div class="event-modal-close" onclick="closeEventModal()">
                <i class="fas fa-times"></i>
            </div>
            ${modalContent}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeEventModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeEventModal();
        }
    });
}

// Close event modal
function closeEventModal() {
    const modal = document.getElementById('event-details-modal');
    if (modal) {
        modal.remove();
    }
}

// Export functions for global use
window.EventsPanel = {
    showEventsLoading,
    hideEventsLoading,
    showEventsError,
    formatEventDate,
    getRelativeTime,
    viewEventDetails,
    closeEventModal
};
// Accordion behavior removed; details are always visible

// Initialize collapsible events for Past Events section
function initCollapsibleEvents() {
    const collapsibleHeaders = document.querySelectorAll('.event-row-collapsible .event-row-toggle');
    
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            // Don't toggle if clicking on buttons or status badge
            if (e.target.closest('button') || 
                e.target.closest('.event-row-status')) {
                return;
            }
            
            // Allow toggle for clicks anywhere else on the header
            const eventRow = this.closest('.event-row-collapsible');
            if (eventRow) {
                eventRow.classList.toggle('expanded');
            }
        });
    });
}

// Image Modal Functionality
function initializeImageModal() {
    const imageModal = document.getElementById('image-modal');
    const imageModalImg = document.getElementById('image-modal-img');
    const imageModalTitle = document.getElementById('image-modal-title');
    const imageModalClose = document.getElementById('image-modal-close');
    const imageModalOverlay = imageModal ? imageModal.querySelector('.image-modal-overlay') : null;
    
    if (!imageModal || !imageModalImg) {
        console.warn('Image modal elements not found');
        return;
    }
    
    // Handle clicks on announcement images
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('announcement-image-clickable')) {
            e.preventDefault();
            e.stopPropagation();
            
            const imageUrl = e.target.getAttribute('data-image-url');
            const imageTitle = e.target.getAttribute('data-image-title');
            
            if (imageUrl) {
                openImageModal(imageUrl, imageTitle);
            }
        }
    });
    
    // Close modal functions
    function openImageModal(imageUrl, imageTitle) {
        imageModalImg.src = imageUrl;
        imageModalImg.alt = imageTitle || 'Announcement Image';
        if (imageModalTitle) {
            imageModalTitle.textContent = imageTitle || '';
        }
        imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeImageModal() {
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Close button
    if (imageModalClose) {
        imageModalClose.addEventListener('click', closeImageModal);
    }
    
    // Close on overlay click
    if (imageModalOverlay) {
        imageModalOverlay.addEventListener('click', closeImageModal);
    }
    
    // Close on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && imageModal.classList.contains('active')) {
            closeImageModal();
        }
    });
}

// Image modal will be initialized in DOMContentLoaded above

// Make functions globally available
window.viewEventDetails = viewEventDetails;
window.closeEventModal = closeEventModal;
window.openImageModal = function(imageUrl, imageTitle) {
    const imageModal = document.getElementById('image-modal');
    const imageModalImg = document.getElementById('image-modal-img');
    const imageModalTitle = document.getElementById('image-modal-title');
    
    if (imageModal && imageModalImg) {
        imageModalImg.src = imageUrl;
        imageModalImg.alt = imageTitle || 'Announcement Image';
        if (imageModalTitle) {
            imageModalTitle.textContent = imageTitle || '';
        }
        imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};