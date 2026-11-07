// Coloca as cartas dos sets importados (data/extra-sets/*.json) no catálogo do Explorar (data/catalog.json).
// Depois rode update-index.js catalog para o scanner reconhecer as cartas novas.
// Uso: node extra-to-catalog.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const file = path.join(dir, 'catalog.json');
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(cat.cards.map(c => [c[0], c]));
const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
let added = 0, updated = 0;
for (const f of fs.readdirSync(path.join(dir, 'extra-sets')).filter(f => f.endsWith('.json'))) {
  const set = JSON.parse(fs.readFileSync(path.join(dir, 'extra-sets', f), 'utf8'));
  for (const c of set.cards) {
    const p = c.image ? ref(c.image) : -1, row = byId.get(c.id);
    if (!row) { cat.cards.push([c.id, c.name, p]); added++; }
    else if (row[2] < 0 && p >= 0) { row[2] = p; updated++; }
  }
}
fs.writeFileSync(file, JSON.stringify(cat));
console.log('cartas novas no catálogo', added, '| imagens novas', updated, '| total', cat.cards.length);
