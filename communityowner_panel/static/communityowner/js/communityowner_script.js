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
        
        function throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
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
            DOM_CACHE.userGrid = document.querySelector('.user-grid');
            DOM_CACHE.reportList = document.querySelector('.report-list');
            DOM_CACHE.codeDisplay = document.getElementById('code-display');
            DOM_CACHE.copyBtn = document.getElementById('copy-code-btn');
        }
        
        // Lazy load content sections
        function lazyLoadSection(sectionId) {
            const section = document.getElementById(sectionId);
            if (!section) return;
            
            // Always allow reports to be re-rendered
            if (sectionId === 'reports') {
                renderReports();
                return;
            }
            
            // For other sections, only load once
            if (section.getAttribute('data-loaded') === 'true') return;
            section.setAttribute('data-loaded', 'true');
            
            if (sectionId === 'users' && typeof renderUsers === 'function') {
                renderUsers();
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

        // Load reports data for stats from server-side data
        function loadReportsData() {
            // Get stats directly from server-side data in the HTML
            const totalReportsEl = document.getElementById('total-reports');
            const activeReportsEl = document.getElementById('active-reports');
            const monthReportsEl = document.getElementById('month-reports');
            
            console.log('Reading stats from HTML elements:');
            console.log('totalReportsEl:', totalReportsEl);
            console.log('activeReportsEl:', activeReportsEl);
            console.log('monthReportsEl:', monthReportsEl);
            
            if (totalReportsEl && activeReportsEl && monthReportsEl) {
                const totalReports = parseInt(totalReportsEl.textContent) || 0;
                const activeReports = parseInt(activeReportsEl.textContent) || 0;
                const monthReports = parseInt(monthReportsEl.textContent) || 0;
                
                console.log('Raw text content:');
                console.log('totalReportsEl.textContent:', totalReportsEl.textContent);
                console.log('activeReportsEl.textContent:', activeReportsEl.textContent);
                console.log('monthReportsEl.textContent:', monthReportsEl.textContent);
                
                console.log('Parsed values:');
                console.log('totalReports:', totalReports);
                console.log('activeReports:', activeReports);
                console.log('monthReports:', monthReports);
                
                // Update stats directly without animation (since we're using server data)
                updateStatsFromServer(totalReports, activeReports, monthReports);
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
        function updateStatsFromServer(totalReports, activeReports, monthReports) {
            const totalUsers = Array.isArray(users) ? users.length : 0;
            
            console.log('Updating stats from server:', {
                totalUsers,
                totalReports,
                activeReports,
                monthReports
            });
            
            // Only animate if elements exist and haven't been animated yet
            if (totalUsersEl && !totalUsersEl.hasAttribute('data-animated')) {
                animateValue(totalUsersEl, 0, totalUsers, 1000);
                totalUsersEl.setAttribute('data-animated', 'true');
            }
            if (totalReportsEl && !totalReportsEl.hasAttribute('data-animated')) {
                animateValue(totalReportsEl, 0, totalReports, 1000);
                totalReportsEl.setAttribute('data-animated', 'true');
            }
            if (activeReportsEl && !activeReportsEl.hasAttribute('data-animated')) {
                animateValue(activeReportsEl, 0, activeReports, 1000);
                activeReportsEl.setAttribute('data-animated', 'true');
            }
            if (monthReportsEl && !monthReportsEl.hasAttribute('data-animated')) {
                animateValue(monthReportsEl, 0, monthReports, 1000);
                monthReportsEl.setAttribute('data-animated', 'true');
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
        const userGrid = document.querySelector('.user-grid');
        const reportList = document.querySelector('.report-list');
        // Removed downloadGrid and billingHistoryTable queries
        const revealBtn = document.getElementById('reveal-btn');
        const codeDisplay = document.getElementById('code-display');
        const copyBtn = document.getElementById('copy-code-btn');
        let reportsRendered = false;
        
        // Stats elements
        const totalUsersEl = document.getElementById('total-users');
        const totalReportsEl = document.getElementById('total-reports');
        const activeReportsEl = document.getElementById('active-reports');
        const monthReportsEl = document.getElementById('month-reports');

        // Initialize the dashboard with performance optimizations
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize DOM cache first
            initDOMCache();
            
            // Load reports data and update stats
            loadReportsData();
            
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
                const section = document.getElementById(targetId);
                if (!section || !overlay || !modalShell) return;
                
                // First ensure any existing modal is properly closed
                closeAllModals();
                
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
                
                // mount into shell
                modalShell.innerHTML = '';
                modalShell.appendChild(section);
                
                if (modalContainer) {
                    if (targetId === 'secret') {
                        modalContainer.classList.add('co-modal-no-scroll');
                    } else {
                        modalContainer.classList.remove('co-modal-no-scroll');
                    }
                }
                
                // Show overlay with proper state
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');
                
                // Set body styles for modal
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    document.body.classList.add('modal-open');
                    if (sbw > 0) {
                        document.body.style.paddingRight = sbw + 'px';
                    }
                } catch (e) {}
                
                currentSection = section;
                if (targetId === 'users') {
                    renderUsers();
                } else if (targetId === 'reports') {
                    renderReports();
                }
            }

            function closeModal() {
                if (!overlay) return;
                if (currentSection) {
                    const host = document.querySelector('.content-area');
                    if (host) host.appendChild(currentSection);
                    currentSection.classList.remove('in-modal');
                    currentSection = null;
                }
                if (modalContainer) modalContainer.classList.remove('co-modal-no-scroll');
                
                // Use the comprehensive cleanup function
                closeAllModals();
            }

            // Optimized navigation with lazy loading
            navCards.forEach(card => {
                card.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    // Toggle active highlight
                    navCards.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    if (targetId === 'users') {
                        // Close modal if open
                        try { closeModal(); } catch(e){}
                        // Lazy load users table
                        lazyLoad(() => {
                            if (typeof renderUsersTable === 'function') {
                                renderUsersTable();
                            }
                        }, 50);
                        const bottom = document.getElementById('co-users-bottom');
                        if (bottom) bottom.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (targetId === 'emergency') {
                        if (window.CO_openEmergencyModal) { window.CO_openEmergencyModal(); }
                    } else if (targetId === 'reports') {
                        // Always render reports section and open modal
                        lazyLoad(() => {
                            openReportsModal();
                        }, 100);
                    } else {
                        // Lazy load other sections
                        lazyLoad(() => {
                            lazyLoadSection(targetId);
                            openModal(targetId);
                        }, 50);
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

            // Optional legacy reveal support
            if (revealBtn) {
                revealBtn.addEventListener('click', revealSecretCode);
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
            const totalReports = Array.isArray(reports) ? reports.length : 0;
            const activeReports = Array.isArray(reports) ? reports.filter(r => r.status === 'pending' || r.status === 'investigating').length : 0;
            const monthReports = Array.isArray(reports) ? reports.filter(r => {
                const reportDate = new Date(r.created_at);
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return reportDate >= monthAgo;
            }).length : 0;
            
            console.log('Stats calculation:', {
                totalUsers,
                totalReports,
                activeReports,
                monthReports,
                reportsArray: reports,
                usersArray: users
            });
            
            // Only animate if elements exist and haven't been animated yet
            if (totalUsersEl && !totalUsersEl.hasAttribute('data-animated')) {
                animateValue(totalUsersEl, 0, totalUsers, 1000);
                totalUsersEl.setAttribute('data-animated', 'true');
            }
            if (totalReportsEl && !totalReportsEl.hasAttribute('data-animated')) {
                animateValue(totalReportsEl, 0, totalReports, 1000);
                totalReportsEl.setAttribute('data-animated', 'true');
            }
            if (activeReportsEl && !activeReportsEl.hasAttribute('data-animated')) {
                animateValue(activeReportsEl, 0, activeReports, 1000);
                activeReportsEl.setAttribute('data-animated', 'true');
            }
            if (monthReportsEl && !monthReportsEl.hasAttribute('data-animated')) {
                animateValue(monthReportsEl, 0, monthReports, 1000);
                monthReportsEl.setAttribute('data-animated', 'true');
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

        // Render user cards (legacy in-modal UI; hidden now)
        function renderUsers() {
            if (!userGrid) return;
            userGrid.innerHTML = '';
            const frag = document.createDocumentFragment();
            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                userCard.innerHTML = `
                    <div class="user-header">
                        <div class="user-avatar">${user.initials}</div>
                        <div class="user-info">
                            <h3>${user.name}</h3>
                            <span class="user-role">${user.role}</span>
                        </div>
                    </div>
                    <div class="user-email">${user.email}</div>
                    <div class="user-actions">
                        <button class="action-btn edit-btn">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                frag.appendChild(userCard);
            });
            userGrid.appendChild(frag);
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
                
                // First ensure any existing modal is properly closed
                closeAllModals();
                
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
                
                // Open the modal properly
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');
                
                // Set body styles for modal
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    document.body.classList.add('modal-open');
                    if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
                } catch (e) {}

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


        // Open reports modal directly
        function openReportsModal() {
            if (!overlay || !modalShell) return;
            
            // First ensure any existing modal is properly closed
            closeAllModals();
            
            // Set modal title
            if (modalTitle) modalTitle.textContent = 'Security Reports';
            
            // Create reports content directly in modal
            modalShell.innerHTML = `
                <div class="reports-modal">
                    <div class="reports-header">
                        <div class="reports-filters">
                            <div class="filter-group">
                                <label for="year-filter">Year:</label>
                                <select id="year-filter">
                                    <option value="">All Years</option>
                                    <option value="2023">2023</option>
                                    <option value="2024">2024</option>
                                    <option value="2025" selected>2025</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label for="month-filter">Month:</label>
                                <select id="month-filter">
                                    <option value="">All Months</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10" selected>October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                            </div>
                        </div>
                        <div class="reports-actions">
                            <button id="reports-download-pdf" class="action-btn edit-btn">
                                <i class="fas fa-file-pdf"></i> Download PDF
                            </button>
                            <button id="reports-analytics" class="action-btn edit-btn">
                                <i class="fas fa-chart-bar"></i> Analytics
                            </button>
                        </div>
                    </div>
                    <div class="reports-summary">
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">Total Reports:</span>
                                <span id="total-reports-count">-</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Filtered Reports:</span>
                                <span id="filtered-reports-count">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Open the modal
            overlay.style.display = 'flex';
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
            overlay.classList.add('active');
            
            // Set body styles for modal
            try {
                const sbw = window.innerWidth - document.documentElement.clientWidth;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.body.classList.add('modal-open');
                if (sbw > 0) {
                    document.body.style.paddingRight = sbw + 'px';
                }
            } catch (e) {}
            
            // Bind action events after DOM update
            setTimeout(() => {
                bindReportsActions();
                
                // Set dynamic defaults based on current date
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
                
                const yearSelect = document.getElementById('year-filter');
                const monthSelect = document.getElementById('month-filter');
                
                if (yearSelect && monthSelect) {
                    // Set year default (2025 or current year if later)
                    const defaultYear = Math.max(2025, currentYear);
                    yearSelect.value = defaultYear.toString();
                    
                    // Set month default (October or current month if later in year)
                    let defaultMonth = 10; // October
                    if (currentYear > 2025 || (currentYear === 2025 && currentMonth > 10)) {
                        defaultMonth = currentMonth;
                    }
                    monthSelect.value = defaultMonth.toString();
                    
                    // Update summary with new defaults
                    updateReportsSummary();
                }
                
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
            }, 10);
        }

        // Render reports with analytics
        function renderReports() {
            if (!reportList) return;
            
            reportList.innerHTML = `
                <div class="reports-header">
                    <div class="reports-actions">
                        <button id="reports-download-pdf" class="action-btn edit-btn">
                            <i class="fas fa-file-pdf"></i> Download PDF
                        </button>
                        <button id="reports-analytics" class="action-btn edit-btn">
                            <i class="fas fa-chart-bar"></i> Analytics
                        </button>
                    </div>
                </div>
            `;
            
            // Always bind action events (remove any existing listeners first)
            bindReportsActions();
        }

        // Bind reports action events
        function bindReportsActions() {
            const downloadPdfBtn = document.getElementById('reports-download-pdf');
            const analyticsBtn = document.getElementById('reports-analytics');
            const yearFilter = document.getElementById('year-filter');
            const monthFilter = document.getElementById('month-filter');

            if (downloadPdfBtn) {
                // Clone the button to remove all event listeners
                const newDownloadBtn = downloadPdfBtn.cloneNode(true);
                downloadPdfBtn.parentNode.replaceChild(newDownloadBtn, downloadPdfBtn);
                
                newDownloadBtn.addEventListener('click', function() {
                    const year = yearFilter ? yearFilter.value : '';
                    const month = monthFilter ? monthFilter.value : '';
                    showDownloadOptions('pdf', year, month);
                });
            }

            if (analyticsBtn) {
                // Clone the button to remove all event listeners
                const newAnalyticsBtn = analyticsBtn.cloneNode(true);
                analyticsBtn.parentNode.replaceChild(newAnalyticsBtn, analyticsBtn);
                
                newAnalyticsBtn.addEventListener('click', function() {
                    const year = yearFilter ? yearFilter.value : '';
                    const month = monthFilter ? monthFilter.value : '';
                    showReportsAnalytics(year, month);
                });
            }

            // Add filter change listeners
            if (yearFilter) {
                yearFilter.addEventListener('change', updateReportsSummary);
            }
            if (monthFilter) {
                monthFilter.addEventListener('change', updateReportsSummary);
            }

            // Load initial summary
            updateReportsSummary();
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
            const yearFilter = document.getElementById('year-filter');
            const monthFilter = document.getElementById('month-filter');
            const totalCountEl = document.getElementById('total-reports-count');
            const filteredCountEl = document.getElementById('filtered-reports-count');
            
            if (!totalCountEl || !filteredCountEl) return;
            
            const year = yearFilter ? yearFilter.value : '';
            const month = monthFilter ? monthFilter.value : '';
            
            // Get total reports count
            const { reportsList } = endpoints();
            if (!reportsList) return;
            
            fetch(`${reportsList}?per_page=1000`, { 
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(r => r.json())
            .then(data => {
                if (data && data.ok && Array.isArray(data.reports)) {
                    const totalReports = data.reports.length;
                    totalCountEl.textContent = totalReports;
                    
                    // Filter reports based on year/month
                    let filteredReports = data.reports;
                    if (year) {
                        filteredReports = filteredReports.filter(report => {
                            const reportDate = new Date(report.created_at);
                            return reportDate.getFullYear() == year;
                        });
                    }
                    if (month) {
                        filteredReports = filteredReports.filter(report => {
                            const reportDate = new Date(report.created_at);
                            return reportDate.getMonth() + 1 == month; // getMonth() returns 0-11
                        });
                    }
                    
                    filteredCountEl.textContent = filteredReports.length;
                }
            })
            .catch(err => {
                console.error('Failed to load reports summary:', err);
                totalCountEl.textContent = '-';
                filteredCountEl.textContent = '-';
            });
        }

        // Show download options (preview or direct download)
        function showDownloadOptions(format, year = '', month = '') {
            if (!overlay || !modalShell) return;
            
            const filterText = getFilterText(year, month);
            modalTitle.textContent = `Download ${format.toUpperCase()}${filterText}`;
            modalShell.innerHTML = `
                <div class="download-options">
                    <div class="download-option">
                        <div class="option-icon">
                            <i class="fas fa-eye"></i>
                        </div>
                        <div class="option-content">
                            <h3>Preview First</h3>
                            <p>See what will be included in your ${format.toUpperCase()} download${filterText} before downloading</p>
                            <button id="preview-download-pdf" class="action-btn edit-btn">
                                <i class="fas fa-eye"></i> Preview & Download
                            </button>
                        </div>
                    </div>
                    
                    <div class="download-option">
                        <div class="option-icon">
                            <i class="fas fa-download"></i>
                        </div>
                        <div class="option-content">
                            <h3>Download Directly</h3>
                            <p>Download your ${format.toUpperCase()} file${filterText} immediately without preview</p>
                            <button id="direct-download-pdf" class="action-btn edit-btn">
                                <i class="fas fa-download"></i> Download Now
                            </button>
                        </div>
                    </div>
                    
                </div>
            `;
            
            // Open the modal first
            overlay.style.display = 'flex';
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
            overlay.classList.add('active');
            
            // Set body styles for modal
            try {
                const sbw = window.innerWidth - document.documentElement.clientWidth;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.body.classList.add('modal-open');
                if (sbw > 0) {
                    document.body.style.paddingRight = sbw + 'px';
                }
            } catch (e) {}
            
            // Wait for DOM to update, then bind events
            setTimeout(() => {
                const previewBtn = document.getElementById('preview-download-pdf');
                const directBtn = document.getElementById('direct-download-pdf');
                
                if (previewBtn) {
                    previewBtn.addEventListener('click', function() {
                        closeAllModals();
                        showDownloadPreview('pdf', year, month);
                    });
                }
                
                if (directBtn) {
                    directBtn.addEventListener('click', function() {
                        closeAllModals();
                        actualDownload('pdf', year, month);
                    });
                }
            }, 10);
        }

        // Show preview before download
        function downloadReports(format) {
            showDownloadPreview(format);
        }

        // Show download preview modal
        function showDownloadPreview(format, year = '', month = '') {
            const { reportsList, reportsAnalytics } = endpoints();
            if (!reportsList || !reportsAnalytics) return;

            const filterText = getFilterText(year, month);

            // Show loading state
            if (overlay && modalShell) {
                modalTitle.textContent = `Preview ${format.toUpperCase()} Download${filterText}`;
                modalShell.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 20px;">Loading preview...</p></div>';
                
                // Open the modal
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');
                
                // Set body styles for modal
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    document.body.classList.add('modal-open');
                    if (sbw > 0) {
                        document.body.style.paddingRight = sbw + 'px';
                    }
                } catch (e) {}
            }

            // Build URLs with filters
            let reportsUrl = `${reportsList}?per_page=1000`;
            let analyticsUrl = reportsAnalytics;
            
            const params = new URLSearchParams();
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            params.append('_t', Date.now()); // Cache busting
            params.append('_r', Math.random()); // Additional cache busting
            
            if (params.toString()) {
                reportsUrl += '&' + params.toString();
                analyticsUrl += (analyticsUrl.includes('?') ? '&' : '?') + params.toString();
            }

            // Fetch both reports and analytics data
            Promise.all([
                fetch(reportsUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' }}).then(r => r.json()),
                fetch(analyticsUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' }}).then(r => r.json())
            ])
            .then(([reportsData, analyticsData]) => {
                if (reportsData && reportsData.ok && analyticsData && analyticsData.ok) {
                    const reports = reportsData.reports || [];
                    const analytics = analyticsData.analytics || {};
                    
                    showPDFPreview(reports, analytics, year, month);
                } else {
                    throw new Error('Failed to load data');
                }
            })
            .catch(err => {
                console.error('Failed to load preview data:', err);
                CO_showToast && CO_showToast('Failed to load preview data', 'error');
                if (overlay) overlay.style.display = 'none';
            });
        }

        // Show PDF preview
        function showPDFPreview(reports, analytics, year = '', month = '') {
            if (!modalShell) return;

            // Determine the period title based on filters
            let periodTitle = '';
            
            if (year && month) {
                // Specific month and year
                const monthName = getMonthName(month);
                periodTitle = `Reports for ${monthName} ${year}`;
            } else if (year) {
                // Entire year
                periodTitle = `Reports for ${year}`;
            } else if (month) {
                // Specific month (current year)
                const monthName = getMonthName(month);
                const currentYear = new Date().getFullYear();
                periodTitle = `Reports for ${monthName} ${currentYear}`;
            } else {
                // All reports - show current month as reference
                const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                periodTitle = `Reports This Month (${currentMonth})`;
            }

            // Use the reports as-is since they're already filtered server-side
            const periodReports = reports;

            // Check if there's no data for the selected period
            if (periodReports.length === 0) {
                modalShell.innerHTML = `
                    <div class="download-preview">
                        <div class="preview-header">
                            <h3><i class="fas fa-file-pdf"></i> PDF Preview</h3>
                            <p>This is what your PDF download will contain:</p>
                        </div>
                        <div class="preview-content">
                            <div class="empty-state">
                                <div class="empty-icon">
                                    <i class="fas fa-inbox"></i>
                                </div>
                                <h3>No Data Found</h3>
                                <p>There are no security reports for the selected period.</p>
                                <div class="empty-details">
                                    <p><strong>Selected Period:</strong> ${periodTitle}</p>
                                    <p><strong>Total Reports Available:</strong> ${reports.length}</p>
                                </div>
                                <div class="empty-suggestions">
                                    <h4>Suggestions:</h4>
                                    <ul>
                                        <li>Try selecting a different year or month</li>
                                        <li>Download all reports to see available data</li>
                                        <li>Check if reports exist for other time periods</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                return;
            }

            const residentReports = periodReports.filter(r => r.target_type === 'resident');
            const nonResidentReports = periodReports.filter(r => r.target_type === 'outsider');

            modalShell.innerHTML = `
                <div class="download-preview">
                    <div class="preview-header">
                        <h3><i class="fas fa-file-pdf"></i> PDF Preview</h3>
                        <p>This is what your PDF download will contain:</p>
                    </div>
                    <div class="preview-content">
                    
                    <div class="preview-stats">
                        <div class="stat-grid">
                            <div class="stat-item">
                                <h4>${periodReports.length}</h4>
                                <p>${periodTitle}</p>
                            </div>
                            <div class="stat-item">
                                <h4>${residentReports.length}</h4>
                                <p>Resident Reports</p>
                            </div>
                            <div class="stat-item">
                                <h4>${nonResidentReports.length}</h4>
                                <p>Non-Resident Reports</p>
                            </div>
                            <div class="stat-item">
                                <h4>${reports.length}</h4>
                                <p>Total Available Reports</p>
                            </div>
                        </div>
                    </div>

                    <div class="preview-section">
                        <h4>Common Issues/Reasons Reported</h4>
                        <div class="reasons-list">
                            ${analytics.common_reasons && analytics.common_reasons.length > 0 ? 
                                analytics.common_reasons.map(reason => 
                                    `<div class="reason-item">
                                        <span class="reason-name">${reason.reason}</span>
                                        <span class="reason-count">${reason.count} reports</span>
                                    </div>`
                                ).join('') : 
                                '<p>No common reasons data available</p>'
                            }
                        </div>
                    </div>

                    <div class="preview-section">
                        <h4>Resident Reports Table (${residentReports.length} reports)</h4>
                        <div class="preview-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Subject</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Reporter</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${residentReports.slice(0, 10).map(report => `
                                        <tr>
                                            <td>${report.subject.substring(0, 30)}${report.subject.length > 30 ? '...' : ''}</td>
                                            <td><span class="badge priority-${report.priority}">${report.priority.toUpperCase()}</span></td>
                                            <td><span class="badge status-${report.status}">${report.status.replace('_', ' ').toUpperCase()}</span></td>
                                            <td>${report.reporter_display}</td>
                                            <td>${new Date(report.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ${residentReports.length > 10 ? `<p class="table-note">... and ${residentReports.length - 10} more resident reports</p>` : ''}
                        </div>
                    </div>

                    <div class="preview-section">
                        <h4>Non-Resident Reports Table (${nonResidentReports.length} reports)</h4>
                        <div class="preview-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Subject</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Reporter</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${nonResidentReports.slice(0, 10).map(report => `
                                        <tr>
                                            <td>${report.subject.substring(0, 30)}${report.subject.length > 30 ? '...' : ''}</td>
                                            <td><span class="badge priority-${report.priority}">${report.priority.toUpperCase()}</span></td>
                                            <td><span class="badge status-${report.status}">${report.status.replace('_', ' ').toUpperCase()}</span></td>
                                            <td>${report.reporter_display}</td>
                                            <td>${new Date(report.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ${nonResidentReports.length > 10 ? `<p class="table-note">... and ${nonResidentReports.length - 10} more non-resident reports</p>` : ''}
                        </div>
                    </div>

                    </div>
                    <div class="preview-actions">
                        <button id="confirm-download-pdf" class="action-btn edit-btn">
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                    </div>
                </div>
            `;

            // Bind preview actions after DOM update
            setTimeout(() => {
                const confirmBtn = document.getElementById('confirm-download-pdf');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        closeAllModals();
                        actualDownload('pdf', year, month);
                    });
                }
            }, 10);
        }

        // Comprehensive modal cleanup function
        function closeAllModals() {
            // Close the modal overlay
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.visibility = 'hidden';
                overlay.style.opacity = '0';
                overlay.classList.remove('active', 'show');
            }
            
            // Reset document and body styles completely
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.bottom = '';
            document.body.style.paddingRight = '';
            document.body.classList.remove('modal-open', 'no-scroll');
            
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
            
            // Force reflow to ensure changes take effect
            document.body.offsetHeight;
            
            // Additional cleanup to ensure scroll is restored
            setTimeout(() => {
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.classList.remove('modal-open', 'no-scroll');
            }, 10);
        }

        // Actual download function
        function actualDownload(format, year = '', month = '') {
            const { reportsDownloadPdf } = endpoints();
            let url = reportsDownloadPdf;
            
            if (!url) {
                CO_showToast && CO_showToast('Download URL not found', 'error');
                return;
            }

            // Add filter parameters to URL
            const params = new URLSearchParams();
            if (year) params.append('year', year);
            if (month) params.append('month', month);
            params.append('_t', Date.now()); // Cache busting
            params.append('_r', Math.random()); // Additional cache busting
            
            if (params.toString()) {
                url += (url.includes('?') ? '&' : '?') + params.toString();
            }

            // Show loading message
            const filterText = getFilterText(year, month);
            CO_showToast && CO_showToast(`Preparing ${format.toUpperCase()} download${filterText}...`, 'info');
            
            // First check if there's data for the selected period
            const { reportsList } = endpoints();
            if (reportsList) {
                let checkUrl = `${reportsList}?per_page=1000`;
                if (params.toString()) {
                    checkUrl += '&' + params.toString();
                }
                
                fetch(checkUrl, { 
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                })
                .then(r => r.json())
                .then(data => {
                    if (data && data.ok && Array.isArray(data.reports)) {
                        if (data.reports.length === 0) {
                            // No data found for the selected period
                            const periodTitle = getFilterText(year, month);
                            CO_showToast && CO_showToast(`No data found${periodTitle}. Please try a different time period.`, 'warning');
                            return;
                        }
                        
                        // Data exists, proceed with download
                        performDownload(url, format, filterText);
                    } else {
                        // Error or no data
                        CO_showToast && CO_showToast('Unable to verify data availability', 'error');
                    }
                })
                .catch(err => {
                    console.error('Failed to check data availability:', err);
                    // Proceed with download anyway
                    performDownload(url, format, filterText);
                });
            } else {
                // No reportsList endpoint, proceed with download
                performDownload(url, format, filterText);
            }
        }

        // Helper function to perform the actual download
        function performDownload(url, format, filterText) {
            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = url;
            const filename = `security_reports${filterText.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.${format}`;
            link.download = filename;
            link.target = '_blank'; // Open in new tab as fallback
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Comprehensive modal cleanup immediately
            closeAllModals();
            
            // Additional cleanup after a short delay to ensure everything is reset
            setTimeout(() => {
                closeAllModals();
                
                // Force page state reset
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.bottom = '';
                document.body.style.paddingRight = '';
                document.body.classList.remove('modal-open', 'no-scroll');
                
                // Force reflow
                document.body.offsetHeight;
            }, 50);
            
            // Show success message
            setTimeout(() => {
                CO_showToast && CO_showToast(`${format.toUpperCase()} download${filterText} started`, 'success');
            }, 500);
        }

        // Show reports analytics
        function showReportsAnalytics(year = '', month = '') {
            const { reportsAnalytics } = endpoints();
            if (!reportsAnalytics) return;

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
                if (data && data.ok) {
                    showAnalyticsModal(data.analytics, year, month);
                }
            })
            .catch(err => {
                console.error('Failed to load analytics:', err);
                CO_showToast && CO_showToast('Failed to load analytics', 'error');
            });
        }

        // Show analytics modal
        function showAnalyticsModal(analytics, year = '', month = '') {
            if (!overlay || !modalShell) return;
            
            const filterText = getFilterText(year, month);
            modalTitle.textContent = `Reports Analytics${filterText}`;
            modalShell.innerHTML = `
                <div class="analytics-modal">
                    <div class="analytics-stats">
                        <div class="stat-card">
                            <h3>${analytics.total_reports}</h3>
                            <p>Total Reports</p>
                        </div>
                        <div class="stat-card">
                            <h3>${analytics.resident_reports}</h3>
                            <p>Resident Reports</p>
                        </div>
                        <div class="stat-card">
                            <h3>${analytics.non_resident_reports}</h3>
                            <p>Non-Resident Reports</p>
                        </div>
                    </div>
                    
                    <div class="analytics-breakdown">
                        <h4>Status Breakdown</h4>
                        <div class="breakdown-list">
                            ${Object.entries(analytics.status_breakdown).map(([status, count]) => 
                                `<div class="breakdown-item">
                                    <span class="breakdown-label">${status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                                    <span class="breakdown-count">${count}</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="analytics-breakdown">
                        <h4>Priority Breakdown</h4>
                        <div class="breakdown-list">
                            ${Object.entries(analytics.priority_breakdown).map(([priority, count]) => 
                                `<div class="breakdown-item">
                                    <span class="breakdown-label">${priority.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                                    <span class="breakdown-count">${count}</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="analytics-breakdown">
                        <h4>Common Reasons</h4>
                        <div class="breakdown-list">
                            ${analytics.common_reasons.map(reason => 
                                `<div class="breakdown-item">
                                    <span class="breakdown-label">${reason.reason}</span>
                                    <span class="breakdown-count">${reason.count}</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Open the modal
            overlay.style.display = 'flex';
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
            overlay.classList.add('active');
            
            // Set body styles for modal
            try {
                const sbw = window.innerWidth - document.documentElement.clientWidth;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.body.classList.add('modal-open');
                if (sbw > 0) {
                    document.body.style.paddingRight = sbw + 'px';
                }
            } catch (e) {}
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
                                users.push({ id: data.member.id, name: data.member.name, email: data.member.email, role: data.member.role, block: data.member.block||'', lot: data.member.lot||'' });
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

        // Reveal secret code
        function revealSecretCode() {
            const embedded = codeDisplay?.dataset?.code;
            const secretCode = embedded && embedded.trim() ? embedded.trim() : "7X9P-2R8Q-4T6W-1S3V";
            codeDisplay.textContent = secretCode;
            codeDisplay.classList.add('revealed');
            revealBtn.innerHTML = '<i class="fas fa-check"></i> Code Revealed!';
            revealBtn.classList.add('revealed');
        }

        // Global cleanup function for any remaining modal issues
        function globalModalCleanup() {
            closeAllModals();
        }

        // Function to properly open modals
        function openModal() {
            // First ensure any existing modal is properly closed
            closeAllModals();
            
            // Set body styles for modal
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.classList.add('modal-open');
            
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.visibility = 'visible';
                overlay.style.opacity = '1';
                overlay.classList.add('active');
            }
        }

        // Add global event listeners for cleanup
        document.addEventListener('click', function(e) {
            // If clicking outside the specific modal overlay, close it
            if (e.target.classList.contains('modal-overlay') && e.target === overlay) {
                closeAllModals();
            }
        });

        // Add escape key listener for modal cleanup
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                closeAllModals();
            }
        });

        // Expose cleanup function globally for debugging
        window.closeAllModals = closeAllModals;
        window.globalModalCleanup = globalModalCleanup;
        
        // Debug function to check modal state
        window.debugModal = function() {
            console.log('Overlay:', overlay);
            console.log('Overlay display:', overlay ? overlay.style.display : 'undefined');
            console.log('Overlay visibility:', overlay ? overlay.style.visibility : 'undefined');
            console.log('Body overflow:', document.body.style.overflow);
            console.log('Body classes:', document.body.classList.toString());
        };
        
        // Global function to force reset page state
        window.resetPageState = function() {
            closeAllModals();
            document.documentElement.style.overflow = '';
            document.body.style.overflow = 'auto';
            document.body.style.position = 'static';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.bottom = '';
            document.body.style.paddingRight = '';
            document.body.classList.remove('modal-open', 'no-scroll');
            document.body.offsetHeight; // Force reflow
        };
        
        // Emergency reset function for debugging
        window.emergencyReset = function() {
            console.log('Emergency reset triggered');
            closeAllModals();
            setTimeout(() => {
                window.resetPageState();
                console.log('Page state reset complete');
            }, 100);
        };












