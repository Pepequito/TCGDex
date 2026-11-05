'use strict';
// Parte social: nome de usuário, perfil público, seguir pessoas, feed do que os amigos adicionam, curtidas e comentários.
// Perfil público em profiles/{uid}; atividades em users/{uid}/activity/{id}, com likes/{uid} e comments/{id} dentro.
window.Social = (() => {
  const NAME = /^[a-z0-9_]{3,20}$/;
  const PRIVACY = [['public', 'Público: vitrine, coleção e atividade'], ['showcase', 'Só a vitrine e a atividade'], ['private', 'Privado']];
  const GROUP_MS = 15 * 60e3, GROUP_MAX = 12;
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
  const ago = t => {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`;
    return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  const initials = (n = '?') => `<span class="avatar initials">${esc(String(n).trim().charAt(0).toUpperCase() || '?')}</span>`;
  const face = p => p?.photo ? `<img class="avatar" src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer">` : initials(p?.name || p?.username);

  /* ---------- Meu perfil público ---------- */
  function onUser(u) {
    me = u; mine = null; loaded = false; blocked = false; feed = null;
    if (u) load();
  }
  async function load() {
    try {
      const d = await db().collection('profiles').doc(me.uid).get();
      mine = d.exists ? d.data() : null;
      if (mine) publishSoon();
    } catch (e) { blocked = denied(e); }
    loaded = true;
    if (['profile', 'settings', 'social'].includes(route.tab)) render();
  }
  async function publicDoc() {
    const u = window.Sync?.user?.() || {};
    const p = store.profile, taste = await tasteOf().catch(() => ({ favs: [], sets: [] }));
    return {
      city: p.city || '', state: p.state || '', favs: taste.favs, sets: taste.sets,
      uid: me.uid, username: mine.username, name: trainerName(), bio: p.bio || '',
      photo: p.photo || u.photo || '', privacy: mine.privacy || 'public', showValue: !!mine.showValue,
      value: mine.showValue ? Math.round(collectionValue() * 100) / 100 : null,
      cards: copiesCount(), unique: list().length,
      banner: p.banner || '', ring: p.ring || '', bannerImage: bannerImage() || '',
      showcase: showcaseCards().slice(0, 9).map(c => ({ id: c.id, name: c.name, image: c.image?.startsWith('data:') ? '' : c.image || '', setName: c.setName || '' })),
      updatedAt: Date.now(),
    };
  }
  async function publish() {
    if (!me || !mine?.username || !db()) return;
    try { await db().collection('profiles').doc(me.uid).set(await publicDoc()); }
    catch (e) { blocked = denied(e); }
  }
  function publishSoon() { clearTimeout(timer); timer = setTimeout(publish, 3000); }
  async function claim(raw) {
    const name = raw.trim().toLowerCase().replace(/^@/, '');
    const err = nameError(name);
    if (err) return err;
    const ref = db().collection('usernames').doc(name), prof = db().collection('profiles').doc(me.uid);
    const draft = await publicDoc();
    try {
      await db().runTransaction(async tx => {
        const taken = await tx.get(ref);
        if (taken.exists && taken.data().uid !== me.uid) throw Object.assign(new Error(), { code: 'taken' });
        if (mine?.username && mine.username !== name) tx.delete(db().collection('usernames').doc(mine.username));
        if (!taken.exists) tx.set(ref, { uid: me.uid });
        mine = { ...(mine || { privacy: 'public', showValue: false }), username: name };
        tx.set(prof, { ...draft, uid: me.uid, username: name, privacy: mine.privacy || 'public', showValue: !!mine.showValue });
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
  const handle = () => mine?.username || '';

  /* ---------- Bloco de Ajustes: nome, link e privacidade ---------- */
  function claimForm() {
    return `<h2>Escolha seu nome de usuário</h2>
      <p class="muted small">É por ele que seus amigos encontram você, e ele forma o link do seu perfil.</p>
      <form id="claimForm" class="handle-form"><span class="at">@</span><input id="claimName" class="field" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="seu_nome" aria-label="Nome de usuário"></form>
      <p class="small warn" id="claimMsg" hidden></p><button class="btn" type="submit" form="claimForm">Salvar nome</button>`;
  }
  function ownBlock() {
    if (!window.FICHARIO_FIREBASE) return '';
    const head = '<h2>Perfil público</h2>';
    if (!me) return `<div class="panel social">${head}<p class="muted small">Entre na sua conta para escolher um nome de usuário, compartilhar seu perfil e controlar quem vê sua coleção.</p></div>`;
    if (blocked) return `<div class="panel social">${head}<p class="muted small">Os recursos sociais ainda não foram ativados no Firebase.</p></div>`;
    if (!loaded) return `<div class="panel social">${head}<p class="muted small">Carregando…</p></div>`;
    if (!mine?.username) return `<div class="panel social">${claimForm()}</div>`;
    return `<div class="panel social">${head}<div class="handle-row"><b>@${esc(mine.username)}</b><button class="btn alt auto" type="button" data-share-profile>Compartilhar</button></div>
      <label class="small muted" for="privacy">Quem vê seu perfil</label>
      <select id="privacy" class="field">${PRIVACY.map(([k, l]) => `<option value="${k}"${(mine.privacy || 'public') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="check"><input id="showValue" type="checkbox"${mine.showValue ? ' checked' : ''}> Mostrar o valor da coleção no perfil</label>
      <p class="muted small">No modo privado, ninguém vê seu perfil e suas novas cartas não aparecem no feed dos amigos.</p></div>`;
  }

  /* ---------- Atividade: cartas que acabei de adicionar ---------- */
  // Adições próximas viram um único post ("adicionou 5 cartas"), para o feed não lotar.
  const pending = new Map();
  let flushTimer = null;
  function added(c) {
    if (!me || !mine?.username || mine.privacy === 'private' || c.setId === 'custom') return;
    pending.set(c.id, { id: c.id, name: c.name, image: c.image?.startsWith('data:') ? '' : c.image || '', imageEn: c.imageEn?.startsWith('data:') ? '' : c.imageEn || '', setName: c.setName || '' });
    clearTimeout(flushTimer); flushTimer = setTimeout(flush, 4000);
  }
  async function flush() {
    if (!pending.size || !db() || !me) return;
    const key = 'boosterz.act.' + me.uid;
    let last = null;
    try { last = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* sem último post */ }
    const fresh = [...pending.values()]; pending.clear();
    const col = db().collection('users').doc(me.uid).collection('activity');
    try {
      if (last && Date.now() - last.start < GROUP_MS && last.ids.length < GROUP_MAX) {
        const ref = col.doc(last.id), snap = await ref.get();
        if (snap.exists) {
          const cards = [...snap.data().cards.filter(c => !fresh.some(f => f.id === c.id)), ...fresh].slice(-GROUP_MAX);
          await ref.update({ cards, count: cards.length, at: Date.now() });
          localStorage.setItem(key, JSON.stringify({ ...last, ids: cards.map(c => c.id) }));
          return;
        }
      }
      const ref = col.doc();
      const cards = fresh.slice(-GROUP_MAX);
      await ref.set({ uid: me.uid, username: mine.username, name: trainerName(), at: Date.now(), count: cards.length, cards });
      localStorage.setItem(key, JSON.stringify({ id: ref.id, start: Date.now(), ids: cards.map(c => c.id) }));
    } catch { /* sem regras novas ou sem conexão: o post fica de fora */ }
  }

  /* ---------- Aba Social ---------- */
  let feed = null, people = new Map();
  function renderSocial() {
    const head = '<div class="page-head"><div><h1>Social</h1><span class="muted">O que seus amigos estão colecionando</span></div></div>';
    if (!window.FICHARIO_FIREBASE) { view.innerHTML = `${head}<p class="muted">O login ainda não foi configurado.</p>`; return; }
    if (!me) {
      view.innerHTML = `${head}<div class="empty"><h2>Entre para ver seus amigos</h2><p class="muted">Com uma conta você escolhe um nome de usuário, segue amigos e vê, curte e comenta as cartas que eles adicionam.</p>
        <button class="btn" type="button" data-gate>Entrar ou criar conta</button></div>`;
      return;
    }
    if (blocked) { view.innerHTML = `${head}<p class="muted">Os recursos sociais ainda não foram ativados no Firebase.</p>`; return; }
    if (!loaded) { view.innerHTML = `${head}<p class="muted">Carregando…</p>`; return; }
    if (!mine?.username) { view.innerHTML = `${head}<div class="panel social">${claimForm()}</div>`; return; }
    view.innerHTML = `${head}
      <div class="social-grid"><div class="social-side">
        <div class="panel"><div class="handle-row"><button type="button" class="person-main" data-friend="${esc(mine.username)}"><span class="ring-avatar" ${ringAttrs(store.profile.ring)}>${avatar()}</span><span><b>@${esc(mine.username)}</b><span class="muted small" id="followCount">…</span></span></button>
          <button class="btn alt auto" type="button" data-share-profile>Convidar</button></div>
          <input id="peopleQ" class="field" type="search" placeholder="Procurar pessoas por @usuário" aria-label="Procurar pessoas" autocomplete="off" autocapitalize="none">
          <div id="peopleOut" class="people"></div></div>
        <details class="panel" id="followingBox"><summary><b>Quem você segue</b></summary><div id="followingOut" class="people"><p class="muted small">Carregando…</p></div></details>
      </div><div class="feed-col"><div class="seg" role="tablist" aria-label="Feed">${[['friends', 'Amigos'], ['community', 'Comunidade']].map(([k, l]) => `<button type="button" role="tab" data-stab="${k}" aria-selected="${(route.stab || 'friends') === k}" class="${(route.stab || 'friends') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="feed" id="feed"><p class="muted">Carregando…</p></div></div></div>`;
    loadFeed();
  }
  async function loadFeed() {
    try {
      const [following, followers] = await Promise.all([
        db().collection('follows').doc(me.uid).collection('following').get(),
        db().collection('followers').doc(me.uid).collection('list').get(),
      ]);
      const fc = $('#followCount');
      if (fc) fc.textContent = `${following.size} seguindo · ${followers.size} ${followers.size === 1 ? 'seguidor' : 'seguidores'}`;
      const out = $('#followingOut');
      if (out) out.innerHTML = following.size ? following.docs.map(d => personRow(d.data().username, d.id, true)).join('')
        : '<p class="muted small">Você ainda não segue ninguém.</p>';
      if ((route.stab || 'friends') === 'community') return loadCommunity(new Set(following.docs.map(d => d.id)));
      // Amigos: só o que as pessoas que você segue adicionaram.
      const uids = following.docs.map(d => d.id).slice(0, 40);
      const lists = await Promise.all(uids.map(async uid => {
        try {
          const [acts, prof] = await Promise.all([
            db().collection('users').doc(uid).collection('activity').orderBy('at', 'desc').limit(8).get(),
            uid === me.uid ? null : people.get(uid) || db().collection('profiles').doc(uid).get().then(d => d.data()),
          ]);
          if (prof) people.set(uid, prof);
          return acts.docs.map(d => ({ ...d.data(), aid: d.id }));
        } catch { return []; }
      }));
      feed = lists.flat().sort((a, b) => b.at - a.at).slice(0, 40);
      await Promise.all(feed.map(async a => {
        const ref = actRef(a);
        try {
          const [likes, comments] = await Promise.all([ref.collection('likes').get(), ref.collection('comments').get()]);
          a.likes = likes.size; a.liked = likes.docs.some(d => d.id === me.uid); a.comments = comments.size;
        } catch { a.likes = a.comments = 0; }
      }));
      drawFeed(following.size);
    } catch (e) {
      blocked = denied(e);
      const box = $('#feed'); if (box) box.innerHTML = '<p class="muted">Não consegui carregar o feed. Verifique a conexão.</p>';
    }
  }
  async function withCounts(list_) {
    await Promise.all(list_.map(async a => {
      try {
        const [likes, comments] = await Promise.all([actRef(a).collection('likes').get(), actRef(a).collection('comments').get()]);
        a.likes = likes.size; a.liked = likes.docs.some(d => d.id === me.uid); a.comments = comments.size;
      } catch { a.likes = a.comments = 0; }
    }));
    return list_;
  }
  // Comunidade: perfis públicos ordenados pelo que têm em comum com você (Pokémon, sets e lugar)
  // e o que as pessoas mais parecidas com você adicionaram por último.
  async function loadCommunity(following) {
    const box = $('#feed'); if (!box) return;
    try {
      const [snap, mineT, sp] = await Promise.all([
        db().collection('profiles').where('privacy', 'in', ['public', 'showcase']).limit(300).get(),
        tasteOf(), getSpecies().catch(() => null),
      ]);
      const p = store.profile, same = (x, y) => x && y && norm(x) === norm(y);
      const ranked = snap.docs.map(d => d.data()).filter(x => x.uid !== me.uid && x.username && !following.has(x.uid)).map(x => {
        let score = 0;
        const why = [], favs = (x.favs || []).filter(d => mineT.favs.includes(d)), sets = (x.sets || []).filter(id => mineT.sets.includes(id));
        if (same(p.city, x.city) && same(p.state, x.state)) { score += 6; why.push(`Perto de você: ${x.city}`); }
        else if (p.state && p.state === x.state) { score += 3; why.push(`Também em ${x.state}`); }
        if (favs.length) { score += favs.length * 2; why.push(`Também coleciona ${favs.slice(0, 3).map(d => sp?.byDex.get(d) || '').filter(Boolean).join(', ')}`); }
        if (sets.length) { score += sets.length; why.push(plural(sets.length, 'set em comum', 'sets em comum')); }
        return { x, score, why };
      }).sort((a, b) => b.score - a.score || (b.x.cards || 0) - (a.x.cards || 0)).slice(0, 20);
      for (const r of ranked) people.set(r.x.uid, r.x);
      const acts = (await Promise.all(ranked.slice(0, 10).map(r => db().collection('users').doc(r.x.uid).collection('activity').orderBy('at', 'desc').limit(3).get()
        .then(q => q.docs.map(d => ({ ...d.data(), aid: d.id }))).catch(() => [])))).flat().sort((a, b) => b.at - a.at).slice(0, 20);
      feed = await withCounts(acts);
      if (route.tab !== 'social' || (route.stab || 'friends') !== 'community') return;
      const place = !p.state ? '<p class="muted small">Dica: informe sua cidade e estado em Perfil › Editar perfil para encontrar colecionadores perto de você.</p>' : '';
      box.innerHTML = `${place}<h2>Sugestões para você</h2>
        ${ranked.length ? `<div class="suggest">${ranked.map(({ x, why }) => `<div class="person suggestion"><button type="button" class="person-main" data-friend="${esc(x.username)}"><span class="ring-avatar" ${ringAttrs(x.ring)}>${face(x)}</span>
          <span><b>${esc(x.name || x.username)}</b><span class="muted small">@${esc(x.username)} · ${plural(x.cards || 0, 'carta', 'cartas')}</span>${why.length ? `<span class="small why">${esc(why.join(' · '))}</span>` : ''}</span></button>
          <button class="btn auto" type="button" data-follow="${esc(x.uid)}" data-username="${esc(x.username)}">Seguir</button></div>`).join('')}</div>`
          : '<p class="muted">Ainda não há outros perfis públicos. Convide seus amigos!</p>'}
        ${feed.length ? `<h2>Atividade da comunidade</h2>${feed.map(post).join('')}` : ''}`;
    } catch (e) {
      box.innerHTML = '<p class="muted">Não consegui carregar a comunidade agora.</p>';
    }
  }
  const actRef = a => db().collection('users').doc(a.uid).collection('activity').doc(a.aid);
  function drawFeed(followingCount) {
    const box = $('#feed'); if (!box || route.tab !== 'social') return;
    if (!feed.length) {
      box.innerHTML = `<div class="empty"><h2>${followingCount ? 'Nada novo por aqui' : 'Seu feed está vazio'}</h2>
        <p class="muted">${followingCount ? 'Quando seus amigos adicionarem cartas, elas aparecem aqui.' : 'Procure seus amigos pelo nome de usuário ou veja sugestões na aba Comunidade.'}</p></div>`;
      return;
    }
    box.innerHTML = feed.map(post).join('');
  }
  function post(a) {
    const mineAct = a.uid === me.uid, p = mineAct ? { photo: store.profile.photo || window.Sync?.user?.()?.photo, name: trainerName(), ring: store.profile.ring } : people.get(a.uid) || a;
    const cards = a.cards || [], key = `${a.uid}/${a.aid}`;
    return `<article class="post" data-act="${esc(key)}">
      <header><button type="button" class="person-main" data-friend="${esc(a.username)}"><span class="ring-avatar" ${ringAttrs(p.ring)}>${face(p)}</span>
        <span><b>${esc(p.name || a.name || a.username)}</b><span class="muted small">@${esc(a.username)} · ${ago(a.at)}</span></span></button></header>
      <p>${mineAct ? 'Você adicionou' : 'Adicionou'} ${cards.length === 1 ? `<b>${esc(cards[0].name)}</b> <span class="muted">· ${esc(cards[0].setName)}</span>` : `<b>${cards.length} cartas</b> à coleção`}</p>
      <div class="post-cards${cards.length === 1 ? ' one' : ''}">${cards.slice(0, 6).map(c => `<button type="button" class="pocket catalog" data-card="${esc(c.id)}" aria-label="${esc(c.name)}">${imgTag(c, cards.length === 1 ? 'high' : 'low', c.name)}${store.cards[c.id] && !mineAct ? '<span class="have">✓</span>' : ''}</button>`).join('')}
        ${cards.length > 6 ? `<span class="more-cards">+${cards.length - 6}</span>` : ''}</div>
      <footer><button type="button" class="react${a.liked ? ' on' : ''}" data-like="${esc(key)}" aria-pressed="${a.liked}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/></svg><span>${a.likes || ''}</span><span class="sr">Curtir</span></button>
        <button type="button" class="react" data-comments="${esc(key)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span>${a.comments || ''}</span><span class="sr">Comentar</span></button></footer></article>`;
  }
  const findAct = key => feed?.find(a => `${a.uid}/${a.aid}` === key);
  async function toggleLike(key, btn) {
    const a = findAct(key); if (!a) return;
    const ref = actRef(a).collection('likes').doc(me.uid);
    a.liked = !a.liked; a.likes = (a.likes || 0) + (a.liked ? 1 : -1);
    btn.classList.toggle('on', a.liked); btn.setAttribute('aria-pressed', a.liked); btn.querySelector('span').textContent = a.likes || '';
    try { a.liked ? await ref.set({ username: mine.username, at: Date.now() }) : await ref.delete(); }
    catch { toast('Não consegui curtir agora'); }
  }
  async function openComments(key) {
    const a = findAct(key); if (!a) return;
    openSheet(`<button class="sheet-x" type="button" data-close aria-label="Fechar">✕</button><h2>Comentários</h2>
      <div id="commentList" class="comments"><p class="muted small">Carregando…</p></div>
      <form id="commentForm" class="comment-form" data-key="${esc(key)}"><input id="commentText" class="field" maxlength="300" placeholder="Escreva um comentário" aria-label="Comentário" autocomplete="off"><button class="btn auto" type="submit">Enviar</button></form>`);
    drawComments(a);
  }
  async function drawComments(a) {
    const box = $('#commentList'); if (!box) return;
    try {
      const snap = await actRef(a).collection('comments').orderBy('at').limit(100).get();
      a.comments = snap.size;
      box.innerHTML = snap.size ? snap.docs.map(d => {
        const c = d.data(), canDelete = c.uid === me.uid || a.uid === me.uid;
        return `<div class="comment"><button type="button" class="link" data-friend="${esc(c.username)}">@${esc(c.username)}</button> ${esc(c.text)}
          <span class="muted small">${ago(c.at)}</span>${canDelete ? `<button type="button" class="link muted small" data-uncomment="${esc(d.id)}">apagar</button>` : ''}</div>`;
      }).join('') : '<p class="muted small">Seja a primeira pessoa a comentar.</p>';
    } catch { box.innerHTML = '<p class="muted small">Não consegui carregar os comentários.</p>'; }
  }

  /* ---------- Pessoas ---------- */
  function personRow(username, uid, following, info = '') {
    return `<div class="person"><button type="button" class="person-main" data-friend="${esc(username)}">${initials(username)}
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
    const showcase = (p.showcase || []).map(c => ({ ...c, imageEn: c.image }));
    const theyHave = cards ? cards.filter(c => !store.cards[c.id]) : [];
    const inCommon = cards ? cards.filter(c => store.cards[c.id]).length : 0;
    const followBtn = me && uid !== me.uid ? `<button class="btn ${following ? 'alt' : ''}" type="button" data-follow="${esc(uid)}" data-username="${esc(name)}">${following ? 'Seguindo' : 'Seguir'}</button>`
      : !me ? '<button class="btn" type="button" data-gate>Entre para seguir</button>' : '';
    const sorted = cards ? [...cards].sort((a, b) => String(a.setName).localeCompare(String(b.setName), 'pt-BR') || (parseInt(a.localId, 10) || 0) - (parseInt(b.localId, 10) || 0)) : [];
    view.innerHTML = `${back}${bannerHtml(p.banner, p.bannerImage)}
      <div class="identity"><span class="ring-avatar" ${ringAttrs(p.ring)}>${face(p)}</span><h1>${esc(p.name || name)}</h1><span class="muted">@${esc(name)}</span>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</div>
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
      ${!me ? '<div class="empty"><h2>Comece sua coleção no Boosterz</h2><p class="muted">Escaneie suas cartas, acompanhe o valor e siga seus amigos.</p><button class="btn" type="button" data-gate>Criar minha conta</button></div>' : ''}`;
  }
  function openFromHash() {
    const h = decodeURIComponent(location.hash || '');
    if (!h.startsWith('#@')) return false;
    go({ tab: 'friend', friend: h.slice(2).toLowerCase(), setId: null });
    return true;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('submit', async e => {
    if (e.target.id === 'commentForm') {
      e.preventDefault();
      const a = findAct(e.target.dataset.key), input = $('#commentText'), text = input.value.trim();
      if (!a || !text) return;
      input.disabled = true;
      try {
        await actRef(a).collection('comments').add({ uid: me.uid, username: mine.username, text: text.slice(0, 300), at: Date.now() });
        input.value = '';
        await drawComments(a);
        const n = $(`[data-comments="${CSS.escape(e.target.dataset.key)}"] span`); if (n) n.textContent = a.comments || '';
      } catch { toast('Não consegui comentar agora'); }
      input.disabled = false; input.focus();
      return;
    }
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
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.stab) { route.stab = d.stab; renderSocial(); }
    else if (d.shareProfile !== undefined) share();
    else if (d.follow) toggleFollow(d.follow, d.username, b);
    else if (d.like) toggleLike(d.like, b);
    else if (d.comments) openComments(d.comments);
    else if (d.uncomment) {
      const key = $('#commentForm')?.dataset.key, a = findAct(key); if (!a) return;
      try { await actRef(a).collection('comments').doc(d.uncomment).delete(); await drawComments(a); } catch { toast('Não consegui apagar'); }
    }
    else if (d.friend) {
      if (!sheet.hidden) closeSheet();
      history.replaceState(null, '', '#@' + d.friend); go({ tab: 'friend', friend: d.friend });
    }
    else if (d.friendBack !== undefined) { history.replaceState(null, '', location.pathname); go({ tab: me ? 'social' : 'home', friend: null }); }
  });
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  return { onUser, ownBlock, renderSocial, renderFriend, publishSoon, added, handle };
})();
