/* Load live website menu + texts from the admin backend, or keep the built-in file if that fails. */
(function (global) {
  function apiUrl() { return String(global.FF_API_URL || '').replace(/\/$/, ''); }

  function merge(builtin, live) {
    var data = JSON.parse(JSON.stringify(builtin));
    var byId = {};
    (data.items || []).forEach(function (it) { byId[it.id] = it; });
    if (Array.isArray(live.items) && live.items.length) {
      data.items = live.items.map(function (it) {
        var base = byId[it.id] ? Object.assign({}, byId[it.id]) : {};
        Object.keys(it).forEach(function (k) {
          if (k === 'updatedAt' || k === 'updatedBy' || k === 'visible' || k === 'extra') return;
          if (it[k] !== undefined) base[k] = it[k];
        });
        return base;
      });
    }
    if (Array.isArray(live.categories) && live.categories.length && data.categories) {
      var cmap = {};
      live.categories.forEach(function (c) { cmap[c.id] = c; });
      data.categories = data.categories.map(function (c) {
        var u = cmap[c.id];
        return u ? Object.assign({}, c, u) : c;
      });
    }
    var texts = live.texts || {};
    if (texts.meta && data.meta) {
      ['name', 'tagline', 'description'].forEach(function (k) {
        if (texts.meta[k]) data.meta[k] = texts.meta[k];
      });
    }
    if (texts.story && data.story) {
      if (texts.story.title) data.story.title = texts.story.title;
      if (Array.isArray(texts.story.text) && texts.story.text.length) data.story.text = texts.story.text;
    }
    if (Array.isArray(texts.themes) && data.themes) {
      var tmap = {};
      texts.themes.forEach(function (t) { tmap[t.id] = t; });
      data.themes = data.themes.map(function (t) {
        var u = tmap[t.id];
        return u ? Object.assign({}, t, u) : t;
      });
    }
    if (texts.hero) data.hero = Object.assign({}, data.hero || {}, texts.hero);
    return data;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function applyTexts(data) {
    if (!data) return;
    var hero = data.hero || {};
    var tag = document.querySelector('.hero-copy .hero-tag') || document.querySelector('.hero-tag');
    if (hero.tag && tag) tag.textContent = hero.tag;
    var lead = document.querySelector('.hero-copy .hero-lead');
    if (hero.lead && lead) lead.textContent = hero.lead;
    var eye = document.querySelector('[data-launch]');
    if (hero.eyebrow && eye) eye.innerHTML = escapeHtml(hero.eyebrow).replace(/\n/g, '<br>');
    if (data.meta && data.meta.name) {
      var logo = document.querySelector('a.logo');
      if (logo) logo.setAttribute('aria-label', data.meta.name + ' home');
    }
  }

  function loadMenu(builtinUrl) {
    return fetch(builtinUrl).then(function (res) {
      if (!res.ok) throw new Error('menu.json ' + res.status);
      return res.json();
    }).then(function (builtin) {
      var url = apiUrl();
      if (!url) return { data: builtin, source: 'builtin' };
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'publicContent' }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) { return r.text(); }).then(function (t) {
        clearTimeout(timer);
        var live;
        try { live = JSON.parse(t); } catch (e) { return { data: builtin, source: 'builtin' }; }
        if (live && live.ok && Array.isArray(live.items) && live.items.length) {
          return { data: merge(builtin, live), source: 'sheet' };
        }
        return { data: builtin, source: 'builtin' };
      }).catch(function () {
        clearTimeout(timer);
        return { data: builtin, source: 'builtin' };
      });
    });
  }

  global.FFLive = { loadMenu: loadMenu, merge: merge, applyTexts: applyTexts };
})(window);
