/* ProjectRabs — shared, public website backed by Supabase */
(() => {
  'use strict';

  const config = window.PROJECTRABS_CONFIG || {};
  const app = document.getElementById('app');
  const supabaseLib = window.supabase;
  let db = null;
  let user = null;
  let profile = null;
  let profiles = [];
  let characters = [];
  let activeTab = 'feed';
  let openedCharacter = null;
  let errorMessage = '';
  let search = '';
  let profileToView = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const dateText = value => new Date(value).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  const usernameFor = p => p?.username || 'creator';
  const displayFor = p => p?.display_name || p?.username || 'Creator';
  const notice = text => { errorMessage = text; render(); };

  function header() {
    return `<header class="topbar"><div class="brand" data-action="home"><div class="brand-badge">🎨</div><div class="brand-text"><h1>ProjectRabs</h1><span class="tagline">a corkboard for your characters</span></div></div><nav class="site-nav"><button data-tab="feed" class="btn small ${activeTab==='feed'?'purple':''}">🧵 Feed</button><button data-tab="profiles" class="btn small ${activeTab==='profiles'?'purple':''}">👥 Creators</button>${user ? `<button data-tab="myocs" class="btn small ${activeTab==='myocs'?'purple':''}">🗂️ My OCs</button><button data-tab="settings" class="btn small ${activeTab==='settings'?'purple':''}">⚙️ Profile</button><button data-action="logout" class="btn danger small">Log out</button>` : `<button data-action="login" class="btn purple small">Log in / Sign up</button>`}</nav></header>`;
  }

  function cards(list) {
    if (!list.length) return `<div class="empty-state"><span class="big-emoji">🖇️</span>No characters yet. Sign up and pin the first one!</div>`;
    return `<div class="pinboard">${list.map(c => {
      const p = c.profile || {};
      const image = (c.images || [])[0];
      return `<article class="pin-card" data-open="${esc(c.id)}"><div class="image-container">${image ? `<img src="${esc(image)}" loading="lazy" alt="${esc(c.name)}">` : `<div class="empty-art">🎨</div>`}${c.content_warning ? '<span class="cw-badge">⚠️ Content warning</span>' : ''}</div><h3>${esc(c.name)}</h3><div class="byline"><button class="text-link" data-profile="${esc(p.id || c.owner_id)}">by ${esc(displayFor(p))} (@${esc(usernameFor(p))})</button></div><div class="mini-tags">${c.pronouns ? `<span>${esc(c.pronouns)}</span>`:''}${c.gender ? `<span>${esc(c.gender)}</span>`:''}${(c.tags||[]).slice(0,3).map(t=>`<span>#${esc(t)}</span>`).join('')}</div><div class="stats-row"><span>❤️ ${(c.likes||[]).length}</span><span>💬 ${(c.comments||[]).length}</span></div></article>`;
    }).join('')}</div>`;
  }

  function feedView() {
    const q = search.trim().toLowerCase();
    const list = characters.filter(c => !q || [c.name,c.description,c.profile?.username,c.profile?.display_name,...(c.tags||[])].some(v=>String(v||'').toLowerCase().includes(q)));
    return `<section class="board-note">📌 Everyone's characters, pinned up in one place. Browse, meet creators, and leave a kind comment.</section><div class="feed-controls"><input id="search" type="search" placeholder="🔍 Search characters or creators..." value="${esc(search)}"></div>${cards(list)}`;
  }

  function profilesView() {
    return `<section class="card-surface"><h2>👥 Creator profiles</h2><p>Meet the people sharing characters on ProjectRabs.</p><div class="profile-grid">${profiles.map(p=>`<button class="creator-card" data-profile="${esc(p.id)}"><span class="creator-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : esc((displayFor(p)[0]||'C').toUpperCase())}</span><strong>${esc(displayFor(p))}</strong><span>@${esc(usernameFor(p))}</span>${p.pronouns?`<span>${esc(p.pronouns)}</span>`:''}<small>${esc(p.bio||'Character creator')}</small></button>`).join('') || '<p>No creator profiles yet.</p>'}</div></section>`;
  }

  function myOcsView() {
    const mine = characters.filter(c=>c.owner_id===user?.id);
    return `<section class="card-surface"><div class="section-header"><h2>🗂️ My OCs (${mine.length})</h2><button class="btn purple" data-action="new-character">+ New character</button></div>${cards(mine)}</section>`;
  }

  function settingsView() {
    const p = profile || {};
    return `<section class="card-surface"><h2>🙋 Your public profile</h2><p>Your profile and characters are visible to visitors.</p><form id="profile-form"><label>Username</label><input name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" value="${esc(p.username||'')}"><label>Display name</label><input name="display_name" required maxlength="40" value="${esc(p.display_name||'')}"><label>Pronouns</label><input name="pronouns" maxlength="40" value="${esc(p.pronouns||'')}"><label>Gender</label><input name="gender" maxlength="40" value="${esc(p.gender||'')}"><label>Bio</label><textarea name="bio" maxlength="500">${esc(p.bio||'')}</textarea><label>Avatar image (optional, small image)</label><input name="avatar" type="file" accept="image/*"><button class="btn purple" type="submit">Save profile</button></form></section>`;
  }

  function characterForm() {
    return `<section class="card-surface"><h2>✨ Pin a character</h2><form id="character-form"><label>Name</label><input name="name" required maxlength="60"><label>Pronouns</label><input name="pronouns" maxlength="40"><label>Gender</label><input name="gender" maxlength="40"><label>Tags (comma separated)</label><input name="tags" maxlength="300" placeholder="fantasy, elf, magic"><label>Character image (optional, max 1.5 MB)</label><input name="image" type="file" accept="image/*"><label>Description / backstory</label><textarea name="description" required maxlength="4000"></textarea><label class="check-row"><input name="content_warning" type="checkbox"> This post contains mature themes (NSFW)</label><button class="btn purple" type="submit">Pin to the board</button><button class="btn ghost" type="button" data-action="cancel-form">Cancel</button></form></section>`;
  }

  function profileModal(p) {
    const mine = characters.filter(c=>c.owner_id===p.id);
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal card-surface" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal">✕</button><div class="public-profile-head"><span class="creator-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:esc((displayFor(p)[0]||'C').toUpperCase())}</span><div><h2>${esc(displayFor(p))}</h2><p>@${esc(usernameFor(p))}${p.pronouns?` · ${esc(p.pronouns)}`:''}</p></div></div><p>${esc(p.bio||'')}</p><h3>Characters (${mine.length})</h3>${cards(mine)}</section></div>`;
  }

  function characterModal(c) {
    if (!c) return '';
    const p = c.profile || {};
    const isOwner = user?.id === c.owner_id;
    const comments = c.comments || [];
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal card-surface" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal">✕</button><h2>${esc(c.name)} ${c.content_warning?'⚠️':''}</h2><p class="byline"><button class="text-link" data-profile="${esc(p.id||c.owner_id)}">${esc(displayFor(p))} (@${esc(usernameFor(p))})</button> · ${dateText(c.created_at)}</p><div class="mini-tags">${c.pronouns?`<span>${esc(c.pronouns)}</span>`:''}${c.gender?`<span>${esc(c.gender)}</span>`:''}${(c.tags||[]).map(t=>`<span>#${esc(t)}</span>`).join('')}</div>${(c.images||[]).map(src=>`<img class="modal-image" src="${esc(src)}" alt="${esc(c.name)}">`).join('')}<div class="desc-box">${esc(c.description)}</div><div class="like-row"><button class="btn ${c.likedByMe?'danger':'ghost'}" data-action="like" data-id="${esc(c.id)}">❤️ ${c.likedByMe?'Liked':'Like'} (${(c.likes||[]).length})</button>${isOwner?`<button class="btn danger small" data-action="delete-character" data-id="${esc(c.id)}">Delete</button>`:''}</div><div class="comments-section"><h3>💬 Comments (${comments.length})</h3>${comments.map(x=>`<article class="comment"><strong>${esc(displayFor(x.profile))}</strong> <small>${dateText(x.created_at)}</small><p>${esc(x.body)}</p>${(user?.id===x.author_id||isOwner)?`<button class="text-link" data-action="delete-comment" data-id="${esc(x.id)}">Delete</button>`:''}</article>`).join('') || '<p>No comments yet. Be the first to say hi!</p>'}${user?`<form id="comment-form"><textarea name="body" required maxlength="500" placeholder="Write a comment..."></textarea><button class="btn secondary" type="submit">Post comment</button></form>`:'<p><button class="text-link" data-action="login">Log in or sign up</button> to leave a comment.</p>'}</div></section></div>`;
  }

  function render() {
    if (!db) {
      app.innerHTML = `<main class="auth-wrap"><section class="auth-box card-surface"><h1>ProjectRabs setup needed</h1><p>${esc(errorMessage || 'The Supabase client could not be started.')}</p><p>Check the project settings and reload this page.</p></section></main>`;
      return;
    }
    const body = activeTab==='profiles' ? profilesView() : activeTab==='myocs' ? myOcsView() : activeTab==='settings' ? settingsView() : activeTab==='new-character' ? characterForm() : feedView();
    app.innerHTML = `<div class="site-shell">${header()}<main class="main-content">${errorMessage?`<div class="error-msg" role="alert">${esc(errorMessage)}<button data-action="clear-error">✕</button></div>`:''}${body}</main><footer class="footer-note">ProjectRabs is a community website. Your profile, characters, and comments are stored in the shared database.</footer></div>${openedCharacter?characterModal(openedCharacter):''}${profileToView?profileModal(profileToView):''}`;
    attachHandlers();
  }

  function authView(mode='login') {
    activeTab = 'auth';
    app.innerHTML = `<main class="auth-wrap"><section class="auth-box card-surface"><div class="brand-center"><div class="brand-badge">🎨</div><h1>ProjectRabs</h1><p>A corkboard for your characters</p></div><div class="pronoun-note">🏳️‍🌈 An LGBTQIA+ inclusive space to create and share original characters.</div><div class="auth-tabs"><button data-auth-mode="login" class="${mode==='login'?'active':''}">Log in</button><button data-auth-mode="signup" class="${mode==='signup'?'active':''}">Sign up</button></div>${errorMessage?`<div class="error-msg">${esc(errorMessage)}</div>`:''}${mode==='signup'?`<form id="signup-form"><label>Display name</label><input name="display_name" required maxlength="40" autocomplete="name"><label>Username (3–24 letters, numbers, underscores)</label><input name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" autocomplete="username"><label>Email</label><input name="email" type="email" required autocomplete="email"><label>Password (at least 8 characters)</label><input name="password" type="password" required minlength="8" autocomplete="new-password"><button class="btn secondary" type="submit">Create account</button></form>`:`<form id="login-form"><label>Email</label><input name="email" type="email" required autocomplete="email"><label>Password</label><input name="password" type="password" required autocomplete="current-password"><button class="btn purple" type="submit">Log in</button></form>`}<button class="btn ghost" data-action="browse">Browse without an account</button></section></main>`;
    attachHandlers();
  }

  async function loadProfiles() {
    const {data,error} = await db.from('profiles').select('*').order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
    profiles = data || [];
  }

  async function loadFeed() {
    const [{data:rows,error:characterError},{data:likeRows,error:likeError},{data:commentRows,error:commentError}] = await Promise.all([
      db.from('characters').select('*, profile:profiles!characters_owner_id_fkey(id,username,display_name,bio,pronouns,gender,avatar_url)').order('created_at',{ascending:false}).limit(100),
      db.from('likes').select('user_id,character_id'),
      db.from('comments').select('character_id')
    ]);
    if (characterError) throw characterError;
    if (likeError) throw likeError;
    if (commentError) throw commentError;
    const likesByCharacter = new Map(), commentsByCharacter = new Map();
    (likeRows||[]).forEach(l=>{const a=likesByCharacter.get(l.character_id)||[];a.push(l.user_id);likesByCharacter.set(l.character_id,a);});
    (commentRows||[]).forEach(c=>commentsByCharacter.set(c.character_id,(commentsByCharacter.get(c.character_id)||0)+1));
    characters = (rows||[]).map(c=>({...c,likes:likesByCharacter.get(c.id)||[],comments:Array(commentsByCharacter.get(c.id)||0),likedByMe:(likesByCharacter.get(c.id)||[]).includes(user?.id)}));
  }

  async function loadComments(characterId) {
    const {data,error} = await db.from('comments').select('*, profile:profiles!comments_author_id_fkey(id,username,display_name,avatar_url)').eq('character_id',characterId).order('created_at',{ascending:true});
    if (error) throw error;
    return data||[];
  }

  async function openCharacter(id) {
    const c=characters.find(item=>item.id===id);
    if(!c) return;
    try { c.comments=await loadComments(id); openedCharacter=c; render(); }
    catch(e){notice(`Could not load comments: ${e.message}`);}
  }

  async function openProfile(id) {
    try {
      let p=profiles.find(item=>item.id===id);
      if(!p){const {data,error}=await db.from('profiles').select('*').eq('id',id).single();if(error)throw error;p=data;}
      profileToView=p;openedCharacter=null;render();
    } catch(e){notice(`Could not load profile: ${e.message}`);}
  }

  async function fileAsDataUrl(file, maxBytes) {
    if(!file) return '';
    if(file.size>maxBytes) throw new Error(`Please choose a smaller image (maximum ${Math.round(maxBytes/1024/1024*10)/10} MB).`);
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});
  }

  function attachHandlers() {
    document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=async()=>{errorMessage='';openedCharacter=null;profileToView=null;activeTab=el.dataset.tab;try{if(activeTab==='feed'||activeTab==='myocs')await loadFeed();if(activeTab==='profiles')await loadProfiles();render();}catch(e){notice(e.message);}});
    document.querySelectorAll('[data-action]').forEach(el=>el.onclick=async e=>{e.stopPropagation();const action=el.dataset.action;try{
      if(action==='home'||action==='browse'){openedCharacter=null;profileToView=null;activeTab='feed';if(user)await loadFeed();render();}
      if(action==='login')authView('login');
      if(action==='logout'){await db.auth.signOut();user=null;profile=null;openedCharacter=null;activeTab='feed';authView('login');}
      if(action==='new-character'){activeTab='new-character';errorMessage='';render();}
      if(action==='cancel-form'){activeTab='myocs';render();}
      if(action==='close-modal'){if(e.target===el||el.classList.contains('modal-close')){openedCharacter=null;profileToView=null;render();}}
      if(action==='clear-error'){errorMessage='';render();}
      if(action==='like')await toggleLike(el.dataset.id);
      if(action==='delete-character')await deleteCharacter(el.dataset.id);
      if(action==='delete-comment')await deleteComment(el.dataset.id);
    }catch(err){notice(err.message||'Something went wrong.');}});
    document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openCharacter(el.dataset.open));
    document.querySelectorAll('[data-profile]').forEach(el=>el.onclick=e=>{e.stopPropagation();openProfile(el.dataset.profile);});
    document.querySelectorAll('[data-auth-mode]').forEach(el=>el.onclick=()=>{errorMessage='';authView(el.dataset.authMode);});
    const searchInput=document.getElementById('search');if(searchInput)searchInput.oninput=()=>{search=searchInput.value;const pos=searchInput.selectionStart;render();const next=document.getElementById('search');next?.focus();next?.setSelectionRange(pos,pos);};
    const loginForm=document.getElementById('login-form');if(loginForm)loginForm.onsubmit=login;
    const signupForm=document.getElementById('signup-form');if(signupForm)signupForm.onsubmit=signup;
    const profileForm=document.getElementById('profile-form');if(profileForm)profileForm.onsubmit=saveProfile;
    const characterFormEl=document.getElementById('character-form');if(characterFormEl)characterFormEl.onsubmit=createCharacter;
    const commentForm=document.getElementById('comment-form');if(commentForm)commentForm.onsubmit=postComment;
  }

  async function login(e) {
    e.preventDefault();errorMessage='';const fd=new FormData(e.currentTarget);
    const {error}=await db.auth.signInWithPassword({email:String(fd.get('email')).trim().toLowerCase(),password:fd.get('password')});
    if(error){errorMessage=error.message;authView('login');}
  }

  async function signup(e) {
    e.preventDefault();errorMessage='';const fd=new FormData(e.currentTarget);
    const username=String(fd.get('username')).trim().toLowerCase();
    if(!/^[a-z0-9_]{3,24}$/.test(username)){errorMessage='Username must be 3–24 letters, numbers, or underscores.';authView('signup');return;}
    const {data,error}=await db.auth.signUp({email:String(fd.get('email')).trim().toLowerCase(),password:fd.get('password'),options:{data:{username,display_name:String(fd.get('display_name')).trim()}}});
    if(error){errorMessage=error.message;authView('signup');return;}
    if(data.session){user=data.user;await refreshUser();activeTab='feed';await loadFeed();render();}
    else{errorMessage='Account created! Check your email to confirm it, then log in. If the confirmation email does not arrive, check your spam folder.';authView('login');}
  }

  async function refreshUser() {
    if(!user)return;
    const {data,error}=await db.from('profiles').select('*').eq('id',user.id).single();
    if(error)throw error;
    profile=data;
    const index=profiles.findIndex(p=>p.id===data.id);if(index>=0)profiles[index]=data;else profiles.unshift(data);
  }

  async function saveProfile(e) {
    e.preventDefault();const fd=new FormData(e.currentTarget);let avatar=profile.avatar_url||'';
    try{if(fd.get('avatar')?.size)avatar=await fileAsDataUrl(fd.get('avatar'),500*1024);}catch(err){notice(err.message);return;}
    const changes={username:String(fd.get('username')).trim().toLowerCase(),display_name:String(fd.get('display_name')).trim(),pronouns:String(fd.get('pronouns')).trim(),gender:String(fd.get('gender')).trim(),bio:String(fd.get('bio')).trim(),avatar_url:avatar};
    const {data,error}=await db.from('profiles').update(changes).eq('id',user.id).select().single();
    if(error)throw error;profile=data;profiles=profiles.map(p=>p.id===data.id?data:p);errorMessage='Profile saved.';render();
  }

  async function createCharacter(e) {
    e.preventDefault();const fd=new FormData(e.currentTarget);let images=[];
    try{const file=fd.get('image');if(file?.size)images=[await fileAsDataUrl(file,1.5*1024*1024)];}catch(err){notice(err.message);return;}
    const row={owner_id:user.id,name:String(fd.get('name')).trim(),description:String(fd.get('description')).trim(),pronouns:String(fd.get('pronouns')).trim(),gender:String(fd.get('gender')).trim(),tags:String(fd.get('tags')).split(',').map(x=>x.trim()).filter(Boolean).slice(0,20),images,content_warning:fd.has('content_warning')};
    const {error}=await db.from('characters').insert(row);if(error)throw error;
    activeTab='myocs';await loadFeed();render();
  }

  async function postComment(e) {
    e.preventDefault();if(!openedCharacter||!user)return;const body=String(new FormData(e.currentTarget).get('body')).trim();
    const {error}=await db.from('comments').insert({character_id:openedCharacter.id,author_id:user.id,body});if(error)throw error;
    openedCharacter.comments=await loadComments(openedCharacter.id);await loadFeed();openedCharacter=characters.find(c=>c.id===openedCharacter.id)||openedCharacter;openedCharacter.comments=await loadComments(openedCharacter.id);render();
  }

  async function toggleLike(id) {
    if(!user){authView('login');return;}
    const c=characters.find(item=>item.id===id);if(!c)return;
    const query=db.from('likes');
    const result=c.likedByMe?await query.delete().eq('user_id',user.id).eq('character_id',id):await query.insert({user_id:user.id,character_id:id});
    if(result.error)throw result.error;await loadFeed();if(openedCharacter?.id===id){openedCharacter=characters.find(item=>item.id===id);openedCharacter.comments=await loadComments(id);}render();
  }

  async function deleteCharacter(id) {
    if(!confirm('Delete this character and its comments? This cannot be undone.'))return;
    const {error}=await db.from('characters').delete().eq('id',id);if(error)throw error;
    openedCharacter=null;await loadFeed();render();
  }

  async function deleteComment(id) {
    const {error}=await db.from('comments').delete().eq('id',id);if(error)throw error;
    if(openedCharacter){openedCharacter.comments=await loadComments(openedCharacter.id);await loadFeed();const updated=characters.find(c=>c.id===openedCharacter.id);if(updated)openedCharacter={...updated,comments:openedCharacter.comments};}
    render();
  }

  async function start() {
    if(!supabaseLib?.createClient||!config.supabaseUrl||!config.supabaseAnonKey){db=null;errorMessage='Supabase is not configured. Check index.html for the project URL and publishable key.';render();return;}
    db=supabaseLib.createClient(config.supabaseUrl,config.supabaseAnonKey);
    const {data:{session},error}=await db.auth.getSession();if(error)throw error;
    user=session?.user||null;
    db.auth.onAuthStateChange((_event,nextSession)=>{user=nextSession?.user||null;setTimeout(async()=>{try{if(user){await refreshUser();await loadProfiles();await loadFeed();activeTab='feed';render();}else{profile=null;activeTab='feed';render();}}catch(e){notice(e.message);}},0);});
    if(user){await refreshUser();await loadProfiles();await loadFeed();activeTab='feed';render();}
    else{await loadProfiles();activeTab='feed';app.innerHTML=`<div class="site-shell">${header()}<main class="main-content"><div class="board-note">📌 Browse public characters and creator profiles. Sign in to post, like, or comment.</div>${cards([])}</main><footer class="footer-note">A community website for original characters.</footer></div>`;attachHandlers();}
  }

  start().catch(e=>{db=null;errorMessage=`Could not connect to Supabase: ${e.message}. Make sure you have run schema.sql in the Supabase SQL Editor.`;render();});
})();
