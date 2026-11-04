// Baixa os logos oficiais em português do site da Pokémon Brasil para icons/sets/ e grava data/set-logos-pt.json.
// O site só publica os logos da série atual (hoje Megaevolução e Celebração de 30 Anos); acrescente os códigos novos ao MAP.
// Os endereços aparecem em https://www.pokemon.com/br/pokemon-tcg/expansoes (imagens *_logo_169_br.png).
// Uso, numa pasta com sharp instalado: node br-logos.js <pasta fichario>
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const root = process.argv[2];
const BASE = 'https://www.pokemon.com/static-assets/content-assets/cms2-pt-br/img/trading-card-game/series/';
// código no site oficial -> [pasta da série, id na TCGdex]
const MAP = {
  me01: ['me_series', 'me01'], me02: ['me_series', 'me02'], me2pt5: ['me_series', 'me02.5'], me03: ['me_series', 'me03'],
  me04: ['me_series', 'me04'], me05: ['me_series', 'me05'], me06: ['me_series', 'me06'], '30th': ['me_series', '30th'],
};
(async () => {
  const file = path.join(root, 'data/set-logos-pt.json');
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.mkdirSync(path.join(root, 'icons/sets'), { recursive: true });
  for (const [code, [serie, id]] of Object.entries(MAP)) {
    const res = await fetch(`${BASE}${serie}/${code}/${code}_logo_169_br.png`);
    if (!res.ok) { console.log(code, 'não encontrado', res.status); continue; }
    const rel = `icons/sets/${id}.webp`;
    await sharp(Buffer.from(await res.arrayBuffer())).trim({ threshold: 1 }).resize({ width: 600, withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(root, rel));
    out[id] = rel;
    console.log(code, '->', id);
  }
  fs.writeFileSync(file, JSON.stringify(out));
})();
