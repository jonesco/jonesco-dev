// The Assets section of an app page: app icon, App Store and marketing images, promo files, fonts,
// and the public App Store text. Files come from the app repo, listed in the hub's apps.json.
// Only public listing fields are read from Metadata.md; review contacts and notes never leave the repo.
import { readFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const IMG = /\.(png|jpe?g|gif|webp)$/i;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const kb = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';

function expand(repo, pat) {
  if (!pat.includes('*')) return existsSync(path.join(repo, pat)) ? [pat] : [];
  const dir = path.dirname(pat), re = new RegExp('^' + path.basename(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const abs = path.join(repo, dir);
  return existsSync(abs) ? readdirSync(abs).filter(f => re.test(f)).sort().map(f => path.join(dir, f)) : [];
}
function size(file) {   // pixel size from the PNG header; other types are left blank
  if (!/\.png$/i.test(file)) return null;
  const b = Buffer.alloc(24), fd = openSync(file, 'r'); readSync(fd, b, 0, 24, 0); closeSync(fd);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function thumb(src, dst) {   // a small JPEG for the page; the original stays the download
  for (const [cmd, args] of [['sips', ['-Z', '900', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', src, '--out', dst]],
                             ['magick', [src + '[0]', '-resize', '900x900>', '-quality', '80', dst]],
                             ['convert', [src + '[0]', '-resize', '900x900>', '-quality', '80', dst]]]) {
    try { execFileSync(cmd, args, { stdio: 'ignore' }); if (existsSync(dst)) return true; } catch {}
  }
  return false;
}

// public listing fields only
function listing(file) {
  if (!file || !existsSync(file)) return [];
  const src = readFileSync(file, 'utf8'), out = [];
  const field = name => (src.match(new RegExp(`^- ${name}: (.+)$`, 'm')) || [])[1];
  const section = name => {
    const m = src.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
    return m ? m[1].trim() : null;
  };
  const ok = v => v && !/verify in app store connect/i.test(v);
  for (const [label, v] of [['App Store name', field('App Store name')], ['Subtitle', field('Subtitle')],
    ['Promotional text', section('Promotional text')], ['Keywords', section('Keywords')], ['Description', section('Description')]]) {
    if (!ok(v)) continue;
    // drop a leading editorial note ("This is the text live on the App Store…") from the description
    const text = label === 'Description' ? v.replace(/^This is the text live[^\n]*\n+/, '') : v;
    out.push([label, text.replace(/\*\*/g, '')]);
  }
  return out;
}

export function assetsSection(cfg, repo, outDir) {
  if (!cfg || !repo) return '';
  const base = path.join(outDir, 'assets'); mkdirSync(path.join(base, 'thumbs'), { recursive: true });
  const put = rel => {
    const src = path.join(repo, rel), name = path.basename(rel), dir = slug(path.dirname(rel)) || 'root';
    mkdirSync(path.join(base, dir), { recursive: true });
    cpSync(src, path.join(base, dir, name));
    const href = `assets/${dir}/${encodeURIComponent(name)}`;
    let th = null;
    if (IMG.test(name)) {
      const t = `${dir}--${name.replace(/\.[^.]+$/, '')}.jpg`;
      th = /\.gif$/i.test(name) ? href : thumb(src, path.join(base, 'thumbs', t)) ? `assets/thumbs/${encodeURIComponent(t)}` : href;
    }
    return { name, href, th, bytes: statSync(src).size, px: size(src) };
  };
  const meta = f => `${f.px ? `${f.px[0]} × ${f.px[1]} · ` : ''}${path.extname(f.name).slice(1).toUpperCase()} · ${kb(f.bytes)}`;
  const dl = f => `<a class="asset-dl" href="${f.href}" download>Download</a>`;
  const fig = f => `<figure class="shot"><button type="button" class="zoom" aria-label="View full size"><img src="${f.th}" data-full="${f.href}" alt="${esc(f.name)}" loading="lazy"></button><figcaption><b>${esc(f.name)}</b>${meta(f)} ${dl(f)}</figcaption></figure>`;
  const row = f => `<li><span><b>${esc(f.name)}</b>${meta(f)}</span>${dl(f)}</li>`;

  let html = '';
  if (cfg.icon && existsSync(path.join(repo, cfg.icon))) {
    const f = put(cfg.icon);
    html += `<h3>App icon</h3><div class="asset-icon"><img src="${f.href}" alt="App icon" width="180" height="180"><p><b>${esc(f.name)}</b>${meta(f)}<br>${dl(f)}</p></div>`;
  }
  for (const g of cfg.groups || []) {
    const files = g.files.flatMap(p => expand(repo, p)).map(put);
    if (!files.length) continue;
    const imgs = files.filter(f => f.th), other = files.filter(f => !f.th);
    html += `<h3>${esc(g.title)}</h3>`;
    if (imgs.length) html += `<div class="shots${g.wide ? ' wide' : ''}">${imgs.map(fig).join('')}</div>`;
    if (other.length) html += `<ul class="asset-files">${other.map(row).join('')}</ul>`;
  }
  const text = listing(cfg.metadata && path.join(repo, cfg.metadata));
  if (text.length) html += `<h3>App Store text</h3><dl class="asset-text">${text.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  return html ? `<section id="assets"><h2>Assets</h2><p class="sub">The app icon, App Store and marketing images, and listing text, from the app repo. Click an image to see it full size; Download gets the original file.</p>${html}</section>` : '';
}
