/**
 * Home chapters in a product-page rhythm.
 * Copy and prices come from the menu file. No video elements.
 */
(function () {
  'use strict';
  if (window.FFStage) return;

  var FEATURES = [
    { id: 'signature-stone', kicker: 'Cold', tone: 'dark' },
    { id: 'mutton-pulao', kicker: 'Hot', tone: 'light' },
    { id: 'pani-puri', kicker: 'Street', tone: 'dark' },
    { id: 'masala-chai', kicker: 'Warm', tone: 'light' }
  ];

  var menu = null;
  var byId = {};

  function abs(p) {
    try { return window.__FF_ABS__ ? window.__FF_ABS__(p) : p; } catch (e) { return p; }
  }
  function withBase(p) {
    try { return window.__FF_WITH_BASE__ ? window.__FF_WITH_BASE__(p) : abs(p); } catch (e) { return p; }
  }
  function appPath() {
    var path = location.pathname || '/';
    var base = window.__FF_BASE__ || '';
    if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    return path;
  }
  function money(n) {
    return '£' + Number(n).toFixed(2);
  }
  function priceLine(item) {
    if (!item) return '';
    if (item.price != null && item.price !== '') return money(item.price);
    var rows = (item.sizes && item.sizes.length) ? item.sizes : (item.size_plan || []);
    var priced = rows.filter(function (s) { return s && s.price != null && s.price !== ''; });
    if (!priced.length) return '';
    return priced[0].name + ' ' + money(priced[0].price);
  }

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function watch(root) {
    if (reduced() || !('IntersectionObserver' in window)) {
      root.querySelectorAll('.ff-reveal').forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    root.querySelectorAll('.ff-reveal').forEach(function (n) { io.observe(n); });
  }

  function openDish(id) {
    try { sessionStorage.setItem('ff_jump', id); } catch (e) {}
    if (window.__FF_NAV__) window.__FF_NAV__('/menu');
    else location.href = abs('/menu');
  }

  function build(main) {
    if (document.getElementById('ff-stage') || !menu) return;
    var hero = main.querySelector('[data-testid="hero"]');
    var stage = document.createElement('div');
    stage.id = 'ff-stage';
    stage.className = 'ff-stage';
    FEATURES.forEach(function (spec, index) {
      var item = byId[spec.id];
      if (!item) return;
      var section = document.createElement('section');
      section.className = 'ff-chapter ff-chapter--' + spec.tone + (index % 2 ? ' ff-chapter--flip' : '') + ' ff-reveal';
      section.setAttribute('data-testid', 'ff-chapter-' + spec.id);
      var photo = item.image || item.video_poster || '';
      var price = priceLine(item);
      section.innerHTML =
        '<div class="ff-chapter-copy">' +
          '<p class="ff-chapter-kicker">' + spec.kicker + '</p>' +
          '<h2>' + item.name + '</h2>' +
          '<p class="ff-chapter-dek">' + (item.description || '') + '</p>' +
          (price ? '<p class="ff-chapter-price">' + price + '</p>' : '') +
          '<button type="button" data-ff-open="' + spec.id + '">See it on the menu</button>' +
        '</div>' +
        '<div class="ff-chapter-visual">' +
          (photo ? '<img alt="" src="' + withBase(photo) + '">' : '<span class="ff-media-ph">Frost &amp; Flame</span>') +
        '</div>';
      stage.appendChild(section);
    });
    stage.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ff-open]');
      if (!b) return;
      openDish(b.getAttribute('data-ff-open'));
    });
    if (hero && hero.parentNode) hero.parentNode.insertBefore(stage, hero.nextSibling);
    else main.appendChild(stage);
    watch(stage);
  }

  function jump() {
    var id = '';
    try { id = sessionStorage.getItem('ff_jump') || ''; } catch (e) {}
    if (!id || appPath().indexOf('/menu') !== 0) return;
    var card = document.querySelector('[data-testid="item-card-' + id + '"]');
    if (!card) return;
    try { sessionStorage.removeItem('ff_jump'); } catch (e) {}
    try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e2) { card.scrollIntoView(true); }
  }

  function tick() {
    var path = appPath();
    if (path === '/' && menu) {
      var main = document.querySelector('main');
      if (main) build(main);
    }
    if (path.indexOf('/menu') === 0) jump();
  }

  function boot() {
    fetch(abs('/api/menu.json'), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        menu = data;
        (data.items || []).forEach(function (it) { if (it && it.id) byId[it.id] = it; });
        tick();
        setInterval(tick, 900);
      })
      .catch(function () {});
  }

  window.FFStage = { tick: tick };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
