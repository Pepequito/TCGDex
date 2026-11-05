// Completa cartas ocidentais sem imagem usando a mesma carta da TCGdex em outro idioma (espanhol, italiano,
// francês ou alemão). A ilustração é a mesma; muda o idioma do texto. Serve para os trainer kits, por exemplo,
// que a TCGdex só tem com imagem em espanhol e italiano.
// Uso: node fill-other-langs.js <pasta fichario/data>   (depois rode update-index.js catalog para o scanner)
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2', LANGS = ['es', 'it', 'fr', 'de'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const file = path.join(process.argv[2], 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
  const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
  const bySet = new Map();
  for (const c of cat.cards) {
    if (c[2] >= 0 || /^(ja|zh|zhcn|custom):/.test(c[0])) continue;
    const set = c[0].slice(0, c[0].lastIndexOf('-'));
    if (!bySet.has(set)) bySet.set(set, []);
    bySet.get(set).push(c);
  }
  let filled = 0;
  const report = [];
  for (const [set, cards] of bySet) {
    const want = new Map(cards.map(c => [c[0].slice(c[0].lastIndexOf('-') + 1), c]));
    const got = {};
    for (const lang of LANGS) {
      if (!want.size) break;
      const res = await fetch(`${API}/${lang}/sets/${encodeURIComponent(set)}`).catch(() => null);
      await sleep(150);
      if (!res?.ok) continue;
      const s = await res.json();
      for (const card of s.cards || []) {
        const c = want.get(card.localId);
        if (!c || !card.image) continue;
        const base = card.image.replace('https://assets.tcgdex.net/', '').replace(/\/[^/]*$/, '');
        c[2] = ref(base);
        want.delete(card.localId);
        got[lang] = (got[lang] || 0) + 1;
        filled++;
      }
    }
    if (Object.keys(got).length) report.push(`${set}: ${Object.entries(got).map(([l, n]) => `${n} em ${l}`).join(', ')}${want.size ? ` (ainda faltam ${want.size})` : ''}`);
  }
  fs.writeFileSync(file, JSON.stringify(cat));
  console.log(report.join('\n'));
  console.log('imagens novas', filled, '| ainda sem imagem', cat.cards.filter(c => c[2] < 0 && !/^(ja|zh|zhcn):/.test(c[0])).length);
})();
