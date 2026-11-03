'use strict';
// Parte social: nome de usuário, perfil público, seguir pessoas e ver a coleção de amigos.
// Os dados públicos ficam em profiles/{uid}; a coleção de quem é público é lida direto de users/{uid}/cards.
window.Social = (() => {
  const NAME = /^[a-z0-9_]{3,20}$/;
  const PRIVACY = [['public', 'Público: vitrine e coleção'], ['showcase', 'Só a vitrine'], ['private', 'Privado']];
  let me = null, mine = null, blocked = false, loaded = false, timer = null;
  const fb = () => window.Sync?.ctx?.() || {};
  const db = () => fb().db;
  const link = name => `${location.origin}${location.pathname}#@${name}`;
  const nameError = n => NAME.test(n) ? '' : 'Use de 3 a 20 letras minúsculas, números ou _.';
  async function waitDb(ms = 8000) {
    for (let t = 0; !db() && t < ms; t += 200) await new Promise(r => setTimeout(r, 200));
    return db();
  }
  const denied = e => e?.code === 'permission-denied';

  /* ---------- Meu perfil público ---------- */
  function onUser(u) {
    me = u; mine = null; loaded = false; blocked = false;
    if (u) load();
  }
  async function load() {
    try {
      const d = await db().collection('profiles').doc(me.uid).get();
      mine = d.exists ? d.data() : null;
      if (mine) publishSoon();
    } catch (e) { blocked = denied(e); }
    loaded = true;
    if (route.tab === 'profile') render();
  }
  function publicDoc() {
    const u = window.Sync?.user?.() || {};
    return {
      uid: me.uid, username: mine.username, name: trainerName(), bio: store.profile.bio || '',
      photo: store.profile.photo || u.photo || '', privacy: mine.privacy || 'public', showValue: !!mine.showValue,
      value: mine.showValue ? Math.round(collectionValue() * 100) / 100 : null,
      cards: copiesCount(), unique: list().length,
      showcase: showcaseCards().slice(0, 9).map(c => ({ id: c.id, name: c.name, image: c.image || '', setName: c.setName || '' })),
      updatedAt: Date.now(),
    };
  }
  async function publish() {
    if (!me || !mine?.username || !db()) return;
    try { await db().collection('profiles').doc(me.uid).set(publicDoc()); }
    catch (e) { blocked = denied(e); }
  }
  function publishSoon() { clearTimeout(timer); timer = setTimeout(publish, 3000); }
  async function claim(raw) {
    const name = raw.trim().toLowerCase().replace(/^@/, '');
    const err = nameError(name);
    if (err) return err;
    const ref = db().collection('usernames').doc(name), prof = db().collection('profiles').doc(me.uid);
    try {
      await db().runTransaction(async tx => {
        const taken = await tx.get(ref);
        if (taken.exists && taken.data().uid !== me.uid) throw Object.assign(new Error(), { code: 'taken' });
        if (mine?.username && mine.username !== name) tx.delete(db().collection('usernames').doc(mine.username));
        if (!taken.exists) tx.set(ref, { uid: me.uid });
        mine = { ...(mine || { privacy: 'public', showValue: false }), username: name };
        tx.set(prof, publicDoc());
      });
      return '';
    } catch (e) {
      if (e.code === 'taken') return 'Esse nome já está em uso. Tente outro.';
      blocked = denied(e);
      return blocked ? 'Os amigos ainda não foram ativados no Firebase.' : 'Não consegui salvar. Verifique a conexão.';
    }
  }
  async function share() {
    const url = link(mine.username);
    try { if (navigator.share) { await navigator.share({ title: `${trainerName()} no Boosterz`, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); toast('Link do perfil copiado'); }
    catch { toast(url); }
  }

  /* ---------- Blocos da aba Perfil ---------- */
  function ownBlock() {
    if (!window.FICHARIO_FIREBASE) return '';
    if (!me) return `<div class="panel social"><h2>Perfil público e amigos</h2><p class="muted small">Entre na sua conta para escolher um nome de usuário, compartilhar seu perfil e seguir amigos.</p>
      <button class="btn alt" type="button" data-tab="settings">Entrar na conta</button></div>`;
    if (blocked) return '<div class="panel social"><h2>Amigos</h2><p class="muted small">Os recursos de amigos ainda não foram ativados no Firebase. Assim que as regras novas forem publicadas, eles aparecem aqui.</p></div>';
    if (!loaded) return '<div class="panel social"><p class="muted small">Carregando seu perfil público…</p></div>';
    if (!mine?.username) return `<div class="panel social"><h2>Escolha seu nome de usuário</h2>
      <p class="muted small">É por ele que seus amigos encontram você, e ele forma o link do seu perfil.</p>
      <form id="claimForm" class="handle-form"><span class="at">@</span><input id="claimName" class="field" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="seu_nome" aria-label="Nome de usuário"></form>
      <p class="small warn" id="claimMsg" hidden></p><button class="btn" type="submit" form="claimForm">Salvar nome</button></div>`;
    return `<div class="panel social"><div class="handle-row"><b>@${esc(mine.username)}</b><button class="btn alt auto" type="button" data-share-profile>Compartilhar perfil</button></div>
      <label class="small muted" for="privacy">Quem vê seu perfil</label>
      <select id="privacy" class="field">${PRIVACY.map(([k, l]) => `<option value="${k}"${(mine.privacy || 'public') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="check"><input id="showValue" type="checkbox"${mine.showValue ? ' checked' : ''}> Mostrar o valor da coleção no perfil</label></div>`;
  }
  async function fillFriends() {
    const box = $('#friendsBox');
    if (!box || !me || blocked || !mine?.username) return;
    box.innerHTML = `<div class="section-head"><h2>Amigos</h2><span class="muted small" id="followCount"></span></div>
      <input id="peopleQ" class="field" type="search" placeholder="Procurar pessoas por @usuário" aria-label="Procurar pessoas" autocomplete="off" autocapitalize="none">
      <div id="peopleOut" class="people"></div><div id="followingOut" class="people"><p class="muted small">Carregando…</p></div>`;
    try {
      const [following, followers] = await Promise.all([
        db().collection('follows').doc(me.uid).collection('following').get(),
        db().collection('followers').doc(me.uid).collection('list').get(),
      ]);
      $('#followCount') && ($('#followCount').textContent = `${following.size} seguindo · ${followers.size} ${followers.size === 1 ? 'seguidor' : 'seguidores'}`);
      const out = $('#followingOut'); if (!out) return;
      out.innerHTML = following.size ? following.docs.map(d => personRow(d.data().username, d.id, true)).join('')
        : '<p class="muted small">Você ainda não segue ninguém. Procure seus amigos pelo nome de usuário.</p>';
    } catch (e) { blocked = denied(e); }
  }
  function personRow(username, uid, following, info = '') {
    return `<div class="person"><button type="button" class="person-main" data-friend="${esc(username)}"><span class="avatar initials">${esc(username.charAt(0).toUpperCase())}</span>
      <span><b>@${esc(username)}</b>${info ? `<span class="muted small">${esc(info)}</span>` : ''}</span></button>
      ${uid !== me?.uid ? `<button class="btn ${following ? 'alt' : ''} auto" type="button" data-follow="${esc(uid)}" data-username="${esc(username)}">${following ? 'Seguindo' : 'Seguir'}</button>` : ''}</div>`;
  }
  async function searchPeople(q) {
    const out = $('#peopleOut'); if (!out) return;
    const p = q.trim().toLowerCase().replace(/^@/, '');
    if (p.length < 2) { out.innerHTML = ''; return; }
    try {
      const id = firebase.firestore.FieldPath.documentId();
      const [res, mineF] = await Promise.all([
        db().collection('usernames').where(id, '>=', p).where(id, '<', p + '').limit(10).get(),
        db().collection('follows').doc(me.uid).collection('following').get(),
      ]);
      const follows = new Set(mineF.docs.map(d => d.id));
      if ($('#peopleQ')?.value.trim().toLowerCase().replace(/^@/, '') !== p) return;
      out.innerHTML = res.size ? res.docs.map(d => personRow(d.id, d.data().uid, follows.has(d.data().uid))).join('') : '<p class="muted small">Ninguém com esse nome.</p>';
    } catch (e) { out.innerHTML = '<p class="muted small">Não consegui procurar agora.</p>'; }
  }
  async function toggleFollow(uid, username, btn) {
    if (!me) { toast('Entre na sua conta para seguir pessoas'); return; }
    const a = db().collection('follows').doc(me.uid).collection('following').doc(uid);
    const b = db().collection('followers').doc(uid).collection('list').doc(me.uid);
    const following = btn.textContent.trim() === 'Seguindo';
    btn.disabled = true;
    try {
      const batch = db().batch();
      if (following) { batch.delete(a); batch.delete(b); }
      else { batch.set(a, { username, at: Date.now() }); batch.set(b, { username: mine?.username || '', at: Date.now() }); }
      await batch.commit();
      btn.textContent = following ? 'Seguir' : 'Seguindo';
      btn.classList.toggle('alt', !following);
    } catch { toast('Não consegui atualizar agora'); }
    btn.disabled = false;
  }

  /* ---------- Página de outra pessoa ---------- */
  async function renderFriend() {
    const name = route.friend;
    const back = '<button class="back" type="button" data-friend-back>‹ Voltar</button>';
    view.innerHTML = `${back}<p class="muted">Abrindo o perfil de @${esc(name)}…</p>`;
    if (!await waitDb()) { view.innerHTML = `${back}<p class="muted">Não consegui conectar. Verifique a internet.</p>`; return; }
    let uid, p, cards = null;
    try {
      const u = await db().collection('usernames').doc(name).get();
      if (!u.exists) { view.innerHTML = `${back}<div class="empty"><h2>Perfil não encontrado</h2><p class="muted">Ninguém usa o nome @${esc(name)}.</p></div>`; return; }
      uid = u.data().uid;
      p = (await db().collection('profiles').doc(uid).get()).data();
    } catch (e) {
      view.innerHTML = `${back}<div class="empty"><h2>Perfil privado</h2><p class="muted">@${esc(name)} deixou o perfil fechado.</p></div>`; return;
    }
    if (route.tab !== 'friend' || route.friend !== name) return;
    if (p.privacy === 'public') {
      try { cards = (await db().collection('users').doc(uid).collection('cards').get()).docs.filter(d => d.id !== '__profile').map(d => d.data()); }
      catch { cards = null; }
    }
    let following = false;
    if (me && uid !== me.uid) {
      try { following = (await db().collection('follows').doc(me.uid).collection('following').doc(uid).get()).exists; } catch { /* sem informação */ }
    }
    if (route.tab !== 'friend' || route.friend !== name) return;
    const photo = p.photo ? `<img class="avatar" src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar initials">${esc((p.name || name).charAt(0).toUpperCase())}</span>`;
    const showcase = (p.showcase || []).map(c => ({ ...c, imageEn: c.image }));
    const theyHave = cards ? cards.filter(c => !store.cards[c.id]) : [];
    const inCommon = cards ? cards.filter(c => store.cards[c.id]).length : 0;
    const followBtn = me && uid !== me.uid ? `<button class="btn ${following ? 'alt' : ''}" type="button" data-follow="${esc(uid)}" data-username="${esc(name)}">${following ? 'Seguindo' : 'Seguir'}</button>`
      : !me ? '<button class="btn" type="button" data-tab="settings">Entre para seguir</button>' : '';
    const sorted = cards ? [...cards].sort((a, b) => String(a.setName).localeCompare(String(b.setName), 'pt-BR') || (parseInt(a.localId, 10) || 0) - (parseInt(b.localId, 10) || 0)) : [];
    view.innerHTML = `${back}<div class="banner"></div>
      <div class="identity"><span class="ring-avatar">${photo}</span><h1>${esc(p.name || name)}</h1><span class="muted">@${esc(name)}</span>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</div>
      ${followBtn}
      <div class="stat-grid">
        <div class="stat"><b>${p.cards ?? 0}</b><span>Cartas</span></div>
        <div class="stat"><b>${p.unique ?? 0}</b><span>Diferentes</span></div>
        ${p.showValue && p.value != null ? `<div class="stat"><b>${money(p.value)}</b><span>Valor da coleção</span></div>` : ''}
        ${cards && me ? `<div class="stat"><b>${inCommon}</b><span>Em comum com você</span></div>` : ''}</div>
      ${showcase.length ? `<div class="section"><h2>Vitrine</h2><div class="showcase"><div class="star-card"><span class="holo idle">${imgTag(showcase[0], 'high', showcase[0].name)}</span>
        <span><b>${esc(showcase[0].name)}</b><br><span class="muted small">${esc(showcase[0].setName)}</span></span></div>
        <div class="showcase-grid">${showcase.slice(1).map(c => `<button class="show-slot" type="button" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, 'low', c.name)}</button>`).join('')}</div></div></div>` : ''}
      ${cards ? `<div class="section"><div class="section-head"><h2>Coleção</h2><span class="muted small">${me ? `${theyHave.length} que você não tem` : ''}</span></div>
        ${sorted.length ? `<div class="binder">${sorted.slice(0, 300).map(c => `<button type="button" class="pocket catalog" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c)}<span class="tag">${esc(c.localId)}</span>${store.cards[c.id] ? '<span class="have">✓</span>' : ''}</button>`).join('')}</div>`
          : '<p class="muted">Ainda sem cartas.</p>'}</div>`
        : p.privacy === 'showcase' ? '<p class="muted">Este perfil mostra só a vitrine.</p>' : ''}
      ${!me ? '<div class="empty"><h2>Comece sua coleção no Boosterz</h2><p class="muted">Escaneie suas cartas, acompanhe o valor e siga seus amigos.</p><button class="btn" type="button" data-tab="settings">Criar minha conta</button></div>' : ''}`;
  }
  function openFromHash() {
    const h = decodeURIComponent(location.hash || '');
    if (!h.startsWith('#@')) return false;
    go({ tab: 'friend', friend: h.slice(2).toLowerCase(), setId: null });
    return true;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'claimForm') return;
    e.preventDefault();
    const msg = $('#claimMsg'), btn = $('[form="claimForm"]');
    btn.disabled = true;
    const err = await claim($('#claimName').value);
    btn.disabled = false;
    if (err) { msg.textContent = err; msg.hidden = false; return; }
    toast('Nome salvo. Seu perfil já está no ar.');
    render();
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'privacy' && mine) { mine.privacy = e.target.value; publish().then(() => toast('Privacidade atualizada')); }
    if (e.target.id === 'showValue' && mine) { mine.showValue = e.target.checked; publish(); }
  });
  let peopleTimer;
  document.addEventListener('input', e => {
    if (e.target.id !== 'peopleQ') return;
    clearTimeout(peopleTimer); peopleTimer = setTimeout(() => searchPeople(e.target.value), 250);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shareProfile !== undefined) share();
    else if (b.dataset.follow) toggleFollow(b.dataset.follow, b.dataset.username, b);
    else if (b.dataset.friend) { history.replaceState(null, '', '#@' + b.dataset.friend); go({ tab: 'friend', friend: b.dataset.friend }); }
    else if (b.dataset.friendBack !== undefined) { history.replaceState(null, '', location.pathname); go({ tab: me ? 'profile' : 'home', friend: null }); }
  });
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  return { onUser, ownBlock, fillFriends, renderFriend, publishSoon };
})();
