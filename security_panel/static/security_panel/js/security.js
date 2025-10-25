// Security Panel JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize security panel functionality
    initializeSecurityPanel();
});

function initializeSecurityPanel() {
    // Add any global security panel initialization here
    console.log('Security panel initialized');
}

// Load security users for assignment dropdown
function loadSecurityUsers() {
    fetch('/security/api/security-users/')
        .then(response => response.json())
        .then(data => {
            if (data.users) {
                const select = document.getElementById('assigned_to');
                if (select) {
                    // Clear existing options except the first one
                    while (select.children.length > 1) {
                        select.removeChild(select.lastChild);
                    }
                    
                    // Add security users
                    data.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.full_name || user.username;
                        select.appendChild(option);
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading security users:', error);
        });
}

// Update report status
function updateReportStatus(reportId, updateUrl) {
    const form = document.getElementById('report-update-form');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {
        status: formData.get('status'),
        priority: formData.get('priority'),
        security_notes: formData.get('security_notes'),
        assigned_to: formData.get('assigned_to')
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
    .then(response => response.json())
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
        showNotification('Failed to update report', 'error');
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

// Filter reports with debouncing
let filterTimeout;
function setupReportFilters() {
    const searchInput = document.getElementById('search');
    const statusSelect = document.getElementById('status');
    const prioritySelect = document.getElementById('priority');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                applyFilters();
            }, 500);
        });
    }
    
    if (statusSelect) {
        statusSelect.addEventListener('change', applyFilters);
    }
    
    if (prioritySelect) {
        prioritySelect.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const form = document.querySelector('.filters-form');
    if (form) {
        form.submit();
    }
}

// Initialize filters if on dashboard page
if (document.querySelector('.filters-form')) {
    setupReportFilters();
}

// Handle report row clicks for better UX
function setupReportRowClicks() {
    const reportRows = document.querySelectorAll('.report-row');
    reportRows.forEach(row => {
        row.addEventListener('click', function(e) {
            // Don't trigger if clicking on a button or link
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                return;
            }
            
            const reportId = this.dataset.reportId;
            if (reportId) {
                window.location.href = `/security/report/${reportId}/`;
            }
        });
        
        // Add hover effect
        row.style.cursor = 'pointer';
    });
}

// Initialize report row clicks if on dashboard
if (document.querySelector('.reports-table')) {
    setupReportRowClicks();
}

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

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Escape to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('search');
        if (searchInput && searchInput === document.activeElement) {
            searchInput.value = '';
            applyFilters();
        }
    }
});

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
