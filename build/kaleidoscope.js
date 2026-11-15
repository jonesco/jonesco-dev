// Hero kaleidoscope: an offscreen source of drifting shapes, drawn into twelve alternating mirrored wedges.
(() => {
  const cv = document.getElementById('kal'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const N = 12, seg = Math.PI * 2 / N, S = 640;
  const src = document.createElement('canvas'); src.width = src.height = S;
  const sx = src.getContext('2d');
  const colors = ['#bae6ff', '#82cfff', '#33b1ff', '#1192e8', '#0072c3', '#00539a', '#ffffff'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const shapes = Array.from({ length: 34 }, (_, i) => ({
    x: rnd() * S, y: rnd() * S * 0.6, r: 24 + rnd() * 90, a: rnd() * 6.28,
    vx: (rnd() - 0.5) * 0.5, vy: (rnd() - 0.5) * 0.35, va: (rnd() - 0.5) * 0.008,
    kind: i % 4, color: colors[i % colors.length], fill: rnd() > 0.35,
  }));
  const drawSource = () => {
    sx.fillStyle = '#000'; sx.fillRect(0, 0, S, S);
    for (const s of shapes) {
      s.x += s.vx; s.y += s.vy; s.a += s.va;
      const m = s.r, H = S * 0.6;
      if (s.x < -m) s.x = S + m; if (s.x > S + m) s.x = -m;
      if (s.y < -m) s.y = H + m; if (s.y > H + m) s.y = -m;
      sx.save(); sx.translate(s.x, s.y); sx.rotate(s.a);
      sx.beginPath();
      if (s.kind === 0) sx.rect(-s.r / 2, -s.r / 2, s.r, s.r);
      else if (s.kind === 1) sx.arc(0, 0, s.r / 2, 0, 6.2832);
      else if (s.kind === 2) { sx.moveTo(0, -s.r / 2); sx.lineTo(s.r / 2, s.r / 2); sx.lineTo(-s.r / 2, s.r / 2); sx.closePath(); }
      else sx.rect(-s.r, -5, s.r * 2, 10);
      if (s.fill) { sx.fillStyle = s.color; sx.fill(); } else { sx.strokeStyle = s.color; sx.lineWidth = 6; sx.stroke(); }
      sx.restore();
    }
  };
  let W = 0, H = 0, R = 0;
  const size = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2), b = cv.getBoundingClientRect();
    W = cv.width = Math.round(b.width * d); H = cv.height = Math.round(b.height * d);
    R = Math.hypot(W, H) / 2 + 2;
  };
  const frame = () => {
    drawSource();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(i * seg);
      if (i % 2) { ctx.rotate(seg); ctx.scale(1, -1); }
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -0.004, seg + 0.004); ctx.closePath(); ctx.clip();
      ctx.drawImage(src, 0, 0, R, R);
      ctx.restore();
    }
  };
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = true;
  const loop = () => { if (on) frame(); requestAnimationFrame(loop); };
  size(); for (let i = 0; i < 200; i++) drawSource(); frame();
  window.addEventListener('resize', () => { size(); frame(); });
  if (!still) {
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { on = e[0].isIntersecting; }).observe(cv);
    requestAnimationFrame(loop);
  }
})();
