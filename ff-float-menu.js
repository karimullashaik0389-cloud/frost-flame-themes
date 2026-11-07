/**
 * Floating bubble menu — drifts in 360°, post-tree pick screen + toggleable overlay.
 * Does not alter existing Emergent DOM content.
 */
(function () {
  var ITEMS = [
    { id: 'all', label: 'All menu', href: '/menu', tone: 'mix', emoji: '🍽️', img: null },
    { id: 'frost', label: 'Frost', href: '/menu/frost', tone: 'frost', emoji: '❄️', img: '/img/stone.webp' },
    { id: 'flame', label: 'Flame', href: '/menu/flame', tone: 'flame', emoji: '🔥', img: '/img/pulao.webp' },
    { id: 'mix', label: 'Mix', href: '/mix', tone: 'mix', emoji: '⚡', img: null },
    { id: 'build', label: 'Build yours', href: '/build', tone: 'frost', emoji: '🍦', img: '/img/scoops.webp' },
    { id: 'stone', label: 'Stone ice cream', href: '/menu/frost', tone: 'frost', emoji: '🧊', img: '/img/stone.webp', hash: '' },
    { id: 'pulao', label: 'Pulao', href: '/menu/flame', tone: 'flame', emoji: '🍛', img: '/img/pulao.webp' },
    { id: 'street', label: 'Street food', href: '/menu/flame', tone: 'flame', emoji: '🌮', img: '/img/chaat.webp' },
    { id: 'drinks', label: 'Drinks', href: '/menu/frost', tone: 'frost', emoji: '🥤', img: '/img/shake.webp' },
    { id: 'combos', label: 'Combos', href: '/menu', tone: 'mix', emoji: '✨', img: '/img/gulab.webp' }
  ];

  var root, stage, toggle, bubbles = [], raf = 0, running = false, reduced = false;
  var W = 390, H = 844, padTop = 72, padBottom = 100, padSide = 8;
  // Keep clear of Ask Frosty (right) and cart strip (bottom)
  var avoidRight = 72, avoidBottom = 110;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function size() {
    W = window.innerWidth || 390;
    H = window.innerHeight || 844;
  }

  function build() {
    root = el('div', { id: 'ff-float-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pick your menu', hidden: 'true' });
    var head = el('div', { className: 'ff-float-head' },
      '<h2>Pick your menu</h2><p>Tap a bubble — they float like they’re in water.</p>');
    stage = el('div', { id: 'ff-float-stage' });
    var skip = el('button', { type: 'button', className: 'ff-float-skip' }, 'Skip — browse home');
    skip.addEventListener('click', function () {
      hide(true);
      var path = location.pathname || '/';
      try {
        var base = window.__FF_BASE__ || '';
        if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
      } catch (e) {}
      if (path !== '/') {
        if (window.__FF_NAV__) window.__FF_NAV__('/');
        else location.href = (window.__FF_ABS__ ? window.__FF_ABS__('/') : '/');
      }
    });
    root.appendChild(head); root.appendChild(stage); root.appendChild(skip);
    document.body.appendChild(root);

    toggle = el('button', { type: 'button', id: 'ff-float-toggle', 'aria-label': 'Open floating menu' },
      '<span class="orb"></span><span>Menus</span>');
    toggle.addEventListener('click', function () { show(false); });
    document.body.appendChild(toggle);

    ITEMS.forEach(function (item, i) {
      var b = el('button', {
        type: 'button',
        className: 'ff-bubble tone-' + item.tone,
        'data-ff-bubble': item.id,
        'aria-label': item.label
      });
      if (item.img) {
        b.innerHTML = '<img class="ic" alt="" src="' + item.img + '"/><span class="lb">' + item.label + '</span>';
      } else {
        b.innerHTML = '<span class="ic emoji">' + item.emoji + '</span><span class="lb">' + item.label + '</span>';
      }
      var r = 40 + (i % 3) * 4;
      b.style.width = b.style.height = (r * 2) + 'px';
      stage.appendChild(b);
      bubbles.push({
        el: b, item: item, r: r,
        x: 0, y: 0, vx: 0, vy: 0, paused: false, pauseUntil: 0
      });
      b.addEventListener('pointerdown', function () {
        var o = bubbles[i];
        o.paused = true; o.pauseUntil = performance.now() + 900;
        b.classList.add('is-paused');
      });
      b.addEventListener('click', function () {
        hide(true);
        if (window.__FF_NAV__) window.__FF_NAV__(item.href);
        else location.href = (window.__FF_ABS__ ? window.__FF_ABS__(item.href) : item.href);
      });
    });

    window.addEventListener('resize', function () { size(); layoutSeed(false); });
  }

  function layoutSeed(randomize) {
    size();
    var usableW = Math.max(120, W - padSide * 2 - avoidRight);
    var usableH = Math.max(120, H - padTop - Math.max(padBottom, avoidBottom));
    bubbles.forEach(function (o, i) {
      if (randomize || (!o.x && !o.y)) {
        o.x = padSide + o.r + Math.random() * (usableW - o.r * 2);
        o.y = padTop + o.r + Math.random() * (usableH - o.r * 2);
        var ang = Math.random() * Math.PI * 2;
        var spd = 0.25 + Math.random() * 0.35; // slow enough to tap
        o.vx = Math.cos(ang) * spd;
        o.vy = Math.sin(ang) * spd;
      }
      applyTransform(o, 0);
    });
  }

  function applyTransform(o, t) {
    // gentle bob + slight parallax by depth (radius)
    var bob = reduced ? 0 : Math.sin(t / 700 + o.r) * 3;
    var parallax = reduced ? 0 : Math.sin(t / 1100 + o.x * 0.01) * (o.r / 40);
    var x = o.x - o.r;
    var y = o.y - o.r + bob + parallax;
    o.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
  }

  function step(t) {
    if (!running) return;
    var maxX = W - padSide - avoidRight;
    var maxY = H - Math.max(padBottom, avoidBottom);
    var minX = padSide;
    var minY = padTop;

    // integrate
    for (var i = 0; i < bubbles.length; i++) {
      var o = bubbles[i];
      if (o.paused) {
        if (t > o.pauseUntil) { o.paused = false; o.el.classList.remove('is-paused'); }
        applyTransform(o, t); continue;
      }
      o.x += o.vx; o.y += o.vy;
      // edge bounce
      if (o.x - o.r < minX) { o.x = minX + o.r; o.vx = Math.abs(o.vx); }
      if (o.x + o.r > maxX) { o.x = maxX - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y - o.r < minY) { o.y = minY + o.r; o.vy = Math.abs(o.vy); }
      if (o.y + o.r > maxY) { o.y = maxY - o.r; o.vy = -Math.abs(o.vy); }
    }
    // soft collisions
    for (var a = 0; a < bubbles.length; a++) {
      for (var b = a + 1; b < bubbles.length; b++) {
        var A = bubbles[a], B = bubbles[b];
        if (A.paused || B.paused) continue;
        var dx = B.x - A.x, dy = B.y - A.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var min = A.r + B.r + 4;
        if (dist < min) {
          var nx = dx / dist, ny = dy / dist;
          var overlap = (min - dist) / 2;
          A.x -= nx * overlap; A.y -= ny * overlap;
          B.x += nx * overlap; B.y += ny * overlap;
          // exchange a bit of velocity along normal
          var dvx = A.vx - B.vx, dvy = A.vy - B.vy;
          var impact = dvx * nx + dvy * ny;
          if (impact > 0) {
            A.vx -= impact * nx * 0.5; A.vy -= impact * ny * 0.5;
            B.vx += impact * nx * 0.5; B.vy += impact * ny * 0.5;
          }
        }
      }
    }
    for (var k = 0; k < bubbles.length; k++) applyTransform(bubbles[k], t);
    raf = requestAnimationFrame(step);
  }

  function show(fromTree) {
    reduced = reducedMotion();
    root.hidden = false;
    root.classList.toggle('is-reduced', reduced);
    document.body.style.overflow = 'hidden';
    layoutSeed(true);
    running = !reduced;
    if (running) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    } else {
      // static grid: clear absolute transforms
      bubbles.forEach(function (o) { o.el.style.transform = ''; });
    }
    if (fromTree) root.dataset.fromTree = '1';
  }

  function hide(showToggle) {
    root.hidden = true;
    running = false;
    cancelAnimationFrame(raf);
    document.body.style.overflow = '';
    if (showToggle !== false) maybeShowToggle();
  }

  function maybeShowToggle() {
    // show on customer pages except when tree/float overlays are open
    var tree = document.getElementById('ff-tree-root');
    var treeOpen = tree && !tree.hidden;
    var floatOpen = root && !root.hidden;
    var path = location.pathname || '/';
    try {
      var base = window.__FF_BASE__ || '';
      if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    } catch (e) {}
    var ok = !treeOpen && !floatOpen && !/^\/(admin|login|signup)\/?$/.test(path);
    toggle.classList.toggle('is-on', ok);
  }

  function afterTheme() {
    // Called when tree finishes
    show(true);
  }

  function boot() {
    build();
    maybeShowToggle();
    window.addEventListener('ff:theme', function () { afterTheme(); });
    // If theme already set (session) and fresh load on home, optional: don't auto-open float
    // Toggle visibility on route-ish changes
    var _push = history.pushState;
    history.pushState = function () {
      _push.apply(this, arguments);
      setTimeout(maybeShowToggle, 50);
    };
    window.addEventListener('popstate', function () { setTimeout(maybeShowToggle, 50); });
    // Observe tree hide
    var tree = document.getElementById('ff-tree-root');
    if (tree) {
      var mo = new MutationObserver(function () { maybeShowToggle(); });
      mo.observe(tree, { attributes: true, attributeFilter: ['hidden'] });
    }
    window.FFFloatMenu = { show: show, hide: hide, items: ITEMS };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
