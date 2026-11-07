/**
 * Frost & Flame — seven dining-mood themes (overlay layer).
 * Applies when data-ff-theme / body.ff-theme-* is set by ff-tree.js.
 * No theme → zero visual change to the host Emergent UI.
 * Spec source: frost_flame_qr_billing RESEARCH.md + themes.js (owner-agreed seven).
 */
(function () {
  'use strict';
  if (window.FFThemesApply) return;

  var THEMES = {
    solo_m: {
      id: 'solo_m',
      label: 'Just you',
      sublabel: 'For him · playful',
      emoji: '🧔',
      title: 'Just you, boss',
      greeting: 'Table for one? Treat yourself today.',
      mood: 'Playful comic flames — cheeky, fast, for one.',
      surprise: 'flames',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#121212', '--ff-card': '#1c1c1c', '--ff-ink': '#fff8f0', '--ff-muted': '#c9b8a8',
        '--ff-line': '#3d2a1f', '--ff-accent': '#ff6a00', '--ff-accent2': '#ffe566',
        '--ff-grad': 'linear-gradient(135deg,#2a2a2a,#1a120c 60%,#2a1808)'
      }
    },
    solo_f: {
      id: 'solo_f',
      label: 'Just you',
      sublabel: 'For her · stylish',
      emoji: '💁‍♀️',
      title: 'Just for you',
      greeting: 'Table for one? You deserve every bite.',
      mood: 'Stylish blush & lilac — soft, treat-yourself.',
      surprise: 'sparkles',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#2a1824', '--ff-card': '#3a2434', '--ff-ink': '#fff7fb', '--ff-muted': '#e8c9d8',
        '--ff-line': '#5a3a4c', '--ff-accent': '#e891b0', '--ff-accent2': '#c4a1e0',
        '--ff-grad': 'linear-gradient(135deg,#3a2434,#2a1824 55%,#3a2840)'
      }
    },
    friends: {
      id: 'friends',
      label: 'Two friends',
      sublabel: 'Bright & social',
      emoji: '👯',
      title: 'Friends night',
      greeting: "Squad of two? Let's eat.",
      mood: 'Bright teal & sunny yellow — share, laugh, split the bill.',
      surprise: 'confetti',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#0f2a2e', '--ff-card': '#16383c', '--ff-ink': '#f7fffb', '--ff-muted': '#b7e0d6',
        '--ff-line': '#2a5558', '--ff-accent': '#ffe566', '--ff-accent2': '#2ec4b6',
        '--ff-grad': 'linear-gradient(135deg,#16383c,#0f2a2e 50%,#1a4048)'
      }
    },
    couple: {
      id: 'couple',
      label: 'Couple',
      sublabel: 'Romantic date night',
      emoji: '💑',
      title: 'For two hearts',
      greeting: 'Two spoons, one table. Welcome.',
      mood: 'Romantic wine-red & soft rose — date-night calm.',
      surprise: 'hearts',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#1a080c', '--ff-card': '#2a1018', '--ff-ink': '#fff5f7', '--ff-muted': '#e8b8c4',
        '--ff-line': '#4a2030', '--ff-accent': '#c41e3a', '--ff-accent2': '#e8c87a',
        '--ff-grad': 'linear-gradient(135deg,#2a1018,#1a080c 55%,#2a1420)'
      }
    },
    gang: {
      id: 'gang',
      label: "The Gang's Night Out",
      sublabel: 'Neon night street',
      emoji: '🌃',
      title: "The Gang's Night Out",
      greeting: "Squad's here! Let's eat.",
      mood: 'Neon cyan & lime on midnight — street-night energy.',
      surprise: 'neon',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#060b18', '--ff-card': '#0e1630', '--ff-ink': '#e8fff8', '--ff-muted': '#8ec8c0',
        '--ff-line': '#1e3a50', '--ff-accent': '#2de2c5', '--ff-accent2': '#ffb347',
        '--ff-grad': 'linear-gradient(135deg,#0e1630,#060b18 50%,#0a1a28)'
      }
    },
    family: {
      id: 'family',
      label: 'Big Family Feast',
      sublabel: 'Warm feast table',
      emoji: '🪔',
      title: 'The Big Family Feast',
      greeting: 'The whole crew is here — nobody leaves hungry.',
      mood: 'Marigold gold & deep green — feast, share, fill the table.',
      surprise: 'petals',
      fonts: {
        display: '"Cinzel", "Cormorant Garamond", serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#1a1208', '--ff-card': '#2a1e10', '--ff-ink': '#fff8e8', '--ff-muted': '#d4c090',
        '--ff-line': '#4a3820', '--ff-accent': '#e8a020', '--ff-accent2': '#2d6a4f',
        '--ff-grad': 'linear-gradient(135deg,#2a1e10,#1a1208 55%,#241808)'
      }
    },
    family_kids: {
      id: 'family_kids',
      label: 'Family with kids',
      sublabel: 'Colourful & mild',
      emoji: '👨‍👩‍👧‍👦',
      title: 'Family table',
      greeting: 'Welcome, grown-ups and little legends!',
      mood: 'Sky blue, grass green, sunny coral — kids busy, parents calm.',
      surprise: 'stars',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#0c2744', '--ff-card': '#143556', '--ff-ink': '#f5fbff', '--ff-muted': '#a8d4f0',
        '--ff-line': '#2a5578', '--ff-accent': '#5ad67d', '--ff-accent2': '#ff8a65',
        '--ff-grad': 'linear-gradient(135deg,#143556,#0c2744 50%,#1a3a28)'
      }
    }
  };

  var SURPRISE = {
    flames: ['🔥', '🌶️', '✨', '🧡'],
    sparkles: ['✨', '💖', '🌸', '💫'],
    confetti: ['🎉', '🎊', '💛', '💚'],
    hearts: ['❤️', '💕', '💗', '💞'],
    neon: ['💡', '🌃', '✨', '🟢'],
    petals: ['🪔', '🌼', '🍂', '✨'],
    stars: ['⭐', '🌟', '🎈', '🍭']
  };

  var greetEl = null;
  var particlesEl = null;
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function clearInlineVars(el) {
    if (!el || !el.style) return;
    [
      '--ff-bg', '--ff-card', '--ff-ink', '--ff-muted', '--ff-line',
      '--ff-accent', '--ff-accent2', '--ff-grad', '--ff-display', '--ff-body'
    ].forEach(function (k) { el.style.removeProperty(k); });
  }

  function applyVars(theme) {
    var root = document.documentElement;
    var body = document.body;
    clearInlineVars(root);
    clearInlineVars(body);
    if (!theme) return;
    Object.keys(theme.vars).forEach(function (k) {
      root.style.setProperty(k, theme.vars[k]);
      body.style.setProperty(k, theme.vars[k]);
    });
    root.style.setProperty('--ff-display', theme.fonts.display);
    root.style.setProperty('--ff-body', theme.fonts.body);
    body.style.setProperty('--ff-display', theme.fonts.display);
    body.style.setProperty('--ff-body', theme.fonts.body);
  }

  function ensureGreet() {
    if (greetEl) return greetEl;
    greetEl = document.createElement('div');
    greetEl.id = 'ff-theme-greet';
    greetEl.setAttribute('role', 'status');
    greetEl.hidden = true;
    document.body.appendChild(greetEl);
    return greetEl;
  }

  function showGreet(theme) {
    var el = ensureGreet();
    if (!theme) {
      el.hidden = true;
      el.classList.remove('is-on', 'is-dim');
      return;
    }
    el.innerHTML =
      '<span class="ff-tg-emoji">' + theme.emoji + '</span>' +
      '<strong class="ff-tg-title">' + theme.title + '</strong>' +
      '<span class="ff-tg-sub">' + theme.greeting + '</span>';
    el.hidden = false;
    el.classList.add('is-on');
    el.classList.remove('is-dim');
    // Show once briefly, then remove — keeps the menu calm and professional
    clearTimeout(showGreet._t);
    clearTimeout(showGreet._t2);
    showGreet._t = setTimeout(function () {
      el.classList.add('is-dim');
    }, 1800);
    showGreet._t2 = setTimeout(function () {
      el.hidden = true;
      el.classList.remove('is-on', 'is-dim');
    }, 2800);
    el.onclick = function () {
      el.hidden = true;
      el.classList.remove('is-on', 'is-dim');
    };
  }

  function burst(theme) {
    // Premium: no falling emoji over menu content. Optional faint header sparkle only.
    if (!theme || reduceMotion) return;
    if (particlesEl) {
      particlesEl.remove();
      particlesEl = null;
    }
    var set = SURPRISE[theme.surprise] || SURPRISE.sparkles;
    particlesEl = document.createElement('div');
    particlesEl.className = 'ff-theme-particles ff-theme-particles--header';
    particlesEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(particlesEl);
    var n = 4;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('span');
      p.className = 'ff-theme-particle';
      p.textContent = set[i % set.length];
      p.style.left = (18 + Math.random() * 64) + 'vw';
      p.style.top = (6 + Math.random() * 10) + 'px';
      p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      p.style.fontSize = (10 + Math.random() * 4) + 'px';
      p.style.opacity = '0.28';
      particlesEl.appendChild(p);
    }
    setTimeout(function () {
      if (particlesEl) {
        particlesEl.remove();
        particlesEl = null;
      }
    }, 2600);
  }

  function syncMeta(theme) {
    // Enrich tree change-chip labels if FFTree is present
    try {
      if (window.FFTree && window.FFTree.THEME_META && theme) {
        var m = window.FFTree.THEME_META[theme.id];
        if (m) {
          m.label = theme.label;
          m.emoji = theme.emoji;
        }
      }
    } catch (e) {}
  }

  function apply(themeId) {
    var theme = themeId ? THEMES[themeId] : null;
    // body class already set by ff-tree; ensure consistency
    if (themeId && document.body && !document.body.classList.contains('ff-theme-' + themeId)) {
      document.body.className = document.body.className
        .split(/\s+/).filter(function (c) { return c && c.indexOf('ff-theme-') !== 0; }).join(' ');
      document.body.classList.add('ff-theme-' + themeId);
    }
    if (!themeId) {
      document.body.className = document.body.className
        .split(/\s+/).filter(function (c) { return c && c.indexOf('ff-theme-') !== 0; }).join(' ');
    }
    applyVars(theme);
    syncMeta(theme);
    showGreet(theme);
    if (theme) burst(theme);
    try {
      window.dispatchEvent(new CustomEvent('ff:theme-styled', { detail: { themeId: themeId || null, theme: theme } }));
    } catch (e) {}
  }

  function currentId() {
    return document.documentElement.getAttribute('data-ff-theme') ||
      (function () { try { return sessionStorage.getItem('ff_entry_theme'); } catch (e) { return null; } })();
  }

  function boot() {
    apply(currentId());
    window.addEventListener('ff:theme', function (ev) {
      var id = ev && ev.detail && ev.detail.themeId;
      apply(id || null);
    });
    // Observe attribute in case tree sets it without event (saved session restore)
    try {
      var obs = new MutationObserver(function () {
        apply(currentId());
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ff-theme'] });
    } catch (e) {}
  }

  window.FFThemesApply = {
    THEMES: THEMES,
    list: ['solo_m', 'solo_f', 'friends', 'couple', 'gang', 'family', 'family_kids'],
    apply: apply,
    get: function (id) { return THEMES[id] || null; },
    current: currentId
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
