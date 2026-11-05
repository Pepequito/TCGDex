// Arte dos sets chineses: imagem oficial do pacote de cada produto, da lista pública do site oficial
// de Taiwan/Hong Kong (asia.pokemon-card.com/tw/products/). Vale para as edições zh-tw e, quando o código
// do set coincide, também para as zh-cn. Grava icons/sets/zh/<id>.webp e acrescenta a data/set-art.json.
// Uso, numa pasta com sharp instalado: node zh-set-art.js <pasta fichario>
const fs = require('fs'), path = require('path'), clearWhite = require('./clear-white');
const root = process.argv[2];
const SITE = 'https://asia.pokemon-card.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/<[^>]*>/g, '').normalize('NFKC').replace(/[\s「」『』・!！?？&＆ー〜~\-]/g, '').toLowerCase();
(async () => {
  const html = await (await fetch(`${SITE}/tw/products/`)).text();
  const items = [...html.matchAll(/<li id="product-ID-\d+" class="products-item">([\s\S]*?)<\/li>/g)].map(([, b]) => ({
    link: /<a href="([^"]+)"/.exec(b)?.[1] || '',
    img: /<img[^>]*src="([^"]+)"/.exec(b)?.[1] || '',
    title: /<div class="name">([\s\S]*?)<\/div>/.exec(b)?.[1].trim() || '',
  })).filter(p => p.img);
  for (const p of items) p.code = (/\/card\/([^/]+)\/?$/.exec(p.link)?.[1] || '').toLowerCase();
  console.log('produtos oficiais', items.length);
  const isPack = p => /包/.test(p.title);
  const byCode = new Map();
  for (const p of items) if (p.code && isPack(p) && !byCode.has(p.code)) byCode.set(p.code, p);
  const file = path.join(root, 'data/set-art.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.mkdirSync(path.join(root, 'icons/sets/zh'), { recursive: true });
  for (const [pre, api] of [['zh:', 'zh-tw'], ['zhcn:', 'zh-cn']]) {
    const sets = await (await fetch(`https://api.tcgdex.net/v2/${api}/sets`)).json();
    const pick = s => {
      const code = byCode.get(s.id.toLowerCase());
      if (code) return code;
      const n = clean(s.name);
      const named = n.length >= 2 ? items.filter(p => clean(p.title).includes(n)) : [];
      return named.find(isPack) || named[0] || null;
    };
    let found = 0;
    const missing = [];
    for (const s of sets) {
      const p = pick(s);
      if (!p) { missing.push(`${s.id} ${s.name}`); continue; }
      const res = await fetch(new URL(p.img, SITE));
      await sleep(250);
      if (!res.ok) { missing.push(`${s.id} ${s.name} (imagem ${res.status})`); continue; }
      const rel = `icons/sets/zh/${pre.replace(':', '')}-${s.id.replace(/[^\w.-]/g, '_')}.webp`;
      await (await clearWhite(Buffer.from(await res.arrayBuffer()))).resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(root, rel));
      out[pre + s.id] = rel;
      found++;
    }
    console.log(api, 'artes', found, 'de', sets.length, '| sem correspondência:', missing.join(' ; '));
  }
  fs.writeFileSync(file, JSON.stringify(out));
})();
