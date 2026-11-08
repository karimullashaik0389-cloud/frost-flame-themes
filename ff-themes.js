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
      sublabel: 'For him · refined',
      emoji: '🧔',
      title: 'Table for one',
      greeting: 'Quiet confidence. Order well.',
      mood: 'Charcoal & amber ember — bar-seat polish.',
      surprise: 'flames',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#0e1012', '--ff-card': '#171a1e', '--ff-ink': '#f4efe8', '--ff-muted': '#b7aaa0',
        '--ff-line': '#2c2622', '--ff-accent': '#e08a3c', '--ff-accent2': '#c9a227',
        '--ff-grad': 'linear-gradient(160deg,#1a1612 0%,#0e1012 55%,#16110e 100%)'
      },
      site: {
        '--bg': '#0e1012', '--surface': '#171a1e', '--surface-2': '#1e2228',
        '--border': '#2c2622', '--text': '#f4efe8', '--muted': '#b7aaa0',
        '--frost': '#8eb8c9', '--flame': '#e08a3c', '--copper': '#c9a227',
        '--primary': '28 72% 56%'
      }
    },
    solo_f: {
      id: 'solo_f',
      label: 'Just you',
      sublabel: 'For her · elegant',
      emoji: '💁‍♀️',
      title: 'Just for you',
      greeting: 'Soft light. Your pace.',
      mood: 'Champagne blush & rose gold — treat-yourself calm.',
      surprise: 'sparkles',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#161018', '--ff-card': '#221a22', '--ff-ink': '#fbf5f8', '--ff-muted': '#d4bbc8',
        '--ff-line': '#3a2a36', '--ff-accent': '#d4a0b5', '--ff-accent2': '#c4a574',
        '--ff-grad': 'linear-gradient(160deg,#241820 0%,#161018 55%,#1e1620 100%)'
      },
      site: {
        '--bg': '#161018', '--surface': '#221a22', '--surface-2': '#2a202a',
        '--border': '#3a2a36', '--text': '#fbf5f8', '--muted': '#d4bbc8',
        '--frost': '#c9b8d4', '--flame': '#d4a0b5', '--copper': '#c4a574',
        '--primary': '340 40% 68%'
      }
    },
    friends: {
      id: 'friends',
      label: 'Two friends',
      sublabel: 'Bright & easy',
      emoji: '👯',
      title: 'Friends night',
      greeting: 'Two spoons. Easy laughs.',
      mood: 'Sea-glass teal & soft gold — social, never loud.',
      surprise: 'confetti',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#0c1c1f', '--ff-card': '#132428', '--ff-ink': '#f3fffb', '--ff-muted': '#9fc4bc',
        '--ff-line': '#244044', '--ff-accent': '#3db8a8', '--ff-accent2': '#d4c07a',
        '--ff-grad': 'linear-gradient(160deg,#143034 0%,#0c1c1f 55%,#102428 100%)'
      },
      site: {
        '--bg': '#0c1c1f', '--surface': '#132428', '--surface-2': '#1a2e32',
        '--border': '#244044', '--text': '#f3fffb', '--muted': '#9fc4bc',
        '--frost': '#6ec9c0', '--flame': '#d4a86a', '--copper': '#d4c07a',
        '--primary': '172 48% 48%'
      }
    },
    couple: {
      id: 'couple',
      label: 'Couple',
      sublabel: 'Date night',
      emoji: '💑',
      title: 'For two',
      greeting: 'Low light. Two spoons.',
      mood: 'Burgundy velvet & champagne — intimate dining.',
      surprise: 'hearts',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#14080c', '--ff-card': '#1e1016', '--ff-ink': '#fff6f8', '--ff-muted': '#d4aeb8',
        '--ff-line': '#3a2028', '--ff-accent': '#a83248', '--ff-accent2': '#d4b87a',
        '--ff-grad': 'linear-gradient(160deg,#241018 0%,#14080c 55%,#1a0c12 100%)'
      },
      site: {
        '--bg': '#14080c', '--surface': '#1e1016', '--surface-2': '#28141c',
        '--border': '#3a2028', '--text': '#fff6f8', '--muted': '#d4aeb8',
        '--frost': '#c9a0b0', '--flame': '#c44a5e', '--copper': '#d4b87a',
        '--primary': '350 55% 42%'
      }
    },
    gang: {
      id: 'gang',
      label: "The Gang's Night Out",
      sublabel: 'City night',
      emoji: '🌃',
      title: 'Night out',
      greeting: 'The table’s full. Let’s eat.',
      mood: 'Midnight navy & muted teal — city-night polish.',
      surprise: 'neon',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#070b14', '--ff-card': '#0e1424', '--ff-ink': '#e8f7f4', '--ff-muted': '#8aadb0',
        '--ff-line': '#1c2a40', '--ff-accent': '#3ec4b0', '--ff-accent2': '#c9a06a',
        '--ff-grad': 'linear-gradient(160deg,#101828 0%,#070b14 55%,#0a1220 100%)'
      },
      site: {
        '--bg': '#070b14', '--surface': '#0e1424', '--surface-2': '#141c30',
        '--border': '#1c2a40', '--text': '#e8f7f4', '--muted': '#8aadb0',
        '--frost': '#5ec8c0', '--flame': '#d4955a', '--copper': '#c9a06a',
        '--primary': '172 52% 50%'
      }
    },
    family: {
      id: 'family',
      label: 'Big Family Feast',
      sublabel: 'Warm table',
      emoji: '🪔',
      title: 'Family feast',
      greeting: 'Everyone’s here — fill the table.',
      mood: 'Walnut & marigold — generous, warm, gathered.',
      surprise: 'petals',
      fonts: {
        display: '"Cinzel", "Cormorant Garamond", serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#14100a', '--ff-card': '#1e1810', '--ff-ink': '#fff8ec', '--ff-muted': '#c9b896',
        '--ff-line': '#3a3020', '--ff-accent': '#d4a024', '--ff-accent2': '#3d6b52',
        '--ff-grad': 'linear-gradient(160deg,#241c10 0%,#14100a 55%,#1a140c 100%)'
      },
      site: {
        '--bg': '#14100a', '--surface': '#1e1810', '--surface-2': '#282014',
        '--border': '#3a3020', '--text': '#fff8ec', '--muted': '#c9b896',
        '--frost': '#a8c4b0', '--flame': '#d4a024', '--copper': '#c9a040',
        '--primary': '40 72% 48%'
      }
    },
    family_kids: {
      id: 'family_kids',
      label: 'Family with kids',
      sublabel: 'Calm & colourful',
      emoji: '👨‍👩‍👧‍👦',
      title: 'Family table',
      greeting: 'Grown-ups and little legends welcome.',
      mood: 'Soft sky & sage — playful without the circus.',
      surprise: 'stars',
      fonts: {
        display: '"Cormorant Garamond", Georgia, serif',
        body: 'Inter, system-ui, sans-serif'
      },
      vars: {
        '--ff-bg': '#0c1e30', '--ff-card': '#142838', '--ff-ink': '#f3f9ff', '--ff-muted': '#9ab8cc',
        '--ff-line': '#243e54', '--ff-accent': '#5eb87a', '--ff-accent2': '#e09a78',
        '--ff-grad': 'linear-gradient(160deg,#163044 0%,#0c1e30 55%,#123028 100%)'
      },
      site: {
        '--bg': '#0c1e30', '--surface': '#142838', '--surface-2': '#1a3244',
        '--border': '#243e54', '--text': '#f3f9ff', '--muted': '#9ab8cc',
        '--frost': '#7ec8e8', '--flame': '#e09a78', '--copper': '#e0b060',
        '--primary': '142 40% 54%'
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
      '--ff-accent', '--ff-accent2', '--ff-grad', '--ff-display', '--ff-body',
      '--bg', '--surface', '--surface-2', '--border', '--text', '--muted',
      '--frost', '--flame', '--copper', '--primary', '--font-display', '--font-body'
    ].forEach(function (k) { el.style.removeProperty(k); });
  }

  function applyVars(theme) {
    var root = document.documentElement;
    var body = document.body;
    clearInlineVars(root);
    clearInlineVars(body);
    if (!theme) return;
    // Keep Emergent base design language (bg/surface/text/fonts).
    // Themes only nudge accents + our overlay tokens.
    Object.keys(theme.vars).forEach(function (k) {
      root.style.setProperty(k, theme.vars[k]);
      body.style.setProperty(k, theme.vars[k]);
    });
    // Accent-only site tokens — never rewrite layout/surface/ink/type
    var ACCENT_KEYS = { '--frost': 1, '--flame': 1, '--copper': 1, '--primary': 1 };
    if (theme.site) {
      Object.keys(theme.site).forEach(function (k) {
        if (!ACCENT_KEYS[k]) return;
        root.style.setProperty(k, theme.site[k]);
        body.style.setProperty(k, theme.site[k]);
      });
    }
    // Overlay chrome may still use theme display font; leave host --font-* alone
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
    // Mood chip removed — it overlapped titles and the launch pill. Theme still applies via CSS vars.
    var el = ensureGreet();
    el.hidden = true;
    el.classList.remove('is-on', 'is-dim');
  }

  function burst() {
    /* Emoji particles sat on the logo and the menu. Themes stay accent-only. */
    if (particlesEl) {
      particlesEl.remove();
      particlesEl = null;
    }
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
