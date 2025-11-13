// Event Notifications - Real-time badge updates for new events

(function() {
    'use strict';
    
    const BADGE_ID = 'events-unread-badge';
    const STORAGE_KEY = 'events_last_checked_id';
    let lastCheckedEventId = 0;
    let notificationCheckInterval = null;
    
    function getBadge() {
        return document.getElementById(BADGE_ID);
    }
    
    // Get last checked ID from localStorage or initialize
    function getLastCheckedEventId() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored !== null && stored !== '') {
                const parsed = parseInt(stored, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                    return parsed;
                }
            }
        } catch (e) {
            // localStorage might not be available
            console.warn('Error reading from localStorage:', e);
        }
        // Only fallback to window variable if localStorage has no value
        // This ensures RSVP updates take precedence
        if (typeof window.initialMaxEventId !== 'undefined' && window.initialMaxEventId > 0) {
            return window.initialMaxEventId;
        }
        return 0;
    }
    
    // Save last checked ID to localStorage
    function saveLastCheckedEventId(id) {
        try {
            localStorage.setItem(STORAGE_KEY, String(id));
        } catch (e) {
            // localStorage might not be available
        }
    }
    
    // Check if user has notifications enabled
    function isNotificationsEnabled() {
        const badge = getBadge();
        if (badge && badge.hasAttribute('data-notifications-enabled')) {
            return badge.getAttribute('data-notifications-enabled') === 'true';
        }
        if (typeof window.receiveNotificationsEnabled !== 'undefined') {
            return window.receiveNotificationsEnabled;
        }
        // Default to true if not specified (for backward compatibility)
        return true;
    }
    
    function renderBadge(count) {
        const badge = getBadge();
        if (!badge) return;
        
        // Check if user has notifications enabled
        if (!isNotificationsEnabled()) {
            badge.style.display = 'none';
            badge.removeAttribute('data-count');
            return;
        }
        
        if (count > 0) {
            const label = count > 99 ? '99+' : String(count);
            const prev = parseInt(badge.getAttribute('data-count') || '0', 10) || 0;
            const wasHidden = (badge.style.display === 'none' || badge.style.display === '');
            
            badge.textContent = label;
            badge.setAttribute('data-count', String(count));
            badge.style.display = 'inline-flex';
            
            // Animate on appear and on increase
            if (wasHidden) {
                badge.classList.remove('bump');
                void badge.offsetWidth; // reflow
                badge.classList.add('anim-in');
                setTimeout(() => badge.classList.remove('anim-in'), 220);
            } else if (count > prev) {
                badge.classList.remove('anim-in', 'bump');
                void badge.offsetWidth;
                badge.classList.add('bump');
                setTimeout(() => badge.classList.remove('bump'), 260);
            }
        } else {
            badge.style.display = 'none';
            badge.removeAttribute('data-count');
        }
    }
    
    function checkForNewEvents() {
        // Don't check on event detail pages
        if (window.location.pathname.match(/\/events\/\d+\//)) {
            return;
        }
        
        // Note: We don't automatically clear the badge when on events page
        // The badge will only be cleared when:
        // 1. User RSVPs to an event (handled in events.js)
        // 2. User manually views all events (can be added later if needed)
        
        // Check if badge element exists before making request
        const badge = getBadge();
        if (!badge) {
            console.warn('Events badge element not found');
            return;
        }
        
        // Always get the latest value from localStorage to ensure RSVP updates are reflected
        const currentLastCheckedId = getLastCheckedEventId();
        
        fetch(`/events/api/check-new-events/?last_check_id=${currentLastCheckedId}`)
            .then(response => {
                if (!response.ok) {
                    // If 403, it's likely because community profile doesn't exist yet - return empty data silently
                    if (response.status === 403) {
                        console.log('No community access - returning empty events data');
                        return {
                            new_events: [],
                            current_max_id: 0,
                            has_new_events: false,
                            unseen_events_count: 0
                        };
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Badge check response:', {
                    unseen_events_count: data.unseen_events_count,
                    has_new_events: data.has_new_events,
                    new_events_length: data.new_events ? data.new_events.length : 0,
                    last_check_id_used: currentLastCheckedId
                });
                
                // Use unseen_events_count if available (more accurate), otherwise fall back to new_events count
                if (typeof data.unseen_events_count !== 'undefined') {
                    if (data.unseen_events_count > 0) {
                        // Show badge with total count of unseen events
                        renderBadge(data.unseen_events_count > 99 ? 99 : data.unseen_events_count);
                    } else {
                        // No unseen events - hide badge
                        renderBadge(0);
                    }
                } else if (data.has_new_events && data.new_events && data.new_events.length > 0) {
                    // Fallback: use new events count if unseen_events_count not available
                    renderBadge(data.new_events.length);
                } else {
                    // No unseen events - hide badge
                    renderBadge(0);
                }
            })
            .catch(error => {
                console.error('Error checking for new events:', error);
                // Don't hide badge on error - keep current state
            });
    }
    
    function initializeEventNotifications() {
        // Check if badge element exists
        const badge = getBadge();
        if (!badge) {
            console.warn('Events badge element not found, notifications disabled');
            return;
        }
        
        // Initialize last checked event ID from localStorage
        // Always load from localStorage to ensure RSVP updates persist across pages
        lastCheckedEventId = getLastCheckedEventId();
        
        // Start polling for new events every 10 seconds
        // Check immediately on load
        checkForNewEvents();
        notificationCheckInterval = setInterval(checkForNewEvents, 10000); // Check every 10 seconds
        
        // Clean up interval when page is hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                if (notificationCheckInterval) {
                    clearInterval(notificationCheckInterval);
                    notificationCheckInterval = null;
                }
            } else {
                if (!notificationCheckInterval) {
                    checkForNewEvents();
                    notificationCheckInterval = setInterval(checkForNewEvents, 10000);
                }
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEventNotifications);
    } else {
        // DOM already loaded, initialize immediately
        initializeEventNotifications();
    }
    
    // Expose helper functions globally for RSVP handler
    window.getLastCheckedEventId = getLastCheckedEventId;
    window.checkForNewEvents = checkForNewEvents;
    
    // Expose function to refresh badge (can be called from settings page or after RSVP)
    window.refreshEventBadge = function() {
        const badge = getBadge();
        if (badge) {
            // Update the data attribute if notifications setting changed
            if (typeof window.receiveNotificationsEnabled !== 'undefined') {
                badge.setAttribute('data-notifications-enabled', window.receiveNotificationsEnabled ? 'true' : 'false');
            }
            // Force reload lastCheckedEventId from localStorage in case it was updated (e.g., after RSVP)
            const updatedId = getLastCheckedEventId();
            lastCheckedEventId = updatedId;
            console.log('refreshEventBadge: Reloaded lastCheckedEventId from localStorage:', updatedId);
            // Re-check for new events immediately
            // This will use the updated lastCheckedEventId from localStorage
            checkForNewEvents();
        } else {
            console.warn('refreshEventBadge: Badge element not found');
        }
    };
})();

