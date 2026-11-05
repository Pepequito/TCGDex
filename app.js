'use strict';
const API = 'https://api.tcgdex.net/v2';
const KEY = 'fichario.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Estado salvo ---------- */
const store = load();
function load() {
  const base = { cards: {}, fx: null, currency: 'BRL', scope: {} };
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return base; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { toast('Não consegui salvar. Libere espaço no iPhone.'); }
}
navigator.storage?.persist?.();

/* ---------- API ---------- */
const memo = new Map();
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
  return res.json();
}
function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn().catch(e => { memo.delete(key); throw e; }));
  return memo.get(key);
}
// Edições asiáticas têm numeração própria e ficam separadas por prefixo no id: ja: (japonês),
// zh: (chinês tradicional, Taiwan e Hong Kong) e zhcn: (chinês simplificado).
const ASIAN = {
  'ja:': { api: 'ja', label: 'Japonesa', tag: 'JP', region: 'ja' },
  'zh:': { api: 'zh-tw', label: 'Chinesa', tag: 'TW', region: 'zh' },
  'zhcn:': { api: 'zh-cn', label: 'Chinesa simplificada', tag: 'CN', region: 'zh' },
};
const langOf = id => Object.keys(ASIAN).find(p => String(id).startsWith(p)) || '';
const isJa = id => langOf(id) === 'ja:';
const isAsian = id => !!langOf(id);
const rawOf = id => String(id).slice(langOf(id).length);
const jaRaw = rawOf;
const regionOf = id => ASIAN[langOf(id)]?.region || 'west';
const tagOf = id => ASIAN[langOf(id)]?.tag || '';
const langLabel = id => ASIAN[langOf(id)]?.label || '';
const dirOf = id => ASIAN[langOf(id)]?.api || 'en';
// Nomes em português (padrão) ou em inglês, escolhido em Ajustes.
const preferName = (pt, en) => (store.namesEn ? en || pt : pt || en || '').trim();
const isPocket = id => /^(A|B)\d+[a-z]?$|^P-/.test(id);

// A lista em inglês é a mais completa; os nomes em português entram por cima quando existem.
// id -> [nome em português, nome em inglês]
const SOON = { me06: ['Reinado Delta', 'Delta Reign'] };
const getSets = () => once('sets', async () => {
  const asianLists = Object.entries(ASIAN).map(([pre, L]) => getJSON(`${API}/${L.api}/sets`).then(list => list.map(s => ({ ...s, pre }))).catch(() => []));
  const [en, pt, extra, ...asian] = await Promise.all([getJSON(`${API}/en/sets`), getJSON(`${API}/pt/sets`).catch(() => []), getJSON('data/set-logos.json').catch(() => ({})), ...asianLists]);
  // Logos oficiais em português do site da Pokémon Brasil (tools/br-logos.js) têm prioridade.
  const [ptLogos, arts] = await Promise.all([getJSON('data/set-logos-pt.json').catch(() => ({})), getJSON('data/set-art.json').catch(() => ({}))]);
  const ptById = new Map(pt.map(s => [s.id, s]));
  const known = new Set(en.map(s => s.id));
  // Sets anunciados que a TCGdex ainda não publicou aparecem como "em breve", com o logo oficial.
  const soon = Object.entries(SOON).filter(([id]) => !known.has(id)).map(([id, [pt, enName]]) => ({
    id, nameEn: enName, name: preferName(pt, enName), official: 0, total: 0, logoPt: ptLogos[id], serie: 'me', soon: true,
  }));
  return soon.concat(en.filter(s => !isPocket(s.id)).map(s => ({
    id: s.id, nameEn: s.name, name: preferName(ptById.get(s.id)?.name, s.name),
    official: s.cardCount.official, total: s.cardCount.total, logoPt: ptLogos[s.id], logo: ptById.get(s.id)?.logo || s.logo, logoAlt: s.logo, logoUrl: extra[s.id],
    symbol: s.symbol || ptById.get(s.id)?.symbol,
    serie: /assets\.tcgdex\.net\/(?:en|pt|univ)\/([^/]+)\//.exec(s.logo || s.symbol || '')?.[1] || /^(me|swsh|sv|sm|xy|bw|hgss|dp|pl|ex|neo|base|gym|ecard)/.exec(s.id)?.[1] || '',
  })).reverse()).concat(...asian.map(list => list.filter(s => !isPocket(s.id)).map(s => ({
    id: s.pre + s.id, nameEn: s.name, name: s.name.trim(), official: s.cardCount.official, total: s.cardCount.total, logo: s.logo, art: arts[s.pre + s.id],
  })).reverse()));
});
// Cartas cadastradas à mão ficam num set próprio, montado a partir da coleção.
const customSet = () => {
  const cards = Object.values(store.cards).filter(c => c.setId === 'custom');
  return { id: 'custom', name: 'Cartas cadastradas', official: cards.length, total: cards.length, abbr: '', tcgOnline: '', cards };
};
const getSeries = () => once('series', async () => {
  const [en, pt] = await Promise.all([getJSON(`${API}/en/series`), getJSON(`${API}/pt/series`).catch(() => [])]);
  return Object.fromEntries([...en, ...pt].map(x => [x.id, x.name]));
});
// A TCGdex lista algumas cartas sem imagem; o catálogo (data/catalog.json) traz as que foram recuperadas.
async function withImages(cards) {
  if (!cards.some(c => !c.image)) return cards;
  const known = await catalogImages().catch(() => new Map());
  for (const c of cards) if (!c.image && known.get(c.id)) c.image = c.imageEn = known.get(c.id);
  return cards;
}
const fillSet = async set => { await withImages(set.cards); return set; };
const fillCard = async card => (await withImages([card]))[0];
const getSet = id => id === 'custom' ? Promise.resolve(customSet()) : once('set:' + id, async () => {
  if (isAsian(id)) {
    const pre = langOf(id), as = await getJSON(`${API}/${ASIAN[pre].api}/sets/${rawOf(id)}`);
    return fillSet({
      id, name: as.name, official: as.cardCount.official, total: as.cardCount.total, abbr: '', tcgOnline: '',
      cards: as.cards.map(c => ({ id: pre + c.id, localId: c.localId, name: c.name, nameEn: c.name, image: c.image, imageEn: c.image, setId: id })),
    });
  }
  const [en, pt] = await Promise.all([getJSON(`${API}/en/sets/${id}`), getJSON(`${API}/pt/sets/${id}`).catch(() => null)]);
  const ptCards = new Map((pt?.cards || []).map(c => [c.localId, c]));
  return fillSet({
    id, name: preferName(pt?.name, en.name), official: en.cardCount.official, total: en.cardCount.total,
    abbr: en.abbreviation?.official || '', tcgOnline: en.tcgOnline || '',
    cards: en.cards.map(c => {
      const p = ptCards.get(c.localId);
      return { id: c.id, localId: c.localId, name: preferName(p?.name, c.name), nameEn: c.name, image: p?.image || c.image, imageEn: c.image, setId: id };
    }),
  });
});
const getCard = id => once('card:' + id, async () => {
  if (isAsian(id)) {
    const pre = langOf(id), as = await getJSON(`${API}/${ASIAN[pre].api}/cards/${rawOf(id)}`);
    return fillCard({
      id, localId: as.localId, name: as.name, nameEn: as.name, image: as.image, imageEn: as.image,
      rarity: as.rarity || '', setId: pre + as.set.id, setName: as.set.name,
      variants: Object.keys(VARIANTS).filter(v => as.variants?.[v]), prices: extractPrices(as),
    });
  }
  const [en, pt] = await Promise.all([getJSON(`${API}/en/cards/${id}`), getJSON(`${API}/pt/cards/${id}`).catch(() => null)]);
  return fillCard({
    id, localId: en.localId, name: preferName(pt?.name, en.name), nameEn: en.name, image: pt?.image || en.image, imageEn: en.image,
    rarity: store.namesEn ? en.rarity || '' : pt?.rarity || en.rarity || '', setId: en.set.id, setName: preferName(pt?.set?.name, en.set.name),
    variants: Object.keys(VARIANTS).filter(v => en.variants?.[v]),
    prices: extractPrices(en),
  });
});
const VARIANTS = {
  normal: { label: 'Normal', tcg: ['normal'] },
  holo: { label: 'Holo', tcg: ['holofoil'] },
  reverse: { label: 'Reverse holo', tcg: ['reverse-holofoil'] },
  firstEdition: { label: '1ª edição', tcg: ['1st-edition-holofoil', '1st-edition-normal'] },
};
// Só a versão padrão: carimbadas e jumbo têm preço próprio e distorceriam o valor.
function extractPrices(card) {
  const out = {};
  const std = (card.variants_detailed || []).filter(v => v.size === 'standard' && !v.stamp?.length);
  for (const v of Object.keys(VARIANTS)) {
    const type = v === 'firstEdition' ? 'firstEdition' : v;
    const entry = std.find(d => d.type === type) || std[0];
    const p = entry?.pricing || card.pricing;
    if (!p) continue;
    const tcg = VARIANTS[v].tcg.map(k => p.tcgplayer?.[k]).find(Boolean);
    const cm = p.cardmarket;
    const eur = v === 'reverse' ? (cm?.['trend-holo'] || cm?.['avg-holo']) : cm?.trend;
    const usd = tcg?.marketPrice ?? tcg?.midPrice ?? null;
    if (usd != null || eur) out[v] = { usd, eur: eur || null };
  }
  return out;
}
const imageUrl = (base, q = 'low') => !base ? '' : base.startsWith('data:') ? base
  : base.startsWith('https://images.pokemontcg.io/') ? base + (q === 'high' ? '_hires.png' : '.png') : `${base}/${q}.webp`;
