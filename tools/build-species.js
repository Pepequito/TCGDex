// Gera data/species.json com o nome de cada espécie de Pokémon em inglês, japonês e chinês (PokéAPI).
// As estatísticas do perfil usam essa lista para descobrir qual Pokémon aparece no nome de cada carta.
// Uso: node build-species.js <pasta fichario/data>
const fs = require('fs'), path = require('path');
const LANGS = [9, 1, 11, 4, 12]; // en, ja-Hrkt, ja, zh-Hant, zh-Hans
(async () => {
  const query = `{ pokemon_v2_pokemonspeciesname(where:{language_id:{_in:[${LANGS}]}}){ name language_id pokemon_species_id } }`;
  const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
  const rows = (await res.json()).data.pokemon_v2_pokemonspeciesname;
  const by = new Map();
  for (const r of rows) {
    const e = by.get(r.pokemon_species_id) || by.set(r.pokemon_species_id, { en: '', alt: new Set() }).get(r.pokemon_species_id);
    if (r.language_id === 9) e.en = r.name; else e.alt.add(r.name);
  }
  const out = [...by].filter(([, e]) => e.en).sort((a, b) => a[0] - b[0]).map(([id, e]) => [id, e.en, ...[...e.alt].filter(n => n !== e.en)]);
  fs.writeFileSync(path.join(process.argv[2], 'species.json'), JSON.stringify(out));
  console.log('espécies', out.length);
})();
