// Builds an app's style guide from its style/ folder.
// Usage: node build/generate.mjs <style-dir> <out-dir>
// Reads:  tokens.json (required), notes.md, components.html, components.css, screens/*.png
// Writes: <out-dir>/index.html, <out-dir>/STYLE_GUIDE.md, <out-dir>/screens/*
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i < 0 ? null : args.splice(i, 2)[1]; };
const hubUrl = opt('--hub');
                       // link back to the hub, when built inside it
const assetsArg = opt('--assets');                  // JSON file { cfg, repo }: the app's assets, from the hub's apps.json
const SYSTEM = opt('--system') || '3.5.0';         // pinned Jonesco System version
const [styleDir, outDir] = args.map(p => path.resolve(p));
if (!styleDir || !outDir) { console.error('Usage: node build/generate.mjs <style-dir> <out-dir>'); process.exit(1); }

const read = f => readFileSync(path.join(styleDir, f), 'utf8');
const has = f => existsSync(path.join(styleDir, f));
const t = JSON.parse(read('tokens.json'));
const notes = has('notes.md') ? read('notes.md') : '';
const componentsHtml = has('components.html') ? read('components.html') : '';
const componentsCss = has('components.css') ? read('components.css') : '';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Color math
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const inkOn = hex => (ratio(hex, '#FFFFFF') >= ratio(hex, '#161616') ? '#FFFFFF' : '#161616');

