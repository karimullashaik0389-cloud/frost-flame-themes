/**
 * Frost & Flame — once-per-session welcome video overlay.
 * Call FFIntro.run(done) or set data-autorun on #ffIntro.
 * ?intro=1 forces the intro; prefers-reduced-motion skips it.
 * Sound is on by default: try unmuted play() first. If the browser blocks
 * it, play silently, show a "Tap for sound" prompt, and any tap on the
 * intro restarts the video from the start with sound. The speaker toggle
 * remembers a mute choice for the session. Skip always works.
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

    var skip = el.querySelector('#ffIntroSkip, .ff-intro-skipbtn');
    if (skip) {
      skip.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      });
    }

    var soundBtn = el.querySelector('#ffIntroSound, .ff-intro-sound');
    var tapBtn = el.querySelector('#ffIntroTap, .ff-intro-tap');

    function showTap(show) {
      if (!tapBtn) return;
      tapBtn.hidden = !show;
      el.classList.toggle('needs-tap', !!show);
    }
    function isControl(t) {
      return !!(t && t.closest && t.closest('#ffIntroSkip, .ff-intro-skipbtn, #ffIntroSound, .ff-intro-sound'));
    }

    // Start with sound from a real user gesture (click / touchend / keydown
    // grant media activation on iOS WebKit; touchstart / pointerdown do not).
    var lastGesture = 0;
    function startWithSound(fromStart) {
      if (finished || !video) return;
      started = true;
      applyMuted(video, false, soundBtn);
      setSoundPref('on');
      if (fromStart) { try { video.currentTime = 0; } catch (e) {} }
      bumpSafety();
      var p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(function () { showTap(false); disarm(); }).catch(function () {
          // Still blocked: keep the picture playing silently and keep asking.
          applyMuted(video, true, soundBtn);
          showTap(true);
          var p3 = video.play();
          if (p3 && p3.catch) p3.catch(function () {});
        });
      } else {
        showTap(false);
        disarm();
      }
    }
    function armAutoUnmute() {
      if (armed) return;
      armedHandler = function (e) {
        if (finished) return;
        if (e && isControl(e.target)) return;
        if (e && e.type === 'keydown' && e.key && !/^(Enter| |Spacebar)$/.test(e.key)) return;
        var now = Date.now();
        if (now - lastGesture < 450) return; // touchend + click from one tap
        lastGesture = now;
        if (video && !video.muted && !video.paused) { showTap(false); disarm(); return; }
        if (e && e.type === 'click' && e.preventDefault) e.preventDefault();
        startWithSound(true);
      };
      armed = ['touchend', 'click', 'keydown'];
      armed.forEach(function (t) {
        document.addEventListener(t, armedHandler, true);
      });
    }

    if (tapBtn) {
      tapBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        lastGesture = Date.now();
        startWithSound(true);
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!video) return;
        lastGesture = Date.now();
        if (video.muted) {
          startWithSound(true);
        } else {
          applyMuted(video, true, soundBtn);
          setSoundPref('off');
          showTap(false);
          disarm();
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
    video.preload = 'auto';
    video.addEventListener('ended', finish);
    video.addEventListener('error', function () { setTimeout(finish, FAIL_MS); });

    var started = false;
    function begin() {
      if (started || finished) return;
      started = true;
      bumpSafety();
      if (getSoundPref() === 'off') {
        applyMuted(video, true, soundBtn);
        var p0 = video.play();
        if (p0 && p0.catch) p0.catch(function () { setTimeout(finish, FAIL_MS); });
        return;
      }
      // 1) Try with sound straight away.
      applyMuted(video, false, soundBtn);
      var play = video.play();
      if (play && typeof play.then === 'function') {
        play.then(function () {
          // Some browsers start, then pause an unmuted autoplay. Re-check shortly.
          setTimeout(function () {
            if (!finished && video.paused && !video.ended) fallbackMuted();
          }, 350);
        }).catch(fallbackMuted);
      }
    }
    // 2) Blocked: play silently, show "Tap for sound", any tap restarts with sound.
    function fallbackMuted() {
      if (finished) return;
      applyMuted(video, true, soundBtn);
      showTap(true);
      armAutoUnmute();
      var p2 = video.play();
      if (p2 && p2.catch) p2.catch(function () { setTimeout(finish, FAIL_MS); });
    }
    // Let enough of the file buffer first so the voice does not stall,
    // but never wait more than ~2.5s (the poster shows meanwhile).
    if (getSoundPref() !== 'off') armAutoUnmute();
    if (video.readyState >= 4) begin();
    else {
      video.addEventListener('canplaythrough', begin, { once: true });
      setTimeout(begin, 2500);
      try { video.load(); } catch (e) {}
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
