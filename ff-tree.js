/**
 * Frost & Flame — one-screen entry (fast).
 * Remembered in localStorage; deep links / saved theme skip straight to content.
 * Themes: solo_m, solo_f, friends, couple, gang, family, family_kids
 */
(function () {
  var STORAGE = 'ff_entry_theme';
  var STORAGE_LEGACY = 'ff_entry_theme'; // was sessionStorage
  var root, changeBtn;
  var state = { step: 'pick', count: null, themeId: null };
  var finishing = false;

  var THEME_META = {
    solo_m: { label: 'Just you · for him', emoji: '🧔', group: '1' },
    solo_f: { label: 'Just you · for her', emoji: '💁‍♀️', group: '1' },
    friends: { label: 'Two friends', emoji: '👯', group: '2' },
    couple: { label: 'Couple', emoji: '💑', group: '2' },
    gang: { label: "Gang's night out", emoji: '🌃', group: '3+' },
    family: { label: 'Family feast', emoji: '🪔', group: '3+' },
    family_kids: { label: 'Family with kids', emoji: '👨‍👩‍👧‍👦', group: '3+' }
  };

  function timeGreeting() {
    var h = Number(new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London', hour: 'numeric', hour12: false
    }));
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

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

  function readSaved() {
    try {
      var v = localStorage.getItem(STORAGE);
      if (v && THEME_META[v]) return v;
    } catch (e) {}
    try {
      var s = sessionStorage.getItem(STORAGE_LEGACY);
      if (s && THEME_META[s]) {
        try { localStorage.setItem(STORAGE, s); } catch (e2) {}
        return s;
      }
    } catch (e) {}
    return null;
  }

  function writeSaved(themeId) {
    try { localStorage.setItem(STORAGE, themeId); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_LEGACY, themeId); } catch (e) {}
  }

  function clearSaved() {
    try { localStorage.removeItem(STORAGE); } catch (e) {}
    try { sessionStorage.removeItem(STORAGE_LEGACY); } catch (e) {}
  }

  function applyThemeClasses(themeId) {
    document.documentElement.setAttribute('data-ff-theme', themeId);
    document.body.className = document.body.className
      .split(/\s+/).filter(function (c) { return c && c.indexOf('ff-theme-') !== 0; }).join(' ');
    document.body.classList.add('ff-theme-' + themeId);
  }

  function hideOverlay() {
    if (!root) return;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(mountHello, 30);
  }

  function showOverlay() {
    if (!root) return;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    updateChangeChip();
  }

  function updateChangeChip() {
    if (!changeBtn) return;
    var id = state.themeId;
    if (!id || !root.hidden) {
      changeBtn.classList.remove('is-on');
      return;
    }
    var meta = THEME_META[id] || { label: id, emoji: '✨' };
    changeBtn.innerHTML = '<span class="dot">' + meta.emoji + '</span><span>' + meta.label + ' · change</span>';
    changeBtn.classList.add('is-on');
  }

  function finish(themeId, opts) {
    if (finishing) return;
    finishing = true;
    opts = opts || {};
    state.themeId = themeId;
    writeSaved(themeId);
    applyThemeClasses(themeId);
    hideOverlay();
    updateChangeChip();
    // Defer theme event so the click paints immediately (no main-thread hang)
    var fire = function () {
      try {
        window.dispatchEvent(new CustomEvent('ff:theme', {
          detail: { themeId: themeId, skipFloat: !!opts.skipFloat, fromEntry: !opts.silent }
        }));
      } catch (e) {}
      finishing = false;
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { setTimeout(fire, 0); });
    } else {
      setTimeout(fire, 0);
    }
  }

  var GREET_LINE = "Oh, you are hungry? Come on in, we've got something hot and something cold waiting for you";

  function prefersReduce() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function typeLine(node) {
    if (!node || node.getAttribute('data-typed') === '1') return;
    node.setAttribute('data-typed', '1');
    if (prefersReduce()) { node.textContent = GREET_LINE; return; }
    node.textContent = '';
    var i = 0;
    (function step() {
      i = Math.min(GREET_LINE.length, i + 4);
      node.textContent = GREET_LINE.slice(0, i);
      if (i < GREET_LINE.length) requestAnimationFrame(step);
    })();
  }

  function goTemp(side) {
    var path = side === 'hot' ? '/menu/flame' : '/menu/frost';
    try {
      if (root && !root.hidden) finish(state.themeId || 'friends', { skipFloat: true });
    } catch (e) {}
    if (window.__FF_NAV__) window.__FF_NAV__(path);
    else location.href = (window.__FF_ABS__ ? window.__FF_ABS__(path) : path);
  }

  function appPath() {
    var path = location.pathname || '/';
    try {
      var base = window.__FF_BASE__ || '';
      if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    } catch (e) {}
    return path;
  }

  function helloHidden() {
    try { return sessionStorage.getItem('ff_hello_hide') === '1'; } catch (e) { return false; }
  }

  function buildHello() {
    var el = document.createElement('section');
    el.id = 'ff-hello';
    el.setAttribute('data-testid', 'ff-hello');
    el.setAttribute('aria-label', 'Welcome');
    el.innerHTML =
      '<div class="ff-greet-shimmer" aria-hidden="true"></div>' +
      '<p class="ff-hello-when" data-testid="ff-hello-when"></p>' +
      '<p class="ff-greet-line" data-ff-greet-line></p>' +
      '<div class="ff-temp-row">' +
        '<button type="button" class="ff-temp-btn" data-ff-temp="cold" data-testid="ff-hello-cold">Something cold</button>' +
        '<button type="button" class="ff-temp-btn ff-temp-btn--hot" data-ff-temp="hot" data-testid="ff-hello-hot">Something hot</button>' +
        '<button type="button" class="ff-temp-btn ff-temp-btn--quiet" data-ff-hello-dismiss data-testid="ff-hello-dismiss">Not now</button>' +
      '</div>';
    el.addEventListener('click', function (e) {
      var dismiss = e.target.closest('[data-ff-hello-dismiss]');
      if (dismiss) {
        try { sessionStorage.setItem('ff_hello_hide', '1'); } catch (err) {}
        el.remove();
        return;
      }
      var b = e.target.closest('[data-ff-temp]');
      if (!b) return;
      e.preventDefault();
      goTemp(b.getAttribute('data-ff-temp'));
    });
    return el;
  }

  function mountHello() {
    var existing = document.getElementById('ff-hello');
    if (helloHidden() || (root && !root.hidden) || appPath() !== '/') {
      if (existing) existing.remove();
      return;
    }
    var main = document.querySelector('main') || document.getElementById('root');
    if (!main) return;
    if (!existing) existing = buildHello();
    var when = existing.querySelector('[data-testid="ff-hello-when"]');
    if (when) when.textContent = timeGreeting() + '.';
    typeLine(existing.querySelector('[data-ff-greet-line]'));
    if (existing.parentNode !== main) main.insertBefore(existing, main.firstChild);
  }

  function skipStraight() {
    // Default calm theme so CSS tokens apply; user can change later via More
    finish('friends', { skipFloat: true });
  }

  function restart() {
    state.count = null;
    state.themeId = null;
    clearSaved();
    document.documentElement.removeAttribute('data-ff-theme');
    document.body.className = document.body.className
      .split(/\s+/).filter(function (c) { return c && c.indexOf('ff-theme-') !== 0; }).join(' ');
    finishing = false;
    showOverlay();
  }

  function build() {
    root = el('div', {
      id: 'ff-tree-root',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Welcome to Frost & Flame'
    });

    var sheet = el('div', { className: 'ff-tree-sheet' });
    var pick = el('div', { className: 'ff-tree-step is-active', 'data-ff-step': 'pick', 'aria-hidden': 'false' });
    var greet = el('div', { className: 'ff-greet-block' });
    greet.appendChild(el('div', { className: 'ff-greet-shimmer', 'aria-hidden': 'true' }));
    greet.appendChild(el('h1', { className: 'ff-tree-title', text: timeGreeting() + '.' }));
    greet.appendChild(el('p', { className: 'ff-greet-line', 'data-ff-greet-line': '1' }));
    var temps = el('div', { className: 'ff-temp-row' });
    temps.appendChild(el('button', {
      type: 'button', className: 'ff-temp-btn', 'data-ff-temp': 'cold', 'data-testid': 'ff-tree-cold'
    }, 'Something cold'));
    temps.appendChild(el('button', {
      type: 'button', className: 'ff-temp-btn ff-temp-btn--hot', 'data-ff-temp': 'hot', 'data-testid': 'ff-tree-hot'
    }, 'Something hot'));
    greet.appendChild(temps);
    pick.appendChild(greet);
    pick.appendChild(el('p', { className: 'ff-tree-sub', text: 'Who’s at your table? One tap — or skip straight to the menu.' }));

    var opts = el('div', { className: 'ff-tree-opts ff-tree-opts--grid' });
    Object.keys(THEME_META).forEach(function (id) {
      var m = THEME_META[id];
      var b = el('button', {
        type: 'button',
        className: 'ff-tree-btn ff-tree-btn--compact',
        'data-ff-theme': id,
        'data-testid': 'ff-tree-theme-' + id
      }, '<span class="ff-tree-btn-emoji" aria-hidden="true">' + m.emoji + '</span>' +
         '<span class="ff-tree-btn-label">' + m.label + '</span>');
      opts.appendChild(b);
    });
    pick.appendChild(opts);

    var skip = el('button', {
      type: 'button',
      className: 'ff-tree-skip',
      'data-ff-action': 'skip',
      'data-testid': 'ff-tree-skip'
    }, 'Skip — browse the menu');
    pick.appendChild(skip);

    sheet.appendChild(pick);
    root.appendChild(sheet);
    document.body.appendChild(root);

    changeBtn = el('button', {
      type: 'button', id: 'ff-tree-change',
      'aria-label': 'Change who is at your table'
    });
    changeBtn.addEventListener('click', restart);
    document.body.appendChild(changeBtn);

    // Capture-phase so the UI responds before any heavy listeners
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ff-theme],[data-ff-action],[data-ff-temp]');
      if (!t || !root.contains(t)) return;
      e.preventDefault();
      if (t.hasAttribute('data-ff-temp')) {
        goTemp(t.getAttribute('data-ff-temp'));
        return;
      }
      if (t.getAttribute('data-ff-action') === 'skip') {
        skipStraight();
        return;
      }
      if (t.hasAttribute('data-ff-theme')) {
        finish(t.getAttribute('data-ff-theme'), { skipFloat: true });
      }
    }, true);
    typeLine(pick.querySelector('[data-ff-greet-line]'));
  }

  function isDeepLink() {
    var path = location.pathname || '/';
    try {
      var base = window.__FF_BASE__ || '';
      if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    } catch (e) {}
    if (path !== '/' && path !== '') return true;
    if (location.hash && location.hash.length > 1) return true;
    return false;
  }

  function boot() {
    build();
    var params = new URLSearchParams(location.search);
    var forced = params.get('group') || params.get('theme');
    if (params.get('fresh') === '1') clearSaved();
    var saved = readSaved();

    if (forced && THEME_META[forced]) {
      finish(forced, { skipFloat: true, silent: true });
    } else if (saved && THEME_META[saved]) {
      state.themeId = saved;
      applyThemeClasses(saved);
      hideOverlay();
      updateChangeChip();
      // Soft notify themes layer without reopening float
      try {
        window.dispatchEvent(new CustomEvent('ff:theme', {
          detail: { themeId: saved, skipFloat: true, restored: true }
        }));
      } catch (e) {}
    } else if (isDeepLink()) {
      // Deep link: skip gate, apply calm default so themed CSS still works
      finish('friends', { skipFloat: true, silent: true });
    } else {
      showOverlay();
    }

    mountHello();
    setInterval(mountHello, 700);
    window.addEventListener('ff:theme', function () { setTimeout(mountHello, 40); });

    window.FFTree = {
      getStep: function () { return root.hidden ? 'done' : 'pick'; },
      getTheme: function () { return state.themeId; },
      visibleStepCount: function () {
        if (root.hidden) return 0;
        return root.querySelectorAll('.ff-tree-step.is-active').length;
      },
      restart: restart,
      finish: finish,
      THEME_META: THEME_META
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
