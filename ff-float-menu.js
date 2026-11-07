/**
 * Floating bubble menu — fewer distinct bubbles, deep-link to category sections.
 * Does not auto-open after theme pick (entry is skippable / remembered).
 */
(function () {
  var ITEMS = [
    { id: 'all', label: 'All menu', href: '/menu', hash: '', tone: 'mix', emoji: '🍽️', img: null },
    { id: 'frost', label: 'Frost', href: '/menu/frost', hash: '', tone: 'frost', emoji: '❄️', img: '/img/stone.webp' },
    { id: 'flame', label: 'Flame', href: '/menu/flame', hash: '', tone: 'flame', emoji: '🔥', img: '/img/mutton_pulav.webp' },
    { id: 'mix', label: 'Mix', href: '/mix', hash: '', tone: 'mix', emoji: '⚡', img: null },
    { id: 'pulao', label: 'Pulao', href: '/menu', hash: 'cat-pulao', tone: 'flame', emoji: '🍛', img: '/img/mutton_pulav.webp' },
    { id: 'street', label: 'Street food', href: '/menu', hash: 'cat-street', tone: 'flame', emoji: '🌮', img: '/img/chaat.webp' },
    { id: 'drinks', label: 'Drinks', href: '/menu', hash: 'cat-shakes', tone: 'frost', emoji: '🥤', img: '/img/shake.webp' },
    { id: 'combos', label: 'Combos', href: '/menu', hash: 'cat-combos', tone: 'mix', emoji: '✨', img: '/img/gulab.webp' }
  ];

  var root, stage, toggle, bubbles = [], raf = 0, running = false, reduced = false;
  var W = 390, H = 844, padTop = 72, padBottom = 100, padSide = 8;
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

  function goTo(item) {
    hide(true);
    var target = item.href + (item.hash ? ('#' + item.hash) : '');
    if (window.__FF_NAV__) window.__FF_NAV__(target);
    else location.href = (window.__FF_ABS__ ? window.__FF_ABS__(item.href) : item.href) + (item.hash ? ('#' + item.hash) : '');
    if (item.hash) {
      setTimeout(function () {
        var el = document.getElementById(item.hash);
        if (el) try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      }, 450);
    }
  }

  function build() {
    root = el('div', { id: 'ff-float-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pick your menu', hidden: 'true' });
    var head = el('div', { className: 'ff-float-head' },
      '<h2>Pick your menu</h2><p>Tap a bubble to jump in.</p>');
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
        var imgSrc = (window.__FF_ABS__ ? window.__FF_ABS__(item.img) : item.img);
        b.innerHTML = '<img class="ic" alt="" src="' + imgSrc + '"/><span class="lb">' + item.label + '</span>';
      } else {
        b.innerHTML = '<span class="ic emoji">' + item.emoji + '</span><span class="lb">' + item.label + '</span>';
      }
      var r = 42 + (i % 2) * 4;
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
      b.addEventListener('click', function () { goTo(item); });
    });

    window.addEventListener('resize', function () { size(); layoutSeed(false); });
  }

  function layoutSeed(randomize) {
    size();
    var usableW = Math.max(120, W - padSide * 2 - avoidRight);
    var usableH = Math.max(120, H - padTop - Math.max(padBottom, avoidBottom));
    bubbles.forEach(function (o) {
      if (randomize || (!o.x && !o.y)) {
        o.x = padSide + o.r + Math.random() * (usableW - o.r * 2);
        o.y = padTop + o.r + Math.random() * (usableH - o.r * 2);
        var ang = Math.random() * Math.PI * 2;
        var spd = 0.22 + Math.random() * 0.28;
        o.vx = Math.cos(ang) * spd;
        o.vy = Math.sin(ang) * spd;
      }
      applyTransform(o, 0);
    });
  }

  function applyTransform(o, t) {
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

    for (var i = 0; i < bubbles.length; i++) {
      var o = bubbles[i];
      if (o.paused) {
        if (t > o.pauseUntil) { o.paused = false; o.el.classList.remove('is-paused'); }
        applyTransform(o, t); continue;
      }
      o.x += o.vx; o.y += o.vy;
      if (o.x - o.r < minX) { o.x = minX + o.r; o.vx = Math.abs(o.vx); }
      if (o.x + o.r > maxX) { o.x = maxX - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y - o.r < minY) { o.y = minY + o.r; o.vy = Math.abs(o.vy); }
      if (o.y + o.r > maxY) { o.y = maxY - o.r; o.vy = -Math.abs(o.vy); }
    }
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
    if (toggle) {
      toggle.classList.remove('is-on');
      toggle.hidden = true;
      toggle.style.display = 'none';
    }
  }

  function afterTheme(ev) {
    // Do not auto-open after entry — keeps clicks instant. Browse menus via More.
    var detail = (ev && ev.detail) || {};
    if (detail.skipFloat || detail.restored) return;
  }

  function boot() {
    build();
    maybeShowToggle();
    window.addEventListener('ff:theme', afterTheme);
    var _push = history.pushState;
    history.pushState = function () {
      _push.apply(this, arguments);
      setTimeout(maybeShowToggle, 50);
    };
    window.addEventListener('popstate', function () { setTimeout(maybeShowToggle, 50); });
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