function imgTag(c, q = 'low', alt = '') {
  // Carta que a pessoa só tem na edição em inglês aparece com a arte em inglês nas listas.
  if (!c.edArt && typeof ownEdition === 'function' && ownEdition(c) === 'en') c = { ...c, image: c.imageEn || store.cards[c.id].imageEn || c.image };
  if (!c.image) return `<div class="noimg">${esc(c.name)}</div>`;
  const fallback = c.imageEn && c.imageEn !== c.image ? imageUrl(c.imageEn, q) : '';
  return `<img loading="lazy" alt="${esc(alt)}" src="${esc(imageUrl(c.image, q))}" data-fallback="${esc(fallback)}">`;
}
document.addEventListener('error', e => {
  const el = e.target;
  if (el.tagName === 'IMG' && el.dataset.fallback) { el.src = el.dataset.fallback; el.dataset.fallback = ''; }
}, true);

/* ---------- Câmbio e valores ---------- */
async function refreshFx() {
  if (store.fx && Date.now() - store.fx.at < 864e5) return;
  try {
    const r = await getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,EUR');
    store.fx = { BRL: r.rates.BRL, EUR: r.rates.EUR, at: Date.now() }; save(); render();
  } catch { /* mantém a última cotação */ }
}
function toUsd(p) {
  if (!p) return null;
  if (p.usd != null) return p.usd;
  if (p.eur != null && store.fx) return p.eur / store.fx.EUR;
  return null;
}
function money(usd) {
  if (usd == null) return '—';
  const cur = store.fx ? store.currency : 'USD';
  const v = cur === 'USD' ? usd : usd * store.fx[cur];
  return v.toLocaleString('pt-BR', { style: 'currency', currency: cur });
}
const list = () => Object.values(store.cards);
// Cópias comuns ficam em qty (por variante); cópias graduadas, uma a uma, em graded.
const rawQty = c => Object.values(c.qty || {}).reduce((a, b) => a + b, 0);
const qtyOf = c => rawQty(c) + (c.graded?.length || 0);
// O valor digitado está em reais e vale para todas as cópias da carta, no lugar do preço automático.
const customUsd = brl => brl / (store.fx?.BRL || 5.4);
// Graduada sem valor informado conta pelo preço da carta comum da mesma variante.
const gradedUsd = (c, g) => g.value != null ? customUsd(g.value) : toUsd(c.prices?.[g.variant]) || 0;
// Edição das cópias ocidentais: a chave "holo" é a carta em inglês e "holo@pt" a edição brasileira.
// O mercado brasileiro não tem base pública de preços: a cópia brasileira vale o valor que a pessoa definiu
// para ela (customPt) ou o preço em inglês multiplicado pelo fator de Ajustes (ptFactor).
const PT = '@pt';
store.edition ??= 'pt';
store.ptFactor ??= 1;
const keyOf = (variant, lang) => lang === 'pt' ? variant + PT : variant;
const isPtKey = k => k.endsWith(PT);
const variantOfKey = k => isPtKey(k) ? k.slice(0, -PT.length) : k;
const hasEditions = card => !isAsian(card.id) && card.setId !== 'custom' && !String(card.id).startsWith('custom:');
const qtyIn = (c, lang) => Object.entries(c?.qty || {}).filter(([k]) => isPtKey(k) === (lang === 'pt')).reduce((s, [, n]) => s + n, 0);
// Edição mostrada no painel da carta: a escolhida na hora; senão a única que a pessoa tem; senão a padrão.
let sheetLang = null;
function editionNow(card) {
  if (!hasEditions(card)) return 'en';
  if (sheetLang) return sheetLang;
  const own = store.cards[card.id], pt = qtyIn(own, 'pt'), en = qtyIn(own, 'en');
  return pt && !en ? 'pt' : en && !pt ? 'en' : store.edition;
}
// Arte de uma edição: a brasileira usa a imagem em português (quando a base tem), a inglesa a imagem em inglês.
const artFor = (c, lang) => ({ ...c, image: lang === 'en' ? c.imageEn || c.image : c.image, edArt: true });
function ownEdition(c) {
  const own = store.cards[c.id];
  if (!own || !hasEditions(c)) return null;
  const pt = qtyIn(own, 'pt'), en = qtyIn(own, 'en');
  return en && !pt ? 'en' : pt ? 'pt' : null;
}
// Antes da versão com edições, toda cópia ocidental era gravada sem edição e ficou como "inglês".
// O público do app é brasileiro: cópias gravadas antes dessa versão passam para a edição brasileira, uma vez.
const EDITIONS_SINCE = 1793879527000 + 3 * 60e3;
function migrateEditions() {
  const ids = [];
  for (const c of Object.values(store.cards)) {
    if (!hasEditions(c) || (c.updatedAt || c.addedAt || 0) >= EDITIONS_SINCE) continue;
    let moved = false;
    for (const [k, n] of Object.entries(c.qty || {})) if (!isPtKey(k)) { c.qty[k + PT] = (c.qty[k + PT] || 0) + n; delete c.qty[k]; moved = true; }
    if (c.custom != null && c.customPt == null) { c.customPt = c.custom; delete c.custom; moved = true; }
    c.updatedAt = Date.now();
    if (moved) ids.push(c.id);
  }
  if (ids.length) { save(); window.Sync?.changedAll(ids); }
  return ids;
}
window.migrateEditions = migrateEditions;
const unitUsd = (c, key) => {
  const pt = isPtKey(key), custom = pt ? c.customPt : c.custom;
  if (custom != null) return customUsd(custom);
  const base = toUsd(c.prices?.[variantOfKey(key)]) || 0;
  return pt ? base * store.ptFactor : base;
};
const valueOf = c => Object.entries(c.qty || {}).reduce((s, [k, n]) => s + n * unitUsd(c, k), 0)
  + (c.graded || []).reduce((s, g) => s + gradedUsd(c, g), 0);
