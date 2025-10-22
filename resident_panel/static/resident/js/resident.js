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
  const removeUrl = flagsEl && flagsEl.dataset && flagsEl.dataset.removeUrl;

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
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }
  function closeModal(){
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
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
          ${avatarHtml(r)}
          <span>${r.name}</span>
        </div>`;
      colBlockLot.textContent = `${r.block||''}/${r.lot||''}`;
      const actions = document.createElement('div');
      actions.className = 'actions';
      if (isOwner) {
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
          meta.appendChild(nm); if (r.email) meta.appendChild(sb); meta.appendChild(bl);
          card.appendChild(ava); card.appendChild(meta);
          wrap.appendChild(card);
          openModal('Resident Details', wrap);
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
      } else {
        const reportBtn = document.createElement('button');
        reportBtn.className = 'btn btn-danger';
        reportBtn.type = 'button';
        reportBtn.textContent = 'Report';
        reportBtn.addEventListener('click', () => {
          alert('Report submitted.');
        });
        actions.appendChild(reportBtn);
      }
      colActions.appendChild(actions);

      tr.appendChild(colResident);
      tr.appendChild(colBlockLot);
      tr.appendChild(colActions);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function renderPagination(total, page) {
    if (!pager) return;
    pager.innerHTML = '';
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (page > pageCount) page = pageCount;

    const mkBtn = (label, p, disabled, active) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (active ? ' active' : '');
      b.textContent = label;
      if (disabled) { b.disabled = true; }
      else { b.addEventListener('click', () => setPage(p)); }
      return b;
    };
    pager.appendChild(mkBtn('Prev', Math.max(1, page-1), page<=1, false));
    const span = 2;
    const start = Math.max(1, page - span);
    const end = Math.min(Math.max(1, Math.ceil(total / pageSize)), page + span);
    for (let p = start; p <= end; p++) {
      pager.appendChild(mkBtn(String(p), p, false, p===page));
    }
    pager.appendChild(mkBtn('Next', Math.min(Math.max(1, Math.ceil(total / pageSize)), page+1), page>=Math.ceil(total / pageSize), false));
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
});
