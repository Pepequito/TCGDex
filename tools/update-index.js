// Acrescenta ao banco de reconhecimento as cartas que ainda não estão nele: sets novos e downloads que falharam.
// Uso, numa pasta com sharp instalado: node update-index.js <pasta fichario/data> [en|ja]
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const [dir, lang = 'en'] = process.argv.slice(2);
const CONC = 4, S = 32, BITS = 128, ART = { x: .08, y: .11, w: .84, h: .36 };
const zig = [];
for (let s = 1; zig.length < BITS; s++) for (let u = 0; u <= s; u++) { const v = s - u; if (u < S && v < S) zig.push([u, v]); }
const basis = zig.slice(0, BITS).map(([u, v]) => {
  const b = new Float64Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) b[y * S + x] = Math.cos((2 * x + 1) * u * Math.PI / (2 * S)) * Math.cos((2 * y + 1) * v * Math.PI / (2 * S));
  return b;
});
function hash(rgb) {
  const g = new Float64Array(S * S);
  for (let i = 0; i < S * S; i++) g[i] = .3 * rgb[i * 3] + .59 * rgb[i * 3 + 1] + .11 * rgb[i * 3 + 2];
  const co = basis.map(b => { let s = 0; for (let i = 0; i < S * S; i++) s += g[i] * b[i]; return s; });
  const med = [...co].sort((a, b) => a - b)[BITS >> 1];
  const out = new Uint32Array(BITS / 32);
  co.forEach((v, i) => { if (v > med) out[i >> 5] |= 1 << (i & 31); });
  return out;
}
const pocket = id => /^(A|B)\d+[a-z]?-|^P-/.test(id);
async function fetchRetry(url, tries = 3) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 404 || i === tries - 1) return r; } catch (e) { if (i === tries - 1) throw e; }
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
}
(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const old = fs.readFileSync(path.join(dir, 'hashes.bin'));
  const prefix = lang === 'ja' ? 'ja:' : '';
  const have = new Set(index.cards.map(c => c[0]));
  let queue;
  if (lang === 'catalog') {
    // Usa as imagens do catálogo, inclusive as que tools/find-images.js recuperou.
    const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
    queue = cat.cards.filter(([id, , p]) => p >= 0 && !have.has(id)).map(([id, , p]) => {
      const local = id.slice(id.lastIndexOf('-') + 1), lg = id.startsWith('ja:') ? 'ja' : 'en';
      return { id: id.replace(/^ja:/, ''), key: id, lg, image: `https://assets.tcgdex.net/${cat.paths[p]}/${local}` };
    });
  } else {
    const all = await (await fetchRetry(`https://api.tcgdex.net/v2/${lang}/cards`)).json();
    queue = all.filter(c => c.image && !pocket(c.id) && !have.has(prefix + c.id)).map(c => ({ ...c, key: prefix + c.id, lg: lang }));
  }
  console.log('pendentes', queue.length);
  const pathIx = new Map(index.paths.map((p, i) => [p, i]));
  const rows = [], hashes = [], failed = [];
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        const res = await fetchRetry(c.image + '/low.webp');
        if (!res.ok) throw new Error(res.status);
        const img = sharp(Buffer.from(await res.arrayBuffer())).removeAlpha(), m = await img.metadata();
        const raw = await img.extract({ left: Math.round(m.width * ART.x), top: Math.round(m.height * ART.y), width: Math.round(m.width * ART.w), height: Math.round(m.height * ART.h) })
          .resize(S, S, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer();
        const base = c.image.replace(`https://assets.tcgdex.net/${c.lg}/`, '').replace(/\/[^/]*$/, '');
        if (!pathIx.has(base)) { pathIx.set(base, index.paths.length); index.paths.push(base); }
        rows.push([c.key, pathIx.get(base)]);
        hashes.push(hash(raw));
      } catch { failed.push(c.id); }
    }
  }));
  const extra = new Uint32Array(hashes.length * 4);
  hashes.forEach((h, i) => extra.set(h, i * 4));
  fs.writeFileSync(path.join(dir, 'hashes.bin'), Buffer.concat([old, Buffer.from(extra.buffer)]));
  index.cards.push(...rows);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  console.log('novas', rows.length, 'falhas', failed.length, failed.slice(0, 20).join(' '), 'total', index.cards.length);
})();
