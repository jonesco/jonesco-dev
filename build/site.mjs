// Builds the dev.jonesco.com site into ./dist.
// Usage:
//   node build/site.mjs --local ~/Developer     apps come from local folders (matched by dev.json slug)
//   node build/site.mjs                         apps are cloned from GitHub (set GH_TOKEN for private repos)
// Reads apps.json: [{ "slug", "repo", "ref" }]. Each app needs dev.json and a style/ folder.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i < 0 ? null : path.resolve(args.splice(i, 2)[1].replace(/^~/, os.homedir())); };
const localRoot = opt('--local');
const SYSTEM = '3.5.0';
const sysBase = `https://design.jonesco.com/v/${SYSTEM}`;
const dist = path.join(root, 'dist');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const apps = JSON.parse(readFileSync(path.join(root, 'apps.json'), 'utf8'));

// ---- find each app's folder ----
function findLocal(slug) {
  for (const d of readdirSync(localRoot, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const f = path.join(localRoot, d.name, 'dev.json');
    if (existsSync(f) && JSON.parse(readFileSync(f, 'utf8')).slug === slug) return path.join(localRoot, d.name);
  }
  return null;
}
function clone(a) {
  const dir = path.join(os.tmpdir(), `jonesco-dev-${a.slug}`);
  rmSync(dir, { recursive: true, force: true });
  const tok = process.env.GH_TOKEN ? `x-access-token:${process.env.GH_TOKEN}@` : '';
  execFileSync('git', ['clone', '--depth', '1', '--branch', a.ref || 'main', `https://${tok}github.com/${a.repo}.git`, dir], { stdio: 'inherit' });
  return dir;
}

// ---- chrome shared by the hub pages ----
const head = (title, nav) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="https://dev.jonesco.com/jonesco-dev.svg">
<link rel="icon" type="image/png" sizes="32x32" href="https://dev.jonesco.com/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="96x96" href="https://dev.jonesco.com/icons/favicon-96.png">
<link rel="apple-touch-icon" sizes="180x180" href="https://dev.jonesco.com/icons/apple-touch-icon.png">
<link rel="manifest" href="https://dev.jonesco.com/manifest.webmanifest">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${sysBase}/system.css">
<link rel="stylesheet" href="${sysBase}/patterns.css">
<style>
${readFileSync(path.join(root, 'build/hub.css'), 'utf8')}
</style>
</head>
<body>
<header class="sys-header"><div class="sys-wrap sys-bar">
  <a class="sys-brand" href="__ROOT__"><img class="docs-mark" src="https://dev.jonesco.com/jonesco-dev.svg" alt=""><span>JONESCO.DEV</span></a>
  <nav class="sys-nav" aria-label="Site">${nav}</nav>
</div></header>
`;
const foot = `<footer class="sys-footer"><div class="sys-wrap"><span>Jonesco Dev</span><span>Built from each app’s style folder.</span></div></footer>
</body>
</html>
`;
const hubNav = r => `<a href="${r}">Apps</a><a href="${r}standard/">Standard</a>`;

// ---- build each app ----
const built = [];
for (const a of apps) {
  const dir = localRoot ? findLocal(a.slug) : clone(a);
  if (!dir) { console.error(`skip ${a.slug}: no local folder with dev.json slug "${a.slug}"`); continue; }
  const meta = JSON.parse(readFileSync(path.join(dir, 'dev.json'), 'utf8'));
  const style = path.join(dir, meta.style || 'style');
  if (!existsSync(path.join(style, 'tokens.json'))) { console.error(`skip ${a.slug}: no ${meta.style || 'style'}/tokens.json`); continue; }
  const out = path.join(dist, a.slug);
  execFileSync('node', [path.join(root, 'build/generate.mjs'), style, out, '--hub', '../', '--system', SYSTEM], { stdio: 'inherit' });
  const tokens = JSON.parse(readFileSync(path.join(style, 'tokens.json'), 'utf8'));
  const first = tokens.screens?.[0]?.items?.[0]?.file;
  built.push({ ...meta, thumb: first ? `${a.slug}/screens/${first}` : null, colors: (tokens.color?.groups || []).flatMap(g => g.items).filter(i => !i.to).slice(0, 6).map(i => i.hex) });
  console.log(`built ${a.slug}`);
}

// ---- minimal markdown for the standard page ----
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function md(src) {
  const out = []; const L = src.split('\n'); let i = 0;
  while (i < L.length) {
    const line = L[i]; let m;
    if (line.startsWith('```')) { const buf = []; i++; while (i < L.length && !L[i].startsWith('```')) buf.push(L[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if ((m = line.match(/^(#{1,3}) (.+)/))) { const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
    if (line.startsWith('|')) {
      const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const [h, , ...body] = rows;
      out.push(`<div class="tbl"><table><tr>${cells(h).map(c => `<th>${inline(c)}</th>`).join('')}</tr>${body.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table></div>`);
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ord = /^\d+\./.test(line); const items = [];
      while (i < L.length && /^(- |\d+\. |\s+\S)/.test(L[i]) && L[i].trim() !== '') { if (/^(- |\d+\. )/.test(L[i])) items.push(L[i].replace(/^(- |\d+\. )/, '')); else items[items.length - 1] += ' ' + L[i].trim(); i++; }
      out.push(`<${ord ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`); continue;
    }
    if (line.trim() === '' || line.trim() === '---') { i++; continue; }
    const buf = [line.trim()]; i++;
    while (i < L.length && L[i].trim() !== '' && !/^(#|```|\||- |\d+\. |---)/.test(L[i])) buf.push(L[i++].trim());
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ---- standard page ----
mkdirSync(path.join(dist, 'standard'), { recursive: true });
writeFileSync(path.join(dist, 'standard/index.html'),
  head('Standard · Jonesco Dev', hubNav('../')).replace('__ROOT__', '../') +
  `<main class="sys-wrap prose"><div class="hero"><p class="kicker">Jonesco Dev</p><h1>The app standard</h1></div>\n${md(readFileSync(path.join(root, 'STANDARD.md'), 'utf8').replace(/^# .*\n/, ''))}\n</main>\n` + foot);

// ---- hub index ----
const tiles = built.map(b => `<a class="sys-tile" href="${esc(b.slug)}/">
  <div class="sys-tile__art">${b.thumb ? `<img src="${esc(b.thumb)}" alt="" loading="lazy">` : ''}</div>
  <p class="sys-tile__id">${esc((b.platforms || []).join(' · '))} · v${esc(b.version || '')}</p>
  <h3 class="sys-tile__title">${esc(b.name)}</h3>
  <div class="swatches" aria-hidden="true">${b.colors.map(c => `<i style="background:${c}"></i>`).join('')}</div>
  <p class="sys-tile__text">${esc(b.summary || '')}</p>
</a>`).join('\n');
writeFileSync(path.join(dist, 'index.html'),
  head('Jonesco Dev', hubNav('')).replace('__ROOT__', './') +
  `<main class="sys-wrap"><div class="hero"><p class="kicker">Dev work</p><h1>Apps and their styles</h1><p class="lede">One place to see how each Jonesco app looks: colors, type, spacing, components and open decisions, read from the code.</p></div>
<section><div class="sys-tiles">${tiles || '<p class="empty">No apps yet. Add one to apps.json.</p>'}</div></section>
</main>\n` + foot);
cpSync(path.join(root, 'build/jonesco-dev.svg'), path.join(dist, 'jonesco-dev.svg'));
cpSync(path.join(root, 'build/icons'), path.join(dist, 'icons'), { recursive: true });
writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({ name: 'JONESCO.DEV', short_name: 'JONESCO.DEV', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }], start_url: './', display: 'browser', background_color: '#1192e8', theme_color: '#000000' }, null, 2) + '\n');
writeFileSync(path.join(dist, 'CNAME'), 'dev.jonesco.com\n');
console.log(`site: ${built.length} app(s) in ${dist}`);
