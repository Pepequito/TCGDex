// Incorpora ao site as fotos aprovadas pela comunidade (Firestore cardImages): grava icons/cards/<id>/low.webp e
// high.webp e aponta a carta no data/catalog.json para essa pasta. Depois rode update-index.js catalog para o scanner.
// As fotos continuam no Firestore; isto só deixa o carregamento mais rápido e permite o reconhecimento pela câmera.
// Uso, numa pasta com sharp instalado: node bake-photos.js <pasta fichario>
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const root = process.argv[2];
const URL_BASE = 'https://firestore.googleapis.com/v1/projects/fichario-4d2a8/databases/(default)/documents/cardImages';
const SITE = 'https://boosterz.web.app/icons/cards/';
(async () => {
  const docs = [];
  for (let token = ''; ;) {
    const res = await (await fetch(`${URL_BASE}?pageSize=100${token ? '&pageToken=' + token : ''}`)).json();
    docs.push(...(res.documents || []));
    if (!res.nextPageToken) break;
    token = res.nextPageToken;
  }
  const file = path.join(root, 'data/catalog.json');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byId = new Map(cat.cards.map(c => [c[0], c]));
  const pathIx = new Map(cat.paths.map((p, i) => [p, i]));
  const ref = base => { if (!pathIx.has(base)) { pathIx.set(base, cat.paths.length); cat.paths.push(base); } return pathIx.get(base); };
  let done = 0;
  for (const d of docs) {
    const f = d.fields || {}, id = f.cardId?.stringValue, photo = f.photo?.stringValue;
    if (!id || !photo) continue;
    const slug = id.replace(/[^\w.-]/g, '_'), dir = path.join(root, 'icons/cards', slug);
    fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(photo.split(',')[1], 'base64');
    await sharp(buf).resize({ height: 352 }).webp({ quality: 80 }).toFile(path.join(dir, 'low.webp'));
    await sharp(buf).resize({ height: 700, withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(dir, 'high.webp'));
    const c = byId.get(id);
    if (c && c[2] < 0) c[2] = ref(SITE + slug);
    done++;
  }
  fs.writeFileSync(file, JSON.stringify(cat));
  console.log('fotos incorporadas', done);
})();
