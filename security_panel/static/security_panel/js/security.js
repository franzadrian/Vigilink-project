// Security Panel JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize security panel functionality
    initializeSecurityPanel();
    
    // Initialize notification system for Security users only
    if (typeof window.userRole !== 'undefined' && window.userRole === 'security') {
        initializeReportNotifications();
        
        // Ensure audio context is ready when returning to dashboard
        // This helps when user clicks "Back" button from report detail page
        if (notificationSoundEnabled) {
            // Check if audio context was created on another page (like report detail)
            if (typeof window.globalAudioContext !== 'undefined' && window.globalAudioContext && window.globalAudioContext.state !== 'closed') {
                globalAudioContext = window.globalAudioContext;
                console.log('Using audio context from window object, state:', globalAudioContext.state);
            }
            
            // Try to resume audio context immediately on page load
            // This works if audio was previously unlocked (especially from Back button click)
            const audioUnlocked = localStorage.getItem('security_audio_unlocked') === 'true';
            const unlockTime = localStorage.getItem('security_audio_unlocked_time');
            // Check if unlock was recent (within last 5 seconds) - indicates Back button was just clicked
            const isRecentUnlock = unlockTime && (Date.now() - parseInt(unlockTime, 10)) < 5000;
            
            if (audioUnlocked || isRecentUnlock) {
                if (!globalAudioContext || globalAudioContext.state === 'closed') {
                    // Create new context if needed
                    try {
                        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                        window.globalAudioContext = globalAudioContext;
                        console.log('Created new audio context on dashboard load');
                    } catch (e) {
                        console.log('Could not create audio context:', e);
                    }
                }
                
                if (globalAudioContext) {
                    if (globalAudioContext.state === 'suspended') {
                        // Try to resume - this should work if Back button was just clicked
                        globalAudioContext.resume().then(() => {
                            console.log('Audio context resumed on dashboard load, state:', globalAudioContext.state);
                            localStorage.setItem('security_audio_unlocked', 'true');
                        }).catch(err => {
                            console.log('Could not resume audio context on load:', err);
                        });
                    } else if (globalAudioContext.state === 'running') {
                        console.log('Audio context already running on dashboard load');
                        localStorage.setItem('security_audio_unlocked', 'true');
                    }
                }
            }
        }
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
let activeNotifications = new Map(); // Track active notifications and their audio
let activeAudioElements = new Map(); // Track audio elements for each report
let globalAudioContextResumed = false; // Track if we've resumed audio context globally
let globalAudioContext = null; // Global audio context that's unlocked and ready to use
let notificationQueue = []; // Queue for pending notifications (priority-based)
let isShowingNotification = false; // Track if a notification modal is currently visible
let viewedReportIds = new Set(); // Track which reports have been viewed/dismissed
let currentPlayingSoundReportId = null; // Track which report's sound is currently playing (only one at a time)
let globalSoundInterval = null; // Single global interval for playing sound (only one active at a time)

// Resume all audio contexts on any user interaction (handles browser autoplay restrictions)
function resumeAllAudioContexts() {
    // Create global audio context if it doesn't exist yet
    if (!globalAudioContext || globalAudioContext.state === 'closed') {
        try {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Expose to window for access from other pages
            window.globalAudioContext = globalAudioContext;
            console.log('Created global audio context on user interaction');
        } catch (e) {
            console.log('Could not create audio context:', e);
            return;
        }
    }
    
    // Resume global audio context if it exists and is suspended
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
            console.log('Global audio context resumed on user interaction');
            globalAudioContextResumed = true;
            localStorage.setItem('security_audio_unlocked', 'true');
            
            // Don't restart sound if it's already playing - this prevents volume increase
            // The sound should already be playing via the interval, we just needed to resume the context
            if (currentPlayingSoundReportId && globalSoundInterval) {
                console.log('Audio context resumed, sound already playing for:', currentPlayingSoundReportId);
            }
        }).catch(err => {
            console.log('Could not resume global audio context:', err);
        });
    } else if (globalAudioContext && globalAudioContext.state === 'running') {
        // Already running - don't restart sound if it's already playing
        // This prevents volume increase from multiple sound instances
        if (currentPlayingSoundReportId && globalSoundInterval) {
            console.log('Audio context already running, sound already playing for:', currentPlayingSoundReportId);
        }
    }
    
    // Also resume any active audio contexts
    activeAudioElements.forEach((value, key) => {
        if (key.endsWith('_context')) {
            const audioContext = value;
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('Audio context resumed globally');
                    globalAudioContextResumed = true;
                }).catch(err => {
                    console.log('Could not resume audio context:', err);
                });
            }
        }
    });
}

// Set up global user interaction listeners to resume audio contexts
// Use capture phase and don't use 'once' so we can resume on every interaction
const interactionEvents = ['click', 'keydown', 'keypress', 'touchstart', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'scroll'];
interactionEvents.forEach(eventType => {
    document.addEventListener(eventType, resumeAllAudioContexts, { passive: true, capture: true });
});
window.addEventListener('click', resumeAllAudioContexts, { passive: true, capture: true });
window.addEventListener('keydown', resumeAllAudioContexts, { passive: true, capture: true });

