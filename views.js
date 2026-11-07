'use strict';
/* ---------- Telas ---------- */
const route = { tab: 'home', setId: null, q: '', filter: 'all', results: null, region: 'west' };
const view = $('#view');
const SHOWCASE_MAX = 9;
store.profile ??= { showcase: [] };
store.profile.showcase ??= [];
let sheetCard = null;

function go(next) { Object.assign(route, next); render(); window.scrollTo(0, 0); }
function render() {
  const wide = matchMedia('(min-width: 1024px)').matches;
  const active = { settings: wide ? 'settings' : 'profile', help: wide ? 'settings' : 'profile', reports: 'admin', friend: 'social' }[route.tab] || route.tab;
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === active));
  if (window.Desk?.render()) return;
  ({ home: renderHome, sets: route.setId ? renderSet : renderSets, search: renderSearch, profile: renderProfile, settings: renderSettings, cards: renderMine,
    social: () => window.Social?.renderSocial(), friend: () => window.Social?.renderFriend(),
    help: () => window.Help?.renderHelp(), reports: () => window.Help?.renderReports(), admin: () => window.Access?.renderAdmin() })[route.tab]?.();
}
const plural = (n, one, many) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
function ownedBySet() {
  const m = {};
  for (const c of list()) m[c.setId] = (m[c.setId] || 0) + 1;
  return m;
}
const collectionValue = () => list().reduce((a, c) => a + valueOf(c), 0);
const copiesCount = () => list().reduce((a, c) => a + qtyOf(c), 0);

