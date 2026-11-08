'use strict';
// Escanear em sequência: com o modo ligado, cada carta reconhecida vai para uma lista em vez de abrir o painel.
// No fim, a tela de revisão mostra todas: coleção (quando a arte existe em mais de um set), edição BR/EN,
// variante e quantidade. "Adicionar todas" coloca tudo na coleção de uma vez.
window.Batch = (() => {
  let queue = [], seq = 0;
  const on = () => !!store.batchMode;
  const current = it => it.cards[it.idx];

  /* ---------- Botão e bandeja no scanner ---------- */
  const top = $('.scan-top'), tray = document.createElement('div');
  top?.insertAdjacentHTML('beforeend', '<button id="batchToggle" class="ghost batch-toggle" type="button" aria-pressed="false">Sequência</button>');
  tray.id = 'batchTray'; tray.hidden = true;
  $('#scanner')?.append(tray);
  function paintToggle() {
    const b = $('#batchToggle'); if (!b) return;
    b.classList.toggle('on', on()); b.setAttribute('aria-pressed', on());
    b.textContent = on() ? 'Sequência: ligada' : 'Sequência';
  }
  function paintTray() {
    tray.hidden = !queue.length;
    const n = queue.reduce((s, it) => s + it.qty, 0);
    tray.innerHTML = `<div class="tray-thumbs">${queue.slice(-8).map(it => `<span>${imgTag(current(it), 'low', '')}</span>`).join('')}</div>
      <button class="btn auto" type="button" data-batch-review>Revisar ${n} ${n === 1 ? 'carta' : 'cartas'}</button>`;
  }
  paintToggle();

  /* ---------- Fila ---------- */
  function add({ cards, src }) {
    const same = cards.close || 1;
    const options = cards.slice(0, same);
    const idx = cards.resolved ? Math.max(0, options.findIndex(c => c.id === cards.resolved)) : 0;
    const id = options[idx].id;
    // A mesma carta de novo (outra cópia) soma na quantidade.
    const dup = queue.find(it => current(it).id === id && it.picked);
    if (dup && (same < 2 || cards.resolved)) { dup.qty++; flash(`+1 ${current(dup).name} (${dup.qty} na lista)`); paintTray(); return; }
    const it = { key: ++seq, cards: options, idx, picked: same < 2 || !!cards.resolved, facts: cards.facts || {}, edition: null, variant: null, qty: 1 };
    queue.push(it);
    if (src && !isAsian(id)) readEdition(src, src.width, src.height).then(lang => { if (lang && !it.edition) it.edition = lang; }).catch(() => {});
    navigator.vibrate?.(20);
    flash(`${current(it).name || 'Carta'} na lista (${queue.length}). Enquadre a próxima`);
    paintTray();
  }
  const flash = t => { const s = $('#scanStatus'); if (s) s.textContent = t; };

  /* ---------- Revisão ---------- */
  const details = new Map();
  async function review() {
    if (!queue.length) return;
    paused = true;
    openSheet('<p class="muted">Preparando a revisão…</p>', () => { if (!scanner.hidden) paused = false; });
    await Promise.all(queue.map(async it => { const id = current(it).id; if (!details.has(id)) details.set(id, await getCard(id).catch(() => null)); }));
    draw();
  }
  function draw() {
    if (sheet.hidden) return;
    const n = queue.reduce((s, it) => s + it.qty, 0), missing = queue.filter(it => !it.picked).length;
    sheet.innerHTML = `<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Revisar ${n} ${n === 1 ? 'carta' : 'cartas'}</h2>
      <p class="muted small">Confira cada carta antes de adicionar. A edição foi lida do texto impresso quando possível.</p>
      <div class="batch-list">${queue.map(row).join('')}</div>
      ${missing ? `<p class="warn small">${missing === 1 ? '1 carta precisa' : `${missing} cartas precisam`} da coleção escolhida (a arte existe em mais de um set).</p>` : ''}
      <button class="btn" type="button" data-batch-add${missing ? ' disabled' : ''}>Adicionar ${n} ${n === 1 ? 'carta' : 'cartas'} à coleção</button>
      <div class="row-btns"><button class="btn alt" type="button" data-batch-more>Continuar escaneando</button><button class="btn alt" type="button" data-batch-clear>Limpar a lista</button></div>`;
  }
  function row(it) {
    const c = current(it), d = details.get(c.id), info = d || c;
    const variants = d?.variants?.length ? d.variants : ['normal'];
    const ed = it.edition || store.edition, eds = hasEditions(info);
    const setLabel = x => { const f = it.facts[setIdOf(x.id)] || {}; return `${f.name || setIdOf(x.id)}${f.abbr ? ' · ' + f.abbr : ''} · nº ${x.localId}`; };
    return `<article class="batch-row" data-key="${it.key}">
      <span class="thumb">${imgTag(info, 'low', '')}</span>
      <div class="grow"><b>${esc(info.name || c.name || '')}</b>
        ${it.cards.length > 1 ? `<select class="field" data-b-set="${it.key}"><option value="">Escolha a coleção…</option>${it.cards.map((x, i) => `<option value="${i}"${it.picked && i === it.idx ? ' selected' : ''}>${esc(setLabel(x))}</option>`).join('')}</select>`
          : `<span class="muted small">${esc(info.setName || '')} · nº ${esc(info.localId || c.localId || '')}</span>`}
        <div class="batch-opts">
          ${eds ? `<div class="seg mini" role="group" aria-label="Edição">${[['pt', 'BR'], ['en', 'EN']].map(([k, l]) => `<button type="button" data-b-ed="${it.key}" data-v="${k}" class="${ed === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
          ${variants.length > 1 ? `<select class="field mini" data-b-var="${it.key}">${variants.map(v => `<option value="${v}"${(it.variant || variants[0]) === v ? ' selected' : ''}>${VARIANTS[v]?.label || v}</option>`).join('')}</select>` : ''}
          <div class="stepper"><button type="button" data-b-qty="${it.key}" data-v="-1" aria-label="Menos uma">−</button><span>${it.qty}</span><button type="button" data-b-qty="${it.key}" data-v="1" aria-label="Mais uma">+</button></div>
        </div></div>
      <button type="button" class="link danger small" data-b-del="${it.key}" aria-label="Tirar da lista">✕</button></article>`;
  }
  async function addAll() {
    let n = 0;
    for (const it of queue) {
      try {
        const card = details.get(current(it).id) || await getCard(current(it).id);
        sheetLang = hasEditions(card) ? (it.edition || store.edition) : null;
        const variant = it.variant || card.variants?.[0] || 'normal';
        for (let i = 0; i < it.qty; i++) setQty(card, variant, 1);
        n += it.qty;
      } catch { toast(`Não consegui adicionar ${current(it).name}`); }
    }
    sheetLang = null;
    queue = []; details.clear(); paintTray();
    closeSheet();
    toast(`${n} ${n === 1 ? 'carta adicionada' : 'cartas adicionadas'} à coleção`);
    if (!scanner.hidden) { paused = false; flash('Enquadre a próxima carta'); }
  }

  /* ---------- Eventos ---------- */
  const byKey = k => queue.find(it => it.key === +k);
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (b.id === 'batchToggle') { store.batchMode = !on(); save(); paintToggle(); toast(on() ? 'Modo sequência: as cartas vão para uma lista' : 'Modo sequência desligado'); }
    else if (d.batchReview !== undefined) review();
    else if (d.batchAdd !== undefined) { b.disabled = true; addAll(); }
    else if (d.batchMore !== undefined) closeSheet();
    else if (d.batchClear !== undefined) { if (confirm('Limpar a lista de cartas escaneadas?')) { queue = []; paintTray(); closeSheet(); } }
    else if (d.bEd) { const it = byKey(d.bEd); if (it) { it.edition = d.v; draw(); } }
    else if (d.bQty) { const it = byKey(d.bQty); if (it) { it.qty = Math.max(1, it.qty + +d.v); draw(); paintTray(); } }
    else if (d.bDel) { queue = queue.filter(it => it.key !== +d.bDel); paintTray(); queue.length ? draw() : closeSheet(); }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset?.bVar) { const it = byKey(t.dataset.bVar); if (it) it.variant = t.value; }
    if (t.dataset?.bSet) {
      const it = byKey(t.dataset.bSet); if (!it) return;
      it.picked = t.value !== ''; if (it.picked) it.idx = +t.value;
      const id = current(it).id;
      if (it.picked && !details.has(id)) details.set(id, await getCard(id).catch(() => null));
      draw();
    }
  });

  return { on, add, review, size: () => queue.length };
})();
