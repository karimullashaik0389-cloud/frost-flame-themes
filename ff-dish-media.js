/**
 * Preview dish media: muted one-shot background video for items that declare
 * video / video_poster in /api/menu (iOS Safari: playsinline + muted + autoplay).
 * Plays once, then holds the last frame (no loop).
 */
(function () {
  'use strict';
  if (window.FFDishMedia) return;

  var byId = {};
  var byName = {};
  var loaded = false;

  function withBase(p) {
    if (!p) return p;
    if (typeof window.__FF_WITH_BASE__ === 'function') return window.__FF_WITH_BASE__(p);
    var base = window.__FF_BASE__ || '';
    if (p.charAt(0) === '/' && base && p.indexOf(base) !== 0) return base.replace(/\/$/, '') + p;
    return p;
  }

  function loadMenu() {
    if (loaded) return Promise.resolve();
    var url = (typeof window.__FF_ABS__ === 'function') ? window.__FF_ABS__('/api/menu') : withBase('/api/menu');
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.items || []).forEach(function (it) {
          if (!it || !it.id) return;
          byId[it.id] = it;
          if (it.name) byName[String(it.name).toLowerCase()] = it;
        });
        loaded = true;
      })
      .catch(function () { loaded = true; });
  }

  function findItemFromQuickView(qv) {
    var titleEl = qv.querySelector('h1, h2, [class*="title"], .h1');
    var title = titleEl ? String(titleEl.textContent || '').trim().toLowerCase() : '';
    if (title && byName[title]) return byName[title];
    var hit = null;
    Object.keys(byId).forEach(function (id) {
      var n = byId[id].name ? String(byId[id].name).toLowerCase() : '';
      if (title && n && title.indexOf(n) === 0) hit = byId[id];
    });
    if (hit) return hit;
    var img = qv.querySelector('img');
    if (img && img.getAttribute('alt')) {
      var alt = String(img.getAttribute('alt') || '').toLowerCase();
      if (byName[alt]) return byName[alt];
    }
    // data-testid on qv-add / nearby
    var add = document.querySelector('[data-testid^="add-"].opacity-50, [data-testid="qv-add-btn"]');
    return null;
  }

  function findItemLoose(qv) {
    var text = (qv.innerText || '').slice(0, 400).toLowerCase();
    var best = null;
    Object.keys(byId).forEach(function (id) {
      var it = byId[id];
      if (!it.video) return;
      var n = String(it.name || '').toLowerCase();
      if (n && text.indexOf(n) !== -1) best = it;
    });
    return best;
  }

  var STAR = {
    'create-your-own-stone': 1, 'signature-stone': 1, 'desi-stone': 1,
    'masala-chai-stone': 1, 'chilli-mango-stone': 1,
    'gongura-chicken-pulao': 1, 'gongura-mutton-pulao': 1, 'veg-pulao': 1,
    'paneer-pulao': 1, 'chicken-pulao': 1, 'chicken-65-pulao': 1, 'mutton-pulao': 1
  };

  function ensureVideo(qv, item) {
    if (!item || !item.video || !STAR[item.id]) return;
    if (qv.querySelector('.ff-dish-video')) return;

    var mediaHost =
      qv.querySelector('[data-testid="qv-image"], .qv-image, .ff-panel img') ||
      qv.querySelector('img');
    var wrap = document.createElement('div');
    wrap.className = 'ff-dish-video';
    wrap.setAttribute('data-ff-dish-id', item.id);

    var poster = withBase(item.video_poster || item.image || '');
    var src = withBase(item.video);

    var video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('autoplay', '');
    video.autoplay = true;
    video.preload = 'metadata';
    video.setAttribute('poster', poster || '');
    // NO loop — play once, hold last frame
    video.loop = false;
    video.removeAttribute('loop');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.setAttribute('aria-hidden', 'true');
    video.playsInline = true;

    var source = document.createElement('source');
    source.src = src;
    source.type = 'video/mp4';
    video.appendChild(source);

    wrap.appendChild(video);

    if (mediaHost && mediaHost.parentNode) {
      var parent = mediaHost.parentNode;
      parent.classList.add('ff-dish-media-host');
      // Insert video behind the still image
      parent.insertBefore(wrap, mediaHost);
      mediaHost.classList.add('ff-dish-still');
    } else {
      qv.insertBefore(wrap, qv.firstChild);
    }

    function holdLastFrame() {
      try {
        if (video.duration && isFinite(video.duration)) {
          video.currentTime = Math.max(0, video.duration - 0.05);
        }
        video.pause();
      } catch (e) {}
    }

    video.addEventListener('ended', holdLastFrame);
    video.addEventListener('playing', function () {
      wrap.classList.add('is-playing');
      try { qv.classList.add('ff-dish-video-on'); } catch (e) {}
    });
    video.addEventListener('error', function () {
      wrap.classList.add('is-failed');
    });

    // iOS often needs an explicit play() after muted+playsinline
    var tryPlay = function () {
      var p = video.play();
      if (p && typeof p.then === 'function') {
        p.catch(function () { /* autoplay blocked — poster remains */ });
      }
    };
    if (video.readyState >= 2) tryPlay();
    else video.addEventListener('loadeddata', tryPlay, { once: true });
    setTimeout(tryPlay, 300);
  }

  function enhance() {
    var qv = document.querySelector('[data-testid="quick-view"]');
    if (!qv || qv.hidden || getComputedStyle(qv).display === 'none') return;
    var item = findItemFromQuickView(qv) || findItemLoose(qv);
    if (item && item.video) ensureVideo(qv, item);
  }

  function boot() {
    loadMenu().then(function () {
      enhance();
      try {
        var mo = new MutationObserver(function () { enhance(); });
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      } catch (e) {}
      document.addEventListener('click', function () { setTimeout(enhance, 200); }, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FFDishMedia = { enhance: enhance, reload: function () { loaded = false; return loadMenu(); } };
})();
