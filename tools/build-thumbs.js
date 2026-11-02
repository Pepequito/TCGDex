// Baixa cada carta uma vez e guarda só a miniatura 32x32 RGB da região da arte, de onde sai a impressão digital.
const fs = require('fs'), sharp = require('sharp');
const OUT = 'thumbs.bin', IDX = 'thumbs.ndjson', CONC = 4;
const ART = { x: .08, y: .11, w: .84, h: .36 };
(async () => {
  const done = new Set(fs.existsSync(IDX) ? fs.readFileSync(IDX, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const all = await (await fetch('https://api.tcgdex.net/v2/en/cards')).json();
  const queue = all.filter(c => c.image && !/^(A|B)\d+[a-z]?-|^P-/.test(c.id) && !done.has(c.id));
  console.log('pendentes', queue.length);
  const bin = fs.openSync(OUT, 'a'), idx = fs.openSync(IDX, 'a');
  let n = 0, fail = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        const res = await fetch(c.image + '/low.webp');
        if (!res.ok) throw new Error(res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        const img = sharp(buf).removeAlpha(), m = await img.metadata();
        const raw = await img.extract({ left: Math.round(m.width * ART.x), top: Math.round(m.height * ART.y), width: Math.round(m.width * ART.w), height: Math.round(m.height * ART.h) })
          .resize(32, 32, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer();
        fs.writeSync(bin, raw);
        fs.writeSync(idx, JSON.stringify({ id: c.id, n: c.localId }) + '\n');
      } catch { fail++; }
      if (++n % 500 === 0) console.log(n, 'falhas', fail);
    }
  }));
  console.log('fim', n, 'falhas', fail);
})();
