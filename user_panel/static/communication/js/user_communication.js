// Global state
let selectedUser = null;
let messages = [];
let pollTimer = null;
let isMobile = window.innerWidth < 768;
let csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
// Editing state to avoid conflicts with polling/rerenders
let isEditing = false;
let editingMessageId = null;
// Track when any per-message options menu (three dots) is open
let isOptionsMenuOpen = false;
let optionsMenuForMessageId = null;
// Anchor state: when user scrolls up, avoid auto-scrolling/re-render jumps
let userAnchored = false;
let initStickTimers = [];
// Track 'Sent' labels that must persist across renders
let lastSentMessageId = null;
let lastFetchedMessages = [];
let pendingMessagesCount = 0;
let userListPollTimer = null;
let relativeTimeTimer = null;
let hiddenChatUserIds = new Set();
let selectedUserMeta = { id: null, full_name: '', username: '', profile_picture_url: '' };

// Bridge globals so other scripts (e.g., contact_us.js) can set window.selectedUserMeta
try {
    if (!('selectedUserMeta' in window)) {
        Object.defineProperty(window, 'selectedUserMeta', {
            get: function() { return selectedUserMeta; },
            set: function(v) { selectedUserMeta = v || {}; }
        });
    } else {
        // If a value was already placed on window by a previous script, consume it
        if (window.selectedUserMeta && typeof window.selectedUserMeta === 'object') {
            selectedUserMeta = window.selectedUserMeta;
        }
    }
    if (!('selectedUser' in window)) {
        Object.defineProperty(window, 'selectedUser', {
            get: function() { return selectedUser; },
            set: function(v) { selectedUser = v; }
        });
    }
} catch (e) {}
let composeLocked = false;
// hidden manager metadata removed
// Track messages the user deleted locally to avoid flicker/race until server confirms
const locallyDeletedIds = new Set();

// Lightweight hash utility for change detection
function hashMessage(m) {
    try {
        const id = m && (m.id || m.message_id) || '';
        const msg = (m && (m.message || m.content)) || '';
        const img = (m && m.image_url) || '';
        const imgsLen = (Array.isArray(m && m.image_urls) ? m.image_urls.length : 0);
        const edited = !!(m && m.is_edited);
        const deleted = !!(m && m.is_deleted);
        const ts = (m && m.sent_at) || '';
        return [id, msg.length, img, imgsLen, edited ? 1 : 0, deleted ? 1 : 0, ts].join('|');
    } catch (e) {
        return String(Math.random());
    }
}

// CSS.escape fallback for broader browser support
const cssEscape = (window.CSS && CSS.escape) ? CSS.escape : function(str) {
    return String(str).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
};

function loadHiddenChatIds() {
    try {
        const raw = localStorage.getItem('vl_hidden_chat_users');
        const arr = raw ? JSON.parse(raw) : [];
        hiddenChatUserIds = new Set((arr || []).map(String));
    } catch (e) {
        hiddenChatUserIds = new Set();
    }
}

function saveHiddenChatIds() {
    try {
        localStorage.setItem('vl_hidden_chat_users', JSON.stringify(Array.from(hiddenChatUserIds)));
    } catch (e) {}
}

function hideChatUser(userId) {
    if (!userId) return;
    const id = String(userId);
    hiddenChatUserIds.add(id);
    saveHiddenChatIds();
    const row = document.querySelector(`#search-results .user-item[data-user-id="${cssEscape(id)}"]`);
    if (row) row.remove();
    ensureListEmptyState();
}

function unhideChatUser(userId) {
    if (!userId) return;
    const id = String(userId);
    if (hiddenChatUserIds.has(id)) {
        hiddenChatUserIds.delete(id);
        saveHiddenChatIds();
    }
}

function openHiddenManager() { /* removed per request */ }

// DOM elements
const userList = document.querySelector('.user-list');
const userItems = document.querySelectorAll('.user-item');
const searchInput = document.querySelector('#user-search');
const messagesList = document.querySelector('#messages-list');
const messagesContainer = document.querySelector('.messages-container');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-btn');
const welcomeScreen = document.querySelector('#welcome-screen');
const chatMessages = document.querySelector('#chat-messages');
const backButton = document.querySelector('#back-to-users');
const messageForm = document.querySelector('#message-form');
const scrollToBottomBtn = document.querySelector('#scroll-to-bottom');
let imageFileInput = null;
// Emoji API config (public demo key provided by user)
const EMOJI_API_KEY = '4c635462a8e1eb1df2c4f4fccde0af004d04ba76';
let _emojiCache = { all: null, lastQuery: '', lastResults: [] };

function ensureEmojiPicker() {
    let picker = document.getElementById('vl-emoji-picker');
    if (picker) return picker;
    const container = document.querySelector('.message-input-container') || document.body;
    picker = document.createElement('div');
    picker.id = 'vl-emoji-picker';
    picker.className = 'emoji-picker';
    picker.innerHTML = `
      <div class="ep-header">
        <input class="ep-search" type="text" placeholder="Search emojis..." />
      </div>
      <div class="ep-body">
        <div class="ep-grid" id="vl-emoji-grid"></div>
      </div>
      <div class="ep-footer">Click an emoji to insert</div>
    `;
    container.appendChild(picker);
    // Close picker on outside click
    document.addEventListener('click', (e) => {
        const btn = document.querySelector('.input-btn[aria-label="Add emoji"]');
        if (!picker.classList.contains('visible')) return;
        if (picker.contains(e.target) || (btn && btn.contains(e.target))) return;
        picker.classList.remove('visible');
    });
    // Search handling
    const search = picker.querySelector('.ep-search');
    if (search) {
        let searchTimer = null;
        search.addEventListener('input', () => {
            const q = (search.value || '').trim();
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { loadEmojis(q); }, 200);
        });
    }
    return picker;
}

async function loadEmojis(query = '') {
    try {
        const grid = document.getElementById('vl-emoji-grid');
        if (!grid) return;
        grid.innerHTML = '';
        let list = [];
        if (!query) {
            if (_emojiCache.all && Array.isArray(_emojiCache.all) && _emojiCache.all.length) {
                list = _emojiCache.all;
            } else {
                const url = `https://emoji-api.com/emojis?access_key=${encodeURIComponent(EMOJI_API_KEY)}`;
                const r = await fetch(url);
                list = await r.json();
                if (Array.isArray(list)) _emojiCache.all = list;
                else list = [];
            }
        } else {
            if (_emojiCache.lastQuery === query && Array.isArray(_emojiCache.lastResults)) {
                list = _emojiCache.lastResults;
            } else {
                const url = `https://emoji-api.com/emojis?search=${encodeURIComponent(query)}&access_key=${encodeURIComponent(EMOJI_API_KEY)}`;
                const r = await fetch(url);
                list = await r.json();
                if (!Array.isArray(list)) list = [];
                _emojiCache.lastQuery = query;
                _emojiCache.lastResults = list;
            }
        }
        const max = Math.min(600, list.length);
        for (let i = 0; i < max; i++) {
            const item = list[i];
            const ch = (item && (item.character || item.emoji || item.unicode || ''));
            if (!ch) continue;
            const btn = document.createElement('div');
            btn.className = 'ep-item';
            btn.textContent = ch;
            btn.title = (item.unicodeName || item.slug || '').toString();
            btn.addEventListener('click', () => insertEmoji(ch));
            grid.appendChild(btn);
        }
    } catch (e) {
        const grid = document.getElementById('vl-emoji-grid');
        if (!grid) return;
        const fallback = ['😀','😄','😁','😂','🤣','😊','😍','😘','😎','😉','👍','🙏','🔥','🎉','❤️','💯','✨','👏','😭','🤔','👌','🙌'];
        fallback.forEach(ch => {
            const btn = document.createElement('div');
            btn.className = 'ep-item';
            btn.textContent = ch;
            btn.addEventListener('click', () => insertEmoji(ch));
            grid.appendChild(btn);
        });
    }
}

function insertEmoji(ch) {
    try {
        if (!messageInput) return;
        const start = messageInput.selectionStart || messageInput.value.length;
        const end = messageInput.selectionEnd || messageInput.value.length;
        const val = messageInput.value || '';
        messageInput.value = val.slice(0, start) + ch + val.slice(end);
        const pos = start + ch.length;
        messageInput.focus();
        messageInput.setSelectionRange(pos, pos);
        updateSendButton();
        updateCharCount();
    } catch (e) {}
}

// Ensure the left list shows a centered empty-state when there are no users
function ensureListEmptyState() {
    try {
        const container = document.getElementById('search-results');
        if (!container) return;
        const term = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
        // When search overlay is active, let search-specific empty state handle it
        if (term.length >= 2) return;
        const hasUsers = !!container.querySelector('.user-item:not(.search-result-item)');
        const placeholder = container.querySelector('.no-users');
        if (!hasUsers) {
            if (!placeholder) {
                const div = document.createElement('div');
                div.className = 'no-users';
                div.innerHTML = '<div class="no-users-icon"><i class="fas fa-user-slash"></i></div>' +
                                '<div class="no-users-text"><p>No users available for messaging</p></div>';
                container.appendChild(div);
            }
        } else if (placeholder) {
            placeholder.remove();
        }
    } catch (_) {}
}

// Client-side image compression to speed up uploads
async function compressImage(file, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = () => {
                img.onload = () => {
                    try {
                        let { width, height } = img;
                        const scale = Math.min(1, maxDim / Math.max(width, height));
                        width = Math.floor(width * scale);
                        height = Math.floor(height * scale);
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const f = new File([blob], (file.name || 'upload') + '.jpg', { type: 'image/jpeg' });
                                resolve(f);
                            } else {
                                resolve(file);
                            }
                        }, 'image/jpeg', quality);
                    } catch (e) {
                        resolve(file);
                    }
                };
                img.onerror = () => resolve(file);
                img.src = reader.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        } catch (e) {
            resolve(file);
        }
    });
}

// Persist last "Sent" message per conversation so the status survives refresh
function setLastSentFor(userId, messageId) {
    try { localStorage.setItem('vl_last_sent_' + String(userId), String(messageId)); } catch (e) {}
    lastSentMessageId = String(messageId);
}
function getLastSentFor(userId) {
    try { return localStorage.getItem('vl_last_sent_' + String(userId)); } catch (e) { return null; }
}
function clearLastSentFor(userId) {
    try { localStorage.removeItem('vl_last_sent_' + String(userId)); } catch (e) {}
    if (String(selectedUser) === String(userId)) {
        lastSentMessageId = null;
    }
}

// Scrolling helpers
function isNearBottom(threshold = 10) {
    const el = messagesContainer || messagesList;
    if (!el) return true;
    // Treat bottom as the natural end of the scroll area
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    return remaining <= threshold;
}

function scrollToBottom(force = false) {
    const el = messagesContainer || messagesList;
    if (!el) return;
    if (force || isNearBottom()) {
        el.scrollTop = el.scrollHeight;
        // Account for layout/paint timing
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        setTimeout(() => {
            el.scrollTop = el.scrollHeight;
        }, 100);
    }
}

// Preserve scroll position helpers when re-rendering
function captureScrollAnchor() {
    const container = messagesContainer || messagesList;
    if (!container || !messagesList) return null;
    const contRect = container.getBoundingClientRect();
    // Find the first message item visible near the top edge
    const items = Array.from(messagesList.querySelectorAll('.message-item'));
    let anchorEl = null;
    for (const it of items) {
        const r = it.getBoundingClientRect();
        if (r.bottom > contRect.top) { // element at or below the top edge
            anchorEl = it;
            break;
        }
    }
    if (!anchorEl) return null;
    const rect = anchorEl.getBoundingClientRect();
    return {
        id: anchorEl.dataset.messageId || null,
        offsetTop: rect.top - contRect.top
    };
}

function restoreScrollAnchor(anchor) {
    if (!anchor) return;
    const container = messagesContainer || messagesList;
    if (!container || !messagesList) return;
    const target = messagesList.querySelector(`.message-item[data-message-id="${anchor.id}"]`);
    if (!target) return;
    const contRect = container.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const delta = (rect.top - contRect.top) - anchor.offsetTop;
    container.scrollTop += delta;
}

// Input helpers
function updateSendButton() {
    if (!sendButton || !messageInput) return;
    const blocked = composeLocked || !!messageInput.disabled;
    const disabled = blocked || !messageInput.value.trim();
    sendButton.disabled = disabled;
    sendButton.classList.toggle('disabled', disabled);
}

