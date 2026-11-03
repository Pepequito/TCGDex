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
const isPocket = id => /^(A|B)\d+[a-z]?$|^P-/.test(id);

// A lista em inglês é a mais completa; os nomes em português entram por cima quando existem.
const getSets = () => once('sets', async () => {
  const [en, pt] = await Promise.all([getJSON(`${API}/en/sets`), getJSON(`${API}/pt/sets`).catch(() => [])]);
  const ptById = new Map(pt.map(s => [s.id, s]));
  return en.filter(s => !isPocket(s.id)).map(s => ({
    id: s.id, nameEn: s.name, name: (ptById.get(s.id)?.name || s.name).trim(),
    official: s.cardCount.official, total: s.cardCount.total, logo: ptById.get(s.id)?.logo || s.logo,
  })).reverse();
});
const getSet = id => once('set:' + id, async () => {
  const [en, pt] = await Promise.all([getJSON(`${API}/en/sets/${id}`), getJSON(`${API}/pt/sets/${id}`).catch(() => null)]);
  const ptCards = new Map((pt?.cards || []).map(c => [c.localId, c]));
  return {
    id, name: pt?.name || en.name, official: en.cardCount.official, total: en.cardCount.total,
    abbr: en.abbreviation?.official || '', tcgOnline: en.tcgOnline || '',
    cards: en.cards.map(c => {
      const p = ptCards.get(c.localId);
      return { id: c.id, localId: c.localId, name: p?.name || c.name, nameEn: c.name, image: p?.image || c.image, imageEn: c.image, setId: id };
    }),
  };
});
const getCard = id => once('card:' + id, async () => {
  const [en, pt] = await Promise.all([getJSON(`${API}/en/cards/${id}`), getJSON(`${API}/pt/cards/${id}`).catch(() => null)]);
  return {
    id, localId: en.localId, name: pt?.name || en.name, nameEn: en.name, image: pt?.image || en.image, imageEn: en.image,
    rarity: pt?.rarity || en.rarity || '', setId: en.set.id, setName: pt?.set?.name || en.set.name,
    variants: Object.keys(VARIANTS).filter(v => en.variants?.[v]),
    prices: extractPrices(en),
  };
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
const imageUrl = (base, q = 'low') => base ? `${base}/${q}.webp` : '';
function imgTag(c, q = 'low', alt = '') {
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
const qtyOf = c => Object.values(c.qty).reduce((a, b) => a + b, 0);
const valueOf = c => Object.entries(c.qty).reduce((a, [v, n]) => a + n * (toUsd(c.prices?.[v]) || 0), 0);

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
  c.qty[variant] = Math.max(0, (c.qty[variant] || 0) + delta);
  if (!c.qty[variant]) delete c.qty[variant];
  c.updatedAt = Date.now();
  if (!Object.keys(c.qty).length) delete store.cards[card.id];
  save();
  window.Sync?.changed(card.id);
}
async function refreshPrices(onStep) {
  const cards = list();
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
  store.pricedAt = Date.now(); save();
  return failed;
}

/* ---------- Telas ---------- */
const route = { tab: 'home', setId: null, q: '', filter: 'all', results: null };
const view = $('#view');
function go(next) { Object.assign(route, next); render(); window.scrollTo(0, 0); }

function render() {
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === route.tab));
  ({ home: renderHome, sets: route.setId ? renderSet : renderSets, search: renderSearch, settings: renderSettings })[route.tab]();
}
function progressRow(s, have) {
  const size = s.total || s.official || 1;
  const pct = Math.min(100, have / size * 100);
  return `<button class="row" type="button" data-set="${esc(s.id)}">
    <b>${esc(s.name)}</b><span class="num small">${have}/${size}</span>
    <span class="meter${have >= size ? ' done' : ''}"><i style="width:${pct}%"></i></span></button>`;
}
function ownedBySet() {
  const m = {};
  for (const c of list()) m[c.setId] = (m[c.setId] || 0) + 1;
  return m;
}
async function renderHome() {
  const cards = list();
  const total = cards.reduce((a, c) => a + valueOf(c), 0);
  const copies = cards.reduce((a, c) => a + qtyOf(c), 0);
  const top = [...cards].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 5);
  view.innerHTML = `
    <div class="ledger"><span class="label">Valor da coleção</span>
      <span class="value num-display">${money(total)}</span>
      <span class="meta">${copies} ${copies === 1 ? 'carta' : 'cartas'} · ${cards.length} ${cards.length === 1 ? 'diferente' : 'diferentes'}</span></div>
    ${window.Sync?.nudge() || ''}
    ${cards.length ? `
    <div class="section"><div class="section-head"><h2>Seus sets</h2></div><div class="rows" id="mySets"><div class="row muted">Carregando…</div></div></div>
    <div class="section"><div class="section-head"><h2>Mais valiosas</h2></div>
      <div class="rows">${top.map(c => `<button class="row thumb" type="button" data-card="${esc(c.id)}">${imgTag(c, 'low')}
        <span><b>${esc(c.name)}</b><span class="sub">${esc(c.setName)} · ${esc(c.localId)}</span></span><span class="num small">${money(valueOf(c))}</span></button>`).join('')}</div></div>`
    : `<div class="empty"><h2>Seu fichário está vazio</h2>
       <p class="muted">Aponte a câmera para a primeira carta. O app reconhece a arte e você confirma antes de adicionar.</p>
       <button class="btn" type="button" data-scan>Escanear a primeira carta</button></div>`}`;
  if (!cards.length) return;
  try {
    const sets = await getSets(), owned = ownedBySet();
    const box = $('#mySets'); if (!box) return;
    const recent = {};
    for (const c of cards) recent[c.setId] = Math.max(recent[c.setId] || 0, c.addedAt);
    box.innerHTML = sets.filter(s => owned[s.id]).sort((a, b) => recent[b.id] - recent[a.id]).map(s => progressRow(s, owned[s.id])).join('');
  } catch { const box = $('#mySets'); if (box) box.innerHTML = '<div class="row muted">Sem conexão. Tente de novo em instantes.</div>'; }
}
async function renderSets() {
  view.innerHTML = `<h1>Sets</h1><input id="setFilter" class="field" type="search" placeholder="Filtrar por nome" value="${esc(route.q)}" autocomplete="off">
    <div class="rows" id="setList"><div class="row muted">Carregando sets…</div></div>`;
  const draw = sets => {
    const q = norm($('#setFilter')?.value || ''), owned = ownedBySet();
    const box = $('#setList'); if (!box) return;
    const hits = sets.filter(s => !q || norm(s.name).includes(q) || norm(s.nameEn).includes(q));
    box.innerHTML = hits.map(s => progressRow(s, owned[s.id] || 0)).join('') || '<div class="row muted">Nenhum set com esse nome.</div>';
  };
  try {
    const sets = await getSets(); draw(sets);
    $('#setFilter')?.addEventListener('input', e => { route.q = e.target.value; draw(sets); });
  } catch { $('#setList').innerHTML = '<div class="row muted">Sem conexão. Abra de novo quando estiver online.</div>'; }
}
async function renderSet() {
  view.innerHTML = '<button class="back" type="button" data-back>‹ Sets</button><p class="muted">Abrindo set…</p>';
  let s;
  try { s = await getSet(route.setId); }
  catch { view.innerHTML = '<button class="back" type="button" data-back>‹ Sets</button><p class="muted">Não consegui abrir este set. Verifique a conexão.</p>'; return; }
  if (route.tab !== 'sets' || route.setId !== s.id) return;
  const scope = store.scope[s.id] || 'all';
  const num = c => parseInt(c.localId, 10);
  const inScope = s.cards.filter(c => scope === 'all' || (num(c) <= s.official && /^\d+$/.test(c.localId)));
  const have = inScope.filter(c => store.cards[c.id]).length;
  const shown = inScope.filter(c => route.filter === 'all' || (route.filter === 'have') === !!store.cards[c.id]);
  const left = inScope.length - have;
  const value = list().filter(c => c.setId === s.id).reduce((a, c) => a + valueOf(c), 0);
  view.innerHTML = `<button class="back" type="button" data-back>‹ Sets</button>
    <div class="ledger"><h1>${esc(s.name)}</h1>
      <span class="meta">${left ? `Faltam ${left} de ${inScope.length} cartas` : 'Set completo'} · ${money(value)}</span></div>
    <div class="meter${left ? '' : ' done'}"><i style="width:${inScope.length ? have / inScope.length * 100 : 0}%"></i></div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Quais cartas contam">
        <button type="button" data-scope="all" class="${scope === 'all' ? 'on' : ''}">Completo (${s.cards.length})</button>
        <button type="button" data-scope="base" class="${scope === 'base' ? 'on' : ''}">Base (${s.official})</button></div>
      <div class="seg" role="group" aria-label="Filtro">
        ${[['all', 'Todas'], ['have', 'Tenho'], ['miss', 'Faltam']].map(([k, l]) => `<button type="button" data-filter="${k}" class="${route.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="binder">${shown.map(c => {
      const own = store.cards[c.id];
      return `<button type="button" class="pocket${own ? '' : ' missing'}" data-card="${esc(c.id)}" aria-label="${esc(c.name)} ${esc(c.localId)}${own ? '' : ', faltando'}">
        ${imgTag(c)}<span class="tag">${esc(c.localId)}</span>${own && qtyOf(own) > 1 ? `<span class="qty">×${qtyOf(own)}</span>` : ''}</button>`;
    }).join('') || '<p class="muted">Nada para mostrar neste filtro.</p>'}</div>`;
}
function renderSearch() {
  view.innerHTML = `<h1>Buscar carta</h1>
    <form id="searchForm"><input id="searchInput" class="field" type="search" enterkeyhint="search" placeholder="Nome da carta, como Charizard" value="${esc(route.q)}" autocomplete="off"></form>
    <div id="searchOut"></div>`;
  if (route.results) drawResults(route.results);
}
function drawResults(cards) {
  const box = $('#searchOut'); if (!box) return;
  box.innerHTML = cards.length ? `<div class="binder">${cards.map(c => `<button type="button" class="pocket${store.cards[c.id] ? '' : ' missing'}" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c)}<span class="tag">${esc(c.localId)}</span></button>`).join('')}</div>`
    : '<p class="muted">Nenhuma carta encontrada. Confira a grafia do nome em inglês ou português.</p>';
}
async function searchCards(q) {
  const param = encodeURIComponent(q);
  const [pt, en] = await Promise.all([
    getJSON(`${API}/pt/cards?name=${param}&pagination:itemsPerPage=60`).catch(() => []),
    getJSON(`${API}/en/cards?name=${param}&pagination:itemsPerPage=60`).catch(() => []),
  ]);
  const seen = new Map();
  for (const c of [...pt, ...en]) if (!seen.has(c.id) && !isPocket(c.id.split('-')[0])) seen.set(c.id, { ...c, imageEn: c.image });
  return [...seen.values()].reverse();
}
function renderSettings() {
  const when = store.pricedAt ? new Date(store.pricedAt).toLocaleDateString('pt-BR') : 'nunca';
  view.innerHTML = `<h1>Ajustes</h1>
    <div class="section" id="account"></div>
    <div class="section"><h2>Moeda</h2>
      <div class="seg" role="group" aria-label="Moeda">${['BRL', 'USD', 'EUR'].map(c => `<button type="button" data-currency="${c}" class="${store.currency === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      <p class="muted small">Os preços vêm da TCGplayer (EUA) e da Cardmarket (Europa) e são convertidos pela cotação do dia. O mercado brasileiro pode praticar valores diferentes.${store.fx ? ` US$ 1 = R$ ${store.fx.BRL.toFixed(2).replace('.', ',')}.` : ''}</p></div>
    <div class="section"><h2>Preços</h2>
      <button id="refreshPrices" class="btn alt" type="button">Atualizar preços da coleção</button>
      <p class="muted small">Última atualização: ${when}.</p></div>
    <div class="section"><h2>Backup</h2>
      <button id="exportBtn" class="btn alt" type="button">Exportar coleção</button>
      <button id="importBtn" class="btn alt" type="button">Importar backup</button>
      <p class="muted small">Sem conta, a coleção fica só neste iPhone. Exporte de vez em quando e guarde o arquivo no iCloud Drive.</p></div>
    <p class="muted small">Dados de cartas: TCGdex. Reconhecimento feito no próprio aparelho. Projeto pessoal, sem vínculo com The Pokémon Company ou Nintendo.</p>`;
  window.Sync?.paint();
}

/* ---------- Painel da carta ---------- */
const sheet = $('#sheet'), sheetBack = $('#sheetBack');
let onSheetClose = null;
function openSheet(html, onClose = null) {
  sheet.innerHTML = html; sheet.hidden = sheetBack.hidden = false; sheet.scrollTop = 0; onSheetClose = onClose;
}
function closeSheet() {
  sheet.hidden = sheetBack.hidden = true;
  const fn = onSheetClose; onSheetClose = null; fn?.(); render();
}
function variantRows(card) {
  const own = store.cards[card.id]?.qty || {};
  const vs = card.variants.length ? card.variants : ['normal'];
  return vs.map(v => {
    const p = card.prices?.[v], usd = toUsd(p);
    const src = [p?.usd != null ? `US$ ${p.usd.toFixed(2)}` : '', p?.eur ? `€ ${p.eur.toFixed(2)}` : ''].filter(Boolean).join(' · ');
    return `<div class="variant"><b>${VARIANTS[v].label}</b>
      <div class="stepper"><button type="button" data-step="-1" data-variant="${v}" aria-label="Remover ${VARIANTS[v].label}">−</button><span>${own[v] || 0}</span><button type="button" data-step="1" data-variant="${v}" aria-label="Adicionar ${VARIANTS[v].label}">+</button></div>
      <span class="prices">${usd != null ? `${money(usd)} <span class="small">(${src})</span>` : 'Sem preço disponível'}</span></div>`;
  }).join('');
}
function cardHead(card) {
  return `<div class="card-head">${imgTag(card, 'high', card.name)}<div><h2>${esc(card.name)}</h2>
    <span class="muted">${esc(card.setName)}</span><span class="num small">Nº ${esc(card.localId)}</span>
    ${card.rarity ? `<span class="muted small">${esc(card.rarity)}</span>` : ''}</div></div>`;
}
let sheetCard = null;
async function showCard(id) {
  openSheet('<p class="muted">Buscando carta e preço…</p>');
  try {
    sheetCard = await getCard(id);
    if (sheet.hidden) return;
    sheet.innerHTML = `${cardHead(sheetCard)}<div id="variants">${variantRows(sheetCard)}</div>
      <button class="btn alt" type="button" data-close>Fechar</button>`;
  } catch { sheet.innerHTML = '<p>Não consegui carregar esta carta. Verifique a conexão.</p><button class="btn alt" type="button" data-close>Fechar</button>'; }
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
// `src` é o recorte da carta. O número pode estar no canto esquerdo (atuais) ou direito (antigas).
async function readCard(src, W, H) {
  const w = await ocrWorker();
  let strip = '', number = null;
  await w.setParameters({ tessedit_pageseg_mode: '11' });
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
const S = 32, BITS = 128, ART = { x: .08, y: .11, w: .84, h: .36 }, MATCH_MAX = 36, TILTS = [0, -4, 4];
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
const thumb = document.createElement('canvas');
thumb.width = thumb.height = S;
const thumbCtx = thumb.getContext('2d', { willReadFrequently: true });
thumbCtx.imageSmoothingQuality = 'high';
const gray = new Float32Array(S * S), coef = new Float32Array(BITS), cols = new Float32Array(FREQS * S);
function artHash(src, x, y, w, h, out) {
  thumbCtx.drawImage(src, x, y, w, h, 0, 0, S, S);
  const d = thumbCtx.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) gray[i] = .3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2];
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
  // Reduz o quadro uma vez só: é o que torna as 245 tentativas rápidas num iPhone.
  const small = document.createElement('canvas');
  small.width = 180; small.height = 252;
  const sg = small.getContext('2d', { willReadFrequently: true });
  sg.imageSmoothingQuality = 'high';
  sg.translate(90, 126); sg.rotate(rot * Math.PI / 180); sg.translate(-90, -126);
  sg.drawImage(src, 0, 0, W, H, 0, 0, 180, 252);
  // Mesa lisa ou papel em branco não têm arte para comparar.
  const px = sg.getImageData(30, 40, 120, 90).data;
  let sum = 0, sq = 0;
  for (let i = 0; i < px.length; i += 4) { const v = px[i + 1]; sum += v; sq += v * v; }
  const count = px.length / 4;
  if (Math.sqrt(sq / count - (sum / count) ** 2) < 14) return [{ id: null, dist: 99 }];
  for (const z of [.86, .93, 1, 1.07, 1.15]) for (let ox = -.075; ox < .08; ox += .025) for (let oy = -.075; oy < .08; oy += .025) {
    const w = 180 * ART.w * z, h = 252 * ART.h * z;
    artHash(small, 180 * (ART.x + ox + (1 - z) * ART.w / 2), 252 * (ART.y + oy + (1 - z) * ART.h / 2), w, h, q);
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const d = pop(q[0] ^ hashes[o]) + pop(q[1] ^ hashes[o + 1]) + pop(q[2] ^ hashes[o + 2]) + pop(q[3] ^ hashes[o + 3]);
      if (d < best[i]) best[i] = d;
    }
  }
  return Array.from(best.keys()).sort((a, b) => best[a] - best[b]).slice(0, limit).map(i => {
    const [id, p] = cards[i], localId = id.slice(id.lastIndexOf('-') + 1), image = `https://assets.tcgdex.net/en/${paths[p]}/${localId}`;
    return { id, localId, name: id, image, imageEn: image, dist: best[i] };
  });
}
// Quando duas cartas têm arte quase igual (reimpressões), o número impresso decide.
async function rerank(cards, src, W, H) {
  if (cards.length < 2 || cards[1].dist - cards[0].dist > 5) return cards;
  try {
    const { number } = await readCard(src, W, H);
    if (!number?.local) return cards;
    const near = c => parseInt(c.localId, 10) === parseInt(number.local, 10) && c.dist - cards[0].dist <= 8;
    return [...cards].sort((a, b) => near(b) - near(a) || a.dist - b.dist);
  } catch { return cards; }
}

