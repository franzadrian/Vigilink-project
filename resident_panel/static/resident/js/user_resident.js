document.addEventListener('DOMContentLoaded', function() {
  const tbody = document.getElementById('resident-table-body');
  const input = document.getElementById('resident-search-input');
  const pager = document.getElementById('resident-pagination');
  let rowsData = [];
  try {
    const node = document.getElementById('residents-data');
    if (node && node.textContent) rowsData = JSON.parse(node.textContent);
  } catch (e) { rowsData = []; }
  const flagsEl = document.getElementById('residents-flags');
  const isOwner = flagsEl && flagsEl.dataset && flagsEl.dataset.isOwner === '1';
  const isSecurity = flagsEl && flagsEl.dataset && flagsEl.dataset.isSecurity === '1';
  const removeUrl = flagsEl && flagsEl.dataset && flagsEl.dataset.removeUrl;
  const reportUrl = flagsEl && flagsEl.dataset && flagsEl.dataset.reportUrl;

  // Modal helpers
  const overlay = document.getElementById('res-modal-overlay');
  const mTitle = document.getElementById('res-modal-title');
  const mBody = document.getElementById('res-modal-body');
  const mActions = document.getElementById('res-modal-actions');
  const mClose = document.getElementById('res-modal-close');
  function openModal(title, bodyNode, actions){
    if (!overlay || !mTitle || !mBody || !mActions) { alert(title); return; }
    mTitle.textContent = title || '';
    mBody.innerHTML = '';
    if (bodyNode) mBody.appendChild(bodyNode);
    mActions.innerHTML = '';
    (actions||[]).forEach(btn => mActions.appendChild(btn));
    overlay.style.display = 'flex'; requestAnimationFrame(()=> overlay.classList.add('open'));
  }
  function closeModal(){
    if (!overlay) return;
    overlay.classList.remove('open'); setTimeout(()=>{ if (overlay) overlay.style.display='none'; }, 200);
  }
  if (mClose) mClose.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', (e)=> { if (e.target === overlay) closeModal(); });

  function getCsrfToken() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  // Toast helper
  function showToast(message, type){
    let root = document.getElementById('res-toast-root');
    if (!root){ root = document.createElement('div'); root.id = 'res-toast-root'; root.className = 'res-toast-root'; document.body.appendChild(root); }
    const el = document.createElement('div'); el.className = 'res-toast' + (type ? (' ' + type) : '');
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('in'));
    setTimeout(()=>{ el.classList.remove('in'); el.classList.add('out'); setTimeout(()=> el.remove(), 220); }, 3200);
  }

  // Build report modal content
  const REPORT_REASONS = [
    'Suspicious behavior',
    'Vandalism or property damage',
    'Noise disturbance',
    'Animal-related concern',
    'Possible criminal activity',
    'Impersonation or identity misuse',
    'Harassment or threats',
    'False information / impersonation',
    'Trespassing',
    'Reckless driving or speeding',
    'Improper garbage disposal or dumping',
    'Observations',
    'Other (please specify)'
  ];
  function buildReportForm(config){
    const wrap = document.createElement('div');
    wrap.className = 'res-form';

    // Target block
    if (config && config.mode === 'resident' && config.resident){
      const tgt = document.createElement('div');
      tgt.className = 'res-target-chip';
      tgt.textContent = `Reporting: ${config.resident.name || ''} (Block ${config.resident.block||''} / Lot ${config.resident.lot||''})`;
      wrap.appendChild(tgt);
    } else {
      // Generic incident reporting (non-resident only)
      // Put brief description at the top of the form
      const outsiderFieldTop = document.createElement('div'); outsiderFieldTop.className = 'res-field';
      const outLblTop = document.createElement('label'); outLblTop.className = 'res-label'; outLblTop.textContent = 'Brief description (who/what)';
      const outInTop = document.createElement('textarea'); outInTop.id = 'report-outsider-desc'; outInTop.className = 'res-textarea'; outInTop.rows = 3; outInTop.placeholder = 'Describe who/what you saw, location, attire, behavior...';
      outsiderFieldTop.appendChild(outLblTop); outsiderFieldTop.appendChild(outInTop); wrap.appendChild(outsiderFieldTop);
    }

    // Toolbar: Priority selector (left) and Anonymous switch (right)
    const toolbar = document.createElement('div');
    toolbar.className = 'res-form-toolbar';
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.alignItems = 'center';
    toolbar.style.gap = '16px';
    
    // Priority selector (left side)
    const priorityLeftWrap = document.createElement('div');
    priorityLeftWrap.style.display = 'flex';
    priorityLeftWrap.style.alignItems = 'center';
    priorityLeftWrap.style.gap = '8px';
    const priorityLbl = document.createElement('label');
    priorityLbl.className = 'res-label';
    priorityLbl.style.marginBottom = '0';
    priorityLbl.style.fontSize = '13px';
    priorityLbl.textContent = 'Priority Level:';
    const prioritySelect = document.createElement('select');
    prioritySelect.id = 'report-priority';
    prioritySelect.className = 'res-select';
    prioritySelect.style.width = 'auto';
    prioritySelect.style.minWidth = '120px';
    prioritySelect.innerHTML = `
      <option value="level_1">Level 1</option>
      <option value="level_2" selected>Level 2</option>
      <option value="level_3">Level 3</option>
    `;
    const priorityHint = document.createElement('span');
    priorityHint.style.fontSize = '11px';
    priorityHint.style.color = '#6b7280';
    priorityHint.style.fontStyle = 'italic';
    priorityHint.textContent = '(Auto-set, changeable)';
    priorityLeftWrap.appendChild(priorityLbl);
    priorityLeftWrap.appendChild(prioritySelect);
    priorityLeftWrap.appendChild(priorityHint);
    
    // Anonymous switch (right side)
    const anonWrap = document.createElement('label');
    anonWrap.className = 'res-switch';
    const anon = document.createElement('input');
    anon.type = 'checkbox';
    anon.id = 'report-anon';
    anon.className = 'res-switch-input';
    const track = document.createElement('span'); track.className = 'res-switch-track';
    const thumb = document.createElement('span'); thumb.className = 'res-switch-thumb'; track.appendChild(thumb);
    const anonText = document.createElement('span'); anonText.className = 'res-switch-label'; anonText.textContent = 'Submit anonymously';
    anonWrap.appendChild(anon); anonWrap.appendChild(track); anonWrap.appendChild(anonText);
    
    toolbar.appendChild(priorityLeftWrap);
    toolbar.appendChild(anonWrap);
    wrap.appendChild(toolbar);

    // Reasons checkboxes
    const reasonsWrap = document.createElement('div'); reasonsWrap.className = 'res-field';
    const reasonsLbl = document.createElement('div'); reasonsLbl.className = 'res-label'; reasonsLbl.textContent = 'Reason(s) for report:';
    const list = document.createElement('div'); list.className = 'res-checkbox-grid';
    // Removed inline 'Other' text field; use the Details field instead when 'Other' is selected.
    REPORT_REASONS.forEach(label => {
      const lab = document.createElement('label');
      lab.className = 'res-check';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.value = label;
      const chip = document.createElement('span'); chip.className = 'res-check-chip'; chip.textContent = label;
      lab.appendChild(cb); lab.appendChild(chip); list.appendChild(lab);
    });
    reasonsWrap.appendChild(reasonsLbl); reasonsWrap.appendChild(list);
    wrap.appendChild(reasonsWrap);

    // Function to auto-update priority based on selected reasons
    function updatePriorityFromReasons() {
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value.toLowerCase());
      if (selected.length === 0) {
        prioritySelect.value = 'level_2'; // Default
        return;
      }

      // Level 3 - Serious keywords
      const level3Keywords = [
        'possible criminal activity',
        'criminal activity',
        'vandalism',
        'property damage',
        'harassment',
        'threats',
        'reckless driving',
        'speeding',
        'trespassing',
        'impersonation',
        'identity misuse',
        'false information'
      ];

      // Level 2 - Suspicious keywords
      const level2Keywords = [
        'suspicious behavior',
        'animal-related concern',
        'other'
      ];

      // Level 1 - Minor keywords
      const level1Keywords = [
        'noise disturbance',
        'observations',
        'improper garbage disposal',
        'dumping'
      ];

      // Check for level 3 (most serious)
      for (const reason of selected) {
        for (const keyword of level3Keywords) {
          if (reason.includes(keyword)) {
            prioritySelect.value = 'level_3';
            return;
          }
        }
      }

      // Check for level 2
      for (const reason of selected) {
        for (const keyword of level2Keywords) {
          if (reason.includes(keyword)) {
            prioritySelect.value = 'level_2';
            return;
          }
        }
      }

      // Check for level 1
      for (const reason of selected) {
        for (const keyword of level1Keywords) {
          if (reason.includes(keyword)) {
            prioritySelect.value = 'level_1';
            return;
          }
        }
      }

      // Default to level 2
      prioritySelect.value = 'level_2';
    }

    // Add event listeners to checkboxes to auto-update priority
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updatePriorityFromReasons);
    });

    // Details
    const detField = document.createElement('div'); detField.className = 'res-field';
    const detLbl = document.createElement('label'); detLbl.className = 'res-label'; detLbl.textContent = 'Details (required if selecting Other)';
    const det = document.createElement('textarea'); det.id='report-details'; det.rows = 4; det.className = 'res-textarea';
    detField.appendChild(detLbl); detField.appendChild(det); wrap.appendChild(detField);

    // (brief description for outsiders already added at the top)

    // Anonymous toggle now lives in toolbar above

    // Actions
    const cancel = document.createElement('button'); cancel.className = 'btn btn-soft'; cancel.type='button'; cancel.textContent='Cancel'; cancel.addEventListener('click', closeModal);
    const submit = document.createElement('button'); submit.className = 'btn btn-primary'; submit.type='button'; submit.textContent='Submit Report';
    submit.addEventListener('click', () => {
      // Collect selections
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
      // If 'Other' is selected, Details must be provided (validated below)
      let target_type = 'resident'; let target_user_id = '';
      let outsider_desc = '';
      if (config && config.mode === 'resident' && config.resident){
        target_type = 'resident'; target_user_id = config.resident.id;
      } else {
        // Generic incident: always outsider
        target_type = 'outsider';
        const out = wrap.querySelector('#report-outsider-desc');
        outsider_desc = out && out.value ? out.value.trim() : '';
      }
      const details = det.value.trim();
      const selectedOther = selected.some(v => (v||'').toLowerCase().startsWith('other'));
      if (selectedOther && !details){
        showToast('Please provide details when selecting "Other (please specify)".', 'error');
        try { det.focus(); det.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
        return;
      }
      const anonymous = anon.checked ? '1' : '0';

      const priority = prioritySelect.value || 'level_2';
      
      const payload = {
        target_type,
        target_user_id,
        reasons: JSON.stringify(selected),
        details,
        outsider_desc,
        anonymous,
        priority
      };
      const url = reportUrl || '/resident/report/';
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': getCsrfToken() },
        body: new URLSearchParams(payload).toString(),
      }).then(res => res.json()).then(data => {
        if (data && data.ok){ closeModal(); showToast('Report submitted. Thank you.', 'success'); }
        else { showToast((data && data.error) || 'Unable to submit report', 'error'); }
      }).catch(() => showToast('Unable to submit report', 'error'));
    });

    return { body: wrap, actions: [cancel, submit] };
  }

  // Pagination state
  let pageSize = 10;
  let currentPage = 1;
  let filteredData = [];

  function avatarHtml(r){
    if (r.avatar) return `<img class="avatar-img" src="${r.avatar}" alt="${r.name||''}" onerror="this.style.display='none'">`;
    return `<span class="avatar">${r.initials||''}</span>`;
  }

  function renderRows(data, emptyText) {
    if (!tbody) return;
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.style.padding = '12px';
      td.style.color = '#6b7280';
      td.style.textAlign = 'center';
      td.textContent = emptyText || 'No residents found.';
      tr.appendChild(td);
      frag.appendChild(tr);
      tbody.appendChild(frag);
      return;
    }
    data.forEach(r => {
      const tr = document.createElement('tr');
      const colResident = document.createElement('td');
      const colBlockLot = document.createElement('td');
      const colActions = document.createElement('td');
      colActions.className = 'actions-col';

      colResident.innerHTML = `
        <div class="resident-name">
          <div class="resident-avatar-clickable" data-user-id="${r.id}">
            ${avatarHtml(r)}
          </div>
          <span class="resident-name-clickable" data-user-id="${r.id}">${r.name}</span>
        </div>`;
      colBlockLot.textContent = `${r.block||''}/${r.lot||''}`;
      const actions = document.createElement('div');
      actions.className = 'actions';
      // Show View button for owners and security
      if (isOwner || isSecurity) {
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-primary';
        viewBtn.type = 'button';
        viewBtn.textContent = 'View';
        viewBtn.addEventListener('click', () => {
          const wrap = document.createElement('div');
          const card = document.createElement('div'); card.className = 'res-user-card';
          const ava = document.createElement('div'); ava.className = 'res-user-avatar';
          if (r.avatar){ const img = document.createElement('img'); img.src = r.avatar; img.alt = r.name||''; ava.appendChild(img); }
          else { ava.textContent = (r.initials||'').toUpperCase(); }
          const meta = document.createElement('div'); meta.className = 'res-user-meta';
          const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = r.name||'';
          const sb = document.createElement('div'); sb.className = 'sub'; sb.textContent = (r.email||'');
          const bl = document.createElement('div'); bl.className = 'sub'; bl.textContent = `Block: ${r.block||''}   Lot: ${r.lot||''}`;
          const role = document.createElement('div'); role.className = 'sub'; role.textContent = `Role: ${r.role||'Unknown'}`;
          meta.appendChild(nm); if (r.email) meta.appendChild(sb); meta.appendChild(bl); meta.appendChild(role);
          card.appendChild(ava); card.appendChild(meta);
          wrap.appendChild(card);
          openModal('User Details', wrap);
        });
        actions.appendChild(viewBtn);
      }

      if (isOwner) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger';
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          if (!removeUrl) return;
          const body = document.createElement('div');
          body.innerHTML = `<p>Are you sure you want to remove <strong>${(r.name||'').replace(/[<>&]/g, s=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]))}</strong> from this community?</p>`;
          const cancel = document.createElement('button'); cancel.className = 'btn btn-soft'; cancel.textContent = 'Cancel'; cancel.type = 'button'; cancel.addEventListener('click', closeModal);
          const confirmBtn = document.createElement('button'); confirmBtn.className = 'btn btn-danger'; confirmBtn.textContent = 'Remove'; confirmBtn.type = 'button';
          confirmBtn.addEventListener('click', () => {
            fetch(removeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': getCsrfToken() },
              body: new URLSearchParams({ user_id: r.id }).toString(),
            }).then(res => res.json()).then(data => {
              if (data && data.ok) {
                closeModal();
                rowsData = rowsData.filter(x => String(x.id) !== String(r.id));
                filteredData = rowsData.slice();
                setPage(1);
                showToast(`${r.name} removed from the community.`, 'success');
              } else {
                showToast((data && data.error) || 'Unable to remove user', 'error');
              }
            }).catch(() => showToast('Unable to remove user', 'error'));
          });
          openModal('Confirm Removal', body, [cancel, confirmBtn]);
        });
        actions.appendChild(removeBtn);
      } else if (!isSecurity && r.role === 'resident') {
        const reportBtn = document.createElement('button');
        reportBtn.className = 'btn btn-danger';
        reportBtn.type = 'button';
        reportBtn.textContent = 'Report';
        reportBtn.addEventListener('click', () => {
          const built = buildReportForm({ mode: 'resident', resident: r });
          openModal('Report Resident', built.body, built.actions);
        });
        actions.appendChild(reportBtn);
      }
      colActions.appendChild(actions);

      tr.appendChild(colResident);
      tr.appendChild(colBlockLot);
      tr.appendChild(colActions);
      
      // Add click events to name and avatar elements
      const avatarClickable = colResident.querySelector('.resident-avatar-clickable');
      const nameClickable = colResident.querySelector('.resident-name-clickable');
      
      const navigateToProfile = (userId) => {
        window.location.href = `/user/profile/${userId}/`;
      };
      
      if (avatarClickable) {
        avatarClickable.style.cursor = 'pointer';
        avatarClickable.addEventListener('click', (e) => {
          e.stopPropagation();
          navigateToProfile(r.id);
        });
      }
      
      if (nameClickable) {
        nameClickable.style.cursor = 'pointer';
        nameClickable.addEventListener('click', (e) => {
          e.stopPropagation();
          navigateToProfile(r.id);
        });
      }
      
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function renderPagination(total, page) {
    if (!pager) return;
    pager.innerHTML = '';
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (page > pageCount) page = pageCount;

    const mkBtn = (label, p, disabled, active, isPageNumber = false) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (active ? ' active' : '');
      b.textContent = label;
      
      if (isPageNumber) {
        // Page numbers are unclickable but look normal
        b.style.cursor = 'default';
      } else {
        b.style.cursor = 'pointer';
      }
      
      if (disabled) { b.disabled = true; }
      else if (!isPageNumber) { b.addEventListener('click', () => setPage(p)); }
      return b;
    };
    // Only show Previous button if not on first page
    if (page > 1) {
      pager.appendChild(mkBtn('Prev', Math.max(1, page-1), false, false));
    }
    
    // Show only current page number
    pager.appendChild(mkBtn(String(page), page, false, true, true));
    
    // Only show Next button if not on last page
    if (page < pageCount) {
      pager.appendChild(mkBtn('Next', Math.min(pageCount, page+1), false, false));
    }
  }

  function setPage(p) {
    currentPage = Math.max(1, p|0);
    const total = filteredData.length;
    const start = (currentPage - 1) * pageSize;
    const pageItems = filteredData.slice(start, start + pageSize);
    const qRaw = (input && input.value) || '';
    const emptyMsg = qRaw ? `There\'s no member named \"${qRaw.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}\".` : 'No residents yet.';
    renderRows(pageItems, emptyMsg);
    renderPagination(total, currentPage);
  }

  function filter() {
    const qRaw = (input && input.value || '');
    const q = qRaw.toLowerCase();
    filteredData = !q ? rowsData.slice() : rowsData.filter(r => (r.name||'').toLowerCase().includes(q) || (r.block||'').toLowerCase().includes(q) || (r.lot||'').toLowerCase().includes(q));
    setPage(1);
  }

  if (input) input.addEventListener('input', filter);
  // Initial render with pagination
  filteredData = rowsData.slice();
  setPage(1);

  // Toast display from server-provided message
  (function(){
    let msg = '';
    try {
      const s = document.getElementById('res-toast-json');
      if (s && s.textContent) {
        msg = JSON.parse(s.textContent);
      }
    } catch (e) {}
    if (!msg) {
      // Fallback: legacy data attribute (decode \uXXXX sequences)
      const d = document.getElementById('res-toast-data');
      let raw = d && d.dataset ? (d.dataset.toast || '') : '';
      if (raw && /\\u[0-9a-fA-F]{4}/.test(raw)) {
        try { msg = JSON.parse('"' + raw.replace(/"/g, '\\"') + '"'); } catch(e) { msg = raw; }
      } else { msg = raw; }
    }
    if (msg) showToast(msg, 'success');
  })();

  // Global "Report Incident" (non-resident or choose resident)
  const topReportBtn = document.getElementById('resident-report-incident');
  if (topReportBtn){
    topReportBtn.addEventListener('click', function(){
      const built = buildReportForm({ mode: 'generic' });
      openModal('Report Incident', built.body, built.actions);
    });
  }
  const extraReportBtns = document.querySelectorAll('.resident-report-incident-btn');
  extraReportBtns.forEach(btn => btn.addEventListener('click', function(){
    const built = buildReportForm({ mode: 'generic' });
    openModal('Report Incident', built.body, built.actions);
  }));
});