function initializeReportNotifications() {
    // Load viewed report IDs from localStorage first
    try {
        const stored = localStorage.getItem('security_viewed_reports');
        if (stored) {
            viewedReportIds = new Set(JSON.parse(stored));
        }
    } catch (e) {
        console.log('Could not load viewed reports from localStorage:', e);
    }
    
    // Load lastCheckedReportId from localStorage (persists across page loads)
    // This should only be updated when reports are actually viewed/dismissed, not from page content
    try {
        const storedLastCheckId = localStorage.getItem('security_last_checked_report_id');
        if (storedLastCheckId) {
            const parsedId = parseInt(storedLastCheckId, 10);
            if (!isNaN(parsedId)) {
                lastCheckedReportId = parsedId;
                console.log('Loaded lastCheckedReportId from localStorage:', lastCheckedReportId);
            }
        }
    } catch (e) {
        console.log('Could not load lastCheckedReportId from localStorage:', e);
    }
    
    // If we don't have a stored value, initialize to 0 or server's max - 1
    // This ensures we check for all reports, including ones currently visible on the page
    if (lastCheckedReportId === 0) {
        if (typeof window.initialMaxReportId !== 'undefined' && window.initialMaxReportId > 0) {
            // Set to max - 1 so we'll check for the current max report too
            lastCheckedReportId = window.initialMaxReportId - 1;
            console.log('Initialized lastCheckedReportId to', lastCheckedReportId, '(server max - 1)');
        } else {
            // Set to 0 to check for all reports
            lastCheckedReportId = 0;
            console.log('Initialized lastCheckedReportId to 0 (will check all reports)');
        }
    }
    
    // Check visible reports on the page and add unviewed ones to the notification queue
    // This handles the case where a report is visible on the page but hasn't been viewed
    const reportsTable = document.querySelector('.reports-table tbody');
    if (reportsTable) {
        const rows = reportsTable.querySelectorAll('tr');
        rows.forEach(row => {
            const viewLink = row.querySelector('.btn-view');
            if (viewLink) {
                const href = viewLink.getAttribute('href');
                const match = href.match(/report\/(\d+)\//);
                if (match) {
                    const reportId = parseInt(match[1], 10);
                    // If this report hasn't been viewed and isn't already in the queue, add it
                    if (!viewedReportIds.has(reportId)) {
                        const isInQueue = notificationQueue.some(r => r.id === reportId);
                        const isActive = activeNotifications.has(reportId);
                        if (!isInQueue && !isActive) {
                            // Extract report info from the table row
                            const reporterCell = row.querySelector('.report-reporter .reporter-name');
                            const subjectCell = row.querySelector('.report-subject .subject-text');
                            const targetCell = row.querySelector('.report-target .target-name, .report-target .target-badge');
                            const statusCell = row.querySelector('.report-status .status-badge');
                            const priorityCell = row.querySelector('.report-priority .priority-badge');
                            const dateCell = row.querySelector('.report-date');
                            
                            // Get priority from the badge class or text
                            let priority = 'level_2'; // default
                            if (priorityCell) {
                                const priorityClass = priorityCell.className;
                                if (priorityClass.includes('priority-level_3')) priority = 'level_3';
                                else if (priorityClass.includes('priority-level_1')) priority = 'level_1';
                            }
                            
                            const reportData = {
                                id: reportId,
                                priority: priority,
                                status: statusCell ? statusCell.textContent.trim().toLowerCase().replace(/\s+/g, '_') : 'pending',
                                subject: subjectCell ? subjectCell.textContent.trim() : 'Report',
                                reporter: reporterCell ? reporterCell.textContent.trim() : 'Unknown',
                                target: targetCell ? targetCell.textContent.trim() : 'Unknown',
                                created_at: dateCell ? dateCell.textContent.trim() : new Date().toISOString(),
                            };
                            
                            notificationQueue.push(reportData);
                            console.log('Added visible unviewed report', reportId, 'to notification queue');
                        }
                    }
                }
            }
        });
        
        // Sort queue by priority
        if (notificationQueue.length > 0) {
            notificationQueue.sort((a, b) => {
                const priorityOrder = { 'level_3': 3, 'level_2': 2, 'level_1': 1 };
                const aPriority = priorityOrder[a.priority] || 0;
                const bPriority = priorityOrder[b.priority] || 0;
                return bPriority - aPriority;
            });
            saveNotificationQueue();
        }
    }
    
    // Load notification queue from localStorage (persist across page reloads)
    try {
        const storedQueue = localStorage.getItem('security_notification_queue');
        if (storedQueue) {
            const parsedQueue = JSON.parse(storedQueue);
            // Filter out reports that have been viewed
            notificationQueue = parsedQueue.filter(report => !viewedReportIds.has(report.id));
            // Re-sort by priority
            notificationQueue.sort((a, b) => {
                const priorityOrder = { 'level_3': 3, 'level_2': 2, 'level_1': 1 };
                const aPriority = priorityOrder[a.priority] || 0;
                const bPriority = priorityOrder[b.priority] || 0;
                return bPriority - aPriority;
            });
            // Save filtered queue back
            saveNotificationQueue();
        }
    } catch (e) {
        console.log('Could not load notification queue from localStorage:', e);
    }
    
    // Get notification sound preference
    if (typeof window.notificationSoundEnabled !== 'undefined') {
        notificationSoundEnabled = window.notificationSoundEnabled;
    }
    
    // Function to initialize the global audio context
    function initializeGlobalAudioContext() {
        return new Promise((resolve, reject) => {
            try {
                // Create new context if needed or if old one is closed
                if (!globalAudioContext || globalAudioContext.state === 'closed') {
                    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                // Always try to resume - this is the key to unlocking audio
                if (globalAudioContext.state === 'suspended') {
                    globalAudioContext.resume().then(() => {
                        // Verify it's actually running
                        if (globalAudioContext.state === 'running') {
                            // Prime the audio context by playing a silent sound
                            // This helps ensure future sounds will play
                            try {
                                const osc = globalAudioContext.createOscillator();
                                const gain = globalAudioContext.createGain();
                                gain.gain.value = 0; // Silent
                                osc.connect(gain);
                                gain.connect(globalAudioContext.destination);
                                osc.start();
                                osc.stop(globalAudioContext.currentTime + 0.001);
                            } catch (e) {
                                // Ignore priming errors
                            }
                            
                            localStorage.setItem('security_audio_unlocked', 'true');
                            console.log('Global audio context unlocked and ready');
                            resolve(globalAudioContext);
                        } else {
                            console.log('Audio context state after resume:', globalAudioContext.state);
                            reject(new Error('Audio context not running after resume'));
                        }
                    }).catch(err => {
                        console.log('Could not unlock global audio context:', err);
                        reject(err);
                    });
                } else if (globalAudioContext.state === 'running') {
                    localStorage.setItem('security_audio_unlocked', 'true');
                    console.log('Global audio context already running');
                    resolve(globalAudioContext);
                } else {
                    console.log('Audio context in unexpected state:', globalAudioContext.state);
                    reject(new Error('Audio context in unexpected state: ' + globalAudioContext.state));
                }
            } catch (e) {
                console.log('Could not initialize global audio context:', e);
                reject(e);
            }
        });
    }
    
    // Expose function globally for use in settings page and report detail page
    window.initializeGlobalAudioContext = initializeGlobalAudioContext;
    window.resumeAllAudioContexts = resumeAllAudioContexts;
    
    // If notification sounds are enabled, set up audio context initialization
    // Try to unlock audio context as early as possible
    if (notificationSoundEnabled) {
        // Check if audio was previously unlocked via settings page
        const audioUnlocked = localStorage.getItem('security_audio_unlocked') === 'true';
        
        // Always create the global audio context immediately so it's ready
        // It will start in 'suspended' state, but will be resumed on first user interaction
        if (!globalAudioContext || globalAudioContext.state === 'closed') {
            try {
                globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                // Expose to window for access from other pages
                window.globalAudioContext = globalAudioContext;
                console.log('Global audio context created, state:', globalAudioContext.state);
            } catch (e) {
                console.log('Could not create audio context:', e);
            }
        } else {
            // Expose existing context to window
            window.globalAudioContext = globalAudioContext;
        }
        
        // If audio was previously unlocked, try to resume immediately (might work if page was opened from user click)
        if (audioUnlocked && globalAudioContext) {
            console.log('Audio was previously unlocked, attempting to resume audio context');
            if (globalAudioContext.state === 'suspended') {
                globalAudioContext.resume().then(() => {
                    if (globalAudioContext.state === 'running') {
                        console.log('Global audio context resumed and ready for immediate playback');
                    } else {
                        console.log('Audio context state after resume attempt:', globalAudioContext.state);
                    }
                }).catch((err) => {
                    console.log('Could not resume audio context on page load (will resume on user interaction):', err);
                });
            } else if (globalAudioContext.state === 'running') {
                console.log('Global audio context already running');
            }
        }
        
        // Set up listeners to unlock audio on ANY user interaction
        // Use a more aggressive approach - listen to multiple events
        let audioUnlockedByInteraction = false;
        const unlockOnInteraction = function(e) {
            // Check if already unlocked and running
            if (audioUnlockedByInteraction && globalAudioContext && globalAudioContext.state === 'running') {
                return; // Already unlocked and running
            }
            
            // Try to unlock the audio context
            initializeGlobalAudioContext().then(() => {
                // Verify it's actually running
                if (globalAudioContext && globalAudioContext.state === 'running') {
                    audioUnlockedByInteraction = true;
                    console.log('Audio context successfully unlocked on user interaction:', e.type);
                } else {
                    console.log('Audio context not running after unlock attempt, state:', globalAudioContext ? globalAudioContext.state : 'null');
                }
            }).catch(err => {
                console.log('Failed to unlock audio context on', e.type, ':', err);
            });
        };
        
        // Listen for ALL possible user interactions to unlock audio as early as possible
        // Use capture phase and don't use 'once: true' so we can retry if it fails
        const interactionEvents = ['click', 'keydown', 'keypress', 'touchstart', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
        interactionEvents.forEach(eventType => {
            // Use capture phase to catch events earlier
            document.addEventListener(eventType, unlockOnInteraction, { passive: true, capture: true });
        });
        
        // Also listen on window for broader coverage
        window.addEventListener('click', unlockOnInteraction, { passive: true, capture: true });
        window.addEventListener('keydown', unlockOnInteraction, { passive: true, capture: true });
        
        // Also try to unlock when window gains focus (user might have clicked elsewhere)
        window.addEventListener('focus', function() {
            if (globalAudioContext && globalAudioContext.state === 'suspended') {
                globalAudioContext.resume().then(() => {
                    localStorage.setItem('security_audio_unlocked', 'true');
                    console.log('Audio context unlocked on window focus');
                }).catch(() => {});
            }
        }, { once: true });
    }
    
    // Start polling for new reports every 5 seconds
    // Use a function that will check for new reports and process queue
    const checkAndProcessReports = () => {
        checkForNewReports();
        // Also check queue after a short delay to ensure API response is processed
        setTimeout(() => {
            if (notificationQueue.length > 0 && !isShowingNotification) {
                processNotificationQueue();
            }
        }, 1000);
    };
    
    // Check immediately on page load
    checkAndProcessReports();
    notificationCheckInterval = setInterval(checkAndProcessReports, 5000); // Check every 5 seconds
    
    // Process queued reports multiple times to ensure they're shown
    // This handles cases where user navigates from another page
    const processQueueMultipleTimes = () => {
        if (notificationQueue.length > 0 && !isShowingNotification) {
            console.log('Processing notification queue on page load, queue length:', notificationQueue.length);
            processNotificationQueue();
        }
    };
    
    // Try processing queue at different intervals to catch all scenarios
    // This is especially important when user navigates back from report detail page
    setTimeout(processQueueMultipleTimes, 500);   // After 500ms
    setTimeout(processQueueMultipleTimes, 1500);  // After 1.5s (after API response)
    setTimeout(processQueueMultipleTimes, 2500);  // After 2.5s (backup)
    setTimeout(processQueueMultipleTimes, 3500);  // After 3.5s (additional backup for page navigation)
    
    // Clean up interval when page is hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (notificationCheckInterval) {
                clearInterval(notificationCheckInterval);
                notificationCheckInterval = null;
            }
        } else {
            // Page became visible - check for new reports and process queue
            if (!notificationCheckInterval) {
                checkAndProcessReports();
                notificationCheckInterval = setInterval(checkAndProcessReports, 5000);
            } else {
                // Already has interval, but still check immediately when page becomes visible
                checkAndProcessReports();
            }
        }
    });
}

