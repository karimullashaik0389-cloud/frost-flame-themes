/**
 * Premium single-entry chrome: one calm More button → tidy sheet
 * (Ask Frosty, Games, Stories, Change theme, Browse menus).
 * Hides on cart/checkout. Never covers login, cart, or bottom nav.
 */
(function () {
  'use strict';
  if (window.FFChrome) return;

  var STORAGE_FORCE = 'ff_fab_force_show';
  var moreBtn = null;
  var sheet = null;
  var backdrop = null;
  var handle = null;
  var tucked = false;
  var sheetOpen = false;

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

  function openFrostyPanel() {
    try { window.dispatchEvent(new Event('ff:frosty')); } catch (e) {}
    if (window.FFFrosty && typeof window.FFFrosty.open === 'function') {
      window.FFFrosty.open();
      return;
    }
    var openBtn = document.querySelector('[data-testid="frosty-open-btn"]');
    if (openBtn) { try { openBtn.click(); return; } catch (e) {} }
  }

  function changeTheme() {
    try {
      if (window.FFTree && typeof window.FFTree.restart === 'function') {
        window.FFTree.restart();
        return;
      }
    } catch (e) {}
    var chip = document.getElementById('ff-tree-change');
    if (chip) { try { chip.click(); return; } catch (e) {} }
  }

  function browseMenus() {
    try {
      if (window.FFFloatMenu && typeof window.FFFloatMenu.show === 'function') {
        window.FFFloatMenu.show(false);
        return;
      }
    } catch (e) {}
    var t = document.getElementById('ff-float-toggle');
    if (t) { try { t.click(); } catch (e) {} }
  }

  function closeSheet() {
    sheetOpen = false;
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('ff-more-open');
  }

  function openSheet() {
    if (tucked || entryOpen()) return;
    ensureSheet();
    sheetOpen = true;
    sheet.hidden = false;
    backdrop.hidden = false;
    moreBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('ff-more-open');
    var first = sheet.querySelector('button');
    if (first) try { first.focus(); } catch (e) {}
  }

  function toggleSheet() {
    if (sheetOpen) closeSheet();
    else openSheet();
  }

  function ensureSheet() {
    if (backdrop && backdrop.isConnected && sheet && sheet.isConnected) return;
    if (!backdrop || !backdrop.isConnected) {
      backdrop = el('div', {
        id: 'ff-more-backdrop',
        'data-testid': 'ff-more-backdrop',
        hidden: 'hidden'
      });
      backdrop.addEventListener('click', closeSheet);
      document.body.appendChild(backdrop);
    }
    if (!sheet || !sheet.isConnected) {
      sheet = el('div', {
        id: 'ff-more-sheet',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'More from Frost & Flame',
        'data-testid': 'ff-more-sheet',
        hidden: 'hidden'
      });
      sheet.innerHTML =
        '<div class="ff-more-head">' +
          '<p class="ff-more-kicker">Frost &amp; Flame</p>' +
          '<h2 class="ff-more-title">More</h2>' +
          '<p class="ff-more-sub">A quiet corner while you browse.</p>' +
        '</div>' +
        '<div class="ff-more-list" role="menu">' +
          '<button type="button" class="ff-more-item" data-ff-more="frosty" data-testid="ff-more-frosty">' +
            '<span class="ff-more-ic" aria-hidden="true">❄</span>' +
            '<span class="ff-more-copy"><strong>Ask Frosty</strong><em>Menu help &amp; recommendations</em></span>' +
          '</button>' +
          '<button type="button" class="ff-more-item" data-ff-more="games" data-testid="ff-more-games">' +
            '<span class="ff-more-ic" aria-hidden="true">◆</span>' +
            '<span class="ff-more-copy"><strong>Games</strong><em>Light puzzles while you wait</em></span>' +
          '</button>' +
          '<button type="button" class="ff-more-item" data-ff-more="stories" data-testid="ff-more-stories">' +
            '<span class="ff-more-ic" aria-hidden="true">☰</span>' +
            '<span class="ff-more-copy"><strong>Stories</strong><em>Short reads for the table</em></span>' +
          '</button>' +
          '<button type="button" class="ff-more-item" data-ff-more="theme" data-testid="ff-more-theme">' +
            '<span class="ff-more-ic" aria-hidden="true">◎</span>' +
            '<span class="ff-more-copy"><strong>Change theme</strong><em>Who’s at your table</em></span>' +
          '</button>' +
          '<button type="button" class="ff-more-item" data-ff-more="menus" data-testid="ff-more-menus">' +
            '<span class="ff-more-ic" aria-hidden="true">◌</span>' +
            '<span class="ff-more-copy"><strong>Browse menus</strong><em>Frost, Flame, Mix &amp; more</em></span>' +
          '</button>' +
        '</div>' +
        '<button type="button" class="ff-more-close" data-testid="ff-more-close">Close</button>';
      sheet.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-ff-more], .ff-more-close');
        if (!btn || !sheet.contains(btn)) return;
        if (btn.classList.contains('ff-more-close')) { closeSheet(); return; }
        var act = btn.getAttribute('data-ff-more');
        closeSheet();
        setTimeout(function () {
          if (act === 'frosty') openFrostyPanel();
          else if (act === 'games') {
            if (window.FFPlay && window.FFPlay.openGames) window.FFPlay.openGames();
            else if (window.FFPlay) window.FFPlay.open('puzzles');
          } else if (act === 'stories') {
            if (window.FFPlay && window.FFPlay.openStories) window.FFPlay.openStories();
            else if (window.FFPlay) window.FFPlay.open('books');
          } else if (act === 'theme') changeTheme();
          else if (act === 'menus') browseMenus();
        }, 120);
      });
      document.body.appendChild(sheet);
    }
  }

  function ensureMoreBtn() {
    if (moreBtn && moreBtn.isConnected) return moreBtn;
    moreBtn = document.getElementById('ff-more-btn');
    if (!moreBtn) {
      moreBtn = el('button', {
        type: 'button',
        id: 'ff-more-btn',
        className: 'ff-more-btn',
        'aria-label': 'More — Ask Frosty, Games, Stories',
        'aria-expanded': 'false',
        'aria-haspopup': 'dialog',
        'data-testid': 'ff-more-btn'
      }, '<span class="ff-more-btn-mark" aria-hidden="true"></span>');
      moreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSheet();
      });
      document.body.appendChild(moreBtn);
    }
    return moreBtn;
  }

  function ensureHandle() {
    if (handle && handle.isConnected) return handle;
    handle = document.getElementById('ff-fab-handle');
    if (!handle) {
      handle = el('button', {
        type: 'button',
        id: 'ff-fab-handle',
        className: 'ff-fab-handle',
        'aria-label': 'Show More menu',
        'data-testid': 'ff-fab-handle',
        hidden: 'hidden'
      }, '<span class="ff-fab-handle-lbl">More</span>');
      handle.addEventListener('click', function () {
        try { sessionStorage.setItem(STORAGE_FORCE, '1'); } catch (e) {}
        setTucked(false, true);
        openSheet();
      });
      document.body.appendChild(handle);
    }
    return handle;
  }

  function hideLegacyChrome() {
    // Hide scattered legacy controls — functionality lives in More sheet
    ['ff-fab-dock', 'ff-fab-games', 'ff-fab-stories', 'ff-fab-frosty-fallback', 'ff-float-toggle', 'ff-tree-change', 'ff-play-pill', 'ff-play-nudge'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) {
        n.setAttribute('hidden', '');
        n.style.display = 'none';
      }
    });
    document.querySelectorAll('[data-testid="frosty-fab"]').forEach(function (fab) {
      fab.classList.add('ff-chrome-hidden-fab');
      fab.style.display = 'none';
      fab.setAttribute('aria-hidden', 'true');
    });
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

  function forceShow() {
    try { return sessionStorage.getItem(STORAGE_FORCE) === '1'; } catch (e) { return false; }
  }

  function shouldTuck() {
    var onCart = pathIsCheckout();
    var ordered = !!document.querySelector('[data-testid="order-sent-confirmation"]');
    if (onCart || ordered) return true;
    if (forceShow()) return false;
    if (stickyCartVisible()) return true;
    if (cartCount() > 0) return true;
    return false;
  }

  function closePlayPanels() {
    try {
      if (window.FFPlay && typeof window.FFPlay.close === 'function') window.FFPlay.close();
    } catch (e) {}
    closeSheet();
  }

  function setTucked(on, fromHandle) {
    tucked = !!on;
    ensureMoreBtn();
    ensureHandle();
    moreBtn.classList.toggle('is-tucked', tucked);
    moreBtn.setAttribute('aria-hidden', tucked ? 'true' : 'false');
    if (tucked) {
      closeSheet();
      handle.hidden = false;
      handle.removeAttribute('hidden');
      handle.classList.add('is-on');
      if (!fromHandle) closePlayPanels();
    } else {
      handle.hidden = true;
      handle.setAttribute('hidden', '');
      handle.classList.remove('is-on');
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
    hideLegacyChrome();
    guardHeaderLogin();
    ensureMoreBtn();
    ensureHandle();
    ensureSheet();

    if (entryOpen()) {
      moreBtn.style.display = 'none';
      if (handle) handle.hidden = true;
      closeSheet();
      return;
    }
    moreBtn.style.display = '';

    if (cartCount() === 0 && !pathIsCheckout() && !stickyCartVisible() && !document.querySelector('[data-testid="order-sent-confirmation"]')) {
      try { sessionStorage.removeItem(STORAGE_FORCE); } catch (e) {}
    }

    setTucked(shouldTuck(), false);
  }

  function boot() {
    ensureMoreBtn();
    ensureHandle();
    ensureSheet();
    hideLegacyChrome();
    tick();
    setInterval(tick, 800);
    window.addEventListener('ff:added', function () {
      try { sessionStorage.removeItem(STORAGE_FORCE); } catch (e) {}
      setTimeout(tick, 50);
    });
    window.addEventListener('ff:theme', tick);
    window.addEventListener('popstate', function () { setTimeout(tick, 50); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetOpen) closeSheet();
    });
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
      var obs = new MutationObserver(function () { hideLegacyChrome(); });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  window.FFChrome = {
    tick: tick,
    setTucked: setTucked,
    shouldTuck: shouldTuck,
    openSheet: openSheet,
    closeSheet: closeSheet,
    openFrostyPanel: openFrostyPanel
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