// Enable/disable compose area with optional note (used for Done contact threads)
function setComposeDisabled(disabled, noteText) {
    try {
        composeLocked = !!disabled;
        const container = document.querySelector('.message-input-container');
        // Message banner element (single instance)
        let banner = document.getElementById('compose-done-banner');
        // Toggle input + send button state
        if (messageInput) messageInput.disabled = !!disabled;
        if (sendButton) sendButton.disabled = !!disabled;
        // Hide or show the form entirely
        if (container) {
            const form = container.querySelector('#message-form');
            if (disabled) {
                if (form) form.style.display = 'none';
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'compose-done-banner';
                    banner.style.margin = '8px 12px';
                    banner.style.color = '#6b7280';
                    banner.style.fontWeight = '600';
                    banner.style.textAlign = 'center';
                    banner.style.padding = '10px 12px';
                    banner.style.border = '1px solid #e5e7eb';
                    banner.style.borderRadius = '10px';
                    banner.style.background = '#f9fafb';
                    container.appendChild(banner);
                }
                banner.textContent = noteText || 'This contact request is Done. Start a new request to message again.';
                banner.style.display = 'block';
                // Also hide any emoji picker currently visible
                try { const ep = document.getElementById('vl-emoji-picker'); if (ep) ep.classList.remove('visible'); } catch(_) {}
            } else {
                if (banner) banner.style.display = 'none';
                if (form) form.style.display = '';
                if (messageInput) messageInput.placeholder = 'Type a message...';
            }
        }
    } catch (e) {}
    updateSendButton();
}

// Expose a helper for contact panel to lock/unlock compose
window.applyComposeLockIfNeeded = function() {
    try {
        const t = window.activeContactThread;
        const isAdminChat = !!(selectedUserMeta && selectedUserMeta.is_admin);
        const shouldDisable = !!(t && t.is_read && isAdminChat);
        setComposeDisabled(shouldDisable, 'This contact request is Done. Start a new request to message again.');
    } catch (e) {
        setComposeDisabled(false);
    }
}

// Update the last message preview and time in the user list
function getDisplayNameForUser(userId) {
    const item = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (!item) return '';
    const bad = ['none','null','undefined','n/a','na'];
    const normalize = (s) => (s || '').toString().trim();
    const pickToken = (s) => {
        const toks = normalize(s).split(/\s+/).filter(Boolean);
        for (const t of toks) { if (!bad.includes(t.toLowerCase())) return t; }
        if (toks.length) {
            const last = toks[toks.length - 1];
            if (!bad.includes(last.toLowerCase())) return last;
        }
        return '';
    };
    const fullAttr = normalize(item.getAttribute('data-fullname'));
    const headerName = normalize((item.querySelector('.user-name') || {}).textContent);
    const username = normalize(item.getAttribute('data-username'));
    const email = normalize(item.getAttribute('data-email'));
    const emailName = (!bad.includes(email.toLowerCase()) && email.includes('@')) ? email.split('@')[0] : '';
    return pickToken(fullAttr) || pickToken(headerName) || pickToken(username) || emailName;
}

function updateLastMessage(userId, messageText, isOwn = false, updateTime = true, reorder = true, otherName = null) {
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (!userItem) return;

    const lastMsgEl = userItem.querySelector('.last-message');
    if (lastMsgEl) {
        let prefix = '';
        const raw = (messageText || '').toString();
        const lower = raw.toLowerCase();
        const isSystemDeleted = lower.startsWith('you deleted a message') || lower.startsWith('message deleted');
        if (raw) {
            if (isOwn && !isSystemDeleted) {
                prefix = 'You: ';
            } else if (!isOwn && !isSystemDeleted) {
                // Sanitize name and fall back to list display name if needed
                const bad = ['none','null','undefined','n/a','na'];
                const normalize = (s) => (s || '').toString().trim();
                const pickToken = (s) => {
                    const toks = normalize(s).split(/\s+/).filter(Boolean);
                    for (const t of toks) { if (!bad.includes(t.toLowerCase())) return t; }
                    if (toks.length) {
                        const last = toks[toks.length - 1];
                        if (!bad.includes(last.toLowerCase())) return last;
                    }
                    return '';
                };
                let name = pickToken(otherName);
                if (!name) name = getDisplayNameForUser(userId);
                if (!name) name = pickToken(userItem.getAttribute('data-fullname')) || pickToken(userItem.getAttribute('data-username'));
                prefix = name ? `${name}: ` : '';
            }
        }
        lastMsgEl.textContent = (raw ? `${prefix}${raw}` : '');
    }

    const timeEl = userItem.querySelector('.message-time');
    if (timeEl && updateTime) {
        const nowIso = new Date().toISOString();
        timeEl.dataset.timestamp = nowIso;
        timeEl.textContent = formatRelativeTime(nowIso);
        userItem.dataset.lastMessageTime = nowIso;
    }

    // Move this user to the top of the list only if requested
    if (reorder) {
        const parent = userItem.parentElement;
        if (parent && parent.firstElementChild !== userItem) {
            parent.prepend(userItem);
        }
    }
}

function updateCharCount() {
    const counter = document.getElementById('char-count');
    if (!counter || !messageInput) return;
    const maxAttr = messageInput.getAttribute('maxlength');
    const max = maxAttr ? parseInt(maxAttr, 10) : 500;
    const used = messageInput.value.length;
    const remaining = Math.max(0, max - used);
    counter.textContent = remaining;
    counter.classList.remove('warning', 'danger');
    if (remaining <= 100) counter.classList.add('warning');
    if (remaining <= 50) counter.classList.add('danger');
}
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load hidden conversation IDs and remove any matching server-rendered entries
    loadHiddenChatIds();
    document.querySelectorAll('#search-results .user-item').forEach((it) => {
        const id = it.getAttribute('data-user-id');
        if (id && hiddenChatUserIds.has(String(id))) {
            it.remove();
        }
    });
    // Normalize initial user names to avoid generic 'User' labels
    try {
        const items = document.querySelectorAll('#search-results .user-item');
        const bad = ['none','null','undefined','n/a','na'];
        const normalize = (s) => (s || '').toString().trim();
        const isBad = (s) => { const v = normalize(s); return !v || bad.includes(v.toLowerCase()); };
        items.forEach((it) => {
            const nameEl = it.querySelector('.user-name');
            const current = normalize(nameEl ? nameEl.textContent : '');
            if (!nameEl || (current && current.toLowerCase() !== 'user')) return;
            const dsFull = normalize(it.getAttribute('data-fullname'));
            const dsUser = normalize(it.getAttribute('data-username'));
            const dsEmail = normalize(it.getAttribute('data-email'));
            const emailName = (!isBad(dsEmail) && dsEmail.includes('@')) ? dsEmail.split('@')[0] : '';
            const display = (!isBad(dsFull) ? dsFull : '') || (!isBad(dsUser) ? dsUser : '') || emailName || (current || 'User');
            if (display && display !== current) {
                nameEl.textContent = display;
            }
        });
    } catch (e) {}
    // If messages list exists, scroll to bottom on page load
    if (messagesList) {
        scrollToBottom(true);
        setTimeout(() => scrollToBottom(true), 100);
        
        // Event delegation for message actions (more/edit/delete)
        messagesList.addEventListener('click', function(e) {
            const moreBtn = e.target.closest('.more-options-btn');
            if (moreBtn) {
                e.stopPropagation();
                const item = moreBtn.closest('.message-item');
                const menu = item ? item.querySelector('.message-options-menu') : null;
                const actions = moreBtn.closest('.message-actions');
                if (menu) {
                    // Toggle visibility
                    const willShow = menu.classList.contains('hidden');
                    menu.classList.toggle('hidden');
                    if (actions) {
                        actions.classList.toggle('show', willShow);
                    }
                    // Track open/close state to pause polling-driven re-renders
                    const item = e.target.closest('.message-item');
                    if (willShow) {
                        isOptionsMenuOpen = true;
                        optionsMenuForMessageId = item ? item.dataset.messageId : null;
                    } else {
                        isOptionsMenuOpen = false;
                        optionsMenuForMessageId = null;
                        // If updates piled up while menu was open, flush them now
                        if (pendingMessagesCount > 0 && Array.isArray(lastFetchedMessages) && lastFetchedMessages.length) {
                            messages = lastFetchedMessages;
                            pendingMessagesCount = 0;
                            renderMessages();
                        }
                    }
                    if (willShow) {
                        // Measure space relative to messages container
                        const container = document.querySelector('.messages-container');
                        const contRect = container ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
                        const rect = menu.getBoundingClientRect();

                        const spaceBelow = contRect.bottom - rect.bottom;
                        const spaceAbove = rect.top - contRect.top;
                        const minNeeded = 120; // approx space for two options comfortably

                        // Flip up if not enough room below but more room above
                        if (spaceBelow < minNeeded && spaceAbove > spaceBelow) {
                            menu.classList.add('flip-up');
                        } else {
                            menu.classList.remove('flip-up');
                        }

                        // Re-measure after potential flip
                        const finalRect = menu.getBoundingClientRect();
                        const finalSpaceBelow = contRect.bottom - finalRect.bottom;
                        const finalSpaceAbove = finalRect.top - contRect.top;

                        // Constrain height and enable scroll if still tight
                        if (!menu.classList.contains('flip-up') && finalSpaceBelow < minNeeded) {
                            menu.style.maxHeight = Math.max(80, finalSpaceBelow - 8) + 'px';
                            menu.style.overflowY = 'auto';
                        } else if (menu.classList.contains('flip-up') && finalSpaceAbove < minNeeded) {
                            menu.style.maxHeight = Math.max(80, finalSpaceAbove - 8) + 'px';
                            menu.style.overflowY = 'auto';
                        } else {
                            menu.style.maxHeight = '';
                            menu.style.overflowY = '';
                        }

                        // Final fallback: fixed overlay positioning if still cramped
                        const stillTight = (!menu.classList.contains('flip-up') && finalSpaceBelow < 90) || (menu.classList.contains('flip-up') && finalSpaceAbove < 90);
                        if (stillTight) {
                            const mRect = menu.getBoundingClientRect();
                            menu.dataset._absPos = '1';
                            menu.style.position = 'fixed';
                            menu.style.left = mRect.left + 'px';
                            if (menu.classList.contains('flip-up')) {
                                // place above
                                const topPos = Math.max(10, mRect.bottom - mRect.height - 6);
                                menu.style.top = topPos + 'px';
                            } else {
                                // place below
                                const topPos = Math.min(window.innerHeight - 100, mRect.top);
                                menu.style.top = topPos + 'px';
                            }
                            menu.style.right = 'auto';
                            menu.style.bottom = 'auto';
                        }

                        // Close on outside click: hide and reset any fixed styles
                        const closeOnOutside = (ev) => {
                            if (!menu.contains(ev.target) && !moreBtn.contains(ev.target)) {
                                menu.classList.add('hidden');
                                if (actions) actions.classList.remove('show');
                                if (menu.dataset._absPos === '1') {
                                    menu.style.position = '';
                                    menu.style.left = '';
                                    menu.style.top = '';
                                    menu.style.right = '';
                                    menu.style.bottom = '';
                                    delete menu.dataset._absPos;
                                }
                                // Reset menu-open state and flush pending updates if any
                                isOptionsMenuOpen = false;
                                optionsMenuForMessageId = null;
                                if (pendingMessagesCount > 0 && Array.isArray(lastFetchedMessages) && lastFetchedMessages.length) {
                                    messages = lastFetchedMessages;
                                    pendingMessagesCount = 0;
                                    // Avoid interrupting edits
                                    if (!isEditing) {
                                        renderMessages();
                                    }
                                }
                                document.removeEventListener('click', closeOnOutside, true);
                            }
                        };
                        // Delay registration to avoid immediately catching this click
                        setTimeout(() => document.addEventListener('click', closeOnOutside, true), 0);
                    }
                }
                return;
            }

            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                const messageItem = e.target.closest('.message-item');
                // Close any open menus before entering edit state
                const openMenus = messagesList.querySelectorAll('.message-options-menu:not(.hidden)');
                openMenus.forEach((m) => {
                    m.classList.add('hidden');
                    const ac = m.closest('.message-actions');
                    if (ac) ac.classList.remove('show');
                });
                isOptionsMenuOpen = false;
                optionsMenuForMessageId = null;
                if (messageItem) {
                    // Prevent editing image messages
                    if (messageItem.querySelector('.message-image, .message-gallery')) {
                        alert('Editing image messages is not supported.');
                        return;
                    }
                    const messageId = messageItem.dataset.messageId;
                    startEditingMessage(messageItem, messageId);
                }
                return;
            }

            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const messageItem = e.target.closest('.message-item');
                // Close any open menus before confirming delete
                const openMenus = messagesList.querySelectorAll('.message-options-menu:not(.hidden)');
                openMenus.forEach((m) => {
                    m.classList.add('hidden');
                    const ac = m.closest('.message-actions');
                    if (ac) ac.classList.remove('show');
                });
                isOptionsMenuOpen = false;
                optionsMenuForMessageId = null;
                if (messageItem) {
                    const messageId = messageItem.dataset.messageId;
                    deleteMessage(messageItem, messageId);
                }
                return;
            }
        });
    }
    
    // Set up event listeners
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (composeLocked) return;
            sendMessage();
        });
    }

    if (messageInput) {
        // Set maxlength attribute to limit input to 500 characters
        messageInput.setAttribute('maxlength', '500');
        messageInput.addEventListener('input', () => {
            updateSendButton();
            updateCharCount();
        });
        // Initialize character counter
        updateCharCount();
    }
    // Hook up image upload button
    const imageBtn = document.querySelector('.input-btn[aria-label="Add image"]');
    if (imageBtn) {
        // Create a hidden file input once
        imageFileInput = document.createElement('input');
        imageFileInput.type = 'file';
        imageFileInput.accept = 'image/*';
        imageFileInput.multiple = true;
        imageFileInput.style.display = 'none';
        document.body.appendChild(imageFileInput);
        imageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (imageFileInput) imageFileInput.click();
        });
        imageFileInput.addEventListener('change', () => {
            if (!imageFileInput || !imageFileInput.files || !imageFileInput.files.length) return;
            const files = Array.from(imageFileInput.files);
            imageFileInput.value = '';
            if (files.length === 1) {
                sendImageMessage(files[0]);
            } else {
                sendImagesMessage(files);
            }
        });
    }
    // Emoji button and picker
    const emojiBtn = document.querySelector('.input-btn[aria-label="Add emoji"]');
    if (emojiBtn) {
        const picker = ensureEmojiPicker();
        emojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const p = ensureEmojiPicker();
            if (!_emojiCache.all) { loadEmojis(''); }
            p.classList.toggle('visible');
        });
    }

    // Image lightbox for viewing sent/received pictures in-page
    ensureImageLightbox();
    if (messagesList) {
        messagesList.addEventListener('click', (e) => {
            // If clicking on +N overlay, open slideshow with all images
            const overlay = e.target.closest('.gallery-overlay');
            if (overlay) {
                const msgItem = overlay.closest('.message-item');
                if (msgItem) {
                    let urls = [];
                    try { urls = JSON.parse(msgItem.dataset.imageUrls || '[]'); } catch (err) { urls = []; }
                    if (Array.isArray(urls) && urls.length) {
                        openImageLightboxWith(urls, 0);
                        return;
                    }
                }
            }

            // Clicking any image opens slideshow for that message (if multiple)
            const link = e.target.closest('.message-image-link');
            const img = e.target.closest('.message-image');
            if (link || img) {
                e.preventDefault();
                const msgItem = (link || img).closest('.message-item');
                const clickedUrl = (link && link.getAttribute('href')) || (img && img.getAttribute('src'));
                if (!msgItem || !clickedUrl) return;
                let urls = [];
                try { urls = JSON.parse(msgItem.dataset.imageUrls || '[]'); } catch (err) { urls = []; }
                if (Array.isArray(urls) && urls.length) {
                    let start = urls.indexOf(clickedUrl);
                    if (start < 0) start = 0;
                    openImageLightboxWith(urls, start);
                } else {
                    openImageLightbox(clickedUrl);
                }
            }
        });
    }
    if (backButton) {
        backButton.addEventListener('click', deselectUser);
    }
    // Hidden manager button removed
    // Remove (X) button handler via delegation on the list container
    if (userList) {
        userList.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-user-btn');
            if (!btn) return;
            e.stopPropagation();
            const item = btn.closest('.user-item');
            if (!item) return;
            const id = item.getAttribute('data-user-id');
            if (!id) return;
            hideChatUser(id);
        });
    }
    if (scrollToBottomBtn) {
        scrollToBottomBtn.addEventListener('click', () => {
            // Avoid disrupting menus or edits; if safe, apply pending updates
            if (!isEditing && !isOptionsMenuOpen && Array.isArray(lastFetchedMessages) && lastFetchedMessages.length) {
                messages = lastFetchedMessages;
                renderMessages();
            }
            pendingMessagesCount = 0;
            userAnchored = false;
            if (!pollTimer && selectedUser) startPollingMessages();
            scrollToBottom(true);
            scrollToBottomBtn.classList.remove('visible');
        });
    }
    
    // Add scroll event listener to show/hide scroll-to-bottom button
    const scrollEl = messagesContainer || messagesList;
    if (scrollEl) {
        scrollEl.addEventListener('scroll', () => {
            const nearBottom = isNearBottom();
            userAnchored = !nearBottom;
            if (scrollToBottomBtn) {
                scrollToBottomBtn.classList.toggle('visible', !nearBottom);
            }
            // If user anchored, cancel any initial stick timers
            if (userAnchored && initStickTimers.length) {
                initStickTimers.forEach(id => clearTimeout(id));
                initStickTimers = [];
            }
        });
        // Initialize button visibility on load
        if (scrollToBottomBtn) {
            scrollToBottomBtn.classList.toggle('visible', !isNearBottom());
        }
    }

    // Add click event to user items; ignore clicks on the remove button
    userItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e && e.target && e.target.closest && e.target.closest('.remove-user-btn')) return;
            const userId = parseInt(item.dataset.userId);
            selectUser(userId);
        });
    });
    // Handle window resize
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < 768;
    });
    // Initialize send button state
    updateSendButton();

    // Capture-phase guard: prevent remove-button clicks from bubbling to user item
    document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('.remove-user-btn');
        if (!btn) return;
        e.stopPropagation();
        // Perform removal here as well to ensure it always triggers
        const item = btn.closest('.user-item');
        const id = item ? item.getAttribute('data-user-id') : null;
        if (id) hideChatUser(id);
    }, true);

    // Seed initial timestamps from server-rendered data attributes (if present)
    document.querySelectorAll('.user-item').forEach((item) => {
        const timeEl = item.querySelector('.message-time');
        const iso = item.getAttribute('data-last-message-time');
        if (timeEl && iso && !timeEl.dataset.timestamp) {
            timeEl.dataset.timestamp = iso;
            timeEl.textContent = formatRelativeTime(iso);
        }
    });

    // Kick off periodic relative time updates
    tickRelativeTimes();
    if (relativeTimeTimer) clearInterval(relativeTimeTimer);
    relativeTimeTimer = setInterval(tickRelativeTimes, 5000);
    window.addEventListener('focus', tickRelativeTimes);
    
    // Show welcome screen by default on desktop
    if (!isMobile) {
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden');
        }
        if (chatMessages) {
            chatMessages.classList.add('hidden');
        }
    }
    
    // Auto-select user if URL has user_id parameter
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('user_id');
    if (userIdParam) {
        const userId = parseInt(userIdParam);
        const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
        if (userItem) {
            selectUser(userId);
        }
    }
});
// ---- Search helpers ----
function clearDynamicResults() {
    const container = document.getElementById('search-results');
    if (!container) return;
    const nodes = container.querySelectorAll('.search-result-item, .no-users-search');
    nodes.forEach(n => n.remove());
}

