// Contact Threads Panel JS (view and open chat with admins)
(function() {
  const threadsPanel = document.getElementById('contact-threads-panel');
  if (!threadsPanel) return;

  const openBtn = document.getElementById('open-contact-threads');
  const closeBtn = document.getElementById('close-contact-threads');
  const userListEl = document.getElementById('user-list');
  const chatMessages = document.getElementById('chat-messages');
  const welcome = document.getElementById('welcome-screen');
  const listEl = document.getElementById('contact-threads-list');
  const alertEl = document.getElementById('contact-threads-alert');
  const csrf = (document.querySelector('[name=csrfmiddlewaretoken]') || {}).value;
  const contactUrl = threadsPanel.getAttribute('data-contact-url') || '/user/contact/';
  const threadsUrl = threadsPanel.getAttribute('data-threads-url') || '/user/communication/contact-threads/';
  const supportUrl = threadsPanel.getAttribute('data-support-url') || '/user/communication/support-admin/';
  const bootstrapUrl = threadsPanel.getAttribute('data-bootstrap-url') || '/user/communication/bootstrap-contact-chat/';

  let cameFromList = false;

  function showThreads() {
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    // On mobile, the button lives in the left list. Hide it to reveal the panel.
    if (isMobile && userListEl) {
      try {
        const visible = !userListEl.classList.contains('hidden') && getComputedStyle(userListEl).display !== 'none';
        cameFromList = visible;
        if (visible) userListEl.classList.add('hidden');
      } catch (_) {}
    }
    try { chatMessages && chatMessages.classList.add('hidden'); } catch (_) {}
    try { welcome && welcome.classList.add('hidden'); } catch (_) {}
    threadsPanel.classList.remove('hidden');
    loadThreads();
  }
  function hideThreads() {
    threadsPanel.classList.add('hidden');
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && cameFromList && userListEl) {
      // Return to the user list if we came from there
      try { userListEl.classList.remove('hidden'); } catch (_) {}
      cameFromList = false;
      return;
    }
    // Default: return to chat
    try { chatMessages && chatMessages.classList.remove('hidden'); } catch (_) {}
  }

  if (openBtn) openBtn.addEventListener('click', showThreads);
  if (closeBtn) closeBtn.addEventListener('click', hideThreads);

  // Hide panel if selecting a user from list
  document.addEventListener('click', (e) => {
    const row = e.target.closest && e.target.closest('.user-item');
    if (row && !threadsPanel.classList.contains('hidden')) hideThreads();
  });

  function showAlert(type, text) {
    if (!alertEl) return;
    alertEl.hidden = false;
    alertEl.className = `contact-alert ${type === 'success' ? 'success' : 'error'}`;
    alertEl.textContent = text || '';
  }

  async function loadThreads() {
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-messages">Loading your contact requests...</div>';
    try {
      const r = await fetch(threadsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const data = await r.json();
      if (!r.ok) throw new Error((data && data.message) || 'Failed to load');
      const threads = Array.isArray(data.threads) ? data.threads : [];
      renderThreads(threads);
    } catch (e) {
      listEl.innerHTML = '';
      showAlert('error', 'Unable to load your requests.');
    }
  }

  function renderThreads(threads) {
    listEl.innerHTML = '';
    if (!threads.length) {
      const href = escapeAttr(contactUrl);
      listEl.innerHTML = `
        <div class="no-users">
          <div class="no-users-icon"><i class="fas fa-inbox"></i></div>
          <div class="no-users-text">
            <p>No contact requests yet</p>
            <a class="go-contact-btn" href="${href}"><i class="fas fa-paper-plane"></i> Go to Contact Us</a>
          </div>
        </div>`;
      return;
    }
    threads.forEach(t => {
      const item = document.createElement('div');
      item.className = 'ticket-item';
      item.innerHTML = `
        <div class="ticket-main">
          <div class="ticket-subject">${escapeHtml(t.subject || 'Contact')}</div>
          <div class="ticket-meta">
            <span class="ticket-date">${formatDate(t.created_at)}</span>
            ${t.is_read ? '' : '<span class="ticket-badge">New</span>'}
          </div>
        </div>
        <div class="ticket-body">${escapeHtml((t.message || '').slice(0, 240))}${(t.message && t.message.length > 240) ? '…' : ''}</div>
        <div class="ticket-actions">
          <button class="open-admin-chat" data-ticket-id="${t.id}"><i class="fas fa-comments"></i> Chat with Admin</button>
        </div>
      `;
      // Open admin chat on click
      item.querySelector('.open-admin-chat').addEventListener('click', async (ev) => {
        ev.preventDefault();
        await openAdminChat(t);
      });
      listEl.appendChild(item);
    });
  }

  async function openAdminChat(thread) {
    try {
      const r = await fetch(supportUrl, { headers: { 'Accept': 'application/json' } });
      const data = await r.json();
      if (!r.ok) {
        const msg = (data && (data.message || data.error)) || 'No admin available';
        throw new Error(msg);
      }
      if (!data || !data.admin || !data.admin.id) throw new Error('No admin available');
      // Update header name to requested format: Requests: <Subject> - <Date>
      try {
        const headerName = document.getElementById('selected-user-name');
        const when = formatDate(thread.created_at);
        if (headerName) headerName.textContent = `Requests: ${thread.subject || 'Contact'} - ${when}`;
      } catch (_) {}
      // Prime meta so the conversation can appear in left list after sending
      try {
        window.selectedUserMeta = {
          id: data.admin.id,
          full_name: data.admin.full_name || 'Support',
          username: data.admin.username || 'support',
          profile_picture_url: data.admin.profile_picture_url || '',
          is_admin: !!(data.admin && (data.admin.is_admin || data.admin.is_superuser || data.admin.is_staff))
        };
      } catch (_) {}
      // Ensure the original contact message appears in chat by bootstrapping it into Messages
      try {
        await fetch(bootstrapUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'Accept': 'application/json' },
          body: JSON.stringify({ contact_id: thread.id })
        });
      } catch (_) {}

      // Open the admin chat
      if (typeof window.selectUser === 'function') {
        window.selectUser(data.admin.id);
      } else {
        window.selectedUser = data.admin.id;
      }
      hideThreads();
    } catch (e) {
      try {
        // Attempt to extract an error message from a JSON response if available
        if (e && e.message) {
          showAlert('error', e.message);
        } else {
          showAlert('error', 'Unable to open admin chat.');
        }
      } catch (_) {
        showAlert('error', 'Unable to open admin chat.');
      }
    }
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleString(); } catch (_) { return ''; }
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }
  function escapeAttr(s) {
    return String(s || '').replace(/["'<>]/g, c => ({'"':'&quot;','\'':'&#39;','<':'&lt;','>':'&gt;'}[c]));
  }
})();