/* ---------- Scanner ---------- */
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
    await new Promise(r => setTimeout(r, 250));
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
      const sure = seen && (top.dist <= 27 || (top.dist <= 33 && recent.includes(top.id)));
      recent.push(seen ? top.id : null);
      if (recent.length > 3) recent.shift();
      if (sure) {
        misses = 0; say('Carta encontrada'); shown = top.id;
        cards = await rerank(cards, frame, W, H);
        if (scanning) { paused = true; showMatch({ cards }); }
        continue;
      }
      misses++;
      say(`${misses > 12 ? 'Encaixe a carta na moldura e evite reflexo sobre a arte' : 'Encaixe a carta na moldura e mantenha parado'} (${top.dist})`);
      // Carta lançada depois de o banco ser gerado: o número impresso ainda resolve.
      if (++frames % 16 === 0) {
        const r = await identify(frame, W, H);
        if (!paused && scanning && confident(r)) { paused = true; showMatch(r); }
      }
    } catch { say('Sem conexão com o banco de cartas.'); await new Promise(r => setTimeout(r, 1500)); }
  }
}
function showMatch({ cards, read }, resume = true) {
  navigator.vibrate?.(30);
  let idx = 0, detail = null;
  const onDone = () => { paused = !resume; if (resume) say('Enquadre a próxima carta'); };
  const draw = async () => {
    openSheet('<p class="muted">Buscando carta e preço…</p>', onDone);
    try { detail = await getCard(cards[idx].id); }
    catch { sheet.innerHTML = '<p>Sem conexão para buscar esta carta.</p><button class="btn alt" type="button" data-close>Voltar</button>'; return; }
    if (sheet.hidden) return;
    sheetCard = detail;
    const alts = cards.length > 1 ? `<div class="section"><span class="muted small">Não é essa? Escolha outra:</span>
      <div class="alts">${cards.map((c, i) => `<button type="button" data-alt="${i}" class="${i === idx ? 'on' : ''}" aria-label="${esc(c.name)}">${imgTag(c)}</button>`).join('')}</div></div>` : '';
    sheet.innerHTML = `${cardHead(detail)}${alts}<div id="variants">${variantRows(detail)}</div>
      <div class="sheet-actions">
        <button class="btn" type="button" data-add>Adicionar ${esc((detail.variants.length ? VARIANTS[detail.variants[0]].label : 'Normal').toLowerCase())}</button>
        <button class="btn alt" type="button" data-close>${resume ? 'Continuar escaneando' : 'Fechar'}</button></div>`;
    $$('[data-alt]', sheet).forEach(b => b.onclick = () => { idx = +b.dataset.alt; draw(); });
    $('[data-add]', sheet).onclick = () => {
      setQty(detail, detail.variants[0] || 'normal', 1);
      toast(`${detail.name} adicionada`);
      closeSheet();
    };
  };
  draw();
  void read;
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
  if (best[0].dist <= MATCH_MAX) { showMatch({ cards: await rerank(best, bestSrc, bestSrc.width, bestSrc.height) }); return; }
  const r = await identify(bestSrc, bestSrc.width, bestSrc.height);
  if (r.cards.length) showMatch(r);
  else { paused = false; say('Não reconheci essa foto. Tente de mais perto ou use Buscar.'); }
}

