// Para sets ocidentais sem logo em nenhuma fonte (trainer kits, promos, McDonald's...), escolhe até 3 cartas
// do próprio set para o app mostrar em leque, inteiras, no lugar do logo. Nos trainer kits, prefere o Pokémon
// que dá nome ao kit. Grava data/set-fan.json: { setId: [imagem, imagem, imagem] }.
// Uso: node set-fan.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
(async () => {
  const dir = process.argv[2];
  const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const extra = JSON.parse(fs.readFileSync(path.join(dir, 'set-logos.json'), 'utf8'));
  const ptLogos = JSON.parse(fs.readFileSync(path.join(dir, 'set-logos-pt.json'), 'utf8'));
  const [en, pt] = await Promise.all(['en', 'pt'].map(l => fetch(`https://api.tcgdex.net/v2/${l}/sets`).then(r => r.json())));
  const ptById = new Map(pt.map(s => [s.id, s]));
  const pocket = id => /^(A|B)\d|^P-/.test(id);
  const noLogo = en.filter(s => !pocket(s.id) && !s.logo && !ptById.get(s.id)?.logo && !extra[s.id] && !ptLogos[s.id]);
  const bySet = new Map();
  for (const [id, name, p] of cat.cards) {
    if (p < 0 || /^(ja|zh|zhcn):/.test(id)) continue;
    const set = id.slice(0, id.lastIndexOf('-'));
    if (!bySet.has(set)) bySet.set(set, []);
    const base = cat.paths[p], local = id.slice(id.lastIndexOf('-') + 1);
    bySet.get(set).push({ name, image: base.startsWith('http') ? base : `https://assets.tcgdex.net/${base}/${local}` });
  }
  const out = {}, missing = [];
  for (const s of noLogo) {
    const cards = bySet.get(s.id) || [];
    if (!cards.length) { missing.push(`${s.id} (${s.name})`); continue; }
    const star = /\(([^)]+)\)/.exec(s.name)?.[1]?.replace(/^(Alolan|Pikachu) /, '') || '';
    const named = star ? cards.filter(c => c.name.toLowerCase().includes(star.toLowerCase().split(' ').pop())) : [];
    const pick = [...new Set([...named, ...cards].map(c => c.image))].slice(0, 3);
    out[s.id] = pick;
  }
  fs.writeFileSync(path.join(dir, 'set-fan.json'), JSON.stringify(out));
  console.log('sets com leque', Object.keys(out).length, '| sem nenhuma carta com imagem:', missing.join(', '));
})();