const gradeLabel = g => `${g.company} ${g.grade}`;
function setCustom(id, brl, lang = 'en') {
  const c = store.cards[id];
  if (!c) return;
  const field = lang === 'pt' ? 'customPt' : 'custom';
  if (brl == null) delete c[field]; else c[field] = brl;
  c.updatedAt = Date.now();
  save();
  window.Sync?.changed(id);
}
const parseBrl = t => {
  const v = parseFloat(String(t).replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const brlText = v => v == null ? '' : v.toFixed(2).replace('.', ',');
const ligaUrl = c => `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(c.nameEn || c.name)}`;

function ensureCard(card) {
  return store.cards[card.id] ??= {
    id: card.id, localId: card.localId, name: card.name, image: card.image, imageEn: card.imageEn,
    rarity: card.rarity, setId: card.setId, setName: card.setName, prices: card.prices, qty: {}, addedAt: Date.now(),
  };
}
function touched(id) {
  const c = store.cards[id];
  if (c) { c.updatedAt = Date.now(); if (!rawQty(c) && !c.graded?.length) delete store.cards[id]; }
  save();
  window.Sync?.changed(id);
  window.Social?.publishSoon();
}
// fromRaw: a pessoa mandou avaliar uma cópia que já estava na coleção, então ela sai das comuns.
function addGraded(card, g, fromRaw) {
  const c = ensureCard(card);
  c.prices = card.prices || c.prices;
  if (fromRaw) {
    const key = [keyOf(g.variant, editionNow(card)), g.variant, keyOf(g.variant, 'pt')].find(k => c.qty[k] > 0);
    if (key) { c.qty[key]--; if (!c.qty[key]) delete c.qty[key]; }
  }
  (c.graded ??= []).push({ gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...g });
  touched(card.id);
  if (!fromRaw) window.Social?.added(c);
}
function removeGraded(id, gid) {
  const c = store.cards[id]; if (!c?.graded) return;
  c.graded = c.graded.filter(g => g.gid !== gid);
  if (!c.graded.length) delete c.graded;
  touched(id);
}
function setQty(card, variant, delta) {
  let c = store.cards[card.id];
  if (!c) {
    if (delta <= 0) return;
    c = store.cards[card.id] = {
      id: card.id, localId: card.localId, name: card.name, image: card.image, imageEn: card.imageEn,
      rarity: card.rarity, setId: card.setId, setName: card.setName, prices: card.prices, qty: {}, addedAt: Date.now(),
    };
  }
  c.prices = card.prices || c.prices;
  const key = keyOf(variant, editionNow(card));
  c.qty[key] = Math.max(0, (c.qty[key] || 0) + delta);
  if (!c.qty[key]) delete c.qty[key];
  touched(card.id);
  if (delta > 0) window.Social?.added(c);
}
async function refreshPrices(onStep) {
  // Cartas cadastradas à mão não têm preço automático.
  const cards = list().filter(c => c.setId !== 'custom');
  let done = 0, failed = 0;
  const queue = [...cards];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try { memo.delete('card:' + c.id); c.prices = (await getCard(c.id)).prices; }
      catch { failed++; }
      onStep?.(++done, cards.length);
    }
  }));
  // Com metade ou mais falhando (sem internet, servidor fora), não conta como atualizado: tenta de novo depois.
  if (failed < cards.length / 2) store.pricedAt = Date.now();
  save();
  return failed;
}
// Uma vez por dia os preços são renovados sozinhos, em segundo plano: ao abrir o app,
// ao voltar para ele, ou a cada hora se ele ficar aberto de um dia para o outro.
const PRICE_EVERY = 20 * 36e5;
let autoPricing = false;
async function autoRefreshPrices() {
  if (autoPricing || document.hidden || !navigator.onLine) return;
  if (store.pricedAt && Date.now() - store.pricedAt < PRICE_EVERY) return;
  if (!list().some(c => c.setId !== 'custom')) return;
  autoPricing = true;
  try {
    await refreshPrices();
    // Atualiza só telas de leitura, para não atrapalhar quem está digitando ou com uma carta aberta.
    const typing = document.activeElement?.matches?.('input, textarea, select');
    if (!typing && sheet.hidden && scanner.hidden && ['home', 'cards', 'profile', 'settings'].includes(route.tab)) render();
  } finally { autoPricing = false; }
}

