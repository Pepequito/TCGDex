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
  const active = route.tab === 'settings' ? 'profile' : route.tab;
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === active));
  if (window.Desk?.render()) return;
  ({ home: renderHome, sets: route.setId ? renderSet : renderSets, search: renderSearch, profile: renderProfile, settings: renderSettings })[route.tab]();
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
function saveProfile() {
  store.profile.updatedAt = Date.now();
  save();
  window.Sync?.changedProfile();
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
}
const dayLabel = d => d.slice(8, 10) + '/' + d.slice(5, 7);
function valueChart() {
  const h = store.history || [];
  if (h.length < 2) return '<p class="muted small">O gráfico da evolução aparece a partir do segundo dia de uso.</p>';
  const vals = h.map(p => p[1]), min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * .12 || max * .05 || 1;
  const W = 320, H = 86, x = i => i / (h.length - 1) * W, y = v => H - 6 - (v - min + pad) / (max - min + 2 * pad) * (H - 12);
  const line = h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const end = h.length - 1;
  return `<div class="chart" id="valueChart">
    <div class="readout" id="chartRead"><b>${money(vals[end])}</b> em ${dayLabel(h[end][0])}</div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução do valor da coleção, de ${money(vals[0])} para ${money(vals[end])}">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd35c" stop-opacity=".28"/><stop offset="1" stop-color="#ffd35c" stop-opacity="0"/></linearGradient></defs>
      <path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#area)"/>
      <path d="${line}" fill="none" stroke="#ffd35c" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <line id="chartCursor" x1="${W}" x2="${W}" y1="0" y2="${H}" stroke="#9aa6c2" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
    </svg>
    <div class="axis"><span>${dayLabel(h[0][0])}</span><span>${dayLabel(h[end][0])}</span></div></div>`;
}
function bindChart() {
  const box = $('#valueChart'); if (!box) return;
  const h = store.history, cursor = $('#chartCursor'), read = $('#chartRead');
  const show = e => {
    const r = box.getBoundingClientRect(), i = Math.max(0, Math.min(h.length - 1, Math.round((e.clientX - r.left) / r.width * (h.length - 1))));
    cursor.setAttribute('x1', i / (h.length - 1) * 320); cursor.setAttribute('x2', i / (h.length - 1) * 320); cursor.setAttribute('opacity', 1);
    read.innerHTML = `<b>${money(h[i][1])}</b> em ${dayLabel(h[i][0])}`;
  };
  box.addEventListener('pointermove', show);
  box.addEventListener('pointerdown', show);
}
function railCard(c, label) {
  return `<button class="rail-card" type="button" data-card="${esc(c.id)}"><span class="frame">${imgTag(c, 'low', c.name)}</span>
    <b>${esc(c.name)}</b>${label ? `<span class="price">${label}</span>` : ''}</button>`;
}
// Sem logo oficial, vale o símbolo do set; sem símbolo, o código impresso nas cartas ou as iniciais.
const setCode = s => isJa(s.id) ? jaRaw(s.id) : s.name.split(/\s+/).filter(w => /^[\p{L}\d]/u.test(w) && w.length > 2).map(w => w[0]).join('').slice(0, 4).toUpperCase();
const setArt = s => s.logo ? `${s.logo}.webp` : s.symbol ? `${s.symbol}.png` : '';
function setTile(s, have) {
  const size = s.total || s.official || 1, pct = Math.min(100, have / size * 100), art = setArt(s);
  return `<button class="set-tile${have >= size ? ' done' : ''}" type="button" data-set="${esc(s.id)}">
    <span class="logo${art ? '' : ' nologo'}">${art ? `<img loading="lazy" alt="" data-logo src="${esc(art)}">` : ''}<em>${esc(setCode(s))}</em></span>
    <b>${esc(s.name)}</b><span class="bar"><i style="width:${pct}%"></i></span>
    <span class="count"><span>${have}/${size}</span><span>${Math.floor(pct)}%</span></span></button>`;
}
document.addEventListener('error', e => {
  if (e.target.dataset?.hideBroken !== undefined) { e.target.remove(); return; }
  if (e.target.dataset?.logo === undefined) return;
  e.target.parentElement.classList.add('nologo'); e.target.remove();
}, true);