// Friendly relative time formatter
function formatRelativeTime(input) {
    if (!input) return '';
    const d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d)) return '';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));
    // For the first minute, always show "Just now" (no seconds countdown)
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr === 1) return '1 hour ago';
    if (diffHr < 24) return `${diffHr} hours ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    return `${diffDay} days ago`;
}

function tickRelativeTimes() {
    const items = document.querySelectorAll('.user-item');
    items.forEach((item) => {
        const timeEl = item.querySelector('.message-time');
        if (!timeEl) return;
        const ts = timeEl.dataset.timestamp || item.getAttribute('data-last-message-time');
        if (!ts) return;
        const text = formatRelativeTime(ts);
        if (text && timeEl.textContent !== text) {
            timeEl.textContent = text;
        }
    });
}

// Track which messages we have already marked as read to avoid duplicate calls
const _readMarkedIds = new Set();

// Mark all messages from the other user in the open conversation as read
function markConversationRead(userId, msgs) {
    if (!Array.isArray(msgs) || !userId) return;
    const idsToMark = [];
    for (const m of msgs) {
        const mid = m.id || m.message_id;
        if (!m || !mid) continue;
        if (m.is_own) continue; // only mark incoming messages
        if (m.is_deleted || locallyDeletedIds.has(mid)) continue;
        if (_readMarkedIds.has(String(mid))) continue;
        idsToMark.push(String(mid));
    }
    if (!idsToMark.length) return;
    idsToMark.forEach((mid) => {
        _readMarkedIds.add(mid);
        fetch(`/user/mark-read/${mid}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
            }
        }).catch(() => {});
    });
}

function showNoUsers(container) {
    if (!container) return;
    // Remove any previous message first
    const prev = container.querySelector('.no-users-search');
    if (prev) prev.remove();
    const wrap = document.createElement('div');
    wrap.className = 'no-users-search';
    wrap.innerHTML = `
        <div class="no-users-icon"><i class="fas fa-user-slash"></i></div>
        <div class="no-users-text"><p>No users found</p></div>
    `;
    container.appendChild(wrap);
}

function hideNoUsers() {
    const container = document.getElementById('search-results');
    if (!container) return;
    const el = container.querySelector('.no-users-search');
    if (el) el.remove();
}

