/**
 * Frost & Flame — once-per-session welcome video overlay.
 * Call FFIntro.run(done) or set data-autorun on #ffIntro.
 * ?intro=1 forces the intro; prefers-reduced-motion skips it.
 * Sound is on by default: try unmuted play(), fall back to muted,
 * then unmute on the first touch/click/keypress. A speaker toggle
 * remembers mute preference for the session.
 */
(function (global) {
  var KEY = 'ff_intro_seen';
  var SOUND_KEY = 'ff_intro_sound';
  var FADE_MS = 450;
  var SAFETY_MS = 20000;
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
  function getSoundPref() {
    try { return sessionStorage.getItem(SOUND_KEY); } catch (e) { return null; }
  }
  function setSoundPref(v) {
    try { sessionStorage.setItem(SOUND_KEY, v); } catch (e) {}
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
  function resetScroll() {
    try {
      try { window.scrollTo({ left: 0, top: 0, behavior: 'auto' }); }
      catch (e1) { window.scrollTo(0, 0); }
      document.documentElement.scrollLeft = 0;
      document.documentElement.scrollTop = 0;
      if (document.body) {
        document.body.scrollLeft = 0;
        document.body.scrollTop = 0;
      }
    } catch (e) {}
  }
  function applyMuted(video, muted, btn) {
    video.muted = !!muted;
    video.defaultMuted = !!muted;
    if (muted) video.setAttribute('muted', '');
    else video.removeAttribute('muted');
    if (!muted) {
      try { video.volume = 1; } catch (e) {}
    }
    if (btn) {
      btn.classList.toggle('is-muted', !!muted);
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    }
  }

  function run(done) {
    var finished = false;
    var el = document.getElementById('ffIntro');
    var safety = null;
    var armed = null;
    var armedHandler = null;

    function hideNow() {
      if (!el) return;
      el.hidden = true;
      el.classList.add('is-done');
      el.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.add('ff-intro-skip');
      document.documentElement.classList.remove('ff-intro-open');
      document.documentElement.style.removeProperty('overflow');
      try { document.body.style.removeProperty('overflow'); } catch (e) {}
      resetScroll();
    }
    function disarm() {
      if (!armed) return;
      armed.forEach(function (t) {
        document.removeEventListener(t, armedHandler, true);
      });
      armed = null;
    }
    function finish() {
      if (finished) return;
      finished = true;
      setSeen();
      if (safety) clearTimeout(safety);
      disarm();
      document.documentElement.classList.remove('ff-intro-open');
      document.documentElement.classList.add('ff-intro-skip');
      document.documentElement.style.removeProperty('overflow');
      try { document.body.style.removeProperty('overflow'); } catch (e) {}
      resetScroll();
      if (!el) { if (done) done(); return; }
      el.classList.add('is-done');
      if (done) done();
      setTimeout(function () {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
        var v = el.querySelector('video');
        if (v) { try { v.pause(); } catch (e) {} }
        resetScroll();
      }, FADE_MS);
    }
    function bumpSafety() {
      if (safety) clearTimeout(safety);
      safety = setTimeout(finish, SAFETY_MS);
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
    document.documentElement.classList.add('ff-intro-open');
    document.documentElement.style.overflow = 'hidden';
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
    resetScroll();

    var skip = el.querySelector('#ffIntroSkip, .ff-intro-skip');
    if (skip) {
      skip.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      });
    }

    var soundBtn = el.querySelector('#ffIntroSound, .ff-intro-sound');

    function unmuteFromGesture() {
      if (finished || !video) return;
      applyMuted(video, false, soundBtn);
      setSoundPref('on');
      try { video.currentTime = 0; } catch (e) {}
      bumpSafety();
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    function armAutoUnmute() {
      if (getSoundPref() === 'off') return;
      if (armed) return;
      armedHandler = function (e) {
        if (finished) return;
        if (e && e.target && e.target.closest) {
          if (e.target.closest('#ffIntroSkip, .ff-intro-skip')) return;
          if (e.target.closest('#ffIntroSound, .ff-intro-sound')) return;
        }
        if (getSoundPref() === 'off') return;
        if (video && !video.muted) { disarm(); return; }
        unmuteFromGesture();
        disarm();
      };
      armed = ['pointerdown', 'touchstart', 'click', 'keydown'];
      armed.forEach(function (t) {
        document.addEventListener(t, armedHandler, true);
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!video) return;
        var nextMuted = !video.muted;
        applyMuted(video, nextMuted, soundBtn);
        setSoundPref(nextMuted ? 'off' : 'on');
        if (nextMuted) {
          disarm();
        } else {
          disarm();
          try { video.currentTime = 0; } catch (err) {}
          bumpSafety();
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        }
      });
    }

    bumpSafety();

    if (!video) {
      setTimeout(finish, FAIL_MS);
      return;
    }
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.addEventListener('ended', finish);
    video.addEventListener('error', function () { setTimeout(finish, FAIL_MS); });

    if (getSoundPref() === 'off') {
      applyMuted(video, true, soundBtn);
      var p0 = video.play();
      if (p0 && p0.catch) p0.catch(function () { setTimeout(finish, FAIL_MS); });
      return;
    }
    applyMuted(video, false, soundBtn);
    var play = video.play();
    if (play && typeof play.then === 'function') {
      play.then(function () {}).catch(function () {
        applyMuted(video, true, soundBtn);
        armAutoUnmute();
        var p2 = video.play();
        if (p2 && p2.catch) p2.catch(function () { setTimeout(finish, FAIL_MS); });
      });
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
