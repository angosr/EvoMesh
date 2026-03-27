// ==================== Layout: Sidebar, Theme, Swipe, Resize ====================
// Extracted from frontend.js for file size compliance (<500 lines)
// Depends on: isMobile() is defined here, used by other files

function isMobile() { return window.innerWidth <= 768; }

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (isMobile()) {
    const isOpen = sb.classList.contains('mobile-open');
    sb.classList.toggle('mobile-open');
    document.getElementById('chat-sidebar').classList.remove('mobile-open');
    overlay.classList.toggle('show', !isOpen);
  } else {
    sb.classList.toggle('hidden');
  }
}

function toggleChat() {
  const chat = document.getElementById('chat-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (isMobile()) {
    const isOpen = chat.classList.contains('mobile-open');
    chat.classList.toggle('mobile-open');
    document.getElementById('sidebar').classList.remove('mobile-open');
    overlay.classList.toggle('show', !isOpen);
  } else {
    chat.classList.toggle('hidden');
  }
}

function closeMobileOverlay() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('chat-sidebar').classList.remove('mobile-open');
  document.getElementById('mobile-overlay').classList.remove('show');
}

// ==================== Theme toggle ====================
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'light' ? '' : 'light';
  if (next) document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;
  localStorage.setItem('evomesh-theme', next || 'dark');
  updateThemeButton();
}
function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isLight = document.documentElement.dataset.theme === 'light';
  btn.textContent = isLight ? 'Switch to Dark' : 'Switch to Light';
}
// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('evomesh-theme');
  if (saved === 'light') document.documentElement.dataset.theme = 'light';
})();

// ==================== Swipe-to-close for mobile panels ====================
(function() {
  const SWIPE_THRESHOLD = 60;
  function addSwipeClose(el, direction) {
    let startX = 0, startY = 0, tracking = false;
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!tracking || e.touches.length !== 1) return;
      if (Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX)) { tracking = false; }
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!tracking) return;
      tracking = false;
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX;
      if (direction === 'left' && dx < -SWIPE_THRESHOLD) closeMobileOverlay();
      if (direction === 'right' && dx > SWIPE_THRESHOLD) closeMobileOverlay();
    });
  }
  const sidebar = document.getElementById('sidebar');
  const chat = document.getElementById('chat-sidebar');
  if (sidebar) addSwipeClose(sidebar, 'left');
  if (chat) addSwipeClose(chat, 'right');
})();

// ==================== Resize handles ====================
function initResize(handleId, target, side) {
  const handle = document.getElementById(handleId);
  const el = document.getElementById(target);
  if (!handle || !el) return;
  let startX, startW;

  function onStart(x) {
    handle.classList.add('active');
    startX = x; startW = el.offsetWidth;
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
    document.body.style.cursor = 'col-resize';
  }
  function onMove(x) {
    const dx = side === 'left' ? x - startX : startX - x;
    el.style.width = Math.max(180, startW + dx) + 'px';
  }
  function onEnd() {
    handle.classList.remove('active');
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
    document.body.style.cursor = '';
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault(); onStart(e.clientX);
    const mm = ev => onMove(ev.clientX);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });

  handle.addEventListener('touchstart', e => {
    e.preventDefault(); onStart(e.touches[0].clientX);
    const tm = ev => { ev.preventDefault(); onMove(ev.touches[0].clientX); };
    const te = () => { onEnd(); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); };
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', te);
  }, { passive: false });
}
initResize('rh-left', 'sidebar', 'left');
initResize('rh-right', 'chat-sidebar', 'right');

// ==================== Mobile keyboard handling ====================
// Problem: keyboard opens → viewport shrinks → iframe shrinks → xterm resize → Claude refreshes
// Solution: freeze only iframe heights (prevent xterm resize), but let the page scroll
// normally so content above the keyboard stays visible.
(function() {
  if (!window.visualViewport) return;
  let kbVisible = false;
  const KEYBOARD_THRESHOLD = 150;

  let fullHeight = window.innerHeight;
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { fullHeight = window.innerHeight; }, 500);
  });

  window.visualViewport.addEventListener('resize', () => {
    if (!isMobile()) return;
    const vvh = window.visualViewport.height;
    const kbOpen = (fullHeight - vvh) > KEYBOARD_THRESHOLD;

    if (kbOpen && !kbVisible) {
      kbVisible = true;
      // Only freeze iframe heights — prevents xterm from seeing a resize
      // Do NOT freeze body/main — let the page scroll naturally
      document.querySelectorAll('.panel iframe').forEach(iframe => {
        const h = iframe.offsetHeight;
        if (h > 0) {
          iframe.style.height = h + 'px';
          iframe.style.minHeight = h + 'px';
          iframe.style.maxHeight = h + 'px';
        }
      });
      // Scroll the focused element into view above the keyboard
      setTimeout(() => {
        const ae = document.activeElement;
        if (ae && ae !== document.body) {
          ae.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 100);
    } else if (!kbOpen && kbVisible) {
      kbVisible = false;
      document.querySelectorAll('.panel iframe').forEach(iframe => {
        iframe.style.height = '';
        iframe.style.minHeight = '';
        iframe.style.maxHeight = '';
      });
    }
  });

  // Feed input: scroll into view when focused
  const feedMsg = document.getElementById('feed-msg');
  if (feedMsg) {
    feedMsg.addEventListener('focus', () => {
      if (!isMobile()) return;
      setTimeout(() => {
        feedMsg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 300);
    });
  }
})();

// ==================== Mobile bottom nav state ====================
function updateMobileNav(activeKey) {
  if (!isMobile()) return;
  const nav = document.getElementById('mobile-bottom-nav');
  if (!nav) return;
  nav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
  if (activeKey === 'dashboard') {
    document.getElementById('mob-nav-dash')?.classList.add('active');
  } else if (activeKey === 'settings') {
    document.getElementById('mob-nav-settings')?.classList.add('active');
  }
}