function createUserItem(user) {
    const el = document.createElement('div');
    el.className = 'user-item';
    if (user && typeof user.id !== 'undefined') el.dataset.userId = String(user.id);
    // Sanitize name fields and dataset attributes
    const bad = ['none','null','undefined','n/a','na'];
    const normalize = (s) => (s || '').toString().trim();
    const isBad = (s) => { const v = normalize(s); return !v || bad.includes(v.toLowerCase()); };
    const full = !isBad(user && (user.full_name || user.fullname)) ? normalize(user.full_name || user.fullname) : '';
    const uname = !isBad(user && user.username) ? normalize(user.username) : '';
    const email = normalize(user && user.email);
    const emailName = (!isBad(email) && email.includes('@')) ? email.split('@')[0] : '';
    if (uname) el.dataset.username = uname;
    if (full) el.dataset.fullname = full;
    if (email) el.dataset.email = email;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    let avatarImg = null;
    // Accept either `profile_picture_url` or `profile_picture` (string or object with .url)
    let imgUrl = null;
    if (user) {
        if (typeof user.profile_picture_url === 'string' && user.profile_picture_url.trim() !== '') {
            imgUrl = user.profile_picture_url;
        } else if (typeof user.profile_picture === 'string' && user.profile_picture.trim() !== '') {
            imgUrl = user.profile_picture;
        } else if (user.profile_picture && typeof user.profile_picture.url === 'string') {
            imgUrl = user.profile_picture.url;
        }
    }
    if (imgUrl) {
        avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-image';
        // Add a cache-busting timestamp to ensure latest avatar appears
        try {
            const withTs = imgUrl + (imgUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
            avatarImg.src = withTs;
        } catch (e) {
            avatarImg.src = imgUrl;
        }
        avatarImg.alt = user.full_name || user.fullname || user.username || 'User';
        avatarImg.onerror = function() { this.onerror = null; this.src = '/static/accounts/images/profile.png'; };
        avatar.appendChild(avatarImg);
    } else {
        const initials = document.createElement('span');
        initials.className = 'avatar-text';
        const fallback = full || uname || emailName || 'U';
        const letters = fallback.toString().trim().split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase();
        initials.textContent = letters || 'U';
        avatar.appendChild(initials);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'user-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'user-name';
    const displayName = full || uname || emailName || 'User';
    nameDiv.textContent = displayName;
    const lastMsg = document.createElement('div');
    lastMsg.className = 'last-message';
    lastMsg.textContent = '';
    info.appendChild(nameDiv);
    info.appendChild(lastMsg);

    // Time
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = '';

    el.appendChild(avatar);
    el.appendChild(info);
    el.appendChild(time);

    // Mark as dynamic search result
    el.classList.add('search-result-item');

    // Click to select user
    el.addEventListener('click', () => {
        const id = user && user.id;
        if (typeof id !== 'undefined') {
            selectUser(parseInt(id));
        }
    });

    return el;
}

// Create a persistent user-list item (not a search result)
function createListUserItem(user) {
    const el = document.createElement('div');
    el.className = 'user-item';
    const idVal = (user && (user.id || user.user_id))
        ? String(user.id || user.user_id)
        : '';
    if (idVal) el.dataset.userId = idVal;
    const bad = ['none','null','undefined','n/a','na'];
    const normalize = (s) => (s || '').toString().trim();
    const isBad = (s) => { const v = normalize(s); return !v || bad.includes(v.toLowerCase()); };
    const full = !isBad(user && (user.full_name || user.fullname)) ? normalize(user.full_name || user.fullname) : '';
    const uname = !isBad(user && user.username) ? normalize(user.username) : '';
    const email = normalize(user && user.email);
    const emailName = (!isBad(email) && email.includes('@')) ? email.split('@')[0] : '';
    if (uname) el.dataset.username = uname;
    if (full) el.dataset.fullname = full;
    if (email) el.dataset.email = email;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    let avatarImg = null;
    let imgUrl = null;
    if (user) {
        if (typeof user.profile_picture_url === 'string' && user.profile_picture_url.trim() !== '') {
            imgUrl = user.profile_picture_url;
        } else if (typeof user.profile_picture === 'string' && user.profile_picture.trim() !== '') {
            imgUrl = user.profile_picture;
        } else if (user.profile_picture && typeof user.profile_picture.url === 'string') {
            imgUrl = user.profile_picture.url;
        }
    }
    if (imgUrl) {
        avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-image';
        try {
            const withTs = imgUrl + (imgUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
            avatarImg.src = withTs;
        } catch (e) {
            avatarImg.src = imgUrl;
        }
        avatarImg.alt = (user && (user.full_name || user.fullname || user.username)) || 'User';
        avatarImg.onerror = function() { this.onerror = null; this.src = '/static/accounts/images/profile.png'; };
        avatar.appendChild(avatarImg);
    } else {
        const initials = document.createElement('span');
        initials.className = 'avatar-text';
        const fallback = full || uname || emailName || 'U';
        const letters = fallback.toString().trim().split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase();
        initials.textContent = letters || 'U';
        avatar.appendChild(initials);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'user-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'user-name';
    const displayName = full || uname || emailName || 'User';
    nameDiv.textContent = displayName;
    const lastMsg = document.createElement('div');
    lastMsg.className = 'last-message';
    lastMsg.textContent = '';
    info.appendChild(nameDiv);
    info.appendChild(lastMsg);

    // Time
    const time = document.createElement('div');
    time.className = 'message-time';
    if (user && user.last_message_time) {
        time.dataset.timestamp = user.last_message_time;
        time.textContent = formatRelativeTime(user.last_message_time);
    }

    el.appendChild(avatar);
    el.appendChild(info);
    el.appendChild(time);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-user-btn';
    removeBtn.title = 'Remove';
    removeBtn.setAttribute('aria-label', 'Remove conversation');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const uid = el.dataset.userId;
        if (uid) hideChatUser(uid);
    });
    el.appendChild(removeBtn);

    // Click to select user
    el.addEventListener('click', (e) => {
        if (e && e.target && e.target.closest && e.target.closest('.remove-user-btn')) return;
        const id = el.dataset.userId ? parseInt(el.dataset.userId) : null;
        if (id) selectUser(id);
    });

    return el;
}
// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const searchResults = document.getElementById('search-results');
    
    if (searchTerm.length < 2) {
        // If search term is too short, restore original user list
        // First, hide any dynamically created search results
        clearDynamicResults();

        // Show original user items
        Array.from(document.querySelectorAll('#search-results .user-item:not(.search-result-item)')).forEach(item => {
            item.style.display = 'flex';
        });
        // Hide no-results message
        hideNoUsers();
        // Re-show placeholder if it was hidden during search
        const ph = searchResults.querySelector('.no-users');
        if (ph) ph.style.display = '';
        // If there are no items at all, re-show the main empty state
        ensureListEmptyState();
        return;
    }
    
    // If search term is long enough, fetch users from server
    fetch(`/user/search-users/?term=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data.users)) {
                // Hide original user items (all persistent items)
                Array.from(document.querySelectorAll('#search-results .user-item:not(.search-result-item)')).forEach(item => {
                    item.style.display = 'none';
                });
                // Hide the main placeholder while search overlay is active
                const ph = searchResults.querySelector('.no-users');
                if (ph) ph.style.display = 'none';
                // Clear previous dynamic items and no-results
                clearDynamicResults();
                if (data.users.length > 0) {
                    data.users.forEach(user => {
                        const userItem = createUserItem(user);
                        userItem.classList.add('search-result-item');
                        searchResults.appendChild(userItem);
                    });
                    hideNoUsers();
                } else {
                    showNoUsers(searchResults);
                }
            }
        })
        .catch(error => {
            console.error('Error searching users:', error);
        });
}

// Select a user and open chat
function selectUser(userId) {
    // Capture the clicked element before clearing search overlays
    let selectedUserItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    let fromSearch = false;
    if (!selectedUserItem) {
        selectedUserItem = document.querySelector(`#search-results .search-result-item[data-user-id="${userId}"]`);
        fromSearch = !!selectedUserItem;
    }
    selectedUser = userId;
    // Preserve any pre-set meta (e.g., is_admin from contact panel) while resetting basics
    const prevMeta = selectedUserMeta || {};
    selectedUserMeta = {
        id: userId,
        full_name: prevMeta.full_name || '',
        username: prevMeta.username || '',
        profile_picture_url: prevMeta.profile_picture_url || ''
    };
    if (typeof prevMeta.is_admin !== 'undefined') {
        selectedUserMeta.is_admin = prevMeta.is_admin;
    }
    // Load last sent marker for this conversation so 'Sent' appears after reload
    const lastSaved = getLastSentFor(userId);
    lastSentMessageId = lastSaved ? String(lastSaved) : null;

    // Highlight active in the user list
    document.querySelectorAll('.user-item').forEach(item => {
        const id = parseInt(item.dataset.userId);
        item.classList.toggle('active', id === userId);
    });
    // Clear unread highlight for this user upon opening the conversation
    const selectedItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (selectedItem) selectedItem.classList.remove('unread');

    // Update header name and avatar
    if (selectedUserItem) {
        // Compute a robust display name from dataset/text with sensible fallbacks
        const bad = ['none','null','undefined','n/a','na'];
        const normalize = (s) => (s || '').toString().trim();
        const isBad = (s) => { const v = normalize(s); return !v || bad.includes(v.toLowerCase()); };
        const dsFull = normalize(selectedUserItem.getAttribute('data-fullname'));
        const dsUser = normalize(selectedUserItem.getAttribute('data-username'));
        const dsEmail = normalize(selectedUserItem.getAttribute('data-email'));
        const emailName = (!isBad(dsEmail) && dsEmail.includes('@')) ? dsEmail.split('@')[0] : '';
        let userName = (selectedUserItem.querySelector('.user-name') || {}).textContent || '';
        userName = isBad(userName) ? '' : normalize(userName);
        const displayName = (!isBad(dsFull) ? dsFull : '') || (!isBad(dsUser) ? dsUser : '') || userName || emailName || 'User';
        const userAvatarImg = selectedUserItem.querySelector('.avatar-image');
        const userInitials = selectedUserItem.querySelector('.avatar-text');
        const userNameHeader = document.querySelector('#selected-user-name');
        if (userNameHeader) userNameHeader.textContent = displayName;
        selectedUserMeta.full_name = displayName;
        selectedUserMeta.username = (!isBad(dsUser) ? dsUser : (emailName || displayName));

        const userAvatarHeader = document.querySelector('#selected-user-avatar');
        const userAvatarHeaderImg = document.querySelector('#selected-user-avatar-img');
        if (userAvatarImg && userAvatarImg.getAttribute('src')) {
            if (userAvatarHeaderImg) {
                userAvatarHeaderImg.src = userAvatarImg.src;
                userAvatarHeaderImg.style.display = 'block';
            }
            if (userAvatarHeader) userAvatarHeader.style.display = 'none';
            selectedUserMeta.profile_picture_url = userAvatarImg.src;
        } else {
            if (userAvatarHeaderImg) userAvatarHeaderImg.style.display = 'none';
            if (userAvatarHeader && userInitials) {
                userAvatarHeader.textContent = userInitials.textContent;
                userAvatarHeader.style.display = 'block';
            }
        }
    } else {
        // As a last resort, read the header info if present
        const userNameHeader = document.querySelector('#selected-user-name');
        if (userNameHeader) selectedUserMeta.full_name = (userNameHeader.textContent || '').trim();
        const userAvatarHeaderImg = document.querySelector('#selected-user-avatar-img');
        if (userAvatarHeaderImg && userAvatarHeaderImg.style.display !== 'none' && userAvatarHeaderImg.src) {
            selectedUserMeta.profile_picture_url = userAvatarHeaderImg.src;
        }
    }

    // If this came from search, ensure a persistent list item exists before clearing search UI
    try {
        if (fromSearch) {
            const listContainer = document.getElementById('search-results');
            if (listContainer) {
                let persistent = listContainer.querySelector(`.user-item[data-user-id="${userId}"]`);
                if (!persistent) {
                    const dsFull = selectedUserItem ? selectedUserItem.getAttribute('data-fullname') || '' : '';
                    const dsUser = selectedUserItem ? selectedUserItem.getAttribute('data-username') || '' : '';
                    const dsEmail = selectedUserItem ? selectedUserItem.getAttribute('data-email') || '' : '';
                    const imgEl = selectedUserItem ? selectedUserItem.querySelector('.avatar-image') : null;
                    const userObj = {
                        id: userId,
                        full_name: dsFull,
                        username: dsUser,
                        email: dsEmail,
                        profile_picture_url: imgEl && imgEl.getAttribute('src') ? imgEl.getAttribute('src') : ''
                    };
                    try {
                        persistent = createListUserItem(userObj);
                        listContainer.prepend(persistent);
                    } catch (_) {}
                }
            }
        }
    } catch (_) {}

    // If a search is active, clear it so the persistent list is visible
    try {
        if (searchInput && searchInput.value && searchInput.value.length >= 2) {
            searchInput.value = '';
            clearDynamicResults();
            Array.from(document.querySelectorAll('#search-results .user-item:not(.search-result-item)')).forEach(item => {
                item.style.display = 'flex';
            });
            hideNoUsers();
            ensureListEmptyState();
        }
    } catch (e) {}

    // Show chat, hide welcome; on mobile hide user list
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');
    if (isMobile && userList) userList.classList.add('hidden');

  // Stop previous polling, fetch and start polling
  stopPollingMessages();
  fetchMessages(userId);
  startPollingMessages();
  // If switching to a non-admin chat, clear any active contact window and unlock compose
  try {
      if (!(selectedUserMeta && selectedUserMeta.is_admin)) {
          window.activeContactThread = null;
          if (typeof setComposeDisabled === 'function') setComposeDisabled(false);
      }
  } catch (e) {}
    try { window.applyComposeLockIfNeeded(); } catch (e) {}

    // Focus and gently stick to bottom unless user scrolls
    if (messageInput) messageInput.focus();
    [300, 500, 1000, 1500, 2000].forEach(delay => {
        const id = setTimeout(() => {
            if (!userAnchored && isNearBottom()) scrollToBottom(false);
        }, delay);
        initStickTimers.push(id);
    });
}

// Deselect user and go back to list
function deselectUser() {
    selectedUser = null;
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (chatMessages) chatMessages.classList.add('hidden');
    stopPollingMessages();
    if (isMobile && userList) userList.classList.remove('hidden');
}

// --- Recent chats polling: update unread counts and previews ---
function startPollingUserList(intervalMs = 5000) {
    if (userListPollTimer) {
        clearInterval(userListPollTimer);
        userListPollTimer = null;
    }
    userListPollTimer = setInterval(refreshUserList, intervalMs);
    // Initial tick
    setTimeout(refreshUserList, 300);
}

function stopPollingUserList() {
    if (userListPollTimer) {
        clearInterval(userListPollTimer);
        userListPollTimer = null;
    }
}

function refreshUserList(force = false) {
    // Skip if search overlay is active unless forced
    if (!force && searchInput && searchInput.value && searchInput.value.length >= 2) return;
    fetch('/user/communication/recent-chats/', {
        method: 'GET',
        headers: { 'X-CSRFToken': csrfToken }
    })
    .then(r => r.json())
    .then(data => {
        const list = (data && (data.users || data)) || [];
        if (!Array.isArray(list)) return;
        applyRecentChats(list);
    })
    .catch(() => {});
}

function applyRecentChats(chats) {
    const container = document.getElementById('search-results');
    if (!container) return;
    const bad = ['none','null','undefined','n/a','na'];
    const normalize = (s) => (s || '').toString().trim();
    const pickToken = (s) => {
        const toks = normalize(s).split(/\s+/).filter(Boolean);
        for (const t of toks) { if (!bad.includes(t.toLowerCase())) return t; }
        if (toks.length) {
            const last = toks[toks.length - 1];
            if (!bad.includes(last.toLowerCase())) return last;
        }
        return '';
    };
    const truncate = (s, n = 30) => {
        const str = (s || '').toString();
        return str.length > n ? (str.slice(0, n - 1) + '…') : str;
    };

    let totalUnread = 0;
    chats.forEach(chat => {
        const id = chat.id || chat.user_id;
        const unread = parseInt(chat.unread_count || 0, 10) || 0;
        totalUnread += unread;
        if (id && hiddenChatUserIds.has(String(id))) {
            return; // keep hidden until user sends a new message (we unhide on send)
        }
        let el = container.querySelector(`.user-item[data-user-id="${id}"]`);
        if (!el) {
            // Create a new persistent list item for this chat
            el = createListUserItem(chat);
            if (chat && chat.last_message_time) {
                el.dataset.lastMessageTime = chat.last_message_time;
            }
        }

        el.classList.toggle('unread', unread > 0);

        const lastEl = el.querySelector('.last-message');
        if (lastEl) {
            if (unread >= 2) {
                const label = unread > 9 ? '9+ new message' : `${unread} new message`;
                lastEl.textContent = label;
            } else {
                const isOwn = !!chat.last_message_is_own;
                const raw = (chat.last_message || '').toString();
                const lower = raw.toLowerCase();
                const isSystemDeleted = lower.startsWith('you deleted a message') || lower.startsWith('message deleted');
                let prefix = '';
                if (isOwn && !isSystemDeleted) {
                    prefix = 'You: ';
                } else if (!isOwn && !isSystemDeleted) {
                    const name = pickToken(chat.first_name) || pickToken(chat.last_name) || pickToken(chat.full_name) || pickToken(chat.username) || '';
                    prefix = name ? `${name}: ` : '';
                }
                lastEl.textContent = `${prefix}${truncate(raw)}`;
            }
        }
        // Update time with friendly label and persist timestamp
        const timeEl = el.querySelector('.message-time');
        if (timeEl && chat.last_message_time) {
            timeEl.dataset.timestamp = chat.last_message_time;
            timeEl.textContent = formatRelativeTime(chat.last_message_time);
            el.dataset.lastMessageTime = chat.last_message_time;
        }
        // Reorder by recency: append in server-provided order
        container.appendChild(el);
    });
    // Toggle empty-state depending on whether any persistent users remain
    ensureListEmptyState();
    // Sidebar badge is now updated by dashboard unread_messages.js (aggregate: chats + contact requests)
}

// Fetch messages from server for a given user
function fetchMessages(userId, options = {}) {
    const { silent = false } = options;
    if (!userId) return;

    if (!silent && messagesList) {
        messagesList.innerHTML = '<div class="loading-messages">Loading messages...</div>';
    }

    fetch(`/user/communication/messages/?user_id=${userId}`, {
        method: 'GET',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
      .then(data => {
          if (!Array.isArray(data)) return;
        // Apply local deletions to server payload to avoid flicker/races
        try {
            data.forEach(m => {
                const mid = String((m && (m.id || m.message_id)) || '');
                if (mid && locallyDeletedIds.has(mid)) m.is_deleted = true;
            });
        } catch (e) {}
          lastFetchedMessages = data;
        // Ensure 'Sent' status persists: prefer saved marker; otherwise infer from latest own message
        const savedSent = getLastSentFor(userId);
        if (savedSent) {
            lastSentMessageId = String(savedSent);
        } else {
            try {
        const own = data.filter(m => m && m.is_own && !m.is_deleted);
                if (own && own.length) {
                    const latestOwn = own.reduce((acc, m) => {
                        return (!acc || new Date(m.sent_at) > new Date(acc.sent_at)) ? m : acc;
                    }, null);
                    if (latestOwn && (latestOwn.id || latestOwn.message_id)) {
                        lastSentMessageId = String(latestOwn.id || latestOwn.message_id);
                    }
                }
            } catch (e) {}
        }
        const near = isNearBottom();
        if (scrollToBottomBtn) scrollToBottomBtn.classList.toggle('visible', !near);
        // Do not disrupt active edits or open menus; defer update
        if (isEditing || isOptionsMenuOpen) {
            pendingMessagesCount = Math.max(pendingMessagesCount, 1);
            return;
        }
        // If user has scrolled up, update in place while preserving scroll anchor
        if (userAnchored) {
            // Update in-memory and render with anchor preservation
            messages = data;
            renderMessages();
            return;
        }
        // Use incremental diff to avoid heavy re-renders
          // Optionally filter messages for a specific contact request window (admin chat only)
          messages = filterForActiveContactWindow(data);
          if (!messagesList || !messagesList.querySelector('.message-item')) {
            // First render or empty: do a full render once
            renderMessages();
        } else {
              applyMessagesDiff(messages);
          }
        // If this conversation is open, mark incoming messages as read and normalize user list preview
        if (String(selectedUser) === String(userId)) {
            markConversationRead(userId, data);
            const latest = [...data].sort((a,b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
            if (latest) {
                // Determine a preview honoring deletions and image placeholders
                const mid = String(latest.id || latest.message_id || '');
                const isLocallyDeleted = mid && locallyDeletedIds.has(mid);
                let text = (latest.message || latest.content || '').toString();
                let isOwnFlag = !!latest.is_own;
                try {
                    if (latest.is_deleted || isLocallyDeleted) {
                        text = isOwnFlag ? 'You deleted a message' : 'Message deleted';
                        isOwnFlag = false; // avoid any prefixing
                    } else if (typeof text === 'string') {
                        if (text.startsWith('[img]')) text = 'Sent a photo';
                        else if (text.startsWith('[imgs]')) text = 'Sent photos';
                    }
                } catch (e) {}
                // Name only used for non-own, non-system labels
                let name = null;
                if (!isOwnFlag) {
                    let sname = (latest.sender_name || '').toString().trim();
                    const bad = ['none','null','undefined','n/a','na'];
                    if (!sname || bad.includes(sname.toLowerCase())) {
                        sname = '';
                    }
                    if (sname) {
                        const tokens = sname.split(/\s+/).filter(Boolean);
                        // Prefer first name; if invalid or short, try last name
                        name = tokens.length ? tokens[0] : null;
                        if (!name || bad.includes(name.toLowerCase())) {
                            name = tokens.length ? tokens[tokens.length - 1] : null;
                        }
                    }
                }
                updateLastMessage(userId, text, isOwnFlag, false, false, name);
                // Also refresh the time using latest.sent_at
                const selectedItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
                if (selectedItem) {
                    const timeEl = selectedItem.querySelector('.message-time');
                    const iso = latest.sent_at;
                    if (timeEl && iso) {
                        timeEl.dataset.timestamp = iso;
                        selectedItem.dataset.lastMessageTime = iso;
                        timeEl.textContent = formatRelativeTime(iso);
                    }
                }
            }
            // Ensure unread styling is removed for this user
            const selectedItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
            if (selectedItem) selectedItem.classList.remove('unread');
        }
      })
    .catch(error => {
        console.error('Error fetching messages:', error);
        if (!silent && messagesList) {
            messagesList.innerHTML = `
                <div class="error-container">
                    <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="error-text">Failed to load messages</div>
                </div>
            `;
        }
    });
}

// Keep only messages within the active contact request time window when chatting with admin
function filterForActiveContactWindow(list) {
    try {
        if (!(selectedUserMeta && selectedUserMeta.is_admin)) return list;
        const t = window.activeContactThread;
        if (!t || !t.created_at) return list;
        const start = new Date(t.created_at).getTime();
        const end = t.end_at ? new Date(t.end_at).getTime() : null;
        const filtered = (list || []).filter(m => {
            try {
                const ts = new Date(m.sent_at).getTime();
                if (isNaN(ts)) return false;
                if (ts < start) return false;
                if (end && ts >= end) return false;
                return true;
            } catch (e) { return false; }
        });
        return filtered;
    } catch (e) { return list; }
}

// Incrementally apply new messages to the DOM (append/update only what changed)
function applyMessagesDiff(newData) {
    if (!messagesList || !Array.isArray(newData)) return;
    // Build index of existing nodes
    const existing = new Map();
    messagesList.querySelectorAll('.message-item').forEach(node => {
        const id = node && node.dataset && node.dataset.messageId;
        if (id) existing.set(String(id), node);
    });
    // Append/update in chronological order
    const sorted = [...newData].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
    const frag = document.createDocumentFragment();
    let appended = 0;
    const keepIds = new Set();
    sorted.forEach(m => {
        const mid = String(m.id || m.message_id || '');
        if (!mid) return;
        // If server marks message deleted, render the deleted placeholder
        if (m.is_deleted || locallyDeletedIds.has(mid)) {
            const h = hashMessage(m);
            const node = existing.get(mid);
            const el = buildMessageItem(m);
            el.dataset.hash = h;
            if (node) {
                const wasAtBottom = isNearBottom();
                node.replaceWith(el);
                if (wasAtBottom) scrollToBottom(false);
                existing.delete(mid);
            } else {
                frag.appendChild(el);
                appended++;
            }
            return;
        }
        keepIds.add(mid);
        const h = hashMessage(m);
        const node = existing.get(mid);
        if (!node) {
            // New message: build and append
            const el = buildMessageItem(m);
            el.dataset.hash = h;
            frag.appendChild(el);
            appended++;
        } else {
            // Possible update
            if (node.dataset.hash !== h) {
                const wasAtBottom = isNearBottom();
                const el = buildMessageItem(m);
                el.dataset.hash = h;
                node.replaceWith(el);
                if (wasAtBottom) {
                    scrollToBottom(false);
                }
            }
            // Mark as processed; leftover nodes will be removed
            existing.delete(mid);
        }
    });
    if (appended) {
        messagesList.appendChild(frag);
        scrollToBottom(false);
    }
    // Remove any leftover nodes that are no longer present in server data,
    // but keep optimistic temp messages until the server echoes them back.
    if (existing.size) {
        for (const [, node] of existing) {
            try {
                const idAttr = (node && node.dataset && node.dataset.messageId) ? String(node.dataset.messageId) : '';
                if (idAttr.startsWith('temp-')) continue;
                node.remove();
            } catch (e) {
                if (node && node.parentNode) try { node.parentNode.removeChild(node); } catch (_) {}
            }
        }
    }
}

// Start editing a message
function startEditingMessage(messageItem, messageId) {
    if (!messageItem || !messageId) return;
    // Do not allow editing temporary messages
    if (String(messageId).startsWith('temp-')) return;

    const content = messageItem.querySelector('.message-content');
    if (!content) return;
    // Save original content markup to restore on cancel
    try { messageItem.__origContentHTML = content.innerHTML; } catch (e) { messageItem.__origContentHTML = null; }
    const p = content.querySelector('p');
    const originalText = p ? p.textContent : '';

    // Mark editing state
    isEditing = true;
    editingMessageId = messageId;
    // Add editing class to tweak visuals and hide overlays
    messageItem.classList.add('editing');
    const actionsBar = messageItem.querySelector('.message-actions');
    if (actionsBar) actionsBar.style.display = 'none';
    // Hide any existing edited indicator while editing
    const existingBadge = content.querySelector('.edited-indicator');
    if (existingBadge) existingBadge.style.display = 'none';
    // Lock current visual width so bubble doesn't shrink while editing
    try {
        const rect = content.getBoundingClientRect();
        if (rect && rect.width) {
            content.style.minWidth = Math.ceil(rect.width) + 'px';
        }
    } catch (e) {}


    // Build edit UI
    const editWrap = document.createElement('div');
    editWrap.className = 'edit-message-container';
    editWrap.innerHTML = `
        <textarea class="edit-message-input" rows="3">${originalText}</textarea>
        <div class="edit-message-actions">
            <button class="edit-message-btn save-edit-btn">Save</button>
            <button class="edit-message-btn cancel-edit-btn">Cancel</button>
        </div>
    `;
    content.innerHTML = '';
    content.appendChild(editWrap);

    const textarea = editWrap.querySelector('.edit-message-input');
    const saveBtn = editWrap.querySelector('.save-edit-btn');
    const cancelBtn = editWrap.querySelector('.cancel-edit-btn');
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveMessageEdit(messageItem, messageId, textarea.value.trim(), originalText);
            } else if (e.key === 'Escape') {
                cancelMessageEdit(messageItem, originalText);
            }
        });
        // Auto-grow textarea to fit content
        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        };
        textarea.addEventListener('input', autoResize);
        autoResize();
    }
    if (saveBtn) saveBtn.addEventListener('click', () => {
        saveMessageEdit(messageItem, messageId, textarea ? textarea.value.trim() : '', originalText);
    });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        cancelMessageEdit(messageItem, originalText);
    });
}

