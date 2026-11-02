// Converte thumbs.bin/thumbs.ndjson (gerados por build-thumbs.js) nos arquivos que o app carrega.
// Uso: node export-index.js <pasta dos thumbs> <pasta fichario/data>
const fs = require('fs'), path = require('path');
const [from, to] = process.argv.slice(2);
const S = 32, BITS = 128;
const idx = fs.readFileSync(path.join(from, 'thumbs.ndjson'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const bin = fs.readFileSync(path.join(from, 'thumbs.bin'));
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
(async () => {
  const all = await (await fetch('https://api.tcgdex.net/v2/en/cards')).json();
  const images = new Map(all.map(c => [c.id, c.image]));
  const kept = idx.filter((c, i) => images.get(c.id) && bin.length >= (i + 1) * S * S * 3);
  const out = new Uint32Array(kept.length * 4), paths = [], pathIx = new Map(), rows = [];
  let w = 0;
  idx.forEach((c, i) => {
    if (!images.get(c.id) || bin.length < (i + 1) * S * S * 3) return;
    out.set(hash(bin.subarray(i * S * S * 3, (i + 1) * S * S * 3)), w); w += 4;
    const base = images.get(c.id).replace('https://assets.tcgdex.net/en/', '').replace(/\/[^/]*$/, '');
    if (!pathIx.has(base)) { pathIx.set(base, paths.length); paths.push(base); }
    rows.push([c.id, pathIx.get(base)]);
  });
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, 'hashes.bin'), Buffer.from(out.buffer));
  fs.writeFileSync(path.join(to, 'index.json'), JSON.stringify({ paths, cards: rows }));
  console.log('cartas', rows.length, 'hashes KB', out.byteLength >> 10, 'index KB', fs.statSync(path.join(to, 'index.json')).size >> 10);
})();
