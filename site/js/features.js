(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const escapeHtml = (s) =>
    String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = (n) => (window.FF?.money ? window.FF.money(n) : `£${Number(n).toFixed(2)}`);

  const state = {
    mode: localStorage.getItem("ff-mode") || "frost",
    mood: localStorage.getItem("ff-mood") || "",
    persona: "frosty",
  };

  const data = () => window.FF?.data;
  const items = () => data()?.items || [];
  const itemById = (id) => items().find((i) => i.id === id);

  const applyMode = (mode) => {
    state.mode = mode;
    state.persona = mode === "flame" ? "flamey" : "frosty";
    document.documentElement.setAttribute("data-mode", mode);
    localStorage.setItem("ff-mode", mode);
    $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"));
    const name = data()?.assist?.names?.[state.persona] || (mode === "flame" ? "Flamey" : "Frosty");
    const fab = $("[data-testid='frosty-open-btn']");
    if (fab) {
      fab.textContent = name.slice(0, 2);
      fab.setAttribute("aria-label", `Ask ${name}`);
    }
    window.FFEffects?.setMode(mode);
    swapHero(mode);
    const title = $("#chat-name");
    if (title) title.textContent = name;
  };

  const applyMood = (id) => {
    state.mood = id || "";
    const theme = (data()?.themes || []).find((t) => t.id === id);
    const root = document.documentElement;
    (data()?.themes || []).forEach(() => {});
    // clear previous mood vars by re-setting defaults via removing properties we set
    ["--bg","--bg-elev","--bg-frost","--bg-flame","--frost","--flame","--silver","--muted","--ember"].forEach((k) => root.style.removeProperty(k));
    if (theme) {
      Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
      document.documentElement.setAttribute("data-mood", theme.id);
      localStorage.setItem("ff-mood", theme.id);
    } else {
      document.documentElement.removeAttribute("data-mood");
      localStorage.removeItem("ff-mood");
    }
    $$(".mood-card").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mood === (id || "") ? "true" : "false"));
  };

  const swapHero = (mode) => {
    const video = $("#hero-video");
    const img = $(".hero-media img");
    const source = video?.querySelector("source");
    if (!video) return;
    const isFlame = mode === "flame";
    const poster = isFlame ? "img/flame-poster.webp" : "img/frost-poster.webp";
    const src = isFlame ? "video/flame-loop.mp4" : "video/frost-loop.mp4";
    if (img) img.src = isFlame ? "img/flame-poster.webp" : "img/frost-poster.webp";
    const picSrc = $(".hero-media source");
    if (picSrc) picSrc.srcset = isFlame ? "img/flame-poster-mobile.webp" : "img/frost-poster-mobile.webp";
    video.poster = poster;
    if (source) source.src = src;
    video.load();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) video.play()?.catch?.(() => {});
  };

  /* ---------- clips on signatures ---------- */
  const bindClips = () => {
    const clips = data()?.clips || {};
    $$("#signature-slider .sig-card").forEach((card) => {
      const id = card.dataset.openDish || card.querySelector("[data-add]")?.dataset.add;
      const clip = id && clips[id];
      const media = card.querySelector(".media");
      if (!clip?.mp4 || !media) return;
      media.classList.add("sig-media");
      media.dataset.clipId = id;
      if (!media.querySelector("video")) {
        const v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
        v.setAttribute("aria-hidden", "true");
        const hint = document.createElement("button");
        hint.type = "button";
        hint.className = "clip-hint";
        hint.textContent = "Play";
        media.appendChild(v);
        media.appendChild(hint);
      }
    });

    const playClip = (media) => {
      const id = media.dataset.clipId;
      const clip = data().clips[id];
      const v = media.querySelector("video");
      if (!v || !clip?.mp4) return;
      if (!v.src) v.src = clip.mp4;
      const p = v.play();
      if (p) p.then(() => media.classList.add("is-playing")).catch(() => {});
      const hint = media.querySelector(".clip-hint");
      if (hint) hint.textContent = "Playing";
    };
    const stopClip = (media) => {
      const v = media.querySelector("video");
      if (v) v.pause();
      media.classList.remove("is-playing");
      const hint = media.querySelector(".clip-hint");
      if (hint) hint.textContent = "Play";
    };

    document.addEventListener("pointerenter", (e) => {
      const media = e.target.closest?.(".sig-media");
      if (media) playClip(media);
    }, true);
    document.addEventListener("pointerleave", (e) => {
      const media = e.target.closest?.(".sig-media");
      if (media && !("ontouchstart" in window)) stopClip(media);
    }, true);
    document.addEventListener("click", (e) => {
      const media = e.target.closest?.(".sig-media");
      if (!media) return;
      if (e.target.closest("[data-add]")) return;
      e.preventDefault();
      const v = media.querySelector("video");
      if (media.classList.contains("is-playing") && v && !v.paused) stopClip(media);
      else playClip(media);
    });
  };

  /* ---------- scoring / on-device brain ---------- */
  const isMoney = (n) => n != null && n !== "" && Number.isFinite(Number(n));

  const hasPrice = (it) => {
    if (!it) return false;
    if (isMoney(it.price)) return true;
    if (it.sizes?.some((s) => isMoney(s.price))) return true;
    return false;
  };

  const priceOf = (it) => {
    if (isMoney(it.price)) return Number(it.price);
    if (it.sizes?.length && isMoney(it.sizes[0].price)) return Number(it.sizes[0].price);
    return NaN;
  };

  const excludeAllergens = (it, blocked) => {
    if (!blocked.length) return false;
    return (it.allergens || []).some((a) => blocked.includes(a));
  };

  const scoreItem = (it, want) => {
    if (it.sold_out) return -Infinity;
    if (!hasPrice(it)) return -Infinity;
    if (want.vegan && !(it.diet || []).includes("VG")) return -Infinity;
    if (want.vegetarian && !((it.diet || []).includes("V") || (it.diet || []).includes("VG"))) return -Infinity;
    const blocked = [];
    if (want.no_nuts) blocked.push("nuts");
    if (want.no_gluten) blocked.push("gluten");
    if (want.no_milk) blocked.push("milk");
    if (excludeAllergens(it, blocked)) return -Infinity;
    if (want.budget != null && priceOf(it) > want.budget) return -Infinity;

    let s = 0;
    const cat = it.category;
    const frostCats = new Set(["stone","desserts","drinks","gulab","shakes","smoothies","cold"]);
    const flameCats = new Set(["starters","indo-chinese","street-specials","mains","breads","tiffins","hot","pulao","curry","street","specials"]);
    if (want.spicy && ((it.diet || []).includes("S") || (it.diet || []).includes("SS") || (it.level || 0) >= 6)) s += 4;
    if (want.sweet && ["stone","desserts","drinks","gulab","shakes"].includes(cat)) s += 4;
    if (want.cold && (frostCats.has(cat) || it.tone === "frost")) s += 3;
    if (want.hot && (flameCats.has(cat) || it.tone === "flame")) s += 3;
    if (want.chocolate && /choco|oreo|brownie|nutella/i.test(it.name + it.description)) s += 4;
    if (want.sharing && (cat === "combos" || /for two|for 2/i.test(it.name))) s += 4;
    if (want.andhra && /gongura|pulao|andhra/i.test(it.name + it.description)) s += 3;
    if (want.chai && /chai|tea/i.test(it.name)) s += 3;
    if (want.mango && /mango/i.test(it.name)) s += 3;
    if ((data()?.signature_ids || []).includes(it.id)) s += 1;
    s += (it.level || 4) * 0.05;
    return s;
  };

  const parseWant = (text, extra = {}) => {
    const t = (text || "").toLowerCase();
    const num = t.match(/£\s*(\d+(?:\.\d+)?)/) || t.match(/\b(\d+)\s*(?:quid|pounds)?\b/);
    const party = t.match(/\b(?:for|feed)\s*(\d+)\b/) || t.match(/\b(\d+)\s*(?:of us|people|friends)\b/);
    return {
      spicy: /spic|hot\b|fiery|chilli|chili|inferno/.test(t),
      sweet: /sweet|dessert|ice cream|stone|chocolate|jamun/.test(t),
      cold: /cold|chill|ice|frost|cool/.test(t),
      hot: /hot|warm|fire|flame|pulao|curry|chaat/.test(t),
      chocolate: /choc|oreo|nutella|brownie/.test(t),
      mango: /mango/.test(t),
      chai: /chai|tea/.test(t),
      vegan: extra.vegan || /\bvegan\b/.test(t),
      vegetarian: extra.vegetarian || /\bveg\b|vegetarian/.test(t),
      no_nuts: extra.no_nuts || /no nuts|nut-free|nut free/.test(t),
      no_gluten: extra.no_gluten || /no gluten|gluten-free|gluten free/.test(t),
      no_milk: extra.no_milk || /no milk|dairy-free|dairy free/.test(t),
      sharing: extra.party > 1 || /shar|for two|for 2|of us|group|friends/.test(t),
      andhra: /andhra|gongura|never tried/.test(t),
      budget: extra.budget != null ? extra.budget : num ? Number(num[1]) : null,
      party: extra.party || (party ? Number(party[1]) : 1),
    };
  };

  const recommend = (text, extra = {}, avoid = [], n = 3) => {
    const want = parseWant(text, extra);
    const scored = items()
      .filter((it) => !avoid.includes(it.id))
      .map((it) => ({ it, s: scoreItem(it, want) }))
      .filter((x) => x.s > -Infinity)
      .sort((a, b) => b.s - a.s);
    const picks = [];
    for (const row of scored) {
      if (picks.length >= n) break;
      if (want.budget != null) {
        const sum = picks.reduce((t, p) => t + priceOf(p.it) * (p.qty || 1), 0) + priceOf(row.it);
        // allow a little headroom on "under £10" style if first item alone is ok
        if (picks.length && sum > want.budget) continue;
      }
      const reason = reasonFor(row.it, want);
      picks.push({ it: row.it, why: reason, qty: want.sharing && row.it.category === "combos" ? 1 : 1, unit_price: priceOf(row.it) });
    }
    return { want, picks };
  };

  const reasonFor = (it, want) => {
    if (want.vegan && (it.diet || []).includes("VG")) return "A vegan option from the menu.";
    if (want.spicy && ((it.diet || []).includes("S") || (it.diet || []).includes("SS"))) return "Marked spicy on our menu.";
    if (want.sweet && ["stone","desserts","drinks","gulab","shakes"].includes(it.category)) return "A cold, sweet finish from the stone side.";
    if (want.sharing && it.category === "combos") return "A set made for sharing.";
    if (want.andhra && /gongura|pulao/i.test(it.name)) return "An Andhra-style dish from the kitchen.";
    if (it.tone === "frost") return "From the cold side of the kitchen.";
    if (it.tone === "flame") return "From the hot side of the kitchen.";
    return "A good match from today’s menu.";
  };

  const answerFacts = (text) => {
    const t = (text || "").toLowerCase();
    const meta = data()?.meta || {};
    const launch = meta.launch_date
      ? new Date(meta.launch_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "soon";
    if (/open|hours|tonight|time|when do you/.test(t)) {
      return `We’re not open yet — opening ${launch}, then ${meta.hours_label || "11am–11pm daily"}. Messages sent outside hours are answered when we next open.`;
    }
    if (/deliver|postcode|area|e1|e2|e8|e9|dine|eat.?in|collection|seat|visit|caf[eé]|parlour/.test(t)) {
      return `We’re a café and dessert parlour at ${meta.address || "194 Hackney Road, London E2 7QL"}, with eat-in (about 20 seats), collection, and delivery to ${ (meta.delivery_areas || []).join(", ") }.`;
    }
    if (/whatsapp|order|how do i|how does/.test(t)) {
      return "Add dishes to your order here, then press Send order on WhatsApp. We’ll reply with your total and a time. No payment is taken on this site.";
    }
    if (/nut|allergen|gluten|milk|dairy/.test(t)) {
      const nuts = items().filter((i) => (i.allergens || []).includes("nuts")).map((i) => i.name);
      if (/nut/.test(t)) return `These dishes are tagged as containing nuts: ${nuts.join(", ") || "none listed"}. Always check the allergen line on each dish before ordering.`;
      return "Each dish lists its allergens on the menu. If you have an allergy, check that list and message us on WhatsApp before ordering.";
    }
    if (/human|person|someone|problem|complaint|staff/.test(t)) {
      return { handoff: true, text: "I can pass you to the team on WhatsApp — I’m a menu assistant, not a person." };
    }
    return null;
  };

  /* ---------- chat ---------- */
  const renderChatPicks = (picks) => {
    if (!picks?.length) return "";
    return `<div class="chat-picks">${picks.map((p) => {
      const it = p.it || itemById(p.item_id);
      if (!it) return "";
      return `<button type="button" class="chat-pick" data-add-pick="${escapeHtml(it.id)}"><span>${escapeHtml(it.name)} · ${money(p.unit_price || priceOf(it))}</span><span>Add</span></button>`;
    }).join("")}</div>`;
  };

  const addChat = (role, text, picks) => {
    const log = $("#chat-log");
    if (!log) return;
    const div = document.createElement("div");
    div.className = `bubble bubble-${role === "user" ? "user" : "bot"}`;
    if (role !== "user") div.setAttribute("data-testid", "chat-reply");
    div.innerHTML = `<p style="margin:0">${escapeHtml(text)}</p>${renderChatPicks(picks)}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  const history = [];

  const onDeviceAssist = (message) => {
    const fact = answerFacts(message);
    if (fact && typeof fact === "string") return { reply: fact, picks: [] };
    if (fact && fact.handoff) return { reply: fact.text, picks: [], handoff: true };
    const rec = recommend(message, {}, [], 3);
    if (!rec.picks.length) {
      return { reply: "I couldn’t find a safe match for that on the menu. Try another craving, or browse the menu and add dishes yourself.", picks: [] };
    }
    const lines = rec.picks.map((p) => `${p.it.name} (${money(p.unit_price)}) — ${p.why}`);
    const name = data()?.assist?.names?.[state.persona] || "Frosty";
    return {
      reply: `Based on the menu, ${name} would suggest:\n\n${lines.join("\n")}`,
      picks: rec.picks,
    };
  };

  const askAssistant = async (message) => {
    addChat("user", message);
    history.push({ role: "user", text: message });
    const typing = $("#chat-typing");
    if (typing) typing.hidden = false;
    let result = null;
    const api = data()?.assist?.api;
    if (api) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            first_name: $("#chat-firstname")?.value || null,
            history: history.slice(-4),
            persona: state.persona,
          }),
          signal: ctrl.signal,
        });
        if (res.ok) result = await res.json();
      } catch (_) { /* fall back */ }
      clearTimeout(timer);
    }
    if (!result?.reply) result = onDeviceAssist(message);
    // attach add-to-cart picks even when the API replied
    if (!result.picks) {
      const rec = recommend(message, {}, [], 3);
      // only attach if the reply seems to mention food
      result.picks = rec.picks.length && !answerFacts(message) ? rec.picks : [];
    }
    if (typing) typing.hidden = true;
    addChat("bot", result.reply, result.picks);
    history.push({ role: "frosty", text: result.reply });
  };

  const openChat = () => {
    const panel = $("#chat-panel");
    panel.hidden = false;
    if (!$("#chat-log").children.length) {
      const name = data()?.assist?.names?.[state.persona] || "Frosty";
      addChat("bot", `Hi, I’m ${name}, a menu assistant — not a person. Tell me what you fancy, or ask about hours, delivery and allergens.`);
    }
    $("#chat-input")?.focus();
  };
  const closeChat = () => { $("#chat-panel").hidden = true; };

  /* ---------- builder ---------- */
  const builderState = { size: 0, base: "", mixins: [], toppings: [] };

  const builderPrice = () => {
    const item = itemById("create-your-own-stone");
    const d = data();
    if (!item) return 0;
    let p = item.sizes?.[builderState.size]?.price ?? item.price ?? 0;
    (builderState.toppings || []).forEach((name) => { p += Number(d.topping_prices?.[name] || 0); });
    return Math.round(p * 100) / 100;
  };

  const renderBuilder = () => {
    const root = $("#builder-root");
    const d = data();
    const item = itemById("create-your-own-stone");
    const b = d?.builder;
    if (!root || !item || !b) return;
    if (!builderState.base) builderState.base = b.bases[0]?.name || "";
    const pills = (name, opts, type) =>
      opts.map((o, i) => {
        const val = o.name || o;
        const extra = o.price != null ? ` · ${money(o.price)}` : o.add ? ` · +${money(o.add)}` : type === "topping" ? ` · +${money(d.topping_prices?.[val] || 0)}` : "";
        const on = type === "size" ? builderState.size === i
          : type === "base" ? builderState.base === val
          : type === "mixin" ? builderState.mixins.includes(val)
          : builderState.toppings.includes(val);
        return `<button type="button" class="chip ${on ? "is-on" : ""}" data-build="${type}" data-val="${escapeHtml(val)}" data-idx="${i}" aria-pressed="${on}">${escapeHtml(val)}${extra}</button>`;
      }).join("");

    const allergens = (() => {
      const set = new Set(item.allergens || []);
      const base = b.bases.find((x) => x.name === builderState.base);
      (base?.allergens || []).forEach((a) => set.add(a));
      builderState.mixins.forEach((n) => (b.mixins.find((m) => m.name === n)?.allergens || []).forEach((a) => set.add(a)));
      builderState.toppings.forEach((n) => (b.toppings.find((m) => m.name === n)?.allergens || []).forEach((a) => set.add(a)));
      return [...set];
    })();

    root.innerHTML = `
      <p class="hero-lead" style="max-width:36rem">Build your own stone ice cream: pick a size, base and two mix-ins. The price includes 1 base and 2 mix-ins, folded on the frozen stone.</p>
      <div class="progress" aria-hidden="true">
        <span class="is-on">Size</span><span class="${builderState.base ? "is-on" : ""}">Base</span>
        <span class="${builderState.mixins.length ? "is-on" : ""}">Mix-ins</span>
        <span class="${builderState.toppings.length ? "is-on" : ""}">Toppings</span>
      </div>
      <div class="builder-steps feature-card">
        <div class="opt-group"><h3>Size</h3><div class="step-pills">${pills("size", item.sizes, "size")}</div></div>
        <div class="opt-group"><h3>Base</h3><div class="step-pills">${pills("base", b.bases, "base")}</div></div>
        <div class="opt-group"><h3>Mix-ins <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--muted)">(choose two)</span></h3>
          <div class="step-pills">${pills("mixin", b.mixins, "mixin")}</div>
          <p class="note" data-testid="build-mixin-hint">${builderState.mixins.length === 2 ? "Two mix-ins selected." : "Choose two mix-ins."}</p>
        </div>
        <div class="opt-group"><h3>Toppings <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--muted)">(optional)</span></h3>
          <div class="step-pills">${pills("topping", b.toppings, "topping")}</div>
        </div>
        <p class="allergens" data-testid="build-allergens">Allergens: ${allergens.length ? allergens.join(", ") : "Choose a base to see allergens"}</p>
        <div style="display:flex;flex-wrap:wrap;gap:.7rem;align-items:center;justify-content:space-between">
          <div class="live-price" data-testid="build-price">${money(builderPrice())}</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost" type="button" data-testid="build-surprise-btn">Surprise me</button>
            <button class="btn btn-frost" type="button" data-testid="build-add-btn">Add to order</button>
          </div>
        </div>
      </div>`;
  };

  const surpriseBuild = () => {
    const b = data().builder;
    const item = itemById("create-your-own-stone");
    builderState.size = Math.floor(Math.random() * (item.sizes?.length || 1));
    builderState.base = b.bases[Math.floor(Math.random() * b.bases.length)].name;
    const mix = [...b.mixins].sort(() => Math.random() - 0.5);
    builderState.mixins = mix.slice(0, 2).map((m) => m.name);
    builderState.toppings = Math.random() < 0.4 ? [b.toppings[Math.floor(Math.random() * b.toppings.length)].name] : [];
    renderBuilder();
  };

  const addBuildToCart = () => {
    const item = itemById("create-your-own-stone");
    if (!builderState.base) return;
    const size = item.sizes?.[builderState.size]?.name || "";
    const detail = [size, builderState.base, builderState.mixins.join(" & "), builderState.toppings.join(", ")].filter(Boolean).join(" · ");
    window.FF.addLine({ id: item.id, name: item.name, unitPrice: builderPrice(), detail, qty: 1 });
    const btn = $("[data-testid='build-add-btn']");
    if (btn) { btn.textContent = "Your stone is in the cart"; setTimeout(() => { if (btn) btn.textContent = "Add to order"; }, 1800); }
  };

  /* ---------- matchmaker ---------- */
  const mm = { toggles: {}, party: 1, budget: 20, noLimit: false, last: null };

  const renderMatchmaker = () => {
    const root = $("#mm-form");
    const cfg = data()?.matchmaker;
    if (!root || !cfg) return;
    root.innerHTML = `
      <label for="mm-input">${escapeHtml(cfg.label)}</label>
      <textarea id="mm-input" data-testid="mm-input" rows="2" maxlength="300" placeholder="${escapeHtml(cfg.placeholder)}" class="ff-input" style="width:100%;margin:.4rem 0 0;background:#0b0d10;border:1px solid var(--line-strong);border-radius:.8rem;padding:.7rem .8rem;color:inherit"></textarea>
      <div class="chat-hints" style="padding:0.7rem 0" aria-label="Example requests">
        ${cfg.chips.map((c,i) => `<button type="button" data-testid="mm-chip-${i}" data-mm-chip="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
      </div>
      <div class="step-pills" role="group" aria-label="Diet and allergen toggles">
        ${cfg.toggles.map(([id,label]) => `<button type="button" class="chip" data-testid="mm-toggle-${id}" data-mm-toggle="${id}" aria-pressed="false">${escapeHtml(label)}</button>`).join("")}
      </div>
      <div class="fields" style="margin-top:1rem">
        <label>How many of you?
          <input type="number" min="1" max="6" value="1" data-testid="mm-party" id="mm-party">
        </label>
        <label>Budget <span data-testid="mm-budget-value">${money(20)}</span>
          <input type="range" min="5" max="40" step="1" value="20" data-testid="mm-budget-slider" id="mm-budget">
        </label>
        <label style="text-transform:none;letter-spacing:0;display:flex;align-items:center;gap:.5rem;flex-direction:row">
          <input type="checkbox" data-testid="mm-no-limit" id="mm-nolimit"> No limit
        </label>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem">
        <button class="btn btn-frost" type="submit" data-testid="mm-submit-btn">Find my match</button>
        <button class="btn btn-ghost" type="button" data-testid="mm-surprise-btn">Surprise me</button>
      </div>`;
  };

  const renderMmResults = (res) => {
    const box = $("#mm-results");
    if (!box) return;
    if (!res?.picks?.length) {
      box.innerHTML = `<p class="feature-card">The Matchmaker’s on a break — try the menu, or tell me a little more about what you fancy.</p>`;
      return;
    }
    box.innerHTML = `<p>${escapeHtml(res.intro || "Here’s a match from the kitchen.")}</p>` +
      res.picks.map((p, i) => `
        <article class="feature-card pick-card" data-testid="mm-pick-${i}">
          <h3>${p.qty > 1 ? `${p.qty} × ` : ""}${escapeHtml(p.name)}</h3>
          <p class="price">${money((p.unit_price || 0) * (p.qty || 1))}</p>
          ${p.why ? `<p class="why">“${escapeHtml(p.why)}”</p>` : ""}
          <button class="btn btn-add" type="button" data-mm-add="${i}">Add</button>
        </article>`).join("") +
      `<button class="btn btn-ghost" type="button" data-testid="mm-different-btn">Show me something different</button>
       <button class="btn btn-frost" type="button" data-testid="mm-add-all">Add all</button>`;
    mm.last = res;
  };

  const runMatchmaker = async (text, opts = {}) => {
    const box = $("#mm-results");
    if (box) box.innerHTML = `<p data-testid="mm-loader">mixing on the stone…</p>`;
    const payload = {
      message: text,
      toggles: { ...mm.toggles },
      budget: mm.noLimit ? null : mm.budget,
      party_size: mm.party,
      avoid_ids: opts.avoid || [],
    };
    let res = null;
    const api = data()?.assist?.matchmaker_api;
    if (api) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
        if (r.ok) res = await r.json();
      } catch (_) {}
      clearTimeout(timer);
    }
    if (!res?.picks) {
      const rec = recommend(text, { ...mm.toggles, party: mm.party, budget: mm.noLimit ? null : mm.budget }, opts.avoid || [], Math.min(4, Math.max(2, mm.party)));
      res = {
        intro: rec.picks.length ? "A match from the menu, chosen for what you fancied." : "",
        picks: rec.picks.map((p) => ({ item_id: p.it.id, name: p.it.name, unit_price: p.unit_price, qty: 1, why: p.why, diet: p.it.diet, allergens: p.it.allergens })),
      };
    }
    renderMmResults(res);
  };

  const addMmPick = (p) => {
    const it = itemById(p.item_id);
    if (!it) return;
    window.FF.addLine({ id: it.id, name: it.name, unitPrice: Number(p.unit_price || priceOf(it)), detail: p.size || "", qty: p.qty || 1 });
  };

  /* ---------- dial, mix, play, plans, postcode ---------- */
  const renderDial = () => {
    const root = $("#dial-root");
    if (!root) return;
    const level = Number(root.dataset.level || 4);
    const name = data()?.levels?.[String(level)] || "";
    const list = items().filter((i) => Number(i.level) === level).slice(0, 6);
    const dots = [1,2,3,4,5,6,7].map((n) => `<i class="${n <= level ? "is-on" : ""}" style="background:${n<=level?`color-mix(in srgb, var(--frost) ${(7-n)/6*100}%, var(--flame))`:"var(--line)"}"></i>`).join("");
    root.innerHTML = `
      <div class="dial">
        <div class="dial-dots" aria-hidden="true">${dots}</div>
        <label>Ice-to-Fire level
          <input type="range" min="1" max="7" value="${level}" id="dial-range" aria-label="Ice-to-Fire level ${level} of 7, ${name}">
        </label>
        <p class="dial-level"><span class="num">${level}</span> · ${escapeHtml(name)}</p>
        <div class="menu-grid" style="grid-template-columns:1fr">${list.map((it) => `
          <article class="dish" style="grid-template-columns:1fr">
            <div class="dish-body" style="grid-column:1/-1">
              <h3>${escapeHtml(it.name)}</h3>
              <p>${escapeHtml(it.description)}</p>
              <div class="dish-foot"><span class="price">${money(priceOf(it))}</span>
              <button class="btn btn-add" type="button" data-add="${escapeHtml(it.id)}">Add</button></div>
            </div>
          </article>`).join("") || "<p>No dishes sit exactly on this step.</p>"}</div>
      </div>`;
  };

  const renderMix = () => {
    const root = $("#mix-root");
    if (!root) return;
    const frost = items().filter((i) => i.tone === "frost" && i.category !== "combos");
    const flame = items().filter((i) => i.tone === "flame" && i.category !== "combos");
    const fd = data()?.mix?.frost_defaults || [];
    const ld = data()?.mix?.flame_defaults || [];
    const fSel = itemById(root.dataset.frost || fd.find((id) => itemById(id)) || frost[0]?.id);
    const lSel = itemById(root.dataset.flame || ld.find((id) => itemById(id)) || flame[0]?.id);
    if (fSel) root.dataset.frost = fSel.id;
    if (lSel) root.dataset.flame = lSel.id;
    const total = (fSel ? priceOf(fSel) : 0) + (lSel ? priceOf(lSel) : 0);
    const sel = (list, cur, side) =>
      `<label>${side === "frost" ? "From the frost side" : "From the flame side"}
        <select data-mix="${side}">${list.map((i) => `<option value="${i.id}" ${i.id===cur?.id?"selected":""}>${escapeHtml(i.name)} · ${money(priceOf(i))}</option>`).join("")}</select>
       </label>`;
    root.innerHTML = `
      <p>Can’t choose? Mix one of each — something cold from the stone, something hot from the fire.</p>
      <div class="mix-grid fields">${sel(frost, fSel, "frost")}${sel(flame, lSel, "flame")}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;gap:1rem;flex-wrap:wrap">
        <div class="live-price">${money(total)}</div>
        <button class="btn btn-frost" type="button" data-testid="mix-add" data-mix-add>Add this mix</button>
      </div>`;
  };

  const renderPlay = () => {
    const root = $("#play-root");
    const play = data()?.play;
    if (!root || !play) return;
    const quiz = play.quiz;
    root.innerHTML = `
      <div class="play-tabs">
        <button class="tab" type="button" data-play-tab="mix" aria-selected="true">Mix one of each</button>
        <button class="tab" type="button" data-play-tab="quiz" aria-selected="false" data-testid="play-open-quiz">${escapeHtml(quiz.title || "Quiz")}</button>
        <button class="tab" type="button" data-play-tab="puzzles" aria-selected="false">Puzzles</button>
      </div>
      <div data-play-panel="mix"><div id="mix-root"></div></div>
      <div data-play-panel="quiz" hidden></div>
      <div data-play-panel="puzzles" hidden></div>`;
    renderMix();
    renderQuiz(0);
    renderPuzzles();
  };

  const renderQuiz = (qIndex, score = 0) => {
    const panel = $("[data-play-panel='quiz']");
    const quiz = data()?.play?.quiz;
    if (!panel || !quiz) return;
    if (qIndex >= quiz.questions.length) {
      panel.innerHTML = `<p class="feature-card" data-testid="quiz-done">You scored ${score} / ${quiz.questions.length}. ${score === quiz.questions.length ? "Perfect." : "Have another go, or mix a meal instead."}</p>
        <button class="btn btn-ghost" type="button" data-quiz-restart>Play again</button>`;
      return;
    }
    const q = quiz.questions[qIndex];
    const choices = q.choices || q.options || [];
    panel.innerHTML = `<p class="kicker">Question ${qIndex + 1} of ${quiz.questions.length}</p>
      <p class="quiz-q">${escapeHtml(q.question || q.q || q.text)}</p>
      <div class="quiz-choices">${choices.map((c,i) => `<button type="button" data-quiz-choice="${i}" data-quiz-i="${qIndex}" data-quiz-score="${score}">${escapeHtml(typeof c === "string" ? c : c.text)}</button>`).join("")}</div>`;
    panel.dataset.answer = String(q.answer ?? q.correct ?? 0);
  };

  const renderPuzzles = () => {
    const panel = $("[data-play-panel='puzzles']");
    const puzzles = data()?.play?.puzzles || [];
    if (!panel) return;
    panel.innerHTML = `<div class="puzzle-list">${puzzles.map((p,i) => `
      <button type="button" data-puzzle="${i}"><strong>${escapeHtml(p.title)}</strong><br><span class="note">${escapeHtml((p.tags||[]).join(" · "))}</span></button>`).join("")}</div>
      <div id="puzzle-view"></div>`;
  };

  const showPuzzle = (i) => {
    const p = data()?.play?.puzzles?.[i];
    const view = $("#puzzle-view");
    if (!p || !view) return;
    view.innerHTML = `<article class="feature-card" data-testid="puzzle-open">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.question)}</p>
      <button class="btn btn-ghost" type="button" data-puzzle-hint="${i}" data-hint-n="0">Show a hint</button>
      <p class="note" id="puzzle-hint"></p>
      <button class="btn btn-ghost" type="button" data-puzzle-answer="${i}">Reveal answer</button>
      <p class="note" id="puzzle-answer" hidden></p>
    </article>`;
  };

  const renderPlans = () => {
    const root = $("#plans-root");
    const cfg = data()?.plans;
    if (!root || !cfg) return;
    const deals = items().filter((i) => i.category === "combos");
    const empty = !cfg.items?.length;
    root.innerHTML = `
      <p>${escapeHtml(cfg.lead)}</p>
      ${empty ? `<div class="feature-card"><p>${escapeHtml(cfg.empty)}</p></div>` : cfg.items.map((p) => `<article class="feature-card"><h3>${escapeHtml(p.name)}</h3><p class="price">${money(p.price)} · ${escapeHtml(p.period || "")}${p.meals_per_week ? ` · ${p.meals_per_week} meals a week` : ""}</p>${p.sample_menu ? `<p>${escapeHtml(p.sample_menu)}</p>` : ""}</article>`).join("")}
      <h3 style="font-family:var(--font-display);font-weight:500;margin:1.5rem 0 .6rem">Element Combos</h3>
      <p class="note">Set meals already on the menu, with their real prices.</p>
      <div class="menu-grid" style="margin-top:1rem">${deals.map((it) => `
        <article class="dish" style="grid-template-columns:1fr"><div class="dish-body">
          <h3>${escapeHtml(it.name)}</h3><p>${escapeHtml(it.description)}</p>
          <div class="dish-foot"><span class="price">${money(priceOf(it))}</span>
          <button class="btn btn-add" type="button" data-add="${it.id}">Add</button></div>
        </div></article>`).join("")}</div>
      <form class="plan-form feature-card" data-testid="plan-request">
        <h3 style="margin:0;font-family:var(--font-display);font-weight:500">Request a plan</h3>
        <label>Your name <input name="pname" required autocomplete="name"></label>
        <label>Phone <input name="pphone" required autocomplete="tel"></label>
        <label>Postcode <input name="ppost" autocomplete="postal-code"></label>
        <label>Preferred start <input name="pstart" placeholder="As soon as possible"></label>
        <p class="note">${escapeHtml(cfg.note)}</p>
        <button class="btn btn-frost" type="submit">Request this plan on WhatsApp</button>
      </form>`;
  };

  const bindPostcode = () => {
    const form = $("#postcode-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = (form.postcode.value || "").toUpperCase().trim().replace(/\s+/g, " ");
      const full = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/;
      const out = /^[A-Z]{1,2}\d[A-Z\d]?$/;
      let outward = null;
      if (full.test(raw)) outward = raw.includes(" ") ? raw.split(" ")[0] : raw.slice(0, -3);
      else if (out.test(raw)) outward = raw;
      const areas = data()?.meta?.delivery_areas || [];
      const msg = $("#postcode-msg");
      if (!outward) { msg.textContent = "Enter a UK postcode, for example E2 7QL."; msg.className = "pc-msg"; return; }
      if (areas.includes(outward)) { msg.textContent = `Yes — we deliver to ${outward}.`; msg.className = "pc-msg is-ok"; }
      else { msg.textContent = `We’re not in ${outward} yet — we deliver to ${areas.join(", ")}. Eat-in and collection at 194 Hackney Road are also options.`; msg.className = "pc-msg is-no"; }
    });
  };

  const renderMoods = () => {
    const grid = $("#mood-grid");
    if (!grid) return;
    const themes = data()?.themes || [];
    grid.innerHTML = `<button type="button" class="mood-card" data-mood="" aria-pressed="${!state.mood}"><strong>Default</strong><span>The original Frost &amp; Flame look.</span></button>` +
      themes.map((t) => `<button type="button" class="mood-card" data-mood="${t.id}" aria-pressed="${state.mood===t.id}">
        <strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.sublabel)} · ${escapeHtml(t.greeting)}</span>
      </button>`).join("");
  };

  /* ---------- events ---------- */
  const bind = () => {
    document.addEventListener("click", (e) => {
      const mode = e.target.closest("[data-mode]");
      if (mode && mode.closest(".mode-toggle")) { applyMode(mode.dataset.mode); return; }
      if (e.target.closest("[data-open-mood]")) { $("#mood-sheet").showModal?.(); return; }
      if (e.target.closest("[data-close-mood]")) { $("#mood-sheet").close?.(); return; }
      const mood = e.target.closest(".mood-card");
      if (mood) { applyMood(mood.dataset.mood); $("#mood-sheet").close?.(); return; }
      if (e.target.closest("[data-testid='frosty-open-btn']")) { openChat(); return; }
      if (e.target.closest("[data-close-chat]")) { closeChat(); return; }
      const pick = e.target.closest("[data-add-pick]");
      if (pick) {
        const it = itemById(pick.dataset.addPick);
        if (it) window.FF.addLine({ id: it.id, name: it.name, unitPrice: priceOf(it), detail: "", qty: 1 });
        return;
      }
      const hint = e.target.closest("[data-chat-hint]");
      if (hint) { $("#chat-input").value = hint.textContent; askAssistant(hint.textContent); return; }

      const btype = e.target.closest("[data-build]");
      if (btype) {
        const t = btype.dataset.build, val = btype.dataset.val, idx = Number(btype.dataset.idx);
        if (t === "size") builderState.size = idx;
        if (t === "base") builderState.base = val;
        if (t === "mixin") {
          const i = builderState.mixins.indexOf(val);
          if (i >= 0) builderState.mixins.splice(i, 1);
          else if (builderState.mixins.length < 2) builderState.mixins.push(val);
        }
        if (t === "topping") {
          const i = builderState.toppings.indexOf(val);
          if (i >= 0) builderState.toppings.splice(i, 1);
          else builderState.toppings.push(val);
        }
        renderBuilder();
        return;
      }
      if (e.target.closest("[data-testid='build-surprise-btn']")) { surpriseBuild(); return; }
      if (e.target.closest("[data-testid='build-add-btn']")) { addBuildToCart(); return; }

      const chip = e.target.closest("[data-mm-chip]");
      if (chip) {
        $("#mm-input").value = chip.dataset.mmChip;
        return;
      }
      const tog = e.target.closest("[data-mm-toggle]");
      if (tog) {
        const id = tog.dataset.mmToggle;
        mm.toggles[id] = !mm.toggles[id];
        tog.setAttribute("aria-pressed", mm.toggles[id] ? "true" : "false");
        tog.classList.toggle("is-on", !!mm.toggles[id]);
        return;
      }
      if (e.target.closest("[data-testid='mm-surprise-btn']")) {
        const s = data().matchmaker.surprise;
        $("#mm-input").value = s;
        runMatchmaker(s);
        return;
      }
      if (e.target.closest("[data-testid='mm-different-btn']") && mm.last) {
        runMatchmaker($("#mm-input").value || data().matchmaker.surprise, { avoid: mm.last.picks.map((p) => p.item_id) });
        return;
      }
      const addOne = e.target.closest("[data-mm-add]");
      if (addOne && mm.last) { addMmPick(mm.last.picks[Number(addOne.dataset.mmAdd)]); return; }
      if (e.target.closest("[data-testid='mm-add-all']") && mm.last) { mm.last.picks.forEach(addMmPick); return; }

      const mixAdd = e.target.closest("[data-mix-add]");
      if (mixAdd) {
        const root = $("#mix-root");
        const a = itemById(root.dataset.frost), b = itemById(root.dataset.flame);
        if (a) window.FF.addLine({ id: a.id, name: a.name, unitPrice: priceOf(a), detail: "", qty: 1 });
        if (b) window.FF.addLine({ id: b.id, name: b.name, unitPrice: priceOf(b), detail: "", qty: 1 });
        mixAdd.textContent = "Mix added to your order";
        return;
      }

      const tab = e.target.closest("[data-play-tab]");
      if (tab) {
        $$("[data-play-tab]").forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
        $$("[data-play-panel]").forEach((p) => { p.hidden = p.dataset.playPanel !== tab.dataset.playTab; });
        return;
      }
      const qc = e.target.closest("[data-quiz-choice]");
      if (qc) {
        const panel = $("[data-play-panel='quiz']");
        const correct = Number(panel.dataset.answer);
        const choice = Number(qc.dataset.quizChoice);
        const i = Number(qc.dataset.quizI);
        let score = Number(qc.dataset.quizScore);
        $$("[data-quiz-choice]").forEach((b) => {
          b.disabled = true;
          if (Number(b.dataset.quizChoice) === correct) b.classList.add("is-right");
          else if (b === qc) b.classList.add("is-wrong");
        });
        if (choice === correct) score += 1;
        setTimeout(() => renderQuiz(i + 1, score), 550);
        return;
      }
      if (e.target.closest("[data-quiz-restart]")) { renderQuiz(0, 0); return; }
      const pz = e.target.closest("[data-puzzle]");
      if (pz) { showPuzzle(Number(pz.dataset.puzzle)); return; }
      const ph = e.target.closest("[data-puzzle-hint]");
      if (ph) {
        const p = data().play.puzzles[Number(ph.dataset.puzzleHint)];
        const n = Number(ph.dataset.hintN);
        const hint = (p.hints || [])[n];
        if (hint) { $("#puzzle-hint").textContent = hint; ph.dataset.hintN = String(n + 1); }
        return;
      }
      const pa = e.target.closest("[data-puzzle-answer]");
      if (pa) {
        const p = data().play.puzzles[Number(pa.dataset.puzzleAnswer)];
        const el = $("#puzzle-answer");
        el.hidden = false;
        el.textContent = p.answer;
        return;
      }
    });

    document.addEventListener("submit", (e) => {
      if (e.target.id === "chat-form") {
        e.preventDefault();
        const input = $("#chat-input");
        const msg = (input.value || "").trim();
        if (msg) { input.value = ""; askAssistant(msg); }
        return;
      }
      if (e.target.id === "mm-form") {
        e.preventDefault();
        runMatchmaker(($("#mm-input").value || "").trim() || data().matchmaker.surprise);
        return;
      }
      if (e.target.matches("[data-testid='plan-request']")) {
        e.preventDefault();
        const f = e.target;
        const name = f.pname.value.trim(), phone = f.pphone.value.replace(/\D/g, "");
        if (!name || phone.length < 10) return;
        const lines = [
          data().plans.wa_intro,
          `Name: ${name}`,
          `Phone: ${f.pphone.value.trim()}`,
          f.ppost.value ? `Postcode: ${f.ppost.value.trim()}` : "",
          `Preferred start: ${f.pstart.value.trim() || "As soon as possible"}`,
          "No payment taken on the website.",
        ].filter(Boolean);
        const wa = data().meta.whatsapp;
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "mm-party") mm.party = Math.max(1, Math.min(6, Number(e.target.value) || 1));
      if (e.target.id === "mm-budget") {
        mm.budget = Number(e.target.value);
        const v = $("[data-testid='mm-budget-value']");
        if (v) v.textContent = mm.noLimit ? "No limit" : money(mm.budget);
      }
      if (e.target.id === "mm-nolimit") {
        mm.noLimit = e.target.checked;
        const v = $("[data-testid='mm-budget-value']");
        if (v) v.textContent = mm.noLimit ? "No limit" : money(mm.budget);
      }
      if (e.target.id === "dial-range") {
        $("#dial-root").dataset.level = e.target.value;
        renderDial();
      }
      if (e.target.matches("[data-mix]")) {
        $("#mix-root").dataset[e.target.dataset.mix] = e.target.value;
        renderMix();
      }
    });
  };

  const boot = () => {
    if (!data()) return;
    applyMood(state.mood);
    applyMode(state.mode);
    renderMoods();
    bindClips();
    renderBuilder();
    renderMatchmaker();
    renderDial();
    renderPlay();
    renderPlans();
    bindPostcode();
    const hints = $("#chat-hints");
    const prompts = data()?.assist?.prompts || [];
    if (hints) hints.innerHTML = prompts.map((p) => `<button type="button" data-chat-hint>${escapeHtml(p)}</button>`).join("");
    const disc = $("#chat-disclaimer");
    if (disc) disc.textContent = data()?.assist?.disclaimer || "";
  };

  bind();
  if (window.FF?.data) boot();
  else document.addEventListener("ff:ready", boot);
})();
