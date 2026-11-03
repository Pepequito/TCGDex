// Completa imagens de cartas e logos de sets que a TCGdex não tem, usando a Pokémon TCG API (pokemontcg.io).
// As imagens ficam no catálogo como endereço completo "https://images.pokemontcg.io/<set>/<número>" (o app acrescenta .png).
// Uso: node fill-from-ptcgio.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, tries = 6) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch { /* tenta de novo */ }
    if (i >= tries - 1) throw new Error('falhou ' + url);
    await sleep(1500 * (i + 1));
  }
}
const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const words = s => new Set(String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && !['the', 'pokemon', 'tcg'].includes(w)));
const jaccard = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n || 1); };
const altId = id => id.replace(/(\D)0+(\d)/g, '$1$2').replace('.5', 'pt5');
const numKey = n => String(n || '').toUpperCase().replace(/^0+(?=\d)/, '');
(async () => {
  const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const logos = JSON.parse(fs.readFileSync(path.join(dir, 'set-logos.json'), 'utf8'));
  const en = await getJSON('https://api.tcgdex.net/v2/en/sets');
  const name = Object.fromEntries(en.map(s => [s.id, s.name]));
  const ptSets = (await getJSON('https://api.pokemontcg.io/v2/sets?pageSize=250')).data;
  console.log('sets na Pokémon TCG API', ptSets.length);
  const match = sid => ptSets.find(p => p.id === altId(sid)) || ptSets.find(p => norm(p.name) === norm(name[sid]))
    || ptSets.map(p => [p, jaccard(p.name, name[sid])]).filter(x => x[1] >= .6).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Logos dos sets que ainda não têm.
  let logoAdds = 0;
  for (const s of en) {
    if (s.logo || logos[s.id] || /^(A|B)\d|^P-/.test(s.id)) continue;
    const p = match(s.id);
    if (p?.images?.logo) { logos[s.id] = p.images.logo; logoAdds++; }
  }

  // Imagens das cartas ocidentais sem imagem.
  const setOf = id => id.replace(/-[^-]+$/, ''), localOf = id => decodeURIComponent(id.slice(id.lastIndexOf('-') + 1));
  const groups = new Map();
  for (const c of cat.cards) if (c[2] < 0 && !c[0].startsWith('ja:')) { const s = setOf(c[0]); if (!groups.has(s)) groups.set(s, []); groups.get(s).push(c); }
  const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
  const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
  let found = 0, setsUsed = 0;
  for (const [sid, list] of groups) {
    const p = match(sid);
    if (!p) continue;
    const res = await getJSON(`https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(p.id)}&pageSize=250&select=number,name,images`).catch(() => null);
    await sleep(700);
    if (!res?.data?.length) continue;
    setsUsed++;
    const byNum = new Map(res.data.map(c => [numKey(c.number), c]));
    for (const c of list) {
      const hit = byNum.get(numKey(localOf(c[0]))) || res.data.find(x => norm(x.name) === norm(c[1]) && list.filter(y => norm(y[1]) === norm(c[1])).length === 1);
      const small = hit?.images?.small;
      if (small && /\.png$/.test(small)) { c[2] = ref(small.replace(/\.png$/, '')); found++; }
    }
  }
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(cat));
  fs.writeFileSync(path.join(dir, 'set-logos.json'), JSON.stringify(logos));
  const left = cat.cards.filter(c => c[2] < 0);
  console.log('imagens novas', found, 'em', setsUsed, 'sets; logos novos', logoAdds,
    '| ainda sem imagem', left.length, '(ocidentais', left.filter(c => !c[0].startsWith('ja:')).length + ')',
    '| sets ainda sem logo', en.filter(s => !s.logo && !logos[s.id] && !/^(A|B)\d|^P-/.test(s.id)).map(s => s.id).join(' '));
})();