async function renderHome() {
  const cards = list(), total = collectionValue(), copies = copiesCount();
  trackValue(total);
  const top = [...cards].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 8);
  const recent = [...cards].sort((a, b) => b.addedAt - a.addedAt).slice(0, 8);
  view.innerHTML = `
    <div class="topbar"><div class="hello"><span>Olá, treinador</span><b>${esc(trainerName())}</b></div>
      <button class="ring-avatar" type="button" data-tab="profile" aria-label="Abrir perfil">${avatar()}</button></div>
    <div class="hero"><div><span class="label">Valor da coleção</span><span class="value">${money(total)}</span></div>
      ${cards.length ? valueChart() : ''}
      <div class="chips"><span class="chip"><b>${copies}</b> ${copies === 1 ? 'carta' : 'cartas'}</span><span class="chip"><b>${cards.length}</b> ${cards.length === 1 ? 'diferente' : 'diferentes'}</span></div></div>
    ${window.Sync?.nudge() || ''}
    ${cards.length ? `
    <div class="section"><div class="section-head"><h2>Mais valiosas</h2></div><div class="rail">${top.map(c => railCard(c, money(valueOf(c)))).join('')}</div></div>
    <div class="section"><div class="section-head"><h2>Seus sets</h2><button type="button" data-my-sets>Ver todos</button></div><div class="tiles" id="mySets"></div></div>
    <div class="section"><div class="section-head"><h2>Adicionadas recentemente</h2></div><div class="rail">${recent.map(c => railCard(c)).join('')}</div></div>`
    : `<div class="empty"><h2>Seu fichário está vazio</h2>
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
  view.innerHTML = `<h1>Sets</h1><input id="setFilter" class="field" type="search" placeholder="Procurar set" aria-label="Procurar set" value="${esc(route.q)}" autocomplete="off">
    <div class="seg" role="group" aria-label="Quais sets mostrar">${[['west', 'Ocidentais'], ['ja', 'Japoneses'], ['mine', 'Meus']].map(([k, l]) => `<button type="button" data-region="${k}" class="${route.region === k ? 'on' : ''}">${l}</button>`).join('')}</div>
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
    const hits = sets.filter(s => isJa(s.id) === (route.region === 'ja') && match(s));
    if (!hits.length) { box.innerHTML = '<p class="muted">Nenhum set com esse nome.</p>'; return; }
    if (route.region === 'ja') { box.innerHTML = `<div class="tiles">${hits.map(s => setTile(s, owned[s.id] || 0)).join('')}</div>`; return; }
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
  return `<svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><defs><linearGradient id="foilRing"><stop offset="0" stop-color="#5ee7ff"/><stop offset=".5" stop-color="#a98bff"/><stop offset="1" stop-color="#ff8fc7"/></linearGradient></defs>
    <circle cx="40" cy="40" r="${r}" stroke="#2c3757"/><circle cx="40" cy="40" r="${r}" stroke="${done ? '#ffd35c' : 'url(#foilRing)'}" stroke-linecap="round" stroke-dasharray="${len * pct / 100} ${len}"/>
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
  const inScope = s.cards.filter(c => scope === 'all' || (parseInt(c.localId, 10) <= s.official && /^\d+$/.test(c.localId)));
  const have = inScope.filter(c => store.cards[c.id]).length;
  const shown = inScope.filter(c => route.filter === 'all' || (route.filter === 'have') === !!store.cards[c.id]);
  const left = inScope.length - have, pct = inScope.length ? have / inScope.length * 100 : 0;
  const value = list().filter(c => c.setId === s.id).reduce((a, c) => a + valueOf(c), 0);
  view.innerHTML = `${back}
    <div class="set-hero">${logo ? `<img alt="" src="${esc(logo)}" data-hide-broken>` : ''}<h1>${esc(s.name)}</h1>
      <div class="stats">${ring(pct, !left)}<p><b>${money(value)}</b><span class="muted">${left ? `Faltam ${left} de ${inScope.length}` : 'Set completo'}</span></p></div></div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Quais cartas contam">
        <button type="button" data-scope="all" class="${scope === 'all' ? 'on' : ''}">Completo (${s.cards.length})</button>
        <button type="button" data-scope="base" class="${scope === 'base' ? 'on' : ''}">Base (${s.official})</button></div>
      <div class="seg" role="group" aria-label="Filtro">
        ${[['all', 'Todas'], ['have', 'Tenho'], ['miss', 'Faltam']].map(([k, l]) => `<button type="button" data-filter="${k}" class="${route.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${shown.length ? `<div class="binder">${shown.map(pocket).join('')}</div>` : '<p class="muted">Nada para mostrar neste filtro.</p>'}`;
}
function pocket(c) {
  const own = store.cards[c.id], star = store.profile.showcase.includes(c.id);
  return `<button type="button" class="pocket${own ? '' : ' missing'}" data-card="${esc(c.id)}" aria-label="${esc(c.name)} ${esc(c.localId)}${own ? '' : ', faltando'}">
    ${imgTag(c)}<span class="tag">${esc(c.localId)}</span>${own && qtyOf(own) > 1 ? `<span class="qty">×${qtyOf(own)}</span>` : ''}${star ? '<span class="star" aria-hidden="true">★</span>' : ''}</button>`;
}

