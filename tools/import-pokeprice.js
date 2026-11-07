// Importa um set que a TCGdex ainda não publicou, pela API do Pokémon Price Tracker (plano grátis: 100 créditos
// por dia, 1 crédito por carta). Busca uma página por vez e junta tudo em data/extra-sets/<id>.json, que o app usa
// até a TCGdex ter o set. A chave fica em .secrets/pokeprice.key (fora do Git e do site).
// Uso: node import-pokeprice.js <pasta fichario> <id na TCGdex> <set na API> <offset> <limite>
//   ex.: node import-pokeprice.js . me06 me06-delta-reign 0 95     (e no dia seguinte: ... 95 46)
const fs = require('fs'), path = require('path');
const [root, id, apiSet, offset = '0', limit = '95'] = process.argv.slice(2);
const API = 'https://www.pokemonpricetracker.com/api/v2';
// Variantes da TCGplayer -> variantes do app.
const VARIANT = { Normal: 'normal', Holofoil: 'holo', 'Reverse Holofoil': 'reverse', '1st Edition': 'firstEdition', '1st Edition Holofoil': 'firstEdition' };
(async () => {
  const key = fs.readFileSync(path.join(root, '.secrets/pokeprice.key'), 'utf8').trim();
  const get = async url => { const r = await fetch(url, { headers: { Authorization: 'Bearer ' + key } }); if (!r.ok) throw new Error(r.status + ' ' + await r.text()); return r.json(); };
  const set = (await get(`${API}/sets?search=${encodeURIComponent(apiSet)}&language=english`)).data.find(s => s.tcgPlayerId === apiSet);
  if (!set) throw new Error('set não encontrado na API: ' + apiSet);
  const page = await get(`${API}/cards?setId=${encodeURIComponent(apiSet)}&language=english&sortBy=cardNumber&sortOrder=asc&limit=${limit}&offset=${offset}`);
  const file = path.join(root, 'data/extra-sets', id + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { cards: [] };
  const official = Math.max(0, ...page.data.map(c => +String(c.cardNumber).split('/')[1] || 0), out.official || 0);
  Object.assign(out, { id, nameEn: set.name.replace(/^[A-Z0-9.]+:\s*/, ''), total: set.cardCount, official, releaseDate: set.releaseDate?.slice(0, 10), source: 'pokemonpricetracker', updatedAt: new Date().toISOString() });
  const byId = new Map(out.cards.map(c => [c.id, c]));
  for (const c of page.data) {
    const local = String(c.cardNumber).split('/')[0].padStart(3, '0');
    const prices = {};
    for (const [name, v] of Object.entries(c.variants || {})) {
      const key = VARIANT[name] || (/holo/i.test(name) ? 'holo' : 'normal');
      if (v.marketPrice != null && prices[key] == null) prices[key] = { usd: v.marketPrice, eur: null };
    }
    byId.set(`${id}-${local}`, {
      id: `${id}-${local}`, localId: local, name: c.name.replace(/\s+-\s+\d+\/\d+.*$/, '').trim(), rarity: c.rarity || '', tcgplayer: c.tcgPlayerId,
      image: c.imageCdnUrl400 || c.imageUrl || '', imageHigh: c.imageCdnUrl800 || c.imageCdnUrl || '',
      variants: Object.keys(prices).length ? Object.keys(prices) : ['normal'], prices,
    });
  }
  out.cards = [...byId.values()].sort((a, b) => a.localId.localeCompare(b.localId, 'en', { numeric: true }));
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`${out.nameEn}: ${out.cards.length} de ${out.total} cartas importadas | créditos usados agora: ${page.metadata?.apiCallsConsumed?.total ?? '?'}`);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
