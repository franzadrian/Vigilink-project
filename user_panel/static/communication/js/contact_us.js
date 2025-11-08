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

  // Unread badge on My Contact Requests button
  function ensureContactBadge() {
    if (!openBtn) return null;
    try { openBtn.style.position = 'relative'; } catch (_) {}
    let badge = openBtn.querySelector('.contact-requests-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'contact-requests-badge';
      Object.assign(badge.style, {
        position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px',
        borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: '700',
        display: 'none', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 0 0 2px #fff', lineHeight: '18px'
      });
      openBtn.appendChild(badge);
    }
    return badge;
  }

  function updateContactBadgeFromThreads(threads) {
    const badge = ensureContactBadge();
    if (!badge) return;
    const activeCount = (threads || []).filter(t => !t.is_read).length;
    if (activeCount > 0) {
      badge.textContent = activeCount > 9 ? '9+' : String(activeCount);
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  function pollContactBadge() {
    fetch('/user/communication/contact-unread-count/', { method: 'GET', headers: { 'Accept': 'application/json' } })
      .then(r => r.json())
      .then(data => {
        const badge = ensureContactBadge();
        if (!badge) return;
        const c = (data && data.unread_count) ? parseInt(data.unread_count, 10) : 0;
        if (c > 0) {
          badge.textContent = c > 9 ? '9+' : String(c);
          badge.style.display = 'inline-flex';
        } else {
          badge.textContent = '';
          badge.style.display = 'none';
        }
      })
      .catch(() => {});
  }

  // Immediately refresh the global sidebar badge (sum of chats + contact requests)
  function refreshGlobalCommBadge() {
    try {
      const badge = document.getElementById('comm-unread-badge');
      if (!badge) return;
      
      // Check if notifications are enabled
      const isEnabled = badge.getAttribute('data-notifications-enabled') === 'true' || 
                       (typeof window.receiveNotificationsEnabled !== 'undefined' && window.receiveNotificationsEnabled);
      
      if (!isEnabled) {
        badge.style.display = 'none';
        badge.removeAttribute('data-count');
        return;
      }
      
      const chatsReq = fetch('/user/communication/recent-chats/', { method: 'GET' }).then(r => r.json()).catch(() => null);
      const contactReq = fetch('/user/communication/contact-unread-count/', { method: 'GET' }).then(r => r.json()).catch(() => null);
      Promise.all([chatsReq, contactReq])
        .then(([chats, contact]) => {
          const list = (chats && (chats.users || chats)) || [];
          const chatTotal = Array.isArray(list) ? list.reduce((acc, c) => acc + (parseInt(c.unread_count || 0, 10) || 0), 0) : 0;
          const contactTotal = (contact && typeof contact.unread_count !== 'undefined') ? (parseInt(contact.unread_count, 10) || 0) : 0;
          const total = chatTotal + contactTotal;
          if (total > 0) {
            const label = total > 99 ? '99+' : String(total);
            badge.textContent = label;
            badge.setAttribute('data-count', String(total));
            badge.style.display = 'inline-flex';
          } else {
            badge.style.display = 'none';
            badge.removeAttribute('data-count');
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

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
      try {
        // Cache threads and build end bounds per thread (next newer created_at)
        window.contactThreadsCache = threads.slice();
        const asc = threads.slice().sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const endMap = {};
        for (let i = 0; i < asc.length - 1; i++) {
          const cur = asc[i], nxt = asc[i+1];
          endMap[String(cur.id)] = nxt.created_at;
        }
        window.contactThreadEndTimes = endMap;
      } catch (_) { window.contactThreadsCache = threads; window.contactThreadEndTimes = {}; }
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
    // If there are requests but none are active, show an info banner with a Contact Us link
    try {
      const hasActive = threads.some(t => !t.is_read);
      if (!hasActive) {
        const href = escapeAttr(contactUrl);
        const banner = document.createElement('div');
        banner.className = 'contact-alert';
        banner.style.background = '#e0f2fe';
        banner.style.color = '#0369a1';
        banner.style.border = '1px solid #93c5fd';
        banner.style.margin = '8px 0';
        banner.style.borderRadius = '10px';
        banner.style.padding = '10px 12px';
        banner.innerHTML = `You don't have any active requests. <a href="${href}" style="text-decoration:none; font-weight:600; color:#2563EB;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Submit a Contact Us</a> to make a new request.`;
        listEl.appendChild(banner);
      }
    } catch (_) {}
      // Keep badge consistent with unread admin replies only
        try { pollContactBadge(); } catch (_) {}
      threads.forEach(t => {
        const item = document.createElement('div');
        item.className = 'ticket-item' + (t.is_read ? '' : ' active');
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
        // Adjust button label depending on status
        try {
          const btn = item.querySelector('.open-admin-chat');
          if (btn) {
            if (t.is_read) {
              btn.innerHTML = '<i class="fas fa-eye"></i> View Conversation';
            } else {
              btn.innerHTML = '<i class="fas fa-comments"></i> Chat with Admin';
            }
          }
        } catch (_) {}
        // Open admin chat on click
      item.querySelector('.open-admin-chat').addEventListener('click', async (ev) => {
        ev.preventDefault();
        // Attach end bound if known
        try { t.end_at = (window.contactThreadEndTimes || {})[String(t.id)] || null; } catch(_) { t.end_at = null; }
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
      // Track the contact thread state so compose can be disabled if Done
      try {
        window.activeContactThread = {
          id: thread.id,
          subject: thread.subject,
          created_at: thread.created_at,
          end_at: thread.end_at || null,
          is_read: !!thread.is_read
        };
        if (typeof window.applyComposeLockIfNeeded === 'function') {
          window.applyComposeLockIfNeeded();
        }
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
      // After opening the admin chat (which marks incoming messages read), refresh badges promptly
      setTimeout(() => { try { pollContactBadge(); } catch(_){} }, 400);
      setTimeout(() => { try { refreshGlobalCommBadge(); } catch(_){} }, 600);
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
  // Start badge immediately and poll even if panel is closed
  try {
    ensureContactBadge();
    pollContactBadge();
    setInterval(pollContactBadge, 10000);
  } catch (_) {}
})();
