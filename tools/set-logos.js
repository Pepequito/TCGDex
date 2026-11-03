// Logos para os sets que a TCGdex não traz: primeiro outros idiomas da própria TCGdex, depois a Pokémon TCG API.
// Uso: node set-logos.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2';
const norm = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
// TCGdex "sv03" e "sv03.5" equivalem a "sv3" e "sv3pt5" na Pokémon TCG API.
const altId = id => id.replace(/(\D)0+(\d)/g, '$1$2').replace('.5', 'pt5');
(async () => {
  const get = async u => (await fetch(u)).json();
  const en = await get(`${API}/en/sets`);
  const missing = en.filter(s => !s.logo && !/^(A|B)\d|^P-/.test(s.id));
  const out = {};
  for (const lang of ['pt', 'fr', 'de', 'it', 'es']) {
    for (const s of await get(`${API}/${lang}/sets`)) if (s.logo && !out[s.id] && missing.some(m => m.id === s.id)) out[s.id] = s.logo + '.webp';
  }
  const ptcg = (await get('https://api.pokemontcg.io/v2/sets?pageSize=250&select=id,name,images')).data;
  for (const m of missing) {
    if (out[m.id]) continue;
    const p = ptcg.find(p => p.id === altId(m.id)) || ptcg.find(p => norm(p.name) === norm(m.name));
    if (p?.images?.logo) out[m.id] = p.images.logo;
  }
  fs.writeFileSync(path.join(process.argv[2], 'set-logos.json'), JSON.stringify(out));
  console.log('sem logo', missing.length, 'recuperados', Object.keys(out).length, 'ainda sem:', missing.filter(m => !out[m.id]).map(m => m.id).join(' '));
})();
