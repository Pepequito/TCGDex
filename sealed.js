'use strict';
// Produtos lacrados: boosters, ETBs, caixas, latas... Ficam em store.profile.sealed e sincronizam com o perfil.
// Nenhuma base aberta tem preço de lacrados, então o valor atual é informado pela pessoa (em reais, por unidade).
// Item: { id, type, setId, setName, name, qty, paid, value, photo, addedAt }  (paid e value em R$ por unidade)
window.Sealed = (() => {
  const TYPES = [['booster', 'Booster'], ['blister', 'Blister'], ['etb', 'Treinador Avançado (ETB)'], ['box', 'Booster Box'], ['collection', 'Coleção / Box especial'],
    ['tin', 'Lata'], ['deck', 'Deck / Kit de batalha'], ['bundle', 'Pacote de boosters (bundle)'], ['other', 'Outro']];
  const typeName = k => (TYPES.find(t => t[0] === k) || TYPES[TYPES.length - 1])[1];
  const all = () => store.profile.sealed ??= [];
  const brl = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const totals = () => all().reduce((t, s) => ({ paid: t.paid + (s.paid || 0) * s.qty, value: t.value + (s.value ?? s.paid ?? 0) * s.qty, items: t.items + s.qty }), { paid: 0, value: 0, items: 0 });
  // Valor em dólar, para somar com o da coleção na tela inicial (o app guarda tudo em dólar).
  const valueUsd = () => totals().value / (store.fx?.BRL || 5.4);
  let sets = [];
  const setLogo = s => { const meta = sets.find(x => x.id === s.setId); return meta ? setArt(meta) : ''; };

  function page() {
    const items = all(), t = totals(), diff = t.value - t.paid;
    if (!sets.length) getSets().then(x => { sets = x; if (route.tab === 'cards' && route.mview === 'sealed') renderMine(); }).catch(() => {});
    const head = `<div class="page-head"><p class="muted small">Boosters, ETBs, caixas e latas fechados. O valor de hoje é você quem informa.</p><button class="btn auto" type="button" data-sealed-new>+ Adicionar lacrado</button></div>`;
    if (!items.length) return `${head}<div class="empty"><h2>Nenhum lacrado ainda</h2><p class="muted">Cadastre os produtos fechados da sua coleção para acompanhar quanto pagou e quanto valem hoje.</p></div>`;
    return `${head}
      <div class="stat-grid"><div class="stat"><b>${t.items}</b><span>Itens lacrados</span></div><div class="stat"><b>${brl(t.paid)}</b><span>Total pago</span></div>
        <div class="stat"><b>${brl(t.value)}</b><span>Valor hoje</span></div><div class="stat"><b class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : '−'}${brl(Math.abs(diff))}</b><span>${t.paid ? `${diff >= 0 ? 'Lucro' : 'Prejuízo'} de ${Math.abs(diff / t.paid * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : 'Diferença'}</span></div></div>
      <div class="sealed-grid">${[...items].sort((a, b) => (b.value ?? b.paid ?? 0) * b.qty - (a.value ?? a.paid ?? 0) * a.qty).map(s => {
        const unit = s.value ?? s.paid ?? 0, gain = s.paid ? (unit - s.paid) * s.qty : null, logo = setLogo(s);
        return `<button type="button" class="sealed-item" data-sealed-edit="${esc(s.id)}">
          <span class="sealed-art">${s.photo ? `<img src="${esc(s.photo)}" alt="">` : logo ? `<img class="logo-art" src="${esc(logo)}" alt="">` : `<span class="sealed-icon">📦</span>`}${s.qty > 1 ? `<span class="qty">×${s.qty}</span>` : ''}</span>
          <span class="sealed-info"><b>${esc(s.name || typeName(s.type))}</b><span class="muted small">${esc(typeName(s.type))}${s.setName ? ' · ' + esc(s.setName) : ''}</span>
            <span class="small">Hoje: <b>${brl(unit * s.qty)}</b>${s.qty > 1 ? ` <span class="muted">(${brl(unit)} cada)</span>` : ''}</span>
            ${gain != null ? `<span class="small ${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '▲' : '▼'} ${brl(Math.abs(gain))} sobre o pago</span>` : ''}</span></button>`;
      }).join('')}</div>`;
  }

  /* ---------- Formulário ---------- */
  async function form(item) {
    if (!sets.length) sets = await getSets().catch(() => []);
    const west = sets.filter(s => regionOf(s.id) === 'west' && !s.soon);
    const s = item || { type: 'etb', qty: 1 };
    openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>${item ? 'Editar lacrado' : 'Adicionar lacrado'}</h2>
      <form id="sealedForm" class="section" data-id="${esc(item?.id || '')}">
        <label class="small muted">Tipo<select id="sType" class="field">${TYPES.map(([k, l]) => `<option value="${k}"${s.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="small muted">Set (opcional)<select id="sSet" class="field"><option value="">Sem set específico</option>${west.map(x => `<option value="${esc(x.id)}"${s.setId === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <input id="sName" class="field" maxlength="60" placeholder="Nome (ex.: ETB Reinado Delta)" aria-label="Nome" value="${esc(s.name || '')}">
        <div class="two"><label class="small muted">Quantidade<input id="sQty" class="field" type="number" min="1" max="999" value="${s.qty || 1}"></label>
          <label class="small muted">Pago por unidade (R$)<input id="sPaid" class="field" inputmode="decimal" placeholder="0,00" value="${esc(brlText(s.paid))}"></label></div>
        <label class="small muted">Valor de hoje por unidade (R$)<input id="sValue" class="field" inputmode="decimal" placeholder="Igual ao pago" value="${esc(brlText(s.value))}"></label>
        <label class="btn alt" for="sPhoto" id="sPhotoLabel">${s.photo ? 'Foto escolhida ✓ (trocar)' : '📷 Foto do produto (opcional)'}</label><input id="sPhoto" type="file" accept="image/*" hidden>
        <button class="btn" type="submit">${item ? 'Salvar' : 'Adicionar'}</button></form>
      ${item ? '<button class="btn alt danger-btn" type="button" data-sealed-delete>Excluir este item</button>' : ''}`);
    pendingPhoto = undefined;
  }
  let pendingPhoto;
  async function shrink(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 320 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .65);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sealedNew !== undefined) form(null);
    else if (b.dataset.sealedEdit) form(all().find(s => s.id === b.dataset.sealedEdit));
    else if (b.dataset.sealedDelete !== undefined) {
      const id = $('#sealedForm')?.dataset.id; if (!id || !confirm('Excluir este item lacrado?')) return;
      store.profile.sealed = all().filter(s => s.id !== id); saveProfile(); closeSheet();
    }
  });
  document.addEventListener('change', async e => {
    if (e.target.id === 'sSet' && !$('#sName').value.trim()) {
      const set = sets.find(x => x.id === e.target.value), type = $('#sType').value;
      if (set) $('#sName').placeholder = `${typeName(type).replace(/ \(.*\)/, '')} ${set.name}`;
    }
    if (e.target.id === 'sPhoto' && e.target.files[0]) {
      pendingPhoto = await shrink(e.target.files[0]).catch(() => undefined);
      $('#sPhotoLabel').textContent = pendingPhoto ? 'Foto escolhida ✓' : 'Não consegui ler a foto';
    }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'sealedForm') return;
    e.preventDefault(); e.stopPropagation();
    const id = e.target.dataset.id, set = sets.find(x => x.id === $('#sSet').value), type = $('#sType').value;
    const paid = parseBrl($('#sPaid').value), value = parseBrl($('#sValue').value);
    const data = {
      type, setId: set?.id || '', setName: set?.name || '', qty: Math.max(1, Math.min(999, +$('#sQty').value || 1)),
      name: $('#sName').value.trim() || (set ? `${typeName(type).replace(/ \(.*\)/, '')} ${set.name}` : typeName(type)),
      paid, value: value ?? null,
    };
    if (id) { const s = all().find(x => x.id === id); Object.assign(s, data); if (pendingPhoto) s.photo = pendingPhoto; }
    else all().push({ id: Date.now().toString(36), ...data, photo: pendingPhoto || '', addedAt: Date.now() });
    saveProfile(); closeSheet();
    toast(id ? 'Lacrado atualizado' : 'Lacrado adicionado');
  }, true);

  return { page, totals, valueUsd, count: () => all().length };
})();
