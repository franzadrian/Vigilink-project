// Security Panel JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize security panel functionality
    initializeSecurityPanel();
    
    // Initialize notification system for Security users only
    if (typeof window.userRole !== 'undefined' && window.userRole === 'security') {
        initializeReportNotifications();
    }
});

function initializeSecurityPanel() {
    // Add any global security panel initialization here
    console.log('Security panel initialized');
}

// Report Notification System - Only for Security Users
let lastCheckedReportId = 0;
let notificationSoundEnabled = true;
let notificationCheckInterval = null;

function initializeReportNotifications() {
    // Initialize last checked report ID from the page
    const reportsTable = document.querySelector('.reports-table tbody');
    if (reportsTable) {
        const firstRow = reportsTable.querySelector('tr');
        if (firstRow) {
            const viewLink = firstRow.querySelector('.btn-view');
            if (viewLink) {
                const href = viewLink.getAttribute('href');
                const match = href.match(/report\/(\d+)\//);
                if (match) {
                    lastCheckedReportId = parseInt(match[1], 10);
                }
            }
        }
    }
    
    // Get initial max report ID if available
    if (typeof window.initialMaxReportId !== 'undefined') {
        lastCheckedReportId = window.initialMaxReportId;
    }
    
    // Get notification sound preference
    if (typeof window.notificationSoundEnabled !== 'undefined') {
        notificationSoundEnabled = window.notificationSoundEnabled;
    }
    
    // Start polling for new reports every 5 seconds
    checkForNewReports();
    notificationCheckInterval = setInterval(checkForNewReports, 5000); // Check every 5 seconds
    
    // Clean up interval when page is hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (notificationCheckInterval) {
                clearInterval(notificationCheckInterval);
                notificationCheckInterval = null;
            }
        } else {
            if (!notificationCheckInterval) {
                checkForNewReports();
                notificationCheckInterval = setInterval(checkForNewReports, 5000);
            }
        }
    });
}

function checkForNewReports() {
    // Only check if on security dashboard page (not on report detail page)
    const path = window.location.pathname;
    if (!path.includes('/security/') || path.includes('/security/report/')) {
        return;
    }
    
    fetch(`/security/api/check-new-reports/?last_check_id=${lastCheckedReportId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.has_new_reports && data.new_reports && data.new_reports.length > 0) {
                // Update notification sound preference
                if (typeof data.notification_sound_enabled !== 'undefined') {
                    notificationSoundEnabled = data.notification_sound_enabled;
                }
                
                // Show notifications for each new report
                data.new_reports.forEach(report => {
                    showReportNotification(report);
                });
                
                // Update last checked ID
                lastCheckedReportId = data.current_max_id;
            }
        })
        .catch(error => {
            console.error('Error checking for new reports:', error);
        });
}

function showReportNotification(report) {
    // Determine notification level based on priority
    let notificationLevel = 'normal'; // Green
    let notificationType = 'normal';
    
    if (report.priority === 'level_3') {
        notificationLevel = 'danger'; // Red
        notificationType = 'danger';
    } else if (report.priority === 'level_2') {
        notificationLevel = 'warning'; // Yellow
        notificationType = 'warning';
    } else {
        notificationLevel = 'normal'; // Green
        notificationType = 'normal';
    }
    
    // Single notification sound for all priority levels
    const soundFile = '/static/security_panel/sounds/security_alert.mp3';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `security-report-notification security-notification-${notificationLevel}`;
    notification.setAttribute('data-report-id', report.id);
    
    // Notification content - Convert level_1 to "Level 1", etc.
    const priorityMap = {
        'level_1': 'Level 1',
        'level_2': 'Level 2',
        'level_3': 'Level 3'
    };
    const priorityLabel = priorityMap[report.priority] || report.priority;
    const reportLink = `/security/report/${report.id}/`;
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fa-solid ${notificationLevel === 'danger' ? 'fa-exclamation-triangle' : notificationLevel === 'warning' ? 'fa-exclamation-circle' : 'fa-bell'}"></i>
            </div>
            <div class="notification-body">
                <div class="notification-title">New ${priorityLabel} Priority Report</div>
                <div class="notification-message">${escapeHtml(report.subject)}</div>
                <div class="notification-meta">
                    From: ${escapeHtml(report.reporter)} | Target: ${escapeHtml(report.target)}
                </div>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
    `;
    
    // Add click handler to navigate to report
    notification.addEventListener('click', function(e) {
        if (!e.target.closest('.notification-close')) {
            window.location.href = reportLink;
        }
    });
    
    // Add to notification container
    let notificationContainer = document.getElementById('security-notifications-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'security-notifications-container';
        document.body.appendChild(notificationContainer);
    }
    
    notificationContainer.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Play sound if enabled (only for Security users)
    if (notificationSoundEnabled) {
        playNotificationSound(soundFile);
    }
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 500);
    }, 8000);
}

