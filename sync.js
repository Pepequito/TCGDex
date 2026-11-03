'use strict';
// Conta e nuvem. A coleção continua em `store`; o Firestore guarda uma cópia por usuário
// em users/{uid}/cards/{cardId}. Sem configuração ou sem login, o app funciona só no aparelho.
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
    unsub?.(); unsub = null;
    user = next; reconciled = false; notice = '';
    if (user) {
      status = 'Sincronizando…';
      unsub = cardsRef().onSnapshot({ includeMetadataChanges: true }, onSnapshot, () => { status = 'Erro ao sincronizar. Confira as regras do Firestore.'; paint(); });
    }
    paint(); render();
  }
  function reconcile(snap) {
    const remote = new Map(snap.docs.map(d => [d.id, d.data()]));
    const profile = remote.get(PROFILE);
    remote.delete(PROFILE);
    if (profile && (profile.updatedAt || 0) > (store.profile.updatedAt || 0)) store.profile = profile;
    else if (store.profile.updatedAt) sendProfile();
    const synced = new Set(store.synced || []);
    const toSend = [];
    for (const [id, r] of remote) {
      const l = store.cards[id];
      if (l && (l.updatedAt || 0) > (r.updatedAt || 0)) toSend.push(id);
      else store.cards[id] = { ...r, prices: l?.prices || r.prices };
    }
    for (const id of Object.keys(store.cards)) {
      if (remote.has(id)) continue;
      // Já esteve na nuvem e sumiu: foi removida em outro aparelho. Senão, é carta nova daqui.
      if (synced.has(id)) delete store.cards[id];
      else toSend.push(id);
    }
    return send(toSend);
  }
  const sendProfile = () => cardsRef().doc(PROFILE).set(clean(store.profile)).catch(() => { status = 'Erro ao salvar na nuvem'; paint(); });
  async function send(ids) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = db.batch();
      for (const id of ids.slice(i, i + 400)) {
        const c = store.cards[id], ref = cardsRef().doc(id);
        c ? batch.set(ref, clean(c)) : batch.delete(ref);
      }
      batch.commit().catch(() => { status = 'Erro ao salvar na nuvem'; paint(); });
    }
  }
  function onSnapshot(snap) {
    const { fromCache, hasPendingWrites } = snap.metadata;
    let changed = false;
    if (!reconciled && !fromCache) { reconciled = true; changed = true; reconcile(snap); }
    else if (reconciled) {
      for (const ch of snap.docChanges()) {
        if (ch.doc.metadata.hasPendingWrites) continue;
        const id = ch.doc.id, l = store.cards[id];
        if (id === PROFILE) { if (ch.type !== 'removed') store.profile = ch.doc.data(); changed = true; continue; }
        if (ch.type === 'removed') delete store.cards[id];
        else store.cards[id] = { ...ch.doc.data(), prices: l?.prices || ch.doc.data().prices };
        changed = true;
      }
    }
    if (!fromCache) store.synced = snap.docs.map(d => d.id).filter(id => id !== PROFILE);
    status = hasPendingWrites ? 'Salvando na nuvem…' : fromCache ? 'Sem internet. As mudanças sobem depois.' : 'Tudo salvo na nuvem';
    if (changed) { save(); if (sheet.hidden && scanner.hidden) render(); }
    else save();
    paint();
  }

  function show(msg) { notice = msg; paint(); }
  function paint() {
    const box = document.getElementById('account');
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
    box.innerHTML = `<h2>Conta</h2><p class="muted small">Entre para salvar a coleção na nuvem e usar em outros aparelhos.</p>${note}
      <button class="btn" type="button" data-sync="google">Entrar com Google</button>
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
    else if (kind === 'out') act(async () => { store.synced = []; save(); await auth.signOut(); });
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
  return {
    paint,
    changed(id) { if (user && db) send([id]); },
    changedAll(ids) { if (user && db) send(ids); },
    changedProfile() { if (user && db) sendProfile(); },
    user: () => user && { name: user.displayName?.split(' ')[0] || '', photo: user.photoURL || '', email: user.email || '' },
    nudge: () => config && !user && list().length
      ? '<button class="btn alt" type="button" data-tab="settings">Entre na conta para proteger sua coleção</button>' : '',
  };
})();
