'use strict';
// Pastas personalizadas: fichários virtuais montados pela pessoa ("Charizards", "Para vender", "Deck"...).
// Ficam em store.profile.binders = [{ id, name, color, cards: [cardId...], createdAt }] e sincronizam com o perfil.
// A pasta aberta mostra páginas de 9 bolsos (3×3), como um fichário de verdade; no computador, duas páginas lado a lado.
window.Binders = (() => {
  const COLORS = { azul: '#2a6be0', vermelho: '#d6352f', verde: '#1f9d55', roxo: '#7c3aed', laranja: '#f08a1c', preto: '#20232f', rosa: '#e0569b', dourado: '#c8952a' };
  const all = () => store.profile.binders ??= [];
  const byId = id => all().find(b => b.id === id);
  const PER = 9;
  let editing = false;
  const spread = () => matchMedia('(min-width: 1024px)').matches ? 2 : 1;
  const cardOf = id => store.cards[id] || { id, name: id, image: '' };

  /* ---------- Lista de pastas e pasta aberta ---------- */
  function page() {
    const b = route.binder && byId(route.binder);
    return b ? binderView(b) : listView();
  }
  function listView() {
    const bs = all();
    return `<div class="page-head"><p class="muted small">Monte fichários do seu jeito, com páginas de 9 bolsos.</p><button class="btn auto" type="button" data-binder-new>+ Nova pasta</button></div>
      ${bs.length ? `<div class="binder-covers">${bs.map(b => {
        const first = b.cards.map(cardOf).find(c => c.image);
        return `<button type="button" class="binder-cover" data-binder-open="${esc(b.id)}" style="--bc:${COLORS[b.color] || COLORS.azul}">
          <span class="spine"></span><span class="cover-art">${first ? imgTag(first, 'low', '') : '<span class="cover-empty">vazia</span>'}</span>
          <b>${esc(b.name)}</b><span class="small">${b.cards.length} ${b.cards.length === 1 ? 'carta' : 'cartas'}</span></button>`;
      }).join('')}</div>`
        : '<div class="empty"><h2>Nenhuma pasta ainda</h2><p class="muted">Crie pastas como "Charizards", "Para vender" ou "Meu deck" e organize suas cartas em páginas de 9 bolsos.</p></div>'}`;
  }
  function binderView(b) {
    const pages = Math.max(1, Math.ceil((b.cards.length + 1) / PER)), n = spread();
    const at = Math.min(route.binderPage || 0, pages - 1), first = at - (at % n);
    const value = b.cards.reduce((s, id) => s + (store.cards[id] ? unitValue(store.cards[id]) : 0), 0);
    const pageHtml = p => {
      const slots = [];
      for (let i = 0; i < PER; i++) {
        const pos = p * PER + i, id = b.cards[pos];
        if (id) {
          const c = cardOf(id), own = store.cards[id];
          slots.push(`<div class="slot${own ? '' : ' gone'}"><button type="button" class="pocket" data-card="${esc(id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}</button>
            ${editing ? `<span class="slot-tools"><button type="button" data-bmove="${pos}" data-v="-1" aria-label="Mover para trás">◀</button><button type="button" data-bdel="${pos}" aria-label="Tirar da pasta">✕</button><button type="button" data-bmove="${pos}" data-v="1" aria-label="Mover para frente">▶</button></span>` : ''}</div>`);
        } else slots.push(pos === b.cards.length ? '<button type="button" class="slot add" data-binder-pick aria-label="Adicionar cartas">+</button>' : '<span class="slot empty-slot"></span>');
      }
      return `<div class="binder-page"><div class="pockets">${slots.join('')}</div><span class="page-num">${p + 1}</span></div>`;
    };
    const shown = []; for (let p = first; p < Math.min(pages, first + n); p++) shown.push(pageHtml(p));
    return `<button class="back" type="button" data-binder-close>‹ Pastas</button>
      <div class="binder-head" style="--bc:${COLORS[b.color] || COLORS.azul}"><span class="dot"></span><div><h2>${esc(b.name)}</h2><span class="muted small">${b.cards.length} ${b.cards.length === 1 ? 'carta' : 'cartas'} · ${money(value)}</span></div>
        <div class="binder-actions"><button class="btn alt auto" type="button" data-binder-pick>+ Cartas</button><button class="btn alt auto${editing ? ' on' : ''}" type="button" data-binder-edit>${editing ? 'Concluir' : 'Organizar'}</button><button class="btn alt auto" type="button" data-binder-settings>Pasta</button></div></div>
      <div class="binder-spread">${shown.join('')}</div>
      <div class="binder-nav"><button class="btn alt auto" type="button" data-bpage="${first - n}"${first <= 0 ? ' disabled' : ''}>‹ Anterior</button>
        <span class="muted small">Página ${first + 1}${n > 1 && first + 1 < pages ? `–${first + 2}` : ''} de ${pages}</span>
        <button class="btn alt auto" type="button" data-bpage="${first + n}"${first + n >= pages ? ' disabled' : ''}>Próxima ›</button></div>
      ${b.cards.some(id => !store.cards[id]) ? '<p class="muted small">Cartas apagadas aparecem esmaecidas: saíram da coleção, mas continuam reservadas na pasta.</p>' : ''}`;
  }

  /* ---------- Criar, renomear, apagar ---------- */
  function settingsSheet(b) {
    openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>${b ? 'Pasta' : 'Nova pasta'}</h2>
      <form id="binderForm" class="section" data-id="${esc(b?.id || '')}">
        <input id="binderName" class="field" maxlength="40" placeholder="Nome da pasta" aria-label="Nome da pasta" value="${esc(b?.name || '')}" required>
        <div class="swatches colors">${Object.entries(COLORS).map(([k, c]) => `<label class="color-pick"><input type="radio" name="binderColor" value="${k}"${(b?.color || 'azul') === k ? ' checked' : ''}><i style="background:${c}"></i><span>${k}</span></label>`).join('')}</div>
        <button class="btn" type="submit">${b ? 'Salvar' : 'Criar pasta'}</button></form>
      ${b ? '<button class="btn alt danger-btn" type="button" data-binder-delete>Apagar pasta</button><p class="muted small">Apagar a pasta não tira nenhuma carta da sua coleção.</p>' : ''}`);
  }
  /* ---------- Escolher cartas ---------- */
  function picker(b) {
    const q = (route.binderQ || '').trim();
    const cards = list().filter(c => !q || fold(`${c.name} ${c.setName} ${c.localId}`).includes(fold(q))).sort((x, y) => unitValue(y) - unitValue(x)).slice(0, 300);
    openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Cartas para "${esc(b.name)}"</h2>
      <input id="binderSearch" class="field" type="search" placeholder="Procurar nas suas cartas" aria-label="Procurar" value="${esc(q)}" autocomplete="off">
      <div class="picker" id="binderPicker">${cards.map(c => `<button type="button" class="pocket${b.cards.includes(c.id) ? ' on' : ''}" data-bpick="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c)}</button>`).join('')}</div>
      <button class="btn" type="button" data-close>Concluir</button>`);
  }
  // Painel da carta: pôr ou tirar de pastas.
  function cardButton(card) {
    if (!store.cards[card.id]) return '';
    const inside = all().filter(b => b.cards.includes(card.id));
    return `<button class="btn alt" type="button" data-binder-card>${inside.length ? `📁 Em ${inside.length === 1 ? `"${esc(inside[0].name)}"` : `${inside.length} pastas`}` : '📁 Pôr numa pasta'}</button>`;
  }
  function cardSheet(card) {
    openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Pastas</h2><p class="muted small">${esc(card.name)}</p>
      <div class="binder-checks">${all().map(b => `<label class="check"><input type="checkbox" data-bcard="${esc(b.id)}" data-id="${esc(card.id)}"${b.cards.includes(card.id) ? ' checked' : ''}> ${esc(b.name)} <span class="muted small">(${b.cards.length})</span></label>`).join('') || '<p class="muted small">Você ainda não tem pastas.</p>'}</div>
      <button class="btn alt" type="button" data-binder-new>+ Nova pasta</button><button class="btn" type="button" data-binder-back="${esc(card.id)}">Concluir</button>`);
  }

  const redraw = () => { if (route.tab === 'cards') renderMine(); };
  document.addEventListener('click', e => {
    const bt = e.target.closest('button'); if (!bt) return;
    const d = bt.dataset, b = route.binder && byId(route.binder);
    if (d.binderNew !== undefined) settingsSheet(null);
    else if (d.binderOpen) { route.binder = d.binderOpen; route.binderPage = 0; editing = false; renderMine(); window.scrollTo(0, 0); }
    else if (d.binderClose !== undefined) { route.binder = null; editing = false; renderMine(); }
    else if (d.binderSettings !== undefined && b) settingsSheet(b);
    else if (d.binderEdit !== undefined) { editing = !editing; redraw(); }
    else if (d.binderPick !== undefined && b) { route.binderQ = ''; picker(b); }
    else if (d.bpage) { route.binderPage = Math.max(0, +d.bpage); redraw(); }
    else if (d.bpick && b) {
      const i = b.cards.indexOf(d.bpick);
      i >= 0 ? b.cards.splice(i, 1) : b.cards.push(d.bpick);
      bt.classList.toggle('on', i < 0); saveProfile();
    } else if (d.bdel && b) { b.cards.splice(+d.bdel, 1); saveProfile(); redraw(); }
    else if (d.bmove && b) {
      const i = +d.bmove, j = i + +d.v;
      if (j < 0 || j >= b.cards.length) return;
      [b.cards[i], b.cards[j]] = [b.cards[j], b.cards[i]]; saveProfile(); redraw();
    } else if (d.binderDelete !== undefined && b) {
      if (!confirm(`Apagar a pasta "${b.name}"? As cartas continuam na sua coleção.`)) return;
      store.profile.binders = all().filter(x => x.id !== b.id); route.binder = null; saveProfile(); closeSheet();
    } else if (d.binderCard !== undefined && typeof sheetCard !== 'undefined' && sheetCard) cardSheet(sheetCard);
    else if (d.binderBack) showCard(d.binderBack);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset?.bcard) {
      const b = byId(t.dataset.bcard), id = t.dataset.id; if (!b) return;
      const i = b.cards.indexOf(id);
      if (t.checked && i < 0) b.cards.push(id); else if (!t.checked && i >= 0) b.cards.splice(i, 1);
      saveProfile();
    }
  });
  let searchTimer;
  document.addEventListener('input', e => {
    if (e.target.id !== 'binderSearch') return;
    route.binderQ = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { const b = byId(route.binder); if (b) { picker(b); const s = $('#binderSearch'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); } }, 250);
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'binderForm') return;
    e.preventDefault(); e.stopPropagation();
    const name = $('#binderName').value.trim(); if (!name) return;
    const color = $('input[name="binderColor"]:checked')?.value || 'azul', id = e.target.dataset.id;
    const fromCard = typeof sheetCard !== 'undefined' && sheetCard && !route.binder && route.tab !== 'cards' ? sheetCard : null;
    if (id) Object.assign(byId(id), { name, color });
    else { const nb = { id: Date.now().toString(36), name, color, cards: fromCard ? [fromCard.id] : [], createdAt: Date.now() }; all().push(nb); if (!fromCard) { route.tab = 'cards'; route.mview = 'binders'; route.binder = nb.id; route.binderPage = 0; } }
    saveProfile();
    if (fromCard) { toast(`Pasta "${name}" criada com ${fromCard.name}`); cardSheet(fromCard); } else closeSheet();
  }, true);

  return { page, cardButton, sealedPage: () => '' };
})();
