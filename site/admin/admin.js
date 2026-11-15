/* Frost & Flame website admin v2 – UI only. Every permission is checked again on the server (Code.gs). */
(function () {
  var TK = 'ff-site-admin-token', UK = 'ff-site-admin-user';
  var token = localStorage.getItem(TK) || '';

  var DK = 'ff-site-admin-device';
  var deviceToken = localStorage.getItem(DK) || '';
  var wantRemember = true;
  function deviceLabel() {
    var ua = navigator.userAgent || '';
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android phone';
    if (/Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows computer';
    if (/Linux/.test(ua)) return 'Linux computer';
    return 'Saved device';
  }
  function rememberChecked() { var el = $('loginRemember'); return !el || !!el.checked; }
  function storeDevice(t) {
    deviceToken = t || '';
    if (deviceToken) localStorage.setItem(DK, deviceToken);
    else localStorage.removeItem(DK);
  }
  function acceptLogin(r) {
    token = r.token; me = r.user;
    localStorage.setItem(TK, token); localStorage.setItem(UK, JSON.stringify(me));
    if (r.deviceToken) storeDevice(r.deviceToken);
  }
  function attachDeviceIfWanted() {
    if (!wantRemember || !token) return Promise.resolve();
    return FFApi.call({ action: 'deviceRemember', token: token, deviceLabel: deviceLabel() }).then(function (r) {
      if (r && r.deviceToken) storeDevice(r.deviceToken);
    }).catch(function (e) { if (e && e.code !== 'unknown_action') storeDevice(''); });
  }
  function resumeWithDevice() {
    if (!deviceToken) return Promise.resolve(false);
    return FFApi.call({ action: 'loginDevice', deviceToken: deviceToken }).then(function (r) {
      acceptLogin(r); wantRemember = true; return true;
    }).catch(function () { storeDevice(''); return false; });
  }

  var me = null, menuItems = [], categories = [], textRows = [], people = [], lastLoginPassword = '', toastTimer;
  try { me = JSON.parse(localStorage.getItem(UK) || 'null'); } catch (e) { me = null; }
  var TABS = [
    { id: 'menu', label: 'Menu', perm: 'menu.view' },
    { id: 'texts', label: 'Site text', perm: 'texts.view' },
    { id: 'people', label: 'People', perm: 'people.manage' },
    { id: 'activity', label: 'Activity', perm: 'activity.view' },
    { id: 'me', label: 'Me' }
  ];
  var PERM_TEXT = {
    'menu.availability': 'mark dishes available / out of stock', 'menu.edit': 'edit dish details and photos',
    'menu.price': 'change prices', 'menu.add': 'add dishes', 'menu.delete': 'delete dishes',
    'texts.view': 'see site texts', 'texts.edit': 'edit names, greetings and hero text',
    'activity.view': 'read the activity log'
  };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '£' + Number(n || 0).toFixed(2); }
  function can(p) { return !!(me && me.perms && me.perms[p]); }
  function photoSrc(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    if (p.indexOf('../') === 0) return p;
    return '../' + String(p).replace(/^\//, '');
  }
  function priceLabel(it) {
    if (it.sizes && it.sizes.length) {
      var prices = it.sizes.map(function (s) { return Number(s.price); }).filter(function (n) { return isFinite(n); });
      if (!prices.length) return '—';
      var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
      return min === max ? money(min) : 'from ' + money(min);
    }
    if (it.price == null || it.price === '') return '—';
    return money(it.price);
  }
  function shrinkPhoto(file, done, fail) {
    if (!file) { fail('Please choose a photo'); return; }
    if (!file.type || file.type.indexOf('image/') !== 0) { fail('Please choose a photo'); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.width, h = img.height, max = 1200;
      if (w > max || h > max) { var s = Math.min(max / w, max / h); w = Math.round(w * s); h = Math.round(h * s); }
      var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try {
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        done(dataUrl, dataUrl);
      } catch (e) { fail('That photo could not be read'); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail('That photo could not be read'); };
    img.src = url;
  }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function toast(msg, err) {
    var el = $('toast'); el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3400);
  }
  function api(payload) {
    payload = payload || {};
    if (token) payload.token = token;
    return FFApi.call(payload).catch(function (e) {
      if (e.code === 'auth' && deviceToken && !payload._retriedDevice) {
        return resumeWithDevice().then(function (ok) {
          if (!ok) { dropSession(true); showLogin(e.message); throw e; }
          payload.token = token; payload._retriedDevice = true;
          return api(payload);
        });
      }
      if (e.code === 'auth' || e.code === 'must_change_password') {
        if (e.code === 'must_change_password') showChange(false);
        else { dropSession(true); showLogin(e.message); }
      }
      throw e;
    });
  }
  function busy(btn, on) { if (btn) { btn.disabled = on; } }
  function openSheet(html) { $('sheet').innerHTML = html; show('sheetBg', true); var f = $('sheet').querySelector('input,select,textarea'); if (f && f.focus) setTimeout(function(){ try { f.focus(); } catch (e) {} }, 50); }
  function closeSheet() { show('sheetBg', false); $('sheet').innerHTML = ''; }
  $('sheetBg').addEventListener('click', function (e) { if (e.target === $('sheetBg') && !$('sheet').querySelector('[data-sticky]')) closeSheet(); });
  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      openSheet('<h2>' + esc(title) + '</h2><p class="hint">' + esc(text) + '</p>' +
        '<div class="row2"><button class="btn btn-ghost" id="cfNo" type="button">Cancel</button>' +
        '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="cfYes" type="button">' + esc(okLabel) + '</button></div>');
      $('cfNo').onclick = function () { closeSheet(); resolve(false); };
      $('cfYes').onclick = function () { closeSheet(); resolve(true); };
    });
  }
  function secretSheet(title, who, username, pw) {
    openSheet('<h2>' + esc(title) + '</h2><p class="hint">Show this to ' + esc(who) + ' in person. They must change it at first login. It will not be shown again.</p>' +
      '<p class="muted">Username <b>' + esc(username) + '</b></p><div class="secret" id="spVal">' + esc(pw) + '</div>' +
      '<button class="btn btn-ghost" id="spCopy" type="button">Copy</button><button class="btn btn-primary" id="spOk" type="button">I have written it down</button>');
    $('spCopy').onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(pw).then(function () { toast('Copied'); }, function () { toast('Copy did not work – write it down', true); });
      else toast('Copy did not work – write it down', true);
    };
    $('spOk').onclick = closeSheet;
  }
  function dropSession(all) { token = ''; me = null; localStorage.removeItem(TK); localStorage.removeItem(UK); if (all) storeDevice(''); }
  function showLogin(msg) {
    show('appView', false); show('changeView', false); show('loginView', true);
    $('loginMsg').textContent = msg || ''; $('loginMsg').className = 'msg';
    show('setupWarn', !FFApi.ready());
  }
  function showChange(knowOld) {
    show('loginView', false); show('appView', false); show('changeView', true);
    show('cvOldWrap', !!knowOld);
    if (knowOld && lastLoginPassword) { $('cvOld').value = lastLoginPassword; }
    $('cvMsg').textContent = '';
  }
  function showApp() {
    show('loginView', false); show('changeView', false); show('appView', true);
    show('setupWarn', false);
    $('whoLine').textContent = me.displayName + ' · ' + (me.role === 'owner' ? 'Owner' : 'Employee');
    var nav = $('tabs');
    nav.innerHTML = TABS.filter(function (t) { return !t.perm || can(t.perm); }).map(function (t) {
      return '<button type="button" class="tab" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join('');
    nav.querySelectorAll('.tab').forEach(function (b) { b.onclick = function () { openTab(b.getAttribute('data-tab')); }; });
    show('addDishBtn', can('menu.add'));
    $('meLine').innerHTML = '<b>' + esc(me.displayName) + '</b> · @' + esc(me.username) + ' · ' + (me.role === 'owner' ? 'Owner' : 'Employee');
    var allowed = Object.keys(PERM_TEXT).filter(function (k) { return can(k); }).map(function (k) { return PERM_TEXT[k]; });
    $('mePerms').textContent = allowed.length ? 'You can ' + allowed.join(', ') + '.' : '';
    openTab('menu');
  }
  function openTab(id) {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === id); });
    document.querySelectorAll('.panel').forEach(function (x) { x.classList.toggle('on', x.id === 'panel-' + id); });
    if (id === 'menu') loadMenu();
    if (id === 'texts') loadTexts();
    if (id === 'people') loadPeople();
    if (id === 'activity') loadActivity();
  }

  document.querySelectorAll('[data-eye]').forEach(function (b) {
    b.onclick = function () { var i = $(b.getAttribute('data-eye')); var t = i.type === 'password'; i.type = t ? 'text' : 'password'; b.textContent = t ? 'Hide' : 'Show'; };
  });

  $('loginForm').onsubmit = function (ev) {
    ev.preventDefault();
    var btn = $('loginBtn'), pw = $('loginPass').value;
    busy(btn, true); $('loginMsg').textContent = '';
    lastLoginPassword = pw;
    wantRemember = rememberChecked();
    FFApi.call({ action: 'login', username: $('loginUser').value, password: pw, remember: wantRemember, deviceLabel: deviceLabel() }).then(function (r) {
      acceptLogin(r);
      if (!r.deviceToken && !wantRemember) storeDevice('');
      $('loginPass').value = '';
      if (r.mustChangePassword) showChange(!lastLoginPassword); else { lastLoginPassword = ''; showApp(); toast('Welcome, ' + me.displayName); }
    }).catch(function (e) {
      lastLoginPassword = '';
      var msg = e.message || 'Wrong username or password';
      var left = e.data && e.data.remaining;
      if (typeof left === 'number') msg += '. ' + left + ' tries left';
      $('loginMsg').textContent = msg;
    }).then(function () { busy(btn, false); });
  };
  $('changeForm').onsubmit = function (ev) {
    ev.preventDefault();
    var a = $('cvNew').value, b = $('cvNew2').value, oldPw = $('cvOldWrap').classList.contains('hidden') ? lastLoginPassword : $('cvOld').value;
    if (a !== b) { $('cvMsg').textContent = 'The two new passwords are not the same'; return; }
    busy($('cvBtn'), true); $('cvMsg').textContent = '';
    api({ action: 'changePassword', oldPassword: oldPw, newPassword: a }).then(function () {
      lastLoginPassword = ''; ['cvOld', 'cvNew', 'cvNew2'].forEach(function (i) { $(i).value = ''; });
      storeDevice('');
      return api({ action: 'me' });
    }).then(function (r) {
      me = r.user; localStorage.setItem(UK, JSON.stringify(me));
      return attachDeviceIfWanted();
    }).then(function () { showApp(); toast('Password saved. Welcome, ' + me.displayName);
    }).catch(function (e) { $('cvMsg').textContent = e.message; if (e.code === 'bad_password') show('cvOldWrap', true); })
      .then(function () { busy($('cvBtn'), false); });
  };
  function logout() { var t = token, d = deviceToken; dropSession(true); if (t) FFApi.call({ action: 'logout', token: t, deviceToken: d }).catch(function () {}); showLogin('You are logged out.'); $('loginMsg').className = 'msg ok'; }
  $('logoutBtn').onclick = logout; $('cvLogout').onclick = logout;

  $('meForm').onsubmit = function (ev) {
    ev.preventDefault();
    var a = $('meNew').value, b = $('meNew2').value;
    if (a !== b) { $('meMsg').textContent = 'The two new passwords are not the same'; return; }
    busy($('meBtn'), true); $('meMsg').textContent = '';
    api({ action: 'changePassword', oldPassword: $('meOld').value, newPassword: a }).then(function () {
      ['meOld', 'meNew', 'meNew2'].forEach(function (i) { $(i).value = ''; });
      storeDevice('');
      return attachDeviceIfWanted();
    }).then(function () {
      $('meMsg').textContent = 'Password updated.'; $('meMsg').className = 'msg ok';
    }).catch(function (e) { $('meMsg').textContent = e.message; $('meMsg').className = 'msg'; }).then(function () { busy($('meBtn'), false); });
  };

  function loadMenu() {
    return api({ action: 'menuList' }).then(function (r) { menuItems = r.items || []; categories = r.categories || []; renderMenu(); }).catch(function (e) { toast(e.message, true); });
  }
  function catName(id) {
    var c = categories.filter(function (x) { return x.id === id; })[0];
    return c ? (c.heading || c.name || id) : id;
  }
  function renderMenu() {
    var q = $('menuSearch').value.trim().toLowerCase();
    var list = menuItems.filter(function (it) { return !q || (it.name + ' ' + (it.description || '') + ' ' + (it.note || '')).toLowerCase().indexOf(q) >= 0; });
    var canEdit = can('menu.edit') || can('menu.price');
    var hints = [];
    if (canEdit) hints.push('Tap Edit to change a dish' + (can('menu.price') ? ', its photo or its price' : ' or its photo') + '.');
    if (can('menu.availability')) hints.push('"Out of stock" keeps a dish on the menu but marks it sold out.');
    if (canEdit && me.role !== 'owner') hints.push('Every change is saved with your name.');
    $('menuHint').textContent = hints.join(' ');
    var lastCat = null, html = '';
    list.forEach(function (it) {
      if (it.category !== lastCat) { html += '<div class="cat">' + esc(catName(it.category) || 'Other') + '</div>'; lastCat = it.category; }
      html += '<div class="dish' + (it.sold_out ? ' off' : '') + '" data-dish="' + esc(it.id) + '">' +
        (it.photo ? '<img src="' + esc(photoSrc(it.photo)) + '" alt="" loading="lazy" />' : '<div class="thumb-ph"></div>') +
        '<div><div class="nm">' + esc(it.name) + '</div>' +
        '<div class="nt">' + esc(it.description || it.note || '') + '</div>' +
        '<div><span class="price">' + priceLabel(it) + '</span> ' + (it.sold_out ? '<span class="badge bad">Out of stock</span>' : '<span class="badge ok">Available</span>') + '</div></div>' +
        '<div class="acts">' +
        (can('menu.availability') ? '<button class="btn ' + (it.sold_out ? 'btn-frost' : 'btn-ghost') + ' sm" data-avail="' + esc(it.id) + '" type="button">' + (it.sold_out ? 'Available' : 'Out of stock') + '</button>' : '') +
        (canEdit ? '<button class="btn btn-ghost sm" data-edit="' + esc(it.id) + '" type="button">Edit</button>' : '') +
        '</div></div>';
    });
    $('menuList').innerHTML = html || '<p class="muted">' + (q ? 'No dish matches.' : 'No dishes yet.') + '</p>';
    $('menuList').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { openDish(findDish(b.getAttribute('data-edit'))); }; });
    $('menuList').querySelectorAll('[data-avail]').forEach(function (b) {
      b.onclick = function () {
        var it = findDish(b.getAttribute('data-avail')); busy(b, true);
        api({ action: 'menuSetAvailable', id: it.id, sold_out: !it.sold_out }).then(function (r) {
          toast(r.item.sold_out ? it.name + ' marked out of stock' : it.name + ' is available'); return loadMenu();
        }).catch(function (e) { toast(e.message, true); busy(b, false); });
      };
    });
  }
  $('menuSearch').oninput = renderMenu;
  function findDish(id) { return menuItems.filter(function (x) { return x.id === id; })[0]; }
  $('addDishBtn').onclick = function () { openDish(null); };
  function sizeRowsHtml(sizes) {
    sizes = (sizes && sizes.length) ? sizes : [{ name: '', price: '' }];
    return sizes.map(function (s) {
      return '<div class="size-row"><input data-sname placeholder="Size name, e.g. Regular" value="' + esc(s.name || '') + '" />' +
        '<input data-sprice type="number" inputmode="decimal" step="0.01" min="0" max="500" placeholder="Price" value="' + (s.price == null || s.price === '' ? '' : esc(s.price)) + '" />' +
        '<button type="button" class="btn btn-ghost sm" data-sdel aria-label="Remove size">✕</button></div>';
    }).join('');
  }
  function readSizes() {
    return Array.prototype.map.call(document.querySelectorAll('#dSizes .size-row'), function (row) {
      return { name: row.querySelector('[data-sname]').value.trim(), price: row.querySelector('[data-sprice]').value };
    }).filter(function (s) { return s.name || s.price !== ''; });
  }
  function bindSizeEditor() {
    var box = $('dSizes');
    box.onclick = function (e) {
      var del = e.target.closest('[data-sdel]');
      if (!del) return;
      var row = del.closest('.size-row');
      if (box.querySelectorAll('.size-row').length === 1) {
        row.querySelector('[data-sname]').value = '';
        row.querySelector('[data-sprice]').value = '';
        return;
      }
      row.remove();
    };
    $('dAddSize').onclick = function () {
      var wrap = document.createElement('div');
      wrap.innerHTML = sizeRowsHtml([{ name: '', price: '' }]);
      box.appendChild(wrap.firstChild);
    };
  }
  function openDish(it) {
    var isNew = !it;
    it = it || { id: '', name: '', description: '', note: '', price: '', sizes: [], photo: '', order: menuItems.length + 1, sold_out: false, category: (categories[0] && categories[0].id) || '' };
    var dE = isNew ? '' : (can('menu.edit') ? '' : ' disabled'), dP = isNew || can('menu.price') ? '' : ' disabled';
    var dA = isNew || can('menu.availability') ? '' : ' disabled';
    var catOpts = categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === it.category ? ' selected' : '') + '>' + esc(c.heading || c.name) + '</option>';
    }).join('');
    var hasSizes = it.sizes && it.sizes.length;
    openSheet('<h2>' + (isNew ? 'Add a dish' : 'Edit dish') + '</h2>' +
      (it.updatedBy ? '<p class="hint">Last changed by ' + esc(it.updatedBy) + ' · ' + esc(it.updatedAt) + '</p>' : '') +
      '<label for="dName">Name</label><input id="dName" maxlength="80" value="' + esc(it.name) + '"' + dE + ' />' +
      '<label for="dDesc">Description</label><textarea id="dDesc" maxlength="500"' + dE + '>' + esc(it.description || '') + '</textarea>' +
      '<label for="dCat">Section</label><select id="dCat"' + dE + '>' + catOpts + '</select>' +
      '<div class="row2"><div><label for="dPrice">Price (£) if no sizes</label><input id="dPrice" type="number" inputmode="decimal" step="0.01" min="0" max="500" value="' + (hasSizes || it.price == null ? '' : esc(it.price)) + '"' + dP + ' /></div>' +
      '<div><label for="dOrder">Order on menu</label><input id="dOrder" type="number" inputmode="numeric" step="1" min="0" value="' + esc(it.order) + '"' + dE + ' /></div></div>' +
      '<label>Sizes (optional)</label><div id="dSizes">' + sizeRowsHtml(hasSizes ? it.sizes : []) + '</div>' +
      (dP ? '' : '<button type="button" class="btn btn-ghost sm" id="dAddSize">+ Add size</button>') +
      (dE ? '' : '<button type="button" class="btn btn-ghost sm" id="dPick">Choose photo</button><input id="dFile" type="file" accept="image/*" class="hidden" />') +
      '<div class="preview"><img id="dPrev" alt="" /><span class="hint" id="dPrevTxt"></span></div>' +
      '<label for="dPhoto">or paste a link</label><input id="dPhoto" value="' + esc(it.photo || '') + '" placeholder="https://… or img/dishes/chai.jpg"' + dE + ' />' +
      '<label for="dVisible">On the menu</label><select id="dVisible"' + dA + '><option value="false">Available</option><option value="true">Out of stock</option></select>' +
      (!isNew && !can('menu.price') ? '<p class="hint">Your account cannot change prices.</p>' : '') +
      '<p class="msg" id="dMsg"></p>' +
      '<div class="row2"><button class="btn btn-ghost" id="dCancel" type="button">Cancel</button><button class="btn btn-primary" id="dSave" type="button">' + (isNew ? 'Add dish' : 'Save') + '</button></div>' +
      (!isNew && can('menu.delete') ? '<button class="btn btn-danger" id="dDelete" type="button">Delete this dish</button>' : ''));
    $('dVisible').value = it.sold_out ? 'true' : 'false';
    if (dP) document.querySelectorAll('#dSizes input').forEach(function (i) { i.disabled = true; });
    bindSizeEditor();
    function prev() {
      var v = $('dPhoto').value.trim();
      $('dPrev').src = v ? photoSrc(v) : '../img/logo-800.webp'; $('dPrevTxt').textContent = v ? '' : 'No photo – the logo is shown';
    }
    $('dPhoto').oninput = prev; prev();
    if ($('dPick')) {
      $('dPick').onclick = function () { $('dFile').click(); };
      $('dFile').onchange = function () {
        var file = $('dFile').files && $('dFile').files[0];
        $('dFile').value = '';
        if (!file) return;
        var btn = $('dPick');
        busy(btn, true);
        $('dPrevTxt').textContent = 'Preparing photo…';
        shrinkPhoto(file, function (dataUrl, raw) {
          $('dPrev').src = dataUrl;
          $('dPrevTxt').textContent = 'Uploading…';
          api({ action: 'imageUpload', data: raw, mimeType: 'image/jpeg', filename: (file.name || 'dish') + '.jpg' }).then(function (r) {
            $('dPhoto').value = r.url; prev(); $('dPrevTxt').textContent = 'Photo ready – tap Save to keep it';
            busy(btn, false);
          }).catch(function (e) {
            $('dPrevTxt').textContent = e.message || 'Upload failed';
            busy(btn, false);
          });
        }, function (msg) {
          $('dPrevTxt').textContent = msg;
          busy(btn, false);
        });
      };
    }
    $('dCancel').onclick = closeSheet;
    $('dSave').onclick = function () {
      var item = { id: it.id };
      var sizes = readSizes();
      if (isNew || can('menu.edit')) {
        item.name = $('dName').value; item.description = $('dDesc').value; item.photo = $('dPhoto').value;
        item.order = $('dOrder').value; item.category = $('dCat').value;
      }
      if (isNew || can('menu.price')) { item.price = $('dPrice').value; item.sizes = sizes; }
      if (isNew || can('menu.availability')) item.sold_out = $('dVisible').value === 'true';
      if (('name' in item) && !String(item.name).trim()) { $('dMsg').textContent = 'Type the dish name'; return; }
      if (('sizes' in item) && item.sizes.length) {
        var bad = item.sizes.some(function (s) { return !s.name || s.price === '' || isNaN(Number(s.price)); });
        if (bad) { $('dMsg').textContent = 'Each size needs a name and a price'; return; }
      } else if (('price' in item) && !item.sizes.length && (item.price === '' || isNaN(Number(item.price)))) {
        $('dMsg').textContent = 'Type a price, e.g. 4.50, or add sizes'; return;
      }
      busy($('dSave'), true);
      api({ action: 'menuSave', item: item }).then(function (r) {
        closeSheet(); toast(r.unchanged ? 'Nothing changed' : (isNew ? 'Dish added' : 'Saved')); loadMenu();
      }).catch(function (e) { $('dMsg').textContent = e.message; busy($('dSave'), false); });
    };
    if ($('dDelete')) $('dDelete').onclick = function () {
      confirmSheet('Delete ' + it.name + '?', 'It disappears from the customer menu straight away. The activity log keeps a copy of its details.', 'Delete', true).then(function (ok) {
        if (!ok) return;
        api({ action: 'menuDelete', id: it.id }).then(function () { toast('Deleted ' + it.name); loadMenu(); }).catch(function (e) { toast(e.message, true); });
      });
    };
  }

  /* ---------- site texts ---------- */
  function loadTexts() {
    return api({ action: 'textsList' }).then(function (r) {
      textRows = r.texts || [];
      var groups = [];
      textRows.forEach(function (t) { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
      var html = '';
      groups.forEach(function (g) {
        html += '<h3 class="tgroup">' + esc(g || 'Other') + '</h3>';
        textRows.filter(function (t) { return t.group === g; }).forEach(function (t) {
          var multi = t.value.indexOf('\n') >= 0 || (t.value || '').length > 80 || t.key === 'meta.description' || t.key === 'story.text' || t.key === 'hero.lead';
          html += '<div class="tfield"><label for="t-' + esc(t.key) + '">' + esc(t.label) + '</label>';
          if (multi) html += '<textarea id="t-' + esc(t.key) + '" data-tkey="' + esc(t.key) + '"' + (can('texts.edit') ? '' : ' disabled') + '>' + esc(t.value) + '</textarea>';
          else html += '<input id="t-' + esc(t.key) + '" data-tkey="' + esc(t.key) + '" value="' + esc(t.value) + '"' + (can('texts.edit') ? '' : ' disabled') + ' />';
          html += '</div>';
        });
      });
      $('textsForm').innerHTML = html || '<p class="muted">No site texts yet.</p>';
      show('textsSaveBtn', can('texts.edit'));
      $('textsMsg').textContent = '';
    }).catch(function (e) { toast(e.message, true); });
  }
  $('textsSaveBtn').onclick = function () {
    var texts = {};
    document.querySelectorAll('#textsForm [data-tkey]').forEach(function (el) { texts[el.getAttribute('data-tkey')] = el.value; });
    busy($('textsSaveBtn'), true); $('textsMsg').textContent = '';
    api({ action: 'textsSave', texts: texts }).then(function (r) {
      toast(r.unchanged ? 'Nothing changed' : 'Site texts saved');
      return loadTexts();
    }).catch(function (e) { $('textsMsg').textContent = e.message; }).then(function () { busy($('textsSaveBtn'), false); });
  };

  /* ---------- people (owners) ---------- */
  function status(p) {
    if (!p.active) return '<span class="badge bad">Off</span>';
    if (p.locked) return '<span class="badge warn">Locked</span>';
    if (p.mustChange) return '<span class="badge warn">First login due</span>';
    return '<span class="badge ok">Active</span>';
  }
  function loadPeople() {
    api({ action: 'usersList' }).then(function (r) {
      people = r.users || [];
      people.sort(function (a, b) { return (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1) || a.displayName.localeCompare(b.displayName); });
      $('peopleList').innerHTML = people.map(function (p) {
        return '<div class="person" data-person="' + esc(p.username) + '" role="button" tabindex="0"><div><b>' + esc(p.displayName) + '</b> ' + status(p) +
          '<div class="muted">@' + esc(p.username) + ' · ' + (p.role === 'owner' ? 'Owner' : 'Employee') + (p.lastLogin ? ' · last in ' + esc(p.lastLogin.slice(0, 16)) : ' · never logged in') + '</div></div>' +
          '</div>';
      }).join('');
      $('peopleList').querySelectorAll('[data-person]').forEach(function (el) { el.onclick = function () { openPerson(el.getAttribute('data-person')); }; });
    }).catch(function (e) { toast(e.message, true); });
  }
  $('addPersonBtn').onclick = function () {
    openSheet('<h2>Add a person</h2>' +
      '<label for="npName">Their name</label><input id="npName" maxlength="40" />' +
      '<label for="npRole">Role</label><select id="npRole"><option value="staff">Employee – limited</option><option value="owner">Owner – can do everything</option></select>' +
      '<p class="msg" id="npMsg"></p>' +
      '<div class="row2"><button class="btn btn-ghost" id="npCancel" type="button">Cancel</button><button class="btn btn-primary" id="npSave" type="button">Create login</button></div>');
    $('npCancel').onclick = closeSheet;
    $('npSave').onclick = function () {
      var name = $('npName').value.trim();
      if (!name) { $('npMsg').textContent = 'Type the person\'s name'; return; }
      busy($('npSave'), true);
      api({ action: 'userAdd', user: { displayName: name, role: $('npRole').value } }).then(function (r) {
        secretSheet('Login created', r.displayName, r.username, r.tempPassword); loadPeople();
      }).catch(function (e) { $('npMsg').textContent = e.message; busy($('npSave'), false); });
    };
  };
  function devicesHtml(p) {
    var list = p.devices || [];
    if (!list.length) return '<p class="hint">No remembered devices.</p>';
    return '<p class="hint">Remembered devices</p>' + list.map(function (d) {
      return '<div class="device"><div><b>' + esc(d.label) + '</b><div class="muted">Last used ' + esc(d.lastUsed || '') +
        (d.created ? ' · saved ' + esc(d.created) : '') + '</div></div>' +
        '<button class="btn btn-ghost sm" type="button" data-revoke-device="' + esc(d.id) + '">Revoke</button></div>';
    }).join('');
  }
  function bindDeviceRevokes(p) {
    document.querySelectorAll('[data-revoke-device]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-revoke-device');
        var d = (p.devices || []).filter(function (x) { return x.id === id; })[0];
        confirmSheet('Revoke this device?', 'They will need to type their password the next time they open the admin on that phone.', 'Revoke', true).then(function (ok) {
          if (!ok) return;
          api({ action: 'deviceRevoke', username: p.username, deviceId: id }).then(function () {
            toast('Device revoked' + (d && d.label ? ' (' + d.label + ')' : '')); closeSheet(); loadPeople();
          }).catch(function (e) { if ($('pMsg')) $('pMsg').textContent = e.message; else toast(e.message, true); });
        });
      };
    });
  }
    function openPerson(u) {
    var p = people.filter(function (x) { return x.username === u; })[0]; if (!p) return;
    openSheet('<h2>' + esc(p.displayName) + '</h2>' +
      '<div class="kv"><b>Username</b><span>' + esc(p.username) + '</span><b>Role</b><span>' + (p.role === 'owner' ? 'Owner' : 'Employee') + '</span>' +
      '<b>Status</b><span>' + status(p) + '</span></div>' +
      '<p class="msg" id="pMsg"></p>' +
      (u === me.username ? '<p class="hint">This is you. Use Me to change your password. You cannot switch yourself off or change your own role.</p>' :
        '<button class="btn btn-primary" id="pReset" type="button">Reset password</button>' +
        '<button class="btn btn-ghost" id="pRole" type="button">Make ' + (p.role === 'owner' ? 'an employee' : 'an owner') + '</button>' +
        '<button class="btn btn-ghost" id="pActive" type="button">' + (p.active ? 'Switch off' : 'Switch on') + '</button>' +
        '<button class="btn btn-danger" id="pRemove" type="button">Remove</button>') +
      devicesHtml(p) +
      '<button class="btn btn-ghost" id="pClose" type="button">Close</button>');
    $('pClose').onclick = closeSheet;
    bindDeviceRevokes(p);
    var fail = function (e) { if ($('pMsg')) $('pMsg').textContent = e.message; else toast(e.message, true); };
    if ($('pReset')) $('pReset').onclick = function () {
      confirmSheet('Reset ' + p.displayName + '\'s password?', 'They are logged out everywhere and get a new first password (also unlocks a locked account).', 'Reset').then(function (ok) {
        if (!ok) return;
        api({ action: 'userResetPassword', username: p.username }).then(function (r) { secretSheet('New first password', p.displayName, r.username, r.tempPassword); loadPeople(); }).catch(fail);
      });
    };
    if ($('pRole')) $('pRole').onclick = function () {
      var to = p.role === 'owner' ? 'staff' : 'owner';
      api({ action: 'userUpdate', username: p.username, changes: { role: to } }).then(function () { closeSheet(); toast(p.displayName + ' is now ' + (to === 'owner' ? 'an owner' : 'an employee')); loadPeople(); }).catch(fail);
    };
    if ($('pActive')) $('pActive').onclick = function () {
      api({ action: 'userUpdate', username: p.username, changes: { active: !p.active } }).then(function () { closeSheet(); toast(p.displayName + (p.active ? ' switched off' : ' switched on')); loadPeople(); }).catch(fail);
    };
    if ($('pRemove')) $('pRemove').onclick = function () {
      confirmSheet('Remove ' + p.displayName + '?', 'Their login is deleted. Tip: "Switch off" instead keeps their name in the history.', 'Remove', true).then(function (ok) {
        if (!ok) return;
        api({ action: 'userRemove', username: p.username }).then(function () { toast('Removed ' + p.displayName); loadPeople(); }).catch(function (e) { toast(e.message, true); });
      });
    };
  }

  function loadActivity() {
    var who = $('actWho').value;
    api({ action: 'activity', user: who, limit: 150 }).then(function (r) {
      var seen = {};
      (r.entries || []).forEach(function (x) { seen[x.who] = 1; });
      if (!$('actWho').getAttribute('data-ready')) {
        var opts = '<option value="">Everyone</option>' + Object.keys(seen).sort().map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + '</option>'; }).join('');
        $('actWho').innerHTML = opts; $('actWho').setAttribute('data-ready', '1');
      }
      $('actList').innerHTML = (r.entries || []).map(function (x) {
        return '<div class="entry"><div class="top"><b>' + esc(x.action) + '</b><span class="muted">' + esc(x.when) + '</span></div>' +
          '<div class="det">' + esc(x.who) + (x.role ? ' · ' + esc(x.role) : '') + (x.item ? ' · ' + esc(x.item) : '') + (x.details ? ' — ' + esc(x.details) : '') + '</div></div>';
      }).join('') || '<p class="muted">No activity yet.</p>';
    }).catch(function (e) { toast(e.message, true); });
  }
  $('actWho').onchange = loadActivity;

  function boot() {
    if (!FFApi.ready()) { showLogin(''); return; }
    function afterResume() { if (me && me.mustChangePassword) showChange(false); else showApp(); }
    if (token) {
      api({ action: 'me' }).then(function (r) {
        me = r.user; localStorage.setItem(UK, JSON.stringify(me));
        afterResume();
      }).catch(function (e) { if (e.code !== 'auth') showLogin(e.message); });
    } else if (deviceToken) {
      resumeWithDevice().then(function (ok) { if (ok) afterResume(); else showLogin(''); });
    } else {
      showLogin('');
    }
  }
  boot();
})();
