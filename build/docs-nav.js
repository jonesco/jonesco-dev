// Side nav for a style guide page, as on design.jonesco.com: highlights the section in view;
// on phones the sidebar is a menu opened from the header.
(() => {
  const side = document.getElementById('docs-side'), btn = document.querySelector('.docs-menu-btn');
  if (!side || !btn) return;
  const links = [...side.querySelectorAll('.docs-group a[href^="#"]')];
  const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const mark = () => {
    const y = innerHeight * .3; let cur = targets[0];
    for (const t of targets) if (t.getBoundingClientRect().top <= y) cur = t;
    links.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + cur.id));
  };
  addEventListener('scroll', mark, { passive: true }); mark();
  const setMenu = open => {
    document.documentElement.classList.toggle('docs-menu-open', open);
    btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu';
  };
  btn.addEventListener('click', () => setMenu(btn.getAttribute('aria-expanded') !== 'true'));
  side.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setMenu(false); btn.focus(); } });
  matchMedia('(min-width: 861px)').addEventListener('change', m => { if (m.matches) setMenu(false); });
})();