// Save edited message
function saveMessageEdit(messageItem, messageId, newText, originalText) {
    if (!newText || newText === originalText) {
        cancelMessageEdit(messageItem, originalText);
        return;
    }
    fetch('/user/communication/edit-message/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message_id: messageId, new_content: newText })
    })
    .then(r => r.json())
    .then(data => {
        if (data && data.success) {
            const content = messageItem.querySelector('.message-content');
            if (content) {
                content.innerHTML = `<p>${newText}</p>`;
                // Unfreeze bubble width back to auto sizing
                content.style.minWidth = '';
                // Ensure edited indicator is present in bubble and spacing class on item
                const bubble = content;
                if (!bubble.querySelector('.edited-indicator')) {
                    const badge = document.createElement('div');
                    badge.className = 'edited-indicator';
                    badge.textContent = 'edited';
                    bubble.appendChild(badge);
                }
                messageItem.classList.add('has-edited');
            }
            // Clear stored original markup
            try { messageItem.__origContentHTML = null; } catch (e) {}
            // Update in memory list if present
            const msg = messages.find(m => m.id === messageId);
            if (msg) {
                msg.message = newText;
                msg.is_edited = true;
            }
            isEditing = false;
            editingMessageId = null;
            // Restore actions and visuals
            messageItem.classList.remove('editing');
            const actionsBar = messageItem.querySelector('.message-actions');
            if (actionsBar) actionsBar.style.display = '';
        } else {
            console.error('Edit failed:', data && data.error);
            cancelMessageEdit(messageItem, originalText);
        }
    })
    .catch(err => {
        console.error('Error editing message:', err);
        cancelMessageEdit(messageItem, originalText);
    });
}

