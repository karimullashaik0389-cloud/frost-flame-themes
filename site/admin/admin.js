(() => {
  "use strict";

  const OWNER = "karimullashaik0389-cloud";
  const REPO = "frost-flame-themes";
  const FILE_PATH = "site/data/menu.json";
  const TOKEN_KEY = "ff-admin-gh-token";
  const API = "https://api.github.com";
  const COMMIT_MESSAGE = "Admin: update menu";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $("#app");

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const state = {
    token: null,
    menu: null,
    sha: null,
    baseline: "",
    query: "",
    view: "list", // list | category
    activeCat: null,
    busy: false,
    loginError: "",
    toast: "",
    toastType: "",
    pendingDeleteId: null,
    pendingDeleteCat: null,
    pendingPhotos: {},
    photoTarget: null,
    busyLabel: "",
  };

  const apiHeaders = (token) => ({
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
  });

  const decodeBase64 = (b64) => {
    const clean = String(b64 || "").replace(/\s/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin);
  };

  const friendlyHttpError = (status, forWrite) => {
    if (status === 401) return "That sign-in code was not accepted. Check you copied it in full.";
    if (status === 403) {
      return forWrite
        ? "This sign-in code cannot save the menu. Make a new one that can change the frost-flame-themes files."
        : "This sign-in code cannot read the menu. Make a new one that can change the frost-flame-themes files.";
    }
    if (status === 404) return "This sign-in code cannot see the Frost & Flame menu. Check it is only for the frost-flame-themes project.";
    if (status === 409) return "The menu was changed somewhere else. Close this page, open it again, and try once more.";
    return "Something went wrong (" + status + "). Please try again.";
  };

  const loadFile = async (token) => {
    const url = API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH;
    let res;
    try {
      res = await fetch(url, { headers: apiHeaders(token) });
    } catch (_) {
      throw new Error("Could not reach the internet. Check your connection and try again.");
    }
    if (!res.ok) throw new Error(friendlyHttpError(res.status, false));
    const data = await res.json();
    if (!data || !data.content || !data.sha) throw new Error("The menu could not be read. Please try again.");
    let parsed;
    try {
      parsed = JSON.parse(decodeBase64(data.content));
    } catch (_) {
      throw new Error("The menu file was not valid. Please try again.");
    }
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.categories)) {
      throw new Error("The menu file was not valid. Please try again.");
    }
    return { menu: parsed, sha: data.sha };
  };

  const parsePrice = (raw) => {
    const s = String(raw ?? "").trim().replace(/^£/, "").replace(/,/g, "");
    if (s === "") return { ok: true, value: null };
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return { ok: false };
    return { ok: true, value: Math.round(n * 100) / 100 };
  };

  const hasPrice = (item) => {
    if (item.price != null && item.price !== "" && Number.isFinite(Number(item.price))) return true;
    if (item.sizes && item.sizes.some((s) => s.price != null && s.price !== "" && Number.isFinite(Number(s.price)))) return true;
    return false;
  };

  const priceShown = (v) => (v == null || v === "" ? "" : String(v));

  const PHOTO_MAX_WIDTH = 1200;
  const PHOTO_MAX_BYTES = 300 * 1024;
  const PHOTO_DIR = "site/img/dishes/";
  const PHOTO_MENU_PREFIX = "img/dishes/";

  const encodeBytes = (bytes) => {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  };

  const encodeBlob = async (blob) => {
    const buf = await blob.arrayBuffer();
    return encodeBytes(new Uint8Array(buf));
  };

  const photoSrc = (photo) => {
    if (!photo) return "";
    if (/^(https?:|blob:|data:)/i.test(photo)) return photo;
    if (photo.startsWith("../")) return photo;
    return "../" + photo.replace(/^\//, "");
  };

  const revokePreview = (id) => {
    const pending = state.pendingPhotos[id];
    if (pending && pending.preview && String(pending.preview).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(pending.preview);
      } catch (_) {}
    }
  };

  const dishPhoto = (id, item) => {
    const pending = state.pendingPhotos[id];
    if (pending && pending.preview) return pending.preview;
    return item && item.photo ? photoSrc(item.photo) : "";
  };

  const loadImage = (file) =>
    new Promise((resolve, reject) => {
      const fail = () => reject(new Error("That photo could not be read. Please try another picture."));
      const fromUrl = (url, revoke) => {
        const img = new Image();
        img.onload = () => {
          if (revoke) URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          if (revoke) URL.revokeObjectURL(url);
          fail();
        };
        img.src = url;
      };
      if (typeof createImageBitmap === "function") {
        createImageBitmap(file)
          .then(resolve)
          .catch(() => fromUrl(URL.createObjectURL(file), true));
        return;
      }
      fromUrl(URL.createObjectURL(file), true);
    });

  const canvasBlob = (canvas, type, quality) =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b || null), type, quality));

  const compressImage = async (file) => {
    if (!file) throw new Error("Please choose a photo.");
    const kind = String(file.type || "");
    if (kind && !kind.startsWith("image/")) throw new Error("Please choose a photo.");
    const source = await loadImage(file);
    let w = source.width;
    let h = source.height;
    if (!w || !h) throw new Error("That photo could not be read. Please try another picture.");
    if (w > PHOTO_MAX_WIDTH) {
      h = Math.max(1, Math.round((h * PHOTO_MAX_WIDTH) / w));
      w = PHOTO_MAX_WIDTH;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const draw = (cw, ch) => {
      canvas.width = cw;
      canvas.height = ch;
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(source, 0, 0, cw, ch);
    };
    draw(w, h);

    const shrinkToFit = async (type) => {
      let tw = canvas.width;
      let th = canvas.height;
      let quality = 0.82;
      let blob = await canvasBlob(canvas, type, quality);
      if (!blob) return null;
      while (blob.size > PHOTO_MAX_BYTES && quality > 0.42) {
        quality = Math.round((quality - 0.12) * 100) / 100;
        blob = await canvasBlob(canvas, type, quality);
        if (!blob) return null;
      }
      while (blob.size > PHOTO_MAX_BYTES && tw > 640) {
        tw = Math.max(640, Math.round(tw * 0.85));
        th = Math.max(1, Math.round(th * 0.85));
        draw(tw, th);
        blob = await canvasBlob(canvas, type, 0.7);
        if (!blob) return null;
      }
      return blob;
    };

    let blob = await shrinkToFit("image/webp");
    let ext = "webp";
    if (!blob) {
      blob = await shrinkToFit("image/jpeg");
      ext = "jpg";
    }
    if (!blob) throw new Error("That photo could not be prepared. Please try another picture.");
    if (blob.size > 360 * 1024) {
      throw new Error("That photo is still too large after shrinking. Please try another picture.");
    }
    return { blob, ext };
  };

  const photoBlockHTML = (id, item) => {
    const src = dishPhoto(id, item);
    const has = !!src;
    const label = has ? "Change photo" : "Add photo";
    const img = has
      ? `<img class="photo-thumb" src="${escapeHtml(src)}" alt="">`
      : `<div class="photo-placeholder">No photo yet</div>`;
    return `<div class="photo-block" data-photo-block="${escapeHtml(id)}">
      ${img}
      <div class="photo-actions${has ? " has-remove" : ""}">
        <button class="btn btn-frost btn-small" type="button" data-pick-photo="${escapeHtml(id)}">${label}</button>
        ${has ? `<button class="btn btn-ghost btn-small" type="button" data-remove-photo="${escapeHtml(id)}">Remove photo</button>` : ""}
      </div>
    </div>`;
  };

  const visibleCategories = () =>
    (state.menu.categories || []).filter((c) => !c.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));

  const itemsIn = (catId) =>
    (state.menu.items || [])
      .filter((i) => i.category === catId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  const catById = (id) => (state.menu.categories || []).find((c) => c.id === id);

  const catLabel = (cat) => (cat && (cat.heading || cat.name)) || "Section";

  const matchesQuery = (item, cat) => {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    const hay = [item.name, item.description, cat && cat.name, cat && cat.heading]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const slugify = (name, existing) => {
    const base =
      String(name || "new")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "new";
    const ids = new Set(existing);
    if (!ids.has(base)) return base;
    let n = 2;
    while (ids.has(base + "-" + n)) n += 1;
    return base + "-" + n;
  };

  const cleanMenu = (menu) => {
    const copy = JSON.parse(JSON.stringify(menu));
    (copy.items || []).forEach((it) => {
      delete it._new;
    });
    return copy;
  };

  const markClean = () => {
    state.baseline = JSON.stringify(cleanMenu(state.menu));
  };

  const changeCount = () => {
    if (!state.menu || !state.baseline) return 0;
    let a;
    try {
      a = JSON.parse(state.baseline);
    } catch (_) {
      return 0;
    }
    const b = cleanMenu(state.menu);
    let n = 0;
    const aItems = new Map((a.items || []).map((i) => [i.id, i]));
    const bItems = new Map((b.items || []).map((i) => [i.id, i]));
    for (const id of bItems.keys()) if (!aItems.has(id)) n += 1;
    for (const id of aItems.keys()) if (!bItems.has(id)) n += 1;
    for (const [id, item] of bItems) {
      const old = aItems.get(id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) n += 1;
    }
    const aCats = new Map((a.categories || []).map((c) => [c.id, c]));
    const bCats = new Map((b.categories || []).map((c) => [c.id, c]));
    for (const id of bCats.keys()) if (!aCats.has(id)) n += 1;
    for (const id of aCats.keys()) if (!bCats.has(id)) n += 1;
    for (const [id, cat] of bCats) {
      const old = aCats.get(id);
      if (old && JSON.stringify(old) !== JSON.stringify(cat)) n += 1;
    }
    const pending = Object.keys(state.pendingPhotos).filter((id) => id !== "__add__");
    n += pending.length;
    return n;
  };

  const isDirty = () => changeCount() > 0;

  const isVegItem = (item) => {
    const diet = item.diet || [];
    return diet.includes("V") || diet.includes("VG");
  };

  const setVeg = (item, veg) => {
    const extra = (item.diet || []).filter((d) => d !== "V" && d !== "VG" && d !== "NV");
    item.diet = veg ? ["V", ...extra] : ["NV", ...extra];
  };

  /* ---------- render ---------- */

  const headerHTML = () => `
    <header class="header">
      <div class="logo">
        <img src="../img/logo-800.webp" alt="">
        <div class="logo-text">
          <strong>Frost &amp; Flame</strong>
          <span>Change the menu</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-pill btn-small" type="button" data-logout>Log out</button>
    </header>`;

  const saveBarHTML = () => {
    const n = changeCount();
    const toast = state.toast
      ? `<div class="toast${state.toastType === "error" ? " error-toast" : ""}" role="status" data-toast>${escapeHtml(state.toast)}</div>`
      : "";
    let bar = "";
    if (n || state.busy) {
      const label = n === 1 ? "Save changes (1)" : "Save changes (" + n + ")";
      bar = `<div class="save-bar">
      <button class="btn btn-frost" type="button" data-save ${state.busy ? "disabled" : ""} data-testid="save-bar">
        ${state.busy ? escapeHtml(state.busyLabel || "Saving…") : escapeHtml(label)}
      </button>
    </div>`;
    }
    if (!toast && !bar) return "";
    return `<div class="save-stack">${toast}${bar}</div>`;
  };

  const priceBox = (label, value, attrs) => `
    <div class="price-box">
      <span class="lbl">${escapeHtml(label)}</span>
      <div class="price-wrap">
        <span class="pound">£</span>
        <input class="field" ${attrs} inputmode="decimal" placeholder="Not set yet" value="${escapeHtml(priceShown(value))}" aria-label="${escapeHtml(label)}">
      </div>
    </div>`;

  const cardHTML = (item, cat) => {
    const pending = !hasPrice(item);
    const sizes = item.sizes && item.sizes.length ? item.sizes : null;
    let prices = "";
    if (sizes) {
      prices = `<div class="option-grid">${sizes
        .map((s, i) => priceBox(s.name, s.price, 'data-size-price="' + i + '"'))
        .join("")}</div>`;
    } else {
      prices = priceBox("Price", item.price, "data-price");
    }
    const extras = [];
    (item.choices || []).forEach((c, ci) => {
      const useful = (c.options || []).some((o) => Number(o.add || 0) !== 0);
      if (!useful) return;
      (c.options || []).forEach((o, oi) => {
        extras.push(priceBox((c.label ? c.label + " · " : "") + o.name, o.add ?? 0, 'data-add-price data-choice="' + ci + '" data-option="' + oi + '"'));
      });
    });
    const section = cat ? `<span class="pending-tag">${escapeHtml(catLabel(cat))}</span>` : "";
    return `
      <article class="card${pending ? " is-pending" : ""}${item.sold_out ? " is-sold" : ""}" data-id="${escapeHtml(item.id)}" data-testid="dish-card">
        <h2 class="card-name">${escapeHtml(item.name)}</h2>
        ${photoBlockHTML(item.id, item)}
        ${pending ? `<span class="pending-tag">Price coming soon</span>` : ""}
        ${state.query && cat ? section : ""}
        ${prices}
        ${extras.length ? `<div class="option-grid">${extras.join("")}</div>` : ""}
        <div class="switch-row">
          <span>Sold out</span>
          <label class="switch">
            <input data-sold type="checkbox" ${item.sold_out ? "checked" : ""} aria-label="Sold out">
            <span></span>
          </label>
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-small" type="button" data-edit="${escapeHtml(item.id)}">Edit</button>
          <button class="btn btn-danger-solid btn-small" type="button" data-delete="${escapeHtml(item.id)}">Delete</button>
        </div>
      </article>`;
  };

  const renderLogin = () => {
    app.innerHTML = `
      <main class="login">
        <div class="logo">
          <img src="../img/logo-800.webp" alt="Frost &amp; Flame">
        </div>
        <h1>Change the menu</h1>
        <p>Paste the sign-in code you made on GitHub, then you can change prices, add dishes or take them off.</p>
        ${state.loginError ? `<p class="error" role="alert">${escapeHtml(state.loginError)}</p>` : ""}
        <form id="login-form">
          <div class="field-row">
            <label for="token">Sign-in code</label>
            <input class="field" id="token" name="token" type="password" autocomplete="off" spellcheck="false" required>
          </div>
          <button class="btn btn-frost btn-wide" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Checking…" : "Sign in"}</button>
        </form>
        <p class="hint"><a href="HOW-TO.md">How to make the sign-in code</a></p>
      </main>`;
    $("#login-form").addEventListener("submit", onLogin);
  };

  const renderList = () => {
    const q = state.query.trim();
    let body;
    if (q) {
      const cards = [];
      visibleCategories().forEach((cat) => {
        itemsIn(cat.id)
          .filter((i) => matchesQuery(i, cat))
          .forEach((i) => cards.push(cardHTML(i, cat)));
      });
      body = cards.length
        ? `<div class="cards">${cards.join("")}</div>`
        : `<p class="empty">No dishes match that search.</p>`;
    } else {
      const buttons = visibleCategories()
        .map((cat) => {
          const n = itemsIn(cat.id).length;
          const count = n === 1 ? "1 dish" : n + " dishes";
          return `<button class="cat-btn" type="button" data-open-cat="${escapeHtml(cat.id)}">
            <strong>${escapeHtml(catLabel(cat))}</strong>
            <span>${count}</span>
          </button>`;
        })
        .join("");
      body = `<div class="cat-list" data-testid="cat-list">
        <button class="cat-btn cat-add" type="button" data-add-cat>+ Add category</button>
        ${buttons}
      </div>`;
    }
    app.innerHTML = `
      ${headerHTML()}
      <main class="wrap">
        <input class="field search" type="search" placeholder="Search dishes" value="${escapeHtml(state.query)}" data-search aria-label="Search dishes">
        ${body}
      </main>
      ${dialogsHTML()}
      ${saveBarHTML()}`;
  };

  const renderCategory = () => {
    const cat = catById(state.activeCat);
    if (!cat) {
      state.view = "list";
      renderList();
      return;
    }
    const items = itemsIn(cat.id);
    const cards = items.map((i) => cardHTML(i, null)).join("");
    app.innerHTML = `
      ${headerHTML()}
      <main class="wrap">
        <button class="back" type="button" data-back>← All sections</button>
        <div class="cat-title">
          <h1>${escapeHtml(catLabel(cat))}</h1>
          <div class="cat-actions">
            <button class="btn btn-ghost btn-small" type="button" data-rename-cat="${escapeHtml(cat.id)}">Rename</button>
            <button class="btn btn-danger-solid btn-small" type="button" data-delete-cat="${escapeHtml(cat.id)}">Delete</button>
          </div>
        </div>
        <input class="field search" type="search" placeholder="Search dishes" value="${escapeHtml(state.query)}" data-search aria-label="Search dishes">
        <button class="btn btn-frost add-dish" type="button" data-add-dish>+ Add dish</button>
        <div class="cards">
          ${cards || `<p class="empty">No dishes in this section yet.</p>`}
        </div>
      </main>
      ${dialogsHTML(cat.id)}
      ${saveBarHTML()}`;
  };

  const dialogsHTML = (preselectCat) => {
    const cats = visibleCategories();
    const catOpts = cats
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${c.id === preselectCat ? "selected" : ""}>${escapeHtml(catLabel(c))}</option>`
      )
      .join("");
    return `
      <dialog class="modal" id="add-dish-dialog">
        <form class="modal-inner" id="add-dish-form" method="dialog">
          <h2>Add a dish</h2>
          <div class="field-row">
            <span class="lbl">Name</span>
            <input class="field" name="name" type="text" required>
          </div>
          <div class="field-row">
            <span class="lbl">Price</span>
            <div class="price-wrap">
              <span class="pound">£</span>
              <input class="field" name="price" inputmode="decimal" placeholder="Not set yet" style="min-height:3.2rem;font-size:1.4rem;padding-left:2.15rem">
            </div>
          </div>
          <div class="field-row">
            <span class="lbl">Section</span>
            <select class="field" name="category" required>${catOpts}</select>
          </div>
          <span class="lbl">Veg or non-veg</span>
          <div class="radio-row">
            <label><input type="radio" name="veg" value="yes" checked> Veg</label>
            <label><input type="radio" name="veg" value="no"> Non-veg</label>
          </div>
          <div class="field-row">
            <span class="lbl">Short description</span>
            <textarea class="field" name="description"></textarea>
          </div>
          <div class="field-row">
            <span class="lbl">Photo</span>
            ${photoBlockHTML("__add__", { photo: null })}
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-close="add-dish-dialog">Cancel</button>
            <button class="btn btn-frost" type="submit">Add</button>
          </div>
        </form>
      </dialog>
      <dialog class="modal" id="edit-dish-dialog">
        <form class="modal-inner" id="edit-dish-form" method="dialog">
          <h2>Edit dish</h2>
          <input type="hidden" name="id">
          <div class="field-row">
            <span class="lbl">Name</span>
            <input class="field" name="name" type="text" required>
          </div>
          <div class="field-row">
            <span class="lbl">Section</span>
            <select class="field" name="category" required>${catOpts}</select>
          </div>
          <span class="lbl">Veg or non-veg</span>
          <div class="radio-row">
            <label><input type="radio" name="veg" value="yes"> Veg</label>
            <label><input type="radio" name="veg" value="no"> Non-veg</label>
          </div>
          <div class="field-row">
            <span class="lbl">Short description</span>
            <textarea class="field" name="description"></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-close="edit-dish-dialog">Cancel</button>
            <button class="btn btn-frost" type="submit">Save</button>
          </div>
        </form>
      </dialog>
      <dialog class="modal" id="add-cat-dialog">
        <form class="modal-inner" id="add-cat-form" method="dialog">
          <h2>Add a category</h2>
          <div class="field-row">
            <span class="lbl">Name</span>
            <input class="field" name="name" type="text" required placeholder="e.g. Kids menu">
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-close="add-cat-dialog">Cancel</button>
            <button class="btn btn-frost" type="submit">Add</button>
          </div>
        </form>
      </dialog>
      <dialog class="modal" id="rename-cat-dialog">
        <form class="modal-inner" id="rename-cat-form" method="dialog">
          <h2>Rename this section</h2>
          <input type="hidden" name="id">
          <div class="field-row">
            <span class="lbl">Name</span>
            <input class="field" name="name" type="text" required>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-close="rename-cat-dialog">Cancel</button>
            <button class="btn btn-frost" type="submit">Save</button>
          </div>
        </form>
      </dialog>
      <dialog class="modal" id="confirm-dialog">
        <div class="modal-inner">
          <h2 data-confirm-title>Please confirm</h2>
          <p data-confirm-text></p>
          <div data-confirm-extra></div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-confirm-no>No</button>
            <button class="btn btn-danger-solid" type="button" data-confirm-yes>Yes</button>
          </div>
        </div>
      </dialog>`;
  };

  const render = () => {
    if (!state.token || !state.menu) {
      renderLogin();
      return;
    }
    if (state.view === "category" && !state.query.trim()) renderCategory();
    else renderList();
  };

  const refreshChrome = () => {
    $$(".save-stack, .save-bar, [data-toast]").forEach((el) => el.remove());
    app.insertAdjacentHTML("beforeend", saveBarHTML());
  };

  const showToast = (text, type, ms) => {
    state.toast = text;
    state.toastType = type || "";
    refreshChrome();
    if (ms) {
      setTimeout(() => {
        if (state.toast === text) {
          state.toast = "";
          state.toastType = "";
          refreshChrome();
        }
      }, ms);
    }
  };

  /* ---------- actions ---------- */

  const onLogin = async (e) => {
    e.preventDefault();
    const token = ($("#token") && $("#token").value || "").trim();
    if (!token) return;
    state.busy = true;
    state.loginError = "";
    renderLogin();
    try {
      const { menu, sha } = await loadFile(token);
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (_) {}
      state.token = token;
      state.menu = menu;
      state.sha = sha;
      state.busy = false;
      state.view = "list";
      markClean();
      render();
    } catch (err) {
      state.busy = false;
      state.loginError = err.message || "Could not sign in.";
      renderLogin();
    }
  };

  const logout = () => {
    if (isDirty() && !window.confirm("You have unsaved changes. Log out anyway?")) return;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
    state.token = null;
    state.menu = null;
    state.sha = null;
    state.baseline = "";
    state.loginError = "";
    state.toast = "";
    state.query = "";
    state.view = "list";
    Object.keys(state.pendingPhotos).forEach((id) => revokePreview(id));
    state.pendingPhotos = {};
    state.photoTarget = null;
    renderLogin();
  };

  const applyCardInputs = (root = document) => {
    const problems = [];
    $$(".card[data-id]", root).forEach((card) => {
      const item = state.menu.items.find((i) => i.id === card.dataset.id);
      if (!item) return;
      const sold = $("[data-sold]", card);
      if (sold) item.sold_out = !!sold.checked;
      const main = $("[data-price]", card);
      if (main) {
        const parsed = parsePrice(main.value);
        if (!parsed.ok) {
          main.classList.add("is-bad");
          problems.push(item.name + " needs a valid price, or leave it empty.");
        } else {
          main.classList.remove("is-bad");
          item.price = parsed.value;
          if (parsed.value != null) delete item.price_review;
          else item.price_review = true;
        }
      }
      $$("[data-size-price]", card).forEach((el) => {
        const parsed = parsePrice(el.value);
        const i = Number(el.dataset.sizePrice);
        if (!parsed.ok) {
          el.classList.add("is-bad");
          problems.push(item.name + " has a price that is not a number.");
        } else if (item.sizes && item.sizes[i]) {
          el.classList.remove("is-bad");
          item.sizes[i].price = parsed.value;
        }
      });
      $$("[data-add-price]", card).forEach((el) => {
        const parsed = parsePrice(el.value);
        if (!parsed.ok) {
          el.classList.add("is-bad");
          problems.push(item.name + " has a price that is not a number.");
        } else {
          el.classList.remove("is-bad");
          const opt = item.choices?.[Number(el.dataset.choice)]?.options?.[Number(el.dataset.option)];
          if (opt) opt.add = parsed.value == null ? 0 : parsed.value;
        }
      });
    });
    return { ok: problems.length === 0, problems };
  };

  const refreshAddPhotoBlock = () => {
    const mount = $("#add-dish-form [data-photo-block='__add__']");
    if (!mount) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = photoBlockHTML("__add__", { photo: null });
    mount.replaceWith(wrap.firstElementChild);
  };

  const openAddDish = () => {
    const d = $("#add-dish-dialog");
    if (!d) return;
    const form = $("#add-dish-form");
    form.reset();
    if (state.activeCat && form.category) form.category.value = state.activeCat;
    revokePreview("__add__");
    delete state.pendingPhotos["__add__"];
    refreshAddPhotoBlock();
    d.showModal();
  };

  const addDish = (e) => {
    e.preventDefault();
    const form = e.target;
    const name = String(form.name.value || "").trim();
    if (!name) return;
    const parsed = parsePrice(form.price.value);
    if (!parsed.ok) {
      showToast("Price must be a number, or left empty if you have not set it yet.", "error", 4000);
      return;
    }
    const catId = form.category.value;
    const cat = catById(catId);
    const siblings = itemsIn(catId);
    const order = siblings.length ? Math.max(...siblings.map((i) => i.order || 0)) + 1 : (cat?.order || 0) * 100;
    const item = {
      id: slugify(name, (state.menu.items || []).map((i) => i.id)),
      name,
      category: catId,
      description: String(form.description.value || "").trim(),
      diet: form.veg.value === "yes" ? ["V"] : ["NV"],
      allergens: [],
      price: parsed.value,
      sizes: null,
      choices: [],
      photo: null,
      tone: (cat && cat.tone) || "both",
      opens_build: false,
      sold_out: false,
      order,
      level: null,
      ingredients: [],
      ingredients_review: true,
    };
    if (parsed.value == null) item.price_review = true;
    if (state.pendingPhotos["__add__"]) {
      state.pendingPhotos[item.id] = state.pendingPhotos["__add__"];
      delete state.pendingPhotos["__add__"];
    }
    state.menu.items.push(item);
    $("#add-dish-dialog")?.close();
    state.view = "category";
    state.activeCat = catId;
    state.query = "";
    render();
  };

  const openEdit = (id) => {
    const item = state.menu.items.find((i) => i.id === id);
    if (!item) return;
    const form = $("#edit-dish-form");
    form.id.value = item.id;
    form.name.value = item.name;
    form.category.value = item.category;
    form.description.value = item.description || "";
    form.veg.value = isVegItem(item) ? "yes" : "no";
    $("#edit-dish-dialog").showModal();
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const form = e.target;
    const item = state.menu.items.find((i) => i.id === form.id.value);
    if (!item) return;
    const name = String(form.name.value || "").trim();
    if (!name) return;
    item.name = name;
    item.description = String(form.description.value || "").trim();
    item.category = form.category.value;
    setVeg(item, form.veg.value === "yes");
    $("#edit-dish-dialog")?.close();
    render();
  };

  const askDeleteDish = (id) => {
    const item = state.menu.items.find((i) => i.id === id);
    if (!item) return;
    state.pendingDeleteId = id;
    state.pendingDeleteCat = null;
    $("[data-confirm-title]").textContent = "Delete this dish?";
    $("[data-confirm-text]").textContent = "Delete " + item.name + "?";
    $("[data-confirm-extra]").innerHTML = "";
    $("#confirm-dialog").showModal();
  };

  const addCategory = (e) => {
    e.preventDefault();
    const name = String(e.target.name.value || "").trim();
    if (!name) return;
    const ids = (state.menu.categories || []).map((c) => c.id);
    const id = slugify(name, ids);
    const order = (state.menu.categories || []).reduce((m, c) => Math.max(m, c.order || 0), 0) + 1;
    state.menu.categories.push({
      id,
      name,
      heading: name,
      course: "main",
      order,
      hidden: false,
      tone: "both",
      split_diet: false,
    });
    $("#add-cat-dialog")?.close();
    state.view = "category";
    state.activeCat = id;
    state.query = "";
    render();
  };

  const openRenameCat = (id) => {
    const cat = catById(id);
    if (!cat) return;
    const form = $("#rename-cat-form");
    form.id.value = id;
    form.name.value = catLabel(cat);
    $("#rename-cat-dialog").showModal();
  };

  const renameCat = (e) => {
    e.preventDefault();
    const cat = catById(e.target.id.value);
    const name = String(e.target.name.value || "").trim();
    if (!cat || !name) return;
    cat.name = name;
    cat.heading = name;
    $("#rename-cat-dialog")?.close();
    render();
  };

  const askDeleteCat = (id) => {
    const cat = catById(id);
    if (!cat) return;
    const n = itemsIn(id).length;
    state.pendingDeleteId = null;
    state.pendingDeleteCat = id;
    $("[data-confirm-title]").textContent = "Delete this section?";
    if (!n) {
      $("[data-confirm-text]").textContent = "Delete " + catLabel(cat) + "?";
      $("[data-confirm-extra]").innerHTML = "";
    } else {
      $("[data-confirm-text]").textContent =
        catLabel(cat) + " still has " + n + " dish" + (n === 1 ? "" : "es") + ". Move them to another section, then delete this one?";
      const others = visibleCategories()
        .filter((c) => c.id !== id)
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(catLabel(c))}</option>`)
        .join("");
      $("[data-confirm-extra]").innerHTML = others
        ? `<div class="field-row"><span class="lbl">Move dishes to</span><select class="field" id="move-cat">${others}</select></div>`
        : `<p>There is no other section to move them to. Add one first, or delete the dishes.</p>`;
    }
    $("#confirm-dialog").showModal();
  };

  const confirmYes = () => {
    if (state.pendingDeleteId) {
      const id = state.pendingDeleteId;
      state.pendingDeleteId = null;
      $("#confirm-dialog")?.close();
      revokePreview(id);
      delete state.pendingPhotos[id];
      state.menu.items = state.menu.items.filter((i) => i.id !== id);
      if (Array.isArray(state.menu.signature_ids)) {
        state.menu.signature_ids = state.menu.signature_ids.filter((x) => x !== id);
      }
      render();
      return;
    }
    if (state.pendingDeleteCat) {
      const id = state.pendingDeleteCat;
      const dishes = itemsIn(id);
      if (dishes.length) {
        const moveTo = $("#move-cat") && $("#move-cat").value;
        if (!moveTo) return;
        const dest = catById(moveTo);
        const start = itemsIn(moveTo).reduce((m, i) => Math.max(m, i.order || 0), (dest?.order || 0) * 100);
        dishes.forEach((item, idx) => {
          item.category = moveTo;
          item.order = start + idx + 1;
        });
      }
      state.pendingDeleteCat = null;
      $("#confirm-dialog")?.close();
      state.menu.categories = state.menu.categories.filter((c) => c.id !== id);
      if (state.activeCat === id) {
        state.view = "list";
        state.activeCat = null;
      }
      render();
    }
  };

  const confirmNo = () => {
    state.pendingDeleteId = null;
    state.pendingDeleteCat = null;
    $("#confirm-dialog")?.close();
  };

  const validateAll = () => {
    const problems = [];
    for (const item of state.menu.items) {
      if (!item.name || !String(item.name).trim()) problems.push("A dish needs a name.");
      if (item.price != null && item.price !== "" && !(Number.isFinite(Number(item.price)) && Number(item.price) >= 0)) {
        problems.push((item.name || "A dish") + " has a price that is not a number.");
      }
      if (item.sizes) {
        for (const s of item.sizes) {
          if (s.price != null && s.price !== "" && !(Number.isFinite(Number(s.price)) && Number(s.price) >= 0)) {
            problems.push((item.name || "A dish") + " has a price that is not a number.");
          }
        }
      }
    }
    return problems;
  };

  const ensurePhotoInput = () => {
    let el = document.getElementById("photo-file");
    if (el) return el;
    el = document.createElement("input");
    el.id = "photo-file";
    el.type = "file";
    el.accept = "image/*";
    el.hidden = true;
    el.setAttribute("data-photo-file", "");
    document.body.appendChild(el);
    el.addEventListener("change", onPhotoFile);
    return el;
  };

  const pickPhoto = (id) => {
    state.photoTarget = id;
    const input = ensurePhotoInput();
    input.value = "";
    input.click();
  };

  const onPhotoFile = async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    const target = state.photoTarget;
    input.value = "";
    if (!file || !target) return;
    try {
      const { blob, ext } = await compressImage(file);
      revokePreview(target);
      state.pendingPhotos[target] = { blob, ext, preview: URL.createObjectURL(blob) };
      if (target === "__add__") {
        refreshAddPhotoBlock();
        return;
      }
      applyCardInputs();
      render();
    } catch (err) {
      showToast(err.message || "That photo could not be used. Please try another picture.", "error", 4500);
    }
  };

  const removePhoto = (id) => {
    revokePreview(id);
    delete state.pendingPhotos[id];
    if (id === "__add__") {
      refreshAddPhotoBlock();
      return;
    }
    applyCardInputs();
    const item = state.menu.items.find((i) => i.id === id);
    if (item) item.photo = null;
    render();
  };

  const putRepoFile = async (path, message, contentB64, sha) => {
    const url = API + "/repos/" + OWNER + "/" + REPO + "/contents/" + path;
    let res;
    try {
      const payload = { message, content: contentB64, branch: "main" };
      if (sha) payload.sha = sha;
      res = await fetch(url, {
        method: "PUT",
        headers: { ...apiHeaders(state.token), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      throw new Error("Could not reach the internet. Check your connection and try again.");
    }
    return res;
  };

  const uploadPendingPhotos = async () => {
    const entries = Object.entries(state.pendingPhotos).filter(([id]) => id !== "__add__");
    let i = 0;
    for (const [id, pending] of entries) {
      i += 1;
      const item = state.menu.items.find((it) => it.id === id);
      if (!item || !pending || !pending.blob) {
        revokePreview(id);
        delete state.pendingPhotos[id];
        continue;
      }
      state.busyLabel = entries.length > 1 ? "Uploading photo " + i + " of " + entries.length + "…" : "Uploading photo…";
      refreshChrome();
      const stamp = Date.now() + "-" + i;
      const ext = pending.ext === "jpg" ? "jpg" : "webp";
      const repoPath = PHOTO_DIR + id + "-" + stamp + "." + ext;
      const menuPath = PHOTO_MENU_PREFIX + id + "-" + stamp + "." + ext;
      const content = await encodeBlob(pending.blob);
      const res = await putRepoFile(repoPath, "Admin: add dish photo", content);
      if (!res.ok) throw new Error(friendlyHttpError(res.status, true));
      item.photo = menuPath;
      revokePreview(id);
      delete state.pendingPhotos[id];
    }
  };

  const save = async () => {
    const applied = applyCardInputs();
    if (!applied.ok) {
      showToast(applied.problems[0], "error", 4500);
      return;
    }
    const problems = validateAll();
    if (problems.length) {
      showToast(problems[0], "error", 4500);
      return;
    }
    if (!state.token) {
      showToast("Please sign in again.", "error", 4000);
      return;
    }
    state.toast = "";
    state.toastType = "";
    state.busy = true;
    state.busyLabel = Object.keys(state.pendingPhotos).some((id) => id !== "__add__") ? "Uploading photo…" : "Saving…";
    refreshChrome();
    const putOnce = async (sha, body) => {
      const url = API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH;
      let res;
      try {
        res = await fetch(url, {
          method: "PUT",
          headers: { ...apiHeaders(state.token), "Content-Type": "application/json" },
          body: JSON.stringify({
            message: COMMIT_MESSAGE,
            content: encodeBase64(body),
            sha,
            branch: "main",
          }),
        });
      } catch (_) {
        throw new Error("Could not reach the internet. Check your connection and try again.");
      }
      return res;
    };

    try {
      await uploadPendingPhotos();
      state.busyLabel = "Saving…";
      refreshChrome();
      const payload = cleanMenu(state.menu);
      const body = JSON.stringify(payload, null, 2) + "\n";
      let res = await putOnce(state.sha, body);
      if (res.status === 409) {
        const latest = await loadFile(state.token);
        state.sha = latest.sha;
        res = await putOnce(state.sha, body);
      }
      if (!res.ok) throw new Error(friendlyHttpError(res.status, true));
      const result = await res.json();
      if (result && result.content && result.content.sha) state.sha = result.content.sha;
      state.busy = false;
      state.busyLabel = "";
      markClean();
      showToast("Saved! Live in about 1 minute", "ok", 6000);
    } catch (err) {
      state.busy = false;
      state.busyLabel = "";
      showToast(err.message || "Could not save.", "error", 5000);
    }
  };

  const bind = () => {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-logout]")) return logout();
      if (e.target.closest("[data-save]")) return save();
      if (e.target.closest("[data-back]")) {
        applyCardInputs();
        state.view = "list";
        state.activeCat = null;
        state.query = "";
        return render();
      }
      const open = e.target.closest("[data-open-cat]");
      if (open) {
        state.view = "category";
        state.activeCat = open.dataset.openCat;
        state.query = "";
        return render();
      }
      if (e.target.closest("[data-add-dish]")) return openAddDish();
      const pick = e.target.closest("[data-pick-photo]");
      if (pick) return pickPhoto(pick.dataset.pickPhoto);
      const drop = e.target.closest("[data-remove-photo]");
      if (drop) return removePhoto(drop.dataset.removePhoto);
      if (e.target.closest("[data-add-cat]")) return $("#add-cat-dialog")?.showModal();
      const rename = e.target.closest("[data-rename-cat]");
      if (rename) return openRenameCat(rename.dataset.renameCat);
      const delCat = e.target.closest("[data-delete-cat]");
      if (delCat) return askDeleteCat(delCat.dataset.deleteCat);
      const edit = e.target.closest("[data-edit]");
      if (edit) return openEdit(edit.dataset.edit);
      const del = e.target.closest("[data-delete]");
      if (del) return askDeleteDish(del.dataset.delete);
      const close = e.target.closest("[data-close]");
      if (close) return document.getElementById(close.dataset.close)?.close();
      if (e.target.closest("[data-confirm-yes]")) return confirmYes();
      if (e.target.closest("[data-confirm-no]")) return confirmNo();
    });

    document.addEventListener("input", (e) => {
      if (e.target.matches("[data-search]")) {
        applyCardInputs();
        state.query = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const search = $("[data-search]");
        if (search) {
          search.focus();
          try {
            search.setSelectionRange(pos, pos);
          } catch (_) {}
        }
        return;
      }
      if (e.target.matches("[data-price], [data-size-price], [data-add-price], [data-sold]")) {
        applyCardInputs();
        const card = e.target.closest(".card");
        if (card && e.target.matches("[data-sold]")) card.classList.toggle("is-sold", e.target.checked);
        refreshChrome();
      }
    });

    document.addEventListener("submit", (e) => {
      if (e.target.id === "add-dish-form") addDish(e);
      if (e.target.id === "edit-dish-form") saveEdit(e);
      if (e.target.id === "add-cat-form") addCategory(e);
      if (e.target.id === "rename-cat-form") renameCat(e);
    });

    window.addEventListener("beforeunload", (e) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    });
  };

  const boot = async () => {
    ensurePhotoInput();
    bind();
    let stored = "";
    try {
      stored = localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {}
    if (!stored) {
      renderLogin();
      return;
    }
    state.busy = true;
    renderLogin();
    try {
      const { menu, sha } = await loadFile(stored);
      state.token = stored;
      state.menu = menu;
      state.sha = sha;
      state.busy = false;
      markClean();
      render();
    } catch (_) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (__) {}
      state.busy = false;
      state.loginError = "Please sign in again.";
      renderLogin();
    }
  };

  window.FFAdmin = {
    parsePrice,
    hasPrice,
    changeCount,
    getState: () => state,
    compressImage,
    photoSrc,
  };

  boot();
})();
