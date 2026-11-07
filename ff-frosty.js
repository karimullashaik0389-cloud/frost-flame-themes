/**
 * Ask Frosty — offline menu concierge for the GH Pages preview.
 * Answers from /api/menu (dishes, spice, diet, allergens, price).
 */
(function () {
  'use strict';
  if (window.FFFrosty) return;

  var menu = null;
  var loading = null;
  var root = null;
  var logEl = null;
  var inputEl = null;
  var history = [];

  var LEVEL_NAME = {
    1: 'Arctic', 2: 'Chill', 3: 'Mild warm', 4: 'Warm',
    5: 'Hot', 6: 'Fiery', 7: 'Inferno'
  };
  var DIET_LABEL = { V: 'vegetarian', VG: 'vegan', N: 'contains nuts', S: 'spicy', SS: 'extra spicy' };

  function abs(p) {
    return window.__FF_ABS__ ? window.__FF_ABS__(p) : p;
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function priceOf(item) {
    if (typeof item.price === 'number') return item.price;
    if (item.sizes && item.sizes.length) {
      var nums = item.sizes.map(function (s) { return s.price; }).filter(function (n) { return typeof n === 'number'; });
      if (nums.length) return Math.min.apply(null, nums);
    }
    return null;
  }

  function formatPrice(item) {
    var p = priceOf(item);
    if (p == null) return 'price on request';
    return 'from £' + p.toFixed(2);
  }

  function dietLine(item) {
    var d = (item.diet || []).map(function (x) { return DIET_LABEL[x] || x; });
    return d.length ? d.join(', ') : 'no special diet tags';
  }

  function loadMenu() {
    if (menu) return Promise.resolve(menu);
    if (loading) return loading;
    loading = fetch(abs('/api/menu'), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        menu = data;
        loading = null;
        return menu;
      })
      .catch(function () {
        loading = null;
        menu = { items: [], categories: [], settings: {} };
        return menu;
      });
    return loading;
  }

  function themeId() {
    return document.documentElement.getAttribute('data-ff-theme') ||
      (function () { try { return sessionStorage.getItem('ff_entry_theme'); } catch (e) { return ''; } })() || '';
  }

  function scoreForTheme(item) {
    var t = themeId();
    var s = 0;
    var lvl = item.level || 3;
    var cat = item.category || '';
    if (t === 'couple') {
      if (/gulab|stone|shake|lassi|combo|eclipse|fire-and-ice/i.test(item.id + cat)) s += 3;
      if (lvl <= 4) s += 1;
    } else if (t === 'family_kids') {
      if (lvl <= 3) s += 3;
      if (/shake|smoothie|stone|gulab|fries|samosa/i.test(item.id + cat)) s += 2;
      if (lvl >= 6) s -= 2;
    } else if (t === 'gang' || t === 'friends') {
      if (lvl >= 5) s += 2;
      if (/pulao|street|chicken-65|combo|volcano/i.test(item.id + cat)) s += 2;
    } else if (t === 'family') {
      if (/pulao|curry|combo|chaat/i.test(item.id + cat)) s += 2;
    } else if (t === 'solo_m') {
      if (/pulao|chicken|mutton|street/i.test(item.id + cat)) s += 2;
    } else if (t === 'solo_f') {
      if (/stone|shake|smoothie|gulab|mango/i.test(item.id + cat)) s += 2;
    }
    return s;
  }

  function listItems(pred, limit) {
    var items = (menu && menu.items) || [];
    var out = items.filter(pred || function () { return true; });
    out.sort(function (a, b) { return scoreForTheme(b) - scoreForTheme(a); });
    return out.slice(0, limit || 5);
  }

  function bullet(items) {
    if (!items.length) return 'I couldn’t find a match on tonight’s menu — try another craving?';
    return items.map(function (it) {
      return '• ' + it.name + ' — ' + formatPrice(it) +
        ' · Ice-to-Fire ' + (it.level || '?') + ' (' + (LEVEL_NAME[it.level] || '') + ')' +
        (it.description ? '\n  ' + it.description : '');
    }).join('\n\n');
  }

  function hasAllergen(item, name) {
    return (item.allergens || []).some(function (a) {
      return String(a).toLowerCase().indexOf(name) !== -1;
    });
  }

  function answer(q) {
    var raw = String(q || '').trim();
    var text = raw.toLowerCase();
    if (!raw) return 'Ask me anything about the menu — spice, veggie picks, desserts, allergens, or a mood.';

    if (!menu || !(menu.items || []).length) {
      return 'I’m still warming up the menu board. Give me a second and ask again.';
    }

    // greetings
    if (/^(hi|hello|hey|yo)\b/.test(text) || text === 'help') {
      return 'Hi — I’m Frosty, your menu guide on this preview.\n\nTry:\n• “something spicy”\n• “vegetarian under £8”\n• “best dessert”\n• “dairy free?”\n• “what for a date night?”\n• “kids friendly”';
    }

    // allergens
    var allergenAsk = text.match(/\b(milk|dairy|gluten|nuts?|peanut|egg|soya|soy|sesame|mustard|fish|crustacean|mollusc|lupin|sulphite|celery)\b/);
    if (/allerg|intoleran|contain|free from|without/.test(text) || (allergenAsk && /\?|free|without|avoid|allerg/.test(text))) {
      var want = allergenAsk ? allergenAsk[1] : null;
      if (want === 'dairy') want = 'milk';
      if (want === 'nut' || want === 'nuts' || want === 'peanut') want = 'nuts';
      if (want === 'soy') want = 'soya';
      if (want) {
        var safe = listItems(function (it) { return !hasAllergen(it, want) && !it.sold_out; }, 6);
        var risk = listItems(function (it) { return hasAllergen(it, want); }, 4);
        return 'Avoiding ' + want + '? Safe-looking picks on this menu:\n\n' + bullet(safe) +
          (risk.length ? '\n\nUsually contain ' + want + ':\n' + risk.map(function (x) { return '• ' + x.name; }).join('\n') : '') +
          '\n\nAlways double-check with the kitchen for allergies — labels can change.';
      }
      return 'Tell me which allergen to watch for (milk, gluten, nuts, eggs, soya…) and I’ll filter the board.';
    }

    // vegan / veg
    if (/vegan/.test(text)) {
      return 'Plant-led picks (VG tag or mango sorbet path):\n\n' + bullet(listItems(function (it) {
        return (it.diet || []).indexOf('VG') !== -1 || /mango sorbet|soft drink|water|sprinkle/i.test(it.name + (it.description || ''));
      }, 6));
    }
    if (/veggie|vegetarian|no meat|without meat/.test(text)) {
      return 'Vegetarian-friendly:\n\n' + bullet(listItems(function (it) {
        return (it.diet || []).indexOf('V') !== -1 || (it.diet || []).indexOf('VG') !== -1;
      }, 6));
    }

    // spice
    if (/mild|not spicy|kids?|child|little one/.test(text)) {
      return 'Gentler heat (Ice-to-Fire 1–3):\n\n' + bullet(listItems(function (it) {
        return (it.level || 99) <= 3 && !it.sold_out;
      }, 6));
    }
    if (/spicy|hot|fire|inferno|fiery|kick/.test(text)) {
      return 'Bring the heat (Ice-to-Fire 5–7):\n\n' + bullet(listItems(function (it) {
        return (it.level || 0) >= 5 && !it.sold_out;
      }, 6));
    }

    // price
    var under = text.match(/under\s*£?\s*(\d+(?:\.\d+)?)/) || text.match(/less than\s*£?\s*(\d+)/) || text.match(/cheap|budget|affordable/);
    if (under) {
      var lim = under[1] ? parseFloat(under[1]) : 7;
      return 'Around £' + lim.toFixed(0) + ' or under:\n\n' + bullet(listItems(function (it) {
        var p = priceOf(it);
        return p != null && p <= lim && !it.sold_out;
      }, 6));
    }

    // categories / moods
    if (/dessert|sweet|ice cream|stone|gulab/.test(text)) {
      return 'Sweet side of the kitchen:\n\n' + bullet(listItems(function (it) {
        return /stone|gulab|dessert/i.test(it.category || '') || it.course === 'dessert';
      }, 6));
    }
    if (/drink|shake|smoothie|chai|lassi|coffee/.test(text)) {
      return 'Drinks:\n\n' + bullet(listItems(function (it) {
        return /shake|smoothie|cold|hot|drink/i.test(it.category || '') || it.course === 'drink';
      }, 6));
    }
    if (/pulao|rice|curry|main|savoury|savory|lunch|dinner/.test(text)) {
      return 'Savoury mains:\n\n' + bullet(listItems(function (it) {
        return /pulao|curry|specials|street/i.test(it.category || '');
      }, 6));
    }
    if (/street|chaat|snack|share/.test(text)) {
      return 'Street snacks to share:\n\n' + bullet(listItems(function (it) {
        return (it.category || '') === 'street';
      }, 6));
    }
    if (/combo|deal|for two|share the bill/.test(text)) {
      return 'Element combos:\n\n' + bullet(listItems(function (it) {
        return (it.category || '') === 'combos';
      }, 6));
    }
    if (/date|romantic|couple|two hearts/.test(text) || themeId() === 'couple' && /suggest|recommend|what should|tonight/.test(text)) {
      return 'Date-night mood — something to share plus a sweet finish:\n\n' + bullet(listItems(function (it) {
        return /eclipse|fire-and-ice|gulab|stone|mango|paneer/i.test(it.id) || (it.category === 'combos');
      }, 5));
    }
    if (/popular|best|signature|recommend|suggest|what should|tonight|hungry|ideas/.test(text)) {
      var picks = listItems(function (it) { return !it.sold_out; }, 5);
      return 'For your table tonight, I’d start here:\n\n' + bullet(picks) +
        '\n\nWant me to filter by spicy, veggie, dessert, or budget?';
    }

    // specific dish name search
    var items = menu.items || [];
    var hits = items.filter(function (it) {
      return (it.name + ' ' + (it.description || '')).toLowerCase().indexOf(text.replace(/[?!.]/g, '')) !== -1 ||
        text.split(/\s+/).filter(function (w) { return w.length > 3; }).some(function (w) {
          return it.name.toLowerCase().indexOf(w) !== -1;
        });
    }).slice(0, 4);
    if (hits.length === 1) {
      var it = hits[0];
      return it.name + '\n' + (it.description || '') +
        '\n\n' + formatPrice(it) +
        ' · Ice-to-Fire ' + it.level + ' (' + (LEVEL_NAME[it.level] || '') + ')' +
        '\nDiet: ' + dietLine(it) +
        '\nAllergens: ' + ((it.allergens || []).join(', ') || 'none listed') +
        (it.note ? '\nNote: ' + it.note : '');
    }
    if (hits.length > 1) {
      return 'Closest matches:\n\n' + bullet(hits);
    }

    return 'I can help with spice level, vegetarian/vegan, desserts, drinks, combos, budget, or allergens. Try “spicy pulao”, “dessert under £5”, or “no dairy”.';
  }

  function addBubble(role, text) {
    if (!logEl) return;
    var b = el('div', { className: 'ff-fr-bubble ff-fr-' + role });
    b.textContent = text;
    logEl.appendChild(b);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function send(text) {
    var q = String(text || '').trim();
    if (!q) return;
    addBubble('user', q);
    history.push({ role: 'user', text: q });
    inputEl.value = '';
    loadMenu().then(function () {
      var a = answer(q);
      addBubble('frosty', a);
      history.push({ role: 'frosty', text: a });
    });
  }

  function ensureUI() {
    if (root && root.isConnected) return root;
    root = el('div', {
      id: 'ff-frosty-chat',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Ask Frosty',
      'data-testid': 'ff-frosty-chat',
      hidden: 'hidden'
    });
    root.innerHTML =
      '<div class="ff-fr-panel">' +
        '<header class="ff-fr-head">' +
          '<div>' +
            '<p class="ff-fr-kicker">Concierge</p>' +
            '<h2>Ask Frosty</h2>' +
            '<p class="ff-fr-sub">Menu help from tonight’s board — spice, diet, desserts, allergens.</p>' +
          '</div>' +
          '<button type="button" class="ff-fr-x" data-testid="ff-frosty-close" aria-label="Close">×</button>' +
        '</header>' +
        '<div class="ff-fr-log" data-testid="ff-frosty-log"></div>' +
        '<div class="ff-fr-suggestions" data-testid="ff-frosty-suggestions">' +
          '<button type="button" data-q="What do you recommend?">Recommend</button>' +
          '<button type="button" data-q="Something spicy">Spicy</button>' +
          '<button type="button" data-q="Vegetarian under £8">Veggie</button>' +
          '<button type="button" data-q="Best dessert">Dessert</button>' +
          '<button type="button" data-q="No dairy">No dairy</button>' +
        '</div>' +
        '<form class="ff-fr-form" data-testid="ff-frosty-form">' +
          '<input type="text" enterkeyhint="send" autocomplete="off" maxlength="240" placeholder="Ask about the menu…" data-testid="ff-frosty-input" />' +
          '<button type="submit" data-testid="ff-frosty-send">Send</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);
    logEl = root.querySelector('.ff-fr-log');
    inputEl = root.querySelector('input');
    root.querySelector('.ff-fr-x').addEventListener('click', close);
    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });
    root.querySelector('.ff-fr-form').addEventListener('submit', function (e) {
      e.preventDefault();
      send(inputEl.value);
    });
    root.querySelector('.ff-fr-suggestions').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]');
      if (!b) return;
      send(b.getAttribute('data-q'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && !root.hidden) close();
    });
    return root;
  }

  function open() {
    ensureUI();
    root.hidden = false;
    document.documentElement.classList.add('ff-frosty-open');
    loadMenu().then(function () {
      if (!logEl.childElementCount) {
        addBubble('frosty', answer('help'));
      }
      try { inputEl.focus(); } catch (e) {}
    });
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    document.documentElement.classList.remove('ff-frosty-open');
  }

  window.FFFrosty = {
    open: open,
    close: close,
    send: send,
    answer: answer,
    loadMenu: loadMenu
  };
})();
