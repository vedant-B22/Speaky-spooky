// ============================================================
// auth.js — Speaky-Spooky Authentication Layer
// ============================================================

// ── Toast Utility ──────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span style="font-size:1rem;">${icons[type]||'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = '0.3s ease'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Modal Utilities ────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 150);
}
function openRegisterModal() { openModal('registerModal'); }
function openLoginModal()    {
  loginRole = 'participant';
  document.querySelectorAll('#loginRoleTabs .login-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('#loginRoleTabs .login-tab[data-role="participant"]')?.classList.add('active');
  const createRow = document.getElementById('loginCreateAccountRow');
  if (createRow) createRow.classList.remove('hidden');
  openModal('loginModal');
}

// ── Login Role Toggle (Participant / Admin) ────────────────
let loginRole = 'participant';
function setLoginRole(role, btnEl) {
  loginRole = role;
  document.querySelectorAll('#loginRoleTabs .login-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  // Hide "Create Account" prompt when admin tab is active — admins don't self-register
  const createRow = document.getElementById('loginCreateAccountRow');
  if (createRow) createRow.classList.toggle('hidden', role === 'admin');

  // Reset any previous error when switching tabs
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.classList.add('hidden');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.active').forEach(m => {
      m.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
});

// ── Auth State Watcher ─────────────────────────────────────
function initAuthState() {
  if (typeof auth === 'undefined') return;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Get user doc from Firestore
      try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
        const userData = userDoc.data() || {};

        // If on index page, update nav to show dashboard links
        updateNavForLoggedInUser(user, userData);

        // If on customer dashboard page, load it
        if (window.location.pathname.includes('customer/dashboard')) {
          if (typeof loadCustomerDashboard === 'function') loadCustomerDashboard(user, userData);
        }
      } catch(err) {
        console.warn('Firestore not configured:', err.message);
        updateNavForLoggedInUser(user, {});
      }
    } else {
      updateNavForGuest();
      // Redirect if on protected pages
      if (window.location.pathname.includes('customer/dashboard')) {
        window.location.href = '../index.html';
      }
    }
  });
}

function updateNavForLoggedInUser(user, userData) {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  const name = userData.firstName || user.email.split('@')[0];
  actions.innerHTML = `
    <a href="customer/dashboard.html" class="btn btn-ghost btn-sm">My Dashboard</a>
    <div class="user-nav-pill" title="${user.email}">
      <div class="user-nav-avatar">${name.charAt(0).toUpperCase()}</div>
      <span>${name}</span>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="signOut()">Sign Out</button>
  `;
}

function updateNavForGuest() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  actions.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="openLoginModal()">Sign In</button>
    <button class="btn btn-primary btn-sm" onclick="openRegisterModal()">Register Now</button>
  `;
}

// ── Register ───────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerSubmitBtn');
  const errEl = document.getElementById('registerError');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating Account...'; }
  if (errEl) errEl.classList.add('hidden');

  const email    = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const firstName  = document.getElementById('reg-firstname')?.value.trim();
  const lastName   = document.getElementById('reg-lastname')?.value.trim();
  const level      = document.getElementById('reg-level')?.value;
  const format     = document.getElementById('reg-format')?.value;
  const institution = document.getElementById('reg-institution')?.value.trim();

  if (!email || !password || !firstName || !lastName) {
    if (errEl) { errEl.textContent = 'Please fill all required fields.'; errEl.classList.remove('hidden'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account & Enter Arena'; }
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    await db.collection(COLLECTIONS.USERS).doc(uid).set({
      uid, email, firstName, lastName,
      displayName: `${firstName} ${lastName}`,
      level, preferredFormat: format,
      institution: institution || '',
      role: 'participant',
      points: 0,
      wins: 0,
      losses: 0,
      roundsPlayed: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      active: true,
      certificateIssued: false
    });

    await db.collection(COLLECTIONS.REGISTRATIONS).add({
      uid, email, firstName, lastName, level, format, institution,
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    showToast('Welcome to the arena! Redirecting to your dashboard…', 'success');
    closeModal('registerModal');
    setTimeout(() => window.location.href = 'customer/dashboard.html', 1500);
  } catch (err) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Try signing in.',
      'auth/weak-password':        'Password must be at least 6 characters.',
      'auth/invalid-email':        'Please enter a valid email address.'
    };
    const msg = messages[err.code] || err.message;
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    if (btn)   { btn.disabled = false; btn.textContent = 'Create Account & Enter Arena'; }
  }
}

// ── Login ──────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  const errEl = document.getElementById('loginError');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing In…'; }
  if (errEl) errEl.classList.add('hidden');

  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);

    if (loginRole === 'admin') {
      // Verify admin privileges in Firestore before granting access
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(cred.user.uid).get();
      const role = userDoc.data()?.role;
      if (role !== 'admin' && role !== 'superadmin') {
        await auth.signOut();
        if (errEl) { errEl.textContent = 'Access denied. This account does not have admin privileges.'; errEl.classList.remove('hidden'); }
        if (btn)   { btn.disabled = false; btn.textContent = 'Sign In'; }
        return;
      }
      showToast('Welcome back, Admin! Loading panel…', 'success');
      closeModal('loginModal');
      setTimeout(() => window.location.href = 'admin/dashboard.html', 1000);
    } else {
      showToast('Welcome back! Loading your dashboard…', 'success');
      closeModal('loginModal');
      setTimeout(() => window.location.href = 'customer/dashboard.html', 1000);
    }
  } catch (err) {
    const messages = {
      'auth/user-not-found':  'No account with this email. Please register first.',
      'auth/wrong-password':  'Incorrect password. Please try again.',
      'auth/invalid-email':   'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Try again later.',
      'auth/invalid-credential': 'Invalid email or password.'
    };
    const msg = messages[err.code] || err.message;
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    if (btn)   { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
}

// ── Sign Out ───────────────────────────────────────────────
async function signOut() {
  try {
    await auth.signOut();
    showToast('Signed out successfully.', 'info');
    setTimeout(() => window.location.href = '../index.html', 800);
  } catch (err) {
    showToast('Error signing out.', 'error');
  }
}

// ── Bind forms ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const regForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  if (regForm)   regForm.addEventListener('submit', handleRegister);
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Nav auth buttons
  ['navLoginBtn','navLoginBtnMob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openLoginModal);
  });
  ['navRegisterBtn','navRegisterBtnMob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openRegisterModal);
  });
  ['heroRegisterBtn','ctaRegisterBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openRegisterModal);
  });
  const heroLearnBtn = document.getElementById('heroLearnBtn');
  if (heroLearnBtn) heroLearnBtn.addEventListener('click', () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  });
  const ctaSignIn = document.getElementById('ctaSignInBtn');
  if (ctaSignIn) ctaSignIn.addEventListener('click', openLoginModal);
  const viewLb = document.getElementById('viewFullLbBtn');
  if (viewLb) viewLb.addEventListener('click', openLoginModal);

  initAuthState();
});
