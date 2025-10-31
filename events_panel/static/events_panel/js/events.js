// Events Panel JavaScript - Simplified for viewing only

document.addEventListener('DOMContentLoaded', function() {
    // Initialize events functionality
    initEventCards();
    applyEventThemes();
    initRsvpButtons();
    initCollapsibleEvents();
});

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
    document.querySelectorAll('.event-card').forEach(card => {
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
                    await submitRsvp(card.getAttribute('data-event-id'), status, buttons);
                });
            });
        }
        // CTA button triggers attending RSVP
        const cta = card.querySelector('.event-rsvp-cta');
        if (cta) {
            cta.addEventListener('click', async (e) => {
                e.stopPropagation();
                const status = 'attending';
                await submitRsvp(card.getAttribute('data-event-id'), status, buttons);
                // Reflect active state if RSVP group exists
                if (buttons && buttons.length) {
                    buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-status') === status));
                }
            });
        }
    });
}

async function submitRsvp(eventId, status, buttons) {
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
        }
    } catch (e) {
        console.error('Failed to RSVP:', e);
    }
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

// Make functions globally available
window.viewEventDetails = viewEventDetails;
window.closeEventModal = closeEventModal;