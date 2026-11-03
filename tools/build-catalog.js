// Gera data/catalog.json: todas as cartas (ocidentais e japonesas) com nome em inglês, nome em português e caminho da imagem.
// O app usa esse arquivo para buscar e navegar sem depender da internet a cada letra digitada.
// Uso: node build-catalog.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2';
const pocket = id => /^(A|B)\d+[a-z]?-|^P-/.test(id);
(async () => {
  const get = async u => (await fetch(u)).json();
  const [en, pt, ja] = await Promise.all([get(`${API}/en/cards`), get(`${API}/pt/cards`), get(`${API}/ja/cards`)]);
  const ptName = new Map(pt.map(c => [c.id, c.name]));
  const paths = [], pathIx = new Map();
  const imageRef = (img, lang) => {
    if (!img) return -1;
    const base = img.replace(`https://assets.tcgdex.net/`, '').replace(/\/[^/]*$/, '');
    if (!pathIx.has(base)) { pathIx.set(base, paths.length); paths.push(base); }
    return pathIx.get(base);
  };
  const cards = [];
  for (const c of en) {
    if (pocket(c.id)) continue;
    const p = ptName.get(c.id);
    cards.push(p && p !== c.name ? [c.id, c.name, imageRef(c.image), p] : [c.id, c.name, imageRef(c.image)]);
  }
  for (const c of ja) if (!pocket(c.id)) cards.push(['ja:' + c.id, c.name, imageRef(c.image)]);
  const file = path.join(process.argv[2], 'catalog.json');
  fs.writeFileSync(file, JSON.stringify({ built: new Date().toISOString().slice(0, 10), paths, cards }));
  console.log('cartas', cards.length, 'ocidentais', en.length, 'japonesas', ja.length, 'nomes PT', ptName.size, 'KB', fs.statSync(file).size >> 10);
})();
