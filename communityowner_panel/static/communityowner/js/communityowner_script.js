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
            // Always render bottom Manage Users table on load
            if (typeof renderUsersTable === 'function') { renderUsersTable(); coPaginateRows(); }
            // Optionally refresh from API to ensure fresh data
            if (typeof refreshMembersList === 'function') {
                refreshMembersList();
            }

            // Local filter for current members table
            const filterInput = document.getElementById('co-user-filter');
            if (filterInput){
                filterInput.addEventListener('input', function(){
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
                });
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
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
                    if (sbw > 0) {
                        document.body.style.paddingRight = sbw + 'px';
                    }
                } catch (e) {}
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
                try {
                    document.documentElement.style.overflow = '';
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                } catch (e) {}
                if (modalTitle) modalTitle.textContent = '';
            }

            // Special handling: for 'users', render in bottom section (no modal)
            navCards.forEach(card => {
                card.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    // Toggle active highlight
                    navCards.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    if (targetId === 'users') {
                        // Close modal if open
                        try { closeModal(); } catch(e){}
                        // Render bottom users table and scroll
                        if (typeof renderUsersTable === 'function') {
                            renderUsersTable();
                        }
                        const bottom = document.getElementById('co-users-bottom');
                        if (bottom) bottom.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (targetId === 'emergency') {
                        if (window.CO_openEmergencyModal) { window.CO_openEmergencyModal(); }
                    } else if (targetId === 'reports') {
                        openModal(targetId);
                    } else {
                        openModal(targetId);
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
                        updateStats();
                    }
                })
                .catch(()=>{});
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
            const mk = (label, p, disabled, active) => {
                const b = document.createElement('button');
                b.className = 'page-btn' + (active ? ' active' : '');
                b.textContent = label;
                b.style.border = '1px solid #e5e7eb'; b.style.background = '#fff'; b.style.color = '#374151'; b.style.borderRadius = '8px'; b.style.padding = '6px 10px'; b.style.fontSize = '13px'; b.style.cursor = 'pointer';
                if (active){ b.style.borderColor = '#2563eb'; b.style.color = '#2563eb'; b.style.background = '#eff6ff'; }
                if (disabled){ b.disabled = true; b.style.opacity = '.5'; b.style.cursor = 'default'; }
                else { b.addEventListener('click', ()=> { coCurrentPage = p; coPaginateRows(); }); }
                return b;
            };
            root.appendChild(mk('Prev', Math.max(1, coCurrentPage-1), coCurrentPage<=1, false));
            const span = 2;
            const start = Math.max(1, coCurrentPage - span);
            const end = Math.min(pageCount, coCurrentPage + span);
            for (let p = start; p <= end; p++) root.appendChild(mk(String(p), p, false, p===coCurrentPage));
            root.appendChild(mk('Next', Math.min(pageCount, coCurrentPage+1), coCurrentPage>=pageCount, false));
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
                tr.innerHTML = `
                    <td style="padding:10px 8px;">${u.name || ''}</td>
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
                overlay.style.display = 'flex';
                try {
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    document.documentElement.style.overflow = 'hidden';
                    document.body.style.overflow = 'hidden';
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