/* ---------- Painel da carta ---------- */
const sheet = $('#sheet'), sheetBack = $('#sheetBack');
let onSheetClose = null;
function openSheet(html, onClose = null) {
  sheet.dataset.openedAt = Date.now();
  sheetLang = null; editionSource = '';
  document.body.classList.add('drawer');
  sheet.innerHTML = html; sheet.hidden = sheetBack.hidden = false; sheet.scrollTop = 0; onSheetClose = onClose;
}
function closeSheet() {
  document.body.classList.remove('drawer');
  sheet.hidden = sheetBack.hidden = true;
  const fn = onSheetClose; onSheetClose = null; fn?.(); render();
}
/* ---------- Identificação ---------- */
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function similarity(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * .2 + .8;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}
// Corrige as trocas típicas do OCR dentro de um número (O→0, l→1, S→5).
const fixDigits = s => s.replace(/[OoQD]/g, '0').replace(/[lI|!]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
function parseNumber(text) {
  const t = text.replace(/[\\⁄∕]/g, '/');
  let m = t.match(/\b((?:TG|GG|RC|SV|H)\s?[0-9OlI]{1,3})\s*\/\s*((?:TG|GG|RC|SV|H)\s?[0-9OlI]{1,3})/i);
  if (m) {
    const [pre, a] = [m[1].slice(0, -m[1].replace(/^[A-Za-z]+\s?/, '').length).trim().toUpperCase(), m[1].replace(/^[A-Za-z]+\s?/, '')];
    return { local: pre + fixDigits(a).padStart(2, '0'), prefix: pre, total: null };
  }
  const all = [...t.matchAll(/(?<![0-9A-Za-z])([0-9OlISQ]{1,3})\s*[\/|]\s*([0-9OlISQ]{2,3})(?![0-9])/g)];
  for (const x of all) {
    const a = parseInt(fixDigits(x[1]), 10), b = parseInt(fixDigits(x[2]), 10);
    if (a > 0 && b >= 10 && a <= b + 150) return { local: a, total: b };
  }
  m = t.match(/\b(SWSH|SVP|SMP?|XY|BW|HGSS|DP)\s*-?\s*([0-9OlI]{2,3})\b/i);
  if (m) return { promo: m[1].toUpperCase(), local: parseInt(fixDigits(m[2]), 10) };
  return null;
}
function cleanName(raw) {
  return raw.split('\n').map(l => l.replace(/\b(BASIC|BASICO|BÁSICO|STAGE ?\d?|ESTAGIO ?\d?|ESTÁGIO ?\d?|HP|PS)\b.*$/i, '')
    .replace(/[^A-Za-zÀ-ÿ0-9' .:-]/g, ' ').replace(/\s+/g, ' ').trim()).sort((a, b) => b.length - a.length)[0] || '';
}
async function candidatesFor(number, nameGuess, stripText) {
  let cards = [];
  if (number?.total) {
    const sets = (await getSets()).filter(s => s.official === number.total || s.total === number.total).slice(0, 14);
    const full = await Promise.all(sets.map(s => getSet(s.id).catch(() => null)));
    for (const s of full) {
      if (!s) continue;
      const c = s.cards.find(x => parseInt(x.localId, 10) === number.local && /^\d+$/.test(x.localId));
      if (!c) continue;
      const abbr = s.abbr && new RegExp(`\\b${s.abbr}\\b`).test(stripText) ? .3 : 0;
      cards.push({ ...c, setName: s.name, score: Math.max(similarity(c.name, nameGuess), similarity(c.nameEn, nameGuess)) + abbr });
    }
  } else if (number?.local) {
    const list = await getJSON(`${API}/en/cards?localId=${encodeURIComponent(number.local)}&pagination:itemsPerPage=60`).catch(() => []);
    cards = list.filter(c => !isPocket(c.id.split('-')[0])).map(c => ({ ...c, imageEn: c.image, score: similarity(c.name, nameGuess) }));
  }
  // Sem número legível, ou número que não bate com o nome: recorre ao nome.
  if (nameGuess.length >= 4 && !cards.some(c => c.score >= .6)) {
    const byName = await searchCards(nameGuess.split(' ').slice(0, 2).join(' ')).catch(() => []);
    for (const c of byName.slice(0, 24)) if (!cards.some(x => x.id === c.id)) cards.push({ ...c, score: similarity(c.name, nameGuess) * .8 });
  }
  return cards.sort((a, b) => b.score - a.score).slice(0, 12);
}

let workerPromise = null;
function ocrWorker() {
  workerPromise ??= Tesseract.createWorker('eng', 1).catch(e => { workerPromise = null; throw e; });
  return workerPromise;
}
function crop(src, x, y, w, h, scale, invert = false) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const hist = new Uint32Array(256), lum = new Uint8ClampedArray(d.length / 4);
  for (let i = 0; i < lum.length; i++) { const v = .3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2]; lum[i] = v; hist[lum[i]]++; }
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < lum.length * .02; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < lum.length * .02; hi--);
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < lum.length; i++) {
    const v = invert ? 255 - (lum[i] - lo) * k : (lum[i] - lo) * k;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// Código impresso no canto, como "DRI PT 106/182". A sigla e o total dizem a coleção; o número, a carta.
// Só dígitos em parte das leituras: a barra às vezes vira outro número, mas os números continuam lá dentro do texto.
async function readCode(src, W, H) {
  const w = await ocrWorker(), LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/', DIGITS = '0123456789/';
  let text = '';
  for (const [x, y, cw, ch, psm, wl] of [[.02, .895, .5, .09, '6', LETTERS], [.04, .91, .36, .065, '6', DIGITS], [.04, .91, .36, .065, '11', DIGITS], [.5, .91, .48, .075, '6', DIGITS]]) {
    await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: wl });
    const { data } = await w.recognize(crop(src, W * x, H * y, W * cw, H * ch, Math.min(5, 1600 / (W * cw))));
    text += ' ' + data.text;
  }
  await w.setParameters({ tessedit_char_whitelist: '' });
  return text.toUpperCase();
}
// Edição da carta pelo texto impresso: lê a metade de baixo (ataques, regras, Fraqueza/Resistência/Recuo,
// texto da Pokédex) e conta palavras comuns de cada língua. O código "PT"/"EN" do canto é pequeno demais para a câmera.
const PT_WORDS = new Set('de da do das dos que para seu sua seus suas com uma um nao ao aos este esta essa esse quando cada cartas carta dano danos ataque fraqueza resistencia recuo durante coloque compre embaralhe energia energias no na nos nas pelo pela mais sem sobre seja voce oponente banco ativo descarte'.split(' '));
const EN_WORDS = new Set('the of to your this that when each card cards damage attack weakness resistance retreat during put draw shuffle energy for and from it its opponent bench active discard you if more'.split(' '));
async function readEdition(src, W, H) {
  const w = await ocrWorker();
  await w.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: '' });
  const text = (await w.recognize(crop(src, W * .04, H * .5, W * .92, H * .45, Math.min(2, 1100 / (W * .92))))).data.text;
  const words = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]+/g) || [];
  const pt = words.filter(x => PT_WORDS.has(x)).length, en = words.filter(x => EN_WORDS.has(x)).length;
  return pt >= 2 && pt > en * 2 ? 'pt' : en >= 2 && en > pt * 2 ? 'en' : null;
}
// `src` é o recorte da carta. O número pode estar no canto esquerdo (atuais) ou direito (antigas).
async function readCard(src, W, H) {
  const w = await ocrWorker();
  let strip = '', number = null;
  await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
  for (const x of [0, .5]) {
    const { data } = await w.recognize(crop(src, W * x, H * .915, W * .5, H * .075, Math.min(4, 1400 / (W * .5))));
    strip += ' ' + data.text;
    number = parseNumber(data.text);
    if (number) break;
  }
  await w.setParameters({ tessedit_pageseg_mode: '6' });
  const nameScale = Math.min(3, 1500 / (W * .8));
  const top = await w.recognize(crop(src, W * .04, H * .018, W * .8, H * .1, nameScale));
  return { number, name: cleanName(top.data.text), strip };
}
async function identify(src, W, H) {
  const read = await readCard(src, W, H);
  window.__lastRead = read;
  if (!read.number && read.name.length < 4) return { read, cards: [] };
  return { read, cards: await candidatesFor(read.number, read.name, read.strip) };
}
const confident = r => r.cards.length && (r.read.number ? r.cards[0].score >= .55 : r.cards[0].score >= .7);