function checkForNewReports() {
    // Only check if on security dashboard page (not on report detail page)
    const path = window.location.pathname;
    if (!path.includes('/security/') || path.includes('/security/report/')) {
        // If on report detail page, stop all notification sounds but preserve queue
        // This way, when user comes back, queued reports will still be shown
        activeAudioElements.forEach((audio, reportId) => {
            stopNotificationSound(reportId);
        });
        // Don't clear the queue - preserve it for when user comes back
        // Just mark that we're not showing a notification anymore
        isShowingNotification = false;
        return;
    }
    
    // When on dashboard, ensure we process any queued notifications
    // This handles the case when user navigates back from report detail page
    if (notificationQueue.length > 0 && !isShowingNotification) {
        console.log('Found queued notifications on dashboard, processing...');
        // Process queue after a short delay to ensure page is fully loaded
        setTimeout(() => {
            if (notificationQueue.length > 0 && !isShowingNotification) {
                processNotificationQueue();
            }
        }, 100);
    }
    
    fetch(`/security/api/check-new-reports/?last_check_id=${lastCheckedReportId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Update notification sound preference
            if (typeof data.notification_sound_enabled !== 'undefined') {
                notificationSoundEnabled = data.notification_sound_enabled;
            }
            
            // Update lastCheckedReportId using current_max_id from server
            // But only update it AFTER we've processed the new reports
            // This ensures we don't miss reports when returning to the dashboard
            let newMaxId = lastCheckedReportId;
            if (typeof data.current_max_id !== 'undefined' && data.current_max_id > lastCheckedReportId) {
                newMaxId = data.current_max_id;
            }
            
            // Only update lastCheckedReportId if we've processed all new reports
            // This way, if there are reports we haven't seen, they'll still be detected
            if (data.has_new_reports && data.new_reports && data.new_reports.length > 0) {
                // Find the highest ID among new reports that were actually added to queue
                const addedReports = data.new_reports.filter(report => {
                    const isInQueue = notificationQueue.some(r => r.id === report.id);
                    const isActive = activeNotifications.has(report.id);
                    const isViewed = viewedReportIds.has(report.id);
                    return !isInQueue && !isActive && !isViewed;
                });
                if (addedReports.length > 0) {
                    const maxNewId = Math.max(...addedReports.map(r => r.id));
                    if (maxNewId > lastCheckedReportId) {
                        newMaxId = maxNewId;
                    }
                }
            }
            
            // Update lastCheckedReportId and save to localStorage
            if (newMaxId > lastCheckedReportId) {
                console.log('Updating lastCheckedReportId from', lastCheckedReportId, 'to', newMaxId);
                lastCheckedReportId = newMaxId;
                try {
                    localStorage.setItem('security_last_checked_report_id', lastCheckedReportId.toString());
                } catch (e) {
                    console.log('Could not save lastCheckedReportId to localStorage:', e);
                }
            }
            
            if (data.has_new_reports && data.new_reports && data.new_reports.length > 0) {
                console.log('Found', data.new_reports.length, 'new reports');
                // Add new reports to queue (avoid duplicates and already viewed reports)
                data.new_reports.forEach(report => {
                    // Check if report is already in queue, already shown, or already viewed
                    const isInQueue = notificationQueue.some(r => r.id === report.id);
                    const isActive = activeNotifications.has(report.id);
                    const isViewed = viewedReportIds.has(report.id);
                    
                    if (!isInQueue && !isActive && !isViewed) {
                        console.log('Adding report', report.id, 'to notification queue');
                        notificationQueue.push(report);
                    } else {
                        console.log('Skipping report', report.id, '- already in queue/active/viewed');
                    }
                });
                
                // Save queue to localStorage
                saveNotificationQueue();
                
                // Sort queue by priority: Level 3 > Level 2 > Level 1
                notificationQueue.sort((a, b) => {
                    const priorityOrder = { 'level_3': 3, 'level_2': 2, 'level_1': 1 };
                    const aPriority = priorityOrder[a.priority] || 0;
                    const bPriority = priorityOrder[b.priority] || 0;
                    return bPriority - aPriority; // Higher priority first
                });
                
                // Save sorted queue to localStorage
                saveNotificationQueue();
                
                // If a notification is already showing, update its queue count
                if (isShowingNotification) {
                    updateNotificationQueueCount();
                }
            } else {
                console.log('No new reports found (lastCheckedReportId:', lastCheckedReportId + ')');
            }
            
            // Always check if we have queued reports to process
            // This handles all scenarios: new reports, existing queue, or coming from another page
            if (notificationQueue.length > 0 && !isShowingNotification) {
                console.log('Processing notification queue,', notificationQueue.length, 'reports waiting');
                // Process queue immediately
                processNotificationQueue();
            } else if (notificationQueue.length > 0 && isShowingNotification) {
                // Update the count in the currently displayed notification
                updateNotificationQueueCount();
            }
        })
        .catch(error => {
            console.error('Error checking for new reports:', error);
        });
}

// Save notification queue to localStorage
function saveNotificationQueue() {
    try {
        localStorage.setItem('security_notification_queue', JSON.stringify(notificationQueue));
    } catch (e) {
        console.log('Could not save notification queue to localStorage:', e);
    }
}

// Save viewed report IDs to localStorage
function saveViewedReportIds() {
    try {
        localStorage.setItem('security_viewed_reports', JSON.stringify(Array.from(viewedReportIds)));
    } catch (e) {
        console.log('Could not save viewed reports to localStorage:', e);
    }
}

// Update the "more reports waiting" message in the currently displayed notification
function updateNotificationQueueCount() {
    if (!isShowingNotification) {
        return;
    }
    
    // Find the currently active notification (should only be one at a time)
    const activeNotification = Array.from(activeNotifications.values())[0];
    if (!activeNotification) {
        return;
    }
    
    const remainingInQueue = notificationQueue.length;
    const queueInfoDiv = activeNotification.querySelector('.notification-queue-info');
    
    if (queueInfoDiv) {
        if (remainingInQueue > 0) {
            // Preserve the yellow styling when updating
            queueInfoDiv.style.marginTop = '12px';
            queueInfoDiv.style.padding = '8px';
            queueInfoDiv.style.background = '#fef3c7';
            queueInfoDiv.style.borderRadius = '6px';
            queueInfoDiv.style.fontSize = '0.875rem';
            queueInfoDiv.style.color = '#92400e';
            queueInfoDiv.style.display = 'block';
            queueInfoDiv.innerHTML = `
                <i class="fa-solid fa-info-circle" style="margin-right: 6px;"></i>
                ${remainingInQueue} more report${remainingInQueue > 1 ? 's' : ''} waiting
            `;
        } else {
            queueInfoDiv.style.display = 'none';
        }
    }
    
    // Also update the title if it shows total count
    const titleDiv = activeNotification.querySelector('.notification-modal-title');
    if (titleDiv) {
        // Extract priority from the current title
        const priorityMatch = titleDiv.textContent.match(/New (Level \d) Priority Report/);
        if (priorityMatch) {
            const priorityLabel = priorityMatch[1];
            titleDiv.textContent = `New ${priorityLabel} Priority Report`;
        }
    }
}

// Process the notification queue - show the next notification if available
function processNotificationQueue() {
    // If already showing a notification, update its queue count instead of showing a new one
    if (isShowingNotification) {
        updateNotificationQueueCount();
        return;
    }
    
    // If queue is empty, nothing to show
    if (notificationQueue.length === 0) {
        return;
    }
    
    // Get the next report from queue (already sorted by priority)
    const report = notificationQueue.shift();
    
    // Get queue length before showing (for display purposes)
    const remainingInQueue = notificationQueue.length;
    
    // Show the notification
    showReportNotification(report, remainingInQueue);
}

function showReportNotification(report, remainingInQueue = 0) {
    // Don't show duplicate notifications for the same report
    if (activeNotifications.has(report.id)) {
        return;
    }
    
    // Mark that we're showing a notification
    isShowingNotification = true;
    
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
    
    // Create centered modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'security-notification-overlay';
    overlay.setAttribute('data-report-id', report.id);
    
    // Notification content - Convert level_1 to "Level 1", etc.
    const priorityMap = {
        'level_1': 'Level 1',
        'level_2': 'Level 2',
        'level_3': 'Level 3'
    };
    const priorityLabel = priorityMap[report.priority] || report.priority;
    const reportLink = `/security/report/${report.id}/`;
    
    overlay.innerHTML = `
        <div class="security-notification-modal security-notification-${notificationLevel}">
            <div class="notification-modal-content">
                <div class="notification-modal-icon">
                    <i class="fa-solid ${notificationLevel === 'danger' ? 'fa-exclamation-triangle' : notificationLevel === 'warning' ? 'fa-exclamation-circle' : 'fa-bell'}"></i>
                </div>
                <div class="notification-modal-body">
                    <div class="notification-modal-title">New ${priorityLabel} Priority Report</div>
                    <div class="notification-modal-message">${escapeHtml(report.subject)}</div>
                    <div class="notification-modal-meta">
                        <div><strong>From:</strong> ${escapeHtml(report.reporter)}</div>
                        <div><strong>Target:</strong> ${escapeHtml(report.target)}</div>
                    </div>
                    ${remainingInQueue > 0 ? `<div class="notification-queue-info" style="margin-top: 12px; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 0.875rem; color: #92400e;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 6px;"></i>
                        ${remainingInQueue} more report${remainingInQueue > 1 ? 's' : ''} waiting
                    </div>` : '<div class="notification-queue-info" style="display: none;"></div>'}
                </div>
                <div class="notification-modal-actions">
                    <button class="notification-btn-view" data-report-link="${reportLink}">
                        <i class="fa-solid fa-eye"></i>
                        View Report
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to document body
    document.body.appendChild(overlay);
    
    // Mark as active
    activeNotifications.set(report.id, overlay);
    
    // Play continuous sound if enabled
    if (notificationSoundEnabled) {
        console.log('Notification sound is enabled, attempting to play for report:', report.id);
        
        // Helper function to set up sound listener on modal (backup if immediate play fails)
        // Only needed if sound hasn't started yet
        const setupModalSoundListener = () => {
            // Check if sound is already playing for this report
            if (currentPlayingSoundReportId === report.id && globalSoundInterval) {
                console.log('Sound already playing for report', report.id, '- skipping modal listener setup');
                return;
            }
            
            console.log('Setting up modal sound listener for report:', report.id);
            let soundStarted = false;
            const startSoundOnInteraction = function(e) {
                // Don't restart if sound is already playing
                if (currentPlayingSoundReportId === report.id && globalSoundInterval) {
                    console.log('Sound already playing, not restarting');
                    return;
                }
                
                if (soundStarted) return; // Already started
                
                // Resume global audio context first
                resumeAllAudioContexts();
                
                console.log('User interacted with modal, attempting to unlock and play sound');
                // Ensure global audio context is resumed
                if (globalAudioContext && globalAudioContext.state === 'suspended') {
                    globalAudioContext.resume().then(() => {
                        if (globalAudioContext.state === 'running' && currentPlayingSoundReportId !== report.id) {
                            soundStarted = true;
                            console.log('Audio context resumed from modal interaction, playing sound');
                            startGlobalNotificationSound(report.id);
                            // Remove listeners after successful unlock
                            overlay.removeEventListener('click', startSoundOnInteraction);
                            overlay.removeEventListener('mousedown', startSoundOnInteraction);
                            overlay.removeEventListener('touchstart', startSoundOnInteraction);
                        }
                    }).catch((err) => {
                        console.log('Failed to resume audio context from modal interaction:', err);
                    });
                } else if (globalAudioContext && globalAudioContext.state === 'running') {
                    if (currentPlayingSoundReportId !== report.id) {
                        soundStarted = true;
                        console.log('Audio context already running, playing sound from modal interaction');
                        startGlobalNotificationSound(report.id);
                        // Remove listeners after successful start
                        overlay.removeEventListener('click', startSoundOnInteraction);
                        overlay.removeEventListener('mousedown', startSoundOnInteraction);
                        overlay.removeEventListener('touchstart', startSoundOnInteraction);
                    }
                } else {
                    // Try to initialize
                    initializeGlobalAudioContext().then(() => {
                        if (globalAudioContext && globalAudioContext.state === 'running' && currentPlayingSoundReportId !== report.id) {
                            soundStarted = true;
                            console.log('Audio context unlocked from modal interaction, playing sound');
                            startGlobalNotificationSound(report.id);
                            // Remove listeners after successful unlock
                            overlay.removeEventListener('click', startSoundOnInteraction);
                            overlay.removeEventListener('mousedown', startSoundOnInteraction);
                            overlay.removeEventListener('touchstart', startSoundOnInteraction);
                        }
                    }).catch((err) => {
                        console.log('Failed to unlock audio context from modal interaction:', err);
                    });
                }
            };
            // Listen for multiple interaction types on the modal - use capture to catch early
            overlay.addEventListener('click', startSoundOnInteraction, { capture: true });
            overlay.addEventListener('mousedown', startSoundOnInteraction, { capture: true });
            overlay.addEventListener('touchstart', startSoundOnInteraction, { capture: true });
        };
        
        // Set up modal listeners as backup (only if sound hasn't started)
        setupModalSoundListener();
        
        // Try to play sound immediately - be aggressive about it
        const tryPlayImmediately = () => {
            // Ensure we have an audio context
            if (!globalAudioContext || globalAudioContext.state === 'closed') {
                // Create it if it doesn't exist
                try {
                    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('Created new audio context, state:', globalAudioContext.state);
                } catch (e) {
                    console.log('Could not create audio context:', e);
                    return;
                }
            }
            
            // Check the current state
            if (globalAudioContext.state === 'running') {
                // AudioContext is already running (user has interacted with page), play immediately!
                console.log('Audio context is running, playing sound immediately');
                startGlobalNotificationSound(report.id);
            } else if (globalAudioContext.state === 'suspended') {
                // AudioContext is suspended - we can't resume it without a user gesture
                // But we can try to play anyway - sometimes it works if the context was recently active
                console.log('Audio context is suspended, attempting to play anyway (may require user interaction)');
                try {
                    startGlobalNotificationSound(report.id);
                } catch (e) {
                    console.log('Could not play sound - AudioContext requires user interaction to resume:', e);
                    // The sound will play once the user interacts with the page/modal
                    // The resumeAllAudioContexts function will handle resuming on interaction
                }
            } else {
                // Unexpected state
                console.log('Audio context in unexpected state:', globalAudioContext.state);
                // Try to play anyway
                try {
                    startGlobalNotificationSound(report.id);
                } catch (e) {
                    console.log('Failed to play sound:', e);
                }
            }
        };
        
        // Try to play immediately when notification appears (before animation)
        // Call immediately first, then also use requestAnimationFrame as backup
        tryPlayImmediately();
        // Also try in next frame to ensure DOM is fully ready
        requestAnimationFrame(() => {
            // Only try again if sound hasn't started yet
            if (currentPlayingSoundReportId !== report.id) {
                tryPlayImmediately();
            }
        });
    } else {
        console.log('Notification sound is disabled');
    }
    
    // Trigger animation
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
    
    // Handle view button click
    const viewBtn = overlay.querySelector('.notification-btn-view');
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            // Stop sound first and wait a bit to ensure it's fully stopped
            stopNotificationSound(report.id);
            // Mark report as viewed immediately (before navigation)
            viewedReportIds.add(report.id);
            saveViewedReportIds();
            // Remove from queue
            notificationQueue = notificationQueue.filter(r => r.id !== report.id);
            saveNotificationQueue();
            // Wait a bit to ensure sound is fully stopped before closing
            setTimeout(() => {
                // Close notification but don't process next one - user is navigating away
                closeNotification(report.id, false);
                // Navigate to report (this will happen after closeNotification completes)
                setTimeout(() => {
                    window.location.href = reportLink;
                }, 350);
            }, 100);
        });
    }
    
    // Modal should not close when clicking outside - removed overlay click handler
}

