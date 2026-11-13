(() => {
  "use strict";

  const DIET = {
    V: "Veg",
    VG: "Vegan",
    S: "Spicy",
    SS: "Extra spicy",
    N: "Nuts",
  };

  const state = {
    data: null,
    filter: "all",
    cart: [],
    fulfill: "eat-in",
    name: "",
    postcode: "",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const money = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return `£${v.toFixed(2)}`;
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const basePrice = (item) => {
    if (item.price != null) return Number(item.price);
    if (item.sizes && item.sizes.length) return Number(item.sizes[0].price);
    return 0;
  };

  const priceLabel = (item) => {
    if (item.sizes && item.sizes.length) {
      const prices = item.sizes.map((s) => Number(s.price)).filter(Number.isFinite);
      if (!prices.length) return "";
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? money(min) : `From ${money(min)}`;
    }
    return item.price == null ? "" : money(item.price);
  };

  const itemById = (id) => state.data.items.find((i) => i.id === id);

  const loadCart = () => {
    try {
      const raw = sessionStorage.getItem("ff-cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) state.cart = parsed;
      }
    } catch (_) {
      /* ignore */
    }
  };

  const saveCart = () => {
    try {
      sessionStorage.setItem("ff-cart", JSON.stringify(state.cart));
    } catch (_) {
      /* ignore */
    }
  };

  const cartCount = () => state.cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => state.cart.reduce((n, l) => n + l.unitPrice * l.qty, 0);

  /* OWNER REVIEW: ingredient lists come from menu.json. Entries with
     ingredients_review: true are typical recipes inferred from the dish
     name and description, not kitchen-confirmed. Never treat a missing
     allergens list as "allergen-free". */

  let addSourceEl = null;
  let dishOpenId = null;
  let dishSkipPop = false;
  let dishSwipe = null;

  const qtyOf = (id) => state.cart.filter((l) => l.id === id).reduce((n, l) => n + l.qty, 0);

  const flyPlus = (fromEl) => {
    const src = fromEl || addSourceEl;
    const dest = $(".header .cart-btn") || $("[data-open-cart]");
    if (!src || !dest) return;
    const a = src.getBoundingClientRect();
    const b = dest.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "fly-plus";
    el.textContent = "+1";
    el.setAttribute("data-testid", "fly-plus");
    const x = a.left + a.width / 2;
    const y = a.top + a.height / 2;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--dx", (b.left + b.width / 2 - x) + "px");
    el.style.setProperty("--dy", (b.top + b.height / 2 - y) + "px");
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  };

  const addControlHTML = (item, { sheet = false } = {}) => {
    if (item.sold_out) return `<button class="btn btn-add" type="button" disabled>Sold out</button>`;
    const q = qtyOf(item.id);
    const stepper = `<div class="qty-stepper" data-stepper="${escapeHtml(item.id)}" data-testid="stepper-${escapeHtml(item.id)}">
        <button type="button" data-step-delta="-1" data-step-id="${escapeHtml(item.id)}" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
        <span data-step-qty aria-live="polite">${q}</span>
        <button type="button" data-step-delta="1" data-step-id="${escapeHtml(item.id)}" aria-label="Add one ${escapeHtml(item.name)}">+</button>
      </div>`;
    if (sheet) {
      return `${stepper}<button class="btn btn-add" type="button" data-add="${escapeHtml(item.id)}">Add to cart</button>`;
    }
    return q > 0
      ? stepper
      : `<button class="btn btn-add" type="button" data-add="${escapeHtml(item.id)}">Add</button>`;
  };

  const syncSteppers = () => {
    if (!state.data) return;
    $$("[data-add-slot]").forEach((slot) => {
      const item = itemById(slot.dataset.addSlot);
      if (!item) return;
      slot.innerHTML = addControlHTML(item, { sheet: slot.dataset.sheet === "1" });
    });
  };


  const updateCartBadges = () => {
    const n = cartCount();
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = String(n);
      el.removeAttribute("hidden");
      const on = n > 0;
      if (on) {
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
      }
      el.classList.toggle("is-on", on);
    });
    const bar = $("[data-order-bar]");
    if (bar) {
      bar.classList.toggle("is-empty", n === 0);
      const view = $(".btn-cart", bar);
      if (view) {
        const label = view.childNodes[0];
        if (label && label.nodeType === Node.TEXT_NODE) {
          label.textContent = n ? "View order · " + money(cartTotal()) + " " : "View order ";
        }
      }
    }
    const orderBtn = $(".header .cart-btn");
    if (orderBtn) orderBtn.setAttribute("aria-label", n ? "Order, " + n + " in cart" : "Order");
    syncSteppers();
  };


  const mediaHTML = (item, { titleSize, showName = true } = {}) => {
    const tone = item.tone === "flame" ? "flame" : item.tone === "both" ? "both" : "frost";
    if (item.photo) {
      return `<img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}" loading="lazy" width="640" height="640">`;
    }
    const name = showName
      ? `<span class="ph-name"${titleSize ? ` style="font-size:${titleSize}"` : ""}>${escapeHtml(item.name)}</span>`
      : "";
    return `<div class="ph ph-${tone}" aria-hidden="true">${name}</div>`;
  };

  const chipsHTML = (item) => {
    const chips = (item.diet || [])
      .map((d) => {
        const label = DIET[d] || d;
        const cls = `chip chip-${String(d).toLowerCase()}`;
        return `<span class="${cls}">${escapeHtml(label)}</span>`;
      })
      .join("");
    return chips ? `<div class="meta-row">${chips}</div>` : "";
  };

  const allergensHTML = (item) => {
    if (!item.allergens || !item.allergens.length) return "";
    return `<p class="allergens">Contains ${item.allergens.join(", ")}</p>`;
  };

  const renderSignatures = () => {
    const root = $("#signature-slider");
    if (!root) return;
    const ids = state.data.signature_ids || [];
    root.innerHTML = ids
      .map((id) => itemById(id))
      .filter(Boolean)
      .map(
        (item) => `
        <article class="sig-card reveal" data-open-dish="${escapeHtml(item.id)}">
          <div class="media">${mediaHTML(item, { showName: false })}</div>
          <div class="sig-body">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <div class="sig-row">
              <span class="price">${priceLabel(item)}</span>
              <div class="add-slot" data-add-slot="${escapeHtml(item.id)}">${addControlHTML(item)}</div>
            </div>
          </div>
        </article>`
      )
      .join("");
  };

  const categoryTone = (id) => {
    if (id === "all") return "both";
    const cat = state.data.categories.find((c) => c.id === id);
    return (cat && cat.tone) || "both";
  };

  const renderTabs = () => {
    const root = $("#menu-tabs");
    if (!root) return;
    const cats = state.data.categories.filter((c) => !c.hidden);
    const tabs = [{ id: "all", name: "All" }, ...cats];
    root.innerHTML = tabs
      .map(
        (c) => `
        <button class="tab" type="button" role="tab" id="tab-${c.id}"
          aria-selected="${state.filter === c.id ? "true" : "false"}"
          data-filter="${c.id}">${escapeHtml(c.name)}</button>`
      )
      .join("");
  };

  const renderMenu = () => {
    const root = $("#menu-grid");
    if (!root) return;
    const items = state.data.items
      .filter((i) => (state.filter === "all" ? true : i.category === state.filter))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    root.innerHTML = items
      .map((item) => {
        const note = item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : "";
        return `
          <article class="dish reveal" id="dish-${escapeHtml(item.id)}" data-open-dish="${escapeHtml(item.id)}">
            <div class="media">${mediaHTML(item, { titleSize: "0.95rem" })}</div>
            <div class="dish-body">
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.description)}</p>
              ${chipsHTML(item)}
              ${allergensHTML(item)}
              ${note}
              <div class="dish-foot">
                <span class="price">${priceLabel(item)}</span>
                <div class="add-slot" data-add-slot="${escapeHtml(item.id)}">${addControlHTML(item)}</div>
              </div>
            </div>
          </article>`;
      })
      .join("");
    const menu = $("#menu");
    if (menu) menu.setAttribute("data-tone", categoryTone(state.filter));
    observeReveals();
  };

  const lineOptionsNeedPicker = (item) =>
    Boolean(
      item.opens_build ||
        (item.sizes && item.sizes.length) ||
        (item.choices && item.choices.length)
    );

  const onAdd = (id) => {
    const item = itemById(id);
    if (!item || item.sold_out) return;
    if (lineOptionsNeedPicker(item)) openDialog(item);
    else addLine({ id: item.id, name: item.name, unitPrice: basePrice(item), detail: "", qty: 1 });
  };

  const addLine = (line) => {
    const key = `${line.id}::${line.detail}`;
    const existing = state.cart.find((l) => `${l.id}::${l.detail}` === key);
    const added = line.qty || 1;
    if (existing) existing.qty += added;
    else state.cart.push({ ...line, qty: added });
    saveCart();
    updateCartBadges();
    if ($("#cart-drawer").open) renderCartBody();
    setDirectWaLinks();
    if (added > 0) flyPlus(addSourceEl);
    refreshDishSheet();
  };

  const adjustQty = (id, delta, fromEl) => {
    const item = itemById(id);
    if (!item || item.sold_out) return;
    addSourceEl = fromEl;
    if (delta > 0) {
      const lines = state.cart.filter((l) => l.id === id);
      if (lines.length) {
        lines[lines.length - 1].qty += delta;
        saveCart();
        updateCartBadges();
        if ($("#cart-drawer").open) renderCartBody();
        setDirectWaLinks();
        flyPlus(fromEl);
        refreshDishSheet();
        return;
      }
      onAdd(id);
      return;
    }
    const indexed = state.cart.map((l, i) => ({ l, i })).filter((x) => x.l.id === id);
    if (!indexed.length) return;
    const last = indexed[indexed.length - 1];
    last.l.qty += delta;
    if (last.l.qty <= 0) state.cart.splice(last.i, 1);
    saveCart();
    updateCartBadges();
    if ($("#cart-drawer").open) renderCartBody();
    setDirectWaLinks();
    refreshDishSheet();
  };

  const spiceHTML = (item) => {
    if (item.level == null || item.level === "") return "";
    const name = (state.data.levels || {})[String(item.level)] || "";
    const label = name ? name + " (" + item.level + " / 7)" : item.level + " / 7";
    return `<p class="spice-level">Spice level: ${escapeHtml(label)}</p>`;
  };

  const ingredientsHTML = (item) => {
    const list = item.ingredients || [];
    if (!list.length) return "";
    return `<div class="ingredients">
        <h3>Ingredients</h3>
        <ul>${list.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>`;
  };

  const allergenSheetHTML = (item) => {
    const a = item.allergens || [];
    if (a.length) {
      return `<p class="allergens">Contains ${a.join(", ")}. If you have an allergy, please ask us before ordering.</p>`;
    }
    return `<p class="allergens">Allergen details are listed where we have them. If you have an allergy, please ask us before ordering.</p>`;
  };

  const visibleClip = (item) => {
    const clip = state.data.clips && state.data.clips[item.id];
    if (!clip || clip.hidden || !clip.mp4) return null;
    return clip;
  };

  const dishMediaHTML = (item) => {
    const clip = visibleClip(item);
    const poster = (clip && clip.poster) || item.photo || "";
    if (clip) {
      const fallback = item.photo
        ? `<img src="${escapeHtml(item.photo)}" alt="" width="800" height="800">`
        : mediaHTML(item, { showName: false });
      return `${fallback}
        <video muted playsinline loop autoplay preload="auto" poster="${escapeHtml(poster)}" src="${escapeHtml(clip.mp4)}" data-dish-video></video>`;
    }
    if (item.photo) {
      return `<img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}" width="800" height="800">`;
    }
    return mediaHTML(item, { showName: false });
  };

  const renderDishSheet = (item) => {
    const root = $("#dish-sheet");
    if (!root || !item) return;
    root.innerHTML = `
      <div class="dish-sheet-inner">
        <div class="dish-sheet-handle" aria-hidden="true"></div>
        <button class="icon-close" type="button" data-close-dish aria-label="Close">&times;</button>
        <div class="dish-sheet-media">${dishMediaHTML(item)}</div>
        <div class="dish-sheet-body">
          <h2 id="dish-sheet-title">${escapeHtml(item.name)}</h2>
          <p class="price">${priceLabel(item)}</p>
          ${chipsHTML(item)}
          ${spiceHTML(item)}
          <p class="dish-sheet-desc">${escapeHtml(item.description)}</p>
          ${ingredientsHTML(item)}
          ${allergenSheetHTML(item)}
        </div>
        <div class="dish-sheet-actions add-slot" data-add-slot="${escapeHtml(item.id)}" data-sheet="1">
          ${addControlHTML(item, { sheet: true })}
        </div>
      </div>`;
    const v = root.querySelector("[data-dish-video]");
    if (v) {
      v.muted = true;
      v.playsInline = true;
      const play = v.play();
      if (play && play.catch) play.catch(() => {});
    }
  };

  const refreshDishSheet = () => {
    if (!dishOpenId) return;
    const slot = $("#dish-sheet [data-add-slot]");
    const item = itemById(dishOpenId);
    if (slot && item) slot.innerHTML = addControlHTML(item, { sheet: true });
  };

  const openDishSheet = (id, { push = true } = {}) => {
    const item = itemById(id);
    const root = $("#dish-sheet");
    if (!item || !root) return;
    dishOpenId = id;
    renderDishSheet(item);
    if (typeof root.showModal === "function") {
      if (!root.open) root.showModal();
    } else {
      root.setAttribute("open", "");
    }
    if (push && (!history.state || history.state.ffDish !== id)) {
      history.pushState({ ffDish: id }, "", "#item-" + id);
    }
  };

  const closeDishSheet = ({ back = true } = {}) => {
    const root = $("#dish-sheet");
    if (!root) return;
    const v = root.querySelector("[data-dish-video]");
    if (v) v.pause();
    const wasOpen = Boolean(dishOpenId);
    dishOpenId = null;
    if (root.open) root.close?.();
    else root.removeAttribute("open");
    if (back && wasOpen && history.state && history.state.ffDish) {
      dishSkipPop = true;
      history.back();
    }
  };

  const bindDishSwipe = () => {
    const root = $("#dish-sheet");
    if (!root) return;
    const onStart = (e) => {
      if (!root.open && !root.hasAttribute("open")) return;
      const t = e.touches ? e.touches[0] : e;
      const inner = root.querySelector(".dish-sheet-inner");
      dishSwipe = { y: t.clientY, x: t.clientX, inner };
    };
    const onMove = (e) => {
      if (!dishSwipe) return;
      const t = e.touches ? e.touches[0] : e;
      const dy = t.clientY - dishSwipe.y;
      const dx = t.clientX - dishSwipe.x;
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (Math.abs(dy) < Math.abs(dx) || dy < 0) return;
      if (dishSwipe.inner) dishSwipe.inner.style.transform = "translateY(" + dy + "px)";
    };
    const onEnd = (e) => {
      if (!dishSwipe) return;
      const t = (e.changedTouches && e.changedTouches[0]) || e;
      const dy = t.clientY - dishSwipe.y;
      const inner = dishSwipe.inner;
      dishSwipe = null;
      if (inner) inner.style.transform = "";
      if (dy > 80) closeDishSheet({ back: true });
    };
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: true });
    root.addEventListener("touchend", onEnd);
  };


  const openDialog = (item) => {
    const dialog = $("#item-dialog");
    const builder = item.opens_build ? state.data.builder : null;
    const toppings = builder ? state.data.topping_prices || {} : {};

    const sizeBlock =
      item.sizes && item.sizes.length
        ? `<div class="opt-group"><h3>Size</h3><div class="opt-pills" data-group="size">
            ${item.sizes
              .map(
                (s, i) =>
                  `<label><input type="radio" name="size" value="${i}" ${i === 0 ? "checked" : ""}> ${escapeHtml(s.name)} · ${money(s.price)}</label>`
              )
              .join("")}
           </div></div>`
        : "";

    const choiceBlocks = (item.choices || [])
      .map(
        (c, ci) => `
        <div class="opt-group">
          <h3>${escapeHtml(c.label)}</h3>
          <div class="opt-pills" data-group="choice" data-choice="${ci}">
            ${c.options
              .map(
                (o, oi) =>
                  `<label><input type="radio" name="choice-${ci}" value="${oi}" ${oi === 0 ? "checked" : ""}> ${escapeHtml(o.name)}${o.add ? ` · +${money(o.add)}` : ""}</label>`
              )
              .join("")}
          </div>
        </div>`
      )
      .join("");

    const baseBlock = builder
      ? `<div class="opt-group"><h3>Base</h3><div class="opt-pills" data-group="base">
          ${builder.bases
            .map(
              (b, i) =>
                `<label><input type="radio" name="base" value="${escapeHtml(b.name)}" ${i === 0 ? "checked" : ""}> ${escapeHtml(b.name)}</label>`
            )
            .join("")}
         </div></div>`
      : "";

    const mixinBlock = builder
      ? `<div class="opt-group"><h3>Mix-ins <span style="font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)">(choose up to two)</span></h3>
          <div class="opt-pills" data-group="mixins">
            ${builder.mixins
              .map(
                (m) =>
                  `<label><input type="checkbox" name="mixin" value="${escapeHtml(m.name)}"> ${escapeHtml(m.name)}</label>`
              )
              .join("")}
          </div></div>`
      : "";

    const toppingBlock = builder
      ? `<div class="opt-group"><h3>Toppings <span style="font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)">(optional)</span></h3>
          <div class="opt-pills" data-group="toppings">
            ${(builder.toppings || [])
              .map((t) => {
                const p = toppings[t.name] ?? 0.99;
                return `<label><input type="checkbox" name="topping" value="${escapeHtml(t.name)}" data-add="${p}"> ${escapeHtml(t.name)} · +${money(p)}</label>`;
              })
              .join("")}
          </div></div>`
      : "";

    dialog.innerHTML = `
      <div class="media">${mediaHTML(item)}</div>
      <div class="sheet-head">
        <h2 id="item-dialog-title">${escapeHtml(item.name)}</h2>
        <button class="icon-close" type="button" data-close-dialog aria-label="Close">&times;</button>
      </div>
      <form class="sheet-body" id="item-form">
        <p class="dialog-desc">${escapeHtml(item.description)}</p>
        ${chipsHTML(item)}
        ${allergensHTML(item)}
        ${sizeBlock}
        ${choiceBlocks}
        ${baseBlock}
        ${mixinBlock}
        ${toppingBlock}
        <button class="btn btn-frost" type="submit" data-dialog-add>Add to order · ${priceLabel(item)}</button>
      </form>`;

    const form = $("#item-form", dialog);

    const limitMixins = () => {
      const boxes = $$('input[name="mixin"]', form);
      const checked = boxes.filter((b) => b.checked);
      boxes.forEach((b) => {
        b.disabled = !b.checked && checked.length >= 2;
        b.parentElement.style.opacity = b.disabled ? "0.45" : "1";
      });
    };

    const currentPrice = () => {
      let price = item.price != null ? Number(item.price) : 0;
      if (item.sizes && item.sizes.length) {
        const i = Number(form.size?.value || 0);
        price = Number(item.sizes[i].price);
      }
      (item.choices || []).forEach((c, ci) => {
        const oi = Number(form[`choice-${ci}`]?.value || 0);
        price += Number(c.options[oi]?.add || 0);
      });
      $$('input[name="topping"]:checked', form).forEach((t) => {
        price += Number(t.dataset.add || 0);
      });
      return price;
    };

    const refresh = () => {
      limitMixins();
      const btn = $("[data-dialog-add]", form);
      if (btn) btn.textContent = `Add to order · ${money(currentPrice())}`;
    };

    form.addEventListener("change", refresh);
    refresh();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const parts = [];
      let allergens = new Set(item.allergens || []);
      if (item.sizes && item.sizes.length) {
        const s = item.sizes[Number(form.size.value)];
        parts.push(s.name);
        (s.allergens || []).forEach((a) => allergens.add(a));
      }
      (item.choices || []).forEach((c, ci) => {
        const o = c.options[Number(form[`choice-${ci}`].value)];
        parts.push(o.name);
        (o.allergens || []).forEach((a) => allergens.add(a));
      });
      if (builder) {
        const base = form.base?.value;
        if (base) {
          parts.push(base);
          const b = builder.bases.find((x) => x.name === base);
          (b?.allergens || []).forEach((a) => allergens.add(a));
        }
        const mix = $$('input[name="mixin"]:checked', form).map((x) => x.value);
        if (mix.length) {
          parts.push(mix.join(" & "));
          mix.forEach((name) => {
            const m = builder.mixins.find((x) => x.name === name);
            (m?.allergens || []).forEach((a) => allergens.add(a));
          });
        }
        const tops = $$('input[name="topping"]:checked', form).map((x) => x.value);
        if (tops.length) {
          parts.push(tops.join(", "));
          tops.forEach((name) => {
            const t = builder.toppings.find((x) => x.name === name);
            (t?.allergens || []).forEach((a) => allergens.add(a));
          });
        }
      }
      addLine({
        id: item.id,
        name: item.name,
        unitPrice: currentPrice(),
        detail: parts.join(" · "),
        qty: 1,
      });
      dialog.close();
    });

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };

  const renderCartBody = () => {
    const root = $("#cart-body");
    if (!root) return;
    const wa = state.data.meta.whatsapp;
    if (!state.cart.length) {
      root.innerHTML = `
        <p class="cart-empty">Your order is empty. Add something from the menu, or message us on WhatsApp.</p>
        <a class="btn btn-frost" href="https://wa.me/${escapeHtml(wa)}">Order on WhatsApp</a>`;
      return;
    }
    const rows = state.cart
      .map(
        (l, i) => `
        <li class="cart-item">
          <div>
            <h3>${escapeHtml(l.name)}</h3>
            ${l.detail ? `<p>${escapeHtml(l.detail)}</p>` : ""}
            <p>${money(l.unitPrice)} each</p>
          </div>
          <div class="qty">
            <button type="button" data-qty="${i}" data-delta="-1" aria-label="Decrease">−</button>
            <span>${l.qty}</span>
            <button type="button" data-qty="${i}" data-delta="1" aria-label="Increase">+</button>
          </div>
        </li>`
      )
      .join("");
    root.innerHTML = `
      <ul class="cart-list">${rows}</ul>
      <div class="fields">
        <div>
          <span class="opt-group" style="margin:0 0 .5rem"><h3>How would you like it?</h3></span>
          <div class="fulfill">
            <button type="button" data-fulfill="eat-in" aria-pressed="${state.fulfill === "eat-in"}">Eat-in</button>
            <button type="button" data-fulfill="collection" aria-pressed="${state.fulfill === "collection"}">Collection</button>
            <button type="button" data-fulfill="delivery" aria-pressed="${state.fulfill === "delivery"}">Delivery</button>
          </div>
        </div>
        <label>Your name <input type="text" name="cust-name" autocomplete="name" value="${escapeHtml(state.name)}"></label>
        <label>${state.fulfill === "delivery" ? "Postcode" : state.fulfill === "collection" ? "Collection notes" : "Table notes (optional)"}
          <input type="text" name="cust-postcode" value="${escapeHtml(state.postcode)}" ${state.fulfill === "delivery" ? 'placeholder="e.g. E2 7QL"' : ""}>
        </label>
      </div>
      <div class="cart-total"><span>Total</span><span>${money(cartTotal())}</span></div>
      <p class="cart-note">We’ll reply on WhatsApp with your total${state.data.meta.delivery_fee == null && state.fulfill === "delivery" ? ", including any delivery fee," : ""} and a time. Opening ${formatLaunch(state.data.meta.launch_date)}. Outside hours, this is sent as a pre-order. Eat-in is at 194 Hackney Road, London E2 7QL (about 20 seats); collection is from the same address.</p>
      <a class="btn btn-frost" data-wa-send href="${buildWaHref()}">Send order on WhatsApp</a>`;
  };

  const formatLaunch = (iso) => {
    if (!iso) return "soon";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const buildMessage = () => {
    const lines = ["Hi Frost & Flame, I'd like to order:", ""];
    state.cart.forEach((l) => {
      const detail = l.detail ? ` (${l.detail})` : "";
      lines.push(`${l.qty}× ${l.name}${detail} — ${money(l.unitPrice * l.qty)}`);
    });
    lines.push("", `Total: ${money(cartTotal())}`, "");
    if (state.fulfill === "eat-in") {
      lines.push("For eat-in at 194 Hackney Road, London E2 7QL.");
    } else if (state.fulfill === "collection") {
      lines.push("For collection from 194 Hackney Road, London E2 7QL.");
    } else {
      lines.push(`For delivery${state.postcode ? ` to ${state.postcode}` : " (I'll share my address)"}.`);
    }
    if (state.name) lines.push(`Name: ${state.name}`);
    return lines.join("\n");
  };

  const buildWaHref = () => {
    const n = state.data?.meta?.whatsapp || "447587596490";
    const text = state.cart.length ? buildMessage() : "";
    return text
      ? `https://wa.me/${n}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${n}`;
  };

  const setDirectWaLinks = () => {
    const href = buildWaHref();
    $$("[data-wa-direct]").forEach((a) => {
      a.setAttribute("href", href);
    });
  };

  const openCart = () => {
    renderCartBody();
    const d = $("#cart-drawer");
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  };

  const closeCart = () => $("#cart-drawer").close?.() || $("#cart-drawer").removeAttribute("open");

  const observeReveals = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = $$(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    if (!observeReveals.io) {
      observeReveals.io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              observeReveals.io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
    }
    els.forEach((el) => {
      if (!el.classList.contains("is-in")) observeReveals.io.observe(el);
    });
  };

  const setupHeroVideo = () => {
    const video = $("#hero-video");
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tryPlay = () => {
      if (reduce.matches) {
        video.pause();
        video.removeAttribute("autoplay");
        return;
      }
      video.muted = true;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    };
    tryPlay();
    reduce.addEventListener?.("change", tryPlay);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) video.pause();
        else tryPlay();
      }
    );
  };

  const decorateFromData = () => {
    const meta = state.data.meta;
    const launch = formatLaunch(meta.launch_date);
    const eye = $("[data-launch]");
    if (eye) eye.innerHTML = `Opening ${escapeHtml(launch)}<br>Hackney Road E2`;
    const areas = $("#delivery-areas");
    if (areas && meta.delivery_areas) {
      areas.innerHTML = meta.delivery_areas.map((a) => `<span class="area">${escapeHtml(a)}</span>`).join("");
    }
    const story = state.data.story;
    if (story && story.text) {
      const title = $("#story-title");
      if (title && story.title) title.textContent = story.title;
      const box = $("#story-text");
      if (box) box.innerHTML = story.text.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    }
    const y = $("#year");
    if (y) y.textContent = String(new Date().getFullYear());
    setDirectWaLinks();
  };

  const bind = () => {
    document.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-filter]");
      if (tab) {
        state.filter = tab.dataset.filter;
        renderTabs();
        renderMenu();
        return;
      }
      const closeDish = e.target.closest("[data-close-dish]");
      if (closeDish) {
        closeDishSheet({ back: true });
        return;
      }
      const step = e.target.closest("[data-step-delta]");
      if (step) {
        addSourceEl = step;
        adjustQty(step.dataset.stepId, Number(step.dataset.stepDelta), step);
        return;
      }
      const add = e.target.closest("[data-add]");
      if (add) {
        addSourceEl = add;
        onAdd(add.dataset.add);
        return;
      }
      const dishCard = e.target.closest("[data-open-dish]");
      if (dishCard && !e.target.closest("[data-add], [data-step-delta], .qty-stepper, a, button")) {
        openDishSheet(dishCard.dataset.openDish);
        return;
      }
      if (e.target.closest("[data-open-cart]")) {
        openCart();
        return;
      }
      if (e.target.closest("[data-close-cart]")) {
        closeCart();
        return;
      }
      if (e.target.closest("[data-close-dialog]")) {
        $("#item-dialog").close?.();
        return;
      }
      const qty = e.target.closest("[data-qty]");
      if (qty) {
        const i = Number(qty.dataset.qty);
        const d = Number(qty.dataset.delta);
        if (state.cart[i]) {
          state.cart[i].qty += d;
          if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
          saveCart();
          updateCartBadges();
          renderCartBody();
          setDirectWaLinks();
        }
        return;
      }
      const fulfill = e.target.closest("[data-fulfill]");
      if (fulfill) {
        state.fulfill = fulfill.dataset.fulfill;
        renderCartBody();
        return;
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.name === "cust-name") state.name = e.target.value;
      if (e.target.name === "cust-postcode") state.postcode = e.target.value;
      if (e.target.name === "cust-name" || e.target.name === "cust-postcode") {
        const send = $("[data-wa-send]");
        if (send) send.setAttribute("href", buildWaHref());
      }
    });

    $$("dialog").forEach((d) => {
      d.addEventListener("click", (e) => {
        if (e.target === d) d.close?.();
      });
    });
  };

  const init = async () => {
    loadCart();
    bind();
    setupHeroVideo();
    observeReveals();
    updateCartBadges();
    try {
      const res = await fetch("data/menu.json");
      if (!res.ok) throw new Error(`menu.json ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      console.error("Could not load menu.json", err);
      const grid = $("#menu-grid");
      if (grid) grid.innerHTML = `<p class="cart-note">The menu couldn’t be loaded. Please refresh, or message us on WhatsApp.</p>`;
      return;
    }
    decorateFromData();
    renderSignatures();
    renderTabs();
    renderMenu();
    updateCartBadges();
    setDirectWaLinks();
    bindDishSwipe();
    window.addEventListener("popstate", (e) => {
      if (dishSkipPop) {
        dishSkipPop = false;
        return;
      }
      const id = e.state && e.state.ffDish;
      if (id) openDishSheet(id, { push: false });
      else if (dishOpenId) closeDishSheet({ back: false });
    });
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash.startsWith("item-")) openDishSheet(hash.slice(5), { push: true });
    const sheet = $("#dish-sheet");
    if (sheet) {
      sheet.addEventListener("close", () => {
        if (dishOpenId) closeDishSheet({ back: true });
      });
      sheet.addEventListener("click", (e) => {
        if (e.target === sheet) closeDishSheet({ back: true });
      });
    }
    window.FF = {
      data: state.data,
      money,
      itemById,
      addLine,
      openCart,
      openDishSheet,
      getCart: () => state.cart,
    };
    document.dispatchEvent(new CustomEvent("ff:ready"));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
