'use strict';
// Beta fechado: acesso por código de convite e área de admin (só no computador, só na conta do desenvolvedor).
// - invites/{CODIGO}: { code, label, maxUses, uses, active, createdAt }
// - members/{uid}: { uid, code, email, name, joinedAt, lastSeen, blocked }
// - config/app: { paused, notice }  (pausar novos cadastros e aviso para todos)
// As regras do Firestore exigem ser membro para gravar; quem entra sem conta (convidado) guarda o código no aparelho.
window.Access = (() => {
  const ADMIN = 'pedrohblour@gmail.com';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const db = () => window.Sync?.ctx?.().db;
  const isAdmin = u => (u?.email || '').toLowerCase() === ADMIN;
  const normKey = k => String(k || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inviteLink = code => `${location.origin}${location.pathname}?convite=${code}`;
  let state = 'unknown', config = {};
  async function waitDb(ms = 10000) {
    for (let t = 0; !db() && t < ms; t += 200) await new Promise(r => setTimeout(r, 200));
    return db();
  }

  // Código vindo pelo link de convite: já fica preenchido na tela de entrada.
  const fromUrl = new URLSearchParams(location.search).get('convite');
  if (fromUrl) {
    store.pendingKey = normKey(fromUrl); save();
    history.replaceState(null, '', location.pathname + location.hash);
  }

  async function checkKey(code) {
    code = normKey(code);
    if (!code) return 'Digite o código de convite.';
    if (!await waitDb()) return 'Sem conexão. Tente de novo em instantes.';
    try {
      const d = await db().collection('invites').doc(code).get();
      if (!d.exists) return 'Código não encontrado. Confira com quem te convidou.';
      const v = d.data();
      if (!v.active) return 'Este código foi desativado.';
      if ((v.uses || 0) >= (v.maxUses || 1)) return 'Este código já atingiu o limite de usos.';
      return '';
    } catch { return 'Não consegui conferir o código agora.'; }
  }
  async function redeem(u, code) {
    code = normKey(code);
    const err = await checkKey(code);
    if (err) return err;
    if (config.paused) return 'Os novos cadastros estão pausados no momento.';
    const batch = db().batch();
    batch.set(db().collection('members').doc(u.uid), { uid: u.uid, code, email: u.email || '', name: u.displayName || '', joinedAt: Date.now(), lastSeen: Date.now(), blocked: false });
    batch.update(db().collection('invites').doc(code), { uses: firebase.firestore.FieldValue.increment(1) });
    try { await batch.commit(); delete store.pendingKey; save(); return ''; }
    catch { return 'Não consegui usar este código. Ele pode ter acabado agora ou os cadastros estão pausados.'; }
  }

  /* ---------- Verificação ao abrir o app ---------- */
  async function loadConfig() {
    try { config = (await db().collection('config').doc('app').get()).data() || {}; } catch { config = {}; }
    banner();
  }
  function banner() {
    let el = $('#notice');
    if (!config.notice) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'notice'; el.setAttribute('role', 'status'); document.body.prepend(el); }
    el.innerHTML = `<span>${esc(config.notice)}</span><button type="button" aria-label="Fechar aviso" data-notice-off>✕</button>`;
  }
  async function onUser(u) {
    document.body.classList.toggle('is-admin', isAdmin(u));
    if (!u) { state = 'unknown'; unlock(); return; }
    if (isAdmin(u)) { state = 'ok'; unlock(); return; }
    let m = null;
    try { m = await db().collection('members').doc(u.uid).get(); } catch { /* sem conexão: não bloqueia quem já usa */ state = 'ok'; return; }
    if (m.exists) {
      if (m.data().blocked) { state = 'blocked'; lock(); return; }
      state = 'ok'; unlock();
      db().collection('members').doc(u.uid).update({ lastSeen: Date.now() }).catch(() => {});
      return;
    }
    if (store.pendingKey && !await redeem(u, store.pendingKey)) { location.reload(); return; }
    state = 'need-key'; lock();
  }
  // Convidado: o código precisa continuar ativo. Se for desativado, a tela de entrada volta.
  async function checkGuest() {
    if (store.gate !== 'guest') return;
    if (!store.accessKey) { store.gate = null; save(); window.Sync?.showGate(); return; }
    const err = await checkKey(store.accessKey);
    if (err && !/conex|conferir/.test(err)) { store.gate = null; delete store.accessKey; save(); window.Sync?.showGate(err); }
  }
  async function enterAsGuest(code) {
    const err = await checkKey(code);
    if (err) return err;
    store.accessKey = normKey(code); store.gate = 'guest'; save();
    return '';
  }

  /* ---------- Tela de bloqueio (logado sem convite ou bloqueado) ---------- */
  function lock() {
    let el = $('#lock');
    if (!el) { el = document.createElement('section'); el.id = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.append(el); }
    document.body.classList.add('gated');
    el.innerHTML = `<div class="gate-card"><img class="app-icon" src="icons/icon-192.png" alt="">
      <div class="brand-lock"><img class="logo" src="icons/logo.webp" alt="Boosterz TCG Tracker"><span class="beta">BETA</span></div>
      ${state === 'blocked' ? '<h2>Acesso suspenso</h2><p class="gate-lead">Seu acesso ao beta foi suspenso. Fale com quem te convidou.</p>'
        : `<h2>Beta fechado</h2><p class="gate-lead">Para usar o Boosterz durante os testes, digite o código de convite que você recebeu.</p>
        <form id="lockForm" class="account"><input id="lockKey" class="field key-field" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Código de convite" aria-label="Código de convite" value="${esc(store.pendingKey || '')}">
          <p class="small warn" id="lockMsg" hidden></p><button class="btn" type="submit">Liberar acesso</button></form>`}
      <button class="btn ghost-btn" type="button" data-sync="out">Sair da conta</button></div>`;
  }
  function unlock() {
    $('#lock')?.remove();
    if (!$('#gate')) document.body.classList.remove('gated');
  }

  /* ---------- Área de admin ---------- */
  const fmt = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const ago = t => { if (!t) return 'nunca'; const d = (Date.now() - t) / 864e5; return d < 1 ? 'hoje' : d < 2 ? 'ontem' : `há ${Math.floor(d)} dias`; };
  function newCode() {
    const r = crypto.getRandomValues(new Uint8Array(6));
    return 'BZ' + [...r].map(x => ALPHABET[x % ALPHABET.length]).join('');
  }
  let admin = { invites: [], members: [], reports: 0 };
  async function renderAdmin() {
    const u = window.Sync?.user?.();
    if (!isAdmin(u)) { view.innerHTML = '<h1>Admin</h1><p class="muted">Esta área é só da conta de administração.</p>'; return; }
    if (!matchMedia('(min-width: 1024px)').matches) { view.innerHTML = '<h1>Admin</h1><p class="muted">Abra o Boosterz no computador para usar a área de administração.</p>'; return; }
    view.innerHTML = '<div class="page-head"><div><h1>Admin</h1><span class="muted">Carregando…</span></div></div>';
    try {
      const [inv, mem, rep, cfg] = await Promise.all([
        db().collection('invites').get(), db().collection('members').get(),
        db().collection('reports').limit(200).get(), db().collection('config').doc('app').get(),
      ]);
      admin = {
        invites: inv.docs.map(d => d.data()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        members: mem.docs.map(d => d.data()).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)),
        reports: rep.size,
      };
      config = cfg.data() || {};
    } catch {
      view.innerHTML = '<h1>Admin</h1><p class="muted">Não consegui ler os dados de administração. Confira se as regras novas do Firestore foram publicadas.</p>'; return;
    }
    drawAdmin();
  }
  function drawAdmin() {
    if (route.tab !== 'admin') return;
    const { invites, members } = admin, week = Date.now() - 7 * 864e5;
    const active = members.filter(m => (m.lastSeen || 0) >= week).length;
    view.innerHTML = `<div class="page-head"><div><h1>Admin</h1><span class="muted">Beta fechado do Boosterz</span></div>
        <button class="btn alt auto" type="button" data-admin-reload>Atualizar</button></div>
      <div class="stat-grid">
        <div class="stat"><b>${members.length}</b><span>Membros</span></div>
        <div class="stat"><b>${active}</b><span>Ativos nos últimos 7 dias</span></div>
        <div class="stat"><b>${invites.filter(i => i.active && (i.uses || 0) < i.maxUses).length}</b><span>Convites disponíveis</span></div>
        <div class="stat"><b>${admin.reports}</b><span>Relatos em aberto</span></div></div>
      <div class="admin-grid">
        <section class="panel">
          <h2>Novo convite</h2>
          <form id="inviteForm" class="admin-form">
            <input id="invLabel" class="field" maxlength="40" placeholder="Para quem (ex.: Amigos da faculdade)" aria-label="Rótulo do convite">
            <label class="small muted">Usos permitidos<input id="invUses" class="field" type="number" min="1" max="500" value="1"></label>
            <input id="invCode" class="field key-field" maxlength="16" placeholder="Código (vazio = gerar)" aria-label="Código" autocapitalize="characters">
            <button class="btn" type="submit">Criar convite</button>
          </form>
        </section>
        <section class="panel">
          <h2>Restrições</h2>
          <label class="check"><input id="cfgPaused" type="checkbox"${config.paused ? ' checked' : ''}> Pausar novos cadastros (convites param de funcionar para quem ainda não entrou)</label>
          <label class="small muted" for="cfgNotice">Aviso para todos (aparece no topo do app)</label>
          <textarea id="cfgNotice" class="field" maxlength="200" placeholder="Ex.: Manutenção hoje às 22h">${esc(config.notice || '')}</textarea>
          <button class="btn alt" type="button" data-save-config>Salvar restrições</button>
          <button class="btn alt" type="button" data-tab="reports">Ver relatos de problema</button>
        </section>
      </div>
      <section class="section"><h2>Fotos enviadas pela comunidade</h2><div id="adminPhotos"><p class="muted">Carregando…</p></div></section>
      <section class="section"><h2>Convites</h2>
        ${invites.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Para</th><th class="right">Usos</th><th>Criado</th><th>Situação</th><th></th></tr></thead><tbody>
          ${invites.map(i => `<tr><td class="num"><b>${esc(i.code)}</b></td><td>${esc(i.label || '—')}</td><td class="num right">${i.uses || 0}/${i.maxUses}</td><td class="muted">${fmt(i.createdAt)}</td>
            <td>${!i.active ? '<span class="pill">Desativado</span>' : (i.uses || 0) >= i.maxUses ? '<span class="pill">Esgotado</span>' : '<span class="pill ok">Ativo</span>'}</td>
            <td class="right actions"><button type="button" class="link" data-copy-invite="${esc(i.code)}">Copiar link</button>
              <button type="button" class="link" data-toggle-invite="${esc(i.code)}">${i.active ? 'Desativar' : 'Reativar'}</button>
              <button type="button" class="link danger" data-delete-invite="${esc(i.code)}">Apagar</button></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">Nenhum convite ainda. Crie o primeiro acima e mande o link para seus amigos.</p>'}</section>
      <section class="section"><h2>Membros</h2>
        ${members.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Pessoa</th><th>Convite</th><th>Entrou</th><th>Último uso</th><th>Situação</th><th></th></tr></thead><tbody>
          ${members.map(m => `<tr><td><b>${esc(m.name || '—')}</b><span class="muted small">${esc(m.email || m.uid)}</span></td><td class="num">${esc(m.code || '')}</td>
            <td class="muted">${fmt(m.joinedAt)}</td><td>${ago(m.lastSeen)}</td>
            <td>${m.blocked ? '<span class="pill danger">Bloqueado</span>' : '<span class="pill ok">Ativo</span>'}</td>
            <td class="right"><button type="button" class="link${m.blocked ? '' : ' danger'}" data-block-member="${esc(m.uid)}">${m.blocked ? 'Desbloquear' : 'Bloquear'}</button></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">Ninguém entrou com convite ainda.</p>'}</section>`;
    window.Photos?.adminBlock();
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('submit', async e => {
    if (e.target.id === 'lockForm') {
      e.preventDefault();
      const msg = $('#lockMsg'), btn = e.target.querySelector('button'), u = window.Sync?.ctx?.().user;
      btn.disabled = true; btn.textContent = 'Conferindo…';
      const err = u ? await redeem(u, $('#lockKey').value) : 'Entre na sua conta primeiro.';
      if (!err) { location.reload(); return; }
      msg.textContent = err; msg.hidden = false; btn.disabled = false; btn.textContent = 'Liberar acesso';
    }
    if (e.target.id === 'inviteForm') {
      e.preventDefault();
      const code = normKey($('#invCode').value) || newCode();
      const doc = { code, label: $('#invLabel').value.trim(), maxUses: Math.max(1, Math.min(500, +$('#invUses').value || 1)), uses: 0, active: true, createdAt: Date.now() };
      try {
        const ref = db().collection('invites').doc(code);
        if ((await ref.get()).exists) { toast('Esse código já existe'); return; }
        await ref.set(doc);
        admin.invites.unshift(doc); drawAdmin();
        try { await navigator.clipboard.writeText(inviteLink(code)); toast(`Convite ${code} criado e link copiado`); } catch { toast(`Convite ${code} criado`); }
      } catch { toast('Não consegui criar o convite'); }
    }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.noticeOff !== undefined) $('#notice')?.remove();
    else if (d.adminReload !== undefined) renderAdmin();
    else if (d.copyInvite) {
      try { await navigator.clipboard.writeText(inviteLink(d.copyInvite)); toast('Link do convite copiado'); } catch { toast(inviteLink(d.copyInvite)); }
    } else if (d.toggleInvite) {
      const i = admin.invites.find(x => x.code === d.toggleInvite); if (!i) return;
      try { await db().collection('invites').doc(i.code).update({ active: !i.active }); i.active = !i.active; drawAdmin(); } catch { toast('Não consegui alterar'); }
    } else if (d.deleteInvite) {
      if (!confirm(`Apagar o convite ${d.deleteInvite}? Quem já entrou com ele continua membro.`)) return;
      try { await db().collection('invites').doc(d.deleteInvite).delete(); admin.invites = admin.invites.filter(x => x.code !== d.deleteInvite); drawAdmin(); } catch { toast('Não consegui apagar'); }
    } else if (d.blockMember) {
      const m = admin.members.find(x => x.uid === d.blockMember); if (!m) return;
      if (!m.blocked && !confirm(`Bloquear ${m.name || m.email}? A pessoa perde o acesso na próxima vez que abrir o app.`)) return;
      try { await db().collection('members').doc(m.uid).update({ blocked: !m.blocked }); m.blocked = !m.blocked; drawAdmin(); } catch { toast('Não consegui alterar'); }
    } else if (d.saveConfig !== undefined) {
      const next = { paused: $('#cfgPaused').checked, notice: $('#cfgNotice').value.trim() };
      try { await db().collection('config').doc('app').set(next); config = next; banner(); toast('Restrições salvas'); } catch { toast('Não consegui salvar'); }
    }
  });

  // Endereço antigo com cartas guardadas só neste navegador: pede para exportar o backup antes de mudar.
  if (window.__movedTo) {
    const el = document.createElement('section');
    el.id = 'moved'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="gate-card"><img class="app-icon" src="icons/icon-192.png" alt="">
      <h2>O Boosterz mudou de endereço</h2>
      <p class="gate-lead">Agora o app fica em <b>boosterz.web.app</b>. Você usa sem conta, então suas ${list().length} cartas estão salvas só neste endereço antigo.</p>
      <ol class="moved-steps"><li>Toque em <b>Exportar backup</b> e guarde o arquivo.</li><li>Abra o novo endereço e entre com seu convite.</li><li>Em Ajustes, use <b>Importar backup</b>. Melhor ainda: crie uma conta, e a coleção fica na nuvem.</li></ol>
      <button class="btn" type="button" id="exportBtn">Exportar backup</button>
      <a class="btn alt" href="${esc(window.__movedTo)}">Ir para boosterz.web.app</a></div>`;
    document.body.append(el);
  }
  (async () => { if (await waitDb()) { loadConfig(); checkGuest(); } })();
  return { onUser, checkKey, enterAsGuest, redeem, normKey, renderAdmin, isAdmin, state: () => state };
})();
