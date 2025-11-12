        // Performance optimization functions
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        function lazyLoad(callback, delay = 0) {
            if (delay > 0) {
                setTimeout(callback, delay);
            } else {
                requestAnimationFrame(callback);
            }
        }
        
        // Cache DOM elements to avoid repeated queries
        const DOM_CACHE = {};
        
        function initDOMCache() {
            DOM_CACHE.navCards = document.querySelectorAll('.nav-card');
            DOM_CACHE.overlay = document.getElementById('co-modal-overlay');
            DOM_CACHE.modalShell = document.getElementById('co-modal-shell');
            DOM_CACHE.modalTitle = document.getElementById('co-modal-title');
            DOM_CACHE.modalClose = document.getElementById('co-modal-close');
            DOM_CACHE.reportList = document.querySelector('.report-list');
            DOM_CACHE.codeDisplay = document.getElementById('code-display');
            DOM_CACHE.copyBtn = document.getElementById('copy-code-btn');
        }
        
        // Lazy load content sections
        function lazyLoadSection(sectionId) {
            console.log('lazyLoadSection called for:', sectionId);
            const section = document.getElementById(sectionId);
            if (!section) {
                console.log('Section not found:', sectionId);
                return;
            }
            
            console.log('Section found:', section);
            console.log('Section data-loaded:', section.getAttribute('data-loaded'));
            
            // Always allow reports to be re-rendered
            if (sectionId === 'reports') {
                showReportsSection();
                return;
            }
            
            // For other sections, only load once
            if (section.getAttribute('data-loaded') === 'true') {
                console.log('Section already loaded, skipping:', sectionId);
                return;
            }
            section.setAttribute('data-loaded', 'true');
            
            if (sectionId === 'events' && typeof loadEvents === 'function') {
                // Load events on all devices
                console.log('Loading events for all devices...');
                loadEvents();
                
                // Also load events data for stats
                console.log('Loading events data for stats...');
                loadEventsData();
            } else if (sectionId === 'details') {
                // Community Details section is already loaded in HTML
                // Just ensure it's properly displayed
                return;
            } else if (sectionId === 'secret') {
                // Secret Code section is already loaded in HTML
                // Just ensure it's properly displayed
                return;
            }
        }

        // Real data: members embedded via json_script in HTML
        let users = [];
        try {
            const membersNode = document.getElementById('co-members-data');
            if (membersNode && membersNode.textContent) {
                users = JSON.parse(membersNode.textContent);
            }
        } catch (e) {
            users = [];
        }

        // Reports data (for stats only)
        let reports = [];
        
        // Events data (for stats only)
        let events = [];

        // Load events data for stats
        function loadEventsData() {
            const apiEndpoints = document.getElementById('co-api-endpoints');
            console.log('API endpoints element:', apiEndpoints);
            
            if (!apiEndpoints) {
                console.error('co-api-endpoints element not found');
                return;
            }
            
            const eventsListUrl = apiEndpoints.dataset.eventsListUrl;
            console.log('Events list URL from dataset:', eventsListUrl);
            
            if (!eventsListUrl) {
                console.error('Events API endpoint not found in dataset');
                return;
            }
            
            console.log('Loading events data from:', eventsListUrl);
            
            fetch(eventsListUrl, {
                method: 'GET',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                }
            })
            .then(response => {
                console.log('Events API response status:', response.status);
                console.log('Events API response headers:', response.headers);
                return response.json();
            })
            .then(data => {
                console.log('Events API response data:', data);
                if (data.success && Array.isArray(data.events)) {
                    events = data.events;
                    console.log('Events loaded successfully:', events.length, 'events');
                    console.log('Events data:', events);
                    updateStats(); // Update stats with new events data
                } else {
                    console.error('Failed to load events - success:', data.success, 'events array:', Array.isArray(data.events));
                    console.error('Error message:', data.error || 'Unknown error');
                    events = [];
                    updateStats(); // Update stats even with empty events
                }
            })
            .catch(error => {
                console.error('Error loading events:', error);
                events = [];
                updateStats(); // Update stats even with empty events
            });
        }
        
        // Load reports data for stats from server-side data
        function loadReportsData() {
            // Get stats directly from server-side data in the HTML
            const totalReportsEl = document.getElementById('total-reports');
            const totalEventsEl = document.getElementById('total-events');
            const monthReportsEl = document.getElementById('month-reports');
            
            console.log('Reading stats from HTML elements:');
            console.log('totalReportsEl:', totalReportsEl);
            console.log('totalEventsEl:', totalEventsEl);
            console.log('monthReportsEl:', monthReportsEl);
            
            if (totalReportsEl && totalEventsEl && monthReportsEl) {
                const totalReports = parseInt(totalReportsEl.textContent) || 0;
                const totalEvents = parseInt(totalEventsEl.textContent) || 0;
                const monthReports = parseInt(monthReportsEl.textContent) || 0;
                
                console.log('Raw text content:');
                console.log('totalReportsEl.textContent:', totalReportsEl.textContent);
                console.log('totalEventsEl.textContent:', totalEventsEl.textContent);
                console.log('monthReportsEl.textContent:', monthReportsEl.textContent);
                
                console.log('Parsed values:');
                console.log('totalReports:', totalReports);
                console.log('totalEvents:', totalEvents);
                console.log('monthReports:', monthReports);
                
                // Update stats directly without animation (since we're using server data)
                updateStatsFromServer(totalReports, totalEvents, monthReports);
                return;
            }
            
            console.log('Elements not found, falling back to AJAX');
            
            // Fallback to AJAX if server-side data not available
            const { reportsList } = endpoints();
            if (!reportsList) {
                console.log('No reportsList endpoint found');
                return;
            }
            
            console.log('Loading reports data from:', reportsList);
            
            fetch(`${reportsList}?per_page=1000`, { 
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                console.log('Reports API response:', data);
                if (data && data.ok && Array.isArray(data.reports)) {
                    reports = data.reports;
                    console.log('Loaded reports:', reports.length, 'reports');
                    updateStats();
                } else {
                    console.log('Invalid reports data:', data);
                    // Still update stats with empty data
                    updateStats();
                }
            })
            .catch(err => {
                console.error('Failed to load reports data:', err);
                // Still update stats with empty data
                updateStats();
            });
        }

        // Update stats using server-side data
        function updateStatsFromServer(totalReports, totalEvents, monthReports) {
            const totalUsers = Array.isArray(users) ? users.length : 0;
            
            console.log('Updating stats from server:', {
                totalUsers,
                totalReports,
                totalEvents,
                monthReports
            });
            
            // Only animate if elements exist and haven't been animated yet
            if (totalUsersEl) {
                console.log('Updating total users element:', totalUsersEl, 'with value:', totalUsers);
                if (!totalUsersEl.hasAttribute('data-animated')) {
                    animateValue(totalUsersEl, 0, totalUsers, 1000);
                    totalUsersEl.setAttribute('data-animated', 'true');
                } else {
                    // If already animated, update the value directly
                    totalUsersEl.textContent = totalUsers;
                }
            } else {
                console.error('total-users element not found!');
            }
            if (totalReportsEl) {
                console.log('Total reports element found, preserving server value:', totalReports);
                // Don't override server-side value, just ensure it's displayed
                if (!totalReportsEl.hasAttribute('data-animated')) {
                    animateValue(totalReportsEl, 0, totalReports, 1000);
                    totalReportsEl.setAttribute('data-animated', 'true');
                }
                // Don't update the text content as it should come from server
            } else {
                console.error('total-reports element not found!');
            }
            if (totalEventsEl) {
                console.log('Updating total events element:', totalEventsEl, 'with value:', totalEvents);
                if (!totalEventsEl.hasAttribute('data-animated')) {
                    animateValue(totalEventsEl, 0, totalEvents, 1000);
                    totalEventsEl.setAttribute('data-animated', 'true');
                } else {
                    // If already animated by events management script, don't override
                    console.log('Total events already updated by events management script, skipping');
                }
            } else {
                console.error('total-events element not found!');
            }
            if (monthReportsEl) {
                console.log('Month reports element found, preserving server value:', monthReports);
                // Don't override server-side value, just ensure it's displayed
                if (!monthReportsEl.hasAttribute('data-animated')) {
                    animateValue(monthReportsEl, 0, monthReports, 1000);
                    monthReportsEl.setAttribute('data-animated', 'true');
                }
                // Don't update the text content as it should come from server
            } else {
                console.error('month-reports element not found!');
            }
        }

        // Removed downloadOptions and billingHistory as Download & Billing sections were removed

        // DOM Elements
        const navCards = document.querySelectorAll('.nav-card');
        const overlay = document.getElementById('co-modal-overlay');
        const modalShell = document.getElementById('co-modal-shell');
        const modalContainer = document.querySelector('#co-modal-overlay .co-onboarding-modal');
        const modalTitle = document.getElementById('co-modal-title');
        const modalClose = document.getElementById('co-modal-close');
        const reportList = document.querySelector('.report-list');
        // Removed downloadGrid and billingHistoryTable queries
        const codeDisplay = document.getElementById('code-display');
        const copyBtn = document.getElementById('copy-code-btn');
        
        // Stats elements
        const totalUsersEl = document.getElementById('total-users');
        const totalReportsEl = document.getElementById('total-reports');
        const totalEventsEl = document.getElementById('total-events');
        const monthReportsEl = document.getElementById('month-reports');

        // Helper function to lock body scroll while preserving position
        function lockBodyScroll() {
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
        
        // Helper function to unlock body scroll and restore position
        function unlockBodyScroll() {
            const scrollY = document.body.getAttribute('data-scroll-y');
            const scrollPosition = scrollY ? parseInt(scrollY, 10) : null;
            
            // Remove all body styles first - force removal
            document.documentElement.style.removeProperty('overflow');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('position');
            document.body.style.removeProperty('top');
            document.body.style.removeProperty('width');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('paddingRight');
            document.body.style.removeProperty('left');
            document.body.style.removeProperty('right');
            document.body.style.removeProperty('bottom');
            document.body.classList.remove('modal-open', 'no-scroll');
            
            // Remove the attribute
            document.body.removeAttribute('data-scroll-y');
            
            // Force a reflow to ensure styles are cleared
            void document.body.offsetHeight;
            
            // Restore scroll position - use multiple attempts to ensure it works
            if (scrollPosition !== null && !isNaN(scrollPosition)) {
                // Immediate attempt
                window.scrollTo(0, scrollPosition);
                
                // Use requestAnimationFrame for next frame
                requestAnimationFrame(() => {
                    window.scrollTo(0, scrollPosition);
                    // Double-check after a brief delay
                    setTimeout(() => {
                        if (Math.abs(window.pageYOffset - scrollPosition) > 1) {
                            window.scrollTo(0, scrollPosition);
                        }
                    }, 10);
                });
            }
        }
        
        // Expose scroll lock functions globally for use by other scripts
        window.lockBodyScroll = lockBodyScroll;
        window.unlockBodyScroll = unlockBodyScroll;

        // Initialize the dashboard with performance optimizations
        document.addEventListener('DOMContentLoaded', function() {
            // Immediately hide all modals to prevent flash
            const deleteModal = document.getElementById('co-delete-confirm-modal');
            if (deleteModal) {
                deleteModal.style.display = 'none';
                deleteModal.style.visibility = 'hidden';
                deleteModal.style.opacity = '0';
            }
            const reportDetailModal = document.getElementById('co-report-detail-modal');
            if (reportDetailModal) {
                reportDetailModal.style.display = 'none';
                reportDetailModal.style.visibility = 'hidden';
                reportDetailModal.style.opacity = '0';
            }
            const eventModal = document.getElementById('co-event-modal');
            if (eventModal) {
                eventModal.style.display = 'none';
                eventModal.style.visibility = 'hidden';
                eventModal.style.opacity = '0';
            }
            
            // Initialize DOM cache first
            initDOMCache();
            
            // Load reports data and update stats
            loadReportsData();
            
            // Load events data and update stats
            loadEventsData();
            
            // Also try loading events data after a short delay to ensure everything is ready
            setTimeout(() => {
                console.log('Delayed events loading...');
                loadEventsData();
                
                // Also try using the events management script's loadEvents function if available
                if (typeof loadEvents === 'function') {
                    console.log('Using events management loadEvents function...');
                    loadEvents();
                }
            }, 1000);
            
            // Lazy load non-critical content
            lazyLoad(() => {
                // Always render bottom Manage Users table on load
                if (typeof renderUsersTable === 'function') { 
                    renderUsersTable(); 
                    coPaginateRows(); 
                }
                // Optionally refresh from API to ensure fresh data
                if (typeof refreshMembersList === 'function') {
                    refreshMembersList();
                }
            }, 50);

            // Debounced filter for better performance
            const filterInput = document.getElementById('co-user-filter');
            if (filterInput){
                const debouncedFilter = debounce(function(){
                    const termRaw = (filterInput.value || '').trim();
                    const term = termRaw.toLowerCase();
                    // Re-render then filter rows by term
                    renderUsersTable();
                    const table = document.getElementById('co-users-table');
                    if (table){
                        const rows = Array.from(table.querySelectorAll('tbody tr')).filter(tr => tr.id !== 'co-empty-row');
                        rows.forEach(tr => {
                            const name = (tr.children[0]?.textContent || '').toLowerCase();
                            const email = (tr.getAttribute('data-email') || '').toLowerCase();
                            const match = !term || name.includes(term) || email.includes(term);
                            tr.style.display = match ? '' : 'none';
                        });
                    }
                    coCurrentPage = 1;
                    coPaginateRows();
                }, 300);
                
                filterInput.addEventListener('input', debouncedFilter);
            }

            // Add User via modal with server search
            const addBtn = document.getElementById('co-user-add-btn');
            if (addBtn){
                addBtn.addEventListener('click', function(){
                    if (typeof openAddUserModal === 'function') openAddUserModal();
                });
            }

            let currentSection = null;

            function openModal(targetId) {
                // Don't open events or users in modals - they're shown inline
                if (targetId === 'events' || targetId === 'users') {
                    return;
                }
                
                const section = document.getElementById(targetId);
                if (!section || !overlay || !modalShell) {
                    console.error('Modal elements not found:', { section: !!section, overlay: !!overlay, modalShell: !!modalShell });
                    return;
                }
                
                // Close other modals first (but don't unlock scroll yet)
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.style.visibility = 'hidden';
                    overlay.style.opacity = '0';
                    overlay.classList.remove('active', 'show');
                }
                
                // Close delete confirmation modal if open
                const deleteModal = document.getElementById('co-delete-confirm-modal');
                if (deleteModal) {
                    deleteModal.style.display = 'none';
                    deleteModal.style.visibility = 'hidden';
                    deleteModal.style.opacity = '0';
                }
                
                // Clear modal shell
                modalShell.innerHTML = '';
                
                // set title preferring nav card label, fallback to section title
                let titleText = '';
                try {
                    const card = Array.from(navCards || []).find(c => c.getAttribute('data-target') === targetId);
                    if (card) {
                        titleText = (card.querySelector('.card-title')?.textContent || '').trim();
                    }
                } catch (e) { /* ignore */ }
                if (!titleText) {
                    titleText = (section.querySelector('.section-title')?.textContent || '').trim();
                }
                if (modalTitle) modalTitle.textContent = titleText;
                
                // ensure section appears
                section.classList.add('active');
                section.classList.add('in-modal');
                
                // Always display the section
                section.style.display = 'block';
                section.style.visibility = 'visible';
                section.style.opacity = '1';
                section.style.pointerEvents = 'auto';
                
                // mount into shell
                console.log('Mounting section into modal:', targetId);
                modalShell.appendChild(section);
                
                if (modalContainer) {
                    if (targetId === 'secret') {
                        modalContainer.classList.add('co-modal-no-scroll');
                    } else {
                        modalContainer.classList.remove('co-modal-no-scroll');
                    }
                }
                
                // Set body styles for modal - preserve scroll position
                try {
                    lockBodyScroll();
                } catch (e) {
                    console.error('Error locking body scroll:', e);
                }
                
                // Show overlay with proper state
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');
                
                currentSection = section;
                if (targetId === 'reports') {
                    renderReports();
                }
            }

            function closeModal() {
                if (!overlay) return;
                
                // Store current section before cleanup
                const sectionToRestore = currentSection;
                
                // Close overlay first
                overlay.style.display = 'none';
                overlay.style.visibility = 'hidden';
                overlay.style.opacity = '0';
                overlay.classList.remove('active', 'show');
                
                // Restore section to its original location if it exists
                if (sectionToRestore) {
                    const host = document.querySelector('.content-area');
                    if (host && sectionToRestore.parentNode !== host) {
                        host.appendChild(sectionToRestore);
                    }
                    sectionToRestore.classList.remove('in-modal', 'active');
                    sectionToRestore.style.display = 'none'; // Hide it since content-area is hidden
                    currentSection = null;
                }
                
                if (modalContainer) modalContainer.classList.remove('co-modal-no-scroll');
                
                // Clear modal shell
                if (modalShell) {
                    modalShell.innerHTML = '';
                }
                
                // Reset modal title
                if (modalTitle) {
                    modalTitle.textContent = '';
                }
                
                // Unlock body scroll and restore position - this is critical
                unlockBodyScroll();
            }

            // Optimized navigation with lazy loading
            navCards.forEach(card => {
                card.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    // Toggle active highlight
                    navCards.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    if (targetId === 'users') {
                        // Hide all other sections first
                        const contentArea = document.querySelector('.content-area');
                        if (contentArea) contentArea.style.display = 'none';
                        const eventsSection = document.getElementById('events');
                        if (eventsSection) {
                            eventsSection.style.display = 'none';
                        }
                        const reportsBottom = document.getElementById('co-reports-bottom');
                        if (reportsBottom) {
                            reportsBottom.style.display = 'none';
                        }
                        const usersBottom = document.getElementById('co-users-bottom');
                        if (usersBottom) {
                            usersBottom.style.display = 'block';
                        }
                        // Lazy load users table
                        lazyLoad(() => {
                            if (typeof renderUsersTable === 'function') {
                                renderUsersTable();
                            }
                        }, 50);
                        // Scroll to users section
                        if (usersBottom) {
                            setTimeout(() => {
                                usersBottom.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                        }
                    } else if (targetId === 'events') {
                        // Hide users section, reports section, and other content
                        const usersBottom = document.getElementById('co-users-bottom');
                        if (usersBottom) {
                            usersBottom.style.display = 'none';
                        }
                        const reportsBottom = document.getElementById('co-reports-bottom');
                        if (reportsBottom) {
                            reportsBottom.style.display = 'none';
                        }
                        const contentArea = document.querySelector('.content-area');
                        if (contentArea) contentArea.style.display = 'none';
                        
                        // Show events section inline
                        const eventsSection = document.getElementById('events');
                        if (eventsSection) {
                            eventsSection.style.display = 'block';
                            eventsSection.style.visibility = 'visible';
                            eventsSection.style.opacity = '1';
                            eventsSection.style.pointerEvents = 'auto';
                            
                            // Hide bottom "Create New Event" button initially (will be shown if events exist)
                            const createSection = document.getElementById('co-events-create-section');
                            if (createSection) {
                                createSection.style.setProperty('display', 'none', 'important');
                                createSection.style.setProperty('visibility', 'hidden', 'important');
                                createSection.style.setProperty('opacity', '0', 'important');
                            }
                            
                            // Load events after ensuring section is visible
                            lazyLoad(() => {
                                // Double-check that events section is visible before loading
                                if (eventsSection.style.display === 'block' || eventsSection.offsetParent !== null) {
                                    lazyLoadSection('events');
                                }
                            }, 100);
                            
                            // Scroll to events section
                            setTimeout(() => {
                                eventsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 150);
                        }
                    } else {
                        // Hide users, events, and reports sections when clicking other cards
                        const usersBottom = document.getElementById('co-users-bottom');
                        if (usersBottom) {
                            usersBottom.style.display = 'none';
                        }
                        const eventsSection = document.getElementById('events');
                        if (eventsSection) {
                            eventsSection.style.display = 'none';
                        }
                        const reportsBottom = document.getElementById('co-reports-bottom');
                        if (reportsBottom) {
                            reportsBottom.style.display = 'none';
                        }
                        
                        if (targetId === 'emergency') {
                            if (window.CO_openEmergencyModal) { window.CO_openEmergencyModal(); }
                        } else if (targetId === 'reports') {
                            // Show reports bottom section instead of modal
                            showReportsSection();
                        } else {
                            // Lazy load other sections
                            console.log('Navigation handler - targetId:', targetId);
                            lazyLoad(() => {
                                const isMobile = window.innerWidth <= 768;
                                console.log('Navigation lazyLoad - targetId:', targetId, 'isMobile:', isMobile, 'window width:', window.innerWidth);
                                
                                console.log('Calling lazyLoadSection for:', targetId);
                                lazyLoadSection(targetId);
                                console.log('Calling openModal for:', targetId);
                                openModal(targetId);
                            }, 50);
                        }
                    }
                });
            });

            if (modalClose) modalClose.addEventListener('click', closeModal);
            if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
            
            // Auto-show code if provided by server
            if (codeDisplay && codeDisplay.dataset && codeDisplay.dataset.code) {
                const cd = codeDisplay.dataset.code.trim();
                if (cd) {
                    codeDisplay.textContent = cd;
                    codeDisplay.classList.add('revealed');
                }
            }

            // Copy code button
            if (copyBtn && codeDisplay) {
                copyBtn.addEventListener('click', function () {
                    const text = (codeDisplay.textContent || '').trim();
                    if (!text) return;
                    const onSuccess = () => {
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code'; }, 1500);
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(onSuccess).catch(() => {/* ignore */});
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        document.body.appendChild(ta);
                        ta.select();
                        try { document.execCommand('copy'); onSuccess(); } catch (e) {}
                        document.body.removeChild(ta);
                    }
                });
            }
        });

        // Toast helper (global)
        (function(){
            const rootId = 'co-toast-root';
            function ensureRoot(){
                let r = document.getElementById(rootId);
                if (!r){
                    r = document.createElement('div');
                    r.id = rootId;
                    r.className = 'co-toast-root';
                    document.body.appendChild(r);
                }
                return r;
            }
            function icon(type){
                if (type==='success') return '<i class="fas fa-check-circle"></i>';
                if (type==='error' || type==='danger') return '<i class="fas fa-times-circle"></i>';
                if (type==='warning') return '<i class="fas fa-exclamation-triangle"></i>';
                return '<i class="fas fa-info-circle"></i>';
            }
            window.CO_showToast = function(message, type){
                const root = ensureRoot();
                const el = document.createElement('div');
                el.className = 'co-toast ' + (type||'info');
                el.innerHTML = '<span class="co-toast-icon">'+icon(type)+'</span><span class="co-toast-msg"></span>';
                el.querySelector('.co-toast-msg').textContent = message;
                root.appendChild(el);
                requestAnimationFrame(()=> el.classList.add('in'));
                setTimeout(()=>{ el.classList.remove('in'); el.classList.add('out'); setTimeout(()=>el.remove(), 220); }, 3200);
            }
        })();

        // Parse messages (from hidden data or JSON script) and show toasts
        (function(){
            try {
                let arr = [];
                const dataEl = document.getElementById('co-messages-data');
                if (dataEl && dataEl.dataset && dataEl.dataset.messages) {
                    arr = JSON.parse(dataEl.dataset.messages || '[]');
                } else {
                    const msgEl = document.getElementById('co-messages');
                    if (msgEl) arr = JSON.parse(msgEl.textContent || '[]');
                }
                if (Array.isArray(arr) && window.CO_showToast) {
                    arr.forEach(m => { if (m && m.text) CO_showToast(m.text, m.tags || 'info'); });
                }
            } catch (e) { /* ignore */ }
        })();

        // Live name availability for onboarding form
        (function(){
            const nameInput = document.getElementById('community_name');
            const errorEl = document.getElementById('community_name_error');
            const submitBtn = document.getElementById('onboarding-submit');
            if (!nameInput || !errorEl || !submitBtn) return;
            let timer = null;
            const setError = (msg) => {
                errorEl.textContent = msg || 'This community name is already taken. Please choose another.';
                errorEl.style.display = 'block';
                nameInput.classList.add('co-input-error');
                submitBtn.disabled = true;
            };
            const clearError = () => {
                errorEl.style.display = 'none';
                nameInput.classList.remove('co-input-error');
                submitBtn.disabled = false;
            };
            const check = (val) => {
                if (!val || val.trim().length < 3) { setError('Please enter at least 3 characters.'); return; }
                fetch(`/community-owner/check-name/?name=${encodeURIComponent(val)}`, { headers: { 'X-Requested-With':'XMLHttpRequest' }})
                    .then(r => r.json()).then(data => { data.available ? clearError() : setError(); })
                    .catch(()=>{});
            };
            nameInput.addEventListener('input', function(){
                clearTimeout(timer); clearError();
                const val = this.value; timer = setTimeout(() => check(val), 350);
            });
            if (nameInput.value) { check(nameInput.value); }
        })();

        // Inline Community Details: show actions on change + name availability
        (function(){
            const form = document.getElementById('co-details-form');
            if (!form) return;
            const nameInput = document.getElementById('edit_community_name');
            const addrInput = document.getElementById('edit_community_address');
            const actions = document.getElementById('co-inline-actions');
            const nameError = document.getElementById('edit_community_name_error');
            const cancelBtn = document.getElementById('co-details-cancel');
            const saveBtn = document.getElementById('co-details-save');
            const initial = {
                name: nameInput ? (nameInput.value || '') : '',
                addr: addrInput ? (addrInput.value || '') : ''
            };
            function changed(){
                const n = nameInput ? nameInput.value : '';
                const a = addrInput ? addrInput.value : '';
                return (n !== initial.name) || (a !== initial.addr);
            }
            function updateActions(){ if (actions) actions.style.display = changed() ? 'flex' : 'none'; }
            if (nameInput) nameInput.addEventListener('input', updateActions);
            if (addrInput) addrInput.addEventListener('input', updateActions);
            if (cancelBtn) cancelBtn.addEventListener('click', function(){
                if (nameInput) nameInput.value = initial.name;
                if (addrInput) addrInput.value = initial.addr;
                updateActions();
                if (nameError) { nameError.style.display='none'; nameInput?.classList.remove('co-input-error'); }
            });
            updateActions();

            // Live name availability for inline edit
            if (nameInput && nameError){
                let timer=null; const setErr=(msg)=>{ nameError.textContent=msg||nameError.textContent; nameError.style.display='block'; nameInput.classList.add('co-input-error'); };
                const clrErr=()=>{ nameError.style.display='none'; nameInput.classList.remove('co-input-error'); };
                const check=(v)=>{ if (!v || v.trim().length<3){ setErr('Please enter at least 3 characters.'); return; }
                    fetch(`/community-owner/check-name/?name=${encodeURIComponent(v)}`, { headers:{'X-Requested-With':'XMLHttpRequest'} })
                      .then(r=>r.json()).then(d=>{ d.available? clrErr(): setErr(); }).catch(()=>{});
                };
                nameInput.addEventListener('input', function(){ clearTimeout(timer); const v=this.value; if (!v || v.trim().length<3){ clrErr(); updateActions(); return; } timer=setTimeout(()=>check(v), 350); });
                if (nameInput.value) { check(nameInput.value); }
            }

            // AJAX submit without page refresh
            form.addEventListener('submit', function(e){
                e.preventDefault();
                if (!changed()) return;
                const fd = new FormData(form);
                const csrf = form.querySelector('input[name="csrfmiddlewaretoken"]')?.value || '';
                if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
                fetch(form.getAttribute('action') || window.location.href, {
                    method: 'POST',
                    headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrf },
                    body: fd,
                    credentials: 'same-origin'
                }).then(async (r) => {
                    const isJson = (r.headers.get('content-type')||'').includes('application/json');
                    const data = isJson ? await r.json() : null;
                    if (!r.ok || !data || data.ok !== true) throw new Error((data && (data.error||'')) || 'Failed to save');
                    // Update initial values
                    initial.name = data.profile?.community_name || (nameInput?.value||'');
                    initial.addr = data.profile?.community_address || (addrInput?.value||'');
                    updateActions();
                    if (window.CO_showToast) CO_showToast('Community profile saved.', 'success');
                }).catch(err => {
                    const msg = err && err.message ? err.message : 'Could not save changes';
                    if (nameError && /already taken|enter at least 3/i.test(msg)) {
                        nameError.textContent = msg;
                        nameError.style.display = 'block';
                        nameInput?.classList.add('co-input-error');
                    }
                    if (window.CO_showToast) CO_showToast(msg, 'error');
                }).finally(() => {
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
                });
            });
        })();

        // Update stats
        function updateStats() {
            // Calculate stats
            const totalUsers = Array.isArray(users) ? users.length : 0;
            
            // Get reports stats from server-side data (HTML elements)
            const totalReportsEl = document.getElementById('total-reports');
            const monthReportsEl = document.getElementById('month-reports');
            const totalReports = totalReportsEl ? parseInt(totalReportsEl.textContent) || 0 : 0;
            const monthReports = monthReportsEl ? parseInt(monthReportsEl.textContent) || 0 : 0;
            
            const totalEvents = Array.isArray(events) ? events.length : 0;
            
            console.log('Stats calculation:', {
                totalUsers,
                totalReports,
                totalEvents,
                monthReports,
                reportsArray: reports,
                usersArray: users,
                eventsArray: events,
                eventsLength: events ? events.length : 'events is not an array'
            });
            
            // Only animate if elements exist and haven't been animated yet
            if (totalUsersEl) {
                console.log('Updating total users element:', totalUsersEl, 'with value:', totalUsers);
                if (!totalUsersEl.hasAttribute('data-animated')) {
                    animateValue(totalUsersEl, 0, totalUsers, 1000);
                    totalUsersEl.setAttribute('data-animated', 'true');
                } else {
                    // If already animated, update the value directly
                    totalUsersEl.textContent = totalUsers;
                }
            } else {
                console.error('total-users element not found!');
            }
            if (totalReportsEl) {
                console.log('Total reports element found, preserving server value:', totalReports);
                // Don't override server-side value, just ensure it's displayed
                if (!totalReportsEl.hasAttribute('data-animated')) {
                    animateValue(totalReportsEl, 0, totalReports, 1000);
                    totalReportsEl.setAttribute('data-animated', 'true');
                }
                // Don't update the text content as it should come from server
            } else {
                console.error('total-reports element not found!');
            }
            if (totalEventsEl) {
                console.log('Updating total events element:', totalEventsEl, 'with value:', totalEvents);
                if (!totalEventsEl.hasAttribute('data-animated')) {
                    animateValue(totalEventsEl, 0, totalEvents, 1000);
                    totalEventsEl.setAttribute('data-animated', 'true');
                } else {
                    // If already animated by events management script, don't override
                    console.log('Total events already updated by events management script, skipping');
                }
            } else {
                console.error('total-events element not found!');
            }
            if (monthReportsEl) {
                console.log('Month reports element found, preserving server value:', monthReports);
                // Don't override server-side value, just ensure it's displayed
                if (!monthReportsEl.hasAttribute('data-animated')) {
                    animateValue(monthReportsEl, 0, monthReports, 1000);
                    monthReportsEl.setAttribute('data-animated', 'true');
                }
                // Don't update the text content as it should come from server
            } else {
                console.error('month-reports element not found!');
            }
        }

        // Animate value counting up
        function animateValue(element, start, end, duration) {
            if (!element) return;
            
            // Stop any existing animation on this element
            if (element.animationId) {
                cancelAnimationFrame(element.animationId);
            }
            
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                element.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) {
                    element.animationId = window.requestAnimationFrame(step);
                } else {
                    element.animationId = null;
                }
            };
            element.animationId = window.requestAnimationFrame(step);
        }

        // Bottom table rendering and actions for Manage Users
        function getCsrfToken() {
            // Try cookie first
            const m = document.cookie.match(/csrftoken=([^;]+)/);
            if (m) return decodeURIComponent(m[1]);
            // Fallback: use Django-rendered token from csrf input if present
            const inp = document.querySelector('input[name=csrfmiddlewaretoken]');
            if (inp) return inp.value;
            return '';
        }

        function refreshMembersList(){
            const { list } = endpoints();
            if (!list) return;
            fetch(list, { headers: { 'X-Requested-With':'XMLHttpRequest' }})
                .then(r=>r.json())
                .then(data => {
                    if (data && data.ok && Array.isArray(data.members)){
                        users = data.members;
                        renderUsersTable();
                        coCurrentPage = 1;
                        coPaginateRows();
                        // Don't call updateStats here to prevent animation restart
                    }
                })
                .catch(()=>{});
            
            // Also refresh reports data
            loadReportsData();
            
            // Also refresh events data
            loadEventsData();
        }

        function endpoints() {
            const el = document.getElementById('co-api-endpoints');
            return el ? {
                list: el.dataset.listUrl,
                update: el.dataset.updateUrl,
                search: el.dataset.searchUrl,
                add: el.dataset.addUrl,
                ecList: el.dataset.ecListUrl,
                ecAdd: el.dataset.ecAddUrl,
                ecDelete: el.dataset.ecDeleteUrl,
                ecUpdate: el.dataset.ecUpdateUrl,
                reportsList: el.dataset.reportsListUrl,
                reportsDetail: el.dataset.reportsDetailUrl,
                reportsDownloadPdf: el.dataset.reportsDownloadPdfUrl,
                reportsAnalytics: el.dataset.reportsAnalyticsUrl,
            } : {};
        }

        function roleOptions(current) {
            const opts = [
                { v: 'resident', t: 'Resident' },
                { v: 'security', t: 'Security' },
            ];
            return opts.map(o => `<option value="${o.v}" ${current===o.v? 'selected':''}>${o.t}</option>`).join('');
        }

        // Simple row-based pagination for Manage Users table
        let coPageSize = 10;
        let coCurrentPage = 1;

        function coRenderPager(total) {
            const root = document.getElementById('co-users-pagination');
            if (!root) return;
            root.innerHTML = '';
            const pageCount = Math.max(1, Math.ceil(total / coPageSize));
            const mk = (label, p, disabled, active, isPageNumber = false) => {
                const b = document.createElement('button');
                b.className = 'page-btn' + (active ? ' active' : '');
                b.textContent = label;
                b.style.border = '1px solid #e5e7eb'; b.style.background = '#fff'; b.style.color = '#374151'; b.style.borderRadius = '8px'; b.style.padding = '6px 10px'; b.style.fontSize = '13px';
                
                if (isPageNumber) {
                    // Page numbers are unclickable but look normal
                    b.style.cursor = 'default';
                } else {
                    b.style.cursor = 'pointer';
                }
                
                if (active){ b.style.borderColor = '#2563eb'; b.style.color = '#2563eb'; b.style.background = '#eff6ff'; }
                if (disabled){ b.disabled = true; b.style.opacity = '.5'; b.style.cursor = 'default'; }
                else if (!isPageNumber) { b.addEventListener('click', ()=> { coCurrentPage = p; coPaginateRows(); }); }
                return b;
            };
            // Only show Previous button if not on first page
            if (coCurrentPage > 1) {
                root.appendChild(mk('Prev', Math.max(1, coCurrentPage-1), false, false));
            }
            
            // Show only current page number
            root.appendChild(mk(String(coCurrentPage), coCurrentPage, false, true, true));
            
            // Only show Next button if not on last page
            if (coCurrentPage < pageCount) {
                root.appendChild(mk('Next', Math.min(pageCount, coCurrentPage+1), false, false));
            }
        }

        function coPaginateRows(){
            const table = document.getElementById('co-users-table');
            if (!table) return;
            const termRawPage = (document.getElementById('co-user-filter')?.value||'').trim().toLowerCase();
            const allRows = Array.from(table.querySelectorAll('tbody tr')).filter(tr => tr.id !== 'co-empty-row');
            const rows = [];
            allRows.forEach(tr => {
                const name = (tr.children[0]?.textContent || '').toLowerCase();
                const email = (tr.getAttribute('data-email') || '').toLowerCase();
                const ok = !termRawPage || name.includes(termRawPage) || email.includes(termRawPage);
                if (ok) rows.push(tr);
                tr.style.display = ok ? '' : 'none';
            });
            const total = rows.length;
            // Remove any existing empty row
            const prevEmpty = table.querySelector('#co-empty-row'); if (prevEmpty) prevEmpty.remove();
            if (total === 0){
                const tbody = table.querySelector('tbody');
                const tr = document.createElement('tr'); tr.id = 'co-empty-row';
                const termRaw = (document.getElementById('co-user-filter')?.value||'');
                const safeTerm = termRaw.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]));
                const msg = termRaw ? `There\'s no member with that name or email \"${safeTerm}\".` : 'No members yet.';
                tr.innerHTML = `<td colspan="5" style="padding:12px;color:#6b7280;text-align:center;">${msg}</td>`;
                tbody.appendChild(tr);
                coRenderPager(0);
                return;
            }
            const pageCount = Math.max(1, Math.ceil(total / coPageSize));
            if (coCurrentPage > pageCount) coCurrentPage = pageCount;
            const start = (coCurrentPage - 1) * coPageSize;
            const end = start + coPageSize;
            rows.forEach((tr, idx) => { tr.style.display = (idx >= start && idx < end) ? '' : 'none'; });
            coRenderPager(total);
        }

        function renderUsersTable() {
            const table = document.getElementById('co-users-table');
            if (!table) return;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';
            const frag = document.createDocumentFragment();
            (users||[]).slice().sort((a,b)=>{var an=(a.name||'').toLowerCase(),bn=(b.name||'').toLowerCase();return an<bn?-1:an>bn?1:0;}).forEach(u => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-email', (u.email||''));
                // Create initials fallback
                const initials = (u.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                
                tr.innerHTML = `
                    <td style="padding:10px 8px;">
                        <div style="display:flex;align-items:center;">
                            ${u.avatar ? 
                                `<img src="${u.avatar}" alt="${u.name || ''}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';" />` :
                                ''
                            }
                            <div style="display:${u.avatar ? 'none' : 'inline-flex'};width:32px;height:32px;border-radius:50%;background:#e5edff;color:#2563eb;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:8px;" class="initials-fallback">${initials}</div>
                            <a href="/user/profile/${u.id}/" style="color:#000;text-decoration:none;cursor:pointer;font-weight:500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${u.name || ''}</a>
                        </div>
                    </td>
                    <td style="padding:10px 8px;"><select class="co-role" data-id="${u.id}" style="padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;">${roleOptions(u.role||'')}</select></td>
                    <td style="padding:10px 8px;"><input class="co-block" data-id="${u.id}" type="text" value="${u.block||''}" placeholder="Block" style="padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;width:120px;" /></td>
                    <td style="padding:10px 8px;"><input class="co-lot" data-id="${u.id}" type="text" value="${u.lot||''}" placeholder="Lot" style="padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;width:120px;" /></td>
                    <td style="padding:10px 8px;"><button class="action-btn edit-btn co-save" data-id="${u.id}"><i class="fas fa-save"></i> Save</button></td>`;
                frag.appendChild(tr);
            });
            tbody.appendChild(frag);
            if (!users.length) {
                const empty = document.createElement('tr');
                empty.id = 'co-empty-row';
                empty.innerHTML = `<td colspan="5" style="padding:12px;color:#6b7280;text-align:center;">No members yet.</td>`;
                tbody.appendChild(empty);
            }
            bindRowActions();
            updateStats();
        }

        // Emergency Contacts Modal
        (function(){
            function openEmergencyModal(){
                const { ecList, ecAdd, ecDelete } = endpoints();
                if (!overlay || !modalShell) return;
                
                // Close other modals first (but don't unlock scroll yet)
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.style.visibility = 'hidden';
                    overlay.style.opacity = '0';
                    overlay.classList.remove('active', 'show');
                }
                
                // Close delete confirmation modal if open
                const deleteModal = document.getElementById('co-delete-confirm-modal');
                if (deleteModal) {
                    deleteModal.style.display = 'none';
                    deleteModal.style.visibility = 'hidden';
                    deleteModal.style.opacity = '0';
                }
                
                // Clear modal shell and set title
                if (modalTitle) modalTitle.textContent = 'Emergency Calls';
                modalShell.innerHTML = `
                    <div class="co-ec-modal" style="width:100%;max-width:620px;margin:0 auto;">
                        <div class="ec-form" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;margin-bottom:12px;">
                            <div style="display:flex;flex-direction:column;">
                                <label for="ec-label" style="font-size:0.9rem;color:#334155;margin-bottom:6px;">Title</label>
                                <input id="ec-label" type="text" placeholder="e.g., Police" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;width:100%;min-width:0;" />
                            </div>
                            <div style="display:flex;flex-direction:column;">
                                <label for="ec-phone" style="font-size:0.9rem;color:#334155;margin-bottom:6px;">Phone Number</label>
                                <input id="ec-phone" type="text" placeholder="e.g., 555-0111" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;width:100%;min-width:0;" />
                            </div>
                            <button id=\"ec-add-btn\" class="action-btn edit-btn" type="button" style="grid-column:1 / span 2;justify-self:center;width:80%;max-width:420px;padding:8px 0;font-size:1rem;border-radius:12px;box-shadow:0 8px 16px rgba(2,6,23,0.10);"><i class="fas fa-plus"></i> Add</button>
                        </div>
                        <div id="ec-list" style="border:1px solid #f1f5f9;border-radius:8px;overflow:auto;max-height:320px;"></div>
                    </div>`;
                
                // Set body styles for modal - preserve scroll position
                try {
                    lockBodyScroll();
                } catch (e) {
                    console.error('Error locking body scroll in emergency modal:', e);
                }
                
                // Open the modal properly
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');

                const listRoot = document.getElementById('ec-list');
                const addBtn = document.getElementById('ec-add-btn');
                const labelInput = document.getElementById('ec-label');
                const phoneInput = document.getElementById('ec-phone');

                function render(items){
                    listRoot.innerHTML = '';
                    if (!Array.isArray(items) || !items.length){
                        listRoot.innerHTML = '<div style="padding:10px;color:#6b7280;">No emergency contacts yet.</div>';
                        return;
                    }
                    const ul = document.createElement('ul');
                    ul.style.listStyle = 'none'; ul.style.margin = '0'; ul.style.padding = '0';
                    items.forEach(it => {
                        const li = document.createElement('li');
                        li.style.display='flex'; li.style.alignItems='center'; li.style.justifyContent='space-between'; li.style.padding='10px 12px'; li.style.borderBottom='1px solid #f1f5f9';
                        const left = document.createElement('div');
                        const title = document.createElement('div'); title.style.fontWeight='600'; title.style.color='#0f172a'; title.textContent = it.label;
                        const small = document.createElement('div'); small.style.color='#6b7280'; small.textContent = it.phone;
                        left.appendChild(title); left.appendChild(small);
                        li.appendChild(left);
                        const btnWrap = document.createElement('div'); btnWrap.style.display='flex'; btnWrap.style.gap='6px'; btnWrap.style.alignItems='center';
                        const edit = document.createElement('button');
                        edit.className = 'action-btn edit-btn';
                        edit.innerHTML = '<i class="fas fa-pen"></i> Edit';
                        edit.style.flex='0 0 auto'; edit.style.padding='6px 10px';
                        edit.addEventListener('click', function(){
                            // Turn left side into two-column edit fields with labels
                            left.innerHTML = '';
                            left.style.display = 'grid';
                            left.style.gridTemplateColumns = '1fr 1fr';
                            left.style.gap = '10px';
                            const labWrap = document.createElement('div');
                            labWrap.style.display = 'flex'; labWrap.style.flexDirection = 'column';
                            const labLbl = document.createElement('label'); labLbl.textContent = 'Title'; labLbl.style.fontSize='0.85rem'; labLbl.style.color='#334155'; labLbl.style.marginBottom='4px';
                            const lab = document.createElement('input'); lab.type='text'; lab.value = it.label; lab.style.padding='8px 10px'; lab.style.border='1px solid #e5e7eb'; lab.style.borderRadius='8px'; lab.style.width='100%'; lab.style.minWidth='0';
                            labWrap.appendChild(labLbl); labWrap.appendChild(lab);
                            const phWrap = document.createElement('div');
                            phWrap.style.display = 'flex'; phWrap.style.flexDirection = 'column';
                            const phLbl = document.createElement('label'); phLbl.textContent = 'Phone Number'; phLbl.style.fontSize='0.85rem'; phLbl.style.color='#334155'; phLbl.style.marginBottom='4px';
                            const ph = document.createElement('input'); ph.type='text'; ph.value = it.phone; ph.style.padding='8px 10px'; ph.style.border='1px solid #e5e7eb'; ph.style.borderRadius='8px'; ph.style.width='100%'; ph.style.minWidth='0';
                            phWrap.appendChild(phLbl); phWrap.appendChild(ph);
                            left.appendChild(labWrap); left.appendChild(phWrap);

                            // Replace right-side buttons with Save/Cancel
                            btnWrap.innerHTML = '';
                            const save = document.createElement('button'); save.className='action-btn edit-btn'; save.innerHTML='<i class="fas fa-save"></i> Save'; save.style.flex='0 0 auto'; save.style.padding='8px 12px';
                            const cancel = document.createElement('button'); cancel.className='action-btn delete-btn'; cancel.textContent='Cancel'; cancel.style.flex='0 0 auto'; cancel.style.padding='8px 12px';
                            btnWrap.appendChild(save); btnWrap.appendChild(cancel);

                            save.addEventListener('click', function(){
                                const label = lab.value.trim(); const phone = ph.value.trim();
                                if (!label || !phone){ CO_showToast && CO_showToast('Please enter both title and phone.', 'warning'); return; }
                                const { ecUpdate } = endpoints(); if (!ecUpdate) return;
                                fetch(ecUpdate, {
                                    method:'POST', headers:{ 'X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded','X-CSRFToken': getCsrfToken() },
                                    body: new URLSearchParams({ contact_id: it.id, label, phone }).toString(),
                                }).then(r=>r.json()).then(data=>{
                                    if (data && data.ok){ load(); CO_showToast && CO_showToast('Contact updated.', 'success'); }
                                    else throw new Error((data && data.error)||'Update failed');
                                }).catch(err=>{ CO_showToast && CO_showToast(err.message||'Update failed','error'); });
                            });
                            cancel.addEventListener('click', function(){ load(); });
                        });
                        const del = document.createElement('button');
                        del.className = 'action-btn delete-btn';
                        del.innerHTML = '<i class="fas fa-trash"></i> Delete';
                        del.style.flex='0 0 auto'; del.style.padding='6px 10px';
                        del.addEventListener('click', function(){
                            if (!ecDelete) return;
                            fetch(ecDelete, {
                                method: 'POST',
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest',
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'X-CSRFToken': getCsrfToken(),
                                },
                                body: new URLSearchParams({ contact_id: it.id }).toString(),
                            }).then(r=>r.json()).then(data=>{
                                if (data && data.ok){ load(); CO_showToast && CO_showToast('Contact deleted.', 'success'); }
                                else throw new Error((data && data.error) || 'Delete failed');
                            }).catch(err => { CO_showToast && CO_showToast(err.message || 'Delete failed', 'error'); });
                        });
                        btnWrap.appendChild(edit); btnWrap.appendChild(del);
                        li.appendChild(btnWrap);
                        ul.appendChild(li);
                    });
                    listRoot.appendChild(ul);
                }

                function updateEmergencyCardState(count){
                    try {
                        const card = document.querySelector('.nav-card[data-target="emergency"]');
                        if (!card) return;
                        const icon = card.querySelector('.card-icon');
                        const titleEl = card.querySelector('.card-title');
                        const descEl = card.querySelector('.card-desc');
                        if (count && count > 0){
                            card.classList.remove('nav-card-warning');
                            icon && icon.classList.remove('warn-icon');
                            const b = titleEl && titleEl.querySelector('.warn-badge'); if (b) b.remove();
                            if (descEl) descEl.textContent = 'Add and manage emergency numbers';
                        } else {
                            card.classList.add('nav-card-warning');
                            icon && icon.classList.add('warn-icon');
                            if (titleEl && !titleEl.querySelector('.warn-badge')){
                                const badge = document.createElement('span');
                                badge.className = 'warn-badge';
                                badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Missing';
                                titleEl.appendChild(badge);
                            }
                            if (descEl) descEl.innerHTML = '<span class="warn-text">No contacts set — click to add now</span>';
                        }
                    } catch(e){}
                }

                function load(){
                    if (!ecList) { render([]); updateEmergencyCardState(0); return; }
                    fetch(ecList, { headers:{ 'X-Requested-With':'XMLHttpRequest' }})
                        .then(r=>r.json()).then(data => {
                            const items = (data && data.ok && Array.isArray(data.contacts)) ? data.contacts : [];
                            render(items);
                            updateEmergencyCardState(items.length || 0);
                        })
                        .catch(()=>{ render([]); updateEmergencyCardState(0); });
                }

                addBtn.addEventListener('click', function(){
                    const label = (labelInput.value || '').trim();
                    const phone = (phoneInput.value || '').trim();
                    if (!label || !phone){ CO_showToast && CO_showToast('Please enter both title and phone.', 'warning'); return; }
                    if (!ecAdd) return;
                    fetch(ecAdd, {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-CSRFToken': getCsrfToken(),
                        },
                        body: new URLSearchParams({ label, phone }).toString(),
                    }).then(r=>r.json()).then(data=>{
                        if (data && data.ok){
                            labelInput.value = '';
                            phoneInput.value = '';
                            load();
                            CO_showToast && CO_showToast('Contact added.', 'success');
                        } else {
                            throw new Error((data && data.error) || 'Add failed');
                        }
                    }).catch(err => { CO_showToast && CO_showToast(err.message || 'Add failed', 'error'); });
                });

                load();
                
                // Add close button functionality
                const closeBtn = document.getElementById('co-modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        closeAllModals();
                    });
                }
                
                // Add overlay click to close
                if (overlay) {
                    overlay.addEventListener('click', function(e) {
                        if (e.target === overlay) {
                            closeAllModals();
                        }
                    });
                }
            }

            // Expose for nav-card usage
            window.CO_openEmergencyModal = openEmergencyModal;

            // Also wire any inline manage button if present
            const btn = document.getElementById('co-ec-manage-btn');
            if (btn) btn.addEventListener('click', openEmergencyModal);
            
            // Handle screen size changes to prevent unwanted modal appearances
            let resizeTimeout;
            let lastWidth = window.innerWidth;
            window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    const currentWidth = window.innerWidth;
                    const isMobile = currentWidth <= 768;
                    const wasMobile = lastWidth <= 768;
                    
                    console.log('Resize event - Current width:', currentWidth, 'isMobile:', isMobile, 'wasMobile:', wasMobile);
                    
                    // Only act if the mobile state actually changed
                    if (isMobile !== wasMobile) {
                        if (isMobile) {
                            // Switching to mobile, close all modals and hide events section
                            console.log('Switching to mobile, closing all modals');
                            closeAllModals();
                            
                            const eventsSection = document.getElementById('events');
                            if (eventsSection) {
                                eventsSection.style.display = 'none';
                                eventsSection.style.visibility = 'hidden';
                                eventsSection.setAttribute('data-loaded', 'false');
                            }
                            
                            // Also hide the events modal if it's open
                            const eventModal = document.getElementById('co-event-modal');
                            if (eventModal) {
                                eventModal.style.display = 'none';
                                eventModal.style.visibility = 'hidden';
                                eventModal.style.opacity = '0';
                                eventModal.style.pointerEvents = 'none';
                            }
                            
                            // Also hide the delete confirmation modal if it's open
                            const deleteModal = document.getElementById('co-delete-confirm-modal');
                            if (deleteModal) {
                                deleteModal.style.display = 'none';
                                deleteModal.style.visibility = 'hidden';
                                deleteModal.style.opacity = '0';
                            }
                            
                            // Reset body styles
                            document.body.style.overflow = '';
                            document.body.classList.remove('modal-open', 'no-scroll');
                        } else {
                            // Switching to desktop, ensure modals can work properly
                            console.log('Switching to desktop');
                            const eventsSection = document.getElementById('events');
                            if (eventsSection) {
                                // Reset events section styles for desktop
                                eventsSection.style.position = '';
                                eventsSection.style.left = '';
                                eventsSection.style.top = '';
                            }
                        }
                    }
                    
                    lastWidth = currentWidth;
                }, 100);
            });
            
            // Ensure events section is hidden on mobile on page load
            const eventsSection = document.getElementById('events');
            if (eventsSection && window.innerWidth <= 768) {
                eventsSection.style.display = 'none';
                eventsSection.style.visibility = 'hidden';
                eventsSection.setAttribute('data-loaded', 'false');
            }
            
            // Also ensure any existing modals are closed on mobile
            if (window.innerWidth <= 768) {
                closeAllModals();
            }
        })();

        function findUserInState(id){
            return users.find(x => String(x.id) === String(id));
        }

        function bindRowActions() {
            const table = document.getElementById('co-users-table');
            if (!table) return;
            const csrf = getCsrfToken();
            const { update } = endpoints();
            // Attach change detection per row and wire save handler
            table.querySelectorAll('tbody tr').forEach(row => {
                const btn = row.querySelector('.co-save');
                if (!btn) return;
                const sel = row.querySelector('.co-role');
                const blk = row.querySelector('.co-block');
                const lot = row.querySelector('.co-lot');
                // Record initial values (avoid dataset writes to prevent undefined errors)
                const init = {
                    role: sel ? (sel.value || '') : '',
                    block: blk ? ((blk.value || '')) : '',
                    lot: lot ? ((lot.value || '')) : '',
                };
                // Helper to toggle button state
                const updateState = () => {
                    const changed = ((sel && (sel.value || '') !== init.role) || (blk && (blk.value || '') !== init.block) || (lot && (lot.value || '') !== init.lot));
                    btn.disabled = !changed;
                };
                updateState();
                sel && sel.addEventListener('change', updateState);
                blk && blk.addEventListener('input', updateState);
                lot && lot.addEventListener('input', updateState);

                btn.addEventListener('click', function(){
                    const id = this.getAttribute('data-id');
                    const row = this.closest('tr');
                    const role = row.querySelector('.co-role')?.value || '';
                    const block = row.querySelector('.co-block')?.value || '';
                    const lot = row.querySelector('.co-lot')?.value || '';
                    if (!update) return;
                    fetch(update, {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-CSRFToken': csrf,
                        },
                        body: new URLSearchParams({ user_id: id, role, block, lot }).toString(),
                    }).then(r=>r.json()).then(data=>{
                        if (data && data.ok && data.member) {
                            const m = data.member;
                            const u = findUserInState(m.id);
                            if (u) { u.role = m.role; u.block = m.block; u.lot = m.lot; }
                            CO_showToast && CO_showToast('Member updated.', 'success');
                            // Reset initial values and disable button again
                            init.role = sel ? (sel.value || '') : init.role;
                            init.block = blk ? ((blk.value || '')) : init.block;
                            init.lot = lot ? ((lot.value || '')) : init.lot;
                            updateState();
                        } else {
                            throw new Error((data && data.error) || 'Update failed');
                        }
                    }).catch(err => {
                        CO_showToast && CO_showToast(err.message || 'Update failed', 'error');
                    });
                });
            });
        }

        // Search and add user
        (function(){
            const searchInput = document.getElementById('co-user-search');
            const btn = document.getElementById('co-user-search-btn');
            const results = document.getElementById('co-user-search-results');
            if (!btn || !searchInput || !results) return;
            const { search, add } = endpoints();
            function renderResults(items){
                if (!Array.isArray(items) || !items.length){ results.style.display='none'; results.innerHTML=''; return; }
                results.style.display = 'block';
                results.innerHTML = '';
                const ul = document.createElement('ul');
                ul.style.listStyle='none'; ul.style.padding='0'; ul.style.margin='0';
                items.forEach(it => {
                    const li = document.createElement('li');
                    li.style.display='flex'; li.style.alignItems='center'; li.style.justifyContent='space-between'; li.style.padding='8px 6px'; li.style.borderBottom='1px solid #f1f5f9';
                    li.innerHTML = `<div><strong>${it.name||''}</strong><div style="color:#6b7280;font-size:12px;">${it.email||''}</div></div>`;
                    const addBtn = document.createElement('button');
                    addBtn.className = 'action-btn edit-btn';
                    addBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add';
                    addBtn.addEventListener('click', function(){
                        if (!add) return;
                        fetch(add, {
                            method: 'POST',
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-CSRFToken': getCsrfToken(),
                            },
                            body: new URLSearchParams({ user_id: it.id }).toString(),
                        }).then(r=>r.json()).then(data=>{
                            if (data && data.ok && data.member){
                                // Update local state and re-render row set
                                users.push({
                                    id: data.member.id,
                                    name: data.member.name,
                                    email: data.member.email,
                                    role: data.member.role,
                                    block: data.member.block || '',
                                    lot: data.member.lot || '',
                                    avatar: data.member.avatar || null,
                                });
                                renderUsersTable();
                                CO_showToast && CO_showToast('User added to your community.', 'success');
                                results.style.display='none'; results.innerHTML=''; searchInput.value='';
                            } else {
                                throw new Error((data && data.error) || 'Unable to add user');
                            }
                        }).catch(err => {
                            CO_showToast && CO_showToast(err.message || 'Unable to add user', 'error');
                        });
                    });
                    li.appendChild(addBtn);
                    ul.appendChild(li);
                });
                results.appendChild(ul);
            }
            btn.addEventListener('click', function(){
                const q = (searchInput.value || '').trim();
                if (!q){ CO_showToast && CO_showToast('Enter email or name to search.', 'warning'); return; }
                if (!search) return;
                fetch(`${search}?q=${encodeURIComponent(q)}`, { headers: { 'X-Requested-With':'XMLHttpRequest' }})
                    .then(r=>r.json()).then(data=>{
                        if (data && data.ok){ renderResults(data.results || []); }
                        else { renderResults([]); }
                    }).catch(()=> renderResults([]));
            });
        })();


        // Show reports section (replaces modal)
        function showReportsSection() {
            // Close all modals first to prevent any modal from showing
            closeAllModals();
            
            // Hide other bottom sections
            const usersSection = document.getElementById('co-users-bottom');
            const eventsSection = document.getElementById('events');
            const reportsSection = document.getElementById('co-reports-bottom');
            
            if (usersSection) usersSection.style.display = 'none';
            if (eventsSection) eventsSection.style.display = 'none';
            
            // Show reports section
            if (reportsSection) {
                reportsSection.style.display = 'block';
                
                // Scroll to reports section
                setTimeout(() => {
                    reportsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
                
                // Initialize reports if not already loaded
                if (!reportsSection.hasAttribute('data-initialized')) {
                    initializeReportsSection();
                    reportsSection.setAttribute('data-initialized', 'true');
                } else {
                    // Reload reports with current filters
                    loadReportsTable();
                }
            }
        }
        
        // Initialize reports section
        function initializeReportsSection() {
            // Close all modals to ensure nothing is showing
            closeAllModals();
            
            // Ensure report detail modal is hidden on initialization
            const modal = document.getElementById('co-report-detail-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
            }
            
            // Ensure delete confirmation modal is hidden
            const deleteModal = document.getElementById('co-delete-confirm-modal');
            if (deleteModal) {
                deleteModal.style.display = 'none';
                deleteModal.style.visibility = 'hidden';
                deleteModal.style.opacity = '0';
            }
            
            // Ensure event modal is hidden
            const eventModal = document.getElementById('co-event-modal');
            if (eventModal) {
                eventModal.style.display = 'none';
                eventModal.style.visibility = 'hidden';
                eventModal.style.opacity = '0';
            }
            
            // Populate year filter
            const yearFilter = document.getElementById('co-report-year-filter');
            if (yearFilter) {
                const currentYear = new Date().getFullYear();
                const startYear = 2020; // Start from 2020
                yearFilter.innerHTML = '<option value="">All Years</option>';
                for (let year = currentYear; year >= startYear; year--) {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    yearFilter.appendChild(option);
                }
            }
            
            // Set default filters to current month/year
                const now = new Date();
                const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            if (yearFilter) yearFilter.value = currentYear.toString();
            const monthFilter = document.getElementById('co-report-month-filter');
            if (monthFilter) monthFilter.value = currentMonth.toString();
            
            // Bind filter events
            bindReportsFilters();
            
            // Load initial reports
            loadReportsTable();
        }
        
        // Bind reports filter events
        function bindReportsFilters() {
            const searchInput = document.getElementById('co-report-search');
            const statusFilter = document.getElementById('co-report-status-filter');
            const priorityFilter = document.getElementById('co-report-priority-filter');
            const typeFilter = document.getElementById('co-report-type-filter');
            const yearFilter = document.getElementById('co-report-year-filter');
            const monthFilter = document.getElementById('co-report-month-filter');
            const downloadBtn = document.getElementById('co-reports-download-pdf');
            const analyticsBtn = document.getElementById('co-reports-analytics');
            
            // Debounce search
            let searchTimeout;
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        loadReportsTable();
                    }, 300);
                });
            }
            
            // Filter change handlers
            [statusFilter, priorityFilter, typeFilter].forEach(filter => {
                if (filter) {
                    filter.addEventListener('change', () => {
                        loadReportsTable();
                        updateReportsSummary();
                    });
                }
            });
            
            // Year and Month filters - update analytics if trend view is visible
            [yearFilter, monthFilter].forEach(filter => {
                if (filter) {
                    filter.addEventListener('change', () => {
                        const tableView = document.getElementById('co-reports-table-view');
                        const trendView = document.getElementById('co-reports-trend-view');
                        
                        // Check if trend view is currently visible
                        if (trendView && trendView.style.display !== 'none' && tableView && tableView.style.display === 'none') {
                            // Reload analytics with new filters
                            const year = yearFilter ? yearFilter.value : '';
                            const month = monthFilter ? monthFilter.value : '';
                            showReportsTrend(year, month);
                        } else {
                            // Otherwise just update table
                            loadReportsTable();
                            updateReportsSummary();
                        }
                    });
                }
            });
            
            // Action buttons
            if (downloadBtn) {
                downloadBtn.addEventListener('click', function() {
                    const year = yearFilter ? yearFilter.value : '';
                    const month = monthFilter ? monthFilter.value : '';
                    actualDownload('pdf', year, month);
                });
            }

            if (analyticsBtn) {
                analyticsBtn.addEventListener('click', function() {
                    const viewMode = this.getAttribute('data-view-mode');
                    if (viewMode === 'trend') {
                        // Switch back to table
                        showReportsTable();
                    } else {
                        // Switch to trend view
                    const year = yearFilter ? yearFilter.value : '';
                    const month = monthFilter ? monthFilter.value : '';
                        showReportsTrend(year, month);
                    }
                });
            }
        }
        
        // Load reports table
        let currentReportsPage = 1;
        function loadReportsTable(page = 1) {
            currentReportsPage = page;
            const tbody = document.getElementById('co-reports-tbody');
            if (!tbody) return;
            
            // Show loading state
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:40px;text-align:center;color:#6b7280;">
                        <i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;display:block;"></i>
                        Loading reports...
                    </td>
                </tr>
            `;
            
            // Get filter values
            const searchInput = document.getElementById('co-report-search');
            const statusFilter = document.getElementById('co-report-status-filter');
            const priorityFilter = document.getElementById('co-report-priority-filter');
            const typeFilter = document.getElementById('co-report-type-filter');
            const yearFilter = document.getElementById('co-report-year-filter');
            const monthFilter = document.getElementById('co-report-month-filter');
            
            const params = new URLSearchParams({
                page: page,
                per_page: 10
            });
            
            if (searchInput && searchInput.value) params.append('search', searchInput.value);
            if (statusFilter && statusFilter.value) params.append('status', statusFilter.value);
            if (priorityFilter && priorityFilter.value) params.append('priority', priorityFilter.value);
            if (typeFilter && typeFilter.value) params.append('target_type', typeFilter.value);
            if (yearFilter && yearFilter.value) params.append('year', yearFilter.value);
            if (monthFilter && monthFilter.value) params.append('month', monthFilter.value);
            
            const { reportsList } = endpoints();
            if (!reportsList) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#dc2626;">Error: API endpoint not found</td></tr>';
                return;
            }
            
            fetch(`${reportsList}?${params.toString()}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok && Array.isArray(data.reports)) {
                    renderReportsTable(data.reports, data.pagination);
                    updateReportsSummary();
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#dc2626;">Error loading reports</td></tr>';
                }
            })
            .catch(err => {
                console.error('Failed to load reports:', err);
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#dc2626;">Error loading reports. Please try again.</td></tr>';
            });
        }
        
        // Render reports table
        function renderReportsTable(reports, pagination) {
            const tbody = document.getElementById('co-reports-tbody');
            if (!tbody) return;
            
            if (reports.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="padding:40px;text-align:center;color:#6b7280;">
                            <i class="fas fa-inbox" style="font-size:48px;margin-bottom:15px;display:block;opacity:0.3;"></i>
                            <p style="font-size:16px;margin:0;">No reports found matching your filters.</p>
                        </td>
                    </tr>
                `;
                renderReportsPagination(null);
                return;
            }
            
            tbody.innerHTML = reports.map(report => {
                const priorityClass = `priority-${report.priority}`;
                const statusClass = `status-${report.status}`;
                const priorityLabel = report.priority.replace('level_', 'Level ');
                const statusLabel = report.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                const date = new Date(report.created_at);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                // Process reasons - if "Other" is in the list, use details instead
                let reasons = report.reasons || 'N/A';
                const reasonsList = report.reasons_list || [];
                
                // If "Other" is in reasons, replace it with details
                if (reasonsList && (reasonsList.includes('Other') || reasonsList.some(r => r && r.toLowerCase() === 'other'))) {
                    const reasonsArray = typeof reasons === 'string' ? reasons.split(', ') : [];
                    const filteredReasons = reasonsArray.filter(r => r && r.toLowerCase() !== 'other');
                    if (report.details) {
                        filteredReasons.push(report.details);
                    }
                    reasons = filteredReasons.join(', ') || 'N/A';
                }
                
                const reasonsDisplay = reasons.length > 50 ? reasons.substring(0, 50) + '...' : reasons;
                
                // Clean up subject: remove "Report:" prefix, but keep "Non-Resident" intact
                let cleanSubject = report.subject || '';
                cleanSubject = cleanSubject.replace(/^Report:\s*/i, '').trim();
                // Only remove standalone "Resident" word, not "Non-Resident"
                cleanSubject = cleanSubject.replace(/(?<!Non-)\bResident\b/gi, '').trim();
                cleanSubject = cleanSubject.replace(/\s+/g, ' ').trim();
                
                return `
                    <tr style="border-bottom:1px solid #e5e7eb;transition:background 0.2s;cursor:pointer;" 
                        onmouseover="this.style.background='#f3f4f6'" 
                        onmouseout="this.style.background=''"
                        data-report-id="${report.id}"
                        class="report-row">
                        <td style="padding:12px 16px;color:#6b7280;">${escapeHtml(report.reporter_display || 'Anonymous')}</td>
                        <td style="padding:12px 16px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(reasons)}">${escapeHtml(reasonsDisplay)}</td>
                        <td style="padding:12px 16px;">
                            <div style="font-weight:500;color:#1f2937;">${escapeHtml(cleanSubject)}</div>
                        </td>
                        <td style="padding:12px 16px;">
                            <span class="badge ${statusClass}" style="padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-transform:uppercase;">${statusLabel}</span>
                        </td>
                        <td style="padding:12px 16px;">
                            <span class="badge ${priorityClass}" style="padding:4px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-transform:uppercase;">${priorityLabel}</span>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Bind click handlers to rows (with mobile touch support)
            tbody.querySelectorAll('.report-row').forEach(row => {
                let touchStartTime = null;
                let touchStartY = 0;
                let touchMoved = false;
                let clickAllowed = true;
                
                // Handle touch start for mobile
                row.addEventListener('touchstart', function(e) {
                    touchStartTime = Date.now();
                    touchStartY = e.touches[0].clientY;
                    touchMoved = false;
                    clickAllowed = true;
                }, { passive: true });
                
                // Track if user is scrolling
                row.addEventListener('touchmove', function(e) {
                    if (touchStartTime !== null) {
                        const currentY = e.touches[0].clientY;
                        if (Math.abs(currentY - touchStartY) > 10) {
                            touchMoved = true;
                            clickAllowed = false;
                        }
                    }
                }, { passive: true });
                
                // Reset on touch end
                row.addEventListener('touchend', function(e) {
                    if (touchStartTime !== null) {
                        const touchDuration = Date.now() - touchStartTime;
                        // If it was a long press (> 500ms) or user scrolled, don't allow click
                        if (touchDuration > 500 || touchMoved) {
                            clickAllowed = false;
                        }
                        // Reset after a short delay
            setTimeout(() => {
                            touchStartTime = null;
                            touchMoved = false;
                            clickAllowed = true;
                        }, 100);
                    }
                }, { passive: true });
                
                // Handle click/tap
                row.addEventListener('click', function(e) {
                    // Prevent accidental triggers on mobile
                    // Only trigger if it's a mouse click OR a valid touch tap
                    const isMouseClick = touchStartTime === null;
                    const isValidTouch = touchStartTime !== null && clickAllowed && !touchMoved;
                    
                    if (isMouseClick || isValidTouch) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const reportId = this.getAttribute('data-report-id');
                        if (reportId) {
                            showReportDetailModal(reportId);
                        }
                    }
                });
            });
            
            renderReportsPagination(pagination);
        }
        
        // Show report detail modal
        function showReportDetailModal(reportId) {
            const modal = document.getElementById('co-report-detail-modal');
            const content = document.getElementById('co-report-detail-content');
            const closeBtn = document.getElementById('co-report-detail-close');
            
            if (!modal || !content) return;
            
            // Show modal with loading state
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            content.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size:24px;color:#3b82f6;"></i>
                    <p style="margin-top:15px;color:#6b7280;">Loading report details...</p>
                </div>
            `;
            
            // Lock body scroll
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    document.body.classList.add('modal-open');
                    if (sbw > 0) {
                        document.body.style.paddingRight = sbw + 'px';
                    }
                } catch (e) {}
            
            // Fetch report details
            const { reportsDetail } = endpoints();
            if (!reportsDetail) {
                content.innerHTML = '<div style="padding:20px;color:#dc2626;">Error: API endpoint not found</div>';
                return;
            }
            
            const detailUrl = reportsDetail.replace('0', reportId);
            fetch(detailUrl, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok && data.report) {
                    renderReportDetail(data.report);
                } else {
                    content.innerHTML = `<div style="padding:20px;color:#dc2626;">Error: ${data.error || 'Failed to load report details'}</div>`;
                }
            })
            .catch(err => {
                console.error('Failed to load report details:', err);
                content.innerHTML = '<div style="padding:20px;color:#dc2626;">Error loading report details. Please try again.</div>';
            });
            
            // Close button handler
            if (closeBtn) {
                closeBtn.onclick = () => closeReportDetailModal();
            }
            
            // Close on overlay click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeReportDetailModal();
                }
            };
        }
        
        // Render report detail content
        function renderReportDetail(report) {
            const content = document.getElementById('co-report-detail-content');
            if (!content) return;
            
            // Process reasons - if "Other" is in the list, use details instead
            let reasons = report.reasons || 'N/A';
            const reasonsList = report.reasons_list || [];
            
            // If "Other" is in reasons, replace it with details
            if (reasonsList && (reasonsList.includes('Other') || reasonsList.some(r => r && r.toLowerCase() === 'other'))) {
                const reasonsArray = typeof reasons === 'string' ? reasons.split(', ') : [];
                const filteredReasons = reasonsArray.filter(r => r && r.toLowerCase() !== 'other');
                if (report.details) {
                    filteredReasons.push(report.details);
                }
                reasons = filteredReasons.join(', ') || 'N/A';
            }
            
            // Clean up subject - keep "Non-Resident" intact
            let cleanSubject = report.subject || '';
            cleanSubject = cleanSubject.replace(/^Report:\s*/i, '').trim();
            // Only remove standalone "Resident" word, not "Non-Resident"
            cleanSubject = cleanSubject.replace(/(?<!Non-)\bResident\b/gi, '').trim();
            cleanSubject = cleanSubject.replace(/\s+/g, ' ').trim();
            // If it's just "Non-" left, restore "Non-Resident"
            if (cleanSubject === 'Non-') {
                cleanSubject = 'Non-Resident';
            }
            
            const priorityClass = `priority-${report.priority}`;
            const statusClass = `status-${report.status}`;
            const priorityLabel = report.priority.replace('level_', 'Level ');
            const statusLabel = report.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            const createdDate = new Date(report.created_at);
            const formattedCreatedDate = createdDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            content.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:20px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                        <div>
                            <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Complainant</label>
                            <div style="font-size:1rem;color:#1f2937;">${escapeHtml(report.reporter_display || 'Anonymous')}</div>
                            </div>
                        <div>
                            <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Complainee</label>
                            <div style="font-size:1rem;color:#1f2937;">${escapeHtml(cleanSubject)}</div>
                            </div>
                            </div>
                    
                    <div>
                        <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Reason</label>
                        <div style="font-size:1rem;color:#1f2937;padding:12px;background:#f9fafb;border-radius:8px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(reasons)}</div>
                            </div>
                    
                    ${report.message ? `
                    <div>
                        <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Details</label>
                        <div style="font-size:1rem;color:#1f2937;padding:12px;background:#f9fafb;border-radius:8px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;line-height:1.6;">${escapeHtml(report.message.replace(/^Details:\s*/i, '').trim())}</div>
                        </div>
                    ` : ''}
                    
                    ${report.location ? `
                    <div>
                        <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Location</label>
                        <div style="font-size:1rem;color:#1f2937;">${escapeHtml(report.location)}</div>
                        </div>
                    ` : ''}
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
                        <div>
                            <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Status</label>
                            <div>
                                <span class="badge ${statusClass}" style="padding:6px 12px;border-radius:12px;font-size:0.875rem;font-weight:600;text-transform:uppercase;">${statusLabel}</span>
                        </div>
                    </div>
                        <div>
                            <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Priority</label>
                            <div>
                                <span class="badge ${priorityClass}" style="padding:6px 12px;border-radius:12px;font-size:0.875rem;font-weight:600;text-transform:uppercase;">${priorityLabel}</span>
                        </div>
                    </div>
                        <div>
                            <label style="display:block;font-size:0.875rem;font-weight:600;color:#6b7280;margin-bottom:6px;">Reported On</label>
                            <div style="font-size:0.875rem;color:#6b7280;">${formattedCreatedDate}</div>
                    </div>
                    </div>
                </div>
            `;
        }
        
        // Close report detail modal
        function closeReportDetailModal() {
            const modal = document.getElementById('co-report-detail-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
            }
            
            // Unlock body scroll
            try {
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
            } catch (e) {}
        }
        
        // Render pagination (same style as Manage Users)
        function renderReportsPagination(pagination) {
            const paginationEl = document.getElementById('co-reports-pagination');
            if (!paginationEl) return;
            
            if (!pagination || pagination.total_pages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }
            
            const currentPage = pagination.current_page;
            const totalPages = pagination.total_pages;
            
            // Helper function to create pagination buttons (same style as Manage Users)
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
                    // Page numbers are unclickable but look normal
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
                        loadReportsTable(p);
                    });
                }
                return b;
            };
            
            paginationEl.innerHTML = '';
            
            // Only show Previous button if not on first page
            if (currentPage > 1) {
                paginationEl.appendChild(mk('Prev', Math.max(1, currentPage - 1), false, false));
            }
            
            // Show only current page number
            paginationEl.appendChild(mk(String(currentPage), currentPage, false, true, true));
            
            // Only show Next button if not on last page
            if (currentPage < totalPages) {
                paginationEl.appendChild(mk('Next', Math.min(totalPages, currentPage + 1), false, false));
            }
        }
        
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Render reports with analytics (legacy function - now redirects to showReportsSection)
        function renderReports() {
            showReportsSection();
        }

        // Helper functions for filtering
        function getFilterText(year, month) {
            if (year && month) {
                return ` for ${getMonthName(month)} ${year}`;
            } else if (year) {
                return ` for ${year}`;
            } else if (month) {
                return ` for ${getMonthName(month)}`;
            }
            return '';
        }

        function getMonthName(month) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return months[parseInt(month) - 1] || '';
        }

        // Update reports summary based on filters
        function updateReportsSummary() {
            const yearFilter = document.getElementById('co-report-year-filter');
            const monthFilter = document.getElementById('co-report-month-filter');
            const statusFilter = document.getElementById('co-report-status-filter');
            const priorityFilter = document.getElementById('co-report-priority-filter');
            const typeFilter = document.getElementById('co-report-type-filter');
            const searchInput = document.getElementById('co-report-search');
            
            const totalCountEl = document.getElementById('co-total-reports-count');
            const filteredCountEl = document.getElementById('co-filtered-reports-count');
            const pendingCountEl = document.getElementById('co-pending-count');
            const investigatingCountEl = document.getElementById('co-investigating-count');
            const falseAlarmCountEl = document.getElementById('co-false-alarm-count');
            const resolvedCountEl = document.getElementById('co-resolved-count');
            
            if (!totalCountEl || !filteredCountEl) return;
            
            // Get total reports count
            const { reportsList } = endpoints();
            if (!reportsList) return;
            
            // Build filter parameters for API call
            const year = yearFilter ? yearFilter.value : '';
            const month = monthFilter ? monthFilter.value : '';
            const status = statusFilter ? statusFilter.value : '';
            const priority = priorityFilter ? priorityFilter.value : '';
            const type = typeFilter ? typeFilter.value : '';
            const search = searchInput ? searchInput.value : '';
            
            // Build query string with all filters
            const params = new URLSearchParams();
            params.append('per_page', '1000');
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            if (status) params.append('status', status);
            if (priority) params.append('priority', priority);
            if (type) params.append('target_type', type);
            if (search) params.append('search', search);
            
            fetch(`${reportsList}?${params.toString()}`, { 
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok && Array.isArray(data.reports)) {
                    // Get total reports (unfiltered) for comparison
                    const totalReportsParams = new URLSearchParams();
                    totalReportsParams.append('per_page', '1000');
                    return fetch(`${reportsList}?${totalReportsParams.toString()}`, { 
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    })
                    .then(r2 => r2.json())
                    .then(totalData => {
                        if (totalData && totalData.ok && Array.isArray(totalData.reports)) {
                            // Total reports (unfiltered)
                            totalCountEl.textContent = totalData.reports.length;
                        }
                        
                        // Filtered reports count
                        const filteredReports = data.reports;
                        filteredCountEl.textContent = filteredReports.length;
                        
                        // Count statuses from FILTERED reports
                        const pending = filteredReports.filter(r => r.status === 'pending').length;
                        const investigating = filteredReports.filter(r => r.status === 'investigating').length;
                        const falseAlarm = filteredReports.filter(r => r.status === 'false_alarm').length;
                        const resolved = filteredReports.filter(r => r.status === 'resolved').length;
                        
                        if (pendingCountEl) pendingCountEl.textContent = pending;
                        if (investigatingCountEl) investigatingCountEl.textContent = investigating;
                        if (falseAlarmCountEl) falseAlarmCountEl.textContent = falseAlarm;
                        if (resolvedCountEl) resolvedCountEl.textContent = resolved;
                    });
                }
            })
            .catch(err => {
                console.error('Failed to load reports summary:', err);
                totalCountEl.textContent = '-';
                filteredCountEl.textContent = '-';
                if (pendingCountEl) pendingCountEl.textContent = '-';
                if (investigatingCountEl) investigatingCountEl.textContent = '-';
                if (falseAlarmCountEl) falseAlarmCountEl.textContent = '-';
                if (resolvedCountEl) resolvedCountEl.textContent = '-';
            });
        }
        
        // Make loadReportsTable globally accessible for pagination
        window.loadReportsTable = loadReportsTable;

        // Preview functions removed - direct download only

        // Comprehensive modal cleanup function
        function closeAllModals() {
            // Close the modal overlay
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.visibility = 'hidden';
                overlay.style.opacity = '0';
                overlay.classList.remove('active', 'show');
            }
            
            // Close the delete confirmation modal
            const deleteModal = document.getElementById('co-delete-confirm-modal');
            if (deleteModal) {
                deleteModal.style.display = 'none';
                deleteModal.style.visibility = 'hidden';
                deleteModal.style.opacity = '0';
            }
            
            // Close event modal
            const eventModal = document.getElementById('co-event-modal');
            if (eventModal) {
                eventModal.style.display = 'none';
                eventModal.style.visibility = 'hidden';
                eventModal.style.opacity = '0';
                eventModal.style.pointerEvents = 'none';
            }
            
            // Close report detail modal
            const reportDetailModal = document.getElementById('co-report-detail-modal');
            if (reportDetailModal) {
                reportDetailModal.style.display = 'none';
                reportDetailModal.style.visibility = 'hidden';
                reportDetailModal.style.opacity = '0';
            }
            
            // Reset document and body styles completely - restore scroll position
            unlockBodyScroll();
            
            // Clear modal content
            if (modalShell) {
                modalShell.innerHTML = '';
            }
            
            // Reset modal title
            if (modalTitle) {
                modalTitle.textContent = '';
            }
            
            // Remove any backdrop elements
            const backdrops = document.querySelectorAll('.modal-backdrop, .backdrop, [class*="backdrop"]');
            backdrops.forEach(backdrop => {
                backdrop.remove();
            });
        }

        // Direct download function (no modal/preview)
        function actualDownload(format, year = '', month = '') {
            const { reportsDownloadPdf } = endpoints();
            let url = reportsDownloadPdf;
            
            if (!url) {
                CO_showToast && CO_showToast('Download URL not found', 'error');
                return;
            }

            // Add filter parameters to URL
            const params = new URLSearchParams();
            const statusFilter = document.getElementById('co-report-status-filter');
            const priorityFilter = document.getElementById('co-report-priority-filter');
            const typeFilter = document.getElementById('co-report-type-filter');
            const searchInput = document.getElementById('co-report-search');
            
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            if (statusFilter && statusFilter.value) params.append('status', statusFilter.value);
            if (priorityFilter && priorityFilter.value) params.append('priority', priorityFilter.value);
            if (typeFilter && typeFilter.value) params.append('target_type', typeFilter.value);
            if (searchInput && searchInput.value) params.append('search', searchInput.value);
            
            params.append('_t', Date.now()); // Cache busting
            
            if (params.toString()) {
                url += (url.includes('?') ? '&' : '?') + params.toString();
            }

            // Show loading message
            const filterText = getFilterText(year, month);
            CO_showToast && CO_showToast(`Downloading PDF${filterText}...`, 'info');
            
            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message
            setTimeout(() => {
                CO_showToast && CO_showToast(`PDF download${filterText} started`, 'success');
            }, 500);
        }

        // Show reports trend/analytics view (replaces modal)
        function showReportsTrend(year = '', month = '') {
            const tableView = document.getElementById('co-reports-table-view');
            const trendView = document.getElementById('co-reports-trend-view');
            const analyticsBtn = document.getElementById('co-reports-analytics');
            
            if (!tableView || !trendView) return;
            
            // Hide table view and show trend view
            tableView.style.display = 'none';
            trendView.style.display = 'block';
            
            // Update Analytics button to show "Back to Table"
            if (analyticsBtn) {
                analyticsBtn.innerHTML = '<i class="fas fa-table"></i> Back to Table';
                analyticsBtn.setAttribute('data-view-mode', 'trend');
            }
            
            // Show loading state
            trendView.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size:24px;color:#3b82f6;"></i>
                    <p style="margin-top:15px;color:#6b7280;">Loading analytics...</p>
                </div>
            `;
            
            // Fetch analytics data
            const { reportsAnalytics } = endpoints();
            if (!reportsAnalytics) {
                trendView.innerHTML = '<div style="padding:20px;color:#dc2626;">Error: API endpoint not found</div>';
                return;
            }

            // Add filter parameters to URL
            let url = reportsAnalytics;
            const params = new URLSearchParams();
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            
            if (params.toString()) {
                url += (url.includes('?') ? '&' : '?') + params.toString();
            }

            fetch(url, { 
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok && data.analytics) {
                    renderReportsTrend(data.analytics, year, month);
                } else {
                    trendView.innerHTML = '<div style="padding:20px;color:#dc2626;">Error loading analytics</div>';
                }
            })
            .catch(err => {
                console.error('Failed to load analytics:', err);
                trendView.innerHTML = '<div style="padding:20px;color:#dc2626;">Error loading analytics. Please try again.</div>';
            });
        }
        
        // Show table view (back from trend)
        function showReportsTable() {
            const tableView = document.getElementById('co-reports-table-view');
            const trendView = document.getElementById('co-reports-trend-view');
            const analyticsBtn = document.getElementById('co-reports-analytics');
            
            if (!tableView || !trendView) return;
            
            // Destroy charts before hiding
            destroyAnalyticsCharts();
            
            // Hide trend view and show table view
            trendView.style.display = 'none';
            tableView.style.display = 'block';
            
            // Update Statistics button back to original
            if (analyticsBtn) {
                analyticsBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Statistics';
                analyticsBtn.setAttribute('data-view-mode', 'table');
            }
        }
        
        // Chart instances storage
        let analyticsCharts = {};
        
        // Destroy existing charts
        function destroyAnalyticsCharts() {
            Object.values(analyticsCharts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            analyticsCharts = {};
        }
        
        // Render reports trend/analytics view with Chart.js
        function renderReportsTrend(analytics, year = '', month = '') {
            const trendView = document.getElementById('co-reports-trend-view');
            if (!trendView) return;
            
            // Destroy any existing charts
            destroyAnalyticsCharts();
            
            const filterText = getFilterText(year, month);
            
            // Create chart containers
            trendView.innerHTML = `
                <div class="analytics-header" style="margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e5e7eb;">
                    <h2 style="margin:0;font-size:1.75rem;font-weight:700;color:#1f2937;">Reports Statistics${filterText}</h2>
                    <p style="margin:8px 0 0;color:#6b7280;font-size:0.95rem;">Visual insights and trends for your security reports</p>
                        </div>
                
                <!-- Summary Stats -->
                <div class="analytics-stats-grid" style="display:grid;gap:20px;margin-bottom:32px;">
                    <div class="stat-card" style="background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);padding:24px;border-radius:16px;box-shadow:0 4px 12px rgba(59,130,246,0.3);color:white;">
                        <div style="font-size:0.875rem;opacity:0.9;margin-bottom:8px;font-weight:500;">Total Reports</div>
                        <div style="font-size:2.5rem;font-weight:700;">${analytics.total_reports || 0}</div>
                        </div>
                    <div class="stat-card" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:24px;border-radius:16px;box-shadow:0 4px 12px rgba(16,185,129,0.3);color:white;">
                        <div style="font-size:0.875rem;opacity:0.9;margin-bottom:8px;font-weight:500;">Resident Reports</div>
                        <div style="font-size:2.5rem;font-weight:700;">${analytics.resident_reports || 0}</div>
                    </div>
                    <div class="stat-card" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);padding:24px;border-radius:16px;box-shadow:0 4px 12px rgba(245,158,11,0.3);color:white;">
                        <div style="font-size:0.875rem;opacity:0.9;margin-bottom:8px;font-weight:500;">Non-Resident Reports</div>
                        <div style="font-size:2.5rem;font-weight:700;">${analytics.non_resident_reports || 0}</div>
                        </div>
                    </div>
                    
                <!-- Charts Grid -->
                <div class="charts-grid" style="display:grid;gap:24px;margin-bottom:32px;">
                    <!-- Monthly Trends Bar Chart -->
                    <div class="chart-container" style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <h3 style="margin:0 0 20px;font-size:1.125rem;font-weight:600;color:#1f2937;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">Monthly Trends</h3>
                        <canvas id="monthlyTrendsChart"></canvas>
                        </div>
                    
                    <!-- Status Breakdown Pie Chart -->
                    <div class="chart-container" style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <h3 style="margin:0 0 20px;font-size:1.125rem;font-weight:600;color:#1f2937;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">Status Breakdown</h3>
                        <canvas id="statusChart"></canvas>
                    </div>
                    
                    <!-- Priority Breakdown Doughnut Chart -->
                    <div class="chart-container" style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <h3 style="margin:0 0 20px;font-size:1.125rem;font-weight:600;color:#1f2937;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">Priority Breakdown</h3>
                        <canvas id="priorityChart"></canvas>
                    </div>
                    
                    <!-- Common Reasons Bar Chart -->
                    ${analytics.common_reasons && analytics.common_reasons.length > 0 ? `
                    <div class="chart-container" style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        <h3 style="margin:0 0 20px;font-size:1.125rem;font-weight:600;color:#1f2937;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">Common Reasons</h3>
                        <canvas id="reasonsChart"></canvas>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Wait for DOM to update, then create charts
            setTimeout(() => {
                createAnalyticsCharts(analytics);
            }, 100);
        }
        
        // Create all analytics charts
        function createAnalyticsCharts(analytics) {
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                return;
            }
            
            // Monthly Trends Bar Chart
            if (analytics.monthly_trends && analytics.monthly_trends.length > 0) {
                const monthlyCtx = document.getElementById('monthlyTrendsChart');
                if (monthlyCtx) {
                    const labels = analytics.monthly_trends.map(t => {
                        const date = new Date(t.month + '-01');
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    });
                    const data = analytics.monthly_trends.map(t => t.count);
                    
                    analyticsCharts.monthlyTrends = new Chart(monthlyCtx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Reports',
                                data: data,
                                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                                borderColor: 'rgba(59, 130, 246, 1)',
                                borderWidth: 2,
                                borderRadius: 8,
                                borderSkipped: false,
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: false
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    padding: 12,
                                    titleFont: { size: 14, weight: 'bold' },
                                    bodyFont: { size: 13 },
                                    cornerRadius: 8
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1,
                                        font: { size: 12 }
                                    },
                                    grid: {
                                        color: 'rgba(0, 0, 0, 0.05)'
                                    }
                                },
                                x: {
                                    ticks: {
                                        font: { size: 11 },
                                        maxRotation: 45,
                                        minRotation: 45
                                    },
                                    grid: {
                                        display: false
                                    }
                                }
                            }
                        }
                    });
                }
            }
            
            // Status Breakdown Pie Chart
            const statusCtx = document.getElementById('statusChart');
            if (statusCtx && analytics.status_breakdown) {
                const statusData = Object.entries(analytics.status_breakdown)
                    .filter(([_, count]) => count > 0)
                    .map(([status, count]) => ({
                        label: status.replace('_', ' ').split(' ').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' '),
                        value: count
                    }));
                
                const statusColors = {
                    'Pending': 'rgba(59, 130, 246, 0.8)',
                    'Investigating': 'rgba(245, 158, 11, 0.8)',
                    'Resolved': 'rgba(16, 185, 129, 0.8)',
                    'False Alarm': 'rgba(239, 68, 68, 0.8)'
                };
                
                analyticsCharts.status = new Chart(statusCtx, {
                    type: 'pie',
                    data: {
                        labels: statusData.map(d => d.label),
                        datasets: [{
                            data: statusData.map(d => d.value),
                            backgroundColor: statusData.map(d => statusColors[d.label] || 'rgba(156, 163, 175, 0.8)'),
                            borderColor: '#ffffff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    font: { size: 12 },
                                    usePointStyle: true
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // Priority Breakdown Doughnut Chart
            const priorityCtx = document.getElementById('priorityChart');
            if (priorityCtx && analytics.priority_breakdown) {
                const priorityData = Object.entries(analytics.priority_breakdown)
                    .filter(([_, count]) => count > 0)
                    .map(([priority, count]) => ({
                        label: priority.replace('level_', 'Level '),
                        value: count
                    }));
                
                const priorityColors = {
                    'Level 1': 'rgba(16, 185, 129, 0.8)',
                    'Level 2': 'rgba(245, 158, 11, 0.8)',
                    'Level 3': 'rgba(239, 68, 68, 0.8)'
                };
                
                analyticsCharts.priority = new Chart(priorityCtx, {
                    type: 'doughnut',
                    data: {
                        labels: priorityData.map(d => d.label),
                        datasets: [{
                            data: priorityData.map(d => d.value),
                            backgroundColor: priorityData.map(d => priorityColors[d.label] || 'rgba(156, 163, 175, 0.8)'),
                            borderColor: '#ffffff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    font: { size: 12 },
                                    usePointStyle: true
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // Common Reasons Horizontal Bar Chart
            if (analytics.common_reasons && analytics.common_reasons.length > 0) {
                const reasonsCtx = document.getElementById('reasonsChart');
                if (reasonsCtx) {
                    const reasonsLabels = analytics.common_reasons.map(r => {
                        const text = r.reason.length > 30 ? r.reason.substring(0, 30) + '...' : r.reason;
                        return escapeHtml(text);
                    });
                    const reasonsData = analytics.common_reasons.map(r => r.count);
                    
                    analyticsCharts.reasons = new Chart(reasonsCtx, {
                        type: 'bar',
                        data: {
                            labels: reasonsLabels,
                            datasets: [{
                                label: 'Count',
                                data: reasonsData,
                                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                                borderColor: 'rgba(139, 92, 246, 1)',
                                borderWidth: 2,
                                borderRadius: 8
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: false
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    padding: 12,
                                    callbacks: {
                                        title: function(context) {
                                            const index = context[0].dataIndex;
                                            return analytics.common_reasons[index].reason;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1,
                                        font: { size: 12 }
                                    },
                                    grid: {
                                        color: 'rgba(0, 0, 0, 0.05)'
                                    }
                                },
                                y: {
                                    ticks: {
                                        font: { size: 11 }
                                    },
                                    grid: {
                                        display: false
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }


        // Removed renderDownloadOptions and renderBillingHistory

        // Add User modal with server search
        function openAddUserModal(){
            const { search, add } = endpoints();
            if (!overlay || !modalShell) return;
            if (modalTitle) modalTitle.textContent = 'Add User';
            modalShell.innerHTML = `
                <div class="co-add-user-modal">
                    <div class="co-add-row" style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
                        <input id=\"co-add-search-input\" type=\"text\" placeholder=\"Search by email or full name\" style=\"flex:1;min-width:280px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;\" />
                        <button id=\"co-add-search-btn\" class=\"action-btn edit-btn\"><i class=\"fas fa-search\"></i> Search</button>
                    </div>
                    <div id=\"co-add-search-results\" style=\"max-height:300px;overflow:auto;border:1px solid #f1f5f9;border-radius:8px;\"></div>
                    <div style=\"display:flex;justify-content:flex-end;margin-top:12px;gap:8px;\">
                        <button id=\"co-add-cancel\" class=\"action-btn delete-btn\" type=\"button\">Cancel</button>
                    </div>
                </div>`;
            overlay.style.display = 'flex';
            try {
                const sbw = window.innerWidth - document.documentElement.clientWidth;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
            } catch (e) {}

            const searchInput = document.getElementById('co-add-search-input');
            const searchBtn = document.getElementById('co-add-search-btn');
            const results = document.getElementById('co-add-search-results');
            const cancelBtn = document.getElementById('co-add-cancel');

            function renderResults(items, query){
                results.innerHTML = '';
                if (!Array.isArray(items) || !items.length){
                    const q = (query||'').replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]));
                    results.innerHTML = `<div style="padding:10px;color:#6b7280;">No users found for "${q}"</div>`;
                    return;
                }
                const ul = document.createElement('ul');
                ul.className = 'co-add-results';
                ul.style.listStyle='none'; ul.style.padding='0'; ul.style.margin='0';
                items.forEach(it => {
                    const li = document.createElement('li');
                    li.style.display='flex'; li.style.alignItems='center'; li.style.justifyContent='space-between'; li.style.padding='10px 12px'; li.style.borderBottom='1px solid #f1f5f9';
                    const left = document.createElement('div');
                    left.style.display = 'flex'; left.style.alignItems='center'; left.style.gap='10px';
                    const avatarWrap = document.createElement('div');
                    avatarWrap.className = 'co-search-avatar';
                    if (it.avatar) {
                        const img = document.createElement('img');
                        img.src = it.avatar; img.alt = (it.name||'');
                        avatarWrap.appendChild(img);
                    } else {
                        const span = document.createElement('span');
                        const nm = (it.name||'').trim();
                        const parts = nm.split(/\s+/).filter(Boolean);
                        const initials = parts.length>1 ? (parts[0][0]+parts[parts.length-1][0]) : (nm.slice(0,2));
                        span.textContent = (initials || 'U').toUpperCase();
                        avatarWrap.appendChild(span);
                    }
                    const meta = document.createElement('div');
                    meta.className = 'co-search-meta';
                    const strong = document.createElement('strong'); strong.textContent = it.name || '';
                    const small = document.createElement('div'); small.style.color='#6b7280'; small.style.fontSize='12px'; small.textContent = it.email || '';
                    meta.appendChild(strong); meta.appendChild(small);
                    left.appendChild(avatarWrap); left.appendChild(meta);
                    li.appendChild(left);
                    const addBtnEl = document.createElement('button');
                    addBtnEl.className = 'action-btn co-btn-primary co-add-btn';
                    addBtnEl.innerHTML = '<i class="fas fa-user-plus"></i> Add';
                    addBtnEl.addEventListener('click', function(){
                        if (!add) return;
                        fetch(add, {
                            method: 'POST',
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-CSRFToken': getCsrfToken(),
                            },
                            body: new URLSearchParams({ user_id: it.id }).toString(),
                        }).then(r=>r.json()).then(data=>{
                            if (data && data.ok && data.member){
                                users.push({ 
                                    id: data.member.id, 
                                    name: data.member.name, 
                                    email: data.member.email, 
                                    role: data.member.role, 
                                    block: data.member.block||'', 
                                    lot: data.member.lot||'',
                                    avatar: data.member.avatar || null
                                });
                                renderUsersTable(); coPaginateRows(); updateStats();
                                CO_showToast && CO_showToast('User added to your community.', 'success');
                                // Remove this result from the list
                                try {
                                    if (li && li.parentNode) { li.parentNode.removeChild(li); }
                                    if (ul && ul.children.length === 0) {
                                        results.innerHTML = '<div style="padding:10px;color:#6b7280;">No results</div>';
                                    }
                                } catch (e) {}
                            } else {
                                throw new Error((data && data.error) || 'Unable to add user');
                            }
                        }).catch(err => {
                            CO_showToast && CO_showToast(err.message || 'Unable to add user', 'error');
                        });
                    });
                    li.appendChild(addBtnEl);
                    ul.appendChild(li);
                });
                results.appendChild(ul);
            }

            function doSearch(){
                const q = (searchInput.value || '').trim();
                if (!q){ CO_showToast && CO_showToast('Enter email or name to search.', 'warning'); return; }
                if (!search) return;
                fetch(`${search}?q=${encodeURIComponent(q)}`, { headers: { 'X-Requested-With':'XMLHttpRequest' }})
                    .then(r=>r.json())
                    .then(data => { renderResults((data && data.ok && data.results) ? data.results : [], q); })
                    .catch(()=>{ renderResults([], q); });
            }

            searchBtn.addEventListener('click', doSearch);
            searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); doSearch(); } });
            cancelBtn.addEventListener('click', function(){
                // Reuse global closeModal to hide overlay
                if (typeof closeModal === 'function') closeModal();
                else { overlay.style.display='none'; }
            });
        }

        // Expose cleanup function globally
        window.closeAllModals = closeAllModals;












