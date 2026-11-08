/**
 * Menu presentation for the themes preview.
 * Does not change prices, invent dishes, or guess allergens.
 * Videos play only for stone ice cream and pulao that already have footage.
 */
(function () {
  'use strict';
  if (window.FFMenuReady) return;

  var ALLERGENS = [
    ['celery', 'Celery'],
    ['gluten', 'Cereals containing gluten'],
    ['crustaceans', 'Crustaceans'],
    ['eggs', 'Eggs'],
    ['fish', 'Fish'],
    ['lupin', 'Lupin'],
    ['milk', 'Milk'],
    ['molluscs', 'Molluscs'],
    ['mustard', 'Mustard'],
    ['nuts', 'Tree nuts'],
    ['peanuts', 'Peanuts'],
    ['sesame', 'Sesame'],
    ['soya', 'Soya'],
    ['sulphites', 'Sulphites']
  ];
  var ALLERGEN_LABEL = {};
  ALLERGENS.forEach(function (pair) { ALLERGEN_LABEL[pair[0]] = pair[1]; });

  var DIET = { V: 'Veg', VG: 'Vegan', N: 'Nuts', S: 'Spicy', SS: 'Extra hot' };
  var PICKS = ['signature-stone', 'gongura-chicken-pulao', 'chicken-65', 'pani-puri'];
  var STAR = {
    'create-your-own-stone': 1, 'signature-stone': 1, 'desi-stone': 1,
    'masala-chai-stone': 1, 'chilli-mango-stone': 1,
    'gongura-chicken-pulao': 1, 'gongura-mutton-pulao': 1, 'veg-pulao': 1,
    'paneer-pulao': 1, 'chicken-pulao': 1, 'chicken-65-pulao': 1, 'mutton-pulao': 1
  };
  var GROUPS = [
    { id: 'picks', label: 'Picks' },
    { id: 'frost', label: 'Frost' },
    { id: 'flame', label: 'Flame' },
    { id: 'warm', label: 'Warm-ups' },
    { id: 'combos', label: 'Combos' }
  ];

  var menu = null;
  var byId = {};
  var upsellLock = false;

  function abs(p) {
    try { return window.__FF_ABS__ ? window.__FF_ABS__(p) : p; } catch (e) { return p; }
  }
  function withBase(p) {
    if (!p) return p;
    try { return window.__FF_WITH_BASE__ ? window.__FF_WITH_BASE__(p) : abs(p); } catch (e) { return p; }
  }
  function money(n) {
    return '£' + Number(n).toFixed(2);
  }
  function appPath() {
    var path = location.pathname || '/';
    var base = window.__FF_BASE__ || '';
    if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    return path;
  }
  function onMenu() {
    return appPath().indexOf('/menu') === 0;
  }

  function groupOf(item) {
    if (!item) return 'flame';
    if (item.id === 'warm-gulab-jamun' || item.category === 'hot') return 'warm';
    if (item.category === 'combos') return 'combos';
    if (item.category === 'stone' || item.category === 'shakes' || item.category === 'smoothies' || item.category === 'cold' || item.id === 'gulab-jamun-ice-cream' || item.id === 'masala-chai-stone' || item.id === 'chilli-mango-stone') return 'frost';
    return 'flame';
  }

  function ownerAllergens(item) {
    var sheet = menu && menu.settings && menu.settings.allergen_owner;
    var map = sheet && sheet.by_dish;
    if (map && Object.prototype.hasOwnProperty.call(map, item.id)) return map[item.id];
    return null;
  }

  function containsLine(item) {
    var owned = ownerAllergens(item);
    if (owned === 'ask staff' || owned === 'ask-staff') return 'Allergen info: ask staff';
    var list = Array.isArray(owned) ? owned : (item.allergens || []);
    if (!list.length) return 'Allergen info: ask staff';
    var names = list.map(function (key) { return ALLERGEN_LABEL[key] || key; });
    return 'Contains: ' + names.join(', ');
  }

  function photoOf(item) {
    if (item.image) return item.image;
    if (item.video_poster) return item.video_poster;
    var poster = '/dish/' + item.id + '/' + item.id + '-poster.webp';
    if (item.id === 'soft-drink' || item.id === 'water') return poster;
    return '';
  }

  function load() {
    if (menu) return Promise.resolve(menu);
    return fetch(abs('/api/menu.json'), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        menu = data;
        (data.items || []).forEach(function (it) { if (it && it.id) byId[it.id] = it; });
        return data;
      })
      .catch(function () { menu = { items: [], settings: {} }; return menu; });
  }

  function cardId(article) {
    var id = article.getAttribute('data-testid') || '';
    return id.indexOf('item-card-') === 0 ? id.slice('item-card-'.length) : '';
  }

  function ensureNotice(main) {
    if (document.getElementById('ff-fsa')) return;
    var title = main.querySelector('[data-testid="menu-title"], h1');
    var note = document.createElement('div');
    note.id = 'ff-fsa';
    note.className = 'ff-fsa';
    note.innerHTML =
      '<p data-testid="ff-allergen-notice">Ask us about allergens. Tell a member of staff before you order — we will check the 14 major allergens with the kitchen.</p>' +
      '<button type="button" data-testid="ff-allergen-open">Allergen info</button>';
    if (title && title.parentNode) title.parentNode.insertBefore(note, title.nextSibling);
    else main.insertBefore(note, main.firstChild);
  }

  function ensurePicks(main) {
    if (!menu || document.getElementById('ff-picks')) return;
    var section = document.createElement('section');
    section.id = 'ff-picks';
    section.setAttribute('data-testid', 'ff-picks');
    section.innerHTML = '<h2 class="ff-picks-title">Bestsellers / Chef’s picks</h2><div class="ff-picks-row"></div>';
    var row = section.querySelector('.ff-picks-row');
    PICKS.forEach(function (id) {
      var item = byId[id];
      if (!item) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ff-pick';
      btn.setAttribute('data-testid', 'ff-pick-' + id);
      var photo = photoOf(item);
      btn.innerHTML =
        '<span class="ff-pick-media">' + (photo ? '<img alt="" src="' + withBase(photo) + '">' : '<span class="ff-media-ph">Frost &amp; Flame</span>') + '</span>' +
        '<span class="ff-pick-name">' + item.name + '</span>' +
        '<span class="ff-pick-price">' + (item.price != null ? money(item.price) : (item.sizes && item.sizes[0] && item.sizes[0].price != null ? money(item.sizes[0].price) : 'Unpriced')) + '</span>';
      btn.addEventListener('click', function () {
        var open = document.querySelector('[data-testid="qv-open-' + id + '"], [data-testid="qv-title-' + id + '"]');
        if (open) open.click();
      });
      row.appendChild(btn);
    });
    var notice = document.getElementById('ff-fsa');
    if (notice && notice.parentNode) notice.parentNode.insertBefore(section, notice.nextSibling);
    else main.insertBefore(section, main.firstChild);
  }

  function ensureBar() {
    var nav = document.querySelector('[aria-label="Menu categories"]');
    if (!nav || nav.getAttribute('data-ff-bar') === '1') return;
    nav.setAttribute('data-ff-bar', '1');
    Array.prototype.slice.call(nav.querySelectorAll('a')).forEach(function (a) { a.hidden = true; a.setAttribute('data-ff-native-chip', '1'); });
    GROUPS.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('data-ff-group-jump', g.id);
      b.setAttribute('data-testid', 'ff-cat-' + g.id);
      b.textContent = g.label;
      b.addEventListener('click', function () {
        var target = g.id === 'picks'
          ? document.getElementById('ff-picks')
          : document.querySelector('article[data-ff-group="' + g.id + '"]');
        if (target) {
          try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { target.scrollIntoView(true); }
        }
        Array.prototype.forEach.call(nav.querySelectorAll('[data-ff-group-jump]'), function (n) {
          n.classList.toggle('is-active', n === b);
        });
      });
      nav.appendChild(b);
    });
  }

  function sizeList(item) {
    if (item.size_plan && item.size_plan.length) return item.size_plan;
    if (item.sizes && item.sizes.length) return item.sizes;
    return [];
  }

  function enhanceCard(article) {
    var id = cardId(article);
    var item = byId[id];
    if (!item) return;
    article.setAttribute('data-ff-group', groupOf(item));
    var frame = article.querySelector('.food-img, .food-tile');
    if (frame && frame.getAttribute('data-ff-media') !== '1') {
      frame.setAttribute('data-ff-media', '1');
      frame.classList.add('ff-media-frame');
      var photo = photoOf(item);
      var img = frame.querySelector('img');
      if (!img && photo) {
        img = document.createElement('img');
        img.alt = item.name || '';
        img.src = withBase(photo);
        frame.insertBefore(img, frame.firstChild);
      }
      if (!photo && !img) {
        frame.classList.add('is-placeholder');
        if (!frame.querySelector('.ff-media-ph')) {
          var ph = document.createElement('span');
          ph.className = 'ff-media-ph';
          ph.textContent = 'Frost & Flame';
          frame.appendChild(ph);
        }
      }
      Array.prototype.forEach.call(frame.querySelectorAll('video'), function (video) {
        if (STAR[id]) {
          video.classList.add('ff-media-video');
          video.setAttribute('playsinline', '');
          video.muted = true;
        } else {
          video.setAttribute('data-ff-video-hidden', '1');
          try { video.pause(); } catch (e) {}
        }
      });
      if (STAR[id] && !frame.querySelector('video')) {
        var video = document.createElement('video');
        video.className = 'ff-media-video';
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.preload = 'metadata';
        video.setAttribute('aria-hidden', 'true');
        video.src = withBase('/dish/' + id + '/' + id + '-loop.mp4');
        frame.appendChild(video);
      }
      if (STAR[id] && !frame.querySelector('.ff-watch')) {
        var badge = document.createElement('span');
        badge.className = 'ff-watch';
        badge.textContent = 'Watch';
        frame.appendChild(badge);
      }
    }
    if (!article.querySelector('.ff-tags')) {
      var tags = document.createElement('p');
      tags.className = 'ff-tags';
      (item.diet || []).forEach(function (code) {
        if (!DIET[code]) return;
        var s = document.createElement('span');
        s.textContent = DIET[code];
        tags.appendChild(s);
      });
      var host = article.querySelector('h3');
      if (host && host.parentNode) host.parentNode.insertBefore(tags, host.nextSibling);
    }
    if (!article.querySelector('.ff-contains')) {
      var line = document.createElement('p');
      line.className = 'ff-contains';
      line.setAttribute('data-testid', 'ff-contains-' + id);
      line.textContent = containsLine(item);
      var desc = article.querySelector('p');
      if (desc && desc.parentNode) desc.parentNode.appendChild(line);
    }
    if (!article.querySelector('.ff-sizes') && sizeList(item).length) {
      var sizes = document.createElement('div');
      sizes.className = 'ff-sizes';
      sizes.setAttribute('data-testid', 'ff-sizes-' + id);
      sizeList(item).forEach(function (s) {
        var bit = document.createElement('span');
        var priced = s.price != null && s.price !== '';
        bit.className = 'ff-size' + (priced ? '' : ' is-unpriced');
        bit.textContent = s.name + ' · ' + (priced ? money(s.price) : 'Unpriced');
        if (!priced) {
          bit.setAttribute('aria-disabled', 'true');
          bit.title = 'Not for sale until this size has a price';
        }
        sizes.appendChild(bit);
      });
      var add = article.querySelector('[data-testid^="add-"], button.btn-flame');
      if (add && add.parentNode) add.parentNode.insertBefore(sizes, add);
      else article.appendChild(sizes);
    }
  }

  function ensureSheet() {
    if (document.getElementById('ff-allergen-sheet')) return;
    var sheet = document.createElement('div');
    sheet.id = 'ff-allergen-sheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Allergen information');
    sheet.innerHTML =
      '<div class="ff-all-panel">' +
        '<h2>Allergen information</h2>' +
        '<p class="ff-fsa-lead">Ask us about allergens. This sheet lists only what is already recorded. It is not a guess. If a dish says “ask staff”, the kitchen has not confirmed it yet.</p>' +
        '<p class="ff-all-14"></p>' +
        '<div class="ff-all-list" data-testid="ff-allergen-list"></div>' +
        '<button type="button" class="ff-all-close" data-testid="ff-allergen-close">Close</button>' +
      '</div>';
    sheet.querySelector('.ff-all-14').textContent = 'The 14 major allergens: ' + ALLERGENS.map(function (p) { return p[1]; }).join(', ') + '.';
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.closest('[data-testid="ff-allergen-close"]')) {
        sheet.hidden = true;
        document.body.style.overflow = '';
      }
    });
    document.body.appendChild(sheet);
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('[data-testid="ff-allergen-open"]')) return;
      var list = sheet.querySelector('.ff-all-list');
      list.innerHTML = '';
      (menu && menu.items || []).forEach(function (item) {
        var row = document.createElement('p');
        row.textContent = item.name + ' — ' + containsLine(item);
        list.appendChild(row);
      });
      sheet.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  }

  function showUpsell(article, item) {
    if (upsellLock || !item || groupOf(item) !== 'flame') return;
    if (article.querySelector('.ff-upsell')) return;
    upsellLock = true;
    var box = document.createElement('div');
    box.className = 'ff-upsell';
    box.setAttribute('data-testid', 'ff-upsell');
    box.innerHTML =
      '<p>Add a chai or a stone ice cream with that?</p>' +
      '<button type="button" data-upsell="masala-chai">Masala chai</button>' +
      '<button type="button" data-upsell="signature-stone">Signature stone</button>' +
      '<button type="button" data-upsell="dismiss">Not now</button>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-upsell]');
      if (!b) return;
      var which = b.getAttribute('data-upsell');
      if (which === 'dismiss') { box.remove(); return; }
      var open = document.querySelector('[data-testid="add-' + which + '"], [data-testid="qv-open-' + which + '"]');
      if (open) open.click();
      box.remove();
    });
    article.appendChild(box);
    setTimeout(function () { upsellLock = false; }, 600);
  }

  function tick() {
    if (!onMenu() || !menu) return;
    var main = document.querySelector('main') || document.getElementById('root');
    if (!main) return;
    ensureNotice(main);
    ensurePicks(main);
    ensureBar();
    ensureSheet();
    document.querySelectorAll('article[data-testid^="item-card-"]').forEach(enhanceCard);
  }

  function boot() {
    document.addEventListener('click', function (e) {
      var add = e.target && e.target.closest && e.target.closest('[data-testid^="add-"]');
      if (!add) return;
      var article = add.closest('article');
      if (!article) return;
      var item = byId[cardId(article)];
      setTimeout(function () { showUpsell(article, item); }, 30);
    }, true);
    load().then(function () {
      tick();
      setInterval(tick, 800);
    });
  }

  window.FFMenuReady = { tick: tick, groupOf: groupOf, containsLine: containsLine };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