// Cancel message edit
function cancelMessageEdit(messageItem, originalText) {
    const messageContent = messageItem.querySelector('.message-content');
    const message = messages.find(m => m.id === messageItem.dataset.messageId);
    
    if (messageItem.__origContentHTML) {
        messageContent.innerHTML = messageItem.__origContentHTML;
    } else {
        messageContent.innerHTML = `
         ${message && message.is_edited ? '<div class="edited-indicator">edited</div>' : ''}
        <p>${originalText}</p>
    `;
    }
    // Unfreeze bubble width back to auto sizing
    if (messageContent && messageContent.style) {
        messageContent.style.minWidth = '';
    }
    
    // Leave editing state
    isEditing = false;
    editingMessageId = null;
    // Restore actions and visuals
    messageItem.classList.remove('editing');
    const actionsBar = messageItem.querySelector('.message-actions');
    if (actionsBar) actionsBar.style.display = '';
    // Re-show edited indicator if present
    const badge = messageContent.querySelector('.edited-indicator');
    if (badge) badge.style.display = '';
    // Clear stored original markup
    try { messageItem.__origContentHTML = null; } catch (e) {}
    }

// Delete message
function deleteMessage(messageItem, messageId) {
    // Don't allow deleting temporary messages
    if (messageId.toString().startsWith('temp-')) {
        return;
    }
    
    // Create custom alert for deletion confirmation
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'custom-alert-overlay';
    alertOverlay.innerHTML = `
        <div class="custom-alert">
            <div class="custom-alert-header">
                <h3>Delete Message</h3>
            </div>
            <div class="custom-alert-body">
                <p>Are you sure you want to delete this message?</p>
            </div>
            <div class="custom-alert-footer">
                <button class="custom-alert-btn cancel-btn">Cancel</button>
                <button class="custom-alert-btn confirm-btn">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(alertOverlay);
    
    // Add event listeners for buttons
    const cancelBtn = alertOverlay.querySelector('.cancel-btn');
    const confirmBtn = alertOverlay.querySelector('.confirm-btn');
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(alertOverlay);
    });
    
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(alertOverlay);
        // Optimistically show deleted placeholder immediately (replace entire node to avoid stale markup)
        const prevHTML = messageItem.innerHTML;
        const prevClasses = messageItem.className;
        const originalNode = messageItem;
        // Remove any status label immediately
        try { const status = originalNode.querySelector('.message-status'); if (status) status.remove(); } catch (e) {}
        const wasSent = originalNode.classList.contains('sent');
        let placeholderNode = null;
        try {
            placeholderNode = buildMessageItem({ id: messageId, message_id: messageId, is_deleted: true, is_own: wasSent, sent_at: new Date().toISOString(), message: '' });
        } catch (e) {
            // Fallback: mutate existing node
            originalNode.classList.remove('sent', 'received', 'has-edited');
            originalNode.innerHTML = `<div style="display:flex;justify-content:${wasSent ? 'flex-end' : 'flex-start'};width:100%;">
                <p class="deleted-message">This message has been deleted</p>
            </div>`;
        }
        if (placeholderNode) {
            try { originalNode.replaceWith(placeholderNode); } catch (e) { placeholderNode = null; }
        }
        // Mark locally-deleted to survive upcoming polls/renders until server confirms
        try { locallyDeletedIds.add(String(messageId)); } catch (e) {}
        // Update in-memory state and list preview right away
        try {
            const idx = messages.findIndex(mm => String(mm.id || mm.message_id) === String(messageId));
            const deleted = idx !== -1 ? messages[idx] : null;
            if (idx !== -1) messages[idx].is_deleted = true;
            const remaining = messages.filter(mm => !mm.is_deleted);
            const latest = remaining.sort((a,b)=> new Date(b.sent_at) - new Date(a.sent_at))[0];
            if (selectedUser) {
                // If the deleted message was the newest one, show a clear deleted label.
                const deletedWasLatest = !!(deleted && (!latest || new Date(deleted.sent_at) >= new Date(latest.sent_at)));
                if (deletedWasLatest) {
                    const label = deleted && deleted.is_own ? 'You deleted a message' : 'Message deleted';
                    // Pass isOwn=false so we don't prepend "You: " to our override label
                    updateLastMessage(selectedUser, label, false, true, true);
                } else {
                    const txt = latest ? (latest.message || latest.content || (latest.image_urls ? 'Sent photos' : (latest.image_url ? 'Sent a photo' : ''))) : '';
                    updateLastMessage(selectedUser, txt, !!(latest && latest.is_own));
                }
            }
            // Force a minimal diff render so image/gallery messages update instantly
            try { applyMessagesDiff(messages); } catch (e) {}
        } catch (e) {}
        // Proactively sync with server immediately (in addition to poll)
        try { if (selectedUser) fetchMessages(selectedUser, { silent: true }); } catch (e) {}
        // Send delete request to server
        fetch('/user/communication/delete-message/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message_id: messageId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data && data.success) {
                // If this was the last 'Sent' message, clear the marker so it won't reapply
                if (lastSentMessageId && String(lastSentMessageId) === String(messageId)) {
                    clearLastSentFor(selectedUser);
                }
                // Refresh list/messages silently to sync with server
                try { refreshUserList(true); } catch (e) {}
                try { if (selectedUser) fetchMessages(selectedUser, { silent: true }); } catch (e) {}
            } else {
                console.error('Failed to delete message:', data && data.error);
                // Revert optimistic change
                if (placeholderNode && placeholderNode.parentNode) {
                    try { placeholderNode.replaceWith(originalNode); } catch (e) {}
                }
                originalNode.className = prevClasses;
                originalNode.innerHTML = prevHTML;
                try { locallyDeletedIds.delete(String(messageId)); } catch (e) {}
                try {
                    const idx = messages.findIndex(mm => String(mm.id || mm.message_id) === String(messageId));
                    if (idx !== -1) messages[idx].is_deleted = false;
                } catch (e) {}
                alert('Failed to delete message. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error fetching messages:', error);
            // Revert optimistic change
            if (placeholderNode && placeholderNode.parentNode) {
                try { placeholderNode.replaceWith(originalNode); } catch (e) {}
            }
            originalNode.className = prevClasses;
            originalNode.innerHTML = prevHTML;
            try { locallyDeletedIds.delete(String(messageId)); } catch (e) {}
            try {
                const idx = messages.findIndex(mm => String(mm.id || mm.message_id) === String(messageId));
                if (idx !== -1) messages[idx].is_deleted = false;
            } catch (e) {}
            alert('Failed to delete message. Please try again.');
        });
    });
}

// Start polling for new messages for the selected user
function startPollingMessages(intervalMs = 2000) {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (!selectedUser) return;
    pollTimer = setInterval(() => {
        // Do a silent refresh to avoid flicker
        fetchMessages(selectedUser, { silent: true });
    }, intervalMs);
}

// Stop polling
function stopPollingMessages() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

// Function to append a single new message to the DOM without re-rendering everything
function appendNewMessage(message) {
    if (!messagesList) return;
    if (!Array.isArray(messages)) messages = [];
    
    // Initialize messages list if it's empty
    if (messages.length === 1) { // This is the first message
        messagesList.innerHTML = ''; // Clear the "No messages yet" display
    }
    
    const currentMessageDate = new Date(message.sent_at);
    
    // Check if we need to add a timestamp divider
    let needsTimestampDivider = false;
    
    if (messages.length === 1) { // This is the first message
        needsTimestampDivider = true;
    } else {
        // Find the previous message's date
        const otherMessages = messages.filter(m => m !== message);
        const sortedMessages = [...otherMessages].sort((a, b) => {
            return new Date(b.sent_at) - new Date(a.sent_at); // Newest first
        });
        
        if (sortedMessages.length > 0) {
            const lastMessageDate = new Date(sortedMessages[0].sent_at);
            // Check if there's a 10+ minute gap
            needsTimestampDivider = Math.abs(currentMessageDate - lastMessageDate) >= 10 * 60 * 1000;
        }
    }
    
    // Add timestamp divider if needed
    if (needsTimestampDivider) {
        // Format the date and time for the divider
        const options = { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        const formattedDateTime = currentMessageDate.toLocaleDateString(undefined, options);
        
        // Create and append the timestamp divider
        const timestampDivider = document.createElement('div');
        timestampDivider.className = 'timestamp-divider';
        timestampDivider.innerHTML = `<span>${formattedDateTime}</span>`;
        messagesList.appendChild(timestampDivider);
    }
    
    // Build and append
    const messageItem = buildMessageItem(message);
    messagesList.appendChild(messageItem);
}

// Unified message DOM builder using the new scoped design
function buildMessageItem(message) {
    const item = document.createElement('div');
    item.classList.add('message-item');
    item.classList.add('vl-msg');
    item.classList.add(message.is_own ? 'sent' : 'received');
    item.dataset.messageId = message.id || message.message_id || 'temp-' + Date.now();

    if (message.is_deleted) {
        item.classList.remove('sent', 'received');
        item.innerHTML = `
            <div style="display:flex;justify-content:${message.is_own ? 'flex-end' : 'flex-start'};width:100%;">
                <p class="deleted-message">This message has been deleted</p>
            </div>
        `;
        return item;
    }

    let actionsHtml = '';

    const text = message.message || message.content || '';
    const imgUrl = message.image_url || null;
    const editedChip = message.is_edited ? '<div class="edited-indicator">edited</div>' : '';
    const imgUrls = Array.isArray(message.image_urls) ? message.image_urls : null;
    if (message.is_own) {
        const hasImages = !!(imgUrl || (imgUrls && imgUrls.length));
        if (hasImages) {
            actionsHtml = `
          <div class=\"message-options-container\">
            <div class=\"message-actions\">
              <button class=\"message-action-btn more-options-btn\" title=\"More options\">\n                <i class=\"fas fa-ellipsis-v\"></i>\n              </button>
              <div class=\"message-options-menu hidden\">\n                <button class=\"message-option delete-btn\" title=\"Delete\"><i class=\"fas fa-trash\"></i></button>
              </div>
            </div>
          </div>`;
        } else {
            actionsHtml = `
          <div class=\"message-options-container\">
            <div class=\"message-actions\">
              <button class=\"message-action-btn more-options-btn\" title=\"More options\">\n                <i class=\"fas fa-ellipsis-v\"></i>\n              </button>
              <div class=\"message-options-menu hidden\">\n                <button class=\"message-option delete-btn\" title=\"Delete\"><i class=\"fas fa-trash\"></i></button>\n                <button class=\"message-option edit-btn\" title=\"Edit\"><i class=\"fas fa-edit\"></i></button>
              </div>
            </div>
          </div>`;
        }
    }
    if (imgUrls && imgUrls.length) {
        const shown = imgUrls.slice(0, 3);
        const extra = imgUrls.length - shown.length;
        let tiles = '';
        shown.forEach((u, idx) => {
            const overlay = (idx === shown.length - 1 && extra > 0) ? `<div class="gallery-overlay" title="View all photos">+${extra}</div>` : '';
            tiles += `
                <div class="gallery-item">
                    <a href="${u}" class="message-image-link"><img src="${u}" class="message-image"/></a>
                    ${overlay}
                </div>`;
        });
        item.innerHTML = `
            ${actionsHtml}
            <div class="message-content vl-bubble">
                ${editedChip}
                <div class="message-gallery">${tiles}</div>
            </div>
        `;
        try { item.dataset.imageUrls = JSON.stringify(imgUrls); } catch (e) {}
    } else if (imgUrl) {
        item.innerHTML = `
            ${actionsHtml}
            <div class="message-content vl-bubble">
                ${editedChip}
                <a href="${imgUrl}" class="message-image-link">
                    <img src="${imgUrl}" alt="Image" class="message-image"/>
                </a>
            </div>
        `;
    } else {
        item.innerHTML = `
            ${actionsHtml}
            <div class="message-content vl-bubble">
                ${editedChip}
                <p>${text}</p>
            </div>
        `;
    }

    if (message.is_edited) item.classList.add('has-edited');
    return item;
}

// Upload and send an image message
function sendImageMessage(file) {
    if (!file) return;
    if (!selectedUser) {
        alert('Please select a conversation before sending an image.');
        return;
    }
    // Basic client-side checks
    try {
        const maxBytes = 10 * 1024 * 1024; // 10 MB
        if (file.size && file.size > maxBytes) {
            alert('Image is too large (max 10 MB).');
            return;
        }
        if (file.type && !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
    } catch (e) {}
    // Optimistic preview + compression
    const previewUrl = URL.createObjectURL(file);
    const tempMsg = { id: 'temp-' + Date.now(), is_own: true, sent_at: new Date().toISOString(), image_url: previewUrl };
    appendNewMessage(tempMsg);
    scrollToBottom(true);
    // Attach progress overlay
    let tempNode = Array.from((messagesList || document).querySelectorAll('.message-item')).pop();
    let prog = null;
    try { prog = attachUploadOverlay(tempNode, { text: 'Preparing image...…' }); } catch (e) {}
    // Optimistically ensure the user appears in the list immediately and update preview
    (function ensureUserVisibleNow() {
        const container = document.getElementById('search-results');
        if (!container || !selectedUser) return;
        // Skip injecting support/admin chats into the left list
        try { if (selectedUserMeta && selectedUserMeta.is_admin) return; } catch (e) {}
        let el = container.querySelector(`.user-item[data-user-id="${selectedUser}"]`);
        if (!el) {
            const u = {
                id: selectedUser,
                username: selectedUserMeta.username || '',
                full_name: selectedUserMeta.full_name || '',
                profile_picture_url: selectedUserMeta.profile_picture_url || ''
            };
            try { el = createListUserItem(u); container.prepend(el); } catch (e) {}
        }
        if (!(selectedUserMeta && selectedUserMeta.is_admin)) {
            updateLastMessage(selectedUser, 'Sent a photo', true, true, true);
            unhideChatUser(selectedUser);
        }
        ensureListEmptyState();
    })();
    // Compress before upload to speed things up
    const toUploadPromise = compressImage(file).catch(() => file);
    const formData = new FormData();
    formData.append('receiver', String(selectedUser));
    toUploadPromise.then((compressed) => {
        formData.append('image', compressed || file);
        return uploadWithProgress('/user/communication/send-image/', formData, (ev) => {
            if (prog) {
                if (ev && ev.lengthComputable && ev.total > 0) {
                    const pct = Math.max(0, Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
                    prog.update(pct);
                } else {
                    prog.indeterminate();
                }
            }
        });
    })
    .then((data) => {
        if (!data || data.error) {
            const msg = (data && data.error) ? data.error : 'Failed to upload image.';
            alert(msg);
            if (prog) prog.fail(msg);
            return;
        }
        if (data && data.id) {
            // Replace last temp image with real one
            tempNode = Array.from(messagesList.querySelectorAll('.message-item'))
                .reverse().find(n => (n.dataset.messageId || '').startsWith('temp-'));
            if (tempNode) {
                tempNode.dataset.messageId = data.id;
                tempNode.classList.add('sent');
                tempNode.innerHTML = `
                    <div class="message-options-container">
                      <div class="message-actions">
                        <button class="message-action-btn more-options-btn" title="More options">
                          <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="message-options-menu hidden">
                          <button class="message-option delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                      </div>
                    </div>
                    <div class="message-content vl-bubble">
                      <a href="${data.image_url}" class="message-image-link">
                        <img src="${data.image_url}" alt="Image" class="message-image"/>
                      </a>
                    </div>`;
            } else {
                const msgObj = { id: data.id, is_own: true, sent_at: data.sent_at, message: data.message, image_url: data.image_url };
                appendNewMessage(msgObj);
            }
            if (prog) prog.done();
            updateLastMessage(selectedUser, 'Sent a photo', true);
            scrollToBottom(true);
            fetchMessages(selectedUser, { silent: true });
            try { refreshUserList(true); } catch (e) {}
            try { ensureListEmptyState(); } catch (e) {}
        }
    })
    .catch((e) => { console.error('Image upload error', e); alert('Failed to upload image.'); });
}

// Send multiple images (up to 10) as a single gallery message
function sendImagesMessage(files) {
    const list = Array.from(files || []).filter(Boolean).slice(0, 10);
    if (!list.length) return;
    if (!selectedUser) { alert('Please select a conversation before sending images.'); return; }
    // Optimistic gallery preview
    const tempUrls = list.slice(0, 3).map(f => URL.createObjectURL(f));
    const tempMsg = { id: 'temp-' + Date.now(), is_own: true, sent_at: new Date().toISOString(), image_urls: tempUrls };
    appendNewMessage(tempMsg);
    scrollToBottom(true);
    // Optimistically ensure the user appears in the list immediately and update preview
    (function ensureUserVisibleNow() {
        const container = document.getElementById('search-results');
        if (!container || !selectedUser) return;
        try { if (selectedUserMeta && selectedUserMeta.is_admin) return; } catch (e) {}
        let el = container.querySelector(`.user-item[data-user-id="${selectedUser}"]`);
        if (!el) {
            const u = {
                id: selectedUser,
                username: selectedUserMeta.username || '',
                full_name: selectedUserMeta.full_name || '',
                profile_picture_url: selectedUserMeta.profile_picture_url || ''
            };
            try { el = createListUserItem(u); container.prepend(el); } catch (e) {}
        }
        if (!(selectedUserMeta && selectedUserMeta.is_admin)) {
            updateLastMessage(selectedUser, 'Sent photos', true, true, true);
            unhideChatUser(selectedUser);
        }
        ensureListEmptyState();
    })();
    const formData = new FormData();
    formData.append('receiver', String(selectedUser));
    // Progress overlay for batch upload
    let batchTemp = Array.from((messagesList || document).querySelectorAll('.message-item')).pop();
    let batchProg = null;
    try { batchProg = attachUploadOverlay(batchTemp, { text: 'Preparing ' + list.length + ' images...' }); } catch (e) {}
    // Compress sequentially with small concurrency (2)
    const compressAll = async () => {
        const out = [];
        for (let i = 0; i < list.length; i++) {
            try { out.push(await compressImage(list[i])); } catch (e) { out.push(list[i]); }
        }
        return out;
    };
    compressAll().then((filesToSend) => {
        filesToSend.forEach(f => formData.append('images', f));
        return uploadWithProgress('/user/communication/send-image/', formData, (ev) => {
            if (batchProg) {
                if (ev && ev.lengthComputable && ev.total > 0) {
                    const pct = Math.max(0, Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
                    batchProg.update(pct);
                } else {
                    batchProg.indeterminate();
                }
            }
        });
    }).then(data => {
        if (data && data.id && Array.isArray(data.image_urls) && data.image_urls.length) {
            const tempNode = Array.from(messagesList.querySelectorAll('.message-item'))
                .reverse().find(n => (n.dataset.messageId || '').startsWith('temp-'));
            if (tempNode) {
                tempNode.dataset.messageId = data.id;
                tempNode.classList.add('sent');
                const shown = data.image_urls.slice(0, 3);
                const extra = data.image_urls.length - shown.length;
                let tiles = '';
                shown.forEach((u, idx) => {
                    const overlay = (idx === shown.length - 1 && extra > 0) ? `<div class="gallery-overlay" title="View all photos">+${extra}</div>` : '';
                    tiles += `
                        <div class="gallery-item">
                            <a href="${u}" class="message-image-link"><img src="${u}" class="message-image"/></a>
                            ${overlay}
                        </div>`;
                });
                tempNode.innerHTML = `
                    <div class="message-options-container">
                      <div class="message-actions">
                        <button class="message-action-btn more-options-btn" title="More options"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="message-options-menu hidden"><button class="message-option delete-btn" title="Delete"><i class="fas fa-trash"></i></button></div>
                      </div>
                    </div>
                    <div class="message-content vl-bubble"><div class="message-gallery">${tiles}</div></div>`;
                try { tempNode.dataset.imageUrls = JSON.stringify(data.image_urls); } catch (e) {}
            } else {
                const msgObj = { id: data.id, is_own: true, sent_at: data.sent_at, message: data.message, image_urls: data.image_urls };
                appendNewMessage(msgObj);
            }
            if (batchProg) batchProg.done();
            updateLastMessage(selectedUser, 'Sent photos', true);
            scrollToBottom(true);
            fetchMessages(selectedUser, { silent: true });
            try { refreshUserList(true); } catch (e) {}
            try { ensureListEmptyState(); } catch (e) {}
        } else if (data && data.image_url) {
            // Fallback for single
            const msgObj = { id: data.id, is_own: true, sent_at: data.sent_at, message: data.message, image_url: data.image_url };
            appendNewMessage(msgObj);
            updateLastMessage(selectedUser, 'Sent photos', true);
            scrollToBottom(true);
            fetchMessages(selectedUser, { silent: true });
            try { refreshUserList(true); } catch (e) {}
            try { ensureListEmptyState(); } catch (e) {}
        } else if (data && data.error) {
            alert(data.error);
            if (batchProg) batchProg.fail(data.error);
        }
    }).catch((e) => { console.error('Images upload error', e); alert('Failed to upload images.'); });
}


// --- Upload helpers: XHR + overlay UI ---
function uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            try { xhr.setRequestHeader('X-CSRFToken', csrfToken); } catch (e) {}
            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300) resolve(data); else resolve(data);
                } catch (e) {
                    if (xhr.status >= 200 && xhr.status < 300) resolve({}); else reject(e);
                }
            };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.upload.onprogress = (ev) => { try { onProgress && onProgress(ev); } catch (e) {} };
            xhr.send(formData);
        } catch (e) { reject(e); }
    });
}

function attachUploadOverlay(messageItem, opts = {}) {
    if (!messageItem) return null;
    const bubble = messageItem.querySelector('.message-content');
    if (!bubble) return null;
    const overlay = document.createElement('div');
    overlay.className = 'upload-overlay';
    overlay.innerHTML = `
      <div class="upload-text">${(opts.text || 'Uploading...')}</div>
      <div class="progress-outer"><div class="progress-inner"></div></div>
      <div class="upload-eta"></div>
    `;
    bubble.appendChild(overlay);
    const bar = overlay.querySelector('.progress-inner');
    const eta = overlay.querySelector('.upload-eta');
    let startTs = Date.now();
    let lastPct = 0;
    return {
        update(pct) {
            lastPct = pct;
            if (bar) bar.style.width = pct + '%';
            if (eta) {
                try {
                    const elapsed = (Date.now() - startTs) / 1000;
                    if (pct > 0 && pct < 100) {
                        const rate = elapsed / pct; // sec per percent
                        const remain = Math.max(0, Math.round((100 - pct) * rate));
                        eta.textContent = remain > 0 ? (remain + 's remaining') : '';
                    } else {
                        eta.textContent = '';
                    }
                } catch (_) {}
            }
        },
        indeterminate() {
            if (bar) bar.style.width = (lastPct > 0 ? lastPct : 10) + '%';
            if (eta) eta.textContent = '';
        },
        done() {
            try { overlay.remove(); } catch (e) { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
        },
        fail(msg) {
            try {
                const txt = overlay.querySelector('.upload-text');
                if (txt) txt.textContent = msg || 'Upload failed';
                if (bar) bar.style.background = '#ef4444';
            } catch (_) {}
        }
    };
}
// Lightbox with navigation state
let _lb = { urls: [], idx: 0 };

function ensureImageLightbox() {
    if (document.getElementById('chat-image-lightbox')) return;
    const wrap = document.createElement('div');
    wrap.id = 'chat-image-lightbox';
    wrap.className = 'chat-image-lightbox hidden';
    wrap.innerHTML = `
        <div class="cil-backdrop" data-cil-close="1"></div>
        <div class="cil-content" style="position:relative;display:flex;align-items:center;justify-content:center;gap:8px;">
            <button class="cil-close" aria-label="Close" data-cil-close="1" style="position:absolute;right:8px;top:8px;font-size:24px;line-height:1;background:none;border:none;color:#fff;cursor:pointer">&times;</button>
            <button class="cil-prev" aria-label="Previous" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:24px;background:rgba(0,0,0,0.4);border:none;color:#fff;cursor:pointer;padding:6px 10px">&#10094;</button>
            <img class="cil-image" src="" alt="Image" style="max-width:90vw;max-height:85vh;object-fit:contain;"/>
            <button class="cil-next" aria-label="Next" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:24px;background:rgba(0,0,0,0.4);border:none;color:#fff;cursor:pointer;padding:6px 10px">&#10095;</button>
            <div class="cil-counter" style="position:absolute;bottom:8px;right:12px;color:#fff;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px;font-size:12px"></div>
        </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
        if (e.target && e.target.getAttribute('data-cil-close') === '1') closeImageLightbox();
    });
    const prevBtn = wrap.querySelector('.cil-prev');
    const nextBtn = wrap.querySelector('.cil-next');
    prevBtn.addEventListener('click', (e) => { e.preventDefault(); prevLightbox(); });
    nextBtn.addEventListener('click', (e) => { e.preventDefault(); nextLightbox(); });
    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('chat-image-lightbox');
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeImageLightbox();
        if (e.key === 'ArrowRight') nextLightbox();
        if (e.key === 'ArrowLeft') prevLightbox();
    });
}