function closeNotification(reportId, processNext = true) {
    const notification = activeNotifications.get(reportId);
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            activeNotifications.delete(reportId);
            
            // Mark report as viewed/dismissed (if not already marked)
            if (!viewedReportIds.has(reportId)) {
                viewedReportIds.add(reportId);
                saveViewedReportIds();
            }
            
            // Remove from queue if it's still there
            notificationQueue = notificationQueue.filter(r => r.id !== reportId);
            saveNotificationQueue();
            
            // Mark that we're no longer showing a notification
            isShowingNotification = false;
            
            // Update lastCheckedReportId to the highest ID of all processed reports
            if (reportId > lastCheckedReportId) {
                lastCheckedReportId = reportId;
                // Save to localStorage
                try {
                    localStorage.setItem('security_last_checked_report_id', lastCheckedReportId.toString());
                } catch (e) {
                    console.log('Could not save lastCheckedReportId to localStorage:', e);
                }
            }
            
            // Stop the sound
            stopGlobalNotificationSound();
            
            // Only process next notification if processNext is true (default)
            // When user clicks "View Report", we set processNext to false so they can navigate
            // The next notification will appear when they return to the dashboard
            if (processNext && notificationQueue.length > 0) {
                // Wait a bit to ensure the previous sound is fully stopped before starting the next one
                // This prevents overlapping sounds
                setTimeout(() => {
                    // Double-check that sound is stopped before processing next notification
                    if (globalSoundInterval) {
                        stopGlobalNotificationSound();
                    }
                    // Process the next notification in queue
                    processNotificationQueue();
                }, 150);
            } else if (notificationQueue.length === 0) {
                console.log('All notifications processed, lastCheckedReportId updated to:', lastCheckedReportId);
            } else {
                console.log('Notification closed, remaining reports in queue will be shown when user returns to dashboard');
            }
        }, 300);
    }
}