/* ---------- Backup ---------- */
async function exportBackup() {
  const name = `fichario-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ app: 'fichario', version: 1, cards: store.cards }, null, 1)], { type: 'application/json' });
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
    Object.assign(store.cards, data.cards); save(); render();
    window.Sync?.changedAll(Object.keys(data.cards));
    toast(`${Object.keys(data.cards).length} cartas importadas`);
  } catch { toast('Esse arquivo não é um backup do Fichário.'); }
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
  else if (d.scope) { store.scope[route.setId] = d.scope; save(); render(); }
  else if (d.currency) { store.currency = d.currency; save(); refreshFx(); render(); }
  else if (d.step && sheetCard) { setQty(sheetCard, d.variant, +d.step); $('#variants').innerHTML = variantRows(sheetCard); }
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
  if (e.target.id !== 'searchForm') return;
  const q = $('#searchInput').value.trim(); if (!q) return;
  route.q = q; $('#searchOut').innerHTML = '<p class="muted">Buscando…</p>';
  $('#searchInput').blur();
  route.results = await searchCards(q); drawResults(route.results);
});
$('#photoInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { await fromPhoto(f); } catch { paused = false; say('Não consegui ler essa foto.'); }
});
$('#importInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });

render();
refreshFx();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.fichario = { matchArt, rerank, showMatch };
