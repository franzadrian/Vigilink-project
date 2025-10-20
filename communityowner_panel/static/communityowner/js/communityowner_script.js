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

        // Placeholder reports (replace when backend exists)
        const reports = [];

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
        const weekReportsEl = document.getElementById('week-reports');

        // Initialize the dashboard
        document.addEventListener('DOMContentLoaded', function() {
            updateStats();

            let currentSection = null;

            function openModal(targetId) {
                const section = document.getElementById(targetId);
                if (!section || !overlay || !modalShell) return;
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
                overlay.style.display = 'flex';
                currentSection = section;
                if (targetId === 'users') {
                    renderUsers();
                } else if (targetId === 'reports' && !reportsRendered) {
                    renderReports();
                    reportsRendered = true;
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
                overlay.style.display = 'none';
                if (modalTitle) modalTitle.textContent = '';
            }

            // Nav cards open their content in modal
            navCards.forEach(card => {
                card.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    openModal(targetId);
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
            const activeReports = 0;
            const weekReports = 0;
            
            // Animate stats counting up
            animateValue(totalUsersEl, 0, totalUsers, 1000);
            animateValue(totalReportsEl, 0, totalReports, 1000);
            animateValue(activeReportsEl, 0, activeReports, 1000);
            animateValue(weekReportsEl, 0, weekReports, 1000);
        }

        // Animate value counting up
        function animateValue(element, start, end, duration) {
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                element.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }

        // Render user cards
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

        // Render report cards
        function renderReports() {
            if (!reportList) return;
            reportList.innerHTML = '';
            const frag = document.createDocumentFragment();
            reports.forEach(report => {
                const reportCard = document.createElement('div');
                reportCard.className = 'report-card';
                reportCard.innerHTML = `
                    <div class="report-header">
                        <div>
                            <div class="report-title">${report.title}</div>
                            <div class="report-meta">
                                <span><i class="far fa-calendar"></i> ${report.date}</span>
                                <span><i class="far fa-file"></i> ${report.type}</span>
                                <span><i class="fas fa-weight-hanging"></i> ${report.size}</span>
                            </div>
                        </div>
                        <span class="report-badge">${report.status}</span>
                    </div>
                    <div class="report-actions">
                        <button class="action-btn edit-btn">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="action-btn edit-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                `;
                frag.appendChild(reportCard);
            });
            reportList.appendChild(frag);
        }

        // Removed renderDownloadOptions and renderBillingHistory

        // Reveal secret code
        function revealSecretCode() {
            const embedded = codeDisplay?.dataset?.code;
            const secretCode = embedded && embedded.trim() ? embedded.trim() : "7X9P-2R8Q-4T6W-1S3V";
            codeDisplay.textContent = secretCode;
            codeDisplay.classList.add('revealed');
            revealBtn.innerHTML = '<i class="fas fa-check"></i> Code Revealed!';
            revealBtn.classList.add('revealed');
        }
