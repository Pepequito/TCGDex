'use strict';
// Fotos da comunidade para cartas que nenhuma base pública tem com imagem.
// - cardPhotos/{id}: envio de um membro, esperando aprovação { cardId, name, setName, photo, uid, username, at, status }
// - cardImages/{cardId codificado}: foto aprovada { cardId, photo, by, at }
// - cardImages/_index: { items: { cardId: at } } — lista curta que o app lê uma vez por sessão.
// A foto só é baixada quando a carta aparece na tela e fica guardada no aparelho (Cache Storage).
window.Photos = (() => {
  const db = () => window.Sync?.ctx?.().db;
  const enc = id => encodeURIComponent(id);
  const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88"><rect width="63" height="88" rx="4" fill="#1a2348"/></svg>');
  const CACHE = 'boosterz-photos';
  let index = {};
  try { index = JSON.parse(localStorage.getItem('boosterz.photoIndex') || '{}').items || {}; } catch { /* sem índice guardado */ }
  const has = id => !!index[id];

  /* ---------- Índice e exibição ---------- */
  async function loadIndex() {
    for (let t = 0; !db() && t < 15000; t += 300) await new Promise(r => setTimeout(r, 300));
    if (!db()) return;
    try {
      const d = await db().collection('cardImages').doc('_index').get();
      const next = d.data()?.items || {};
      const changed = JSON.stringify(next) !== JSON.stringify(index);
      index = next;
      try { localStorage.setItem('boosterz.photoIndex', JSON.stringify({ items: index, at: Date.now() })); } catch { /* sem espaço */ }
      if (changed && Object.keys(index).length && sheet.hidden && scanner.hidden) render();
    } catch { /* sem conexão: fica com o índice guardado */ }
  }
  async function photoOf(id) {
    const key = `https://boosterz.local/photo/${enc(id)}/${index[id]}`;
    try {
      const cache = await caches.open(CACHE), hit = await cache.match(key);
      if (hit) return await hit.text();
      const d = await db()?.collection('cardImages').doc(enc(id)).get();
      const photo = d?.data()?.photo || '';
      if (photo) await cache.put(key, new Response(photo));
      return photo;
    } catch { return ''; }
  }
  // Toda imagem marcada com data-cimg que entra na página recebe a foto aprovada.
  function hydrate(root = document) {
    for (const img of root.querySelectorAll?.('img[data-cimg]:not([data-ready])') || []) {
      img.dataset.ready = '1';
      photoOf(img.dataset.cimg).then(src => { if (src) img.src = src; });
    }
  }
  new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) hydrate(n); })
    .observe(document.documentElement, { childList: true, subtree: true });
  const imgHtml = (id, alt) => `<img loading="lazy" alt="${esc(alt)}" data-cimg="${esc(id)}" src="${PLACEHOLDER}">`;

  /* ---------- Envio ---------- */
  const canSend = card => !card.image && !has(card.id) && card.setId !== 'custom';
  const sendButton = card => canSend(card)
    ? `<div class="photo-ask"><p class="small muted">Nenhuma base pública tem a imagem desta carta. Se você tem a carta, mande uma foto: depois de aprovada, ela aparece para todo mundo.</p>
      <label class="btn alt" for="cardPhotoInput">📷 Enviar foto desta carta</label><input id="cardPhotoInput" type="file" accept="image/*" capture="environment" hidden></div>`
    : '';
  // Reduz a foto e, se ela estiver próxima do formato de carta, corta as sobras.
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
    const ratio = 63 / 88;
    if (sw / sh > ratio) { const w = sh * ratio; sx = (sw - w) / 2; sw = w; } else { const h = sw / ratio; sy = (sh - h) / 2; sh = h; }
    const c = document.createElement('canvas');
    c.height = Math.min(700, Math.round(sh)); c.width = Math.round(c.height * ratio);
    c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    for (const q of [.78, .68, .58]) { const url = c.toDataURL('image/jpeg', q); if (url.length < 280000) return url; }
    return c.toDataURL('image/jpeg', .5);
  }
  async function submit(card, file) {
    const u = window.Sync?.ctx?.().user;
    if (!u) { toast('Entre na sua conta para enviar fotos'); return; }
    const box = $('.photo-ask');
    if (box) box.innerHTML = '<p class="muted small">Enviando a foto…</p>';
    try {
      const photo = await shrink(file);
      await db().collection('cardPhotos').add({
        cardId: card.id, name: card.name || '', setName: card.setName || '', localId: card.localId || '', photo,
        uid: u.uid, username: window.Social?.handle?.() || '', at: Date.now(), status: 'pending',
      });
      if (box) box.innerHTML = '<p class="small ok-note">Foto enviada ✓ Assim que for aprovada, ela aparece para todo mundo. Obrigado!</p>';
    } catch {
      if (box) box.innerHTML = '<p class="small warn">Não consegui enviar agora. Confira a conexão e tente de novo.</p>';
    }
  }

  /* ---------- Admin: aprovar ou recusar ---------- */
  let pending = [];
  async function adminBlock() {
    const box = $('#adminPhotos'); if (!box) return;
    try {
      const snap = await db().collection('cardPhotos').limit(100).get();
      pending = snap.docs.map(d => ({ ...d.data(), pid: d.id })).filter(p => p.status === 'pending').sort((a, b) => a.at - b.at);
    } catch { box.innerHTML = '<p class="muted">Não consegui ler as fotos enviadas. Confira as regras do Firestore.</p>'; return; }
    drawAdmin();
  }
  function drawAdmin() {
    const box = $('#adminPhotos'); if (!box) return;
    box.innerHTML = pending.length ? `<div class="photo-grid">${pending.map(p => `<article class="panel photo-item">
        <img src="${esc(p.photo)}" alt="Foto enviada de ${esc(p.name)}">
        <div><b>${esc(p.name || p.cardId)}</b><span class="muted small">${esc(p.setName)} · nº ${esc(p.localId)} · ${esc(p.cardId)}</span>
          <span class="muted small">por ${esc(p.username ? '@' + p.username : p.uid.slice(0, 6))} · ${new Date(p.at).toLocaleDateString('pt-BR')}</span></div>
        <div class="row-btns"><button class="btn" type="button" data-photo-ok="${esc(p.pid)}">Aprovar</button><button class="btn alt" type="button" data-photo-no="${esc(p.pid)}">Recusar</button></div></article>`).join('')}</div>`
      : '<p class="muted">Nenhuma foto esperando aprovação.</p>';
  }
  async function approve(pid) {
    const p = pending.find(x => x.pid === pid); if (!p) return;
    const at = Date.now(), batch = db().batch();
    batch.set(db().collection('cardImages').doc(enc(p.cardId)), { cardId: p.cardId, photo: p.photo, by: p.uid, username: p.username || '', at });
    batch.set(db().collection('cardImages').doc('_index'), { items: { [p.cardId]: at } }, { merge: true });
    batch.delete(db().collection('cardPhotos').doc(pid));
    // Outras fotos da mesma carta ficam sem efeito: a primeira aprovada vale.
    for (const o of pending.filter(x => x.cardId === p.cardId && x.pid !== pid)) batch.delete(db().collection('cardPhotos').doc(o.pid));
    await batch.commit();
    index[p.cardId] = at;
    pending = pending.filter(x => x.cardId !== p.cardId);
    drawAdmin();
    toast(`Foto de ${p.name} aprovada`);
  }

  document.addEventListener('change', e => {
    if (e.target.id !== 'cardPhotoInput' || !e.target.files[0]) return;
    const card = typeof sheetCard !== 'undefined' && sheetCard;
    if (card) submit(card, e.target.files[0]);
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.photoOk) { b.disabled = true; try { await approve(b.dataset.photoOk); } catch { b.disabled = false; toast('Não consegui aprovar'); } }
    else if (b.dataset.photoNo) {
      b.disabled = true;
      try { await db().collection('cardPhotos').doc(b.dataset.photoNo).delete(); pending = pending.filter(x => x.pid !== b.dataset.photoNo); drawAdmin(); }
      catch { b.disabled = false; toast('Não consegui recusar'); }
    }
  });

  loadIndex();
  return { has, imgHtml, sendButton, adminBlock, pendingCount: () => pending.length };
})();
