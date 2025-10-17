// CSS.escape fallback for broader support
var CSS_ESCAPE = (typeof CSS !== 'undefined' && CSS && CSS.escape) ? CSS.escape : function (s) {
  return String(s).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
};

// Minimal sidebar open/close for admin communication page
document.addEventListener('DOMContentLoaded', function () {
  try {
    var btn = document.getElementById('mobile-menu-btn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');

    if (!btn || !sidebar) return;

    function openSidebar() {
      try { sidebar.classList.add('open'); } catch (e) {}
      try { document.body.classList.add('sidebar-open'); } catch (e) {}
      try { if (overlay) overlay.classList.add('active'); } catch (e) {}
    }

    function closeSidebar() {
      try { sidebar.classList.remove('open'); } catch (e) {}
      try { document.body.classList.remove('sidebar-open'); } catch (e) {}
      try { if (overlay) overlay.classList.remove('active'); } catch (e) {}
    }

    btn.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) { closeSidebar(); } else { openSidebar(); }
    });

    if (overlay) overlay.addEventListener('click', closeSidebar);

    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) closeSidebar();
    });
  } catch (e) {}
});

// Admin Communication Table + Modal Chat
  (function () {
    var csrf = (document.querySelector('[name=csrfmiddlewaretoken]') || {}).value;
    var table = document.getElementById('comm-table');
    var modal = document.getElementById('admin-chat-modal');
    var modalClose = document.getElementById('modal-close');
    var modalSend = document.getElementById('modal-send');
    var modalInput = document.getElementById('modal-input');
    var modalThread = document.getElementById('modal-thread');
    var modalDone = document.getElementById('modal-mark-done');
    var modalUserName = document.getElementById('modal-user-name');
    var modalUserType = document.getElementById('modal-user-type');
    var modalUserStatus = document.getElementById('modal-user-status');

    // Custom confirm + toast elements
    var confirmModal = document.getElementById('confirm-modal');
    var confirmTitle = document.getElementById('confirm-title');
    var confirmMessage = document.getElementById('confirm-message');
    var confirmOk = document.getElementById('confirm-ok');
    var confirmCancel = document.getElementById('confirm-cancel');
    var toastRoot = document.getElementById('toast-root');

    var currentUserId = null;
    var currentMessageId = null;
    var newMsgPollTimer = null;
    var lastPollMs = Date.now();

    function setStatusBadge(isRegistered) {
    if (!modalUserStatus) return;
    try {
      modalUserStatus.classList.remove('registered', 'guest');
      if (isRegistered) {
        modalUserStatus.textContent = 'Registered User';
        modalUserStatus.classList.add('registered');
      } else {
        modalUserStatus.textContent = 'Guest User';
        modalUserStatus.classList.add('guest');
      }
    } catch (e) {}
  }
  
    function updateUnreadBadgeCount() {
      try {
        fetch('/admin-panel/communication/unread-count/')
          .then(function(r){ return r.json().catch(function(){ return {}; }); })
          .then(function(data){
            var badge = document.getElementById('unread-badge');
            if (!badge) return;
            var c = (data && typeof data.unread_count === 'number') ? data.unread_count : 0;
            if (c > 0) { badge.textContent = String(c); badge.style.display = 'flex'; }
            else { badge.style.display = 'none'; }
          })
          .catch(function(){});
      } catch(e) {}
    }

    function showConfirmDialog(title, message, confirmText) {
      return new Promise(function(resolve){
        try {
          if (!confirmModal) return resolve(window.confirm(message));
          if (confirmTitle) confirmTitle.textContent = String(title || 'Confirm');
          if (confirmMessage) confirmMessage.textContent = String(message || 'Are you sure?');
          try { if (confirmOk) confirmOk.textContent = String(confirmText || 'OK'); } catch(_){}
          confirmModal.style.display = 'flex';
          var done = false;
          function cleanup(){
            try { confirmModal.style.display = 'none'; } catch(_){}
            try { confirmOk.removeEventListener('click', onOk); } catch(_){}
            try { confirmCancel.removeEventListener('click', onCancel); } catch(_){}
          }
          function onOk(){ if (done) return; done = true; cleanup(); resolve(true); }
          function onCancel(){ if (done) return; done = true; cleanup(); resolve(false); }
          if (confirmOk) confirmOk.addEventListener('click', onOk, { once: true });
          if (confirmCancel) confirmCancel.addEventListener('click', onCancel, { once: true });
          // Close when clicking outside box
          confirmModal.addEventListener('click', function(ev){ if (ev.target === confirmModal) onCancel(); }, { once: true });
        } catch(e){ resolve(window.confirm(message)); }
      });
    }

    function showToast(msg, type){
      try {
        if (!toastRoot) return;
        var el = document.createElement('div');
        el.setAttribute('role','status');
        el.style.padding = '10px 12px';
        el.style.borderRadius = '8px';
        el.style.border = '1px solid #d1d5db';
        el.style.boxShadow = '0 6px 24px rgba(0,0,0,.12)';
        el.style.background = '#f9fafb';
        el.style.color = '#111827';
        if (type === 'success') { el.style.background = '#d1fae5'; el.style.borderColor = '#34d399'; el.style.color = '#065f46'; }
        else if (type === 'error') { el.style.background = '#fee2e2'; el.style.borderColor = '#fca5a5'; el.style.color = '#b91c1c'; }
        else if (type === 'info') { el.style.background = '#e0f2fe'; el.style.borderColor = '#93c5fd'; el.style.color = '#0369a1'; }
        el.textContent = String(msg || '');
        toastRoot.appendChild(el);
        setTimeout(function(){ try { el.style.opacity='0'; el.style.transition='opacity .3s'; } catch(_){} }, 2200);
        setTimeout(function(){ try { toastRoot.removeChild(el); } catch(_){} }, 2600);
      } catch(_){}
    }

    function markRowAsRead(messageId) {
      try {
        var row = document.querySelector('.comm-row[data-message-id="' + CSS_ESCAPE(String(messageId)) + '"]');
        if (!row) return;
        row.classList.remove('unread');
        row.setAttribute('data-is-read', '1');
        var s = row.querySelector('.status');
        if (s) {
          s.textContent = 'Done';
          s.classList.remove('active');
          s.classList.add('done');
          s.style.color = '#065f46';
          s.style.background = '#d1fae5';
        }
        // Remove mark button if present
        var mb = row.querySelector('.mark-btn');
        if (mb && mb.parentNode) mb.parentNode.removeChild(mb);
      } catch(e) {}
    }

    function openModalFor(userId, name, type, msgId) {
    currentUserId = userId ? parseInt(userId, 10) : null;
    currentMessageId = msgId ? parseInt(msgId, 10) : null;
    if (modalUserName) modalUserName.textContent = name || 'User';
    if (modalUserType) modalUserType.textContent = 'Request: ' + (type || 'General Inquiry');
    if (modal) modal.style.display = 'block';

    function computeDoneFlag(uid) {
      try {
        if (uid != null) {
          var row = document.querySelector('.comm-row[data-user-id="' + CSS_ESCAPE(String(uid)) + '"]');
          if (row) {
            var st = row.querySelector('.status');
            if (st && (st.classList.contains('done') || /\bdone\b/i.test(String(st.textContent || '')))) {
              return true;
            }
          }
        }
      } catch (e) {}
      return false;
    }

    function computeDoneFlagByMessage(mid) {
      try {
        if (mid != null) {
          var row = document.querySelector('.comm-row[data-message-id="' + CSS_ESCAPE(String(mid)) + '"]');
          if (row) {
            var st = row.querySelector('.status');
            if (st && (st.classList.contains('done') || /\bdone\b/i.test(String(st.textContent || '')))) {
              return true;
            }
          }
        }
      } catch (e) {}
      return false;
    }

    function applyCompose(uid, doneFlagNow) {
    if (!uid) {
      if (modalInput) modalInput.disabled = true;
      if (modalSend) modalSend.disabled = true;
      if (modalThread) {
        modalThread.innerHTML = '<div style="color:#6b7280;">No chat available for guest request.</div>';
      }
    } else if (doneFlagNow) {
      if (modalInput) modalInput.disabled = true;
      if (modalSend) modalSend.disabled = true;
      // Do NOT clear the thread; still load and show previous messages
      loadThread();
      try { var note = document.getElementById('modal-disabled-note'); var compose = document.getElementById('modal-compose'); if (note) note.style.display='block'; if (compose) compose.style.display='none'; } catch(e) {}
    } else {
      if (modalInput) modalInput.disabled = false;
      if (modalSend) modalSend.disabled = false;
      try { var note2 = document.getElementById('modal-disabled-note'); var compose2 = document.getElementById('modal-compose'); if (note2) note2.style.display='none'; if (compose2) compose2.style.display='flex'; } catch(e) {}
      loadThread();
    }
    }

    // Fallback when message metadata is unavailable
    function fallback() {
      var df = computeDoneFlag(currentUserId);
      applyCompose(currentUserId, df);
    }

      try {
        if (currentMessageId) {
          fetch('/admin-panel/communication/message/' + currentMessageId + '/', { headers: { 'Accept': 'application/json' } })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (data) {
              if (data && typeof data.is_registered !== 'undefined') setStatusBadge(!!data.is_registered);
              if (data && data.user_id && !currentUserId) {
                currentUserId = parseInt(data.user_id, 10);
              }
              var doneFlag = computeDoneFlagByMessage(currentMessageId);
              applyCompose(currentUserId, doneFlag);
            })
            .catch(fallback);
        } else { fallback(); }
      } catch (e) { fallback(); }
    

      try { if (modalInput && !modalInput.disabled) modalInput.focus(); } catch (e) {}
      try { if (modalPollTimer) clearInterval(modalPollTimer); modalPollTimer = setInterval(pollModalThread, 2000); } catch(_){}
  }

    function closeModal() {
      if (modal) modal.style.display = 'none';
      currentUserId = null;
      if (modalThread) modalThread.innerHTML = '';
      try { if (modalPollTimer) { clearInterval(modalPollTimer); modalPollTimer = null; } } catch(_){}
    }

    function renderMessage(item) {
      var wrap = document.createElement('div');
      wrap.style.margin = '6px 0';
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = item.is_own ? 'flex-end' : 'flex-start';

      // Actions (left of bubble) – visible on hover (desktop), always on mobile
      var actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.alignItems = 'center';
      actions.style.gap = '4px';
      actions.style.marginRight = item.is_own ? '6px' : '6px';
      actions.style.opacity = '0';
      actions.style.transition = 'opacity .15s ease';

      function computeMobile() { try { return window.innerWidth <= 768; } catch(_) { return false; } }
      function updateActionsVisibility(viaHover) {
        try {
          if (computeMobile()) { actions.style.opacity = '1'; return; }
          actions.style.opacity = viaHover ? '1' : '0';
        } catch(_) {}
      }
      wrap.addEventListener('mouseenter', function(){ updateActionsVisibility(true); });
      wrap.addEventListener('mouseleave', function(){ updateActionsVisibility(false); });
      window.addEventListener('resize', function(){ updateActionsVisibility(false); });

      if (item && item.is_own && (item.id || item.message_id)) {
          // Show small More button first; reveal horizontal icons (Delete left, Edit right) on click
          var moreWrap = document.createElement('div');
          moreWrap.style.display = 'inline-flex';
          moreWrap.style.alignItems = 'center';

          var moreBtn = document.createElement('button');
          moreBtn.type = 'button';
          moreBtn.setAttribute('aria-label', 'More options');
          moreBtn.title = 'More';
          moreBtn.style.border = '1px solid #d1d5db';
          moreBtn.style.background = '#fff';
          moreBtn.style.color = '#374151';
          moreBtn.style.borderRadius = '999px';
          moreBtn.style.width = '22px';
          moreBtn.style.height = '22px';
          moreBtn.style.cursor = 'pointer';
          moreBtn.style.display = 'inline-flex';
          moreBtn.style.alignItems = 'center';
          moreBtn.style.justifyContent = 'center';
          moreBtn.innerHTML = '<span style="display:inline-block; line-height:1; font-size:12px;">&#8942;</span>';

          var iconsWrap = document.createElement('div');
          iconsWrap.style.display = 'none';
          iconsWrap.style.alignItems = 'center';
          iconsWrap.style.gap = '4px';

          var btnDel = document.createElement('button');
          btnDel.type = 'button';
          btnDel.title = 'Delete';
          btnDel.setAttribute('aria-label', 'Delete message');
          btnDel.style.width = '22px';
          btnDel.style.height = '22px';
          btnDel.style.borderRadius = '999px';
          btnDel.style.border = '1px solid #d1d5db';
          btnDel.style.background = '#fff';
          btnDel.style.color = '#b91c1c';
          btnDel.style.cursor = 'pointer';
          btnDel.style.display = 'inline-flex';
          btnDel.style.alignItems = 'center';
          btnDel.style.justifyContent = 'center';
          btnDel.innerHTML = '<i class="fas fa-trash-alt" style="font-size:12px;"></i>';

          var btnEdit = document.createElement('button');
          btnEdit.type = 'button';
          btnEdit.title = 'Edit';
          btnEdit.setAttribute('aria-label', 'Edit message');
          btnEdit.style.width = '22px';
          btnEdit.style.height = '22px';
          btnEdit.style.borderRadius = '999px';
          btnEdit.style.border = '1px solid #d1d5db';
          btnEdit.style.background = '#fff';
          btnEdit.style.color = '#374151';
          btnEdit.style.cursor = 'pointer';
          btnEdit.style.display = 'inline-flex';
          btnEdit.style.alignItems = 'center';
          btnEdit.style.justifyContent = 'center';
          btnEdit.innerHTML = '<i class="fas fa-pen" style="font-size:12px;"></i>';

          iconsWrap.appendChild(btnDel);
          iconsWrap.appendChild(btnEdit);

          function closeIcons(){ iconsWrap.style.display = 'none'; moreBtn.style.display = 'inline-flex'; document.removeEventListener('click', onDoc, true); }
          function onDoc(ev){ if (!iconsWrap.contains(ev.target) && ev.target !== moreBtn) closeIcons(); }
          moreBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); iconsWrap.style.display = 'inline-flex'; moreBtn.style.display = 'none'; setTimeout(function(){ document.addEventListener('click', onDoc, true); }, 0); });

          moreWrap.appendChild(moreBtn);
          moreWrap.appendChild(iconsWrap);
          actions.appendChild(moreWrap);

        // Delete
        btnDel.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          var mid = String(item.id || item.message_id);
          showConfirmDialog('Delete Message', 'Are you sure you want to delete this message?', 'Delete').then(function(ok){
            if (!ok) return;
            fetch('/user/communication/delete-message/', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
              body: JSON.stringify({ message_id: mid })
            })
            .then(function(r){ return r.json().catch(function(){ return {}; }); })
            .then(function(data){ if (data && data.success) { try { wrap.parentNode && wrap.parentNode.removeChild(wrap); showToast('Message deleted', 'success'); } catch(_){} } else { showToast('Failed to delete message', 'error'); } })
            .catch(function(){ showToast('Failed to delete message', 'error'); });
          });
        });

        // Inline edit
        btnEdit.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          if (wrap.__editing) return; wrap.__editing = true;
          var original = String(item.message || '');
          var editor = document.createElement('div');
          editor.style.background = '#fff';
          editor.style.border = '1px solid #d1d5db';
          editor.style.borderRadius = '8px';
          editor.style.padding = '6px';
          editor.style.maxWidth = '70%';
          var ta = document.createElement('textarea');
          ta.value = original; ta.rows = 3; ta.style.width = '100%'; ta.style.resize = 'vertical';
          ta.style.border = '1px solid #e5e7eb'; ta.style.borderRadius = '6px'; ta.style.padding = '6px 8px'; ta.maxLength = 500;
          var bar = document.createElement('div'); bar.style.display = 'flex'; bar.style.gap = '6px'; bar.style.justifyContent = 'flex-end'; bar.style.marginTop = '6px';
          var btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.textContent = 'Cancel'; btnCancel.style.border = '1px solid #d1d5db'; btnCancel.style.background = '#fff'; btnCancel.style.borderRadius = '6px'; btnCancel.style.padding = '6px 10px'; btnCancel.style.cursor = 'pointer';
          var btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.textContent = 'Save'; btnSave.style.border = '1px solid #2563EB'; btnSave.style.background = '#2563EB'; btnSave.style.color = '#fff'; btnSave.style.borderRadius = '6px'; btnSave.style.padding = '6px 10px'; btnSave.style.cursor = 'pointer';
          bar.appendChild(btnCancel); bar.appendChild(btnSave); editor.appendChild(ta); editor.appendChild(bar);
          var parent = bubble.parentNode; parent.replaceChild(editor, bubble);
          function restore(){ try { parent.replaceChild(bubble, editor); } catch(_){} wrap.__editing = false; }
          btnCancel.addEventListener('click', function(){ restore(); });
          btnSave.addEventListener('click', function(){
            var updated = String(ta.value || '').trim(); if (!updated || updated === original) { restore(); return; }
            var mid = String(item.id || item.message_id);
            fetch('/user/communication/edit-message/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify({ message_id: mid, new_content: updated }) })
              .then(function(r){ return r.json().catch(function(){ return {}; }); })
              .then(function(data){ if (data && data.success) { item.message = updated; bubble.textContent = updated; showToast('Message updated', 'success'); } else { showToast('Failed to update message', 'error'); } restore(); })
              .catch(function(){ showToast('Failed to update message', 'error'); restore(); });
          });
        });
      }

      var bubble = document.createElement('div');
      bubble.style.maxWidth = '70%';
      bubble.style.padding = '8px 10px';
      bubble.style.borderRadius = '10px';
      bubble.style.border = '1px solid #e5e7eb';
      bubble.style.background = item.is_own ? '#2563EB' : '#f9fafb';
      bubble.style.color = item.is_own ? '#fff' : '#111827';
      bubble.style.boxSizing = 'border-box';
      // Ensure long messages and long words wrap without breaking the layout
      bubble.style.whiteSpace = 'pre-wrap';
      bubble.style.wordBreak = 'break-word';
      bubble.style.overflowWrap = 'anywhere';
      bubble.textContent = item.message || '';

      // Order: actions then bubble so actions sit left of bubble
      wrap.appendChild(actions);
      wrap.appendChild(bubble);
      // Ensure correct initial visibility of actions
      updateActionsVisibility(false);
      return wrap;
    }

    function getTimeWindow() {
      var start = null, end = null;
      try {
        var row = document.querySelector('.comm-row[data-message-id="' + CSS_ESCAPE(String(currentMessageId)) + '"]');
        if (row) {
          start = row.getAttribute('data-created-at') || null;
          var uid = row.getAttribute('data-user-id');
          if (uid && start) {
            var rows = Array.prototype.slice.call(document.querySelectorAll('.comm-row[data-user-id="' + CSS_ESCAPE(String(uid)) + '"]'));
            var starts = rows.map(function(r){ return r.getAttribute('data-created-at') || null; }).filter(Boolean);
            // find next greater than start
            var sTime = new Date(start).getTime();
            var candidates = starts.map(function(iso){ return { iso: iso, t: new Date(iso).getTime() }; }).filter(function(o){ return o.t > sTime; });
            if (candidates.length) {
              candidates.sort(function(a,b){ return a.t - b.t; });
              end = candidates[0].iso;
            }
          }
        }
      } catch (e) {}
      return { start: start, end: end };
    }

    function filterByWindow(list, startISO, endISO) {
      try {
        if (!startISO) return list;
        var startT = new Date(startISO).getTime();
        var endT = endISO ? new Date(endISO).getTime() : null;
        return (list || []).filter(function(m){
          try {
            var ts = new Date(m.sent_at).getTime();
            if (isNaN(ts)) return false;
            if (ts < startT) return false;
            if (endT && ts >= endT) return false;
            return true;
          } catch (e) { return false; }
        });
      } catch (e) { return list; }
    }

    function loadThread() {
      if (!modalThread) return;
      renderedMessageIds.clear();
      modalThread.innerHTML = '<div style="color:#6b7280;">Loading messages...</div>';
      var win = getTimeWindow();
      // For guests (no userId), show only the contact text
      if (!currentUserId) {
        if (!currentMessageId) { modalThread.innerHTML = '<div style="color:#6b7280;">No messages</div>'; return; }
        fetch('/admin-panel/communication/message/' + encodeURIComponent(currentMessageId) + '/', { headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (data) {
            modalThread.innerHTML = '';
            if (data && data.message) {
              modalThread.appendChild(renderMessage({ message: data.message, is_own: false }));
              renderedMessageIds.add('contact-'+String(currentMessageId));
            } else {
              modalThread.innerHTML = '<div style="color:#6b7280;">No message found</div>';
            }
          })
          .catch(function () { modalThread.innerHTML = '<div style="color:#ef4444;">Failed to load message.</div>'; });
        return;
      }

      // Registered users: fetch DM conversation and filter by request window
      fetch('/user/communication/messages/?user_id=' + encodeURIComponent(currentUserId), { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return []; }); })
          .then(function (list) {
            modalThread.innerHTML = '';
            var filtered = filterByWindow(Array.isArray(list) ? list : [], win.start, win.end);
            // Also show the original contact content at the top, but avoid duplicating if DM contains the same text
            fetch('/admin-panel/communication/message/' + encodeURIComponent(currentMessageId) + '/', { headers: { 'Accept': 'application/json' } })
              .then(function (r) { return r.json().catch(function(){ return {}; }); })
              .then(function (data) {
                var showContact = false;
                if (data && data.message) {
                  showContact = true;
                  try {
                    if (Array.isArray(filtered) && filtered.some(function(m){ return String(m && m.message || '') === String(data.message || ''); })) {
                      showContact = false;
                    }
                  } catch (_) {}
                }
                if (showContact) {
                  modalThread.appendChild(renderMessage({ message: data.message, is_own: false }));
                }
                if (!filtered.length && !showContact) {
                  modalThread.innerHTML = '<div style="color:#6b7280;">No messages</div>';
                } else {
                  filtered.forEach(function (m) {
                    var mid = String(m.id || m.message_id || '');
                    if (mid) { try { renderedMessageIds.add(mid); } catch(_){} }
                    modalThread.appendChild(renderMessage(m));
                  });
                }
                try { modalThread.scrollTop = modalThread.scrollHeight; } catch (e) {}
              })
              .catch(function(){
                if (!filtered.length) { modalThread.innerHTML = '<div style="color:#6b7280;">No messages</div>'; }
                else {
                  filtered.forEach(function (m) {
                    var mid = String(m.id || m.message_id || '');
                    if (mid) { try { renderedMessageIds.add(mid); } catch(_){} }
                    modalThread.appendChild(renderMessage(m));
                  });
                }
                try { modalThread.scrollTop = modalThread.scrollHeight; } catch (e) {}
              });
          })
        .catch(function () { modalThread.innerHTML = '<div style="color:#ef4444;">Failed to load messages.</div>'; });
    }

    // Incrementally append new messages to the modal thread (without clearing)
    var modalPollTimer = null;
    var renderedMessageIds = new Set();

    function renderInitialThread() {
      if (!modalThread) return;
      renderedMessageIds.clear();
      modalThread.innerHTML = '';
      var win = getTimeWindow();
      var renderContactPromise = fetch('/admin-panel/communication/message/' + encodeURIComponent(currentMessageId) + '/', { headers: { 'Accept':'application/json' } })
        .then(function(r){ return r.json().catch(function(){ return {}; }); })
        .then(function(data){ if (data && data.message) { var node = renderMessage({ message: data.message, is_own: false }); modalThread.appendChild(node); renderedMessageIds.add('contact-'+String(currentMessageId)); } });
      if (!currentUserId) { return renderContactPromise; }
      return fetch('/user/communication/messages/?user_id=' + encodeURIComponent(currentUserId), { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return []; }); })
          .then(function(list){ var win2 = getTimeWindow(); var filtered = filterByWindow(Array.isArray(list)?list:[], win2.start, win2.end); filtered.forEach(function(m){ var mid = String(m.id || m.message_id || ''); if (!mid) return; var node = renderMessage(m); modalThread.appendChild(node); renderedMessageIds.add(mid); }); try { modalThread.scrollTop = modalThread.scrollHeight; } catch(_){} });
    }

    function pollModalThread() {
      if (!modal || modal.style.display === 'none') return;
      if (!currentMessageId) return;
      // Append only new items
      if (currentUserId) {
        fetch('/user/communication/messages/?user_id=' + encodeURIComponent(currentUserId), { headers: { 'Accept':'application/json' } })
          .then(function(r){ return r.json().catch(function(){ return []; }); })
          .then(function(list){ var win = getTimeWindow(); var filtered = filterByWindow(Array.isArray(list)?list:[], win.start, win.end); filtered.forEach(function(m){ var mid = String(m.id || m.message_id || ''); if (!mid) return; if (renderedMessageIds.has(mid)) return; var node = renderMessage(m); modalThread.appendChild(node); renderedMessageIds.add(mid); try { modalThread.scrollTop = modalThread.scrollHeight; } catch(_){} }); });
      }
    }

    // ---- Live updates: add new requests into the table ----
    function deriveContactType(subject) {
      try {
        var s = String(subject || '').toLowerCase();
        if (s.indexOf('feedback') >= 0) return 'Feedback';
        if (s.indexOf('report') >= 0) return 'Report';
        if (s.indexOf('inquiry') >= 0 || s.indexOf('enquiry') >= 0) return 'General Inquiry';
      } catch(e) {}
      return 'General Inquiry';
    }

    function buildRowForContact(msg) {
      var tr = document.createElement('tr');
      tr.className = 'comm-row unread';
      tr.setAttribute('data-user-id', '');
      tr.setAttribute('data-message-id', String(msg.id));
      tr.setAttribute('data-name', String(msg.name || 'User'));
      tr.setAttribute('data-type', deriveContactType(msg.subject));
      tr.setAttribute('data-is-read', msg.is_read ? '1' : '0');
      tr.setAttribute('data-created-at', (msg.created_at || ''));

      // Full Name
      var tdName = document.createElement('td');
      tdName.style.padding = '10px 12px';
      tdName.setAttribute('data-label', 'Full Name');
      tdName.textContent = String(msg.name || 'User');

      // Type badge
      var tdType = document.createElement('td');
      tdType.style.padding = '10px 12px';
      tdType.setAttribute('data-label', 'Type');
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.display = 'inline-block';
      badge.style.padding = '4px 8px';
      badge.style.borderRadius = '999px';
      badge.style.background = '#eef2ff';
      badge.style.color = '#1e3a8a';
      badge.style.fontWeight = '600';
      badge.style.fontSize = '12px';
      badge.textContent = deriveContactType(msg.subject);
      tdType.appendChild(badge);

      // Status: new = Active
      var tdStatus = document.createElement('td');
      tdStatus.className = 'status-cell';
      tdStatus.style.padding = '10px 12px';
      tdStatus.setAttribute('data-label', 'Status');
      var st = document.createElement('span');
      st.className = 'status active';
      st.textContent = 'Active';
      st.style.color = '#1e3a8a';
      st.style.background = '#e0e7ff';
      st.style.padding = '3px 8px';
      st.style.borderRadius = '6px';
      st.style.fontWeight = '600';
      st.style.fontSize = '12px';
      tdStatus.appendChild(st);

      // Actions (right-aligned): View + Mark as Done
      var tdActions = document.createElement('td');
      tdActions.className = 'actions-cell';
      tdActions.style.padding = '10px 12px';
      tdActions.style.textAlign = 'right';
      tdActions.style.display = 'flex';
      tdActions.style.alignItems = 'center';
      tdActions.style.gap = '10px';
      tdActions.style.justifyContent = 'flex-end';
      tdActions.setAttribute('data-label', 'Actions');

      var group = document.createElement('div');
      group.className = 'actions-group';
      group.style.display = 'flex';
      group.style.gap = '10px';

      var btnView = document.createElement('button');
      btnView.className = 'btn view-btn action-btn';
      btnView.setAttribute('aria-label', 'View conversation');
      btnView.style.padding = '6px 10px';
      btnView.style.border = '1px solid #d1d5db';
      btnView.style.borderRadius = '6px';
      btnView.style.background = '#fff';
      btnView.style.cursor = 'pointer';
      btnView.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i><span class="btn-text">View</span>';

      var btnDone = document.createElement('button');
      btnDone.className = 'btn mark-btn action-btn';
      btnDone.setAttribute('aria-label', 'Mark as done');
      btnDone.style.padding = '6px 10px';
      btnDone.style.border = '1px solid #10b981';
      btnDone.style.borderRadius = '6px';
      btnDone.style.background = '#d1fae5';
      btnDone.style.color = '#065f46';
      btnDone.style.cursor = 'pointer';
      btnDone.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i><span class="btn-text">Mark as Done</span>';

      group.appendChild(btnView);
      group.appendChild(btnDone);
      tdActions.appendChild(group);

      tr.appendChild(tdName);
      tr.appendChild(tdType);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);
      return tr;
    }

    function ensureTableHasNewMessages(items, unreadCount) {
      try {
        var tbody = table ? table.querySelector('tbody') : null;
        if (!tbody) return;
        var added = 0;
        items.forEach(function (m) {
          var exists = document.querySelector('.comm-row[data-message-id="' + CSS_ESCAPE(String(m.id)) + '"]');
          if (exists) return;
          var row = buildRowForContact(m);
          // Prepend to the top to prioritize newest
          if (tbody.firstChild) tbody.insertBefore(row, tbody.firstChild);
          else tbody.appendChild(row);
          added++;
        });
        // Update unread badge using server count if provided
        if (typeof unreadCount === 'number') {
          var badge = document.getElementById('unread-badge');
          if (badge) {
            if (unreadCount > 0) { badge.textContent = String(unreadCount); badge.style.display = 'flex'; }
            else { badge.style.display = 'none'; }
          }
        } else {
          updateUnreadBadgeCount();
        }
        if (added > 0) { try { showToast(added + ' new contact request' + (added>1?'s':''), 'info'); } catch(_){} }
      } catch (e) {}
    }

    function pollNewMessages() {
      try {
        var url = '/admin-panel/communication/new-messages/?last_timestamp=' + encodeURIComponent(String(lastPollMs));
        fetch(url).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(data){
          if (!data || data.status !== 'success') return;
          var items = Array.isArray(data.messages) ? data.messages : [];
          ensureTableHasNewMessages(items, data.unread_count);
          // Advance the checkpoint time
          if (items.length) {
            // Use now to avoid replay, or compute max from payload
            lastPollMs = Date.now();
          }
        }).catch(function(){});
      } catch (e) {}
    }

    function sendMessage() {
      // Block sending if current request is marked Done
      try {
        if (currentMessageId) {
          var openRow = document.querySelector('.comm-row[data-message-id="' + CSS_ESCAPE(String(currentMessageId)) + '"]');
          if (openRow && openRow.getAttribute('data-is-read') === '1') return;
          var composeEl = document.getElementById('modal-compose');
          if (composeEl && getComputedStyle(composeEl).display === 'none') return;
        }
      } catch (e) {}
      if (!currentUserId || !modalInput || !modalInput.value.trim()) return;
      var payload = { receiver: currentUserId, message: modalInput.value.trim() };
      if (modalSend) modalSend.disabled = true;
      fetch('/user/communication/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (data) {
          if (modalSend) modalSend.disabled = false;
          if (data && (data.id || data.message)) {
            var own = { message: data.message || payload.message, is_own: true, id: (data.id || data.message_id) };
            if (modalThread) {
              var node = renderMessage(own);
              modalThread.appendChild(node);
              try { if (own.id) renderedMessageIds.add(String(own.id)); } catch(_){}
            }
            try { modalThread.scrollTop = modalThread.scrollHeight; } catch (e) {}
            modalInput.value = '';
          }
        })
      .catch(function () { if (modalSend) modalSend.disabled = false; });
  }

    function markDoneForCurrent() {
      if (!currentMessageId) return;
      showConfirmDialog('Mark as Done', 'Are you sure you want to mark this request as Done?', 'Mark as Done').then(function(ok){
        if (!ok) return;
        fetch('/admin-panel/communication/mark-read/' + currentMessageId + '/', {
          method: 'POST', headers: { 'X-CSRFToken': csrf }
        })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (data) {
            try {
              markRowAsRead(currentMessageId);
              // Hide compose and show disabled note in modal immediately
              try {
                var note = document.getElementById('modal-disabled-note');
                var compose = document.getElementById('modal-compose');
                if (note) note.style.display = 'block';
                if (compose) compose.style.display = 'none';
                if (modalInput) modalInput.disabled = true;
                if (modalSend) modalSend.disabled = true;
              } catch (_) {}
              updateUnreadBadgeCount();
              showToast('Request marked as Done', 'success');
            } catch (e) {}
          })
          .catch(function () { showToast('Failed to mark as Done', 'error'); });
      });
    }

  // Bind table actions
  if (table) {
    table.addEventListener('click', function (ev) {
      var viewBtn = ev.target.closest && ev.target.closest('.view-btn');
      var markBtn = ev.target.closest && ev.target.closest('.mark-btn');
      var tr = ev.target.closest && ev.target.closest('tr');
      if (!tr) return;
      if (viewBtn) {
      var uid = tr.getAttribute('data-user-id');
      var nm = tr.getAttribute('data-name');
      var tp = tr.getAttribute('data-type');
      var mid = tr.getAttribute('data-message-id');
      openModalFor(uid, nm, tp, mid);
        return;
      }
        if (markBtn) {
          var mid2 = tr.getAttribute('data-message-id');
          if (!mid2) return;
          showConfirmDialog('Mark as Done', 'Are you sure you want to mark this request as Done?', 'Mark as Done').then(function(ok){
            if (!ok) return;
            fetch('/admin-panel/communication/mark-read/' + mid2 + '/', {
              method: 'POST', headers: { 'X-CSRFToken': csrf }
            })
              .then(function (r) { return r.json().catch(function () { return {}; }); })
              .then(function () {
                try {
                  // Update just this row
                  var row = tr;
                  row.classList.remove('unread');
                  row.setAttribute('data-is-read','1');
                  var s = row.querySelector('.status');
                  if (s) {
                    s.textContent = 'Done';
                    s.classList.remove('active');
                    s.classList.add('done');
                    s.style.color = '#065f46';
                    s.style.background = '#d1fae5';
                  }
                  var mb = row.querySelector('.mark-btn');
                  if (mb && mb.parentNode) mb.parentNode.removeChild(mb);

                  // If modal currently open for this message, disable sending immediately
                  if (currentMessageId && String(currentMessageId) === String(mid2)) {
                    if (modalInput) modalInput.disabled = true;
                    if (modalSend) modalSend.disabled = true;
                    try {
                      var note3 = document.getElementById('modal-disabled-note');
                      var compose3 = document.getElementById('modal-compose');
                      if (note3) note3.style.display = 'block';
                      if (compose3) compose3.style.display = 'none';
                    } catch (e) {}
                  }
                  updateUnreadBadgeCount();
                  showToast('Request marked as Done', 'success');
                } catch (e) { showToast('Failed to update UI', 'error'); }
              })
              .catch(function () { showToast('Failed to mark as Done', 'error'); });
          });
        }
    }, true);
  }

  // Bind modal controls
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }
    if (modalSend) modalSend.addEventListener('click', sendMessage);
    if (modalInput) modalInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
      if (modalDone) modalDone.addEventListener('click', markDoneForCurrent);

    // Start polling for new contact requests on page load
    try {
      if (document.getElementById('comm-table')) {
        setInterval(function(){ try { pollNewMessages(); } catch(_){} }, 10000);
        setTimeout(function(){ try { pollNewMessages(); } catch(_){} }, 1500);
      }
    } catch(e) {}
    })();

  



