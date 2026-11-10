// Coloca no catálogo do Explorar (data/catalog.json) as cartas dos sets importados (data/extra-sets/*.json):
// imagens para as cartas que não tinham e, quando a TCGdex já lista o set, todas as cartas dele com nome em
// inglês e em português (assim aparecem na busca mesmo antes de ter imagem).
// Depois rode update-index.js catalog para o scanner reconhecer as cartas novas.
// Uso: node extra-to-catalog.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const file = path.join(dir, 'catalog.json');
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(cat.cards.map(c => [c[0], c]));
const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
const tcgdex = async (lang, id) => { const r = await fetch(`https://api.tcgdex.net/v2/${lang}/sets/${id}`).catch(() => null); return r?.ok ? r.json() : null; };
(async () => {
  let added = 0, images = 0, named = 0;
  for (const f of fs.readdirSync(path.join(dir, 'extra-sets')).filter(f => f.endsWith('.json'))) {
    const set = JSON.parse(fs.readFileSync(path.join(dir, 'extra-sets', f), 'utf8'));
    const [en, pt] = await Promise.all([tcgdex('en', set.id), tcgdex('pt', set.id)]);
    const ptName = new Map((pt?.cards || []).map(c => [c.id, c.name]));
    // Cartas que a TCGdex lista (com imagem dela, se tiver).
    for (const c of en?.cards || []) {
      let row = byId.get(c.id);
      if (!row) { row = [c.id, c.name, -1]; cat.cards.push(row); byId.set(c.id, row); added++; }
      row[1] = c.name;
      const p = ptName.get(c.id);
      if (p && p !== c.name && row[3] !== p) { row[3] = p; named++; }
      if (row[2] < 0 && c.image) { row[2] = ref(c.image.replace('https://assets.tcgdex.net/', '').replace(/\/[^/]*$/, '')); images++; }
    }
    // Imagens da importação para as que continuam sem imagem.
    for (const c of set.cards) {
      let row = byId.get(c.id);
      if (!row) { row = [c.id, c.name, -1]; cat.cards.push(row); byId.set(c.id, row); added++; }
      if (row[2] < 0 && c.image) { row[2] = ref(c.image); images++; }
    }
  }
  fs.writeFileSync(file, JSON.stringify(cat));
  console.log('cartas novas no catálogo', added, '| imagens novas', images, '| nomes em português', named, '| total', cat.cards.length);
})();
