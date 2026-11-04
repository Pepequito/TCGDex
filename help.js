'use strict';
// Ajuda: perguntas frequentes e "reportar problema". Os relatos vão para reports/{id} no Firestore,
// e só a conta do desenvolvedor (DEV) consegue ler e apagar, pela tela "Relatórios recebidos".
window.Help = (() => {
  const DEV = 'pedrohblour@gmail.com';
  const KINDS = [
    ['missing', 'Não encontro uma carta'],
    ['scan', 'O scanner não reconhece uma carta'],
    ['art', 'Carta ou set sem imagem'],
    ['wrong', 'Informação errada (nome, set, preço)'],
    ['bug', 'Algo no app não funciona'],
    ['idea', 'Sugestão'],
  ];
  const kindLabel = k => (KINDS.find(x => x[0] === k) || [, 'Outro'])[1];
  const FAQ = [
    ['Onde ficam salvos os meus dados?', 'Com conta, a coleção fica na nuvem e aparece em qualquer aparelho em que você entrar. Como convidado, tudo fica só na memória deste aparelho: se você apagar os dados do navegador, trocar de celular ou remover o app, a coleção some. Nesse caso, use Ajustes › Backup de vez em quando.'],
    ['Como o scanner reconhece as cartas?', 'Ele compara a ilustração da carta com uma base de mais de 30 mil artes, direto no aparelho. Enquadre a carta inteira na moldura, com boa luz e sem reflexo. Se a carta existe em mais de uma coleção (reimpressões), o app pede para você escolher a coleção certa antes de adicionar.'],
    ['O scanner não reconhece minha carta. E agora?', 'Algumas cartas recentes, promocionais ou de edições asiáticas ainda não estão na base de artes. Use Explorar para achar pelo nome ou número. Se nem assim aparecer, toque em "Reportar problema" aqui embaixo para corrigirmos.'],
    ['Por que algumas cartas e sets aparecem sem imagem?', 'As imagens vêm de bases públicas (TCGdex e Pokémon TCG API), que ainda não têm todas as cartas, principalmente japonesas e chinesas. Vamos completando conforme as bases são atualizadas. Reportar ajuda a priorizar.'],
    ['De onde vem o preço das cartas?', 'Do preço de mercado da TCGplayer (EUA) e, quando não houver, da Cardmarket (Europa), convertidos pela cotação do dia. Os preços são atualizados sozinhos uma vez por dia. Você pode definir seu próprio valor em cada carta, e cartas graduadas podem ter valor próprio.'],
    ['Como cadastro uma carta graduada (PSA, CGC…)?', 'Abra a carta e use a área "Graduadas" para informar empresa, nota e, se quiser, o valor. Dá para graduar uma cópia que você já tinha ou adicionar uma nova.'],
    ['Quem vê o meu perfil?', 'Você escolhe em Ajustes › Perfil público: público (vitrine, coleção e atividade), só a vitrine, ou privado. No modo privado ninguém vê seu perfil e suas novas cartas não aparecem no feed dos amigos.'],
    ['Como encontro meus amigos?', 'Na aba Social, procure pelo @usuário deles e toque em Seguir. Você também pode mandar o link do seu perfil pelo botão Convidar.'],
    ['Um set novo ainda não aparece. Por quê?', 'Sets recém-lançados aparecem como "Em breve" até as bases públicas publicarem a lista de cartas. Depois disso entram sozinhos no app.'],
  ];
  const db = () => window.Sync?.ctx?.().db;
  const isDev = () => window.Sync?.user?.()?.email === DEV;
  let draft = {};

  /* ---------- Tela de ajuda ---------- */
  function renderHelp() {
    const d = draft;
    view.innerHTML = `<button class="back" type="button" data-tab="settings">‹ Ajustes</button><h1>Ajuda</h1>
      <div class="section"><h2>Perguntas frequentes</h2><div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div>
      <div class="panel section" id="reportBox"><h2>Reportar problema</h2>
        <p class="muted small">Carta que não aparece, que o scanner não reconhece ou que está sem imagem? Conte aqui. O relato chega direto para quem desenvolve o Boosterz.</p>
        <form id="reportForm" class="report-form">
          <label class="small muted" for="rKind">O que aconteceu</label>
          <select id="rKind" class="field">${KINDS.map(([k, l]) => `<option value="${k}"${d.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <div class="report-grid">
            <input id="rName" class="field" maxlength="80" placeholder="Nome da carta" aria-label="Nome da carta" value="${esc(d.name || '')}" autocomplete="off">
            <input id="rSet" class="field" maxlength="80" placeholder="Set ou coleção" aria-label="Set" value="${esc(d.set || '')}" autocomplete="off">
            <input id="rNum" class="field" maxlength="20" placeholder="Número, ex. 125/165" aria-label="Número" value="${esc(d.number || '')}" autocomplete="off">
            <select id="rLang" class="field" aria-label="Idioma da carta">${['Português', 'Inglês', 'Japonês', 'Chinês', 'Outro'].map(l => `<option${d.lang === l ? ' selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <textarea id="rText" class="field" maxlength="1000" placeholder="Detalhes (opcional)" aria-label="Detalhes">${esc(d.text || '')}</textarea>
          <label class="btn alt" for="rPhoto" id="rPhotoLabel">${d.photo ? 'Foto anexada ✓' : 'Anexar foto da carta (opcional)'}</label>
          <input id="rPhoto" type="file" accept="image/*" hidden>
          ${d.card ? `<p class="muted small">Carta no app: ${esc(d.card)}</p>` : ''}
          <button class="btn" type="submit">Enviar relato</button>
        </form></div>
      <p class="muted small">Boosterz está em beta. Obrigado por ajudar a melhorar!</p>`;
  }
  async function shrink(src, max = 640) {
    const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
    const w = bmp.videoWidth || bmp.width, h = bmp.videoHeight || bmp.height, k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .72);
  }
  function grabDraft() {
    const v = id => $('#' + id)?.value.trim() || '';
    draft = { ...draft, kind: v('rKind'), name: v('rName'), set: v('rSet'), number: v('rNum'), lang: v('rLang'), text: v('rText') };
  }
  async function send() {
    grabDraft();
    if (!draft.name && !draft.text && !draft.photo) { toast('Conte pelo menos o nome da carta ou o que aconteceu'); return; }
    if (!db()) { toast('Sem conexão com o servidor. Tente de novo em instantes.'); return; }
    const u = window.Sync?.user?.(), btn = $('#reportForm [type="submit"]');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await db().collection('reports').add({
        kind: draft.kind || 'other', name: draft.name || '', set: draft.set || '', number: draft.number || '', lang: draft.lang || '',
        text: draft.text || '', card: draft.card || '', photo: draft.photo || '', at: Date.now(),
        uid: window.Sync?.ctx?.().user?.uid || '', email: u?.email || '', username: window.Social?.handle?.() || '',
        app: document.querySelector('script[src^="app.js"]')?.src.split('v=')[1] || '', agent: navigator.userAgent.slice(0, 200),
      });
      draft = {};
      $('#reportBox').innerHTML = '<h2>Relato enviado ✓</h2><p class="muted">Obrigado! Vamos olhar e corrigir assim que possível.</p><button class="btn alt" type="button" data-report="again">Reportar outro problema</button>';
    } catch {
      btn.disabled = false; btn.textContent = 'Enviar relato';
      toast('Não consegui enviar agora. Verifique a conexão.');
    }
  }
  // Abre o formulário já preenchido com o que se sabe: a carta aberta, a busca feita ou a imagem da câmera.
  async function start(kind, extra = {}) {
    draft = { kind, ...extra };
    if (kind === 'card' && typeof sheetCard !== 'undefined' && sheetCard) {
      const c = sheetCard;
      draft = { kind: c.image ? 'wrong' : 'art', name: c.name, set: c.setName, number: c.localId, card: c.id, lang: isJa(c.id) ? 'Japonês' : isAsian(c.id) ? 'Chinês' : 'Português' };
    }
    if (kind === 'scan') {
      const video = $('#video');
      if (video?.videoWidth) draft.photo = await shrink(video).catch(() => '');
      closeScanner();
    }
    if (!sheet.hidden) closeSheet();
    go({ tab: 'help' });
    $('#reportBox')?.scrollIntoView({ block: 'start' });
  }

  /* ---------- Relatórios recebidos (só o desenvolvedor) ---------- */
  const adminButton = () => isDev() ? '<button class="btn alt" type="button" data-tab="reports">Relatórios recebidos</button>' : '';
  async function renderReports() {
    view.innerHTML = '<button class="back" type="button" data-tab="settings">‹ Ajustes</button><h1>Relatórios</h1><div id="reportList"><p class="muted">Carregando…</p></div>';
    if (!isDev()) { $('#reportList').innerHTML = '<p class="muted">Só a conta do desenvolvedor vê esta tela.</p>'; return; }
    try {
      const snap = await db().collection('reports').orderBy('at', 'desc').limit(200).get();
      const box = $('#reportList'); if (!box) return;
      box.innerHTML = snap.size ? `<p class="muted small">${snap.size} em aberto. Apague depois de resolver.</p>` + snap.docs.map(d => {
        const r = d.data();
        return `<article class="panel report"><header><b>${esc(kindLabel(r.kind))}</b><span class="muted small">${new Date(r.at).toLocaleString('pt-BR')}</span></header>
          <p>${[r.name, r.set, r.number, r.lang].filter(Boolean).map(esc).join(' · ') || '<span class="muted">sem dados da carta</span>'}</p>
          ${r.card ? `<button class="link" type="button" data-card="${esc(r.card)}">${esc(r.card)}</button>` : ''}
          ${r.text ? `<p>${esc(r.text)}</p>` : ''}
          ${r.photo ? `<img class="report-photo" src="${esc(r.photo)}" alt="Foto enviada">` : ''}
          <p class="muted small">${esc(r.username ? '@' + r.username : r.email || 'convidado')} · versão ${esc(r.app || '?')}</p>
          <button class="btn alt auto" type="button" data-resolve="${esc(d.id)}">Resolvido, apagar</button></article>`;
      }).join('') : '<div class="empty"><h2>Nenhum relato</h2><p class="muted">Tudo em dia.</p></div>';
    } catch { $('#reportList').innerHTML = '<p class="muted">Não consegui ler os relatos. Confira as regras do Firestore.</p>'; }
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.report === 'again') { draft = {}; renderHelp(); }
    else if (d.report) start(d.report, d.reportName ? { name: d.reportName } : {});
    else if (d.resolve) {
      b.disabled = true;
      try { await db().collection('reports').doc(d.resolve).delete(); b.closest('.report').remove(); } catch { b.disabled = false; toast('Não consegui apagar'); }
    }
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'rPhoto' || !e.target.files[0]) return;
    grabDraft();
    draft.photo = await shrink(e.target.files[0]).catch(() => '');
    $('#rPhotoLabel').textContent = draft.photo ? 'Foto anexada ✓' : 'Não consegui ler a foto';
  });
  document.addEventListener('submit', e => { if (e.target.id === 'reportForm') { e.preventDefault(); send(); } });

  return { renderHelp, renderReports, adminButton, start };
})();
