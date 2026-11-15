// Hero kaleidoscope: an offscreen source of orbiting shapes, drawn into twelve alternating mirrored wedges.
(() => {
  const cv = document.getElementById('kal'); if (!cv) return;
  const x = cv.getContext('2d'), TAU = Math.PI * 2, N = 12, a = TAU / N, S = 440;
  const src = document.createElement('canvas'); src.width = src.height = S;
  const s = src.getContext('2d');
  const cols = ['#ffffff', '#bae6ff', '#82cfff', '#33b1ff', '#1192e8', '#e5f6ff'];
  const paint = t => {
    const g = s.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#01305a'); g.addColorStop(1, '#021c36');
    s.fillStyle = g; s.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const ang = t * (.3 + (i % 7) * .08) + i * 2.4, rr = 24 + (i * 37) % 300;
      const px = Math.cos(ang) * rr * .9 + 80, py = Math.sin(ang * 1.2) * rr * .7 + 80;
      const pulse = 1 + .45 * Math.sin(t * 1.7 + i);
      s.fillStyle = s.strokeStyle = cols[i % 6]; s.globalAlpha = .92; s.lineWidth = 5;
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
  };
  const draw = t => {
    paint(t); x.fillStyle = '#021c36'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H / 2); x.rotate(t * .05);
    for (let k = 0; k < N; k++) {
      x.save(); x.rotate(k * a); if (k % 2) x.scale(1, -1);
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, -0.004, a + 0.004); x.closePath(); x.clip();
      x.drawImage(src, 0, 0, S, S, 0, 0, R, R); x.restore();
    }
    x.restore();
  };
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = true, t0 = performance.now(), last = 3;
  size(); draw(last);
  window.addEventListener('resize', () => { size(); draw(last); });
  if (!still) {
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { on = e[0].isIntersecting; }).observe(cv);
    const loop = now => { if (on) draw(last = 3 + (now - t0) / 1000 * .9); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
