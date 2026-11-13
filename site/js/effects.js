/* Heavy snowfall (Frost) and rising flames + embers (Flame). GPU canvas, pauses when hidden / reduced-motion. */
(() => {
  const canvas = document.getElementById("fx-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0, h = 0, dpr = 1, flakes = [], embers = [], flames = [], raf = 0, last = 0, mode = "frost";

  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    navigator.connection?.saveData;

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
      const layer = Math.random(); // 0 back, 1 front
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

  const spawnFlame = () => {
    const tongue = Math.min(20, Math.max(10, Math.floor(w / 32)));
    flames = [];
    for (let i = 0; i < tongue; i++) {
      flames.push({
        x: ((i + 0.5) / tongue) * w,
        w: 18 + Math.random() * 28,
        h: 90 + Math.random() * 110,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0025 + Math.random() * 0.0035,
        hue: 18 + Math.random() * 22,
      });
    }
    const n = w < 500 ? 90 : w < 900 ? 130 : 170;
    embers = [];
    for (let i = 0; i < n; i++) {
      embers.push({
        x: Math.random() * w,
        y: h * (0.45 + Math.random() * 0.6),
        r: 0.7 + Math.random() * 2.6,
        vy: -(0.35 + Math.random() * 1.15),
        vx: (Math.random() - 0.5) * 0.45,
        a: 0.25 + Math.random() * 0.6,
        life: Math.random(),
        decay: 0.0015 + Math.random() * 0.003,
        wob: Math.random() * Math.PI * 2,
        glow: Math.random() < 0.5,
      });
    }
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
      // icy wash so the whole screen reads as cold stone
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
      // warm ember wash
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, "rgba(40,8,0,0.08)");
      wash.addColorStop(0.55, "rgba(80,20,0,0.05)");
      wash.addColorStop(1, "rgba(255,80,16,0.14)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // rising flame tongues along the bottom
      for (const f of flames) {
        f.phase += f.speed * dt;
        const flicker = 0.82 + Math.sin(f.phase) * 0.18 + Math.sin(f.phase * 2.3) * 0.08;
        const fh = f.h * flicker;
        const fw = f.w * (0.85 + Math.sin(f.phase * 1.6) * 0.18);
        const x = f.x + Math.sin(f.phase * 0.9) * 10;
        const y = h + 8;
        const g = ctx.createLinearGradient(x, y, x, y - fh);
        g.addColorStop(0, `hsla(${f.hue}, 100%, 52%, 0.0)`);
        g.addColorStop(0.15, `hsla(${f.hue}, 100%, 50%, 0.55)`);
        g.addColorStop(0.45, `hsla(${f.hue + 12}, 100%, 58%, 0.4)`);
        g.addColorStop(1, `hsla(${f.hue + 28}, 100%, 72%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - fw, y);
        ctx.bezierCurveTo(x - fw * 0.7, y - fh * 0.35, x - fw * 0.25, y - fh * 0.7, x, y - fh);
        ctx.bezierCurveTo(x + fw * 0.25, y - fh * 0.7, x + fw * 0.7, y - fh * 0.35, x + fw, y);
        ctx.closePath();
        ctx.fill();
      }

      for (const p of embers) {
        p.wob += 0.01 * dt;
        p.x += (p.vx + Math.sin(p.wob) * 0.5) * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.life -= p.decay * dt;
        if (p.y < -10 || p.life <= 0) {
          p.y = h - Math.random() * 40;
          p.x = Math.random() * w;
          p.life = 0.6 + Math.random() * 0.4;
        }
        const a = Math.max(0, p.a * p.life);
        ctx.shadowColor = p.glow ? "rgba(255,170,60,0.9)" : "rgba(255,120,40,0.55)";
        ctx.shadowBlur = p.glow ? 14 : 7;
        ctx.fillStyle = `rgba(255,${140 + ((p.x * 3) % 80) | 0},50,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
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
