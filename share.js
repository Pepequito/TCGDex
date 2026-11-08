'use strict';
// Imagens para compartilhar (1080×1350, bom para Instagram e WhatsApp), desenhadas no próprio aparelho:
// uma carta, a vitrine do perfil ou o progresso de um set. No celular abre o compartilhar do sistema;
// onde não houver, a imagem é baixada.
window.Share = (() => {
  const W = 1080, H = 1350;
  const SITE = 'boosterz.web.app';
  async function load(src) {
    if (!src) return null;
    try {
      const blob = await (await fetch(src, src.startsWith('http') ? { mode: 'cors' } : {})).blob();
      return await createImageBitmap(blob);
    } catch { return null; }
  }
  const font = (w, s, f = 'Bricolage Grotesque, Avenir Next, system-ui, sans-serif') => `${w} ${s}px ${f}`;
  function base() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#16205a'); bg.addColorStop(.55, '#0b1026'); bg.addColorStop(1, '#070a18');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const [x, y, r, col] of [[180, 120, 420, 'rgba(31,111,255,.35)'], [920, 200, 380, 'rgba(124,58,237,.3)'], [540, 1300, 460, 'rgba(255,116,23,.14)']]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    return { c, g };
  }
  async function frame(g) {
    const logo = await load('icons/logo.webp');
    if (logo) { const w = 300, h = w * (logo.height / logo.width); g.drawImage(logo, (W - w) / 2, 34, w, h); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = font(600, 26, 'IBM Plex Mono, monospace'); g.textAlign = 'center';
    g.fillText(SITE, W / 2, H - 42);
  }
  function text(g, s, x, y, size, color = '#f4f7ff', weight = 800, max = W - 120) {
    g.fillStyle = color; g.font = font(weight, size); g.textAlign = 'center';
    let t = String(s || '');
    while (g.measureText(t).width > max && t.length > 4) t = t.slice(0, -2);
    if (t !== String(s || '')) t = t.slice(0, -1) + '…';
    g.fillText(t, x, y);
  }
  function roundImg(g, img, x, y, w, h, r = 18) {
    g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    if (img) g.drawImage(img, x, y, w, h); else { g.fillStyle = '#1c2550'; g.fillRect(x, y, w, h); }
    g.restore();
  }
  const cardSrc = c => imageUrl(c.image || c.imageEn || '', 'high');

  /* ---------- Os três tipos ---------- */
  async function card(c) {
    const { c: cv, g } = base(); await frame(g);
    const img = await load(cardSrc(c)), w = 600, h = w * 88 / 63, x = (W - w) / 2, y = 230;
    g.save(); g.shadowColor = 'rgba(63,216,255,.45)'; g.shadowBlur = 60; roundImg(g, img, x, y, w, h, 28); g.restore();
    text(g, c.name, W / 2, y + h + 80, 56);
    text(g, [c.setName, c.localId && `nº ${c.localId}`, c.rarity].filter(Boolean).join(' · '), W / 2, y + h + 128, 30, '#a3b1d6', 500);
    const own = store.cards[c.id], usd = own ? unitValue(own) : window.Wish?.refPrice(c);
    if (usd) text(g, money(usd), W / 2, y + h + 190, 48, '#ffb52e');
    return cv;
  }
  async function showcase() {
    const cards = showcaseCards().slice(0, 9);
    if (!cards.length) { toast('Monte sua vitrine primeiro'); return null; }
    const { c: cv, g } = base(); await frame(g);
    text(g, `Vitrine de ${trainerName()}`, W / 2, 250, 54);
    const handle = window.Social?.handle?.();
    text(g, `${handle ? '@' + handle + ' · ' : ''}${plural(copiesCount(), 'carta', 'cartas')} · ${money(collectionValue())}`, W / 2, 300, 30, '#a3b1d6', 500);
    // As cartas encolhem para caber entre o título e o rodapé (de y=340 até y=1250).
    const cols = cards.length <= 4 ? 2 : 3, gap = 24, rows = Math.ceil(cards.length / cols), room = 910;
    const cw = Math.min(cols === 2 ? 330 : 270, (room - (rows - 1) * gap) / rows * 63 / 88), ch = cw * 88 / 63;
    const top = 340 + Math.max(0, (room - rows * ch - (rows - 1) * gap) / 2);
    const imgs = await Promise.all(cards.map(c => load(imageUrl(c.image || c.imageEn || '', 'low'))));
    cards.forEach((c, i) => {
      const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, cards.length - r * cols);
      const x = (W - (inRow * cw + (inRow - 1) * gap)) / 2 + k * (cw + gap), y = top + r * (ch + gap);
      g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; roundImg(g, imgs[i], x, y, cw, ch, 14); g.restore();
    });
    return cv;
  }
  async function set(id) {
    const [s, meta] = await Promise.all([getSet(id), getSets()]);
    const info = meta.find(x => x.id === id), inScope = s.cards.filter(c => parseInt(c.localId, 10) <= s.official && /^\d+$/.test(c.localId));
    const scope = (store.scope[id] || 'all') === 'all' ? s.cards : inScope;
    const have = scope.filter(c => store.cards[c.id]), pct = scope.length ? have.length / scope.length : 0;
    const { c: cv, g } = base(); await frame(g);
    const logo = info ? await load(setArt(info)) : null;
    if (logo) { const k = Math.min(560 / logo.width, 210 / logo.height), lw = logo.width * k, lh = logo.height * k; g.drawImage(logo, (W - lw) / 2, 235 + (210 - lh) / 2, lw, lh); }
    else text(g, s.name, W / 2, 330, 64);
    // Anel de progresso.
    const cx = W / 2, cy = 640, r = 150;
    g.lineWidth = 26; g.strokeStyle = '#26337a'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    const grad = g.createLinearGradient(cx - r, cy, cx + r, cy); grad.addColorStop(0, '#3fd8ff'); grad.addColorStop(.5, '#8b5cf6'); grad.addColorStop(1, '#ff5a2e');
    g.strokeStyle = pct >= 1 ? '#ffc23d' : grad; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); g.stroke();
    text(g, `${Math.floor(pct * 100)}%`, cx, cy + 22, 76);
    text(g, pct >= 1 ? 'Set completo!' : `${have.length} de ${scope.length} cartas`, W / 2, 870, 48);
    text(g, `${trainerName()} no Boosterz`, W / 2, 920, 30, '#a3b1d6', 500);
    const best = [...have].map(c => store.cards[c.id]).filter(Boolean).sort((a, b) => unitValue(b) - unitValue(a)).slice(0, 5);
    const imgs = await Promise.all(best.map(c => load(imageUrl(c.image || c.imageEn || '', 'low'))));
    const cw = 168, ch = cw * 88 / 63, gap = 18, startX = (W - (best.length * cw + (best.length - 1) * gap)) / 2;
    best.forEach((c, i) => { g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 18; roundImg(g, imgs[i], startX + i * (cw + gap), 980, cw, ch, 10); g.restore(); });
    return cv;
  }

  /* ---------- Entregar a imagem ---------- */
  async function deliver(canvas, name) {
    if (!canvas) return;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], `${name}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Boosterz' }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Imagem salva');
  }
  async function run(btn, make, name) {
    const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Gerando imagem…';
    try { await deliver(await make(), name); } catch { toast('Não consegui gerar a imagem'); }
    btn.disabled = false; btn.innerHTML = label;
  }
  const slug = s => String(s || 'boosterz').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase();

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shareCard !== undefined && typeof sheetCard !== 'undefined' && sheetCard) run(b, () => card(sheetCard), 'boosterz-' + slug(sheetCard.name));
    else if (b.dataset.shareShowcase !== undefined) run(b, showcase, 'boosterz-vitrine');
    else if (b.dataset.shareSet) run(b, () => set(b.dataset.shareSet), 'boosterz-' + slug(b.dataset.shareSet));
  });
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
  return {
    make: { card, showcase, set },
    cardButton: c => c.image || c.imageEn ? `<button class="btn alt share-btn" type="button" data-share-card>${ICON} Compartilhar imagem</button>` : '',
    showcaseButton: () => `<button type="button" class="share-link" data-share-showcase>${ICON} Compartilhar</button>`,
    setButton: id => `<button type="button" class="btn alt auto share-btn" data-share-set="${esc(id)}">${ICON} Compartilhar</button>`,
  };
})();
