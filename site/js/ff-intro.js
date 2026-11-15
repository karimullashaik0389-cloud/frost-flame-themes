/**
 * Frost & Flame — once-per-session welcome video overlay.
 * Call FFIntro.run(done) or set data-autorun on #ffIntro.
 * ?intro=1 forces the intro; prefers-reduced-motion skips it.
 */
(function (global) {
  var KEY = 'ff_intro_seen';
  var FADE_MS = 450;
  var SAFETY_MS = 10000;
  var FAIL_MS = 900;

  function reduced() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function forceIntro() {
    try { return new URLSearchParams(location.search).get('intro') === '1'; } catch (e) { return false; }
  }
  function getSeen() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function setSeen() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }
  function absUrl(u) {
    if (!u) return u;
    if (/^https?:\/\//i.test(u) || u.charAt(0) === 'data:') return u;
    if (typeof global.__FF_ABS__ === 'function' && u.charAt(0) === '/') return global.__FF_ABS__(u);
    return u;
  }
  function prepareSources(el) {
    var v = el.querySelector('video');
    if (!v) return v;
    var poster = v.getAttribute('data-poster') || v.getAttribute('poster');
    if (poster) v.setAttribute('poster', absUrl(poster));
    var sources = el.querySelectorAll('source[data-src]');
    for (var i = 0; i < sources.length; i++) {
      sources[i].src = absUrl(sources[i].getAttribute('data-src'));
    }
    return v;
  }

  function run(done) {
    var finished = false;
    var el = document.getElementById('ffIntro');
    var safety = null;

    function hideNow() {
      if (!el) return;
      el.hidden = true;
      el.classList.add('is-done');
      el.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.add('ff-intro-skip');
    }

    function finish() {
      if (finished) return;
      finished = true;
      setSeen();
      if (safety) clearTimeout(safety);
      if (!el) { if (done) done(); return; }
      el.classList.add('is-done');
      document.documentElement.classList.add('ff-intro-skip');
      document.documentElement.style.removeProperty('overflow');
      if (done) done();
      setTimeout(function () {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
        var v = el.querySelector('video');
        if (v) { try { v.pause(); } catch (e) {} }
      }, FADE_MS);
    }

    if (reduced() && !forceIntro()) {
      setSeen();
      hideNow();
      if (done) done();
      return;
    }
    if (getSeen() && !forceIntro()) {
      hideNow();
      if (done) done();
      return;
    }
    if (!el) { if (done) done(); return; }

    var video = prepareSources(el);
    el.hidden = false;
    el.classList.remove('is-done');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.remove('ff-intro-skip');
    document.documentElement.style.overflow = 'hidden';

    var skip = el.querySelector('#ffIntroSkip, .ff-intro-skip');
    if (skip) {
      skip.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      });
    }
    el.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#ffIntroSkip, .ff-intro-skip')) return;
      finish();
    });

    safety = setTimeout(finish, SAFETY_MS);

    if (!video) {
      setTimeout(finish, FAIL_MS);
      return;
    }
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.addEventListener('ended', finish);
    video.addEventListener('error', function () { setTimeout(finish, FAIL_MS); });

    var play = video.play();
    if (play && typeof play.then === 'function') {
      play.then(function () {}).catch(function () { setTimeout(finish, FAIL_MS); });
    }
  }

  global.FFIntro = { run: run, key: KEY };

  function boot() {
    var el = document.getElementById('ffIntro');
    if (el && el.hasAttribute('data-autorun')) run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
