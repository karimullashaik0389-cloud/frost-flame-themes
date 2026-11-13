(() => {
  "use strict";

  const OWNER = "karimullashaik0389-cloud";
  const REPO = "frost-flame-themes";
  const FILE_PATH = "site/data/menu.json";
  const TOKEN_KEY = "ff-admin-gh-token";
  const API = "https://api.github.com";
  const COMMIT_MESSAGE = "Admin: update menu";

  const $ = (sel, root = document) => root.querySelector(sel);
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
    query: "",
    busy: false,
    notice: "",
    noticeType: "",
    loginError: "",
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
    if (status === 401) return "That token was not accepted. Check you copied it in full.";
    if (status === 403) {
      return forWrite
        ? "This token cannot save the menu. It needs Contents set to Read and write on the frost-flame-themes repo only."
        : "This token does not have permission to read the menu. It needs Contents set to Read and write on the frost-flame-themes repo only.";
    }
    if (status === 404) return "This token cannot see the Frost & Flame menu. Make sure it is for the frost-flame-themes repository only.";
    if (status === 409) return "The menu was changed elsewhere. Refresh and try again.";
    return "GitHub returned an error (" + status + "). Please try again.";
  };

  const loadFile = async (token) => {
    const url = API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH;
    let res;
    try {
      res = await fetch(url, { headers: apiHeaders(token) });
    } catch (_) {
      throw new Error("Could not reach GitHub. Check your connection and try again.");
    }
    if (!res.ok) throw new Error(friendlyHttpError(res.status, false));
    const data = await res.json();
    if (!data || !data.content || !data.sha) throw new Error("The menu file could not be read. Please try again.");
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

  const visibleCategories = () =>
    (state.menu.categories || []).filter((c) => !c.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));

  const itemsIn = (catId) =>
    (state.menu.items || [])
      .filter((i) => i.category === catId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  const matchesQuery = (item, cat) => {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    const hay = [item.name, item.description, cat && cat.name, cat && cat.heading, item.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const slugify = (name) => {
    const base = String(name || "dish")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dish";
    const ids = new Set((state.menu.items || []).map((i) => i.id));
    if (!ids.has(base)) return base;
    let n = 2;
    while (ids.has(base + "-" + n)) n += 1;
    return base + "-" + n;
  };

  const collectPricesFromRow = (row) => {
    const errors = [];
    const main = parsePrice($("[data-price]", row)?.value);
    if (!main.ok) errors.push("price");
    const sizes = [...$$("[data-size-price]", row)].map((el) => {
      const parsed = parsePrice(el.value);
      if (!parsed.ok) errors.push(el.dataset.sizePrice);
      return { index: Number(el.dataset.sizePrice), value: parsed.value };
    });
    const adds = [...$$("[data-add-price]", row)].map((el) => {
      const parsed = parsePrice(el.value);
      if (!parsed.ok) errors.push("option");
      return { ci: Number(el.dataset.choice), oi: Number(el.dataset.option), value: parsed.value };
    });
    return { ok: errors.length === 0, main: main.value, sizes, adds, errors };
  };

  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const applyDomToMenu = () => {
    if (!state.menu) return { ok: true };
    const problems = [];
    $$(".dish-row[data-id]").forEach((row) => {
      const item = state.menu.items.find((i) => i.id === row.dataset.id);
      if (!item) return;
      const name = ($("[data-name]", row)?.value || "").trim();
      if (!name) problems.push((item.name || "A dish") + " needs a name.");
      else item.name = name;
      const desc = $("[data-desc]", row);
      if (desc) item.description = desc.value;
      const sold = $("[data-sold]", row);
      if (sold) item.sold_out = !!sold.checked;
      const prices = collectPricesFromRow(row);
      if (!prices.ok) {
        problems.push((item.name || "A dish") + " has a price that is not a number of 0 or more. Leave it blank for “Price coming soon”.");
        return;
      }
      if (item.sizes && item.sizes.length) {
        prices.sizes.forEach((s) => {
          if (item.sizes[s.index]) item.sizes[s.index].price = s.value;
        });
      } else {
        item.price = prices.main;
        if (prices.main != null) delete item.price_review;
        else item.price_review = true;
      }
      prices.adds.forEach((a) => {
        const opt = item.choices?.[a.ci]?.options?.[a.oi];
        if (opt) opt.add = a.value == null ? 0 : a.value;
      });
    });
    return { ok: problems.length === 0, problems };
  };

  const rowHTML = (item) => {
    const pending = !hasPrice(item);
    const sizes = item.sizes && item.sizes.length ? item.sizes : null;
    const priceFields = [];
    if (!sizes) {
      priceFields.push(priceInput("Price", item.price, "data-price"));
    }
    (sizes || []).forEach((s, i) => {
      priceFields.push(priceInput(s.name, s.price, 'data-size-price="' + i + '"'));
    });
    const choiceFields = [];
    (item.choices || []).forEach((c, ci) => {
      const useful = (c.options || []).some((o) => Number(o.add || 0) !== 0);
      if (!useful) return;
      (c.options || []).forEach((o, oi) => {
        choiceFields.push(priceInput((c.label ? c.label + " · " : "") + o.name, o.add ?? 0, 'data-add-price data-choice="' + ci + '" data-option="' + oi + '"'));
      });
    });
    const cls = ["dish-row", pending ? "is-pending" : "", item.sold_out ? "is-sold" : "", item._new ? "is-new" : ""]
      .filter(Boolean)
      .join(" ");
    return `
      <article class="${cls}" data-id="${escapeHtml(item.id)}" data-testid="dish-row">
        <div class="row-head">
          <label>
            <span class="lbl">Name</span>
            <input class="field" data-name type="text" value="${escapeHtml(item.name)}" aria-label="Name of ${escapeHtml(item.name)}">
          </label>
          <button class="btn btn-danger" type="button" data-delete="${escapeHtml(item.id)}">Delete</button>
        </div>
        <label>
          <span class="lbl">Description</span>
          <textarea class="field" data-desc aria-label="Description of ${escapeHtml(item.name)}">${escapeHtml(item.description)}</textarea>
        </label>
        <div class="prices">
          ${priceFields.join("")}
          ${choiceFields.join("")}
        </div>
        ${pending ? `<span class="pending-tag">Price coming soon</span>` : ""}
        <label class="toggle">
          <input data-sold type="checkbox" ${item.sold_out ? "checked" : ""}>
          <span>Sold out (hidden from orders)</span>
        </label>
      </article>`;
  };

  const priceInput = (label, value, attrs) => {
    const shown = value == null || value === "" ? "" : String(value);
    return `<label class="price-field">
      <span class="lbl">${escapeHtml(label)}</span>
      <span class="pound">£</span>
      <input class="field" ${attrs} inputmode="decimal" placeholder="Coming soon" value="${escapeHtml(shown)}" aria-label="${escapeHtml(label)} price">
    </label>`;
  };

  const renderLogin = () => {
    app.innerHTML = `
      <main class="login">
        <div class="logo">
          <img src="../img/logo-800.webp" alt="Frost &amp; Flame">
        </div>
        <h1>Menu admin</h1>
        <p>Sign in with a GitHub token that can only change the Frost &amp; Flame menu.</p>
        ${state.loginError ? `<p class="error" role="alert">${escapeHtml(state.loginError)}</p>` : ""}
        <form id="login-form">
          <div class="field-row">
            <label for="token">GitHub token</label>
            <input class="field" id="token" name="token" type="password" autocomplete="off" spellcheck="false" required>
          </div>
          <button class="btn btn-frost btn-wide" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Checking…" : "Sign in"}</button>
        </form>
        <p class="hint"><a href="HOW-TO.md">How to make the token</a></p>
      </main>`;
    $("#login-form").addEventListener("submit", onLogin);
  };

  const renderEditor = () => {
    const cats = visibleCategories();
    const groups = cats
      .map((cat) => {
        const items = itemsIn(cat.id).filter((i) => matchesQuery(i, cat));
        if (!items.length) return "";
        return `<section class="group" data-group="${escapeHtml(cat.id)}">
          <p class="kicker">Menu</p>
          <h2>${escapeHtml(cat.heading || cat.name)}</h2>
          ${items.map(rowHTML).join("")}
        </section>`;
      })
      .join("");
    app.innerHTML = `
      <header class="header">
        <div class="logo">
          <img src="../img/logo-800.webp" alt="">
          <div class="logo-text">
            <strong>Frost &amp; Flame</strong>
            <span>Menu admin</span>
          </div>
        </div>
        <button class="btn btn-ghost" type="button" data-logout>Log out</button>
      </header>
      <main class="wrap">
        <div class="toolbar">
          <input class="field search" type="search" placeholder="Search dishes" value="${escapeHtml(state.query)}" data-search aria-label="Search dishes">
          <button class="btn btn-ghost" type="button" data-add>Add a dish</button>
        </div>
        ${groups || `<p class="empty">No dishes match that search.</p>`}
      </main>
      <div class="save-bar">
        <p class="msg ${state.noticeType}" data-save-msg>${escapeHtml(state.notice || "Changes are saved to the website when you tap Save.")}</p>
        <button class="btn btn-frost" type="button" data-save ${state.busy ? "disabled" : ""}>${state.busy ? "Saving…" : "Save"}</button>
      </div>
      <dialog class="modal" id="add-dialog">
        <form class="modal-inner" id="add-form" method="dialog">
          <h2>Add a dish</h2>
          <div class="field-row">
            <span class="lbl">Category</span>
            <select class="field" name="category" required>
              ${cats.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.heading || c.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field-row">
            <span class="lbl">Name</span>
            <input class="field" name="name" type="text" required>
          </div>
          <div class="field-row">
            <span class="lbl">Description</span>
            <textarea class="field" name="description"></textarea>
          </div>
          <div class="field-row">
            <span class="lbl">Price</span>
            <label class="price-field">
              <span class="pound">£</span>
              <input class="field" name="price" inputmode="decimal" placeholder="Coming soon">
            </label>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-close-add>Cancel</button>
            <button class="btn btn-frost" type="submit">Add</button>
          </div>
        </form>
      </dialog>
      <dialog class="modal" id="confirm-dialog">
        <div class="modal-inner">
          <h2>Remove this dish?</h2>
          <p data-confirm-text></p>
          <div class="modal-actions">
            <button class="btn btn-ghost" type="button" data-cancel-del>Cancel</button>
            <button class="btn btn-danger" type="button" data-confirm-del>Remove</button>
          </div>
        </div>
      </dialog>`;
  };

  const syncNotice = (text, type) => {
    state.notice = text || "";
    state.noticeType = type || "";
    const el = $("[data-save-msg]");
    if (el) {
      el.textContent = state.notice || "Changes are saved to the website when you tap Save.";
      el.className = "msg " + (type || "");
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    const input = $("#token");
    const token = (input && input.value || "").trim();
    if (!token) return;
    state.busy = true;
    state.loginError = "";
    renderLogin();
    try {
      const { menu, sha } = await loadFile(token);
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (_) {
        /* still usable this session */
      }
      state.token = token;
      state.menu = menu;
      state.sha = sha;
      state.busy = false;
      renderEditor();
    } catch (err) {
      state.busy = false;
      state.loginError = err.message || "Could not sign in.";
      renderLogin();
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
    state.token = null;
    state.menu = null;
    state.sha = null;
    state.loginError = "";
    state.notice = "";
    renderLogin();
  };

  const pendingDelete = { id: null };

  const askDelete = (id) => {
    const item = state.menu.items.find((i) => i.id === id);
    if (!item) return;
    pendingDelete.id = id;
    const dialog = $("#confirm-dialog");
    $("[data-confirm-text]", dialog).textContent =
      "Remove “" + item.name + "” from the menu? It will come off the website when you Save.";
    dialog.showModal();
  };

  const doDelete = () => {
    const id = pendingDelete.id;
    pendingDelete.id = null;
    $("#confirm-dialog")?.close();
    if (!id) return;
    applyDomToMenu();
    state.menu.items = state.menu.items.filter((i) => i.id !== id);
    if (Array.isArray(state.menu.signature_ids)) {
      state.menu.signature_ids = state.menu.signature_ids.filter((x) => x !== id);
    }
    syncNotice("Removed. Tap Save to update the website.", "");
    const q = state.query;
    renderEditor();
    state.query = q;
  };

  const onAddSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const name = String(form.name.value || "").trim();
    if (!name) return;
    const parsed = parsePrice(form.price.value);
    if (!parsed.ok) {
      syncNotice("The price must be a number of 0 or more, or left blank.", "error");
      return;
    }
    applyDomToMenu();
    const catId = form.category.value;
    const cat = (state.menu.categories || []).find((c) => c.id === catId);
    const siblings = itemsIn(catId);
    const order = siblings.length ? Math.max(...siblings.map((i) => i.order || 0)) + 1 : (cat?.order || 0) * 100;
    const item = {
      id: slugify(name),
      name,
      category: catId,
      description: String(form.description.value || "").trim(),
      diet: [],
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
      _new: true,
    };
    if (parsed.value == null) item.price_review = true;
    state.menu.items.push(item);
    $("#add-dialog")?.close();
    renderEditor();
    const row = document.querySelector('.dish-row[data-id="' + item.id + '"]');
    if (row) row.scrollIntoView({ block: "center" });
    syncNotice("Added “" + name + "”. Tap Save to update the website.", "");
  };

  const save = async () => {
    const applied = applyDomToMenu();
    if (!applied.ok) {
      syncNotice(applied.problems[0], "error");
      return;
    }
    // Validate every item price still in memory (including those filtered out of the search).
    for (const item of state.menu.items) {
      if (item.price != null && item.price !== "" && !(Number.isFinite(Number(item.price)) && Number(item.price) >= 0)) {
        syncNotice((item.name || "A dish") + " has an invalid price.", "error");
        return;
      }
      if (item.sizes) {
        for (const s of item.sizes) {
          if (s.price != null && s.price !== "" && !(Number.isFinite(Number(s.price)) && Number(s.price) >= 0)) {
            syncNotice((item.name || "A dish") + " has an invalid " + (s.name || "option") + " price.", "error");
            return;
          }
        }
      }
    }
    if (!state.token) {
      syncNotice("Please sign in again.", "error");
      return;
    }
    state.busy = true;
    syncNotice("Saving…", "");
    const saveBtn = $("[data-save]");
    if (saveBtn) saveBtn.disabled = true, (saveBtn.textContent = "Saving…");

    // Clean temp flags and undefined fields we shouldn't persist.
    const payload = JSON.parse(JSON.stringify(state.menu));
    (payload.items || []).forEach((it) => {
      delete it._new;
    });
    const body = JSON.stringify(payload, null, 2) + "\n";

    const putOnce = async (sha) => {
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
        throw new Error("Could not reach GitHub. Check your connection and try again.");
      }
      return res;
    };

    try {
      let res = await putOnce(state.sha);
      if (res.status === 409) {
        const latest = await loadFile(state.token);
        state.sha = latest.sha;
        res = await putOnce(state.sha);
      }
      if (!res.ok) throw new Error(friendlyHttpError(res.status, true));
      const result = await res.json();
      if (result && result.content && result.content.sha) state.sha = result.content.sha;
      state.busy = false;
      syncNotice("Saved, live in about 1 minute", "ok");
      if (saveBtn) saveBtn.disabled = false, (saveBtn.textContent = "Save");
    } catch (err) {
      state.busy = false;
      syncNotice(err.message || "Could not save.", "error");
      if (saveBtn) saveBtn.disabled = false, (saveBtn.textContent = "Save");
    }
  };

  const bind = () => {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-logout]")) {
        logout();
        return;
      }
      if (e.target.closest("[data-save]")) {
        save();
        return;
      }
      if (e.target.closest("[data-add]")) {
        applyDomToMenu();
        $("#add-dialog")?.showModal();
        return;
      }
      if (e.target.closest("[data-close-add]")) {
        $("#add-dialog")?.close();
        return;
      }
      const del = e.target.closest("[data-delete]");
      if (del) {
        applyDomToMenu();
        askDelete(del.dataset.delete);
        return;
      }
      if (e.target.closest("[data-cancel-del]")) {
        pendingDelete.id = null;
        $("#confirm-dialog")?.close();
        return;
      }
      if (e.target.closest("[data-confirm-del]")) {
        doDelete();
      }
    });
    document.addEventListener("input", (e) => {
      if (e.target.matches("[data-search]")) {
        applyDomToMenu();
        state.query = e.target.value;
        const pos = e.target.selectionStart;
        renderEditor();
        const search = $("[data-search]");
        if (search) {
          search.focus();
          try { search.setSelectionRange(pos, pos); } catch (_) {}
        }
      }
      if (e.target.matches("[data-sold]")) {
        const row = e.target.closest(".dish-row");
        if (row) row.classList.toggle("is-sold", e.target.checked);
      }
    });
    document.addEventListener("submit", (e) => {
      if (e.target.id === "add-form") onAddSubmit(e);
    });
  };

  const boot = async () => {
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
      renderEditor();
    } catch (_) {
      try { localStorage.removeItem(TOKEN_KEY); } catch (__) {}
      state.busy = false;
      state.loginError = "Please sign in again.";
      renderLogin();
    }
  };

  window.FFAdmin = {
    parsePrice,
    hasPrice,
    slugify: (n) => slugify(n),
    getState: () => state,
  };

  boot();
})();
