'use strict';
// Interface de computador: painel em colunas, tabela da coleção, gaveta lateral, atalhos e arrastar foto.
// No celular nada daqui aparece; as telas comuns continuam em views.js.
window.Desk = (() => {
  const wide = matchMedia('(min-width: 1024px)');
  const sort = { key: 'total', dir: -1 };
  const filter = { q: '', set: '', kind: '' };

  function chrome() {
    const side = $('#sideUser'), top = $('#deskAvatar');
    if (!side || !top) return;
    const total = collectionValue(), n = copiesCount();
    side.innerHTML = `<button type="button" class="side-user" data-tab="profile" aria-label="Abrir perfil"><span class="ring-avatar" ${ringAttrs(store.profile.ring)}>${avatar()}</span>
      <span class="who"><b>${esc(trainerName())}</b><span class="mono">${money(total)}</span><span>${plural(n, 'carta', 'cartas')}</span></span></button>`;
    top.innerHTML = avatar();
  }
  function render() {
    chrome();
    if (!wide.matches) return false;
    if (route.tab === 'home') { home(); return true; }
    if (route.tab === 'cards' && route.mview !== 'dupes') { cards(); return true; }
    return false;
  }

  /* ---------- Painel inicial ---------- */
  function setRow(s, have) {
    const size = s.total || s.official || 1, pct = Math.min(100, have / size * 100), art = setArt(s);
    return `<button class="set-row${have >= size ? ' done' : ''}" type="button" data-set="${esc(s.id)}">
      <span class="mini-logo${art ? '' : ' nologo'}">${art ? `<img alt="" loading="lazy" data-logo data-next="${artFallback(s)}" src="${esc(art)}">` : ''}<em>${esc(setCode(s))}</em></span>
      <span class="grow"><b>${esc(s.name)}</b><span class="bar"><i style="width:${pct}%"></i></span></span>
      <span class="num muted">${have}/${size}</span></button>`;
  }
  async function home() {
    const all = list(), total = collectionValue(), copies = copiesCount();
    trackValue(total);
    const range = route.range || '30';
    const top = [...all].sort((a, b) => unitValue(b) - unitValue(a)).slice(0, 6);
    const recent = [...all].sort((a, b) => b.addedAt - a.addedAt).slice(0, 6);
    const show = showcaseCards().slice(0, 9);
    const dupes = all.filter(c => qtyOf(c) > 1), spare = dupes.reduce((s, c) => s + spareValue(c), 0);
    const hot = all.filter(c => potential(c)?.high).length;
    const ch = valueChange(range);
    const when = t => { const d = (Date.now() - t) / 864e5; return d < 1 ? 'hoje' : d < 2 ? 'ontem' : `há ${Math.floor(d)} dias`; };
    const row = (c, right, sub) => `<button type="button" class="list-row" data-card="${esc(c.id)}"><span class="thumb">${imgTag(c, 'low', '')}</span>
      <span class="grow"><b>${esc(c.name)}</b><span class="muted small">${esc(sub)}</span></span><span class="num right-val">${right}</span></button>`;
    view.innerHTML = `<div class="page-head"><div><span class="muted">Olá, treinador</span><h1>${esc(trainerName())}</h1></div>
        <div class="quick"><button class="btn alt auto" type="button" data-tab="search">Explorar cartas</button><button class="btn auto" type="button" data-scan>Escanear carta</button></div></div>
      ${window.Sync?.nudge() || ''}
      <section class="portfolio">
        <div class="pf-main">
          <span class="label">Valor da coleção</span>
          <span class="value">${money(total)}</span>
          ${ch ? `<span class="delta ${ch.diff >= 0 ? 'up' : 'down'}">${ch.diff >= 0 ? '▲' : '▼'} ${money(Math.abs(ch.diff))} (${ch.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) <span class="muted">${ch.label}</span></span>` : '<span class="muted small">A variação aparece a partir do segundo dia de uso.</span>'}
          <div class="pf-stats">
            <button type="button" data-mine="all"><b>${copies}</b><span>Cartas</span></button>
            <button type="button" data-mine="all"><b>${all.length}</b><span>Diferentes</span></button>
            <button type="button" data-mine="dupes"><b>${money(spare)}</b><span>Em repetidas</span></button>
            <button type="button" data-mine="hot"><b>${hot}</b><span>📈 Valorizando</span></button>
          </div>
        </div>
        <div class="pf-chart">
          <div class="seg range" role="group" aria-label="Período do gráfico">${[['7', '7D'], ['30', '1M'], ['90', '3M'], ['all', 'Tudo']].map(([k, l]) => `<button type="button" data-range="${k}" class="${range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${all.length ? valueChart(range) : '<p class="muted">Escaneie ou busque cartas para começar a acompanhar o valor.</p>'}
        </div>
      </section>
      <div class="dash3">
        <section class="panel"><div class="panel-head"><h2>Mais valiosas</h2><button type="button" data-mine="all">Ver todas</button></div>
          <div class="list">${top.length ? top.map(c => row(c, money(unitValue(c)), `${c.setName} · ${c.localId}`)).join('') : '<p class="muted">Nenhuma carta ainda.</p>'}</div></section>
        <section class="panel"><div class="panel-head"><h2>Seus sets</h2><button type="button" data-my-sets>Ver todos</button></div>
          <div class="set-rows" id="deskSets">${all.length ? '<p class="muted">Carregando…</p>' : '<p class="muted">Os sets das suas cartas aparecem aqui.</p>'}</div></section>
        <section class="panel"><div class="panel-head"><h2><button type="button" class="head-link" data-mine="recent">Adicionadas recentemente ›</button></h2><button type="button" data-mine="recent">Últimas 100</button></div>
          <div class="list">${recent.length ? recent.map(c => row(c, `<span class="muted small">${when(c.addedAt)}</span>`, c.setName)).join('') : '<p class="muted">Nada adicionado ainda.</p>'}</div></section>
      </div>
      <section class="panel showcase-strip"><div class="panel-head"><h2>Vitrine</h2><button type="button" data-tab="profile">Ver perfil</button></div>
        ${show.length ? `<div class="strip">${show.map(c => `<button type="button" class="strip-card" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}</button>`).join('')}</div>`
          : '<p class="muted small">Sua vitrine está vazia. Escolha suas cartas favoritas no perfil para deixá-las em destaque aqui e no seu perfil público.</p>'}</section>`;
    bindChart();
    if (!all.length) return;
    try {
      const sets = await getSets(), owned = ownedBySet(), latest = {};
      for (const c of all) latest[c.setId] = Math.max(latest[c.setId] || 0, c.addedAt);
      const mine = sets.filter(s => owned[s.id]);
      if (owned.custom) mine.push(customSet());
      const box = $('#deskSets');
      if (box) box.innerHTML = mine.sort((a, b) => latest[b.id] - latest[a.id]).slice(0, 6).map(s => setRow(s, owned[s.id])).join('');
    } catch { const box = $('#deskSets'); if (box) box.innerHTML = '<p class="muted">Sem conexão.</p>'; }
  }

  /* ---------- Minhas cartas ---------- */
  const kindOf = c => c.setId === 'custom' ? 'custom' : regionOf(c.id);
  const unit = c => qtyOf(c) ? valueOf(c) / qtyOf(c) : 0;
  const COLS = [
    ['name', 'Carta', c => c.name],
    ['set', 'Set', c => c.setName],
    ['num', 'Nº', c => parseInt(c.localId, 10) || 0],
    ['rarity', 'Raridade', c => c.rarity || ''],
    ['qty', 'Qtd.', qtyOf],
    ['unit', 'Valor un.', unit],
    ['total', 'Total', valueOf],
  ];
  function rows() {
    const q = norm(filter.q);
    const col = COLS.find(c => c[0] === sort.key)[2];
    const view_ = route.mview || 'all';
    const r = list().filter(c => (!q || norm(c.name).includes(q) || norm(c.setName).includes(q))
      && (!filter.set || c.setId === filter.set) && (!filter.kind || kindOf(c) === filter.kind)
      && (view_ !== 'dupes' || qtyOf(c) > 1) && (view_ !== 'hot' || potential(c)?.high));
    if (view_ === 'recent') return r.sort((a, b) => b.addedAt - a.addedAt).slice(0, 100);
    return r.sort((a, b) => { const x = col(a), y = col(b); return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) * sort.dir; });
  }
  function tableBody() {
    const r = rows(), copies = r.reduce((a, c) => a + qtyOf(c), 0), total = r.reduce((a, c) => a + valueOf(c), 0);
    const body = r.map(c => `<tr data-card="${esc(c.id)}" tabindex="0">
      <td><span class="cell-card"><span class="thumb">${imgTag(c, 'low', '')}</span><b>${esc(c.name)}</b>${hotBadge(c)}${(c.graded || []).map(g => ` <span class="pill slab-pill">${esc(gradeLabel(g))}</span>`).join('')}${store.profile.showcase.includes(c.id) ? '<span class="star-mark" title="Na vitrine">★</span>' : ''}</span></td>
      <td>${esc(c.setName)}${tagOf(c.id) ? ` <span class="pill">${tagOf(c.id)}</span>` : ''}</td><td class="num">${esc(c.localId)}</td><td class="muted col-rarity">${esc(c.rarity || '—')}</td>
      <td class="num right">${qtyOf(c)}</td><td class="num right">${money(unit(c))}${c.custom != null ? ' <span class="pill">seu</span>' : ''}</td><td class="num right"><b>${money(valueOf(c))}</b></td></tr>`).join('');
    return `<tbody>${body || '<tr><td colspan="7" class="muted empty-row">Nenhuma carta com esses filtros.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3">${plural(r.length, 'carta diferente', 'cartas diferentes')}</td><td class="col-rarity"></td><td class="num right">${copies}</td><td></td><td class="num right"><b>${money(total)}</b></td></tr></tfoot>`;
  }
  function head() {
    return `<thead><tr>${COLS.map(([k, label], i) => `<th class="${i >= 4 ? 'right' : ''}${k === 'rarity' ? ' col-rarity' : ''}" aria-sort="${sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">
      <button type="button" data-sort="${k}">${label}${sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>`;
  }
  function cards() {
    const all = list(), sets = new Map(all.map(c => [c.setId, c.setName]));
    view.innerHTML = `<div class="page-head"><div><h1>Minhas cartas</h1><span class="muted">${plural(copiesCount(), 'carta', 'cartas')} · ${money(collectionValue())}</span></div>
        <button class="btn alt auto" type="button" data-csv>Exportar planilha</button></div>
      <div class="seg mine-views" role="tablist" aria-label="Quais cartas">${MINE_TABS.slice().sort((x, y) => (x[0] === 'all' ? -1 : y[0] === 'all' ? 1 : 0)).map(([k, l]) => `<button type="button" role="tab" data-mine="${k}" class="${(route.mview || 'all') === k ? 'on' : ''}">${k === 'recent' ? 'Últimas 100' : l}</button>`).join('')}</div>
      <div class="toolbar">
        <input id="cardFilter" class="field" type="search" placeholder="Filtrar por nome ou set" aria-label="Filtrar cartas" value="${esc(filter.q)}" autocomplete="off">
        <select id="cardSet" class="field" aria-label="Set"><option value="">Todos os sets</option>${[...sets].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, name]) => `<option value="${esc(id)}"${filter.set === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>
        <select id="cardKind" class="field" aria-label="Tipo"><option value="">Todas as edições</option>${[['west', 'Ocidentais'], ['ja', 'Japonesas'], ['zh', 'Chinesas'], ['custom', 'Cadastradas à mão']].map(([k, l]) => `<option value="${k}"${filter.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      ${all.length ? `<div class="table-wrap"><table class="table" id="cardTable">${head()}${tableBody()}</table></div>`
        : '<div class="empty"><h2>Nenhuma carta ainda</h2><p class="muted">Escaneie uma carta, busque pelo nome ou arraste uma foto para esta janela.</p></div>'}`;
  }
  function redrawTable() {
    const t = $('#cardTable'); if (!t) return;
    t.innerHTML = head() + tableBody();
  }
  function csv() {
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`, num = v => v.toFixed(2).replace('.', ',');
    const brl = v => num(store.fx ? v * store.fx.BRL : v);
    const lines = [['Carta', 'Set', 'Número', 'Raridade', 'Edição', 'Quantidade', 'Graduadas', 'Valor unitário (R$)', 'Total (R$)'].map(cell).join(';'),
      ...rows().map(c => [c.name, c.setName, c.localId, c.rarity, { west: 'Ocidental', ja: 'Japonesa', zh: 'Chinesa', custom: 'Cadastrada' }[kindOf(c)], qtyOf(c), (c.graded || []).map(g => gradeLabel(g) + (g.cert ? ` (${g.cert})` : '')).join(', '), brl(unit(c)), brl(valueOf(c))].map(cell).join(';'))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `fichario-colecao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', e => {
    const row = e.target.closest('tr[data-card]');
    if (row) { showCard(row.dataset.card); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sort) {
      const k = b.dataset.sort;
      if (sort.key === k) sort.dir *= -1; else { sort.key = k; sort.dir = ['name', 'set', 'num', 'rarity'].includes(k) ? 1 : -1; }
      redrawTable();
    } else if (b.dataset.csv !== undefined) csv();
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'cardFilter') { filter.q = e.target.value; redrawTable(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'cardSet') { filter.set = e.target.value; redrawTable(); }
    if (e.target.id === 'cardKind') { filter.kind = e.target.value; redrawTable(); }
  });
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'deskSearch') return;
    e.preventDefault();
    const q = $('#deskQ').value.trim(); if (!q) return;
    explore.shown = PAGE;
    go({ tab: 'search', q });
  });
  // Teclado: / busca, Enter abre a linha, ← e → passam de carta com a gaveta aberta.
  document.addEventListener('keydown', e => {
    if (!wide.matches) return;
    const typing = !!e.target.matches?.('input, textarea, select');
    if (e.key === '/' && !typing) { e.preventDefault(); $('#deskQ')?.focus(); return; }
    if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Enter' && e.target.matches?.('tr[data-card]')) { showCard(e.target.dataset.card); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !sheet.hidden && sheetCard) {
      const ids = [...new Set($$('#view [data-card]').map(el => el.dataset.card))];
      const i = ids.indexOf(sheetCard.id);
      const next = ids[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (i >= 0 && next) { e.preventDefault(); showCard(next); }
    }
  });
  // Arrastar uma foto para a janela identifica a carta, como o scanner.
  let depth = 0;
  const hasFile = e => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', e => { if (!hasFile(e)) return; depth++; document.body.classList.add('dropping'); });
  document.addEventListener('dragleave', e => { if (!hasFile(e)) return; if (--depth <= 0) { depth = 0; document.body.classList.remove('dropping'); } });
  document.addEventListener('dragover', e => { if (hasFile(e)) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (!hasFile(e)) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('dropping');
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (!file) { toast('Solte uma imagem da carta'); return; }
    toast('Procurando a carta…');
    fromPhoto(file).catch(() => toast('Não consegui ler essa imagem'));
  });
  wide.addEventListener('change', () => render && window.render());

  return { render, chrome };
})();
render();
