// Acrescenta as cartas japonesas ao banco de reconhecimento. Só baixa as que ainda não estão lá.
// Uso, numa pasta com sharp instalado: node add-japanese.js <pasta fichario/data>
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const dir = process.argv[2], CONC = 4, S = 32, BITS = 128;
const ART = { x: .08, y: .11, w: .84, h: .36 };
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
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const old = fs.readFileSync(path.join(dir, 'hashes.bin'));
  const have = new Set(index.cards.map(c => c[0]));
  const all = await (await fetch('https://api.tcgdex.net/v2/ja/cards')).json();
  const queue = all.filter(c => c.image && !have.has('ja:' + c.id));
  console.log('pendentes', queue.length);
  const pathIx = new Map(index.paths.map((p, i) => [p, i]));
  const rows = [], hashes = [];
  let n = 0, fail = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        const res = await fetch(c.image + '/low.webp');
        if (!res.ok) throw new Error(res.status);
        const img = sharp(Buffer.from(await res.arrayBuffer())).removeAlpha(), m = await img.metadata();
        const raw = await img.extract({ left: Math.round(m.width * ART.x), top: Math.round(m.height * ART.y), width: Math.round(m.width * ART.w), height: Math.round(m.height * ART.h) })
          .resize(S, S, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer();
        const base = c.image.replace('https://assets.tcgdex.net/ja/', '').replace(/\/[^/]*$/, '');
        if (!pathIx.has(base)) { pathIx.set(base, index.paths.length); index.paths.push(base); }
        rows.push(['ja:' + c.id, pathIx.get(base)]);
        hashes.push(hash(raw));
      } catch { fail++; }
      if (++n % 500 === 0) console.log(n, 'falhas', fail);
    }
  }));
  const extra = new Uint32Array(hashes.length * 4);
  hashes.forEach((h, i) => extra.set(h, i * 4));
  fs.writeFileSync(path.join(dir, 'hashes.bin'), Buffer.concat([old, Buffer.from(extra.buffer)]));
  index.cards.push(...rows);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  console.log('fim', rows.length, 'novas, falhas', fail, 'total', index.cards.length);
})();
