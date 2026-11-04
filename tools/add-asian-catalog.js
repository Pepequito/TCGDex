// Acrescenta ao data/catalog.json as cartas das edições em chinês (tradicional e simplificado),
// com os mesmos prefixos que o app usa: zh: e zhcn:. Cartas já presentes não são mexidas.
// Uso: node add-asian-catalog.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2';
const LANGS = [['zh:', 'zh-tw'], ['zhcn:', 'zh-cn']];
(async () => {
  const file = path.join(process.argv[2], 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  const have = new Set(cat.cards.map(c => c[0]));
  const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
  const ref = img => {
    if (!img) return -1;
    const base = img.replace('https://assets.tcgdex.net/', '').replace(/\/[^/]*$/, '');
    if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); }
    return pathIx.get(base);
  };
  for (const [pre, api] of LANGS) {
    const list = await (await fetch(`${API}/${api}/cards`)).json();
    let added = 0, withImg = 0;
    for (const c of list) {
      const id = pre + c.id;
      if (have.has(id)) continue;
      const p = ref(c.image);
      cat.cards.push([id, c.name, p]);
      added++; if (p >= 0) withImg++;
    }
    console.log(api, 'novas', added, 'com imagem', withImg);
  }
  fs.writeFileSync(file, JSON.stringify(cat));
  console.log('total no catálogo', cat.cards.length);
})();
