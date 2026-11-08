'use strict';
// Trocas entre amigos e ranking. Usa o perfil público de quem você segue (profiles/{uid}):
// wants (lista de desejos), spares (repetidas), own (todas as cartas, só em perfis públicos), completed e week.
// Propostas ficam em trades/{id}: { from, to, fromName, toName, give: [...], get: [...], msg, status, at, appliedFrom, appliedTo }
// "give" é o que quem propôs entrega; "get" é o que recebe. Cada lado aplica a troca na própria coleção depois de aceita.
window.Trades = (() => {
  const db = () => window.Sync?.ctx?.().db;
  const me = () => window.Sync?.ctx?.().user;
  const setOf = id => id.slice(0, id.lastIndexOf('-'));
  const FRESH = 10 * 60e3;
  let friends = { at: 0, list: [] }, trades = [], draft = null;

  async function loadFriends(following, force) {
    if (!force && Date.now() - friends.at < FRESH && friends.list.length === following.length) return friends.list;
    const list_ = await Promise.all(following.map(f => db().collection('profiles').doc(f.uid).get().then(d => d.exists ? d.data() : null).catch(() => null)));
    friends = { at: Date.now(), list: list_.filter(Boolean) };
    return friends.list;
  }
  // Nome, imagem e set das cartas dos amigos vêm do catálogo; o preço, da base (só das que aparecem).
  async function cardsInfo(ids) {
    const cat = new Map((await getCatalog().catch(() => [])).map(c => [c.id, c]));
    return ids.map(id => store.cards[id] || cat.get(id) || { id, name: id, setName: setOf(id), image: '' });
  }
  async function priceOf(c) {
    if (store.cards[c.id]) return unitValue(store.cards[c.id]);
    try { return window.Wish?.refPrice(await getCard(c.id)) || 0; } catch { return 0; }
  }

  /* ---------- Sugestões ---------- */
  function suggest(p) {
    const mySets = new Set(list().map(c => c.setId)), wants = new Set(window.Wish?.ids() || []);
    const theirWants = new Set(p.wants || []), theirOwn = new Set(p.own || []), theirSets = new Set((p.own || []).map(setOf));
    const forMe = (p.spares || []).filter(id => !store.cards[id] && (wants.has(id) || mySets.has(setOf(id))))
      .map(id => ({ id, why: wants.has(id) ? 'want' : 'set' }));
    const forThem = list().filter(c => qtyOf(c) > 1 && c.setId !== 'custom' && (theirWants.has(c.id) || (theirOwn.size && !theirOwn.has(c.id) && theirSets.has(c.setId))))
      .map(c => ({ id: c.id, why: theirWants.has(c.id) ? 'want' : 'set' }));
    const order = (a, b) => (a.why === 'want' ? 0 : 1) - (b.why === 'want' ? 0 : 1);
    return { forMe: forMe.sort(order), forThem: forThem.sort(order) };
  }

  /* ---------- Aba Trocas ---------- */
  async function render(following, force) {
    const box = $('#feed'); if (!box) return;
    box.innerHTML = '<p class="muted">Procurando trocas…</p>';
    try {
      const [ps, mineT] = await Promise.all([loadFriends(following, force), loadTrades()]);
      if (route.tab !== 'social' || route.stab !== 'trades') return;
      const sug = ps.map(p => ({ p, ...suggest(p) })).filter(x => x.forMe.length || x.forThem.length)
        .sort((a, b) => (b.forMe.length + b.forThem.length) - (a.forMe.length + a.forThem.length));
      const open = mineT.filter(t => t.status === 'open'), done = mineT.filter(t => t.status !== 'open').slice(0, 10);
      box.innerHTML = `
        ${open.length ? `<h2>Propostas em aberto</h2>${open.map(tradeCard).join('')}` : ''}
        <h2>Sugestões de troca</h2>
        ${!following.length ? '<p class="muted">Siga seus amigos para ver o que dá para trocar com eles.</p>'
          : sug.length ? `<div class="suggest">${sug.map(({ p, forMe, forThem }) => `<article class="panel trade-sug">
              <div class="person-main"><span class="ring-avatar" ${ringAttrs(p.ring)}>${window.Social.face(p)}</span><span><b>@${esc(p.username)}</b>
                <span class="muted small">Tem ${forMe.length} ${forMe.length === 1 ? 'carta' : 'cartas'} para você · você tem ${forThem.length} para ${p.name ? esc(p.name.split(' ')[0]) : 'ele'}</span></span></div>
              <button class="btn auto" type="button" data-propose="${esc(p.uid)}">Propor troca</button></article>`).join('')}</div>`
          : '<p class="muted">Nenhuma troca encontrada agora. As sugestões cruzam as repetidas de cada um com a lista de desejos e os sets que o outro coleciona. Use "♡ Quero esta carta" para melhorar as sugestões.</p>'}
        ${done.length ? `<h2>Histórico</h2>${done.map(tradeCard).join('')}` : ''}`;
    } catch {
      box.innerHTML = '<p class="muted">Não consegui carregar as trocas agora.</p>';
    }
  }
  async function loadTrades() {
    const uid = me()?.uid; if (!uid) return [];
    const [a, b] = await Promise.all([
      db().collection('trades').where('from', '==', uid).limit(30).get(),
      db().collection('trades').where('to', '==', uid).limit(30).get(),
    ]);
    trades = [...a.docs, ...b.docs].map(d => ({ ...d.data(), tid: d.id })).sort((x, y) => y.at - x.at);
    return trades;
  }
  const thumbs = items => `<div class="trade-thumbs">${items.map(c => `<button type="button" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}</button>`).join('')}</div>`;
  const sum = items => items.reduce((s, c) => s + (c.usd || 0), 0);
  function tradeCard(t) {
    const uid = me()?.uid, mine = t.from === uid, other = mine ? t.toName : t.fromName;
    const give = mine ? t.give : t.get, get = mine ? t.get : t.give;
    const label = { open: mine ? 'Esperando resposta' : 'Proposta para você', accepted: 'Aceita', declined: 'Recusada', cancelled: 'Cancelada' }[t.status];
    const applied = mine ? t.appliedFrom : t.appliedTo;
    return `<article class="panel trade" data-tid="${esc(t.tid)}">
      <header><b>${mine ? 'Você → ' : ''}@${esc(other)}${mine ? '' : ' → você'}</b><span class="pill ${t.status === 'accepted' ? 'ok' : ''}">${label}</span></header>
      ${t.msg ? `<p class="small">"${esc(t.msg)}"</p>` : ''}
      <div class="trade-sides"><div><span class="small muted">Você dá · ${money(sum(give))}</span>${thumbs(give)}</div><div><span class="small muted">Você recebe · ${money(sum(get))}</span>${thumbs(get)}</div></div>
      <div class="row-btns">${t.status === 'open' && !mine ? `<button class="btn" type="button" data-trade-ok="${esc(t.tid)}">Aceitar</button><button class="btn alt" type="button" data-trade-no="${esc(t.tid)}">Recusar</button>` : ''}
        ${t.status === 'open' && mine ? `<button class="btn alt" type="button" data-trade-cancel="${esc(t.tid)}">Cancelar proposta</button>` : ''}
        ${t.status === 'accepted' && !applied ? `<button class="btn" type="button" data-trade-apply="${esc(t.tid)}">Atualizar minha coleção</button>` : ''}
        ${t.status === 'accepted' && applied ? '<span class="small ok-note">Coleção atualizada ✓</span>' : ''}</div></article>`;
  }

  /* ---------- Montar a proposta ---------- */
  async function propose(uid) {
    const p = friends.list.find(x => x.uid === uid); if (!p) return;
    const { forMe, forThem } = suggest(p);
    openSheet('<p class="muted">Montando a proposta…</p>');
    const [mineC, theirC] = await Promise.all([cardsInfo(forThem.map(x => x.id)), cardsInfo(forMe.map(x => x.id))]);
    const prices = await Promise.all([...mineC, ...theirC].slice(0, 60).map(priceOf));
    mineC.forEach((c, i) => { c.usd = prices[i] || 0; c.why = forThem[i].why; });
    theirC.forEach((c, i) => { c.usd = prices[mineC.length + i] || 0; c.why = forMe[i].why; });
    draft = { p, give: mineC, get: theirC, pick: new Set([...mineC, ...theirC].filter(c => c.why === 'want').map(c => c.id)) };
    drawDraft();
  }
  function drawDraft() {
    const { p, give, get, pick } = draft;
    const row = (c, side) => `<label class="pick-row"><input type="checkbox" data-pick="${esc(c.id)}"${pick.has(c.id) ? ' checked' : ''}>
      <span class="thumb">${imgTag(c, 'low', '')}</span><span class="grow"><b>${esc(c.name)}</b><span class="muted small">${esc(c.setName || '')}${c.why === 'want' ? (side === 'get' ? ' · está na sua lista' : ' · está na lista dele') : ' · completa um set'}</span></span><span class="num">${money(c.usd)}</span></label>`;
    const total = items => items.filter(c => pick.has(c.id)).reduce((s, c) => s + c.usd, 0);
    const g = total(give), r = total(get), diff = r - g;
    sheet.innerHTML = `<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Troca com @${esc(p.username)}</h2>
      <div class="trade-balance"><span>Você dá <b>${money(g)}</b></span><span>Você recebe <b>${money(r)}</b></span>
        <span class="${Math.abs(diff) <= Math.max(g, r) * .15 ? 'ok-note' : 'warn'}">${Math.abs(diff) <= Math.max(g, r) * .15 ? 'Troca equilibrada' : diff > 0 ? `Você leva ${money(diff)} a mais` : `Você dá ${money(-diff)} a mais`}</span></div>
      <h3>Você recebe (repetidas de @${esc(p.username)})</h3>${get.length ? get.map(c => row(c, 'get')).join('') : '<p class="muted small">Nenhuma carta sugerida deste lado.</p>'}
      <h3>Você dá (suas repetidas)</h3>${give.length ? give.map(c => row(c, 'give')).join('') : '<p class="muted small">Nenhuma carta sugerida deste lado.</p>'}
      <input id="tradeMsg" class="field" maxlength="200" placeholder="Mensagem (opcional)" aria-label="Mensagem">
      <button class="btn" type="button" data-trade-send${pick.size ? '' : ' disabled'}>Enviar proposta</button>
      <p class="muted small">Os valores são estimativas pelo preço de mercado. Nada muda na coleção de ninguém até a troca ser aceita e cada um tocar em "Atualizar minha coleção".</p>`;
  }
  async function send() {
    const { p, give, get, pick } = draft, u = me();
    const slim = c => ({ id: c.id, name: c.name, image: c.image?.startsWith('data:') ? '' : c.image || '', setName: c.setName || '', usd: Math.round((c.usd || 0) * 100) / 100 });
    const doc = { from: u.uid, to: p.uid, fromName: window.Social?.handle?.() || '', toName: p.username, give: give.filter(c => pick.has(c.id)).map(slim),
      get: get.filter(c => pick.has(c.id)).map(slim), msg: ($('#tradeMsg')?.value || '').trim().slice(0, 200), status: 'open', at: Date.now(), appliedFrom: false, appliedTo: false };
    try { await db().collection('trades').add(doc); toast('Proposta enviada'); closeSheet(); route.stab = 'trades'; window.Social?.renderSocial(); }
    catch { toast('Não consegui enviar a proposta'); }
  }
  // Aplica na própria coleção: sai uma cópia repetida (a de menor valor) de cada carta dada e entra uma de cada recebida.
  async function apply(t) {
    const uid = me().uid, mine = t.from === uid, out = mine ? t.give : t.get, inn = mine ? t.get : t.give;
    for (const c of out) {
      const own = store.cards[c.id]; if (!own) continue;
      const spare = spareCopies(own).filter(x => !x.graded).sort((a, b) => a.unit - b.unit)[0] || copiesOf(own).find(x => !x.graded);
      if (spare) { own.qty[spare.key]--; if (!own.qty[spare.key]) delete own.qty[spare.key]; touched(c.id); }
    }
    for (const c of inn) {
      try { const card = await getCard(c.id); setQty(card, card.variants?.[0] || 'normal', 1); }
      catch { toast(`Não consegui adicionar ${c.name}`); }
    }
    await db().collection('trades').doc(t.tid).update({ [mine ? 'appliedFrom' : 'appliedTo']: true });
    toast('Coleção atualizada com a troca');
  }

  /* ---------- Ranking ---------- */
  const METRICS = [['value', 'Valor'], ['cards', 'Cartas'], ['unique', 'Diferentes'], ['completed', 'Sets completos'], ['week', 'Na semana']];
  async function ranking(following, force) {
    const box = $('#feed'); if (!box) return;
    box.innerHTML = '<p class="muted">Montando o ranking…</p>';
    const ps = await loadFriends(following, force).catch(() => []);
    if (route.tab !== 'social' || route.stab !== 'ranking') return;
    const owned = ownedBySet(), sets = await getSets().catch(() => []);
    const meRow = { uid: me()?.uid, username: window.Social?.handle?.() || 'você', name: trainerName(), photo: store.profile.photo, ring: store.profile.ring, isMe: true,
      value: collectionValue(), showValue: true, cards: copiesCount(), unique: list().length,
      completed: sets.filter(s => s.total && owned[s.id] >= s.total).length, week: list().filter(c => Date.now() - (c.addedAt || 0) < 7 * 864e5).reduce((n, c) => n + qtyOf(c), 0) };
    const metric = route.rank || 'cards';
    const rows = [meRow, ...ps].filter(p => metric !== 'value' || p.isMe || (p.showValue && p.value != null))
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
    const fmt = v => metric === 'value' ? money(v || 0) : (v || 0).toLocaleString('pt-BR');
    box.innerHTML = `<div class="seg" role="group" aria-label="Ranking por">${METRICS.map(([k, l]) => `<button type="button" data-rank="${k}" class="${metric === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${rows.length < 2 ? '<p class="muted">Siga seus amigos para comparar as coleções.</p>' : ''}
      <ol class="rank">${rows.map((p, i) => `<li class="${p.isMe ? 'me' : ''}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
        <button type="button" class="person-main" data-friend="${esc(p.username)}"><span class="ring-avatar" ${ringAttrs(p.ring)}>${window.Social.face(p)}</span><span><b>${p.isMe ? 'Você' : esc(p.name || p.username)}</b><span class="muted small">@${esc(p.username)}</span></span></button>
        <b class="num">${fmt(p[metric])}</b></li>`).join('')}</ol>
      ${metric === 'value' ? '<p class="muted small">No valor aparecem só os amigos que escolheram mostrar o valor da coleção no perfil.</p>' : ''}`;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, find = id => trades.find(t => t.tid === id);
    if (d.propose) propose(d.propose);
    else if (d.tradeSend !== undefined) { b.disabled = true; await send(); }
    else if (d.rank) { route.rank = d.rank; window.Social?.renderSocial(); }
    else if (d.tradeOk || d.tradeNo || d.tradeCancel) {
      const tid = d.tradeOk || d.tradeNo || d.tradeCancel, status = d.tradeOk ? 'accepted' : d.tradeNo ? 'declined' : 'cancelled';
      b.disabled = true;
      try { await db().collection('trades').doc(tid).update({ status, answeredAt: Date.now() }); toast({ accepted: 'Troca aceita', declined: 'Troca recusada', cancelled: 'Proposta cancelada' }[status]); window.Social?.renderSocial(); }
      catch { b.disabled = false; toast('Não consegui atualizar a troca'); }
    } else if (d.tradeApply) {
      const t = find(d.tradeApply); if (!t) return;
      b.disabled = true; b.textContent = 'Atualizando…';
      try { await apply(t); window.Social?.renderSocial(); } catch { b.disabled = false; toast('Não consegui atualizar a coleção'); }
    }
  });
  document.addEventListener('change', e => {
    const id = e.target.dataset?.pick; if (!id || !draft) return;
    e.target.checked ? draft.pick.add(id) : draft.pick.delete(id);
    drawDraft();
  });

  // Quem tem repetida cada carta da sua lista de desejos (usado na aba Desejos).
  const whoHas = () => {
    const out = {};
    for (const p of friends.list) for (const id of p.spares || []) (out[id] ??= []).push(p.username);
    return out;
  };
  return { render, ranking, whoHas };
})();
