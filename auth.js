// ====== AUTH HANDLERS ======
async function handleLogin(e) {
  e.preventDefault();
  authError = '';
  authSuccess = '';
  const fd = new FormData(e.target);
  const email = fd.get('email').trim().toLowerCase();
  const password = fd.get('password');

  const user = await sGet('user:' + email);
  if (!user) {
    authError = 'No account found with that username. Please sign up first.';
    render();
    return;
  }

  if (user.passwordHash !== simpleObscure(password)) {
    authError = 'Incorrect password. Please try again.';
    render();
    return;
  }

  currentUser = user;
  applyTheme(user.themePref || 'bubblegum');
  if (user.fontPref) applyFont(user.fontPref);
  screen = 'app';
  tab = 'feed';
  authSuccess = '';
  authError = '';

  await loadFeed();
  await loadMyOCs();
  notifications = await loadNotificationsForUser(currentUser.email);
  localStorage.setItem('lastUser', currentUser.email);
  render();
}

async function handleSignupRequest(e) {
  e.preventDefault();
  authError = '';
  authSuccess = '';
  const fd = new FormData(e.target);
  const displayName = fd.get('displayName').trim();
  const email = fd.get('email').trim().toLowerCase();
  const password = fd.get('password');

  if (!displayName || !email || !password) {
    authError = 'Please fill in all fields.';
    render();
    return;
  }

  if (password.length < 6) {
    authError = 'Password must be at least 6 characters.';
    render();
    return;
  }

  const existing = await sGet('user:' + email);
  if (existing) {
    authError = 'An account with that username already exists. Please log in instead.';
    render();
    return;
  }

  const newUser = {
    email,
    passwordHash: simpleObscure(password),
    displayName,
    pronouns: '',
    gender: '',
    bio: '',
    avatar: '',
    themePref: 'bubblegum',
    fontPref: 'quicksand',
    joinDate: new Date().toISOString()
  };

  await sSet('user:' + newUser.email, newUser);

  currentUser = newUser;
  applyTheme('bubblegum');
  screen = 'app';
  tab = 'feed';
  authMode = 'login';
  authError = '';
  authSuccess = '';

  await loadFeed();
  await loadMyOCs();
  notifications = await loadNotificationsForUser(currentUser.email);
  localStorage.setItem('lastUser', currentUser.email);
  render();
}

