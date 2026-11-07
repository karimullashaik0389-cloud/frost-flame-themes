/**
 * Right-side compact FAB dock: Stories, Games, Ask Frosty (distinct looks).
 * Tucks away during cart/checkout/order so the bill keeps focus.
 * Moves Emergent frosty-fab into the dock; keeps header login free.
 */
(function () {
  'use strict';
  if (window.FFChrome) return;

  var STORAGE_FORCE = 'ff_fab_force_show';

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  var dock = null;
  var handle = null;
  var tucked = false;

  function ensureDock() {
    if (dock && dock.isConnected) return dock;
    dock = document.getElementById('ff-fab-dock');
    if (!dock) {
      dock = el('div', { id: 'ff-fab-dock', 'aria-label': 'Quick actions' });
      document.body.appendChild(dock);
    }
    return dock;
  }

  function ensureHandle() {
    if (handle && handle.isConnected) return handle;
    handle = document.getElementById('ff-fab-handle');
    if (!handle) {
      handle = el('button', {
        type: 'button',
        id: 'ff-fab-handle',
        className: 'ff-fab-handle',
        'aria-label': 'Show Games, Stories and Ask Frosty',
        'data-testid': 'ff-fab-handle',
        hidden: 'hidden'
      }, '<span aria-hidden="true">✨</span><span class="ff-fab-handle-lbl">Play</span>');
      handle.addEventListener('click', function () {
        try { sessionStorage.setItem(STORAGE_FORCE, '1'); } catch (e) {}
        setTucked(false, true);
      });
      document.body.appendChild(handle);
    }
    return handle;
  }

  function makeFab(id, cls, icon, label, onClick, testid) {
    var b = el('button', {
      type: 'button',
      id: id,
      className: 'ff-fab ' + cls,
      'aria-label': label,
      'data-testid': testid || id
    });
    b.appendChild(el('span', { className: 'ff-fab-ic', 'aria-hidden': 'true', text: icon }));
    b.appendChild(el('span', { className: 'ff-fab-lbl', text: label }));
    b.addEventListener('click', function (e) {
      e.preventDefault();
      onClick();
    });
    return b;
  }

  function placeGamesStories() {
    var d = ensureDock();
    if (!document.getElementById('ff-fab-stories')) {
      d.appendChild(makeFab('ff-fab-stories', 'ff-fab-stories', '📖', 'Stories', function () {
        if (window.FFPlay && window.FFPlay.openStories) window.FFPlay.openStories();
        else if (window.FFPlay) window.FFPlay.open('books');
      }, 'ff-fab-stories'));
    }
    if (!document.getElementById('ff-fab-games')) {
      d.appendChild(makeFab('ff-fab-games', 'ff-fab-games', '🎮', 'Games', function () {
        if (window.FFPlay && window.FFPlay.openGames) window.FFPlay.openGames();
        else if (window.FFPlay) window.FFPlay.open('puzzles');
      }, 'ff-fab-games'));
    }
  }

  function restyleFrosty(fab) {
    if (!fab || fab.dataset.ffRestyled === '1') return;
    fab.dataset.ffRestyled = '1';
    fab.classList.add('ff-fab-restyle');
    var label = fab.querySelector('[data-testid="frosty-fab-label"]');
    if (label) label.textContent = 'Ask Frosty';
    if (!fab.querySelector('.ff-fab-ic')) {
      var ic = el('span', { className: 'ff-fab-ic', 'aria-hidden': 'true', text: '❄️' });
      var first = fab.firstChild;
      if (first && first.getAttribute && first.getAttribute('aria-hidden') === 'true' && String(first.className || '').indexOf('absolute') !== -1) {
        fab.insertBefore(ic, first.nextSibling);
      } else {
        fab.insertBefore(ic, fab.firstChild);
      }
    }
  }

  function adoptFrosty() {
    var fab = document.querySelector('[data-testid="frosty-fab"]');
    if (!fab) {
      // Preview fallback when React FAB never mounts (e.g. auth/API on GH Pages)
      ensureFallbackFrosty();
      return !!document.getElementById('ff-fab-frosty-fallback');
    }
    // Prefer real FAB; remove fallback if React one appeared
    var fb = document.getElementById('ff-fab-frosty-fallback');
    if (fb) fb.remove();
    restyleFrosty(fab);
    var d = ensureDock();
    if (fab.parentElement !== d) {
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
      fab.style.position = 'relative';
      fab.style.transform = 'none';
      d.appendChild(fab);
    }
    return true;
  }

  function openFrostyPanel() {
    try { window.dispatchEvent(new Event('ff:frosty')); } catch (e) {}
    var openBtn = document.querySelector('[data-testid="frosty-open-btn"]');
    if (openBtn) { try { openBtn.click(); return; } catch (e) {} }
    // Preview-friendly panel when React Ask Frosty never mounts (GH Pages / CORS)
    var existing = document.getElementById('ff-frosty-preview');
    if (existing) { existing.hidden = false; return; }
    var panel = el('div', {
      id: 'ff-frosty-preview',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Ask Frosty preview',
      'data-testid': 'ff-frosty-preview'
    });
    panel.innerHTML = '<div class="ff-frosty-preview-card">' +
      '<p class="ff-frosty-preview-title">❄️ Ask Frosty</p>' +
      '<p class="ff-frosty-preview-body">Frosty\'s chat needs the live kitchen link, so it rests on this preview. Browse the menu, or open Games and Stories on the right while you wait.</p>' +
      '<button type="button" class="ff-frosty-preview-close" data-testid="ff-frosty-preview-close">Got it</button>' +
      '</div>';
    panel.addEventListener('click', function (ev) {
      if (ev.target === panel || (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-testid') === 'ff-frosty-preview-close')) {
        panel.hidden = true;
      }
    });
    document.body.appendChild(panel);
  }

  function ensureFallbackFrosty() {
    if (document.querySelector('[data-testid="frosty-fab"]')) return;
    if (document.getElementById('ff-fab-frosty-fallback')) return;
    var d = ensureDock();
    var b = makeFab('ff-fab-frosty-fallback', 'ff-fab-frosty', '❄️', 'Ask Frosty', openFrostyPanel, 'ff-fab-frosty-fallback');
    // Match round icy styling class already in CSS for .ff-fab-frosty
    d.appendChild(b);
  }

  function guardHeaderLogin() {
    var login = document.querySelector('[data-testid="header-account-link"]');
    if (login) {
      if (!login.style.position) login.style.position = 'relative';
      login.style.zIndex = '70';
    }
    var header = document.querySelector('header');
    if (header && (!header.style.zIndex || Number(header.style.zIndex) < 60)) {
      header.style.zIndex = '60';
    }
  }

  function cartCount() {
    var link = document.querySelector('[data-testid="header-cart-link"]');
    if (link) {
      var aria = link.getAttribute('aria-label') || '';
      var m = aria.match(/(\d+)/);
      if (m) return parseInt(m[1], 10) || 0;
    }
    var badge = document.querySelector('[data-testid="cart-count-badge"]');
    if (badge) {
      var n = parseInt(String(badge.textContent || '').replace(/[^\d]/g, ''), 10);
      if (!isNaN(n)) return n;
    }
    return 0;
  }

  function pathIsCheckout() {
    var path = location.pathname || '';
    // GH Pages base may be stripped by shim for React; raw path may include /frost-flame-themes
    path = path.replace(/^\/frost-flame-themes/, '') || '/';
    return path === '/cart' || path.indexOf('/cart/') === 0 || path === '/build' || path.indexOf('/build/') === 0;
  }

  function stickyCartVisible() {
    var bar = document.querySelector('[data-testid="sticky-cart-bar"]');
    if (!bar) return false;
    var cs = getComputedStyle(bar);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    var r = bar.getBoundingClientRect();
    return r.height > 8 && r.width > 8;
  }

  function orderFocusVisible() {
    return !!(
      document.querySelector('[data-testid="order-sent-confirmation"]') ||
      document.querySelector('[data-testid="checkout-name"]') ||
      document.querySelector('[data-testid="cart-total"]')
    );
  }

  function forceShow() {
    try { return sessionStorage.getItem(STORAGE_FORCE) === '1'; } catch (e) { return false; }
  }

  function shouldTuck() {
    var forced = forceShow();
    var onCart = pathIsCheckout();
    var ordered = !!document.querySelector('[data-testid="order-sent-confirmation"]');
    if (onCart || ordered) return true; // hard tuck — bill/order focus
    if (forced) return false; // user restored via handle on menu
    if (stickyCartVisible()) return true;
    if (cartCount() > 0) return true;
    if (orderFocusVisible() && onCart) return true;
    return false;
  }

  function closePlayPanels() {
    try {
      if (window.FFPlay && typeof window.FFPlay.close === 'function') window.FFPlay.close();
    } catch (e) {}
    var nudge = document.getElementById('ff-play-nudge');
    if (nudge) nudge.hidden = true;
  }

  function setTucked(on, fromHandle) {
    tucked = !!on;
    var d = ensureDock();
    var h = ensureHandle();
    d.classList.toggle('is-tucked', tucked);
    d.setAttribute('aria-hidden', tucked ? 'true' : 'false');
    if (tucked) {
      h.hidden = false;
      h.removeAttribute('hidden');
      h.classList.add('is-on');
      if (!fromHandle) closePlayPanels();
    } else {
      h.hidden = true;
      h.setAttribute('hidden', '');
      h.classList.remove('is-on');
    }
    document.documentElement.classList.toggle('ff-fabs-tucked', tucked);
  }

  function entryOpen() {
    return ['ff-tree-root', 'ff-float-root'].some(function (id) {
      var n = document.getElementById(id);
      return n && !n.hidden;
    });
  }

  function tick() {
    placeGamesStories();
    adoptFrosty();
    guardHeaderLogin();
    var d = ensureDock();
    ensureHandle();

    if (entryOpen()) {
      d.style.display = 'none';
      if (handle) handle.hidden = true;
      return;
    }
    d.style.display = 'flex';

    // Clear force-show only when cart is truly idle (no sticky bar, no items, not on cart/order)
    if (cartCount() === 0 && !pathIsCheckout() && !stickyCartVisible() && !document.querySelector('[data-testid="order-sent-confirmation"]')) {
      try { sessionStorage.removeItem(STORAGE_FORCE); } catch (e) {}
    }

    setTucked(shouldTuck(), false);
  }

  function boot() {
    ensureDock();
    ensureHandle();
    placeGamesStories();
    tick();
    setInterval(tick, 700);
    window.addEventListener('ff:added', function () {
      try { sessionStorage.removeItem(STORAGE_FORCE); } catch (e) {}
      setTimeout(tick, 50);
    });
    window.addEventListener('ff:theme', tick);
    window.addEventListener('popstate', function () { setTimeout(tick, 50); });
    // React router pushState
    var _ps = history.pushState;
    history.pushState = function () {
      var r = _ps.apply(this, arguments);
      setTimeout(tick, 50);
      return r;
    };
    var _rs = history.replaceState;
    history.replaceState = function () {
      var r = _rs.apply(this, arguments);
      setTimeout(tick, 50);
      return r;
    };
    try {
      var obs = new MutationObserver(function () { adoptFrosty(); });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  window.FFChrome = {
    tick: tick,
    adoptFrosty: adoptFrosty,
    setTucked: setTucked,
    shouldTuck: shouldTuck
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
