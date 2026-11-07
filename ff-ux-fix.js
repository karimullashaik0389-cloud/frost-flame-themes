/**
 * UX fixes for themes preview: toast position, cart edit, upsell dedupe,
 * hash deep-links, top black-strip cleanup. Overlay only.
 */
(function () {
  'use strict';
  if (window.FFUxFix) return;

  function abs(p) {
    try { return window.__FF_ABS__ ? window.__FF_ABS__(p) : p; } catch (e) { return p; }
  }

  function pathOnly() {
    var path = location.pathname || '/';
    try {
      var base = window.__FF_BASE__ || '';
      if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    } catch (e) {}
    return path;
  }

  function scrollHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var el = document.getElementById(h);
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {
        try { el.scrollIntoView(true); } catch (e2) {}
      }
    }
  }

  function dedupeToasts() {
    var toasts = document.querySelectorAll('[data-sonner-toast], [data-radix-toast-viewport] > *, .ff-toast');
    if (toasts.length > 1) {
      for (var i = 1; i < toasts.length; i++) {
        try { toasts[i].style.display = 'none'; } catch (e) {}
      }
    }
    // Push toaster to bottom if present
    document.querySelectorAll('[data-sonner-toaster], section[aria-label*="Notifications" i]').forEach(function (n) {
      n.style.top = 'auto';
      n.style.bottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
      n.style.left = '50%';
      n.style.transform = 'translateX(-50%)';
      n.style.right = 'auto';
    });
  }

  function dedupeUpsells() {
    var sels = [
      '[data-testid="cart-upsell"]',
      '[data-testid="pair-upsell"]',
      '[data-testid="cart-launch"]',
      '[data-testid="launch-banner"]'
    ];
    sels.forEach(function (sel) {
      var nodes = document.querySelectorAll(sel);
      for (var i = 1; i < nodes.length; i++) nodes[i].style.display = 'none';
    });
    // Heuristic: repeated identical launch / upsell cards on cart
    if (pathOnly().indexOf('/cart') === 0) {
      var cards = Array.prototype.slice.call(document.querySelectorAll('main article, main .ff-card, main [class*="gborder"]'));
      var seen = {};
      cards.forEach(function (c) {
        var key = (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!key || key.length < 24) return;
        if (seen[key]) c.style.display = 'none';
        else seen[key] = true;
      });
    }
  }

  function killBlackStrip() {
    // Collapse any empty fixed/absolute bars creating a ~24px black band above header
    var header = document.querySelector('header');
    if (!header) return;
    var hr = header.getBoundingClientRect();
    if (hr.top > 0 && hr.top < 40) {
      document.documentElement.style.setProperty('--ff-strip-fix', String(hr.top));
      try {
        var prev = header.previousElementSibling;
        if (prev && prev.getBoundingClientRect().height < 40 && !(prev.textContent || '').trim()) {
          prev.style.display = 'none';
        }
      } catch (e) {}
      // Nudge root children that leave a gap
      var root = document.getElementById('root');
      if (root && root.firstElementChild) {
        var fe = root.firstElementChild;
        var st = getComputedStyle(fe);
        if (parseFloat(st.paddingTop) > 0 && parseFloat(st.paddingTop) < 40 && hr.top > 8) {
          // leave alone — often safe-area
        }
      }
    }
  }

  function openItemQuickView(itemId) {
    // Prefer React quick-view if exposed; else navigate to menu with query
    try {
      var btn = document.querySelector('[data-testid="dish-card-' + itemId + '"] button, [data-testid="add-' + itemId + '"], [data-testid*="' + itemId + '"]');
      if (btn) { btn.click(); return true; }
    } catch (e) {}
    return false;
  }

  function enhanceCartEdit() {
    if (pathOnly().indexOf('/cart') !== 0) return;
    var rows = document.querySelectorAll(
      '[data-testid^="cart-item"], [data-testid*="cart-line"], [data-testid^="line-"],' +
      ' main [data-testid*="qty"] , main li, main article.ff-card, main .ff-card'
    );
    // Also walk qty steppers' parents as line rows
    document.querySelectorAll('main button[aria-label*="Increase" i], main button[aria-label*="plus" i], main [data-testid*="qty-inc"]').forEach(function (b) {
      var row = b.closest('li, article, [data-testid^="cart"], .flex.gap-3, .flex.gap-4');
      if (row) rows = (rows.length ? rows : []);
    });
    var list = Array.prototype.slice.call(document.querySelectorAll(
      'main li, main article, main [data-testid^="cart-item"], main [data-testid^="line-"]'
    ));
    // Prefer rows that contain a £ and a +/- or qty
    list.forEach(function (row) {
      if (row.querySelector('[data-ff-edit]')) return;
      var text = (row.textContent || '');
      if (text.indexOf('£') === -1) return;
      var hasQty = !!(row.querySelector('button') && (/[0-9]/.test(text)));
      if (!hasQty) return;
      // skip giant upsell / empty-state blocks
      if (text.length > 600) return;
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.setAttribute('data-ff-edit', '1');
      edit.setAttribute('data-testid', 'ff-cart-edit');
      edit.className = 'ff-cart-edit';
      edit.textContent = 'Edit';
      edit.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var nameEl = row.querySelector('h3, h2, .font-semibold, [data-testid*="name"]');
        var name = nameEl ? nameEl.textContent.trim() : '';
        var existing = row.querySelector('[data-testid*="edit"], button[aria-label*="Edit" i], button[aria-label*="Change" i]');
        if (existing && existing !== edit) { existing.click(); return; }
        // Instant size/options: open the dish quick-view from menu when we know the id
        var idMatch = (row.getAttribute('data-testid') || '').match(/(?:cart-item|line)-(.+)/);
        var itemId = idMatch ? idMatch[1] : '';
        try { sessionStorage.setItem('ff_edit_focus', name || itemId); } catch (e) {}
        if (itemId) {
          if (window.__FF_NAV__) window.__FF_NAV__('/menu');
          else location.href = abs('/menu');
          setTimeout(function () {
            var open = document.querySelector('[data-testid="add-' + itemId + '"], [data-testid="qv-open-' + itemId + '"]');
            if (open) try { open.click(); } catch (e2) {}
          }, 500);
          return;
        }
        if (window.__FF_NAV__) window.__FF_NAV__('/menu');
        else location.href = abs('/menu');
      });
      var anchor = row.querySelector('[data-testid*="qty"], [aria-label*="quantity" i], .flex.items-center.gap-2, .flex.items-center.gap-3');
      if (anchor && anchor.parentNode) anchor.parentNode.appendChild(edit);
      else row.appendChild(edit);
    });
  }

  function styleCartEdit() {
    if (document.getElementById('ff-ux-fix-style')) return;
    var s = document.createElement('style');
    s.id = 'ff-ux-fix-style';
    s.textContent = [
      '.ff-cart-edit{appearance:none;margin-left:8px;min-height:36px;padding:0 12px;border-radius:999px;',
      'border:1px solid rgba(108,207,246,.45);background:rgba(108,207,246,.12);color:#e8f6fc;',
      'font:600 12px/1 Inter,system-ui,sans-serif;cursor:pointer;}',
      '.ff-cart-edit:focus-visible{outline:2px solid #6ccff6;outline-offset:2px;}',
      '.ff-size-soon{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding:10px 12px;border-radius:10px;border:1px dashed rgba(255,255,255,.14);color:#c5d2dc;font:500 13px/1.2 Inter,system-ui,sans-serif;}',
      '.ff-size-soon em{font-style:normal;color:#9aa8b5;font-size:12px;}'
    ].join('');
    document.head.appendChild(s);
  }


  var menuCache = null;
  function loadMenu() {
    if (menuCache) return Promise.resolve(menuCache);
    var url = abs('/api/menu.json');
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      menuCache = d; return d;
    }).catch(function () { return null; });
  }

  function enhanceSizePicker() {
    var qv = document.querySelector('[data-testid="quick-view"]');
    if (!qv || qv.hidden) return;
    if (qv.getAttribute('data-ff-sizes-enhanced') === '1') return;
    var title = (qv.querySelector('h2, h3, .h2, .h3') || {}).textContent || '';
    var low = title.toLowerCase();
    if (low.indexOf('pulao') === -1 && low.indexOf('pulav') === -1 && low.indexOf('biryani') === -1) return;
    loadMenu().then(function (data) {
      if (!data || !data.items) return;
      var item = data.items.find(function (it) {
        return (it.name || '').toLowerCase() === low.trim().toLowerCase();
      });
      if (!item) {
        item = data.items.find(function (it) {
          return (it.name || '').toLowerCase().indexOf(low.trim().toLowerCase().slice(0, 12)) === 0;
        });
      }
      var plan = (item && (item.size_plan || item.sizes)) || [
        { name: 'Single', price: null },
        { name: 'Medium', price: null },
        { name: 'Large', price: null },
        { name: 'Family Pack', price: null }
      ];
      // Find size fieldset / legend
      var legend = Array.prototype.find.call(qv.querySelectorAll('legend, p, label, span'), function (n) {
        return /size/i.test(n.textContent || '');
      });
      var host = legend ? (legend.closest('fieldset') || legend.parentElement) : null;
      if (!host) {
        // create a note block
        host = document.createElement('div');
        host.className = 'ff-size-plan';
        var addBtn = qv.querySelector('button.btn-flame, button:has-text("Add")');
        if (addBtn && addBtn.parentElement) addBtn.parentElement.insertBefore(host, addBtn);
        else qv.appendChild(host);
      }
      var existing = (host.textContent || '');
      plan.forEach(function (s) {
        if (s.price != null && typeof s.price === 'number') return; // already in React UI
        if (existing.indexOf(s.name) !== -1) return;
        var row = document.createElement('div');
        row.className = 'ff-size-soon';
        row.innerHTML = '<span>' + s.name + '</span><em>Price coming soon</em>';
        host.appendChild(row);
      });
      qv.setAttribute('data-ff-sizes-enhanced', '1');
    });
  }

  function tick() {
    enhanceSizePicker();
    dedupeToasts();
    dedupeUpsells();
    killBlackStrip();
    enhanceCartEdit();
  }

  function boot() {
    styleCartEdit();
    tick();
    setInterval(tick, 900);
    window.addEventListener('hashchange', function () { setTimeout(scrollHash, 120); });
    window.addEventListener('ff:theme', function () { setTimeout(scrollHash, 300); });
    window.addEventListener('ff:route', function () { setTimeout(function () { scrollHash(); tick(); }, 200); });
    setTimeout(scrollHash, 600);
    setTimeout(scrollHash, 1400);
  }

  window.FFUxFix = { tick: tick, scrollHash: scrollHash };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