/* ---------- Reconhecimento pela arte ---------- */
// Mesma conta de tools/export-index.js: DCT da região da arte em 32x32, 128 bits em torno da mediana.
const S = 32, BITS = 128, ART = { x: .08, y: .11, w: .84, h: .36 }, MATCH_MAX = 30, TILTS = [0, -4, 4];
const zig = (() => {
  const z = [];
  for (let s = 1; z.length < BITS; s++) for (let u = 0; u <= s; u++) { const v = s - u; if (u < S && v < S) z.push([u, v]); }
  return z.slice(0, BITS);
})();
const FREQS = Math.max(...zig.flat()) + 1;
const cosT = Array.from({ length: FREQS }, (_, f) => Float32Array.from({ length: S }, (_, x) => Math.cos((2 * x + 1) * f * Math.PI / (2 * S))));
const artIndex = () => once('index', async () => {
  const [meta, bin] = await Promise.all([getJSON('data/index.json'), fetch('data/hashes.bin').then(r => r.arrayBuffer())]);
  return { ...meta, hashes: new Uint32Array(bin) };
});
const gray = new Float32Array(S * S), coef = new Float32Array(BITS), cols = new Float32Array(FREQS * S);
// O quadro é lido da placa de vídeo uma vez só; cada recorte vira média de áreas sobre uma imagem integral.
const FW = 360, FH = 504, frameCanvas = document.createElement('canvas');
frameCanvas.width = FW; frameCanvas.height = FH;
const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
frameCtx.imageSmoothingQuality = 'high';
const integ = new Float64Array((FW + 1) * (FH + 1));
function loadFrame(src, W, H, rot) {
  frameCtx.setTransform(1, 0, 0, 1, 0, 0);
  frameCtx.fillStyle = '#000'; frameCtx.fillRect(0, 0, FW, FH);
  frameCtx.translate(FW / 2, FH / 2); frameCtx.rotate(rot * Math.PI / 180); frameCtx.translate(-FW / 2, -FH / 2);
  frameCtx.drawImage(src, 0, 0, W, H, 0, 0, FW, FH);
  const d = frameCtx.getImageData(0, 0, FW, FH).data, IW = FW + 1;
  for (let y = 0; y < FH; y++) {
    let row = 0;
    for (let x = 0; x < FW; x++) {
      const p = (y * FW + x) * 4;
      row += .3 * d[p] + .59 * d[p + 1] + .11 * d[p + 2];
      integ[(y + 1) * IW + x + 1] = integ[y * IW + x + 1] + row;
    }
  }
}
// Desvio padrão do brilho na região da arte: mesa lisa ou papel em branco ficam abaixo de 14.
function texture() {
  const IW = FW + 1, x0 = 60, x1 = 300, y0 = 80, y1 = 260, step = 6;
  let sum = 0, sq = 0, n = 0;
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const v = (integ[(y + step) * IW + x + step] - integ[y * IW + x + step] - integ[(y + step) * IW + x] + integ[y * IW + x]) / (step * step);
    sum += v; sq += v * v; n++;
  }
  return Math.sqrt(sq / n - (sum / n) ** 2);
}
function artHash(x, y, w, h, out) {
  const IW = FW + 1, sx = w / S, sy = h / S, clampX = v => Math.max(0, Math.min(FW, Math.round(v))), clampY = v => Math.max(0, Math.min(FH, Math.round(v)));
  for (let j = 0; j < S; j++) {
    let y0 = clampY(y + j * sy), y1 = clampY(y + (j + 1) * sy);
    if (y1 <= y0) y1 = Math.min(FH, y0 + 1), y0 = y1 - 1;
    for (let i = 0; i < S; i++) {
      let x0 = clampX(x + i * sx), x1 = clampX(x + (i + 1) * sx);
      if (x1 <= x0) x1 = Math.min(FW, x0 + 1), x0 = x1 - 1;
      gray[j * S + i] = (integ[y1 * IW + x1] - integ[y0 * IW + x1] - integ[y1 * IW + x0] + integ[y0 * IW + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  // Transformada separável: primeiro as colunas, depois cada coeficiente.
  for (let v = 0; v < FREQS; v++) {
    const c = cosT[v];
    for (let x = 0; x < S; x++) { let s = 0; for (let y = 0; y < S; y++) s += gray[y * S + x] * c[y]; cols[v * S + x] = s; }
  }
  for (let k = 0; k < BITS; k++) {
    const [u, v] = zig[k], c = cosT[u]; let s = 0;
    for (let x = 0; x < S; x++) s += cols[v * S + x] * c[x];
    coef[k] = s;
  }
  const med = Float32Array.from(coef).sort()[BITS >> 1];
  out.fill(0);
  for (let k = 0; k < BITS; k++) if (coef[k] > med) out[k >> 5] |= 1 << (k & 31);
}
const pop = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
// O enquadramento nunca é exato: testa pequenos deslocamentos e zooms e fica com a menor distância.
async function matchArt(src, W, H, rot = 0, limit = 6) {
  const { hashes, cards, paths } = await artIndex();
  const n = cards.length, best = new Uint8Array(n).fill(255), q = new Uint32Array(4);
  loadFrame(src, W, H, rot);
  if (texture() < 14) return [{ id: null, dist: 99 }];
  // Duas etapas: 100 recortes contra o banco inteiro, depois ajuste fino só nas 150 cartas mais parecidas.
  const crop = ([z, ox, oy]) => artHash(FW * (ART.x + ox + (1 - z) * ART.w / 2), FH * (ART.y + oy + (1 - z) * ART.h / 2), FW * ART.w * z, FH * ART.h * z, q);
  const dist = o => pop(q[0] ^ hashes[o]) + pop(q[1] ^ hashes[o + 1]) + pop(q[2] ^ hashes[o + 2]) + pop(q[3] ^ hashes[o + 3]);
  const coarse = [], where = new Uint8Array(n);
  for (const z of [.82, .9, 1, 1.1]) for (const ox of [-.06, -.03, 0, .03, .06]) for (const oy of [-.06, -.03, 0, .03, .06]) coarse.push([z, ox, oy]);
  coarse.forEach((p, k) => {
    crop(p);
    for (let i = 0, o = 0; i < n; i++, o += 4) { const d = dist(o); if (d < best[i]) { best[i] = d; where[i] = k; } }
  });
  const shortlist = Array.from(best.keys()).sort((a, b) => best[a] - best[b]).slice(0, 150);
  const seeds = [...new Set(shortlist.slice(0, 8).map(i => where[i]))];
  for (const k of seeds) {
    const [z0, x0, y0] = coarse[k];
    for (const dz of [-.04, 0, .04]) for (const dx of [-.015, 0, .015]) for (const dy of [-.015, 0, .015]) {
      if (!dz && !dx && !dy) continue;
      crop([z0 + dz, x0 + dx, y0 + dy]);
      for (const i of shortlist) { const d = dist(i * 4); if (d < best[i]) best[i] = d; }
    }
  }
  return shortlist.sort((a, b) => best[a] - best[b]).slice(0, limit).map(i => {
    const [id, p] = cards[i], localId = id.slice(id.lastIndexOf('-') + 1), image = paths[p].startsWith('http') ? paths[p] : `https://assets.tcgdex.net/${dirOf(id)}/${paths[p]}/${localId}`;
    return { id, localId, name: id, image, imageEn: image, dist: best[i] };
  });
}
// Sem código legível, entre artes empatadas vale o idioma da última carta adicionada.
const preferred = (c, cards) => +(cards[0].dist <= 28 && c.dist - cards[0].dist <= 2 && langOf(c.id) === (store.lastLang ?? (store.lastJa ? 'ja:' : '')));
const setIdOf = id => id.replace(/-[^-]+$/, '');
// Nome, sigla, total oficial e logo de cada coleção candidata.
async function setFacts(ids) {
  const sets = await getSets().catch(() => []), out = {};
  await Promise.all([...new Set(ids.map(setIdOf))].map(async sid => {
    const meta = sets.find(x => x.id === sid);
    let abbr = '', cards = [];
    try { const full = await getSet(sid); abbr = full.abbr || ''; cards = full.cards; } catch { /* sem sigla */ }
    out[sid] = { name: meta?.name || sid, official: meta?.official || 0, abbr, art: meta ? setArt(meta) : '', next: meta ? artFallback(meta) : '', cards };
  }));
  return out;
}
// Mesma arte em várias coleções (reimpressões, versões japonesas): o código impresso decide qual é.
async function rerank(cards, src, W, H) {
  const likely = cards.filter(c => c.dist <= MATCH_MAX);
  if (likely.length < 2) return cards;
  const facts = await setFacts(likely.map(c => c.id));
  // A mesma carta reimpressa em outra coleção: arte quase igual ou o mesmo nome.
  const nameOf = c => (facts[setIdOf(c.id)]?.cards || []).find(x => x.id === c.id)?.nameEn || '';
  const top = nameOf(cards[0]);
  const close = likely.filter(c => c === cards[0] || c.dist - cards[0].dist <= 6 || (top && nameOf(c) === top));
  if (close.length < 2) return cards;
  const text = await readCode(src, W, H).catch(() => '');
  const score = c => {
    const f = facts[setIdOf(c.id)] || {}, n = c.localId.replace(/^0+/, '');
    return (/^\d{2,}$/.test(n) && text.includes(n) ? 1 : 0) + (f.official >= 10 && text.includes(String(f.official)) ? 1 : 0) + (f.abbr?.length >= 3 && text.includes(f.abbr) ? 2 : 0);
  };
  const scored = close.map(c => ({ c, s: score(c) })).sort((a, b) => b.s - a.s || preferred(b.c, cards) - preferred(a.c, cards) || a.c.dist - b.c.dist);
  const resolved = scored[0].s >= 2 && scored[0].s > (scored[1]?.s ?? -1);
  const ordered = [...scored.map(x => x.c), ...cards.filter(c => !close.includes(c))];
  return Object.assign(ordered, { close: close.length, resolved: resolved ? scored[0].c.id : null, facts });
}

/* ---------- Scanner ---------- */
const sheetArmed = () => Date.now() - (+sheet.dataset.openedAt || 0) > 700;
const scanner = $('#scanner'), video = $('#video'), statusEl = $('#scanStatus');
let stream = null, scanning = false, paused = false, torchOn = false;
const say = t => { statusEl.textContent = t; };
async function openScanner() {
  scanner.hidden = false; paused = false;
  say('Abrindo a câmera…');
  artIndex().catch(() => say('Não consegui carregar o banco de cartas. Verifique a conexão.'));
  ocrWorker().catch(() => {});
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    video.srcObject = stream; await video.play();
    const track = stream.getVideoTracks()[0], caps = track.getCapabilities?.();
    // Com zoom, a carta fica mais longe da lente, na distância em que o iPhone consegue focar.
    const tune = {};
    if (caps?.zoom?.max >= 1.5) tune.zoom = Math.min(2, caps.zoom.max);
    if (caps?.focusMode?.includes('continuous')) tune.focusMode = 'continuous';
    if (Object.keys(tune).length) await track.applyConstraints({ advanced: [tune] }).catch(() => {});
    $('#torch').hidden = !caps?.torch;
    say('Enquadre a carta inteira e mantenha parado');
    scanLoop();
  } catch {
    say('Sem acesso à câmera. Permita em Ajustes > Safari > Câmera, ou use uma foto.');
  }
}
function closeScanner() {
  scanning = false; paused = true;
  stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
  torchOn = false; $('#torch').classList.remove('on');
  scanner.hidden = true; render();
}
function grabGuide() {
  const g = $('#guide').getBoundingClientRect(), v = video.getBoundingClientRect();
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return null;
  const k = Math.max(v.width / vw, v.height / vh);
  const ox = (v.width - vw * k) / 2, oy = (v.height - vh * k) / 2;
  const sx = (g.left - v.left - ox) / k, sy = (g.top - v.top - oy) / k, sw = g.width / k, sh = g.height / k;
  const c = document.createElement('canvas');
  c.width = Math.round(sw); c.height = Math.round(sh);
  c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
async function scanLoop() {
  if (scanning) return;
  scanning = true;
  const recent = [];
  let shown = null, misses = 0, frames = 0;
  while (scanning) {
    await new Promise(r => setTimeout(r, 60));
    if (paused || !video.videoWidth) { recent.length = 0; continue; }
    try {
      const frame = grabGuide(), W = frame.width, H = frame.height;
      // A carta raramente fica reta: cada quadro testa um ângulo.
      let cards = await matchArt(frame, W, H, TILTS[frames % TILTS.length]);
      if (!scanning || paused) continue;
      const top = cards[0], seen = top.dist <= MATCH_MAX;
      // A carta recém-mostrada só conta de novo depois de sair do quadro.
      if (!seen) shown = null;
      if (seen && top.id === shown) { say('Tire esta carta e enquadre a próxima'); continue; }
      const sure = seen && (top.dist <= 18 || recent.includes(top.id));
      recent.push(seen ? top.id : null);
      if (recent.length > 3) recent.shift();
      if (sure) {
        misses = 0; say('Carta encontrada'); shown = top.id;
        cards = await rerank(cards, frame, W, H);
        if (scanning) { paused = true; showMatch({ cards, src: frame }); }
        continue;
      }
      misses++;
      say(`${misses > 12 ? 'Encaixe a carta na moldura e evite reflexo sobre a arte' : 'Encaixe a carta na moldura e mantenha parado'} (${top.dist})`);
      // Carta lançada depois de o banco ser gerado: o número impresso ainda resolve.
      if (++frames % 16 === 0) {
        const r = await identify(frame, W, H);
        if (!paused && scanning && confident(r)) { paused = true; showMatch({ ...r, src: frame }); }
      }
    } catch { say('Sem conexão com o banco de cartas.'); await new Promise(r => setTimeout(r, 1500)); }
  }
}
// Quando a mesma arte existe em mais de uma coleção, nada é adicionado sem a coleção estar escolhida.
let editionSource = '';
function showMatch({ cards, src }, resume = true) {
  navigator.vibrate?.(30);
  // Enquanto a pessoa confere a carta, o texto impresso diz se ela é brasileira ou em inglês.
  let detected = null;
  if (src && !isAsian(cards[0].id)) readEdition(src, src.width, src.height).then(lang => {
    if (!lang) return;
    detected = lang;
    if (sheetLang || sheet.hidden || !sheetCard || !hasEditions(sheetCard)) return;
    sheetLang = lang; editionSource = 'scan';
    window.refreshEditionUi?.();
  }).catch(() => {});
  const same = cards.close || 1, facts = cards.facts || {};
  let idx = 0, picked = same < 2 || !!cards.resolved, detail = null;
  const onDone = () => { paused = !resume; if (resume) say('Enquadre a próxima carta'); };
  const option = (c, i) => {
    const f = facts[setIdOf(c.id)] || {}, code = [f.abbr, c.localId + (f.official ? '/' + f.official : '')].filter(Boolean).join(' · ');
    return `<button type="button" class="set-option${picked && i === idx ? ' on' : ''}" data-alt="${i}">
      <span class="mini-logo${f.art ? '' : ' nologo'}">${f.art ? `<img alt="" src="${esc(f.art)}" data-next="${f.next || ''}" data-logo>` : ''}<em>${esc(f.abbr || setCode({ id: setIdOf(c.id), name: f.name || '' }))}</em></span>
      <span class="grow"><b>${esc(f.name || '')}</b><span class="muted small">${esc(code)}${langLabel(c.id) ? ' · ' + langLabel(c.id) : ''}</span></span></button>`;
  };
  const draw = async () => {
    openSheet('<p class="muted">Buscando carta e preço…</p>', onDone);
    try { detail = await getCard(cards[idx].id); }
    catch { sheet.innerHTML = '<p>Sem conexão para buscar esta carta.</p><button class="btn alt" type="button" data-close>Voltar</button>'; return; }
    if (sheet.hidden) return;
    sheetCard = detail;
    if (detected && !sheetLang) { sheetLang = detected; editionSource = 'scan'; }
    const others = cards.slice(same);
    const choose = same > 1 ? `<div class="section"><p class="${picked ? 'muted small' : 'warn'}">${cards.resolved
      ? 'Coleção identificada pelo código impresso no canto da carta. Confira antes de adicionar.'
      : `Esta arte existe em ${same} coleções. Confira o código no canto inferior da carta e escolha:`}</p>
      <div class="set-options">${cards.slice(0, same).map(option).join('')}</div></div>` : '';
    const alts = others.length ? `<div class="section"><span class="muted small">Não é essa carta? Escolha outra:</span>
      <div class="alts">${others.map((c, k) => `<button type="button" data-alt="${same + k}" aria-label="${esc(c.name)}${langLabel(c.id) ? ', ' + langLabel(c.id).toLowerCase() : ''}">${imgTag(c)}${tagOf(c.id) ? `<span class="lang">${tagOf(c.id)}</span>` : ''}</button>`).join('')}</div></div>` : '';
    const variant = (detail.variants.length ? VARIANTS[detail.variants[0]].label : 'Normal').toLowerCase();
    sheet.innerHTML = `${cardHead(picked ? detail : { ...detail, setName: "Coleção a confirmar", localId: "?" })}${choose}<div id="variants">${variantRows(detail)}</div>${picked ? gradedBlock(detail) : ''}${alts}${cardExtras(detail)}
      <div class="sheet-actions">
        ${picked ? `<button class="btn" type="button" data-add>Adicionar ${esc(variant)}${hasEditions(detail) ? ` · <span data-edition-label>${editionNow(detail) === 'pt' ? 'BR' : 'EN'}</span>` : ''} · ${esc(detail.setName)}</button>`
          : '<button class="btn" type="button" disabled>Escolha a coleção acima</button>'}
        <button class="btn alt" type="button" data-close>${resume ? 'Continuar escaneando' : 'Fechar'}</button></div>`;
    $$('[data-alt]', sheet).forEach(b => b.onclick = () => { idx = +b.dataset.alt; picked = true; draw(); });
    $('[data-add]', sheet)?.addEventListener('click', () => {
      if (!sheetArmed()) return;
      store.lastLang = langOf(detail.id);
      setQty(detail, detail.variants[0] || 'normal', 1);
      toast(`${detail.name} adicionada em ${detail.setName}${hasEditions(detail) ? editionNow(detail) === 'pt' ? ' (edição brasileira)' : ' (edição em inglês)' : ''}`);
      closeSheet();
    });
  };
  draw();
}
async function fromPhoto(file) {
  paused = true;
  say('Lendo a foto…');
  const bmp = await createImageBitmap(file);
  // A foto pode não estar enquadrada: testa a imagem inteira e recortes centrais no formato da carta.
  const fit = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * fit); c.height = Math.round(bmp.height * fit);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let best = await matchArt(c, c.width, c.height), bestSrc = c;
  for (const tilt of TILTS) for (const k of [1, .85, .7]) {
    const w = Math.round(Math.min(c.width, c.height * 63 / 88) * k), h = Math.round(w * 88 / 63);
    const inner = document.createElement('canvas'); inner.width = w; inner.height = h;
    inner.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, w, h);
    const m = await matchArt(inner, w, h, tilt);
    if (m[0].dist < best[0].dist) { best = m; bestSrc = inner; }
  }
  if (best[0].dist <= MATCH_MAX) { showMatch({ cards: await rerank(best, bestSrc, bestSrc.width, bestSrc.height), src: bestSrc }); return; }
  const r = await identify(bestSrc, bestSrc.width, bestSrc.height);
  if (r.cards.length) showMatch({ ...r, src: bestSrc });
  else { paused = false; say('Não reconheci essa foto. Tente de mais perto ou use Buscar.'); if (scanner.hidden) toast('Não reconheci essa carta. Tente uma foto mais de perto.'); }
}

/* ---------- Backup ---------- */
async function exportBackup() {
  const name = `boosterz-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ app: 'fichario', version: 1, cards: store.cards, profile: store.profile }, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch { /* cancelado */ }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'fichario' || typeof data.cards !== 'object') throw 0;
    const now = Date.now();
    for (const c of Object.values(data.cards)) c.updatedAt = now;
    Object.assign(store.cards, data.cards);
    if (data.profile) { store.profile = data.profile; window.Sync?.changedProfile(); }
    save(); render();
    window.Sync?.changedAll(Object.keys(data.cards));
    toast(`${Object.keys(data.cards).length} cartas importadas`);
  } catch { toast('Esse arquivo não é um backup do Boosterz.'); }
}

/* ---------- Eventos ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button,[data-scan]'); if (!b) return;
  const d = b.dataset;
  if (d.tab) go({ tab: d.tab, setId: null, q: '', filter: 'all' });
  else if (d.scan !== undefined) openScanner();
  else if (d.set) go({ tab: 'sets', setId: d.set, filter: 'all' });
  else if (d.back !== undefined) go({ setId: null });
  else if (d.card) showCard(d.card);
  else if (d.close !== undefined) closeSheet();
  else if (d.filter) go({ filter: d.filter });
  else if (d.region) go({ region: d.region });
  else if (d.scope) { store.scope[route.setId] = d.scope; save(); render(); }
  else if (d.currency) { store.currency = d.currency; save(); refreshFx(); render(); }
  else if (d.manual !== undefined) manualForm();
  else if (d.step && sheetCard && sheetArmed() && !$('#sheet button[disabled]')) { setQty(sheetCard, d.variant, +d.step); $('#variants').innerHTML = variantRows(sheetCard); }
  else if (b.id === 'scanBtn') openScanner();
  else if (b.id === 'scanClose') closeScanner();
  else if (b.id === 'torch') {
    torchOn = !torchOn; b.classList.toggle('on', torchOn);
    stream?.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: torchOn }] }).catch(() => {});
  } else if (b.id === 'exportBtn') exportBackup();
  else if (b.id === 'importBtn') $('#importInput').click();
  else if (b.id === 'refreshPrices') {
    b.disabled = true;
    const failed = await refreshPrices((n, t) => { b.textContent = `Atualizando ${n} de ${t}…`; });
    toast(failed ? `${failed} cartas não atualizaram. Tente de novo.` : 'Preços atualizados');
    render();
  }
});
sheetBack.addEventListener('click', closeSheet);
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'manualForm') return saveManual();
  if (e.target.id === 'valueForm') {
    const text = $('#valueInput').value.trim();
    setCustom(sheetCard.id, text ? parseBrl(text) : null, editionNow(sheetCard));
    $('#variants').innerHTML = variantRows(sheetCard);
    return toast(text ? 'Valor salvo' : 'Voltando ao preço automático');
  }
});
$('#photoInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { await fromPhoto(f); } catch { paused = false; say('Não consegui ler essa foto.'); }
});
$('#importInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });

window.fichario = { matchArt, rerank, showMatch };
