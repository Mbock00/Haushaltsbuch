// ═══════════════════════════════════════════
// Auth – Login, Register, Logout
// ═══════════════════════════════════════════

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await getProfile();
    showApp();
  } else {
    showAuthScreen();
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await getProfile();
      showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showAuthScreen();
    }
  });
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  updateHeaderProfile();
  await navigateTo('dashboard');
}

// ── Tab-Wechsel Login/Register ──
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.remove('hidden');
}

// ── Login ──
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');

  btn.textContent = 'Anmelden...';
  btn.disabled = true;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    showToast('Fehler: ' + mapAuthError(error.message), 'error');
    btn.textContent = 'Anmelden';
    btn.disabled = false;
  }
}

// ── Register ──
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2= document.getElementById('reg-password2').value;
  const code     = document.getElementById('reg-code').value.trim();
  const btn      = document.getElementById('btn-register');

  if (password !== password2) { showToast('Passwörter stimmen nicht überein', 'error'); return; }
  if (password.length < 8)    { showToast('Passwort muss mindestens 8 Zeichen haben', 'error'); return; }
  if (code !== INVITE_CODE)   { showToast('Ungültiger Einladungscode', 'error'); return; }

  btn.textContent = 'Registrieren...';
  btn.disabled = true;

  const { data, error } = await db.auth.signUp({ email, password, options: { data: { name } } });

  if (error) {
    showToast('Fehler: ' + mapAuthError(error.message), 'error');
    btn.textContent = 'Registrieren';
    btn.disabled = false;
    return;
  }

  // Profil-Name setzen
  if (data.user) {
    await db.from('profile').update({ name }).eq('id', data.user.id);
    // Standard-Kategorien erstellen
    await db.rpc('erstelle_standard_kategorien', { p_user_id: data.user.id });
  }

  showToast('Willkommen! 🎉 Konto erfolgreich erstellt.', 'success');
}

// ── Logout ──
async function handleLogout() {
  await db.auth.signOut();
  showToast('Erfolgreich abgemeldet', 'info');
}

// ── Passwort zurücksetzen ──
async function handlePasswordReset() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { showToast('Bitte E-Mail eingeben', 'error'); return; }
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error) { showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Passwort-Reset E-Mail gesendet ✉️', 'success');
}

// ── Header Profil ──
function updateHeaderProfile() {
  const name = currentProfile?.name || currentUser?.email?.split('@')[0] || 'Nutzer';
  const initial = name.charAt(0).toUpperCase();
  const color = currentProfile?.avatar_color || '#6c8ebf';
  document.getElementById('header-avatar').textContent = initial;
  document.getElementById('header-avatar').style.background = color;
}

// ── Fehler-Mapping ──
function mapAuthError(msg) {
  if (msg.includes('Invalid login')) return 'E-Mail oder Passwort falsch';
  if (msg.includes('Email not confirmed')) return 'E-Mail noch nicht bestätigt';
  if (msg.includes('User already registered')) return 'E-Mail bereits registriert';
  if (msg.includes('Password should be')) return 'Passwort zu schwach';
  return msg;
}

// ── Einladungscode (änderbar) ──
const INVITE_CODE = 'Familie2026';