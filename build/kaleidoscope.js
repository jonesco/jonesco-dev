// Hero kaleidoscope: an offscreen source of orbiting shapes, drawn into twelve alternating mirrored wedges.
// Desktop: the pattern leans and turns toward the cursor. Click or tap: the shapes blast out from the center,
// then grow back from it.
(() => {
  const cv = document.getElementById('kal'); if (!cv) return;
  const x = cv.getContext('2d'), TAU = Math.PI * 2, N = 12, a = TAU / N, S = 440;
  // the source is drawn in S units but sized to the wedge on screen, so shapes stay sharp
const src = document.createElement('canvas'); let SRC = S;
  const s = src.getContext('2d');
  const cols = ['#ffffff', '#bae6ff', '#82cfff', '#33b1ff', '#1192e8', '#e5f6ff'];
  const ease = p => 1 - Math.pow(1 - p, 3);
  // cx, cy: the orbit center in the source; spread: how far shapes sit from it; fade: their opacity
  const paint = (t, cx, cy, spread, fade) => {
    s.setTransform(SRC / S, 0, 0, SRC / S, 0, 0);
    const g = s.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#01305a'); g.addColorStop(1, '#021c36');
    s.fillStyle = g; s.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const ang = t * (.3 + (i % 7) * .08) + i * 2.4, rr = (24 + (i * 37) % 300) * spread;
      const px = Math.cos(ang) * rr * .9 + cx, py = Math.sin(ang * 1.2) * rr * .7 + cy;
      const pulse = 1 + .45 * Math.sin(t * 1.7 + i);
      s.fillStyle = s.strokeStyle = cols[i % 6]; s.globalAlpha = .92 * fade; s.lineWidth = 5;
      s.save(); s.translate(px, py); s.rotate(ang * (i % 2 ? 1.6 : -1.1)); s.beginPath();
      const k = i % 6;   // mostly circles: filled, rings, and the odd bar
      if (k === 0) s.fillRect(-28, -9, (56 + (i % 5) * 12) * pulse, 18);
      else if (k === 2 || k === 5) { s.arc(0, 0, (18 + (i * 7) % 30) * pulse, 0, TAU); s.stroke(); }
      else { s.arc(0, 0, (11 + (i * 5) % 30) * pulse, 0, TAU); s.fill(); }
      s.restore();
    }
    s.globalAlpha = 1; s.strokeStyle = '#ffffff'; s.lineWidth = 4; s.beginPath();
    for (let i = 0; i < 4; i++) { const ang = t * .7 + i * 1.4; s.moveTo(40, 40); s.lineTo(40 + Math.cos(ang) * S, 40 + Math.sin(ang) * S); }
    s.stroke();
  };
  let W = 0, H = 0, R = 0;
  const size = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2), b = cv.getBoundingClientRect();
    W = cv.width = Math.round(b.width * d); H = cv.height = Math.round(b.height * d);
    R = Math.hypot(W, H) / 2 + 2;
    SRC = Math.min(2048, Math.ceil(R * 1.15)); src.width = src.height = SRC;
  };
  // pointer state, eased toward the target each frame
  const p = { nx: 0, ny: 0, tx: 0, ty: 0 };
  let blast = -1;   // ms timestamp of the last click, or -1
  const OUT = 650, BACK = 1100;
  const draw = (t, now) => {
    p.nx += (p.tx - p.nx) * .06; p.ny += (p.ty - p.ny) * .06;
    let spread = 1, fade = 1;
    if (blast >= 0) {
      const e = now - blast;
      if (e < OUT) { const q = ease(e / OUT); spread = 1 + q * 5; fade = 1 - q; }
      else if (e < OUT + BACK) { const q = ease((e - OUT) / BACK); spread = q; fade = Math.min(1, q * 2); }
      else blast = -1;
    }
    paint(t, 80 + p.nx * 110, 80 + p.ny * 110, spread, fade);
    x.fillStyle = '#021c36'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2 + p.nx * W * .06, H / 2 + p.ny * H * .06); x.rotate(t * .055 + p.nx * .5);
    // six painted wedges, each mirrored, with a blank wedge between; clipped exactly to its edges so
    // nothing spills into the blank ones
    for (let k = 1; k < N; k += 2) {
      x.save(); x.rotate(k * a); x.scale(1, -1);
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R * 1.15, 0, a); x.closePath(); x.clip();
      x.drawImage(src, 0, 0, SRC, SRC, 0, 0, R * 1.15, R * 1.15); x.restore();
    }
    x.restore();
  };
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = true, t0 = performance.now(), last = 3;
  size(); draw(last, t0);
  window.addEventListener('resize', () => { size(); draw(last, performance.now()); });
  if (still) return;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cv.addEventListener('pointermove', e => {
      const b = cv.getBoundingClientRect();
      p.tx = ((e.clientX - b.left) / b.width) * 2 - 1; p.ty = ((e.clientY - b.top) / b.height) * 2 - 1;
    });
    cv.addEventListener('pointerleave', () => { p.tx = p.ty = 0; });
  }
  cv.addEventListener('click', () => { blast = performance.now(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { on = e[0].isIntersecting; }).observe(cv);
  const loop = now => { if (on) draw(last = 3 + (now - t0) / 1000 * .9, now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
})();
