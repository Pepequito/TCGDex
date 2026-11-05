'use strict';
// Conta e nuvem. A coleção continua em `store`; o Firestore guarda uma cópia por usuário
// em users/{uid}/cards/{cardId}. Sem configuração ou sem login, o app funciona só no aparelho.
// Para gastar poucas leituras, a coleção inteira é lida uma vez por aparelho; depois o app só escuta
// o que mudou desde a última vez (campo syncAt, com a hora do servidor). Carta removida vira "lápide"
// ({ deleted: true }) em vez de sumir, para os outros aparelhos ficarem sabendo.
window.Sync = (() => {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const config = window.FICHARIO_FIREBASE;
  let auth = null, db = null, user = null, unsub = null, reconciled = false, booted = false;
  let status = 'Conectando…', notice = '';
  const PROFILE = '__profile';

  const ERRORS = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Esse e-mail não parece válido.',
    'auth/email-already-in-use': 'Esse e-mail já tem conta. Use Entrar.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/network-request-failed': 'Sem conexão. Tente de novo quando estiver online.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos.',
    'auth/popup-closed-by-user': 'O login com Google foi cancelado.',
    'auth/unauthorized-domain': 'Este site ainda não foi autorizado no Firebase.',
    'auth/operation-not-allowed': 'Essa forma de login não está ativada no Firebase.',
  };
  const explain = e => ERRORS[e?.code] || `Não consegui concluir (${e?.code || 'erro desconhecido'}).`;
  const cardsRef = () => db.collection('users').doc(user.uid).collection('cards');
  const clean = c => JSON.parse(JSON.stringify(c));
  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  const stamp = o => ({ ...clean(o), syncAt: now() });
  const strip = d => { const { syncAt, ...rest } = d; return rest; };
  const millis = d => d.syncAt?.toMillis?.() || 0;
  let retry = null;

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.append(s);
    });
  }
  async function boot() {
    if (!config || booted) return;
    booted = true;
    try {
      await loadScript(SDK + 'firebase-app-compat.js');
      await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
      firebase.initializeApp(config);
      auth = firebase.auth(); auth.languageCode = 'pt';
      db = firebase.firestore();
      // Com cache local, o que for feito sem internet entra na fila e sobe depois.
      await db.enablePersistence().catch(() => {});
      auth.getRedirectResult().catch(e => show(explain(e)));
      auth.onAuthStateChanged(onUser);
    } catch { booted = false; status = 'Sem conexão com a conta'; paint(); }
  }
  function onUser(next) {
    unsub?.(); unsub = null; clearTimeout(retry);
    user = next; reconciled = false; notice = '';
    if (user) { status = 'Sincronizando…'; start(); }
    window.Social?.onUser(user);
    if (user) { store.gate = 'account'; save(); hideGate(); }
    paint(); render();
  }
  // Primeira vez deste usuário neste aparelho: lê tudo do servidor e junta com o que já existe aqui.
  async function start() {
    const uid = user.uid;
    if (store.syncUid !== uid) {
      try {
        const snap = await cardsRef().get({ source: 'server' });
        if (user?.uid !== uid) return;
        reconcile(snap);
        store.syncUid = uid;
        store.syncedAt = Math.max(0, ...snap.docs.map(d => millis(d.data())));
        save(); render();
      } catch {
        status = 'Sem conexão com a nuvem. Tento de novo em instantes.'; paint();
        retry = setTimeout(() => user?.uid === uid && start(), 30000);
        return;
      }
    }
    reconciled = true;
    const since = firebase.firestore.Timestamp.fromMillis(store.syncedAt || 0);
    unsub = cardsRef().where('syncAt', '>', since).onSnapshot({ includeMetadataChanges: true }, onSnapshot,
      () => { status = 'Erro ao sincronizar. Confira as regras do Firestore.'; paint(); });
  }
  function reconcile(snap) {
    const remote = new Map(snap.docs.map(d => [d.id, strip(d.data())]));
    const profile = remote.get(PROFILE);
    remote.delete(PROFILE);
    if (profile && (profile.updatedAt || 0) > (store.profile.updatedAt || 0)) store.profile = profile;
    else if (store.profile.updatedAt) sendProfile();
    const synced = new Set(store.synced || []);
    const toSend = [];
    for (const [id, r] of remote) {
      const l = store.cards[id];
      if (l && (l.updatedAt || 0) > (r.updatedAt || 0)) toSend.push(id);
      else if (r.deleted) delete store.cards[id];
      else store.cards[id] = { ...r, prices: l?.prices || r.prices };
    }
    store.synced = [...remote].filter(([, r]) => !r.deleted).map(([id]) => id);
    for (const id of Object.keys(store.cards)) {
      if (remote.has(id)) continue;
      // Já esteve na nuvem e sumiu: foi removida em outro aparelho. Senão, é carta nova daqui.
      if (synced.has(id)) delete store.cards[id];
      else toSend.push(id);
    }
    return send(toSend);
  }
  const sendProfile = () => cardsRef().doc(PROFILE).set(stamp(store.profile)).catch(() => { status = 'Erro ao salvar na nuvem'; paint(); });
  async function send(ids) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = db.batch();
      for (const id of ids.slice(i, i + 400)) {
        const c = store.cards[id], ref = cardsRef().doc(id);
        batch.set(ref, c ? stamp(c) : { id, deleted: true, updatedAt: Date.now(), syncAt: now() });
      }
      batch.commit().catch(() => { status = 'Erro ao salvar na nuvem'; paint(); });
    }
  }
  // Só chegam documentos alterados depois de syncedAt (de outro aparelho ou a confirmação do que este enviou).
  function onSnapshot(snap) {
    const { fromCache, hasPendingWrites } = snap.metadata;
    let changed = false;
    for (const ch of snap.docChanges()) {
      if (ch.doc.metadata.hasPendingWrites || ch.type === 'removed') continue;
      const id = ch.doc.id, raw = ch.doc.data(), d = strip(raw), l = store.cards[id];
      if (!fromCache) store.syncedAt = Math.max(store.syncedAt || 0, millis(raw));
      if (id === PROFILE) { if ((d.updatedAt || 0) >= (store.profile.updatedAt || 0)) { store.profile = d; changed = true; } continue; }
      if (l && (l.updatedAt || 0) > (d.updatedAt || 0)) continue;
      if (d.deleted) { if (l) { delete store.cards[id]; changed = true; } continue; }
      store.cards[id] = { ...d, prices: l?.prices || d.prices };
      changed = true;
    }
    // Cartas antigas vindas da nuvem também passam para a edição brasileira.
    if (window.migrateEditions?.().length) changed = true;
    status = hasPendingWrites ? 'Salvando na nuvem…' : fromCache ? 'Sem internet. As mudanças sobem depois.' : 'Tudo salvo na nuvem';
    if (changed) { save(); if (sheet.hidden && scanner.hidden) render(); }
    else save();
    paint();
  }

  function show(msg) { notice = msg; paint(); }
  /* ---------- Tela de entrada ---------- */
  // Na primeira abertura a pessoa escolhe: entrar, criar conta ou seguir como convidado (dados só no aparelho).
  store.gate ??= store.synced?.length ? 'account' : null;
  function showGate() {
    if (!config || user || document.getElementById('gate')) return;
    const g = document.createElement('section');
    g.id = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'Entrar no Boosterz');
    const again = store.gate === 'guest';
    g.innerHTML = `<div class="gate-card">${again ? '<button class="sheet-x" type="button" data-guest aria-label="Fechar">✕</button>' : ''}
      <img class="app-icon" src="icons/icon-192.png" alt=""><div class="brand-lock"><img class="logo" src="icons/logo.webp" alt="Boosterz TCG Tracker"><span class="beta">BETA</span></div>
      <p class="gate-lead">Escaneie, organize e acompanhe o valor da sua coleção de Pokémon TCG.</p>
      <div class="account"></div>
      <div class="gate-guest"><button class="btn ghost-btn" type="button" data-guest>${again ? 'Continuar sem conta' : 'Continuar como convidado'}</button>
        <p class="small warn">⚠︎ Como convidado, a coleção fica salva só na memória deste aparelho. Se você limpar os dados do navegador, trocar de celular ou remover o app, pode perder tudo. Dá para criar a conta depois, em Ajustes, sem perder as cartas.</p></div></div>`;
    document.body.append(g);
    document.body.classList.add('gated');
    paint();
  }
  function hideGate() {
    document.getElementById('gate')?.remove();
    document.body.classList.remove('gated');
    window.Sync && paint();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.guest !== undefined) {
      if (store.gate !== 'guest') toast('Modo convidado: lembre de exportar um backup de vez em quando');
      store.gate = 'guest'; save(); hideGate();
    } else if (b.dataset.gate !== undefined) showGate();
  });

  function paint() {
    const gate = document.querySelector('#gate .account');
    const box = gate || document.getElementById('account');
    if (!box) return;
    if (!config) { box.innerHTML = '<h2>Conta</h2><p class="muted small">O login ainda não foi configurado. Use o backup abaixo.</p>'; return; }
    const note = notice ? `<p class="small" role="status">${esc(notice)}</p>` : '';
    if (user) {
      box.innerHTML = `<h2>Conta</h2><p><b>${esc(user.email || 'Conta conectada')}</b><br><span class="muted small">${esc(status)}</span></p>${note}
        <button class="btn alt" type="button" data-sync="out">Sair da conta</button>
        <p class="muted small">Ao sair, as cartas continuam neste iPhone e na nuvem.</p>`;
      return;
    }
    const email = document.getElementById('authEmail')?.value || '';
    box.innerHTML = `${gate ? '<h2>Entre ou crie sua conta</h2><p class="muted small">Sua coleção fica salva na nuvem, aparece em todos os seus aparelhos e você pode seguir seus amigos.</p>'
      : '<h2>Conta</h2><p class="muted small">Entre para salvar a coleção na nuvem e usar em outros aparelhos.</p>'}${note}
      <button class="btn google" type="button" data-sync="google"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.400-.2-2H12v3.800h6c-.3 1.400-1 2.500-2.200 3.300v2.700h3.500c2.100-1.900 3.300-4.700 3.300-7.800z"/><path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.500-2.700c-1 .7-2.300 1.100-3.800 1.100-2.900 0-5.400-2-6.300-4.600H2.100v2.800C3.900 20.500 7.700 23 12 23z"/><path fill="#FBBC05" d="M5.700 14.100c-.2-.7-.4-1.400-.4-2.100s.1-1.400.4-2.100V7.100H2.100C1.400 8.600 1 10.200 1 12s.4 3.400 1.100 4.900z"/><path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.700l3.200-3.200C17.500 2.100 15 1 12 1 7.700 1 3.900 3.500 2.100 7.100l3.600 2.800C6.600 7.300 9.100 5.400 12 5.400z"/></svg>Entrar com Google</button>
      <form id="authForm" class="section">
        <input id="authEmail" class="field" type="email" autocomplete="email" placeholder="E-mail" value="${esc(email)}" required>
        <input id="authPass" class="field" type="password" autocomplete="current-password" placeholder="Senha" required>
        <button class="btn alt" type="submit">Entrar com e-mail</button>
        <button class="btn alt" type="button" data-sync="create">Criar conta com e-mail</button>
        <button class="btn alt" type="button" data-sync="reset">Esqueci a senha</button>
      </form>`;
  }
  async function act(fn) {
    try { notice = ''; await fn(); }
    catch (e) { show(explain(e)); }
  }
  async function google() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await auth.signInWithRedirect(provider);
      else throw e;
    }
  }
  const creds = () => [document.getElementById('authEmail').value.trim(), document.getElementById('authPass').value];
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sync]'); if (!b || !auth) return;
    const kind = b.dataset.sync;
    if (kind === 'google') act(google);
    else if (kind === 'out') act(async () => { store.synced = []; store.syncUid = null; store.syncedAt = 0; store.gate = null; save(); await auth.signOut(); go({ tab: 'home', setId: null }); showGate(); });
    else if (kind === 'create') {
      const [mail, pass] = creds();
      act(() => auth.createUserWithEmailAndPassword(mail, pass));
    } else if (kind === 'reset') {
      const [mail] = creds();
      if (!mail) return show('Digite seu e-mail primeiro.');
      act(async () => { await auth.sendPasswordResetEmail(mail); show('Enviei um link para redefinir a senha.'); });
    }
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'authForm') return;
    const [mail, pass] = creds();
    act(() => auth.signInWithEmailAndPassword(mail, pass));
  });

  boot();
  if (!store.gate) showGate();
  return {
    showGate,
    paint,
    changed(id) { if (user && db) send([id]); },
    changedAll(ids) { if (user && db) send(ids); },
    changedProfile() { if (user && db) sendProfile(); },
    ctx: () => ({ db, user }),
    user: () => user && { name: user.displayName?.split(' ')[0] || '', photo: user.photoURL || '', email: user.email || '' },
    nudge: () => config && !user && list().length
      ? '<button class="btn alt" type="button" data-gate>Entre na conta para proteger sua coleção</button>' : '',
  };
})();
