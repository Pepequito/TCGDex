// A base lista algumas cartas sem imagem, mas a imagem costuma existir na pasta do set principal
// (a galeria "swsh12.5gg" fica em "swsh12.5", os "TG" de "swsh12tg" ficam em "swsh12").
// Este script testa esses endereços e grava no data/catalog.json os que existem.
// Uso: node find-images.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const file = path.join(process.argv[2], 'catalog.json');
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const setOf = id => id.replace(/-[^-]+$/, '');
const localOf = id => id.slice(id.lastIndexOf('-') + 1);
// Pastas já conhecidas de cada set, pelas cartas que têm imagem.
const known = new Map();
for (const [id, , p] of cat.cards) if (p >= 0 && !known.has(setOf(id))) known.set(setOf(id), p);
const parentOf = set => set.replace(/(\d)(?:[a-z]+)$/i, '$1');
const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
(async () => {
  const missing = cat.cards.filter(c => c[2] < 0);
  let found = 0, done = 0;
  const queue = [...missing];
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const c = queue.shift(), set = setOf(c[0]), local = encodeURIComponent(decodeURIComponent(localOf(c[0])));
      const bases = [];
      if (known.has(set)) bases.push(cat.paths[known.get(set)]);
      const parent = parentOf(set);
      if (parent !== set && known.has(parent)) bases.push(cat.paths[known.get(parent)]);
      // Set sem nenhuma imagem conhecida: a pasta da série sai das letras iniciais do código ("swshp" fica em "swsh", "SV11W" em "SV").
      if (!bases.length) {
        const ja = set.startsWith('ja:'), raw = set.replace('ja:', ''), serie = (raw.match(/^[a-z]+/i) || [''])[0];
        const series = ja ? [serie, serie.replace(/[a-z]+$/, '')] : [serie, serie.replace(/p$/, '')];
        for (const s of new Set(series.filter(Boolean))) bases.push(`${ja ? 'ja' : 'en'}/${s}/${raw}`);
      }
      for (const base of bases) {
        try {
          const r = await fetch(`https://assets.tcgdex.net/${base}/${local}/low.webp`, { method: 'HEAD' });
          if (r.ok) { c[2] = ref(base); found++; break; }
        } catch { /* tenta o próximo */ }
      }
      if (++done % 1000 === 0) console.log(done, 'testadas', found, 'encontradas');
    }
  }));
  fs.writeFileSync(file, JSON.stringify(cat));
  const left = cat.cards.filter(c => c[2] < 0);
  console.log('sem imagem antes', missing.length, 'encontradas', found, 'ainda sem', left.length, '(ocidentais', left.filter(c => !c[0].startsWith('ja:')).length + ')');
})();
