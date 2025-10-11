// Global unread badge updater for the user sidebar
(function () {
  const BADGE_ID = 'comm-unread-badge';
  let pollTimer = null;

  function getBadge() {
    return document.getElementById(BADGE_ID);
  }

  function renderBadge(total) {
    const badge = getBadge();
    if (!badge) return;
    const prev = parseInt(badge.getAttribute('data-count') || '0', 10) || 0;
    if (total > 0) {
      const label = total > 99 ? '99+' : String(total);
      const wasHidden = (badge.style.display === 'none' || badge.style.display === '');
      badge.textContent = label;
      badge.setAttribute('data-count', String(total));
      badge.style.display = 'inline-flex';
      // Animate on appear and on increase
      if (wasHidden) {
        badge.classList.remove('bump');
        void badge.offsetWidth; // reflow
        badge.classList.add('anim-in');
        setTimeout(() => badge.classList.remove('anim-in'), 220);
      } else if (total > prev) {
        badge.classList.remove('anim-in', 'bump');
        void badge.offsetWidth;
        badge.classList.add('bump');
        setTimeout(() => badge.classList.remove('bump'), 260);
      }
    } else {
      badge.style.display = 'none';
      badge.removeAttribute('data-count');
    }
  }

  function computeTotalUnread(payload) {
    const list = (payload && (payload.users || payload)) || [];
    if (!Array.isArray(list)) return 0;
    return list.reduce((acc, chat) => acc + (parseInt(chat.unread_count || 0, 10) || 0), 0);
  }

  function tick() {
    // Endpoint already used by the communication page
    fetch('/user/communication/recent-chats/', { method: 'GET' })
      .then(r => r.json())
      .then(data => {
        const total = computeTotalUnread(data);
        renderBadge(total);
      })
      .catch(() => { /* silent */ });
  }

  function start() {
    if (!getBadge()) return; // Only run on pages with the badge
    tick();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(tick, 5000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