// Removed playContinuousNotificationSound - now using generateContinuousSecurityAlertTone directly
// This avoids 404 errors from missing audio files and works better with browser autoplay policies

function stopNotificationSound(reportId) {
    // Stop audio file if exists
    const audio = activeAudioElements.get(reportId);
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
        activeAudioElements.delete(reportId);
    }
    
    // Stop generated tone if exists
    const toneInterval = activeAudioElements.get(reportId + '_tone');
    if (toneInterval) {
        clearInterval(toneInterval);
        activeAudioElements.delete(reportId + '_tone');
    }
    
    // Clean up audio context (only if it's not the global one)
    const audioContext = activeAudioElements.get(reportId + '_context');
    if (audioContext && audioContext !== globalAudioContext) {
        try {
            audioContext.close();
        } catch (e) {
            // Ignore errors when closing context
        }
        activeAudioElements.delete(reportId + '_context');
    }
    
    // If this was the currently playing sound, stop the global sound
    if (currentPlayingSoundReportId === reportId) {
        stopGlobalNotificationSound();
    }
}

// Stop the global notification sound (only one plays at a time)
function stopGlobalNotificationSound() {
    if (globalSoundInterval) {
        clearInterval(globalSoundInterval);
        globalSoundInterval = null;
    }
    currentPlayingSoundReportId = null;
    console.log('Stopped global notification sound');
}