/* ---------- Busca ---------- */
function renderSearch() {
  view.innerHTML = `<h1>Buscar</h1>
    <form id="searchForm"><input id="searchInput" class="field" type="search" enterkeyhint="search" placeholder="Nome da carta, como Charizard" aria-label="Nome da carta" value="${esc(route.q)}" autocomplete="off"></form>
    <div id="searchOut"></div>
    <button class="btn alt" type="button" data-manual>Não achou? Cadastrar carta manualmente</button>`;
  if (route.results) drawResults(route.results);
}
function drawResults(cards) {
  const box = $('#searchOut'); if (!box) return;
  box.innerHTML = cards.length ? `<div class="binder">${cards.map(pocket).join('')}</div>`
    : '<p class="muted">Nenhuma carta encontrada. Confira a grafia do nome em inglês, português ou japonês.</p>';
}
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
    ['stack', 'Fichário cheio', 'Tenha 250 cartas', copies >= 250],
    ['stack', 'Mestre das pastas', 'Tenha 1.000 cartas', copies >= 1000],
    ['crown', 'Set completo', 'Complete um set inteiro', completed >= 1],
    ['crown', 'Tricampeão', 'Complete 3 sets', completed >= 3],
    ['gem', 'Achado raro', 'Tenha uma carta de R$ 100', cards.some(c => brl(valueOf(c) / qtyOf(c)) >= 100)],
    ['gem', 'Tesouro', 'Coleção de R$ 1.000', total >= 1000],
    ['gem', 'Cofre', 'Coleção de R$ 10.000', total >= 10000],
    ['flag', 'Além-mar', 'Tenha uma carta japonesa', cards.some(c => isJa(c.id))],
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
async function renderProfile() {
  const cards = list(), p = store.profile, owned = ownedBySet();
  const draw = completed => {
    const list_ = achievements(completed), won = list_.filter(a => a[3]).length;
    view.innerHTML = `<div class="banner"></div>
      <div class="profile-actions"><button class="icon-btn" type="button" data-tab="settings" aria-label="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button></div>
      <div class="identity"><span class="ring-avatar">${avatar()}</span><h1>${esc(trainerName())}</h1>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</div>
      <button class="btn alt" type="button" data-edit-profile>Editar perfil</button>
      <div class="stat-grid">
        <div class="stat"><b>${money(collectionValue())}</b><span>Valor da coleção</span></div>
        <div class="stat"><b>${copiesCount()}</b><span>Cartas</span></div>
        <div class="stat"><b>${completed}</b><span>Sets completos</span></div>
        <div class="stat"><b>${won}/${list_.length}</b><span>Conquistas</span></div></div>
      <div class="section"><div class="section-head"><h2>Vitrine</h2>${showcaseCards().length ? '<button type="button" data-pick>Editar</button>' : ''}</div>${showcaseBlock()}</div>
      <div class="section"><div class="section-head"><h2>Conquistas</h2></div><div class="badges">${[...list_].sort((a, b) => b[3] - a[3]).map(badge).join('')}</div></div>`;
  };
  draw(0);
  if (!cards.length) return;
  const sets = await getSets().catch(() => []);
  const completed = sets.filter(s => s.total && owned[s.id] >= s.total).length;
  if (completed && route.tab === 'profile') draw(completed);
}
function pickShowcase() {
  const cards = [...list()].sort((a, b) => valueOf(b) - valueOf(a));
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
      <div class="identity" style="margin:0"><span class="ring-avatar" id="pPreview">${avatar()}</span></div>
      <label class="btn alt" for="pPhoto">Trocar foto</label>
      <input id="pPhoto" type="file" accept="image/*" hidden>
      ${p.photo ? '<button class="btn alt" type="button" data-photo-off>Remover foto</button>' : ''}
      <input id="pName" class="field" maxlength="30" placeholder="Seu nome de treinador" aria-label="Nome" value="${esc(p.name || accountUser()?.name || '')}" autocomplete="off">
      <textarea id="pBio" class="field" maxlength="120" placeholder="Uma frase sobre sua coleção" aria-label="Sobre você">${esc(p.bio || '')}</textarea>
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
  const when = store.pricedAt ? new Date(store.pricedAt).toLocaleDateString('pt-BR') : 'nunca';
  view.innerHTML = `<button class="back" type="button" data-tab="profile">‹ Perfil</button><h1>Ajustes</h1>
    <div class="panel section" id="account"></div>
    <div class="panel"><h2>Moeda</h2>
      <div class="seg" role="group" aria-label="Moeda">${['BRL', 'USD', 'EUR'].map(c => `<button type="button" data-currency="${c}" class="${store.currency === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      <p class="muted small">Os preços vêm da TCGplayer (EUA) e da Cardmarket (Europa) e são convertidos pela cotação do dia. O mercado brasileiro pode praticar valores diferentes.${store.fx ? ` US$ 1 = R$ ${store.fx.BRL.toFixed(2).replace('.', ',')}.` : ''}</p></div>
    <div class="panel"><h2>Preços</h2>
      <button id="refreshPrices" class="btn alt" type="button">Atualizar preços da coleção</button>
      <p class="muted small">Última atualização: ${when}.</p></div>
    <div class="panel"><h2>Backup</h2>
      <button id="exportBtn" class="btn alt" type="button">Exportar coleção</button>
      <button id="importBtn" class="btn alt" type="button">Importar backup</button>
      <p class="muted small">Sem conta, a coleção fica só neste iPhone. Exporte de vez em quando e guarde o arquivo no iCloud Drive.</p></div>
    <p class="muted small">Dados de cartas: TCGdex. Reconhecimento feito no próprio aparelho. Projeto pessoal, sem vínculo com The Pokémon Company ou Nintendo.</p>`;
  window.Sync?.paint();
}

/* ---------- Painel da carta ---------- */
function cardExtras(card) {
  const own = store.cards[card.id], on = store.profile.showcase.includes(card.id);
  const liga = `<a class="btn alt" href="${esc(ligaUrl(card))}" target="_blank" rel="noopener">Ver na Liga Pokémon</a>`;
  if (!own) return `<div id="extras">${liga}</div>`;
  return `<div id="extras"><div class="split"><button class="btn alt${on ? ' toggled' : ''}" type="button" data-star>${on ? '★ Na vitrine' : '☆ Pôr na vitrine'}</button>${liga.replace('Ver na Liga Pokémon', 'Liga Pokémon')}</div>
    <details${own.custom != null ? ' open' : ''}><summary>Definir meu valor</summary><form id="valueForm" class="value-form"><label for="valueInput" class="small muted">Valor por carta (R$)</label>
    <input id="valueInput" class="field" inputmode="decimal" autocomplete="off" placeholder="Usar preço automático" value="${esc(brlText(own.custom))}">
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
function variantRows(card) {
  const own = store.cards[card.id]?.qty || {};
  const vs = card.variants.length ? card.variants : ['normal'];
  return vs.map(v => {
    const p = card.prices?.[v], custom = store.cards[card.id]?.custom, usd = custom != null ? customUsd(custom) : toUsd(p);
    const src = [p?.usd != null ? `US$ ${p.usd.toFixed(2)}` : '', p?.eur ? `€ ${p.eur.toFixed(2)}` : ''].filter(Boolean).join(' · ');
    return `<div class="variant"><b>${VARIANTS[v].label}</b>
      <div class="stepper"><button type="button" data-step="-1" data-variant="${v}" aria-label="Remover ${VARIANTS[v].label}">−</button><span>${own[v] || 0}</span><button type="button" data-step="1" data-variant="${v}" aria-label="Adicionar ${VARIANTS[v].label}">+</button></div>
      <span class="prices">${custom != null ? `${money(usd)} <span class="small">(seu valor)</span>` : usd != null ? `${money(usd)} <span class="small">(${src})</span>` : 'Sem preço disponível'}</span></div>`;
  }).join('');
}
function cardHead(card) {
  return `<div class="card-show"><div class="holo" data-tilt>${imgTag(card, 'high', card.name)}</div><div class="info"><h2>${esc(card.name)}</h2>
    <span class="muted">${esc(card.setName)}${isJa(card.id) ? ' · Japonesa' : ''}</span><span class="num small muted">Nº ${esc(card.localId)}</span>
    ${card.rarity ? `<span class="rarity">${esc(card.rarity)}</span>` : ''}</div></div>`;
}
async function showCard(id) {
  openSheet('<p class="muted">Buscando carta e preço…</p>');
  try {
    const own = store.cards[id];
    sheetCard = own?.setId === 'custom' ? { ...own, variants: ['normal'] } : await getCard(id);
    if (sheet.hidden) return;
    sheet.innerHTML = `<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button>${cardHead(sheetCard)}<div id="variants">${variantRows(sheetCard)}</div>${cardExtras(sheetCard)}`;
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
  else if (d.pick !== undefined) pickShowcase();
  else if (d.editProfile !== undefined) { pendingPhoto = undefined; editProfile(); }
  else if (d.show) { if (toggleShowcase(d.show)) b.classList.toggle('on'); }
  else if (d.star !== undefined && sheetCard) { toggleShowcase(sheetCard.id); $('#extras').outerHTML = cardExtras(sheetCard); }
  else if (d.photoOff !== undefined) { pendingPhoto = null; b.remove(); $('#pPreview').innerHTML = '<span class="avatar initials">?</span>'; }
  else if (d.step !== undefined) setTimeout(() => { const x = $('#extras'); if (x && sheetCard) x.outerHTML = cardExtras(sheetCard); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
document.addEventListener('change', async e => {
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
  if (pendingPhoto === null) delete p.photo;
  else if (pendingPhoto) p.photo = pendingPhoto;
  saveProfile();
  toast('Perfil salvo');
  closeSheet();
});

render();
refreshFx();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
