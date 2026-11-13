/* Heavy snowfall (Frost) and realistic rising fire + embers (Flame).
   GPU canvas, pauses when hidden / reduced-motion. */
(() => {
  const canvas = document.getElementById("fx-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0, h = 0, dpr = 1, flakes = [], embers = [], flames = [], jets = [];
  let raf = 0, last = 0, mode = "frost";
  let sprCore, sprMid, sprTip, sprEmber, sprSpark;

  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    navigator.connection?.saveData;

  const makeSprite = (stops, size = 96) => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [p, col] of stops) g.addColorStop(p, col);
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    return c;
  };

  const makeSprites = () => {
    // Soft radial particles: yellow core → orange → deep red → transparent
    sprCore = makeSprite([
      [0, "rgba(255,252,220,0.95)"],
      [0.12, "rgba(255,236,120,0.85)"],
      [0.32, "rgba(255,170,40,0.55)"],
      [0.58, "rgba(255,80,10,0.22)"],
      [1, "rgba(80,0,0,0)"],
    ]);
    sprMid = makeSprite([
      [0, "rgba(255,200,80,0.8)"],
      [0.2, "rgba(255,130,24,0.55)"],
      [0.5, "rgba(210,40,0,0.28)"],
      [0.78, "rgba(120,8,0,0.1)"],
      [1, "rgba(40,0,0,0)"],
    ]);
    sprTip = makeSprite([
      [0, "rgba(255,120,40,0.55)"],
      [0.28, "rgba(200,30,0,0.32)"],
      [0.6, "rgba(90,0,0,0.12)"],
      [1, "rgba(20,0,0,0)"],
    ]);
    sprEmber = makeSprite([
      [0, "rgba(255,240,180,1)"],
      [0.18, "rgba(255,180,60,0.85)"],
      [0.45, "rgba(255,90,16,0.35)"],
      [1, "rgba(80,0,0,0)"],
    ], 64);
    sprSpark = makeSprite([
      [0, "rgba(255,250,230,1)"],
      [0.25, "rgba(255,200,90,0.7)"],
      [0.6, "rgba(255,120,30,0.2)"],
      [1, "rgba(0,0,0,0)"],
    ], 48);
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spawnFrost = () => {
    const n = w < 500 ? 110 : w < 900 ? 150 : 200;
    flakes = [];
    for (let i = 0; i < n; i++) {
      const layer = Math.random();
      flakes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: layer < 0.35 ? 0.6 + Math.random() * 1.1 : layer < 0.75 ? 1.4 + Math.random() * 2 : 2.4 + Math.random() * 3.2,
        vy: 0.35 + layer * 1.35 + Math.random() * 0.5,
        vx: -0.45 + Math.random() * 0.9,
        a: 0.2 + layer * 0.55,
        blur: layer < 0.4 ? 2 + Math.random() * 3 : layer > 0.85 ? 0.5 : 0,
        wob: Math.random() * Math.PI * 2,
        wobS: 0.004 + Math.random() * 0.012,
        rot: Math.random() * Math.PI,
        rv: (Math.random() - 0.5) * 0.02,
        crystal: layer > 0.72 && Math.random() < 0.55,
      });
    }
  };

  const resetFlameParticle = (p, scatter) => {
    const jet = jets[(Math.random() * jets.length) | 0] || { x: Math.random() * w, h: h * 0.3, spread: 30 };
    const spread = jet.spread || 30;
    p.x = jet.x + (Math.random() - 0.5) * spread;
    p.ox = jet.x;
    p.maxH = jet.h * (0.7 + Math.random() * 0.45);
    p.y = scatter ? h - Math.random() * p.maxH : h + Math.random() * 16;
    p.vy = -(0.9 + Math.random() * 2.6);
    p.r = 18 + Math.random() * 34;
    p.life = 0.7 + Math.random() * 0.9;
    p.age = scatter ? Math.random() * p.life * 0.85 : 0;
    p.t1 = Math.random() * Math.PI * 2;
    p.t2 = Math.random() * Math.PI * 2;
    p.t1s = 0.004 + Math.random() * 0.012;
    p.t2s = 0.009 + Math.random() * 0.02;
    p.kind = Math.random(); // 0 tip, 1 core
    return p;
  };

  const resetEmber = (p, scatter) => {
    p.x = Math.random() * w;
    p.y = scatter ? Math.random() * h : h - Math.random() * 50;
    p.r = 1.6 + Math.random() * 4.2;
    p.vy = -(0.35 + Math.random() * 1.55);
    p.vx = (Math.random() - 0.5) * 0.5;
    p.a = 0.55 + Math.random() * 0.45;
    p.life = 0.55 + Math.random() * 0.7;
    p.age = scatter ? Math.random() * p.life : 0;
    p.wob = Math.random() * Math.PI * 2;
    p.wobS = 0.006 + Math.random() * 0.014;
    p.spark = Math.random() < 0.35;
    p.tw = Math.random() * Math.PI * 2;
    return p;
  };

  const spawnFlame = () => {
    const jetCount = Math.max(8, Math.round(w / 40));
    jets = [];
    for (let i = 0; i < jetCount; i++) {
      const tall = i % 3 === 0;
      jets.push({
        x: ((i + 0.25 + Math.random() * 0.5) / jetCount) * w,
        h: h * (0.36 + Math.random() * 0.26 + (tall ? 0.14 : 0)),
        spread: 22 + Math.random() * 36,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.0035,
      });
    }
    const nFire = w < 500 ? 220 : w < 900 ? 300 : 380;
    flames = [];
    for (let i = 0; i < nFire; i++) flames.push(resetFlameParticle({}, true));

    const nEmber = w < 500 ? 200 : w < 900 ? 280 : 360;
    embers = [];
    for (let i = 0; i < nEmber; i++) embers.push(resetEmber({}, true));
  };

  const drawCrystal = (x, y, r, rot, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(230,246,255,${a})`;
    ctx.lineWidth = Math.max(0.5, r * 0.22);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
    }
    ctx.stroke();
    ctx.restore();
  };

  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    if (document.hidden || reduced() || !mode) return;
    const dt = Math.min(32, t - last || 16);
    last = t;
    ctx.clearRect(0, 0, w, h);

    if (mode === "frost") {
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, "rgba(150,210,240,0.07)");
      wash.addColorStop(0.5, "rgba(80,160,200,0.03)");
      wash.addColorStop(1, "rgba(180,230,255,0.06)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      for (const p of flakes) {
        p.wob += p.wobS * dt;
        p.rot += p.rv * dt;
        p.x += (p.vx + Math.sin(p.wob) * 0.55) * (dt / 16);
        p.y += p.vy * (dt / 16);
        if (p.y > h + 8) { p.y = -8; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.crystal) {
          drawCrystal(p.x, p.y, p.r * 1.4, p.rot, p.a);
        } else {
          if (p.blur) {
            ctx.shadowColor = "rgba(220,240,255,0.85)";
            ctx.shadowBlur = p.blur * 5;
          } else ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(236,248,255,${p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    } else if (mode === "flame") {
      // Warm ember wash, stronger near the fire bed
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, "rgba(40,8,0,0.08)");
      wash.addColorStop(0.5, "rgba(80,18,0,0.06)");
      wash.addColorStop(0.78, "rgba(160,40,0,0.1)");
      wash.addColorStop(1, "rgba(255,70,8,0.2)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // Soft heat bed along the bottom (not a hard shape)
      ctx.globalCompositeOperation = "lighter";
      const bedH = Math.min(h * 0.28, 260);
      const bed = ctx.createRadialGradient(w * 0.5, h + 10, 10, w * 0.5, h + 10, Math.max(w * 0.75, bedH * 2.2));
      bed.addColorStop(0, "rgba(255,190,50,0.45)");
      bed.addColorStop(0.35, "rgba(255,90,12,0.28)");
      bed.addColorStop(0.7, "rgba(180,20,0,0.1)");
      bed.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bed;
      ctx.fillRect(0, h - bedH * 1.4, w, bedH * 1.4);

      for (const j of jets) {
        j.phase += j.speed * dt;
        const flicker = 0.86 + Math.sin(j.phase) * 0.12 + Math.sin(j.phase * 2.4) * 0.08;
        const jh = j.h * flicker;
        const jw = j.spread * (1.1 + Math.sin(j.phase * 1.3) * 0.15);
        const jx = j.x + Math.sin(j.phase * 0.8) * 8;
        const g = ctx.createRadialGradient(jx, h, 4, jx, h - jh * 0.15, jh * 0.55);
        g.addColorStop(0, "rgba(255,210,80,0.38)");
        g.addColorStop(0.4, "rgba(255,90,16,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(jx, h - jh * 0.08, jw, jh * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particle flames — additive soft orbs, yellow core to deep red
      for (const p of flames) {
        p.t1 += p.t1s * dt;
        p.t2 += p.t2s * dt;
        p.age += dt / 1000;
        const flicker = 0.78 + Math.sin(p.t1 * 3.1) * 0.14 + Math.sin(p.t2 * 5.2) * 0.1;
        const turb = Math.sin(p.t1) * 0.85 + Math.sin(p.t2) * 0.55;
        p.x += turb * (dt / 16);
        p.y += p.vy * flicker * (dt / 16);
        const progress = Math.max(0, Math.min(1, p.age / p.life));
        const risen = h - p.y;
        if (progress >= 1 || risen > p.maxH || p.y < h - p.maxH - 20) {
          resetFlameParticle(p, false);
          continue;
        }
        const r = p.r * (1.15 - progress * 0.62) * flicker;
        let a = (1 - progress * 0.55) * 0.95 * flicker;
        if (risen < 16) a *= risen / 16;
        const spr = progress < 0.28 || p.kind > 0.72 ? sprCore : progress < 0.62 ? sprMid : sprTip;
        ctx.globalAlpha = a;
        ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
      }

      // Glowing embers drifting up across the full screen
      for (const p of embers) {
        p.wob += p.wobS * dt;
        p.tw += 0.012 * dt;
        p.age += dt / 1000;
        p.x += (p.vx + Math.sin(p.wob) * 0.55) * (dt / 16);
        p.y += p.vy * (dt / 16);
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        const progress = p.age / p.life;
        if (p.y < -12 || progress >= 1) {
          resetEmber(p, false);
          continue;
        }
        const twinkle = 0.55 + Math.sin(p.tw) * 0.45;
        const a = Math.max(0, p.a * (1 - progress * 0.75) * twinkle);
        const r = p.r * (p.spark ? 2.8 : 4.2) * (0.9 + twinkle * 0.25);
        ctx.globalAlpha = a;
        ctx.drawImage(p.spark ? sprSpark : sprEmber, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  };

  window.FFEffects = {
    setMode(next) {
      mode = next;
      if (reduced()) {
        mode = null;
        ctx.clearRect(0, 0, w, h);
        return;
      }
      if (next === "flame") spawnFlame();
      else spawnFrost();
    },
  };

  makeSprites();
  resize();
  window.addEventListener("resize", () => {
    resize();
    if (mode === "flame") spawnFlame();
    else if (mode === "frost") spawnFrost();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) last = performance.now();
  });
  raf = requestAnimationFrame(tick);
})();