function showLightboxImage() {
    const overlay = document.getElementById('chat-image-lightbox');
    if (!overlay) return;
    const img = overlay.querySelector('.cil-image');
    const counter = overlay.querySelector('.cil-counter');
    if (!_lb.urls || !_lb.urls.length) return;
    const idx = Math.max(0, Math.min(_lb.idx, _lb.urls.length - 1));
    _lb.idx = idx;
    img.src = _lb.urls[idx];
    if (counter) counter.textContent = `${idx + 1}/${_lb.urls.length}`;
}

function openImageLightboxWith(urls, startIndex = 0) {
    const overlay = document.getElementById('chat-image-lightbox');
    if (!overlay) return;
    _lb.urls = Array.isArray(urls) ? urls.slice() : [String(urls || '')];
    _lb.idx = Math.max(0, Math.min(startIndex || 0, _lb.urls.length - 1));
    showLightboxImage();
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function nextLightbox() { if (_lb.urls && _lb.urls.length) { _lb.idx = (_lb.idx + 1) % _lb.urls.length; showLightboxImage(); } }
function prevLightbox() { if (_lb.urls && _lb.urls.length) { _lb.idx = (_lb.idx - 1 + _lb.urls.length) % _lb.urls.length; showLightboxImage(); } }

function openImageLightbox(url) { openImageLightboxWith([url], 0); }

function closeImageLightbox() {
    const overlay = document.getElementById('chat-image-lightbox');
    if (!overlay) return;
    overlay.classList.add('hidden');
    const img = overlay.querySelector('.cil-image');
    img.src = '';
    document.body.style.overflow = '';
}
// Render messages
function renderMessages() {
    // Remember if user was near bottom before re-render
    const shouldStickToBottom = isNearBottom();
    // If user scrolled up, capture an anchor to preserve position
    const preserve = !shouldStickToBottom;
    const anchor = preserve ? captureScrollAnchor() : null;
    if (!messagesList) return;
    if (!Array.isArray(messages)) messages = [];
    
    messagesList.innerHTML = '';
    if (messages.length === 0) {
        messagesList.innerHTML = `
            <div class="no-messages-container">
                <div class="no-messages-icon">
                    <i class="fas fa-comment-dots"></i>
                </div>
                <div class="no-messages-text">No messages yet</div>
            </div>
        `;
        return;
    }
    // Sort messages by timestamp (oldest first, since we're using column-reverse layout)
    const sortedMessages = [...messages].sort((a, b) => {
        const dateA = new Date(a.sent_at);
        const dateB = new Date(b.sent_at);
        return dateA - dateB; // Oldest first for column-reverse layout
    });
    let lastMessageDate = null;
    sortedMessages.forEach((message, index) => {
        const currentMessageDate = new Date(message.sent_at);
        
        // Check if we need to add a timestamp divider (10+ minute gap or first message)
        if (lastMessageDate === null || 
            (currentMessageDate - lastMessageDate) >= 10 * 60 * 1000) {
            
            // Format the date and time for the divider
            const options = { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit'
            };
            const formattedDateTime = currentMessageDate.toLocaleDateString(undefined, options);
            
            // Create and append the timestamp divider
            const timestampDivider = document.createElement('div');
            timestampDivider.className = 'timestamp-divider';
            timestampDivider.innerHTML = `<span>${formattedDateTime}</span>`;
            messagesList.appendChild(timestampDivider);
        }
        
        // Create the message item using the unified builder (supports images)
        const messageItem = buildMessageItem(message);
        
        // Ensure long messages don't break layout
        const messageContent = messageItem.querySelector('.message-content p');
        if (messageContent && messageContent.textContent.length > 100) {
            messageContent.style.overflowWrap = 'break-word';
            messageContent.style.wordBreak = 'break-word';
        }
        messagesList.appendChild(messageItem);
        // Persist 'Sent' status outside the bubble for own, non-deleted messages
        const mid = message.id || message.message_id;
        if (message.is_own && !message.is_deleted && mid && String(mid) === String(lastSentMessageId)) {
            addOrUpdateMessageStatus(messageItem, 'Sent');
        }
        
        // Update the last message date
        lastMessageDate = currentMessageDate;
    });
    // If user was anchored, restore the position relative to anchor
    if (preserve && anchor) {
        restoreScrollAnchor(anchor);
    }
    // Only auto-scroll if user was near the bottom before render
    if (shouldStickToBottom) {
        scrollToBottom(false);
        setTimeout(() => scrollToBottom(false), 100);
    }
}
// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !selectedUser) return;
    // Clear input
    messageInput.value = '';
    updateSendButton();
    updateCharCount();
    // Show temporary message
    const tempMessage = {
        message: message,
        is_own: true,
        sent_at: new Date().toISOString()
    };
    messages.push(tempMessage);
    
    // Add the message directly to the DOM instead of re-rendering everything
    appendNewMessage(tempMessage);
    // Optimistically ensure the user appears in the list immediately and update preview
    (function ensureUserVisibleNow() {
        const container = document.getElementById('search-results');
        if (!container) return;
        try { if (selectedUserMeta && selectedUserMeta.is_admin) return; } catch (e) {}
        let el = container.querySelector(`.user-item[data-user-id="${selectedUser}"]`);
        if (!el) {
            const u = {
                id: selectedUser,
                username: selectedUserMeta.username || '',
                full_name: selectedUserMeta.full_name || '',
                profile_picture_url: selectedUserMeta.profile_picture_url || ''
            };
            try {
                el = createListUserItem(u);
                container.prepend(el);
            } catch (e) {}
        }
        // Update preview and move to top (only for non-admin chats)
        if (!(selectedUserMeta && selectedUserMeta.is_admin)) {
            updateLastMessage(selectedUser, message, true, true, true);
        }
        // If previously hidden, unhide now
        unhideChatUser(selectedUser);
    })();
    // Send to server
    fetch('/user/communication/send/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            receiver: selectedUser,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.id) {
            // Promote the latest temp message node to real ID and wire actions structure
            const tempNode = Array.from(messagesList.querySelectorAll('.message-item'))
                .reverse()
                .find(n => (n.dataset.messageId || '').startsWith('temp-'));
            if (tempNode) {
                // If polling already rendered the message with the real ID, drop the temp node
                const existingNode = (messagesList || document).querySelector(`.message-item[data-message-id="${data.id}"]`);
                if (existingNode && existingNode !== tempNode) {
                    try { tempNode.remove(); } catch (e) {}
                    setLastSentFor(selectedUser, data.id);
                    setSentBadgeOn(existingNode);
                } else {
                    tempNode.dataset.messageId = data.id;
                    tempNode.classList.add('sent');
                    // Ensure content contains actions for own messages
                    const content = tempNode.querySelector('.message-content');
                    if (content) {
                        // Only keep the message text inside the bubble; the outer three-dot menu remains
                        content.innerHTML = `<p>${data.message}</p>`;
                    }
                    // Persist last sent id and add 'Sent' status indicator at bottom-right
                    setLastSentFor(selectedUser, data.id);
                    setSentBadgeOn(tempNode);
                }
            } else {
                // Fallback: append the message now if optimistic temp was already removed by a refresh
                const msgObj = { id: data.id, is_own: true, sent_at: data.sent_at || new Date().toISOString(), message: data.message };
                appendNewMessage(msgObj);
                setLastSentFor(selectedUser, data.id);
                const lastOwn = Array.from((messagesList || document).querySelectorAll('.message-item.sent')).pop();
                if (lastOwn) setSentBadgeOn(lastOwn);
            }
            // Ensure this user exists in the list immediately
            (function ensureUserInList() {
                const container = document.getElementById('search-results');
                if (!container) return;
                // Do not inject admin/support accounts into the left list
                try { if (selectedUserMeta && selectedUserMeta.is_admin) return; } catch (e) {}
                let el = container.querySelector(`.user-item[data-user-id="${selectedUser}"]`);
                if (!el) {
                    const u = {
                        id: selectedUser,
                        username: selectedUserMeta.username || '',
                        full_name: selectedUserMeta.full_name || '',
                        profile_picture_url: selectedUserMeta.profile_picture_url || ''
                    };
                    try {
                        el = createListUserItem(u);
                        container.prepend(el);
                    } catch (e) {}
                }
            })();
            // Update list preview only for non-admin chats
            if (!(selectedUserMeta && selectedUserMeta.is_admin)) {
                updateLastMessage(selectedUser, data.message || message, true);
                unhideChatUser(selectedUser);
            }
            // Force-refresh recent chats so new conversations appear immediately
            try { refreshUserList(true); } catch (e) {}
            // Scroll a bit later to account for DOM paint (force scroll for own message)
            setTimeout(() => scrollToBottom(true), 100);
        } else {
            console.error('Failed to send message:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });
}

// Add or update a small status text at bottom-right of a message item
function addOrUpdateMessageStatus(messageItem, text) {
    if (!messageItem) return;
    // Remove any stray status inside the bubble
    const bubbleStatus = messageItem.querySelector('.message-content .message-status');
    if (bubbleStatus) bubbleStatus.remove();
    // Ensure a single status element directly under the message item
    let status = Array.from(messageItem.children).find(el => el.classList && el.classList.contains('message-status'));
    if (!status) {
        status = document.createElement('span');
        status.className = 'message-status';
        messageItem.appendChild(status);
    }
    status.textContent = text || '';
}

// Ensure only one message shows the 'Sent' badge at a time
function setSentBadgeOn(messageItem) {
    try {
        const container = messagesList || document;
        const existing = container.querySelectorAll('.message-status');
        existing.forEach(el => el.remove());
    } catch (e) {}
    addOrUpdateMessageStatus(messageItem, 'Sent');
}

// Kick off user list polling once the page is fully loaded
window.addEventListener('load', () => {
    startPollingUserList();
});
































