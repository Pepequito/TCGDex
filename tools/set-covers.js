// Gera data/set-covers.json: para cada set japonês ou chinês sem logo, a imagem de uma carta do próprio set,
// usada como capa no lugar do logo. Escolhe a carta de número mais alto que tem imagem (em geral uma rara ilustrada).
// Uso: node set-covers.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2';
const LANGS = [['ja:', 'ja'], ['zh:', 'zh-tw'], ['zhcn:', 'zh-cn']];
(async () => {
  const dir = process.argv[2];
  const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const best = new Map();
  for (const [id, , p] of cat.cards) {
    if (p < 0 || !/^(ja|zh|zhcn):/.test(id)) continue;
    const set = id.slice(0, id.lastIndexOf('-')), num = parseInt(id.slice(id.lastIndexOf('-') + 1), 10) || 0;
    const base = cat.paths[p], local = id.slice(id.lastIndexOf('-') + 1);
    const url = base.startsWith('http') ? base : `https://assets.tcgdex.net/${base}/${local}`;
    if (!best.has(set) || num > best.get(set)[0]) best.set(set, [num, url]);
  }
  const out = {};
  for (const [pre, api] of LANGS) {
    const sets = await (await fetch(`${API}/${api}/sets`)).json();
    for (const s of sets) if (!s.logo && best.has(pre + s.id)) out[pre + s.id] = best.get(pre + s.id)[1];
  }
  fs.writeFileSync(path.join(dir, 'set-covers.json'), JSON.stringify(out));
  console.log('capas', Object.keys(out).length, 'de', best.size, 'sets asiáticos com imagem');
})();