// Start the global notification sound for a specific report (only one plays at a time)
function startGlobalNotificationSound(reportId) {
    // Stop any existing sound first and wait a moment to ensure it's fully stopped
    stopGlobalNotificationSound();
    
    // Small delay to ensure previous sound is fully stopped before starting new one
    // This prevents overlapping sounds
    setTimeout(() => {
        // Double-check that we should still play (report might have been dismissed)
        if (!activeNotifications.has(reportId)) {
            console.log('Report', reportId, 'no longer active, not starting sound');
            return;
        }
        
        // Set the current playing report ID
        currentPlayingSoundReportId = reportId;
        
        // Start the sound
        generateContinuousSecurityAlertTone(reportId);
    }, 50);
}

function generateContinuousSecurityAlertTone(reportId) {
    // Stop any existing global sound first (only one sound plays at a time)
    if (globalSoundInterval) {
        clearInterval(globalSoundInterval);
        globalSoundInterval = null;
    }
    
    try {
        // Use the global audio context if available, otherwise create a new one
        let audioContext = globalAudioContext;
        
        if (!audioContext || audioContext.state === 'closed') {
            // Fallback: create a new context if global one doesn't exist
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Update global context so future calls can use it
            globalAudioContext = audioContext;
        }
        
        // Create a function to play a siren-style alarm (not beeps)
        // Using a rising and falling frequency pattern like a police/ambulance siren
        const playToneInternal = () => {
            try {
                const currentTime = audioContext.currentTime;
                const duration = 0.8; // Duration of one siren cycle
                
                // Create a siren oscillator that rises and falls in frequency
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                // Siren pattern: frequency rises from 800Hz to 1200Hz, then falls back
                // This creates the classic "wee-woo" siren sound
                osc.type = 'sine';
                
                // Set up frequency modulation (rising and falling)
                osc.frequency.setValueAtTime(800, currentTime);
                osc.frequency.linearRampToValueAtTime(1200, currentTime + duration / 2); // Rise
                osc.frequency.linearRampToValueAtTime(800, currentTime + duration); // Fall
                
                // Set up gain (volume) - fade in and out slightly for smoother sound
                // Reduced volume to 0.5 to prevent it from being too loud
                gain.gain.setValueAtTime(0, currentTime);
                gain.gain.linearRampToValueAtTime(0.5, currentTime + 0.05); // Fade in (moderate volume)
                gain.gain.setValueAtTime(0.5, currentTime + duration - 0.05);
                gain.gain.linearRampToValueAtTime(0, currentTime + duration); // Fade out
                
                osc.start(currentTime);
                osc.stop(currentTime + duration);
            } catch (err) {
                console.log('Error playing siren:', err);
            }
        };
        
        // Check if audio was previously unlocked via settings
        const audioUnlocked = localStorage.getItem('security_audio_unlocked') === 'true';
        
        // Try to play immediately - be aggressive about resuming if needed
        if (audioContext.state === 'running') {
            console.log('Audio context is running, playing tone immediately');
            playToneInternal();
        } else if (audioContext.state === 'suspended') {
            // Try to resume - this should work if audio was previously unlocked
            console.log('Audio context is suspended, attempting to resume and play...');
            const resumePromise = audioContext.resume();
            
            // If audio was previously unlocked, also try to play immediately (might work)
            if (audioUnlocked) {
                console.log('Audio was previously unlocked, attempting immediate playback');
                try {
                    playToneInternal();
                } catch (e) {
                    console.log('Immediate playback failed, waiting for resume:', e);
                }
            }
            
            resumePromise.then(() => {
                if (audioContext.state === 'running') {
                    console.log('Audio context resumed successfully, playing tone');
                    // Only play if we didn't already try to play above
                    if (!audioUnlocked) {
                        playToneInternal();
                    } else {
                        // Already tried to play, but ensure it continues
                        try {
                            playToneInternal();
                        } catch (e) {
                            console.log('Failed to play tone after resume:', e);
                        }
                    }
                } else {
                    console.log('Audio context resumed but not running, state:', audioContext.state);
                    // Try to play anyway if unlocked
                    if (audioUnlocked) {
                        try {
                            playToneInternal();
                        } catch (e) {
                            console.log('Failed to play tone after resume:', e);
                        }
                    }
                }
            }).catch((err) => {
                console.log('Could not resume audio context:', err);
                // Try to play anyway - sometimes it works even if resume fails
                try {
                    playToneInternal();
                } catch (e) {
                    console.log('Failed to play tone after resume error:', e);
                }
            });
        } else {
            console.log('Audio context in state:', audioContext.state, '- attempting to play anyway');
            // Try to play anyway - might work, especially if unlocked
            try {
                playToneInternal();
            } catch (e) {
                console.log('Failed to play tone:', e);
            }
        }
        
        // Set up a single global interval for continuous playback (every 1.5 seconds for siren pattern)
        // The siren cycle takes ~0.8 seconds, then waits ~0.7 seconds before repeating
        // Only one interval should be active at a time
        if (globalSoundInterval) {
            clearInterval(globalSoundInterval);
        }
        
        globalSoundInterval = setInterval(() => {
            // Check if this is still the current playing report
            if (currentPlayingSoundReportId !== reportId) {
                clearInterval(globalSoundInterval);
                globalSoundInterval = null;
                return;
            }
            
            // Check if context is still valid
            if (audioContext.state === 'closed') {
                clearInterval(globalSoundInterval);
                globalSoundInterval = null;
                currentPlayingSoundReportId = null;
                return;
            }
            
            // Try to play - if suspended, try to resume (might work if context was unlocked before)
            if (audioContext.state === 'running') {
                playToneInternal();
            } else if (audioContext.state === 'suspended') {
                // Try to resume - if the context was unlocked before, this should work
                audioContext.resume().then(() => {
                    if (audioContext.state === 'running' && currentPlayingSoundReportId === reportId) {
                        playToneInternal();
                    }
                }).catch(() => {
                    // Resume failed, skip this interval
                });
            }
        }, 1500);
        
    } catch (error) {
        console.log('Could not generate continuous security alert tone:', error);
    }
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
        status: formData.get('status')
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

// Auto-refresh disabled - using AJAX polling for new reports instead
// Removed auto-refresh to prevent page reloads and improve user experience

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
