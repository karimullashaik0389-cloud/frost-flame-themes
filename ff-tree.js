/**
 * Frost & Flame — step-by-step entry tree (ONE screen visible at a time).
 * Hi → How many → branch → apply theme id → enter site.
 * Themes: solo_m, solo_f, friends, couple, gang, family, family_kids
 * Theme styling applied by ff-themes.js when a theme is chosen.
 */
(function () {
  var STORAGE = 'ff_entry_theme';
  var root, changeBtn;
  var state = { step: 'hi', count: null, themeId: null };

  var THEME_META = {
    solo_m: { label: 'Just you · playful', emoji: '🧔' },
    solo_f: { label: 'Just you · stylish', emoji: '💁‍♀️' },
    friends: { label: 'Two friends', emoji: '👯' },
    couple: { label: 'Couple · date night', emoji: '💑' },
    gang: { label: "Gang's Night Out", emoji: '🌃' },
    family: { label: 'Big Family Feast', emoji: '🪔' },
    family_kids: { label: 'Family with kids', emoji: '👨‍👩‍👧‍👦' }
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

  function clearActive() {
    if (!root) return;
    root.querySelectorAll('.ff-tree-step').forEach(function (s) {
      s.classList.remove('is-active');
      s.setAttribute('aria-hidden', 'true');
    });
  }

  function showStep(id) {
    clearActive();
    state.step = id;
    var step = root.querySelector('[data-ff-step="' + id + '"]');
    if (!step) return;
    step.classList.add('is-active');
    step.setAttribute('aria-hidden', 'false');
    // Assert invariant for tests / safety
    var visible = root.querySelectorAll('.ff-tree-step.is-active');
    if (visible.length !== 1) {
      console.error('[ff-tree] expected exactly 1 active step, got', visible.length);
    }
  }

  function finish(themeId) {
    state.themeId = themeId;
    try { sessionStorage.setItem(STORAGE, themeId); } catch (e) {}
    document.documentElement.setAttribute('data-ff-theme', themeId);
    document.body.classList.add('ff-theme-' + themeId);
    hideOverlay();
    updateChangeChip();
    try {
      window.dispatchEvent(new CustomEvent('ff:theme', { detail: { themeId: themeId } }));
    } catch (e) {}
  }

  function hideOverlay() {
    if (!root) return;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showOverlay(startStep) {
    if (!root) return;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showStep(startStep || 'hi');
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

  function restart() {
    state.count = null;
    state.themeId = null;
    try { sessionStorage.removeItem(STORAGE); } catch (e) {}
    document.documentElement.removeAttribute('data-ff-theme');
    // remove theme classes
    document.body.className = document.body.className
      .split(/\s+/).filter(function (c) { return c && c.indexOf('ff-theme-') !== 0; }).join(' ');
    showOverlay('hi');
  }

  function build() {
    root = el('div', {
      id: 'ff-tree-root',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Welcome to Frost & Flame'
    });

    var sheet = el('div', { className: 'ff-tree-sheet' });

    // Screen 1: Hi
    var hi = el('div', { className: 'ff-tree-step', 'data-ff-step': 'hi', 'aria-hidden': 'true' });
    hi.appendChild(el('div', { className: 'ff-tree-emoji', text: '🔥❄️' }));
    hi.appendChild(el('h1', { className: 'ff-tree-title', text: 'Hi' }));
    hi.appendChild(el('p', { className: 'ff-tree-sub', text: timeGreeting() + ' — welcome to Frost & Flame.' }));
    var hiOpts = el('div', { className: 'ff-tree-opts' });
    var hiBtn = el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-action': 'to-count' }, 'Continue');
    hiOpts.appendChild(hiBtn);
    hi.appendChild(hiOpts);

    // Screen 2: How many
    var count = el('div', { className: 'ff-tree-step', 'data-ff-step': 'count', 'aria-hidden': 'true' });
    count.appendChild(el('div', { className: 'ff-tree-emoji', text: '👥' }));
    count.appendChild(el('h1', { className: 'ff-tree-title', text: 'How many people are you?' }));
    count.appendChild(el('p', { className: 'ff-tree-sub', text: 'Pick one — we’ll shape the menu for your table.' }));
    var countOpts = el('div', { className: 'ff-tree-opts' });
    ;[
      { v: '1', label: '1' },
      { v: '2', label: '2' },
      { v: '3', label: '3' },
      { v: 'more', label: 'More than 3', hint: 'Four or more' }
    ].forEach(function (o) {
      var b = el('button', {
        type: 'button', className: 'ff-tree-btn',
        'data-ff-count': o.v
      }, o.label + (o.hint ? '<span class="hint">' + o.hint + '</span>' : ''));
      countOpts.appendChild(b);
    });
    count.appendChild(countOpts);
    count.appendChild(el('button', { type: 'button', className: 'ff-tree-back', 'data-ff-back': 'hi' }, '← Back'));

    // Screen 3a: gender (solo)
    var gender = el('div', { className: 'ff-tree-step', 'data-ff-step': 'gender', 'aria-hidden': 'true' });
    gender.appendChild(el('div', { className: 'ff-tree-emoji', text: '✨' }));
    gender.appendChild(el('h1', { className: 'ff-tree-title', text: 'Are you male or female?' }));
    gender.appendChild(el('p', { className: 'ff-tree-sub', text: 'So we can set the right vibe for one.' }));
    var gOpts = el('div', { className: 'ff-tree-opts' });
    gOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'solo_m' }, 'Male'));
    gOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'solo_f' }, 'Female'));
    gender.appendChild(gOpts);
    gender.appendChild(el('button', { type: 'button', className: 'ff-tree-back', 'data-ff-back': 'count' }, '← Back'));

    // Screen 3b: who with (two)
    var who2 = el('div', { className: 'ff-tree-step', 'data-ff-step': 'who2', 'aria-hidden': 'true' });
    who2.appendChild(el('div', { className: 'ff-tree-emoji', text: 'ふたり' }));
    who2.appendChild(el('h1', { className: 'ff-tree-title', text: "Who's with you?" }));
    who2.appendChild(el('p', { className: 'ff-tree-sub', text: 'Friend night or date night?' }));
    // fix emoji - I used wrong chars
    who2.querySelector('.ff-tree-emoji').textContent = '🫶';
    var wOpts = el('div', { className: 'ff-tree-opts' });
    wOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'friends' }, 'Friend<span class="hint">Two friends</span>'));
    wOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'couple' }, 'Partner<span class="hint">Date night</span>'));
    who2.appendChild(wOpts);
    who2.appendChild(el('button', { type: 'button', className: 'ff-tree-back', 'data-ff-back': 'count' }, '← Back'));

    // Screen 3c: kids? (more than 3)
    var kids = el('div', { className: 'ff-tree-step', 'data-ff-step': 'kids', 'aria-hidden': 'true' });
    kids.appendChild(el('div', { className: 'ff-tree-emoji', text: '👨‍👩‍👧‍👦' }));
    kids.appendChild(el('h1', { className: 'ff-tree-title', text: 'Any kids with you?' }));
    kids.appendChild(el('p', { className: 'ff-tree-sub', text: 'We’ll keep little ones busy if yes.' }));
    var kOpts = el('div', { className: 'ff-tree-opts' });
    kOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'family_kids' }, 'Yes<span class="hint">Kids’ colouring zone</span>'));
    kOpts.appendChild(el('button', { type: 'button', className: 'ff-tree-btn', 'data-ff-theme': 'family' }, 'No<span class="hint">Big Family Feast</span>'));
    kids.appendChild(kOpts);
    kids.appendChild(el('button', { type: 'button', className: 'ff-tree-back', 'data-ff-back': 'count' }, '← Back'));

    sheet.appendChild(hi);
    sheet.appendChild(count);
    sheet.appendChild(gender);
    sheet.appendChild(who2);
    sheet.appendChild(kids);
    root.appendChild(sheet);
    document.body.appendChild(root);

    changeBtn = el('button', {
      type: 'button', id: 'ff-tree-change',
      'aria-label': 'Change who is at your table'
    });
    changeBtn.addEventListener('click', restart);
    document.body.appendChild(changeBtn);

    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ff-action],[data-ff-count],[data-ff-theme],[data-ff-back]');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-ff-action') && t.getAttribute('data-ff-action') === 'to-count') {
        showStep('count');
        return;
      }
      if (t.hasAttribute('data-ff-back')) {
        showStep(t.getAttribute('data-ff-back'));
        return;
      }
      if (t.hasAttribute('data-ff-count')) {
        var c = t.getAttribute('data-ff-count');
        state.count = c;
        if (c === '1') showStep('gender');
        else if (c === '2') showStep('who2');
        else if (c === '3') finish('gang');
        else if (c === 'more') showStep('kids');
        return;
      }
      if (t.hasAttribute('data-ff-theme')) {
        finish(t.getAttribute('data-ff-theme'));
      }
    });
  }

  function boot() {
    build();
    var params = new URLSearchParams(location.search);
    var forced = params.get('group') || params.get('theme');
    var saved = null;
    try { saved = sessionStorage.getItem(STORAGE); } catch (e) {}
    if (params.get('fresh') === '1') {
      try { sessionStorage.removeItem(STORAGE); } catch (e) {}
      saved = null;
    }
    if (forced && THEME_META[forced]) {
      finish(forced);
    } else if (saved && THEME_META[saved]) {
      state.themeId = saved;
      document.documentElement.setAttribute('data-ff-theme', saved);
      document.body.classList.add('ff-theme-' + saved);
      hideOverlay();
      updateChangeChip();
    } else {
      showOverlay('hi');
    }
    // Test helper
    window.FFTree = {
      getStep: function () { return state.step; },
      getTheme: function () { return state.themeId; },
      visibleStepCount: function () {
        if (root.hidden) return 0;
        return root.querySelectorAll('.ff-tree-step.is-active').length;
      },
      restart: restart,
      THEME_META: THEME_META
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