/* ---------- Identidade ---------- */
const accountUser = () => window.Sync?.user?.() || null;
const trainerName = () => store.profile.name || accountUser()?.name || 'Treinador';
function avatar() {
  const photo = store.profile.photo || accountUser()?.photo;
  if (photo) return `<img class="avatar" src="${esc(photo)}" alt="" referrerpolicy="no-referrer">`;
  return `<span class="avatar initials">${esc(trainerName().trim().charAt(0).toUpperCase() || 'T')}</span>`;
}
// Fundos do topo do perfil e aros em volta da foto. A chave fica no perfil e vai junto para o perfil público.
// Padrões desenhados em SVG, repetidos como papel de parede.
const svgBg = svg => `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
const BALL = (c, x, y, r, o) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="3"><circle r="${r}"/><path d="M-${r} 0h${r * .62}M${r * .38} 0h${r * .62}"/><circle r="${r * .38}"/></g>`;
const PATTERNS = {
  pokebolas: svgBg(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">${BALL('#000000', 30, 30, 20, .16)}${BALL('#000000', 90, 90, 20, .16)}</svg>`),
  raios: svgBg('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><path d="M30 6 14 40h14l-8 26 26-34H32l10-26z" fill="#fff" fill-opacity=".28"/><path d="M74 48 64 68h8l-5 16 16-21h-9l6-15z" fill="#7a4a00" fill-opacity=".18"/></svg>'),
  grama: svgBg('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><path d="M4 40C8 28 10 18 8 6c6 10 8 22 6 34M20 40c2-10 6-18 14-26-4 10-6 18-6 26M38 40c0-12-4-20-10-28 10 6 16 16 16 28M50 40c2-8 4-14 10-20-2 8-2 14-2 20" fill="#062f1d" fill-opacity=".35"/></svg>'),
  estrelas: svgBg('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100"><g fill="#fff"><circle cx="12" cy="18" r="1.4" opacity=".8"/><circle cx="64" cy="8" r="1" opacity=".6"/><circle cx="110" cy="30" r="1.6" opacity=".9"/><circle cx="40" cy="60" r="1" opacity=".5"/><circle cx="90" cy="78" r="1.3" opacity=".7"/><circle cx="130" cy="90" r=".9" opacity=".5"/><path d="M80 40l1.6 4 4 1.6-4 1.6L80 51l-1.6-3.800L74.400 45.600l4-1.600z" opacity=".9"/></g></svg>'),
  pokedex: svgBg('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150"><circle cx="46" cy="46" r="30" fill="#fff"/><circle cx="46" cy="46" r="23" fill="#2a8cff"/><circle cx="38" cy="38" r="8" fill="#a9dcff"/><circle cx="96" cy="26" r="7" fill="#ff3b3b" stroke="#7a0b0b" stroke-width="2"/><circle cx="118" cy="26" r="7" fill="#ffd400" stroke="#7a5b00" stroke-width="2"/><circle cx="140" cy="26" r="7" fill="#3ddc5a" stroke="#0b5a1d" stroke-width="2"/><path d="M0 104h170l30-30h200" fill="none" stroke="#7a0b0b" stroke-width="5"/></svg>'),
};
// Fundos do topo do perfil e aros em volta da foto. A chave fica no perfil e vai junto para o perfil público.
const BANNERS = {
  pokebola: ['Pokébola', `${PATTERNS.pokebolas}, linear-gradient(180deg, #e3350d 0 58%, #1a1a1a 58% 64%, #f2f2f2 64%)`],
  pikachu: ['Pikachu', `${PATTERNS.raios}, radial-gradient(8% 19% at 12% 76%, #ff5a4f 96%, transparent 100%), radial-gradient(8% 19% at 88% 76%, #ff5a4f 96%, transparent 100%), linear-gradient(160deg, #fff27a, #ffd733 45%, #f2a900)`],
  pokedex: ['Pokédex', `${PATTERNS.pokedex} left top / auto 100% no-repeat, linear-gradient(160deg, #ff4b4b, #d61f1f 60%, #8f0d0d)`],
  gramaalta: ['Grama alta', `${PATTERNS.grama}, linear-gradient(180deg, #9be15d 0%, #4caf50 55%, #1f7a3a 100%)`],
  noite: ['Céu noturno', `${PATTERNS.estrelas}, radial-gradient(circle at 80% 10%, #4a3f9f 0%, #1a1747 50%, #05060f 100%)`],
  ultraball: ['Ultra Ball', `${PATTERNS.pokebolas}, linear-gradient(90deg, transparent 0 30%, #f5c518 30% 38%, transparent 38% 62%, #f5c518 62% 70%, transparent 70%) top / 100% 58% no-repeat, linear-gradient(180deg, #1e1e1e 0 58%, #f5c518 58% 64%, #f2f2f2 64%)`],
  masterball: ['Master Ball', `radial-gradient(7% 17% at 22% 30%, #ff6fae 96%, transparent 100%), radial-gradient(7% 17% at 78% 30%, #ff6fae 96%, transparent 100%), ${PATTERNS.pokebolas}, linear-gradient(180deg, #8a46cf 0 58%, #1a1a1a 58% 64%, #f2f2f2 64%)`],
  aurora: ['Boosterz', 'conic-gradient(from 200deg at 30% 120%, #1f6fff, #7c3aed, #ff5a2e, #ffb02e, #1f6fff)'],
  fogo: ['Fogo', 'linear-gradient(135deg, #ffcf3f 0%, #ff7a18 45%, #c2185b 100%)'],
  oceano: ['Oceano', 'linear-gradient(160deg, #3fd8ff 0%, #1f6fff 50%, #142067 100%)'],
  psiquico: ['Psíquico', 'linear-gradient(135deg, #ff7ad9 0%, #8b5cf6 55%, #2b1257 100%)'],
  gelo: ['Gelo', 'linear-gradient(160deg, #ffffff 0%, #a8e9ff 40%, #4f7cff 100%)'],
  floresta: ['Floresta', 'linear-gradient(150deg, #b5f05b 0%, #22a06b 50%, #0b3d36 100%)'],
  eletrico: ['Elétrico', 'radial-gradient(circle at 70% 20%, #fff58a, #ffc23d 30%, #6b3df2 100%)'],
  holo: ['Holográfico', 'linear-gradient(115deg, #ff9a9e, #fad0c4, #a1ffce, #8fd3f4, #c2a3ff, #ff9a9e)'],
};
// Terceiro item: enfeite desenhado em CSS (orelhas ou aro mais grosso de Poké Ball).
const BALL_RING = (top, extra = '') => `${extra}linear-gradient(180deg, ${top} 0 44%, #1a1a1a 44% 56%, #f2f2f2 56%)`;
const RINGS = {
  pikachu: ['Pikachu', 'linear-gradient(160deg, #fff27a, #ffd733 50%, #e8a400)', 'pikachu'],
  eevee: ['Eevee', 'linear-gradient(160deg, #f7e3b5, #c08040 55%, #7a4a1e)', 'eevee'],
  pokebola: ['Pokébola', BALL_RING('#ee1515'), 'ball'],
  greatball: ['Great Ball', BALL_RING('#2a6be0', 'radial-gradient(circle at 20% 22%, #ee1515 0 13%, transparent 14%), radial-gradient(circle at 80% 22%, #ee1515 0 13%, transparent 14%), '), 'ball'],
  ultraball: ['Ultra Ball', 'linear-gradient(90deg, transparent 0 24%, #f5c518 24% 36%, transparent 36% 64%, #f5c518 64% 76%, transparent 76%) top / 100% 44% no-repeat, linear-gradient(180deg, #1e1e1e 0 44%, #f5c518 44% 56%, #f2f2f2 56%)', 'ball'],
  masterball: ['Master Ball', BALL_RING('#8a46cf', 'radial-gradient(circle at 24% 24%, #ff6fae 0 12%, transparent 13%), radial-gradient(circle at 76% 24%, #ff6fae 0 12%, transparent 13%), '), 'ball'],
  foil: ['Holo', 'var(--foil-round)'],
  ouro: ['Ouro', 'linear-gradient(160deg, #fff3b0, #ffc23d 45%, #b86b00)'],
  prata: ['Prata', 'linear-gradient(160deg, #ffffff, #c9d6ea 50%, #6d7f9e)'],
  ciano: ['Ciano', 'linear-gradient(160deg, #a8f3ff, #3fd8ff 50%, #1f6fff)'],
  violeta: ['Violeta', 'linear-gradient(160deg, #e3c8ff, #8b5cf6 50%, #4c1d95)'],
  arcoiris: ['Arco-íris', 'conic-gradient(#ff5a5a, #ffc23d, #b5f05b, #3fd8ff, #8b5cf6, #ff5a5a)'],
  nenhum: ['Sem aro', 'transparent'],
};
// Atributos do aro: a cor e, se houver, o enfeite. Uso: <span class="ring-avatar" ${ringAttrs(chave)}>.
const ringAttrs = key => {
  const r = RINGS[key] || RINGS.foil;
  return `style="background:${r[1]}"${r[2] ? ` data-deco="${r[2]}"` : ''}`;
};
const bannerBg = key => (BANNERS[key] || BANNERS.aurora)[1];
// Fundo a partir de uma carta da coleção: só vale imagem pública (não a foto tirada no aparelho).
function bannerImage() {
  const c = store.cards[store.profile.bannerCard];
  return c?.image && !c.image.startsWith('data:') ? imageUrl(c.image, 'high') : '';
}
function bannerHtml(key, image) {
  if (image) return `<div class="banner art" style="--art:url('${esc(image)}')"></div>`;
  return `<div class="banner" style="background:${bannerBg(key)}"></div>`;
}
function personalize() {
  const p = store.profile, cards = [...list()].filter(c => c.image && !c.image.startsWith('data:')).sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 40);
  openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Personalizar perfil</h2>
    <div class="custom-preview">${bannerHtml(p.banner, bannerImage())}<span class="ring-avatar" ${ringAttrs(p.ring)}>${avatar()}</span></div>
    <h3>Fundo</h3><div class="swatches">${Object.entries(BANNERS).map(([k, [name, bg]]) => `<button type="button" class="swatch${!p.bannerCard && (p.banner || 'aurora') === k ? ' on' : ''}" data-banner="${k}"><i style="background:${bg}"></i><span>${name}</span></button>`).join('')}</div>
    ${cards.length ? `<h3>Ou a arte de uma carta sua</h3><div class="rail">${cards.map(c => `<button type="button" class="rail-card mini${p.bannerCard === c.id ? ' on' : ''}" data-banner-card="${esc(c.id)}" aria-label="${esc(c.name)}"><span class="frame">${imgTag(c, 'low', c.name)}</span></button>`).join('')}</div>` : ''}
    <h3>Aro da foto</h3><div class="swatches rings">${Object.entries(RINGS).map(([k, [name, bg]]) => `<button type="button" class="swatch${(p.ring || 'foil') === k ? ' on' : ''}" data-ring="${k}"><span class="ring-avatar" ${ringAttrs(k)}><span class="avatar initials blank"></span></span><span>${name}</span></button>`).join('')}</div>
    <button class="btn" type="button" data-close>Concluir</button>`);
}
function saveProfile() {
  store.profile.updatedAt = Date.now();
  save();
  window.Sync?.changedProfile();
  window.Social?.publishSoon();
}

/* ---------- Coleção ---------- */
function trackValue(total) {
  if (!total) return;
  const day = new Date().toISOString().slice(0, 10), h = store.history ??= [];
  const last = h[h.length - 1];
  if (last?.[0] === day) { if (last[1] === total) return; last[1] = total; }
  else h.push([day, total]);
  if (h.length > 365) h.shift();
  save();
  window.Sync?.historyChanged?.();
}
const dayLabel = d => d.slice(8, 10) + '/' + d.slice(5, 7);
// Variação do valor no período (7, 30, 90 dias ou tudo), a partir do histórico diário.
const historyIn = range => { const h = store.history || []; if (range === 'all') return h; const from = new Date(Date.now() - +range * 864e5).toISOString().slice(0, 10); return h.filter(p => p[0] >= from); };
function valueChange(range = 'all') {
  const h = historyIn(range);
  if (h.length < 2 || !h[0][1]) return null;
  const diff = h[h.length - 1][1] - h[0][1];
  return { diff, pct: diff / h[0][1] * 100, label: { 7: 'em 7 dias', 30: 'em 30 dias', 90: 'em 90 dias', all: 'desde o início' }[range] };
}
function valueChart(range = 'all') {
  const h = historyIn(range);
  if (h.length < 2) return '<p class="muted small">O gráfico da evolução aparece a partir do segundo dia de uso.</p>';
  const vals = h.map(p => p[1]), min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * .12 || max * .05 || 1;
  const W = 320, H = 86, x = i => i / (h.length - 1) * W, y = v => H - 6 - (v - min + pad) / (max - min + 2 * pad) * (H - 12);
  const line = h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const end = h.length - 1;
  return `<div class="chart" id="valueChart" data-range="${range}">
    <div class="readout" id="chartRead"><b>${money(vals[end])}</b> em ${dayLabel(h[end][0])}</div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução do valor da coleção, de ${money(vals[0])} para ${money(vals[end])}">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc23d" stop-opacity=".28"/><stop offset="1" stop-color="#ffc23d" stop-opacity="0"/></linearGradient></defs>
      <path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#area)"/>
      <path d="${line}" fill="none" stroke="#ffc23d" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <line id="chartCursor" x1="${W}" x2="${W}" y1="0" y2="${H}" stroke="#a3b1d6" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
    </svg>
    <div class="axis"><span>${dayLabel(h[0][0])}</span><span>${dayLabel(h[end][0])}</span></div></div>`;
}
function bindChart() {
  const box = $('#valueChart'); if (!box) return;
  const h = historyIn(box.dataset.range || 'all'), cursor = $('#chartCursor'), read = $('#chartRead');
  const show = e => {
    const r = box.getBoundingClientRect(), i = Math.max(0, Math.min(h.length - 1, Math.round((e.clientX - r.left) / r.width * (h.length - 1))));
    cursor.setAttribute('x1', i / (h.length - 1) * 320); cursor.setAttribute('x2', i / (h.length - 1) * 320); cursor.setAttribute('opacity', 1);
    read.innerHTML = `<b>${money(h[i][1])}</b> em ${dayLabel(h[i][0])}`;
  };
  box.addEventListener('pointermove', show);
  box.addEventListener('pointerdown', show);
}
function railCard(c, label) {
  return `<button class="rail-card" type="button" data-card="${esc(c.id)}"><span class="frame">${imgTag(c, 'low', c.name)}${hotBadge(c)}</span>
    <b>${esc(c.name)}</b>${label ? `<span class="price">${label}</span>` : ''}</button>`;
}
// Sem logo oficial, vale o símbolo do set; sem símbolo, o código impresso nas cartas ou as iniciais.
const setCode = s => isAsian(s.id) ? rawOf(s.id) : s.name.split(/\s+/).filter(w => /^[\p{L}\d]/u.test(w) && w.length > 2).map(w => w[0]).join('').slice(0, 4).toUpperCase();
const setArts = s => [...new Set([!store.namesEn && s.logoPt, s.logo && s.logo + '.webp', s.logoAlt && s.logoAlt + '.webp', s.logoUrl, s.art].filter(Boolean))];
const setArt = s => setArts(s)[0] || '';
const artFallback = s => esc(setArts(s).slice(1).join('|'));
function setTile(s, have) {
  if (s.soon) return `<button class="set-tile soon" type="button" data-soon="${esc(s.name)}">
    <span class="logo">${setArt(s) ? `<img loading="lazy" alt="" data-logo src="${esc(setArt(s))}">` : ''}<em>${esc(setCode(s))}</em></span>
    <b>${esc(s.name)}</b><span class="soon-tag">Em breve</span></button>`;
  const size = s.total || s.official || 1, pct = Math.min(100, have / size * 100), art = setArt(s);
  return `<button class="set-tile${have >= size ? ' done' : ''}" type="button" data-set="${esc(s.id)}">
    <span class="logo${art ? '' : s.fan ? ' has-fan' : ' nologo'}${s.art && art === s.art ? ' pack' : ''}">${art ? `<img loading="lazy" alt="" data-logo data-next="${artFallback(s)}" src="${esc(art)}">` : ''}${!art && s.fan ? `<span class="fan">${s.fan.map(u => `<img loading="lazy" alt="" data-hide-broken src="${esc(imageUrl(u, 'low'))}">`).join('')}</span>` : ''}<em>${esc(setCode(s))}</em></span>
    <b>${esc(s.name)}</b><span class="bar"><i style="width:${pct}%"></i></span>
    <span class="count"><span>${have}/${size}</span><span>${Math.floor(pct)}%</span></span></button>`;
}
document.addEventListener('error', e => {
  const next = e.target.dataset?.next;
  if (next) { const [first, ...rest] = next.split('|'); e.target.dataset.next = rest.join('|'); e.target.src = first; return; }
  if (e.target.dataset?.hideBroken !== undefined) { e.target.parentElement?.classList.remove('has-cover'); e.target.parentElement?.classList.add('nologo'); e.target.remove(); return; }
  if (e.target.dataset?.logo === undefined) return;
  e.target.parentElement.classList.add('nologo'); e.target.remove();
}, true);

async function renderHome() {
  const cards = list(), total = collectionValue(), copies = copiesCount();
  trackValue(total);
  const top = [...cards].sort((a, b) => unitValue(b) - unitValue(a)).slice(0, 8);
  const recent = [...cards].sort((a, b) => b.addedAt - a.addedAt).slice(0, 8);
  view.innerHTML = `
    <div class="brand-row brand-lock"><img class="logo" src="icons/logo.webp" alt="Boosterz TCG Tracker"><span class="beta">BETA</span></div>
    <div class="topbar"><div class="hello"><span>Olá, treinador</span><b>${esc(trainerName())}</b></div>
      <span class="top-actions"><button class="icon-btn" type="button" data-tab="settings" aria-label="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/></svg></button><button class="icon-btn" type="button" data-tab="search" aria-label="Explorar cartas"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>
      <button class="ring-avatar" type="button" data-tab="profile" aria-label="Abrir perfil" ${ringAttrs(store.profile.ring)}>${avatar()}</button></span></div>
    <div class="hero"><div><span class="label">Valor da coleção</span><span class="value">${money(total)}</span></div>
      ${cards.length ? valueChart() : ''}
      <div class="chips"><button type="button" class="chip" data-mine="all"><b>${copies}</b> ${copies === 1 ? 'carta' : 'cartas'} ›</button><span class="chip"><b>${cards.length}</b> ${cards.length === 1 ? 'diferente' : 'diferentes'}</span></div></div>
    ${window.Sync?.nudge() || ''}${window.Wish?.banner() || ''}
    ${cards.length ? `
    <div class="section"><div class="section-head"><h2>Mais valiosas</h2><span class="muted small">por carta</span></div><div class="rail">${top.map(c => railCard(c, money(unitValue(c)))).join('')}</div></div>
    <div class="section"><div class="section-head"><h2>Seus sets</h2><button type="button" data-my-sets>Ver todos</button></div><div class="tiles" id="mySets"></div></div>
    <div class="section"><div class="section-head"><h2><button type="button" class="head-link" data-mine="recent">Adicionadas recentemente ›</button></h2><button type="button" data-mine="recent">Ver as últimas 100</button></div><div class="rail">${recent.map(c => railCard(c)).join('')}</div></div>`
    : `<div class="empty"><h2>Sua coleção está vazia</h2>
       <p class="muted">Aponte a câmera para a primeira carta. O app reconhece a arte e você confirma antes de adicionar.</p>
       <button class="btn" type="button" data-scan>Escanear a primeira carta</button></div>`}`;
  bindChart();
  if (!cards.length) return;
  try {
    const sets = await getSets(), owned = ownedBySet();
    const box = $('#mySets'); if (!box) return;
    const latest = {};
    for (const c of cards) latest[c.setId] = Math.max(latest[c.setId] || 0, c.addedAt);
    const mine = sets.filter(s => owned[s.id]);
    if (owned.custom) mine.push(customSet());
    box.innerHTML = mine.sort((a, b) => latest[b.id] - latest[a.id]).slice(0, 4).map(s => setTile(s, owned[s.id])).join('');
  } catch { const box = $('#mySets'); if (box) box.innerHTML = '<p class="muted">Sem conexão. Tente de novo em instantes.</p>'; }
}

/* ---------- Sets ---------- */
async function renderSets() {
  view.innerHTML = `<div class="page-head"><h1>Sets</h1><button class="btn alt auto" type="button" data-tab="search">Explorar cartas</button></div><input id="setFilter" class="field" type="search" placeholder="Procurar set" aria-label="Procurar set" value="${esc(route.q)}" autocomplete="off">
    <div class="seg" role="group" aria-label="Quais sets mostrar">${[['west', 'Ocidentais'], ['ja', 'Japoneses'], ['zh', 'Chineses'], ['mine', 'Meus']].map(([k, l]) => `<button type="button" data-region="${k}" class="${route.region === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="setList" class="section"><p class="muted">Carregando sets…</p></div>`;
  const draw = (sets, series) => {
    const q = norm($('#setFilter')?.value || ''), owned = ownedBySet(), box = $('#setList');
    if (!box) return;
    const match = s => !q || norm(s.name).includes(q) || norm(s.nameEn).includes(q);
    const all = owned.custom ? [...sets, customSet()] : sets;
    if (route.region === 'mine') {
      const hits = all.filter(s => owned[s.id] && match(s)).sort((a, b) => owned[b.id] / b.total - owned[a.id] / a.total);
      box.innerHTML = hits.length ? `<div class="tiles">${hits.map(s => setTile(s, owned[s.id])).join('')}</div>` : '<p class="muted">Nenhum set seu com esse nome.</p>';
      return;
    }
    const hits = sets.filter(s => regionOf(s.id) === route.region && match(s));
    if (!hits.length) { box.innerHTML = '<p class="muted">Nenhum set com esse nome.</p>'; return; }
    if (route.region !== 'west') { box.innerHTML = `<div class="tiles">${hits.map(s => setTile(s, owned[s.id] || 0)).join('')}</div>`; return; }
    const groups = new Map();
    for (const s of hits) { const k = s.serie || 'outros'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
    box.innerHTML = [...groups].sort((a, b) => (a[0] === 'outros') - (b[0] === 'outros')).map(([k, g]) => `<div class="group"><h2>${esc(series[k] || 'Outras coleções')}</h2><div class="tiles">${g.map(s => setTile(s, owned[s.id] || 0)).join('')}</div></div>`).join('');
  };
  try {
    const [sets, series] = await Promise.all([getSets(), getSeries()]);
    draw(sets, series);
    $('#setFilter')?.addEventListener('input', e => { route.q = e.target.value; draw(sets, series); });
  } catch { $('#setList').innerHTML = '<p class="muted">Sem conexão. Abra de novo quando estiver online.</p>'; }
}
function ring(pct, done) {
  const r = 34, len = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><defs><linearGradient id="foilRing"><stop offset="0" stop-color="#3fd8ff"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ff5a2e"/></linearGradient></defs>
    <circle cx="40" cy="40" r="${r}" stroke="#2a3670"/><circle cx="40" cy="40" r="${r}" stroke="${done ? '#ffc23d' : 'url(#foilRing)'}" stroke-linecap="round" stroke-dasharray="${len * pct / 100} ${len}"/>
    <text x="40" y="40">${Math.floor(pct)}</text></svg>`;
}
async function renderSet() {
  const back = '<button class="back" type="button" data-back>‹ Sets</button>';
  view.innerHTML = `${back}<p class="muted">Abrindo set…</p>`;
  let s, meta;
  try { [s, meta] = await Promise.all([getSet(route.setId), getSets().catch(() => [])]); }
  catch { view.innerHTML = `${back}<p class="muted">Não consegui abrir este set. Verifique a conexão.</p>`; return; }
  if (route.tab !== 'sets' || route.setId !== s.id) return;
  const info = meta.find(x => x.id === s.id), logo = info && setArt(info);
  const scope = store.scope[s.id] || 'all';
  // Sets ocidentais: dá para ver só a edição brasileira ou só a inglesa (arte e "tenho" daquela edição).
  const editions = hasEditions({ id: s.id, setId: s.id }), ed = editions ? route.setEd || 'all' : 'all';
  const owns = c => { const o = store.cards[c.id]; return !!o && (ed === 'all' || qtyIn(o, ed) > 0 || !!o.graded?.length); };
  const inScope = s.cards.filter(c => scope === 'all' || (parseInt(c.localId, 10) <= s.official && /^\d+$/.test(c.localId)));
  const have = inScope.filter(owns).length;
  const shown = inScope.filter(c => route.filter === 'all' || (route.filter === 'have') === owns(c));
  const left = inScope.length - have, pct = inScope.length ? have / inScope.length * 100 : 0;
  const value = list().filter(c => c.setId === s.id).reduce((a, c) => a + valueOf(c), 0);
  view.innerHTML = `${back}
    <div class="set-hero">${logo ? `<img alt="" src="${esc(logo)}" data-next="${info ? artFallback(info) : ''}" data-hide-broken>` : ''}<h1>${esc(s.name)}</h1>
      <div class="stats">${ring(pct, !left)}<p><b>${money(value)}</b><span class="muted">${left ? `Faltam ${left} de ${inScope.length}` : 'Set completo'}</span></p></div></div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Quais cartas contam">
        <button type="button" data-scope="all" class="${scope === 'all' ? 'on' : ''}">Completo (${s.cards.length})</button>
        <button type="button" data-scope="base" class="${scope === 'base' ? 'on' : ''}">Base (${s.official})</button></div>
      ${editions ? `<div class="seg" role="group" aria-label="Edição">${[['all', 'Todas'], ['pt', 'Brasileira'], ['en', 'Inglês']].map(([k, l]) => `<button type="button" data-set-ed="${k}" class="${ed === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="seg" role="group" aria-label="Filtro">
        ${[['all', 'Todas'], ['have', 'Tenho'], ['miss', 'Faltam']].map(([k, l]) => `<button type="button" data-filter="${k}" class="${route.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${shown.length ? `<div class="binder">${shown.map(c => pocket(c, ed, owns(c))).join('')}</div>` : '<p class="muted">Nada para mostrar neste filtro.</p>'}`;
}
function pocket(c, ed = 'all', has = !!store.cards[c.id]) {
  const own = store.cards[c.id], star = store.profile.showcase.includes(c.id), slab = own?.graded?.[0];
  const n = !own ? 0 : ed === 'all' ? qtyOf(own) : qtyIn(own, ed);
  return `<button type="button" class="pocket${has ? '' : ' missing'}" data-card="${esc(c.id)}" aria-label="${esc(c.name)} ${esc(c.localId)}${has ? '' : ', faltando'}">
    ${imgTag(ed === 'all' ? c : artFor(c, ed))}<span class="tag">${esc(c.localId)}</span>${n > 1 ? `<span class="qty">×${n}</span>` : ''}${star ? '<span class="star" aria-hidden="true">★</span>' : ''}${own ? hotBadge(own) : ''}${slab ? `<span class="slab-tag">${esc(gradeLabel(slab))}</span>` : ''}</button>`;
}

/* ---------- Minhas cartas (celular) ---------- */
const MINE_TABS = [['recent', 'Recentes'], ['dupes', 'Repetidas'], ['wish', 'Desejos'], ['hot', 'Valorização'], ['all', 'Todas']];
function dupeRow(c) {
  const keep = keptCopy(c), spare = spareCopies(c), copies = copiesOf(c);
  return `<article class="dupe">
    <button type="button" class="dupe-card" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}<span class="qty">×${qtyOf(c)}</span></button>
    <div class="dupe-info"><b>${esc(c.name)}</b><span class="muted small">${esc(c.setName)} · nº ${esc(c.localId)}</span>
      <label class="small muted">Fica na coleção
        <select class="field keep-select" data-keep="${esc(c.id)}"><option value="">Automático: ${esc(keep.label)} (${money(keep.unit)})</option>
          ${copies.map(x => `<option value="${esc(x.key)}"${c.keep === x.key ? ' selected' : ''}>${esc(x.label)} (${money(x.unit)})</option>`).join('')}</select></label>
      <span class="spare">Repetidas: ${spare.map(x => `<span class="spare-pill">${x.n}× ${esc(x.label)} <span class="muted">${money(x.unit)}</span></span>`).join(' ')}</span></div>
    <b class="dupe-value num">${money(spareValue(c))}</b></article>`;
}
const addedDay = t => {
  const d = new Date(t), today = new Date(), y = new Date(Date.now() - 864e5), same = (a, b) => a.toDateString() === b.toDateString();
  return same(d, today) ? 'Hoje' : same(d, y) ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
function renderMine() {
  const tab = route.mview || 'recent', cards = list();
  const seg = `<div class="seg" role="tablist" aria-label="Minhas cartas">${MINE_TABS.map(([k, l]) => `<button type="button" role="tab" data-mine="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const grid = list_ => `<div class="binder">${list_.map(c => pocket(c)).join('')}</div>`;
  let body;
  if (!cards.length && !['wish', 'binders', 'sealed'].includes(tab)) body = '<div class="empty"><h2>Nenhuma carta ainda</h2><p class="muted">Escaneie ou busque cartas para começar.</p><button class="btn" type="button" data-scan>Escanear carta</button></div>';
  else if (tab === 'recent') {
    const last = [...cards].sort((a, b) => b.addedAt - a.addedAt).slice(0, 100), groups = new Map();
    for (const c of last) { const k = addedDay(c.addedAt); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    body = `<p class="muted small">As ${last.length} últimas cartas adicionadas.</p>${[...groups].map(([k, g]) => `<div class="section"><h2 class="day">${esc(k)} <span class="muted small">${plural(g.length, 'carta', 'cartas')}</span></h2>${grid(g)}</div>`).join('')}`;
  } else if (tab === 'dupes') {
    const d = cards.filter(c => qtyOf(c) > 1).sort((a, b) => spareValue(b) - spareValue(a));
    const extra = d.reduce((s, c) => s + qtyOf(c) - 1, 0), extraValue = d.reduce((s, c) => s + spareValue(c), 0);
    body = d.length ? `<div class="stat-grid"><div class="stat"><b>${d.length}</b><span>Cartas com repetidas</span></div><div class="stat"><b>${extra}</b><span>Cópias sobrando</span></div><div class="stat"><b>${money(extraValue)}</b><span>Valor das repetidas</span></div></div>
      <p class="muted small">De cada carta, fica na coleção a cópia mais valiosa; as de menor valor contam como repetidas. Se preferir guardar outra, escolha em "Fica na coleção".</p>
      <div class="dupes">${d.map(dupeRow).join('')}</div>`
      : '<div class="empty"><h2>Nenhuma repetida</h2><p class="muted">Quando você tiver mais de uma cópia da mesma carta, ela aparece aqui.</p></div>';
  } else if (tab === 'wish') body = window.Wish?.page() || '';
  else if (tab === 'binders') body = window.Binders?.page() || '';
  else if (tab === 'sealed') body = window.Binders?.sealedPage() || '';
  else if (tab === 'hot') {
    const h = cards.map(c => [c, potential(c)]).filter(([, p]) => p?.high).sort((a, b) => b[1].score - a[1].score || valueOf(b[0]) - valueOf(a[0])).map(([c]) => c);
    body = `<p class="muted small">Cartas com sinais de valorização: preço subindo, raridade de alta demanda, Pokémon procurado e set mais antigo. Toque numa carta para ver os motivos. Indicador automático, não é recomendação de investimento.</p>
      ${h.length ? grid(h) : '<div class="empty"><h2>Nenhuma por enquanto</h2><p class="muted">Os sinais de preço chegam com a atualização diária dos preços.</p></div>'}`;
  } else body = grid([...cards].sort((a, b) => unitValue(b) - unitValue(a)));
  view.innerHTML = `<button class="back" type="button" data-tab="home">‹ Coleção</button>
    <div class="page-head"><div><h1>Minhas cartas</h1><span class="muted">${plural(copiesCount(), 'carta', 'cartas')} · ${money(collectionValue())}</span></div></div>${seg}${body}`;
}

/* ---------- Busca ---------- */
/* ---------- Explorar: todas as cartas ---------- */
const PAGE = 60;
// Como norm(), mas mantém letras de qualquer alfabeto: buscas em japonês também funcionam.
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const explore = { set: '', kind: '', own: '', shown: PAGE };
// O catálogo vem de data/catalog.json (tools/build-catalog.js) e fica no aparelho depois da primeira vez.
const getCatalog = () => once('catalog', async () => {
  const [cat, sets] = await Promise.all([getJSON('data/catalog.json'), getSets().catch(() => [])]);
  const rank = new Map(sets.map((s, i) => [s.id, i])), names = new Map(sets.map(s => [s.id, s.name]));
  return cat.cards.map(([id, name, p, pt]) => {
    const setId = id.replace(/-[^-]+$/, ''), localId = id.slice(id.lastIndexOf('-') + 1);
    const base = cat.paths[p], image = p < 0 ? '' : base.startsWith('http') ? base : `https://assets.tcgdex.net/${base}/${localId}`;
    const setName = names.get(setId) || setId;
    return { id, localId, name: preferName(pt, name), nameEn: name, image, imageEn: image.replace('/pt/', '/en/'), setId, setName,
      rank: rank.has(setId) ? rank.get(setId) : 1e6, num: parseInt(localId, 10) || 0, hay: fold(`${name} ${pt || ''} ${setName} ${setId}`) };
  }).sort((a, b) => a.rank - b.rank || a.num - b.num || a.localId.localeCompare(b.localId));
});
const catalogImages = () => once('catalogImages', async () => new Map((await getCatalog()).filter(c => c.image).map(c => [c.id, c.image])));
// Cada palavra precisa aparecer; número puro também casa com o número da carta ("charizard 125").
function exploreHits(all) {
  const words = fold(route.q).split(' ').filter(Boolean);
  return all.filter(c => (!explore.set || c.setId === explore.set)
    && (!explore.kind || explore.kind === regionOf(c.id))
    && (!explore.own || (explore.own === 'have') === !!store.cards[c.id])
    && words.every(w => /^\d+$/.test(w) ? c.num === +w || c.hay.includes(w) : c.hay.includes(w)));
}
function catalogPocket(c) {
  const own = store.cards[c.id];
  return `<button type="button" class="pocket catalog" data-card="${esc(c.id)}" aria-label="${esc(c.name)}, ${esc(c.setName)} ${esc(c.localId)}${own ? ', na coleção' : ''}">
    ${imgTag(c)}<span class="tag">${esc(c.localId)}</span>${own ? `<span class="have">✓${qtyOf(own) > 1 ? ' ' + qtyOf(own) : ''}</span>` : ''}${tagOf(c.id) ? `<span class="lang-tag">${tagOf(c.id)}</span>` : ''}</button>`;
}
async function renderSearch() {
  view.innerHTML = `<div class="page-head"><div><h1>Explorar</h1><span class="muted" id="exploreCount">Carregando o catálogo…</span></div></div>
    <form id="exploreForm" class="explore-bar" role="search">
      <input id="exploreQ" class="field" type="search" enterkeyhint="search" placeholder="Nome ou número, como Charizard 125" aria-label="Buscar carta" value="${esc(route.q)}" autocomplete="off">
      <select id="exploreSet" class="field" aria-label="Set"><option value="">Todos os sets</option></select>
      <select id="exploreKind" class="field" aria-label="Edição"><option value="">Todas as edições</option><option value="west"${explore.kind === 'west' ? ' selected' : ''}>Ocidentais</option><option value="ja"${explore.kind === 'ja' ? ' selected' : ''}>Japonesas</option><option value="zh"${explore.kind === 'zh' ? ' selected' : ''}>Chinesas</option></select>
      <select id="exploreOwn" class="field" aria-label="Coleção"><option value="">Todas as cartas</option><option value="have"${explore.own === 'have' ? ' selected' : ''}>Só as que tenho</option><option value="miss"${explore.own === 'miss' ? ' selected' : ''}>Só as que faltam</option></select>
    </form>
    <div id="exploreOut" class="section"></div>
    <button class="btn alt" type="button" data-manual>Não achou? Cadastrar carta manualmente</button>`;
  try {
    const [all, sets] = await Promise.all([getCatalog(), getSets().catch(() => [])]);
    if (route.tab !== 'search') return;
    const pick = $('#exploreSet');
    pick.innerHTML += sets.map(s => `<option value="${esc(s.id)}"${explore.set === s.id ? ' selected' : ''}>${esc(s.name)}${tagOf(s.id) ? ` (${tagOf(s.id)})` : ''}</option>`).join('');
    drawExplore(all);
  } catch { $('#exploreCount').textContent = 'Não consegui carregar o catálogo. Verifique a conexão.'; }
}
async function drawExplore(all) {
  all ??= await getCatalog();
  const out = $('#exploreOut'); if (!out) return;
  const hits = exploreHits(all), page = hits.slice(0, explore.shown);
  $('#exploreCount').textContent = route.q || explore.set || explore.kind || explore.own
    ? `${hits.length.toLocaleString('pt-BR')} ${hits.length === 1 ? 'carta encontrada' : 'cartas encontradas'}`
    : `${all.length.toLocaleString('pt-BR')} cartas no catálogo, das mais novas às mais antigas`;
  out.innerHTML = page.length ? `<div class="binder">${page.map(catalogPocket).join('')}</div>
    ${hits.length > page.length ? `<button class="btn alt" type="button" data-more>Mostrar mais ${Math.min(PAGE, hits.length - page.length)}</button>` : ''}`
    : `<div class="empty"><h2>Nenhuma carta encontrada</h2><p class="muted">Confira a grafia, tente o nome em inglês ou tire algum filtro.</p>
      <button class="btn alt" type="button" data-report="missing" data-report-name="${esc(route.q)}">Avisar que esta carta está faltando</button></div>`;
}
// A Busca pela internet continua servindo ao scanner quando a arte não está no banco.
async function searchCards(q) {
  const param = encodeURIComponent(q);
  const [pt, en, ja] = await Promise.all([
    getJSON(`${API}/pt/cards?name=${param}&pagination:itemsPerPage=60`).catch(() => []),
    getJSON(`${API}/en/cards?name=${param}&pagination:itemsPerPage=60`).catch(() => []),
    getJSON(`${API}/ja/cards?name=${param}&pagination:itemsPerPage=60`).catch(() => []),
  ]);
  const seen = new Map();
  for (const c of [...pt, ...en, ...ja.map(c => ({ ...c, id: 'ja:' + c.id }))]) if (!seen.has(c.id) && !isPocket(c.id.replace('ja:', '').split('-')[0])) seen.set(c.id, { ...c, imageEn: c.image });
  return [...seen.values()].reverse();
}

/* ---------- Perfil ---------- */
const ICONS = {
  card: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="m10 14 2-4 2 4"/>',
  stack: '<path d="M4 8h13v12H4zM8 8V4h12v12h-3"/>',
  crown: '<path d="m3 8 4 5 5-8 5 8 4-5-2 12H5z"/>',
  gem: '<path d="M7 4h10l4 6-9 11L3 10zM3 10h18"/>',
  flag: '<circle cx="12" cy="12" r="4"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
  star: '<path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2L6.400 20l1.300-6.200L3 9.500l6.300-.700z"/>',
};
function achievements(completed) {
  const cards = list(), copies = copiesCount(), brl = v => v * (store.fx?.BRL || 5.4), total = brl(collectionValue());
  return [
    ['card', 'Primeira carta', 'Adicione sua primeira carta', copies >= 1],
    ['stack', 'Colecionador', 'Tenha 50 cartas', copies >= 50],
    ['stack', 'Pasta cheia', 'Tenha 250 cartas', copies >= 250],
    ['stack', 'Mestre das pastas', 'Tenha 1.000 cartas', copies >= 1000],
    ['crown', 'Set completo', 'Complete um set inteiro', completed >= 1],
    ['crown', 'Tricampeão', 'Complete 3 sets', completed >= 3],
    ['gem', 'Achado raro', 'Tenha uma carta de R$ 100', cards.some(c => brl(valueOf(c) / qtyOf(c)) >= 100)],
    ['gem', 'Tesouro', 'Coleção de R$ 1.000', total >= 1000],
    ['gem', 'Cofre', 'Coleção de R$ 10.000', total >= 10000],
    ['flag', 'Além-mar', 'Tenha uma carta japonesa ou chinesa', cards.some(c => isAsian(c.id))],
    ['star', 'Curador', 'Monte a vitrine com 3 cartas', showcaseCards().length >= 3],
  ];
}
const showcaseCards = () => store.profile.showcase.map(id => store.cards[id]).filter(Boolean);
function badge([icon, name, hint, won]) {
  return `<div class="badge${won ? '' : ' locked'}"><i><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg></i><div><b>${name}</b><span>${won ? 'Conquistada' : hint}</span></div></div>`;
}
function showcaseBlock() {
  const items = showcaseCards(), [first, ...rest] = items;
  if (!first) return `<div class="empty"><h2>Monte sua vitrine</h2><p class="muted">Escolha até ${SHOWCASE_MAX} cartas para deixar em destaque no seu perfil.</p>
    ${list().length ? '<button class="btn" type="button" data-pick>Escolher cartas</button>' : '<button class="btn" type="button" data-scan>Escanear a primeira carta</button>'}</div>`;
  const slots = rest.map(c => `<button class="show-slot" type="button" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}</button>`);
  if (items.length < SHOWCASE_MAX) slots.push('<button class="show-slot add" type="button" data-pick aria-label="Adicionar à vitrine">+</button>');
  return `<div class="showcase"><button class="star-card" type="button" data-card="${esc(first.id)}">
      <span class="holo idle">${imgTag(first, 'high', first.name)}</span>
      <span><b>${esc(first.name)}</b><br><span class="muted small">${esc(first.setName)} · ${money(valueOf(first) / qtyOf(first))}</span></span></button>
    <div class="showcase-grid">${slots.join('')}</div></div>`;
}
/* ---------- Estatísticas ---------- */
// Descobre o Pokémon de cada carta pelo nome (Charizard ex, Mega Lucario, リザードン, 噴火龍…) com data/species.json.
const getSpecies = () => once('species', async () => {
  const rows = await getJSON('data/species.json');
  const latin = new Map(), other = [], byDex = new Map();
  for (const [dex, en, ...alt] of rows) {
    latin.set(norm(en), [dex, en]); byDex.set(dex, en);
    for (const a of alt) if (a.length > 1) other.push([a, dex, en]);
  }
  other.sort((a, b) => b[0].length - a[0].length);
  return { latin, other, byDex, total: rows.length };
});
// Resumo do gosto da coleção, publicado no perfil público para a aba Comunidade: Pokémon e sets mais presentes.
async function tasteOf() {
  const sp = await getSpecies().catch(() => null), species = new Map(), sets = new Map();
  for (const c of list()) {
    const n = qtyOf(c);
    if (c.setId !== 'custom') sets.set(c.setId, (sets.get(c.setId) || 0) + n);
    const hit = sp && (speciesOf(c.nameEn || c.name, sp) || speciesOf(c.name, sp));
    if (hit) species.set(hit[0], (species.get(hit[0]) || 0) + n);
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(x => x[0]);
  return { favs: top(species, 15), sets: top(sets, 15) };
}
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
function speciesOf(name, sp) {
  const words = norm(name).split(' ');
  for (let n = 3; n >= 1; n--) for (let i = 0; i + n <= words.length; i++) {
    const hit = sp.latin.get(words.slice(i, i + n).join(' '));
    if (hit) return hit;
  }
  if (/[^\x00-\x7f]/.test(name)) for (const [a, dex, en] of sp.other) if (name.includes(a)) return [dex, en];
  return null;
}
const GENS = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const bars = (rows, max = rows[0]?.[1] || 1) => `<div class="bars">${rows.map(([label, n, extra = '']) => `<div class="bar-row"><span class="bar-label">${esc(label)}</span>
  <span class="bar"><i style="width:${n ? Math.max(3, n / max * 100) : 0}%"></i></span><b class="num">${n.toLocaleString('pt-BR')}</b>${extra}</div>`).join('')}</div>`;
async function statsBlock() {
  const cards = list();
  if (!cards.length) return '<div class="empty"><h2>Sem dados ainda</h2><p class="muted">Adicione cartas para ver as estatísticas da coleção.</p></div>';
  const sp = await getSpecies().catch(() => null);
  const bySpecies = new Map();
  if (sp) for (const c of cards) {
    const hit = speciesOf(c.nameEn || c.name, sp) || (c.nameEn ? null : speciesOf(c.name, sp)) || speciesOf(c.name, sp);
    if (!hit) continue;
    const e = bySpecies.get(hit[0]) || bySpecies.set(hit[0], { dex: hit[0], name: hit[1], n: 0, best: c, kinds: 0 }).get(hit[0]);
    e.n += qtyOf(c); e.kinds++;
    if (valueOf(c) / qtyOf(c) > valueOf(e.best) / qtyOf(e.best)) e.best = c;
  }
  const species = [...bySpecies.values()].sort((a, b) => b.n - a.n || b.kinds - a.kinds);
  const gens = GENS.map(() => 0);
  for (const e of species) gens[GENS.findIndex(g => e.dex <= g)]++;
  const count = (key, fn = c => qtyOf(c)) => { const m = new Map(); for (const c of cards) { const k = key(c); if (k) m.set(k, (m.get(k) || 0) + fn(c)); } return [...m].sort((a, b) => b[1] - a[1]); };
  const rarities = count(c => c.rarity).slice(0, 8);
  const sets = count(c => c.setName).slice(0, 6);
  const editions = [['Brasileiras', cards.reduce((a, c) => a + (hasEditions(c) ? qtyIn(c, 'pt') : 0), 0)], ['Em inglês', cards.reduce((a, c) => a + (hasEditions(c) ? qtyIn(c, 'en') + (c.graded?.length || 0) : 0), 0)], ['Japonesas', cards.filter(c => isJa(c.id)).reduce((a, c) => a + qtyOf(c), 0)], ['Chinesas', cards.filter(c => isAsian(c.id) && !isJa(c.id)).reduce((a, c) => a + qtyOf(c), 0)]].filter(r => r[1]);
  const variants = new Map();
  for (const c of cards) for (const [k, n] of Object.entries(c.qty || {})) { const l = VARIANTS[variantOfKey(k)]?.label || k; variants.set(l, (variants.get(l) || 0) + n); }
  const graded = cards.reduce((a, c) => a + (c.graded?.length || 0), 0);
  if (graded) variants.set('Graduadas', graded);
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push([d.getFullYear(), d.getMonth(), d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')]); }
  const perMonth = months.map(([y, m, label]) => [label, cards.filter(c => { const d = new Date(c.addedAt); return d.getFullYear() === y && d.getMonth() === m; }).reduce((a, c) => a + qtyOf(c), 0)]);
  const maxMonth = Math.max(1, ...perMonth.map(r => r[1]));
  const top = species.slice(0, 6), copies = copiesCount(), total = collectionValue();
  const priciest = [...cards].sort((a, b) => valueOf(b) / qtyOf(b) - valueOf(a) / qtyOf(a))[0];
  return `<div class="stat-grid">
      <div class="stat"><b>${species.length.toLocaleString('pt-BR')}</b><span>Pokémon diferentes</span></div>
      <div class="stat"><b>${(sp ? species.length / sp.total * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b><span>da Pokédex nacional</span></div>
      <div class="stat"><b>${money(total / Math.max(1, copies))}</b><span>Valor médio por carta</span></div>
      <div class="stat"><b>${new Set(cards.map(c => c.setId)).size}</b><span>Sets diferentes</span></div></div>
    ${top.length ? `<div class="section"><h2>Seus Pokémon favoritos</h2><p class="muted small">Os que mais aparecem na sua coleção.</p>
      <div class="fav-grid">${top.map((e, i) => `<button type="button" class="fav" data-card="${esc(e.best.id)}"><span class="frame">${imgTag(e.best, 'low', e.name)}</span>
        <span><b>${i === 0 ? '👑 ' : ''}${esc(e.name)}</b><span class="muted small">${plural(e.n, 'carta', 'cartas')} · nº ${String(e.dex).padStart(4, '0')}</span></span></button>`).join('')}</div></div>` : ''}
    <div class="section"><h2>Pokédex por geração</h2>${bars(gens.map((n, i) => [`${i + 1}ª geração`, n, `<span class="muted small">/${GENS[i] - (GENS[i - 1] || 0)}</span>`]), Math.max(...GENS.map((g, i) => g - (GENS[i - 1] || 0))))}</div>
    <div class="section"><h2>Cartas adicionadas por mês</h2><div class="months">${perMonth.map(([l, n]) => `<div class="month"><span class="col"><i style="height:${Math.max(2, n / maxMonth * 100)}%"></i></span><b class="num">${n}</b><span class="muted small">${esc(l)}</span></div>`).join('')}</div></div>
    ${rarities.length ? `<div class="section"><h2>Raridades</h2>${bars(rarities)}</div>` : ''}
    <div class="section"><h2>Sets com mais cartas</h2>${bars(sets)}</div>
    <div class="section"><h2>Acabamentos</h2>${bars([...variants].sort((a, b) => b[1] - a[1]))}</div>
    ${editions.length > 1 ? `<div class="section"><h2>Edições</h2>${bars(editions)}</div>` : ''}
    ${priciest ? `<div class="section"><h2>Carta mais valiosa</h2><div class="rail">${railCard(priciest, money(valueOf(priciest) / qtyOf(priciest)))}</div></div>` : ''}`;
}

async function renderProfile() {
  const cards = list(), p = store.profile, owned = ownedBySet();
  const draw = completed => {
    const list_ = achievements(completed), won = list_.filter(a => a[3]).length;
    const ptab = route.ptab || 'showcase', handle = window.Social?.handle?.();
    view.innerHTML = `${bannerHtml(p.banner, bannerImage())}
      <div class="profile-actions"><button class="icon-btn" type="button" data-tab="settings" aria-label="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button></div>
      <div class="identity"><span class="ring-avatar" ${ringAttrs(p.ring)}>${avatar()}</span><h1>${esc(trainerName())}</h1>
        ${handle ? `<span class="muted">@${esc(handle)}</span>` : ''}${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</div>
      <div class="row-btns"><button class="btn alt" type="button" data-edit-profile>Editar perfil</button><button class="btn alt" type="button" data-personalize>Personalizar</button></div>
      <div class="stat-grid">
        <div class="stat"><b>${money(collectionValue())}</b><span>Valor da coleção</span></div>
        <div class="stat"><b>${copiesCount()}</b><span>Cartas</span></div>
        <div class="stat"><b>${completed}</b><span>Sets completos</span></div>
        <div class="stat"><b>${won}/${list_.length}</b><span>Conquistas</span></div></div>
      <div class="seg" role="tablist" aria-label="Seções do perfil">${[['showcase', 'Vitrine'], ['stats', 'Estatísticas'], ['badges', 'Conquistas']].map(([k, l]) => `<button type="button" role="tab" data-ptab="${k}" aria-selected="${ptab === k}" class="${ptab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="ptab">${ptab === 'showcase' ? `<div class="section"><div class="section-head"><h2>Vitrine</h2>${showcaseCards().length ? '<button type="button" data-pick>Editar</button>' : ''}</div>${showcaseBlock()}</div>`
        : ptab === 'badges' ? `<div class="section"><div class="badges">${[...list_].sort((a, b) => b[3] - a[3]).map(badge).join('')}</div></div>`
        : '<p class="muted section">Calculando…</p>'}</div>`;
    if (ptab === 'stats') statsBlock().then(html => { if (route.tab === 'profile' && route.ptab === 'stats' && $('#ptab')) $('#ptab').innerHTML = `<div class="section">${html}</div>`; });
  };
  draw(0);
  if (!cards.length) return;
  const sets = await getSets().catch(() => []);
  const completed = sets.filter(s => s.total && owned[s.id] >= s.total).length;
  if (completed && route.tab === 'profile') draw(completed);
}
function pickShowcase() {
  const cards = [...list()].sort((a, b) => unitValue(b) - unitValue(a));
  openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Escolha até ${SHOWCASE_MAX} cartas</h2>
    <p class="muted small">A primeira escolhida fica em destaque.</p>
    <div class="picker">${cards.map(c => `<button type="button" class="pocket${store.profile.showcase.includes(c.id) ? ' on' : ''}" data-show="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c)}</button>`).join('')}</div>
    <button class="btn" type="button" data-close>Concluir</button>`);
}
function toggleShowcase(id) {
  const s = store.profile.showcase = showcaseCards().map(c => c.id);
  if (s.includes(id)) s.splice(s.indexOf(id), 1);
  else if (s.length >= SHOWCASE_MAX) { toast(`A vitrine aceita até ${SHOWCASE_MAX} cartas`); return false; }
  else s.push(id);
  saveProfile();
  return true;
}
function editProfile() {
  const p = store.profile;
  openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Editar perfil</h2>
    <form id="profileForm" class="section">
      <div class="identity" style="margin:0"><span class="ring-avatar" id="pPreview" ${ringAttrs(p.ring)}>${avatar()}</span></div>
      <label class="btn alt" for="pPhoto">Trocar foto</label>
      <input id="pPhoto" type="file" accept="image/*" hidden>
      ${p.photo ? '<button class="btn alt" type="button" data-photo-off>Remover foto</button>' : ''}
      <input id="pName" class="field" maxlength="30" placeholder="Seu nome de treinador" aria-label="Nome" value="${esc(p.name || accountUser()?.name || '')}" autocomplete="off">
      <textarea id="pBio" class="field" maxlength="120" placeholder="Uma frase sobre sua coleção" aria-label="Sobre você">${esc(p.bio || '')}</textarea>
      <div class="two"><input id="pCity" class="field" maxlength="40" placeholder="Cidade (opcional)" aria-label="Cidade" value="${esc(p.city || '')}" autocomplete="address-level2">
        <select id="pState" class="field" aria-label="Estado"><option value="">Estado</option>${UFS.map(u => `<option${p.state === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
      <p class="muted small">Cidade e estado são opcionais e aparecem no seu perfil público. Servem para a aba Comunidade sugerir colecionadores perto de você.</p>
      <button class="btn" type="submit">Salvar perfil</button></form>`);
}
let pendingPhoto;
async function squarePhoto(file) {
  const bmp = await createImageBitmap(file), side = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = 256;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  return c.toDataURL('image/jpeg', .78);
}

/* ---------- Ajustes ---------- */
function renderSettings() {
  const when = store.pricedAt ? new Date(store.pricedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda não feita';
  view.innerHTML = `<button class="back" type="button" data-tab="profile">‹ Perfil</button><h1>Ajustes</h1>
    <div class="settings-grid">
    <div class="panel section" id="account"></div>
    <div class="panel"><h2>Aparência</h2>
      <div class="seg" role="group" aria-label="Tema">${[['auto', 'Automático'], ['dark', 'Escuro'], ['light', 'Claro']].map(([k, l]) => `<button type="button" data-theme-set="${k}" class="${(store.theme || 'auto') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="muted small">O modo escuro gasta menos bateria em telas OLED, como as da maioria dos iPhones recentes. No automático, o app segue o tema do aparelho.</p></div>
    ${window.Social?.ownBlock() || ''}
    <div class="panel"><h2>Ajuda</h2>
      <button class="btn alt" type="button" data-tab="help">Perguntas frequentes e reportar problema</button>
      ${window.Help?.adminButton() || ''}</div>
    <div class="panel"><h2>Nomes das cartas e sets</h2>
      <div class="seg" role="group" aria-label="Idioma dos nomes">${[['pt', 'Português'], ['en', 'English']].map(([k, l]) => `<button type="button" data-names="${k}" class="${(store.namesEn ? 'en' : 'pt') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="muted small">Cartas japonesas e chinesas mantêm o nome original. Quando a base não tem a tradução em português, aparece o nome em inglês.</p></div>
    <div class="panel"><h2>Edição das cartas</h2>
      <p class="muted small">Ao adicionar uma carta ocidental, ela entra como:</p>
      <div class="seg" role="group" aria-label="Edição padrão">${EDITIONS.map(([k, l]) => `<button type="button" data-edition-default="${k}" class="${store.edition === k ? 'on' : ''}">${l.replace('Edição ', '')}</button>`).join('')}</div>
      <label class="small muted" for="ptFactor">Valor das cartas brasileiras</label>
      <select id="ptFactor" class="field">${[1, .9, .8, .7, .6, .5, .4, .3, .2].map(f => `<option value="${f}"${store.ptFactor === f ? ' selected' : ''}>${f === 1 ? 'Igual ao preço em inglês' : `${pct(f)} do preço em inglês`}</option>`).join('')}</select>
      <p class="muted small">Não existe uma base pública de preços do mercado brasileiro. A edição brasileira usa o preço em inglês ajustado por este fator, ou o valor que você definir em cada carta.</p>
      ${(() => { const en = list().filter(hasEditions).reduce((s, c) => s + qtyIn(c, 'en'), 0); return en ? `<button class="btn alt" type="button" data-convert-pt>Marcar minhas ${plural(en, 'cópia', 'cópias')} em inglês como brasileiras</button>
      <p class="muted small">Use se as cartas que você já tinha são brasileiras: antes desta versão o app não separava as edições.</p>` : ''; })()}</div>
    <div class="panel"><h2>Moeda</h2>
      <div class="seg" role="group" aria-label="Moeda">${['BRL', 'USD', 'EUR'].map(c => `<button type="button" data-currency="${c}" class="${store.currency === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      <p class="muted small">Os preços vêm da TCGplayer (EUA) e da Cardmarket (Europa) e são convertidos pela cotação do dia. O mercado brasileiro pode praticar valores diferentes.${store.fx ? ` US$ 1 = R$ ${store.fx.BRL.toFixed(2).replace('.', ',')}.` : ''}</p></div>
    <div class="panel"><h2>Preços</h2>
      <button id="refreshPrices" class="btn alt" type="button">Atualizar preços da coleção</button>
      <p class="muted small">Os preços se atualizam sozinhos uma vez por dia. Última atualização: ${when}.</p></div>
    <div class="panel"><h2>Backup</h2>
      <button id="exportBtn" class="btn alt" type="button">Exportar coleção</button>
      <button id="importBtn" class="btn alt" type="button">Importar backup</button>
      <p class="muted small">Sem conta, a coleção fica só neste iPhone. Exporte de vez em quando e guarde o arquivo no iCloud Drive.</p></div>
    </div>
    <p class="muted small">Boosterz está em versão beta. Dados de cartas: TCGdex. Reconhecimento feito no próprio aparelho. Projeto pessoal, sem vínculo com The Pokémon Company ou Nintendo.</p>`;
  window.Sync?.paint();
}

// Troca o idioma dos nomes: recarrega as listas e renomeia as cartas já salvas pelo catálogo.
async function setNameLanguage(en) {
  if (!!store.namesEn === en) return;
  store.namesEn = en;
  memo.clear();
  try {
    const [all, sets] = await Promise.all([getCatalog(), getSets()]);
    const byId = new Map(all.map(c => [c.id, c])), setNames = new Map(sets.map(s => [s.id, s.name]));
    for (const c of list()) {
      if (c.setId === 'custom') continue;
      if (byId.get(c.id)) c.name = byId.get(c.id).name;
      if (setNames.get(c.setId)) c.setName = setNames.get(c.setId);
    }
  } catch { toast('Sem conexão: os nomes mudam quando a internet voltar'); }
  save();
  render();
}

/* ---------- Painel da carta ---------- */
function potentialBlock(card) {
  const pot = potential({ ...card, ...(store.cards[card.id] || {}), prices: card.prices || store.cards[card.id]?.prices });
  if (!pot?.why.length) return '';
  return `<details class="potential${pot.high ? ' high' : ''}"${pot.high ? ' open' : ''}><summary>${pot.high ? '📈 Alto potencial de valorização' : 'Potencial de valorização: ' + (pot.score >= 2 ? 'médio' : 'baixo')}</summary>
    <ul>${pot.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <p class="muted small">Indicador automático com base em preço, raridade e procura. Não é recomendação de investimento.</p></details>`;
}
function cardExtras(card) {
  const own = store.cards[card.id], on = store.profile.showcase.includes(card.id);
  const liga = `<a class="btn alt" href="${esc(ligaUrl(card))}" target="_blank" rel="noopener">Ver na Liga Pokémon</a>`;
  if (!own) return `<div id="extras"><button class="btn" type="button" data-add-card>Adicionar à coleção · ${esc((VARIANTS[card.variants?.[0]] || VARIANTS.normal).label)}</button>${liga}</div>`;
  return `<div id="extras"><div class="split"><button class="btn alt${on ? ' toggled' : ''}" type="button" data-star>${on ? '★ Na vitrine' : '☆ Pôr na vitrine'}</button>${liga.replace('Ver na Liga Pokémon', 'Liga Pokémon')}</div>
    ${(() => { const pt = editionNow(card) === 'pt', mine = pt ? own.customPt : own.custom; return `<details${mine != null ? ' open' : ''}><summary>Definir meu valor${hasEditions(card) ? pt ? ' (edição brasileira)' : ' (edição em inglês)' : ''}</summary><form id="valueForm" class="value-form"><label for="valueInput" class="small muted">Valor por carta (R$)</label>
    <input id="valueInput" class="field" inputmode="decimal" autocomplete="off" placeholder="Usar preço automático" value="${esc(brlText(mine))}">`; })()}
    <button class="btn alt" type="submit">Salvar valor</button></form></details></div>`;
}
function manualForm() {
  openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Cadastrar carta</h2><form id="manualForm" class="section">
    <input id="mName" class="field" placeholder="Nome, como Mega Zeraora ex" aria-label="Nome" autocomplete="off" required>
    <input id="mSet" class="field" placeholder="Set, como Promos MEP" aria-label="Set" autocomplete="off">
    <input id="mNumber" class="field" placeholder="Número, como 089" aria-label="Número" autocomplete="off">
    <input id="mValue" class="field" inputmode="decimal" placeholder="Valor em R$ (opcional)" aria-label="Valor em reais" autocomplete="off">
    <label class="btn alt" for="mPhoto" id="mPhotoLabel">Adicionar foto (opcional)</label>
    <input id="mPhoto" type="file" accept="image/*" hidden>
    <button class="btn" type="submit">Adicionar à coleção</button></form>`);
}
// Foto pequena: ela viaja junto com a carta para a nuvem.
async function photoData(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 320 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .7);
}
async function saveManual() {
  const name = $('#mName').value.trim(); if (!name) return;
  const file = $('#mPhoto').files[0];
  const image = file ? await photoData(file).catch(() => '') : '';
  const id = 'custom:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const card = { id, localId: $('#mNumber').value.trim() || '—', name, image, imageEn: image, rarity: '', setId: 'custom', setName: $('#mSet').value.trim() || 'Cartas cadastradas', prices: {}, variants: ['normal'] };
  setQty(card, 'normal', 1);
  setCustom(id, parseBrl($('#mValue').value));
  toast(`${name} adicionada`);
  closeSheet();
}
/* ---------- Cartas graduadas ---------- */
const GRADERS = ['PSA', 'CGC', 'BGS', 'TAG', 'SGC', 'ACE', 'Outra'];
const GRADES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5', '4', '3', '2', '1', 'Autêntica'];
function gradedBlock(card) {
  const own = store.cards[card.id], list = own?.graded || [], vs = card.variants?.length ? card.variants : ['normal'];
  const rows = list.map(g => `<div class="graded-row"><span class="slab">${esc(gradeLabel(g))}</span>
    <span class="grow"><b>${esc(VARIANTS[g.variant]?.label || '')}</b><span class="muted small">${money(gradedUsd(own, g))}${g.value == null ? ' (preço da carta comum)' : ''}${g.cert ? ` · cert. ${esc(g.cert)}` : ''}</span></span>
    <button class="icon-btn" type="button" data-ungrade="${esc(g.gid)}" aria-label="Remover ${esc(gradeLabel(g))}">✕</button></div>`).join('');
  const raw = own ? rawQty(own) : 0;
  return `<div id="graded" class="section"><div class="section-head"><h2>Graduadas</h2>${list.length ? `<span class="muted small">${list.length}</span>` : ''}</div>${rows}
    <details><summary>+ Adicionar cópia graduada</summary><form id="gradeForm" class="grade-form">
      <div class="two"><label class="small muted">Empresa<select id="gCompany" class="field">${GRADERS.map(x => `<option>${x}</option>`).join('')}</select></label>
        <label class="small muted">Nota<select id="gGrade" class="field">${GRADES.map(x => `<option>${x}</option>`).join('')}</select></label></div>
      <div class="two"><label class="small muted">Variante<select id="gVariant" class="field">${vs.map(v => `<option value="${v}">${VARIANTS[v].label}</option>`).join('')}</select></label>
        <label class="small muted">Valor em R$<input id="gValue" class="field" inputmode="decimal" placeholder="Opcional" autocomplete="off"></label></div>
      <label class="small muted">Número do certificado<input id="gCert" class="field" placeholder="Opcional" autocomplete="off"></label>
      ${raw ? '<label class="check"><input id="gFromRaw" type="checkbox"> É uma cópia que já está na coleção (sai das comuns)</label>' : ''}
      <button class="btn" type="submit">Adicionar graduada</button></form></details></div>`;
}
function refreshCardPanel() {
  if (!sheetCard) return;
  $('#variants') && ($('#variants').innerHTML = variantRows(sheetCard));
  $('#graded') && ($('#graded').outerHTML = gradedBlock(sheetCard));
  $('#extras') && ($('#extras').outerHTML = cardExtras(sheetCard));
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'gradeForm' || !sheetCard) return;
  e.preventDefault();
  const g = { company: $('#gCompany').value, grade: $('#gGrade').value, variant: $('#gVariant').value, value: parseBrl($('#gValue').value), cert: $('#gCert').value.trim() };
  if (!g.cert) delete g.cert;
  addGraded(sheetCard, g, !!$('#gFromRaw')?.checked);
  toast(`${sheetCard.name} ${gradeLabel(g)} adicionada`);
  refreshCardPanel();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ungrade]'); if (!b || !sheetCard) return;
  removeGraded(sheetCard.id, b.dataset.ungrade);
  refreshCardPanel();
});
const EDITIONS = [['pt', 'Edição brasileira'], ['en', 'Edição em inglês']];
const pct = f => `${Math.round(f * 100)}%`;
// Troca a edição no painel aberto: quantidades, valor próprio, rótulo do botão e a arte da carta.
function refreshEditionUi() {
  if (!sheetCard) return;
  const vs = $('#variants'); if (vs) vs.innerHTML = variantRows(sheetCard);
  const x = $('#extras'); if (x) x.outerHTML = cardExtras(sheetCard);
  const l = $('[data-edition-label]'); if (l) l.textContent = editionNow(sheetCard) === 'pt' ? 'BR' : 'EN';
  const art = $('#cardArt'); if (art && hasEditions(sheetCard)) art.innerHTML = imgTag(artFor(sheetCard, editionNow(sheetCard)), 'high', sheetCard.name);
}
window.refreshEditionUi = refreshEditionUi;
function variantRows(card) {
  const mine = store.cards[card.id], own = mine?.qty || {};
  const vs = card.variants.length ? card.variants : ['normal'];
  const lang = editionNow(card), pt = lang === 'pt', other = hasEditions(card) ? qtyIn(mine, pt ? 'en' : 'pt') : 0;
  const toggle = hasEditions(card) ? `<div class="seg edition" role="group" aria-label="Edição da carta">${EDITIONS.map(([k, l]) => `<button type="button" data-edition="${k}" class="${lang === k ? 'on' : ''}" aria-pressed="${lang === k}">${l}</button>`).join('')}</div>
    ${editionSource === 'scan' ? '<p class="small edition-note">Edição identificada pelo texto impresso na carta. Confira antes de adicionar.</p>' : ''}
    ${other ? `<p class="muted small">Você também tem ${plural(other, 'cópia', 'cópias')} na edição ${pt ? 'em inglês' : 'brasileira'}.</p>` : ''}` : '';
  return toggle + vs.map(v => {
    const key = keyOf(v, lang), p = card.prices?.[v], custom = pt ? mine?.customPt : mine?.custom;
    const base = toUsd(p), usd = custom != null ? customUsd(custom) : base == null ? null : pt ? base * store.ptFactor : base;
    const src = [p?.usd != null ? `US$ ${p.usd.toFixed(2)}` : '', p?.eur ? `€ ${p.eur.toFixed(2)}` : ''].filter(Boolean).join(' · ');
    const note = custom != null ? 'seu valor' : pt ? `referência: inglês${store.ptFactor !== 1 ? ` × ${pct(store.ptFactor)}` : ''}` : src;
    return `<div class="variant"><b>${VARIANTS[v].label}</b>
      <div class="stepper"><button type="button" data-step="-1" data-variant="${v}" aria-label="Remover ${VARIANTS[v].label}">−</button><span>${own[key] || 0}</span><button type="button" data-step="1" data-variant="${v}" aria-label="Adicionar ${VARIANTS[v].label}">+</button></div>
      <span class="prices">${usd != null ? `${money(usd)} <span class="small">(${note})</span>` : 'Sem preço disponível'}</span></div>`;
  }).join('');
}
function cardHead(card) {
  const shown = hasEditions(card) ? artFor(card, editionNow(card)) : card;
  return `<div class="card-show"><div class="holo" data-tilt id="cardArt">${imgTag(shown, 'high', card.name)}</div><div class="info"><h2>${esc(card.name)}</h2>
    <span class="muted">${esc(card.setName)}${langLabel(card.id) ? ' · ' + langLabel(card.id) : ''}</span><span class="num small muted">Nº ${esc(card.localId)}</span>
    ${card.rarity ? `<span class="rarity">${esc(card.rarity)}</span>` : ''}</div></div>`;
}
async function showCard(id) {
  openSheet('<p class="muted">Buscando carta e preço…</p>');
  if (route.tab === 'sets' && route.setId && ['pt', 'en'].includes(route.setEd)) sheetLang = route.setEd;
  try {
    const own = store.cards[id];
    sheetCard = own?.setId === 'custom' ? { ...own, variants: ['normal'] } : await getCard(id);
    if (sheet.hidden) return;
    sheet.innerHTML = `<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button>${cardHead(sheetCard)}${window.Photos?.sendButton(sheetCard) || ''}<div id="variants">${variantRows(sheetCard)}</div>${potentialBlock(sheetCard)}${window.Wish?.priceBlock(sheetCard) || ''}${gradedBlock(sheetCard)}${cardExtras(sheetCard)}${window.Wish?.block(sheetCard) || ''}<button class="report-link" type="button" data-report="card">Algo errado com esta carta? Avise a gente</button>`;
  } catch { sheet.innerHTML = '<p>Não consegui carregar esta carta. Verifique a conexão.</p><button class="btn alt" type="button" data-close>Fechar</button>'; }
}

/* ---------- Brilho ao tocar na carta ---------- */
function tilt(e) {
  const el = e.target.closest?.('[data-tilt]'); if (!el) return;
  const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  el.classList.add('live');
  el.style.setProperty('--ry', `${(x - .5) * 22}deg`);
  el.style.setProperty('--rx', `${(.5 - y) * 22}deg`);
  el.style.setProperty('--mx', `${x * 100}%`);
  el.style.setProperty('--my', `${y * 100}%`);
  el.style.setProperty('--shine', '.8');
}
function untilt(e) {
  const el = e.target.closest?.('[data-tilt]'); if (!el) return;
  el.classList.remove('live');
  ['--ry', '--rx', '--shine'].forEach(k => el.style.removeProperty(k));
}
document.addEventListener('pointerdown', tilt);
document.addEventListener('pointermove', tilt);
document.addEventListener('pointerup', untilt);
document.addEventListener('pointercancel', untilt);
document.addEventListener('pointerout', untilt);

/* ---------- Eventos das telas ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.mySets !== undefined) go({ tab: 'sets', setId: null, region: 'mine', q: '' });
  else if (d.mine) go({ tab: 'cards', mview: d.mine, setId: null });
  else if (d.range) { route.range = d.range; render(); }
  else if (d.ptab) { route.ptab = d.ptab; renderProfile(); }
  else if (d.themeSet) { store.theme = d.themeSet; save(); applyTheme(); renderSettings(); }
  else if (d.edition && sheetCard) { sheetLang = d.edition; editionSource = ''; refreshEditionUi(); }
  else if (d.setEd) { route.setEd = d.setEd; renderSet(); }
  else if (d.editionDefault) { store.edition = d.editionDefault; save(); renderSettings(); }
  else if (d.convertPt !== undefined) {
    if (!confirm('Marcar todas as cópias em inglês das suas cartas ocidentais como edição brasileira?')) return;
    const ids = [];
    for (const c of list().filter(hasEditions)) {
      let moved = false;
      for (const [k, n] of Object.entries(c.qty || {})) if (!isPtKey(k)) { c.qty[k + PT] = (c.qty[k + PT] || 0) + n; delete c.qty[k]; moved = true; }
      if (c.custom != null && c.customPt == null) { c.customPt = c.custom; delete c.custom; moved = true; }
      if (moved) { c.updatedAt = Date.now(); ids.push(c.id); }
    }
    save(); window.Sync?.changedAll(ids);
    toast(`${plural(ids.length, 'carta marcada', 'cartas marcadas')} como edição brasileira`);
    renderSettings();
  }
  else if (d.personalize !== undefined) personalize();
  else if (d.banner) { store.profile.banner = d.banner; delete store.profile.bannerCard; saveProfile(); personalize(); }
  else if (d.bannerCard) { store.profile.bannerCard = d.bannerCard; saveProfile(); personalize(); }
  else if (d.ring) { store.profile.ring = d.ring; saveProfile(); personalize(); }
  else if (d.soon) toast(`${d.soon} ainda não chegou à base de cartas. Assim que chegar, aparece aqui.`);
  else if (d.pick !== undefined) pickShowcase();
  else if (d.editProfile !== undefined) { pendingPhoto = undefined; editProfile(); }
  else if (d.show) { if (toggleShowcase(d.show)) b.classList.toggle('on'); }
  else if (d.star !== undefined && sheetCard) { toggleShowcase(sheetCard.id); $('#extras').outerHTML = cardExtras(sheetCard); }
  else if (d.names) setNameLanguage(d.names === 'en');
  else if (d.more !== undefined) { explore.shown += PAGE; drawExplore(); }
  else if (d.addCard !== undefined && sheetCard) {
    setQty(sheetCard, sheetCard.variants[0] || 'normal', 1);
    toast(`${sheetCard.name} adicionada em ${sheetCard.setName}`);
    $('#variants').innerHTML = variantRows(sheetCard);
    $('#extras').outerHTML = cardExtras(sheetCard);
  }
  else if (d.photoOff !== undefined) { pendingPhoto = null; b.remove(); $('#pPreview').innerHTML = '<span class="avatar initials">?</span>'; }
  else if (d.step !== undefined) setTimeout(() => { const x = $('#extras'); if (x && sheetCard) x.outerHTML = cardExtras(sheetCard); const g = $('#graded'); if (g && sheetCard) g.outerHTML = gradedBlock(sheetCard); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
let exploreTimer;
document.addEventListener('input', e => {
  if (e.target.id !== 'exploreQ') return;
  route.q = e.target.value;
  clearTimeout(exploreTimer);
  exploreTimer = setTimeout(() => { explore.shown = PAGE; drawExplore(); }, 120);
});
document.addEventListener('change', e => {
  const key = { exploreSet: 'set', exploreKind: 'kind', exploreOwn: 'own' }[e.target.id];
  if (!key) return;
  explore[key] = e.target.value; explore.shown = PAGE; drawExplore();
});
document.addEventListener('submit', e => { if (e.target.id === 'exploreForm') { e.preventDefault(); $('#exploreQ').blur(); } });
document.addEventListener('change', async e => {
  if (e.target.dataset?.keep) { setKeep(e.target.dataset.keep, e.target.value); renderMine(); return; }
  if (e.target.id === 'ptFactor') { store.ptFactor = +e.target.value; save(); toast('Valor das cartas brasileiras atualizado'); }
  if (e.target.id === 'mPhoto' && e.target.files[0]) $('#mPhotoLabel').textContent = 'Foto escolhida';
  if (e.target.id === 'pPhoto' && e.target.files[0]) {
    pendingPhoto = await squarePhoto(e.target.files[0]).catch(() => undefined);
    if (pendingPhoto) $('#pPreview').innerHTML = `<img class="avatar" src="${pendingPhoto}" alt="">`;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'profileForm') return;
  e.preventDefault();
  const p = store.profile;
  p.name = $('#pName').value.trim();
  p.bio = $('#pBio').value.trim();
  p.city = $('#pCity').value.trim();
  p.state = $('#pState').value;
  if (pendingPhoto === null) delete p.photo;
  else if (pendingPhoto) p.photo = pendingPhoto;
  saveProfile();
  toast('Perfil salvo');
  closeSheet();
});

migrateEditions();
render();
refreshFx();
setTimeout(autoRefreshPrices, 4000);
setInterval(autoRefreshPrices, 36e5);
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoRefreshPrices(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(() => { const s = $('#splash'); s?.classList.add('out'); setTimeout(() => s?.remove(), 400); }, 450);