function playNotificationSound(soundFile) {
    try {
        const audio = new Audio(soundFile);
        audio.volume = 0.6; // Professional volume level for security alerts
        
        // Handle audio loading errors
        audio.addEventListener('error', function() {
            // If audio file doesn't exist, generate a professional security alert tone
            generateSecurityAlertTone();
        });
        
        // Try to play, but don't fail silently if user hasn't interacted
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Auto-play was prevented, try generating a tone instead
                if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
                    generateSecurityAlertTone();
                } else {
                    console.log('Notification sound auto-play prevented:', error);
                }
            });
        }
    } catch (error) {
        // Fallback to generated tone
        generateSecurityAlertTone();
    }
}

function generateSecurityAlertTone() {
    try {
        // Create audio context for a professional security alert sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const currentTime = audioContext.currentTime;
        
        // Create a more sophisticated security alert: a brief two-tone chime
        // First tone: clear attention-grabbing beep
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        
        // Second tone: slightly higher for emphasis
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        // First tone: 800Hz (clear, professional beep)
        osc1.frequency.value = 800;
        osc1.type = 'sine'; // Clean sine wave for professional sound
        gain1.gain.setValueAtTime(0, currentTime);
        gain1.gain.linearRampToValueAtTime(0.25, currentTime + 0.05); // Quick attack
        gain1.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15); // Quick decay
        osc1.start(currentTime);
        osc1.stop(currentTime + 0.15);
        
        // Second tone: 1000Hz (slightly higher for emphasis), starts after first
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.25, currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);
        osc2.start(currentTime + 0.15);
        osc2.stop(currentTime + 0.3);
        
    } catch (error) {
        console.log('Could not generate security alert tone:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// Update report status
function updateReportStatus(reportId, updateUrl) {
    const form = document.getElementById('report-update-form');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {
        status: formData.get('status'),
        priority: formData.get('priority'),
        security_notes: formData.get('security_notes')
    };
    
    // Remove empty values
    Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === null) {
            delete data[key];
        }
    });
    
    fetch(updateUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.ok) {
            showNotification('Report updated successfully', 'success');
            // Optionally reload the page to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(data.error || 'Failed to update report', 'error');
        }
    })
    .catch(error => {
        console.error('Error updating report:', error);
        if (error.message.includes('403')) {
            showNotification('Access denied. Please check your permissions.', 'error');
        } else if (error.message.includes('401')) {
            showNotification('Please log in again.', 'error');
        } else {
            showNotification('Failed to update report: ' + error.message, 'error');
        }
    });
}

// Get CSRF token
function getCsrfToken() {
    const token = document.querySelector('[name=csrfmiddlewaretoken]');
    if (token) {
        return token.value;
    }
    
    // Fallback: get from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
        return metaToken.getAttribute('content');
    }
    
    return '';
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Auto-submit form when dropdowns change
function setupAutoSubmit() {
    const statusSelect = document.getElementById('status');
    const prioritySelect = document.getElementById('priority');
    
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            this.form.submit();
        });
    }
    
    if (prioritySelect) {
        prioritySelect.addEventListener('change', function() {
            this.form.submit();
        });
    }
}

// Initialize auto-submit if on dashboard page
if (document.querySelector('.filters-form')) {
    setupAutoSubmit();
}

// Report rows are no longer clickable - only the View button is clickable

// Auto-refresh dashboard every 30 seconds
function setupAutoRefresh() {
    if (window.location.pathname.includes('/security/') && !window.location.pathname.includes('/report/')) {
        setInterval(() => {
            // Only refresh if no form is being filled
            const activeElement = document.activeElement;
            if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT')) {
                window.location.reload();
            }
        }, 30000); // 30 seconds
    }
}

// Initialize auto-refresh
setupAutoRefresh();

// Keyboard shortcuts removed - no search functionality

// Add loading states to buttons
function setupLoadingStates() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Updating...';
                submitBtn.disabled = true;
                
                // Re-enable after 3 seconds as fallback
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 3000);
            }
        });
    });
}

// Initialize loading states
setupLoadingStates();
