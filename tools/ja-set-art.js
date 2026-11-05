// Arte dos sets japoneses: imagem oficial do pacote/caixa de cada produto, do site oficial japonês
// (pokemon-card.com, lista pública em products/resultAPI.php). Grava icons/sets/ja/<id>.webp e data/set-art.json.
// O cruzamento com a TCGdex é pelo código do set no link do produto (/ex/sv1s/) ou pelo nome entre 「」.
// Uso, numa pasta com sharp instalado: node ja-set-art.js <pasta fichario>
const fs = require('fs'), path = require('path'), clearWhite = require('./clear-white');
const root = process.argv[2];
const SITE = 'https://www.pokemon-card.com';
const TYPES = ['expansion', 'construction', 'others'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Os títulos oficiais trazem marcação (<big>ex</big>), que sai antes da comparação.
const clean = s => String(s || '').replace(/<[^>]*>/g, '').normalize('NFKC').replace(/[\s「」『』・!！?？&＆ー〜~\-]/g, '').toLowerCase();
// Nomes que a TCGdex escreve diferente do site oficial.
const ALIAS = { S8a: '25th ANNIVERSARY COLLECTION' };
async function products() {
  const all = [];
  for (const type of TYPES) {
    for (let page = 1; ; page++) {
      const url = `${SITE}/products/resultAPI.php?productType=${type}&dateLowerY=1996&dateLowerM=1&dateLowerD=1&dateUpperY=2030&dateUpperM=12&dateUpperD=31&page=${page}`;
      const r = await (await fetch(url)).json();
      all.push(...r.products);
      await sleep(400);
      if (page >= r.maxPage) break;
    }
  }
  return all;
}
(async () => {
  const sets = await (await fetch('https://api.tcgdex.net/v2/ja/sets')).json();
  const list = await products();
  console.log('produtos oficiais', list.length, '| sets na TCGdex', sets.length);
  // O código do set aparece no link do produto: /ex/sv1s/ ou /products/sv/sv1a.html.
  const codeOf = p => { const m = /\/(?:ex\/([^/]+)\/|products\/[^/]+\/([^/.]+)\.html)/.exec(p.link_detailPage || ''); return (m?.[1] || m?.[2] || '').toLowerCase(); };
  const byCode = new Map(), byName = new Map();
  for (const p of list) {
    const code = codeOf(p);
    if (code) byCode.set(code, p);
    const name = /「([^」]+)」/.exec(p.productTitle)?.[1];
    if (name && !byName.has(clean(name))) byName.set(clean(name), p);
  }
  const file = path.join(root, 'data/set-art.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.mkdirSync(path.join(root, 'icons/sets/ja'), { recursive: true });
  // Escolha: produto do tipo pacote com o nome do set no título; depois qualquer produto com o nome;
  // por último o código do link, só se for pacote. Um produto escolhido por vários sets fica só com o do código.
  const isPack = p => /パック/.test(p.productTitle);
  const pickFor = s => {
    const n = clean(ALIAS[s.id] || s.name);
    const named = n.length >= 2 ? list.filter(p => p.tumbsImg && clean(p.productTitle).includes(n)) : [];
    const code = byCode.get(s.id.toLowerCase());
    if (code && isPack(code)) return code;
    return named.find(isPack) || named[0] || (code && isPack(code) ? code : null);
  };
  const chosen = new Map(sets.map(s => [s, pickFor(s)]));
  const uses = new Map();
  for (const p of chosen.values()) if (p) uses.set(p, (uses.get(p) || 0) + 1);
  for (const [s, p] of chosen) if (p && uses.get(p) > 2 && codeOf(p) !== s.id.toLowerCase()) chosen.set(s, null);
  let found = 0;
  const missing = [];
  for (const s of sets) {
    const p = chosen.get(s);
    if (!p?.tumbsImg) { missing.push(`${s.id} ${s.name}`); continue; }
    const res = await fetch(SITE + p.tumbsImg);
    await sleep(250);
    if (!res.ok) { missing.push(`${s.id} ${s.name} (imagem ${res.status})`); continue; }
    const rel = `icons/sets/ja/${s.id}.webp`;
    await (await clearWhite(Buffer.from(await res.arrayBuffer()))).resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(root, rel));
    out['ja:' + s.id] = rel;
    found++;
  }
  fs.writeFileSync(file, JSON.stringify(out));
  console.log('artes', found, '| sem correspondência', missing.length);
  console.log(missing.join('\n'));
})();
