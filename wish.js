'use strict';
// Lista de desejos (com preço-alvo e aviso quando a carta chega nele) e histórico de preço de cada carta.
// A lista fica em store.profile.wishlist e sincroniza com o perfil. O histórico (store.priceLog) fica só no
// aparelho: um ponto por dia, gravado na atualização diária de preços, para as cartas da coleção e da lista.
window.Wish = (() => {
  const list_ = () => store.profile.wishlist ??= {};
  const has = id => !!list_()[id];
  const brl = usd => usd * (store.fx?.BRL || 5.4);
  // Preço de referência de uma carta: a variante que a pessoa mais tem; senão a primeira com preço.
  function refPrice(c) {
    const prices = c.prices || {};
    const keys = Object.keys(c.qty || {}).sort((a, b) => (c.qty[b] || 0) - (c.qty[a] || 0)).map(variantOfKey);
    for (const v of [...keys, 'normal', 'holo', 'reverse', 'firstEdition', ...Object.keys(prices)]) { const u = toUsd(prices[v]); if (u) return u; }
    return null;
  }

  /* ---------- Histórico de preço ---------- */
  const log = () => store.priceLog ??= {};
  function record(id, usd) {
    if (!usd) return;
    const day = new Date().toISOString().slice(0, 10), h = log()[id] ??= [];
    const last = h[h.length - 1];
    if (last?.[0] === day) last[1] = Math.round(usd * 100) / 100; else h.push([day, Math.round(usd * 100) / 100]);
    if (h.length > 90) h.splice(0, h.length - 90);
  }
  function recordAll() {
    for (const c of list()) if (c.setId !== 'custom') record(c.id, refPrice(c));
    for (const w of Object.values(list_())) record(w.id, w.usd);
    save();
    window.Sync?.historyChanged?.();
  }
  function priceBlock(card) {
    const own = store.cards[card.id], c = { ...card, ...(own ? { qty: own.qty } : {}), prices: card.prices || own?.prices || {} };
    const main = Object.entries(c.prices).find(([, p]) => p?.m30 || p?.eur || p?.usd);
    if (!main) return '';
    const [v, p] = main, eur = x => x && store.fx ? money(x / store.fx.EUR) : '—';
    const h = log()[card.id] || [];
    let spark = '<p class="muted small">O gráfico desta carta vai se formando com a atualização diária de preços.</p>';
    if (h.length >= 2) {
      const vals = h.map(x => x[1]), min = Math.min(...vals), max = Math.max(...vals), W = 260, H = 54;
      const x = i => i / (h.length - 1) * W, y = val => H - 4 - (val - min) / ((max - min) || 1) * (H - 8);
      const d = h.map((pt, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(pt[1]).toFixed(1)}`).join(' ');
      const diff = vals[vals.length - 1] - vals[0];
      spark = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Preço de ${money(vals[0])} para ${money(vals[vals.length - 1])}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
        <span class="small ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${money(Math.abs(diff))} desde ${h[0][0].slice(8, 10)}/${h[0][0].slice(5, 7)}</span>`;
    }
    return `<details class="price-history"><summary>Histórico de preço · ${esc(VARIANTS[v]?.label || v)}</summary>
      <div class="ph-avgs"><span><b>${eur(p.m1)}</b>ontem</span><span><b>${eur(p.m7)}</b>média 7 dias</span><span><b>${eur(p.m30)}</b>média 30 dias</span></div>
      ${spark}<p class="muted small">Médias da Cardmarket convertidas pela cotação do dia. O gráfico usa os preços guardados neste aparelho.</p></details>`;
  }

  /* ---------- Lista de desejos ---------- */
  function toggle(card) {
    const l = list_();
    if (l[card.id]) delete l[card.id];
    else l[card.id] = { id: card.id, name: card.name, image: card.image || '', imageEn: card.imageEn || '', setId: card.setId, setName: card.setName, localId: card.localId, usd: refPrice(card), target: null, at: Date.now() };
    saveProfile();
  }
  const hit = w => w.target != null && w.usd != null && brl(w.usd) <= w.target;
  const hits = () => Object.values(list_()).filter(w => hit(w) && !store.cards[w.id]);
  function block(card) {
    if (card.setId === 'custom') return '';
    const w = list_()[card.id];
    if (!w) return `<button class="btn alt wish-btn" type="button" data-wish>♡ Quero esta carta</button>`;
    return `<div class="wish-box"><button class="btn alt wish-btn on" type="button" data-wish>♥ Na sua lista de desejos</button>
      <form id="wishForm" class="value-form"><label class="small muted" for="wishTarget">Me avise quando custar até (R$)</label>
        <input id="wishTarget" class="field" inputmode="decimal" autocomplete="off" placeholder="Sem preço-alvo" value="${esc(brlText(w.target))}"><button class="btn alt" type="submit">Salvar</button></form>
      ${hit(w) ? '<p class="small ok-note">🔔 Já está no preço que você queria!</p>' : ''}</div>`;
  }
  // Atualiza os preços das cartas da lista uma vez por dia (junto com os preços da coleção).
  async function refresh() {
    const items = Object.values(list_()).filter(w => !store.cards[w.id] && w.setId !== 'custom');
    for (const w of items) {
      try { memo.delete('card:' + w.id); const card = await getCard(w.id); w.usd = refPrice(card) ?? w.usd; } catch { /* tenta amanhã */ }
    }
    recordAll();
  }
  function banner() {
    const n = hits().length;
    return n ? `<button type="button" class="alert-bar" data-mine="wish">🔔 ${n === 1 ? '1 carta da sua lista de desejos chegou' : `${n} cartas da sua lista de desejos chegaram`} ao preço que você queria ›</button>` : '';
  }
  function page() {
    const items = Object.values(list_()).sort((a, b) => hit(b) - hit(a) || b.at - a.at);
    if (!items.length) return '<div class="empty"><h2>Sua lista de desejos está vazia</h2><p class="muted">Abra qualquer carta e toque em "♡ Quero esta carta". Você pode definir um preço-alvo e o app avisa quando ela chegar nele. Seus amigos veem a lista nas trocas.</p><button class="btn" type="button" data-tab="search">Explorar cartas</button></div>';
    const offers = window.Trades?.whoHas?.() || {};
    return `<p class="muted small">${items.length} ${items.length === 1 ? 'carta' : 'cartas'} na lista. Os preços se atualizam uma vez por dia.</p><div class="dupes">${items.map(w => {
      const got = !!store.cards[w.id], friends = offers[w.id] || [];
      return `<article class="dupe${hit(w) && !got ? ' hit' : ''}"><button type="button" class="dupe-card" data-card="${esc(w.id)}" aria-label="${esc(w.name)}">${imgTag(w, 'low', w.name)}</button>
        <div class="dupe-info"><b>${esc(w.name)}</b><span class="muted small">${esc(w.setName)} · nº ${esc(w.localId)}</span>
          <span class="small">Preço: <b>${w.usd != null ? money(w.usd) : '—'}</b>${w.target != null ? ` · alvo ${brlText(w.target).replace(/^/, 'R$ ')}` : ''}</span>
          ${got ? '<span class="small ok-note">Já está na sua coleção</span>' : hit(w) ? '<span class="small ok-note">🔔 No preço que você queria</span>' : ''}
          ${friends.length ? `<span class="small why">Repetida com ${friends.map(f => '@' + esc(f)).join(', ')}</span>` : ''}</div>
        <button type="button" class="link danger small" data-unwish="${esc(w.id)}">Tirar</button></article>`;
    }).join('')}</div>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.wish !== undefined && typeof sheetCard !== 'undefined' && sheetCard) {
      toggle(sheetCard);
      const box = b.closest('.wish-box') || b; box.outerHTML = block(sheetCard);
      toast(has(sheetCard.id) ? 'Adicionada à lista de desejos' : 'Removida da lista de desejos');
    } else if (b.dataset.unwish) { delete list_()[b.dataset.unwish]; saveProfile(); render(); }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'wishForm' || typeof sheetCard === 'undefined' || !sheetCard) return;
    e.preventDefault(); e.stopPropagation();
    const w = list_()[sheetCard.id]; if (!w) return;
    const t = $('#wishTarget').value.trim();
    w.target = t ? parseBrl(t) : null;
    saveProfile();
    $('.wish-box').outerHTML = block(sheetCard);
    toast(w.target != null ? 'Preço-alvo salvo' : 'Preço-alvo removido');
  }, true);

  return { has, block, priceBlock, refresh, recordAll, hits, banner, page, ids: () => Object.keys(list_()), refPrice };
})();