// Minimal markdown: headings, bullets, bold, code, paragraphs.
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[to decide\]/g, '<span class="tag">to decide</span>');
}
function renderNotes(md) {
  const sections = []; let cur = null; let list = null; let para = [];
  const flushPara = () => { if (para.length && cur) cur.body.push(`<p class="sub">${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => { if (list && cur) cur.body.push(`<ul class="issues">${list.join('')}</ul>`); list = null; };
  for (const line of md.split('\n')) {
    let m;
    if ((m = line.match(/^## (.+)/))) { flushPara(); flushList(); cur = { title: m[1], body: [] }; sections.push(cur); }
    else if ((m = line.match(/^### (.+)/))) { flushPara(); flushList(); cur?.body.push(`<h3>${inline(m[1])}</h3>`); }
    else if ((m = line.match(/^- (.+)/))) {
      flushPara(); list ||= [];
      const done = m[1].startsWith('[done] ');
      list.push(`<li${done ? ' class="decided"' : ''}>${inline(done ? m[1].slice(7) : m[1])}</li>`);
    }
    else if (line.trim() === '') { flushPara(); flushList(); }
    else if (list) { list[list.length - 1] = list[list.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>'); }
    else para.push(line.trim());
  }
  flushPara(); flushList();
  return sections;
}
const noteSections = renderNotes(notes);
const idOf = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- sections ----
function colorSection() {
  const c = t.color; if (!c) return '';
  const groups = c.groups.map(g => {
    const items = g.items.map(i => {
      const bg = i.to ? `linear-gradient(90deg,${i.hex},${i.to})` : i.dark ? `linear-gradient(90deg,${i.hex} 50%,${i.dark} 50%)` : i.hex;
      const ink = inkOn(i.hex);
      const edge = ratio(i.hex, '#FFFFFF') < 1.15 ? 'box-shadow:inset 0 -1px 0 #dfe2dd;' : '';
      const r = i.contrastOn ? `<span class="ratio">${ratio(i.hex, i.contrastOn).toFixed(1)}:1</span>` : '';
      const tag = i.tag ? ` <span class="tag ok">${esc(i.tag)}</span>` : '';
      const warn = i.warn ? ` <span class="tag">Check</span> ${esc(i.warn)}` : '';
      return `<div class="item${i.decided ? ' decided' : ''}"><div class="chipc" style="background:${bg};color:${ink};${edge}">${esc(i.label || '')}${r}</div><div class="meta"><div class="name">${esc(i.name)}${tag}</div><div class="hex">${i.hex}${i.to ? ' → white' : ''}${i.dark ? ` light · ${i.dark} dark` : ''}</div><div class="use">${esc(i.role)}${warn}</div></div></div>`;
    }).join('\n');
    return `<h3>${esc(g.title)}</h3>\n<div class="sw">\n${items}\n</div>`;
  }).join('\n');
  const op = c.opacity ? `<h3>Opacity in use</h3>\n<div class="tbl"><table><tr><th>Value</th><th>Where</th></tr>${c.opacity.map(([v, w]) => `<tr><td class="num">${esc(v)}</td><td>${esc(w)}</td></tr>`).join('')}</table></div>` : '';
  return `<section id="color"><h2>Color</h2><p class="sub">${esc(c.intro || '')}</p>\n${groups}\n${op}</section>`;
}
function typeSection() {
  const ty = t.type; if (!ty) return '';
  const fam = t.typeface?.stack || `'${t.typeface?.family || 'system-ui'}',system-ui,sans-serif`;
  const rows = ty.styles.map(s => {
    const smp = s.html ?? esc(s.sample ?? '');
    const tab = s.tabular ? 'font-variant-numeric:tabular-nums;' : '';
    const wt = ['', '', '', '', '', '', '', '', ''][0];
    return `<div class="row"><div class="lab"><b>${esc(s.name)}</b><span>${weightName(s.weight)} ${s.size}${s.note ? ` (${esc(s.note)})` : ''}</span></div><div class="smp" style="font:${s.weight} ${s.size}px/1.25 ${fam};${tab}">${smp}</div></div>`;
  }).join('\n');
  return `<section id="type"><h2>Type</h2><p class="sub">${esc(t.typeface?.note || '')} ${esc(ty.intro || '')}</p><h3>Styles in use</h3><div class="spec">${rows}</div>${ty.footnote ? `<p class="sub" style="margin-top:14px">${esc(ty.footnote)}</p>` : ''}</section>`;
}
function weightName(w) { return { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' }[w] || String(w); }
function spaceSection() {
  const out = [];
  if (t.spacing) {
    out.push(`<h3>Spacing in use</h3><div class="scale" role="img" aria-label="Spacing values ${t.spacing.scale.join(', ')}">${t.spacing.scale.map(n => `<div class="bar"><i style="width:${n}px"></i>${n}</div>`).join('')}</div>`);
    if (t.spacing.rows) out.push(`<div class="tbl" style="margin-top:16px"><table><tr><th>Item</th><th>Value</th></tr>${t.spacing.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="num">${esc(b)}</td></tr>`).join('')}</table></div>`);
  }
  if (t.radius) out.push(`<h3>Corner radius in use</h3><div class="radii">${t.radius.map(r => `<div class="rad" style="border-radius:${r.value}px">${r.value}<br>${esc(r.label)}</div>`).join('')}</div>`);
  if (t.border) out.push(`<h3>Borders and shadow</h3><div class="tbl"><table><tr><th>Item</th><th>Value</th></tr>${t.border.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>`);
  return out.length ? `<section id="space"><h2>Spacing and shape</h2>${out.join('\n')}</section>` : '';
}
function componentsSection() {
  return componentsHtml ? `<section id="components"><h2>Components</h2><p class="sub">Drawn here at the app’s real sizes from the values above.</p>${componentsHtml}</section>` : '';
}
function screensSection() {
  if (!t.screens) return '';
  mkdirSync(path.join(outDir, 'screens'), { recursive: true });
  const groups = t.screens.map(g => {
    const figs = g.items.map(i => {
      const src = path.join(styleDir, 'screens', i.file);
      const dst = path.join(outDir, 'screens', i.file);
      if (existsSync(src) && path.resolve(src) !== path.resolve(dst)) cpSync(src, dst);
      return `<figure class="shot"><button type="button" class="zoom" aria-label="View full size"><img src="screens/${esc(i.file)}" alt="${esc(i.title)}" loading="lazy"></button><figcaption><b>${esc(i.title)}</b>${esc(i.caption || '')}</figcaption></figure>`;
    }).join('\n');
    return `<h3>${esc(g.group)}</h3><div class="shots${g.wide ? ' wide' : ''}">${figs}</div>`;
  }).join('\n');
  return `<section id="screens"><h2>Screens</h2><p class="sub">Real captures from the running app, not redrawings. Click one to see it at full size.</p>${groups}</section>`;
}
function notesSections() {
  return noteSections.map(s => `<section id="${idOf(s.title)}"><h2>${inline(s.title)}</h2>${s.body.join('\n')}</section>`).join('\n');
}

const assetsHtml = assetsArg ? (await import('./assets.mjs')).assetsSection(...(({ cfg, repo }) => [cfg, repo, outDir])(JSON.parse(readFileSync(assetsArg, 'utf8')))) : '';
const sections = [
  ['Assets', assetsHtml], ['Color', colorSection()], ['Type', typeSection()], ['Spacing and shape', spaceSection()],
  ['Components', componentsSection()], ['Screens', screensSection()],
].filter(([, h]) => h);
const noteNav = noteSections.map(s => [s.title, idOf(s.title)]);
const nav = [...sections.map(([n, h]) => [n, h.match(/id="([^"]+)"/)[1]]), ...noteNav]
  .map(([n, id]) => `<a href="#${id}">${esc(n)}</a>`).join('');
const hub = hubUrl ? esc(hubUrl) : 'https://dev.jonesco.com/';

const gf = t.typeface?.google
  ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.typeface.family).replace(/%20/g, '+')}:wght@${t.typeface.weights.join(';')}&display=swap">` : '';
const templateCss = readFileSync(path.join(here, 'template.css'), 'utf8');
const appFont = `.app{--font:${t.typeface?.stack || `'${t.typeface?.family || 'system-ui'}',system-ui,sans-serif`}}`;
const scopedComponentsCss = componentsCss.replace(/:root\s*\{/, '.app{');
const lightbox = readFileSync(path.join(here, 'lightbox.js'), 'utf8');
const sysBase = `https://design.jonesco.com/v/${SYSTEM}`;
const title = t.title || t.name + ' styles';
const wrapApp = h => h.replace(/(<section id="components">.*?<p class="sub">[^<]*<\/p>)(.*?)(<\/section>)/s, '$1<div class="app">$2</div>$3');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="https://dev.jonesco.com/jonesco-dev.svg">
<link rel="icon" type="image/png" sizes="32x32" href="https://dev.jonesco.com/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="96x96" href="https://dev.jonesco.com/icons/favicon-96.png">
<link rel="apple-touch-icon" sizes="180x180" href="https://dev.jonesco.com/icons/apple-touch-icon.png">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<title>${esc(title)} · Jonesco.dev</title>
<link rel="stylesheet" href="${sysBase}/system.css">
<link rel="stylesheet" href="${sysBase}/patterns.css">
${gf}
<style>
${templateCss}
${appFont}
${scopedComponentsCss}
</style>
</head>
<body>
<header class="sys-header"><div class="sys-bar docs-bar">
  <a class="sys-brand" href="${hub}"><img class="docs-mark" src="https://dev.jonesco.com/jonesco-dev.svg" alt=""><span>JONESCO.DEV</span></a>
  <nav class="sys-nav" aria-label="Site"><a href="${hub}">Apps</a><a href="${hub}standard/">Standard</a></nav>
  <button class="docs-menu-btn" type="button" aria-expanded="false" aria-controls="docs-side">Menu</button>
</div></header>
<div class="docs-shell">
<aside class="docs-side" id="docs-side">
  <div class="docs-group"><h4>${esc(t.name || 'This app')}</h4><a href="#top">Overview</a>${nav}</div>
  <div class="docs-side-ext"><a href="${hub}">All apps</a><a href="${hub}standard/">Standard</a></div>
</aside>
<main class="docs-main" id="top">
<div class="hero">
  <p class="kicker">Style guide</p>
  <h1>${esc(title)}</h1>
  <p class="lede">${esc(t.intro || '')} Items marked <span class="tag" style="margin-left:0">to decide</span> are places where the app disagrees with itself.</p>
</div>
${wrapApp(sections.map(([, h]) => h).join('\n\n'))}
${notesSections()}
</main>
</div>
<div id="lb" role="dialog" aria-modal="true" aria-label="Screen at full size" hidden>
  <div class="bar"><span id="lbinfo"></span><button type="button" id="lbclose">Close (Esc)</button></div>
  <img id="lbimg" alt="">
</div>
<script>
${lightbox}
${readFileSync(path.join(here, 'docs-nav.js'), 'utf8')}</script>
</body>
</html>
`;

// ---- markdown ----
const md = [];
md.push(`# ${t.title || t.name + ' styles'}`, '', t.intro || '', '', 'Generated from `tokens.json` and `notes.md`. Edit those, not this file.', '');
if (t.color) {
  md.push('## Color', '', t.color.intro || '', '');
  for (const g of t.color.groups) {
    md.push(`### ${g.title}`, '', '| Token | Hex | Used for |', '|---|---|---|');
    for (const i of g.items) {
      const r = i.contrastOn ? ` ${ratio(i.hex, i.contrastOn).toFixed(1)}:1 on ${i.contrastOn === '#FFFFFF' ? 'white' : i.contrastOn}.` : '';
      md.push(`| \`${i.name}\` | \`${i.hex}\`${i.to ? ' to white' : ''}${i.dark ? ` light, \`${i.dark}\` dark` : ''} | ${i.role}${r}${i.warn ? ' Check: ' + i.warn : ''} |`);
    }
    md.push('');
  }
  if (t.color.opacity) { md.push('### Opacity in use', '', '| Value | Where |', '|---|---|', ...t.color.opacity.map(([v, w]) => `| ${v} | ${w} |`), ''); }
}
if (t.type) {
  md.push('## Type', '', `${t.typeface?.note || ''} ${t.type.intro || ''}`.trim(), '', '| Role | Weight | Size |', '|---|---|---|');
  for (const s of t.type.styles) md.push(`| ${s.name} | ${weightName(s.weight)} | ${s.size}${s.note ? ` (${s.note})` : ''} |`);
  if (t.type.footnote) md.push('', t.type.footnote);
  md.push('');
}
if (t.spacing || t.radius || t.border) {
  md.push('## Spacing and shape', '');
  if (t.spacing) md.push(`Spacing values in use: ${t.spacing.scale.join(', ')}.`, '', '| Item | Value |', '|---|---|', ...(t.spacing.rows || []).map(([a, b]) => `| ${a} | ${b} |`), '');
  if (t.radius) md.push('Corner radius: ' + t.radius.map(r => `${r.value} (${r.label})`).join('; ') + '.', '');
  if (t.border) md.push('| Item | Value |', '|---|---|', ...t.border.map(([a, b]) => `| ${a} | ${b} |`), '');
}
if (notes) md.push(notes.replace(/\[done\] /g, '').replace(/\[to decide\]/g, '(to decide)'));
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'index.html'), html);
writeFileSync(path.join(outDir, 'STYLE_GUIDE.md'), md.join('\n') + '\n');
console.log(`wrote ${path.join(outDir, 'index.html')} and STYLE_GUIDE.md`);
