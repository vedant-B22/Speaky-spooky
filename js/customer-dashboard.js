// ============================================================
// customer-dashboard.js — Speaky-Spooky Customer Portal
// ============================================================

let currentUser = null;
let userData = {};
let currentSlotFilter = 'upcoming';
let allSlots = [];
let allResults = [];

// ── Page Navigation ─────────────────────────────────────────
const pageTitles = {
  overview:    'Overview',
  slots:       'My Slots & Schedule',
  results:     'My Results',
  materials:   'Training Materials',
  leaderboard: 'Leaderboard',
  certificate: 'Certificate',
  profile:     'My Profile'
};

function showPage(name) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  const link = document.getElementById(`link-${name}`);
  if (page) page.classList.add('active');
  if (link) link.classList.add('active');
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = pageTitles[name] || name;
  // Close sidebar on mobile
  closeSidebar();
}

// ── Sidebar ─────────────────────────────────────────────────
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
}
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.style.display = isOpen ? 'block' : 'none';
});

// ── Auth Check ───────────────────────────────────────────────
function loadCustomerDashboard(user, data) {
  currentUser = user;
  userData = data;
  updateSidebarUser(data);
  loadOverview();
  loadSlots();
  loadResults();
  loadMaterials();
  loadLeaderboard();
  loadCertificate();
  loadProfile();
}

// ── Sidebar User ─────────────────────────────────────────────
function updateSidebarUser(data) {
  const name = data.displayName || data.firstName || 'Debater';
  const el = document.getElementById('sidebarName');
  if (el) el.textContent = name;
  const av = document.getElementById('sidebarAvatar');
  if (av) av.textContent = name.charAt(0).toUpperCase();
  const wn = document.getElementById('welcomeName');
  if (wn) wn.textContent = data.firstName || name;
}

// ── Overview ─────────────────────────────────────────────────
async function loadOverview() {
  if (!currentUser) return;
  try {
    const doc = await db.collection(COLLECTIONS.USERS).doc(currentUser.uid).get();
    const d = doc.data() || {};
    userData = { ...userData, ...d };

    el('stat-rounds').textContent  = d.roundsPlayed || 0;
    el('stat-wins').textContent    = d.wins || 0;
    el('stat-points').textContent  = (d.points || 0).toLocaleString();

    // Get rank
    const lb = await db.collection(COLLECTIONS.LEADERBOARD)
      .orderBy('points', 'desc').get();
    let rank = '—';
    lb.docs.forEach((doc, i) => { if (doc.id === currentUser.uid) rank = `#${i+1}`; });
    el('stat-rank').textContent = rank;

    // Recent upcoming slots
    const now = firebase.firestore.Timestamp.now();
    const slotsSnap = await db.collection(COLLECTIONS.SLOTS)
      .where('participantUid', '==', currentUser.uid)
      .where('status', '==', 'upcoming')
      .orderBy('dateTime')
      .limit(3).get();

    const container = document.getElementById('overviewSlots');
    if (slotsSnap.empty) {
      container.innerHTML = '<p class="t-body t-muted" style="padding:20px;">No upcoming debates scheduled yet.</p>';
    } else {
      container.innerHTML = '';
      slotsSnap.forEach(doc => {
        container.appendChild(buildSlotCard({ id: doc.id, ...doc.data() }, true));
      });
    }
  } catch (e) {
    console.warn('Overview load error:', e.message);
    showDemoOverview();
  }
}

function showDemoOverview() {
  el('stat-rounds').textContent  = '0';
  el('stat-wins').textContent    = '0';
  el('stat-points').textContent  = '0';
  el('stat-rank').textContent    = '#—';
  const c = document.getElementById('overviewSlots');
  if (c) c.innerHTML = '<p class="t-body t-muted" style="padding:20px;">No upcoming debates scheduled yet.</p>';
}

function el(id) { return document.getElementById(id) || {}; }

// ── Slots ────────────────────────────────────────────────────
async function loadSlots() {
  if (!currentUser) return;
  const container = document.getElementById('slotsContainer');
  const empty = document.getElementById('slotsEmpty');
  try {
    const snap = await db.collection(COLLECTIONS.SLOTS)
      .where('participantUid', '==', currentUser.uid)
      .orderBy('dateTime', 'desc')
      .get();

    allSlots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Update badge
    const upcoming = allSlots.filter(s => s.status === 'upcoming');
    const badge = document.getElementById('slotsBadge');
    if (badge && upcoming.length > 0) { badge.textContent = upcoming.length; badge.style.display = 'inline-flex'; }
    renderSlots();
  } catch (e) {
    console.warn('Slots load error:', e.message);
    if (container) container.innerHTML = '<p class="t-body t-muted" style="padding:20px;">No slots assigned yet.</p>';
    if (empty) empty.style.display = 'none';
  }
}

function filterSlots(filter) {
  currentSlotFilter = filter;
  document.querySelectorAll('.slot-filter-btn').forEach(b => {
    b.className = `btn btn-sm slot-filter-btn ${b.dataset.filter === filter ? 'btn-primary' : 'btn-ghost'}`;
  });
  renderSlots();
}

function renderSlots() {
  const container = document.getElementById('slotsContainer');
  const empty = document.getElementById('slotsEmpty');
  if (!container) return;

  let filtered = allSlots;
  if (currentSlotFilter !== 'all') {
    filtered = allSlots.filter(s => s.status === currentSlotFilter);
  }

  if (filtered.length === 0) {
    container.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  container.style.display = 'flex';
  if (empty) empty.style.display = 'none';
  container.innerHTML = '';
  filtered.forEach(slot => container.appendChild(buildSlotCard(slot)));
}

function buildSlotCard(slot, compact = false) {
  const div = document.createElement('div');
  div.className = `slot-card slot-card--${slot.status || 'upcoming'}`;
  const dt = slot.dateTime?.toDate ? slot.dateTime.toDate() : new Date(slot.dateTime || Date.now());
  const dateStr = dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const statusBadge = { upcoming: 'badge-gold', completed: 'badge-green', cancelled: 'badge-crimson' };
  div.innerHTML = `
    <div class="slot-header">
      <div>
        <div class="slot-title">${slot.title || `Round ${slot.roundNumber || '?'}`}</div>
        <div class="slot-meta">
          <div class="slot-meta-item">📅 <span>${dateStr}</span></div>
          <div class="slot-meta-item">🕐 <span>${timeStr}</span></div>
          ${slot.format ? `<div class="slot-meta-item">🎙 <span>${slot.format}</span></div>` : ''}
          ${slot.opponent ? `<div class="slot-meta-item">⚔ vs <span>${slot.opponent}</span></div>` : ''}
          ${slot.venue ? `<div class="slot-meta-item">📍 <span>${slot.venue}</span></div>` : ''}
        </div>
      </div>
      <span class="badge ${statusBadge[slot.status]||'badge-grey'}">${slot.status||'Upcoming'}</span>
    </div>
    ${slot.motion ? `<div class="slot-motion">"${slot.motion}"</div>` : ''}
    ${!compact && slot.side ? `<div class="slot-footer"><span class="t-small">Your side: <strong class="t-gold">${slot.side}</strong></span>${slot.adjudicator ? `<span class="t-small t-muted">Adjudicator: ${slot.adjudicator}</span>` : ''}</div>` : ''}
    ${slot.notes ? `<p class="t-small t-muted mt-12">${slot.notes}</p>` : ''}
  `;
  return div;
}

// ── Results ──────────────────────────────────────────────────
async function loadResults() {
  if (!currentUser) return;
  const container = document.getElementById('resultsContainer');
  const empty = document.getElementById('resultsEmpty');
  try {
    const snap = await db.collection(COLLECTIONS.RESULTS)
      .where('participantUid', '==', currentUser.uid)
      .orderBy('date', 'desc').get();

    if (snap.empty) {
      if (container) container.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (container) { container.innerHTML = ''; container.style.display = 'flex'; }
    if (empty) empty.style.display = 'none';
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (container) container.appendChild(buildResultCard(data));
    });
  } catch (e) {
    console.warn('Results error:', e.message);
    if (container) container.style.display = 'none';
    if (empty) empty.style.display = 'block';
  }
}

function buildResultCard(r) {
  const div = document.createElement('div');
  div.className = 'result-card';
  const won = r.outcome === 'win';
  const date = r.date?.toDate ? r.date.toDate() : new Date(r.date || Date.now());
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const criteria = r.breakdown || [];

  div.innerHTML = `
    <div class="flex-between mb-16">
      <div>
        <span class="badge ${won ? 'badge-gold' : 'badge-crimson'}">${won ? '✓ Win' : '✕ Loss'}</span>
        <span class="t-xs t-muted" style="margin-left:12px;">${dateStr} · Round ${r.roundNumber||'?'}</span>
      </div>
      <span class="t-small t-muted">${r.format||''}</span>
    </div>
    ${r.motion ? `<div class="t-small t-italic t-muted mb-16">"${r.motion}"</div>` : ''}
    <div class="result-vs">
      <div class="result-debater ${won ? 'result-debater--win' : 'result-debater--loss'}">
        <div class="result-debater-name">You</div>
        <div class="result-debater-score">${r.myScore || '—'}</div>
        <div class="t-xs t-muted">${r.mySide || ''}</div>
      </div>
      <div class="result-divider">VS</div>
      <div class="result-debater ${!won ? 'result-debater--win' : 'result-debater--loss'}">
        <div class="result-debater-name">${r.opponent || 'Opponent'}</div>
        <div class="result-debater-score">${r.opponentScore || '—'}</div>
        <div class="t-xs t-muted">${r.opponentSide || ''}</div>
      </div>
    </div>
    ${criteria.length > 0 ? `
    <div class="result-breakdown mt-24">
      <div class="t-xs t-muted mb-12">Score Breakdown</div>
      ${criteria.map(c => `
        <div class="result-criterion">
          <span class="result-criterion-label">${c.label}</span>
          <div class="result-criterion-bar"><div class="result-criterion-fill" style="width:${(c.score/c.max)*100}%"></div></div>
          <span class="result-criterion-score">${c.score}/${c.max}</span>
        </div>
      `).join('')}
    </div>` : ''}
    ${r.feedback ? `<div class="card card--dark mt-20 p-24"><div class="t-xs t-gold mb-8">Adjudicator Feedback</div><p class="t-body t-secondary">${r.feedback}</p></div>` : ''}
    <div class="flex-between mt-16">
      <span class="t-small t-muted">Adjudicator: ${r.adjudicator||'—'}</span>
      <span class="t-small ${r.points >= 0 ? 't-gold' : 't-muted'}">${r.points !== undefined ? `+${r.points} pts` : ''}</span>
    </div>
  `;
  return div;
}

// ── Materials ─────────────────────────────────────────────────
async function loadMaterials() {
  if (!currentUser) return;
  const container = document.getElementById('materialsContainer');
  const empty = document.getElementById('materialsEmpty');
  try {
    const snap = await db.collection(COLLECTIONS.MATERIALS)
      .where('issuedTo', 'in', ['all', currentUser.uid])
      .orderBy('issuedAt', 'desc').get();

    if (snap.empty) {
      if (container) container.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (container) { container.innerHTML = ''; container.style.display = 'flex'; container.style.flexDirection = 'column'; container.style.gap = '16px'; }
    if (empty) empty.style.display = 'none';
    const matBadge = document.getElementById('materialsBadge');
    if (matBadge) { matBadge.textContent = snap.size; matBadge.style.display = 'inline-flex'; }
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (container) container.appendChild(buildMaterialCard(data));
    });
  } catch (e) {
    console.warn('Materials error:', e.message);
    if (container) container.style.display = 'none';
    if (empty) empty.style.display = 'block';
  }
}

const typeIcons = { pdf: '📄', video: '🎬', doc: '📝', link: '🔗', audio: '🎧', other: '📎' };

function buildMaterialCard(m) {
  const div = document.createElement('div');
  div.className = 'material-card';
  const date = m.issuedAt?.toDate ? m.issuedAt.toDate() : new Date(m.issuedAt || Date.now());
  div.innerHTML = `
    <div class="material-icon">${typeIcons[m.type]||'📎'}</div>
    <div class="material-body">
      <div class="material-title">${m.title || 'Untitled Resource'}</div>
      <div class="material-desc">${m.description || ''}</div>
      <div class="material-meta">
        <span class="badge badge-grey">${m.type||'Resource'}</span>
        <span class="t-xs t-muted">Issued ${date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
        ${m.season ? `<span class="t-xs t-muted">Season ${m.season}</span>` : ''}
      </div>
    </div>
    <div class="material-actions">
      ${m.fileUrl ? `<a href="${m.fileUrl}" target="_blank" class="btn btn-primary btn-sm">Open</a>` : ''}
      ${m.downloadUrl ? `<a href="${m.downloadUrl}" download class="btn btn-ghost btn-sm">⬇</a>` : ''}
    </div>
  `;
  return div;
}

// ── Leaderboard ──────────────────────────────────────────────
async function loadLeaderboard() {
  if (!currentUser) return;
  const tbody = document.getElementById('fullLbBody');
  try {
    const snap = await db.collection(COLLECTIONS.LEADERBOARD)
      .orderBy('points', 'desc').limit(50).get();

    if (snap.empty) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No rankings yet. Season has not started.</td></tr>';
      return;
    }

    const rows = [];
    snap.docs.forEach((doc, i) => {
      const d = doc.data();
      const isMe = doc.id === currentUser.uid;
      if (isMe) {
        el('myRankNum').textContent = `#${i+1}`;
        el('myRankPoints').textContent = `${(d.points||0).toLocaleString()} points`;
      }
      rows.push(`
        <tr style="${isMe ? 'background:var(--gold-pale);border:1px solid rgba(196,164,74,0.3);' : ''}">
          <td style="font-family:var(--ff-mono);${i < 3 ? 'color:var(--gold);font-weight:700;' : ''}">${i+1}</td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--ink-muted);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;${isMe?'border:2px solid var(--gold);color:var(--gold);background:var(--gold-pale);':''}">${(d.displayName||'?').charAt(0).toUpperCase()}</div>
              <span style="font-weight:${isMe?'700':'400'};color:${isMe?'var(--gold)':'var(--text-primary)'};">${d.displayName||'—'} ${isMe?'<span style="font-size:0.7rem;background:var(--gold-pale);padding:2px 8px;border-radius:100px;">You</span>':''}</span>
            </div>
          </td>
          <td>${d.institution||'—'}</td>
          <td style="font-family:var(--ff-mono);">${d.roundsPlayed||0}</td>
          <td style="font-family:var(--ff-mono);">${d.wins||0}</td>
          <td style="font-family:var(--ff-mono);color:var(--gold);font-weight:700;">${(d.points||0).toLocaleString()}</td>
          <td><span class="badge ${d.points > 1500 ? 'badge-gold' : d.points > 800 ? 'badge-grey' : 'badge-crimson'}">${d.tier||'Participant'}</span></td>
        </tr>
      `);
    });
    if (tbody) tbody.innerHTML = rows.join('');
  } catch (e) {
    console.warn('Leaderboard error:', e.message);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">Leaderboard not available.</td></tr>';
  }
}

// ── Certificate ───────────────────────────────────────────────
async function loadCertificate() {
  if (!currentUser) return;
  try {
    const snap = await db.collection(COLLECTIONS.CERTIFICATES)
      .where('uid', '==', currentUser.uid)
      .limit(1).get();

    const lockOverlay = document.getElementById('certLockOverlay');
    const certActions = document.getElementById('certActions');

    if (!snap.empty) {
      const cert = snap.docs[0].data();
      // Populate cert
      const el = (id) => document.getElementById(id);
      el('certParticipantName').textContent = cert.participantName || userData.displayName || '—';
      el('certSeasonLabel').textContent = cert.season || 'Season V';
      el('certAchievement').textContent = cert.achievement || '—';
      el('certDate').textContent = `Issue Date: ${cert.issuedAt?.toDate ? cert.issuedAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}`;
      el('certId').textContent = `Certificate ID: ${snap.docs[0].id.substring(0,12).toUpperCase()}`;
      if (lockOverlay) lockOverlay.style.display = 'none';
      if (certActions) certActions.style.display = 'flex';
    } else {
      // Fill with placeholder data
      document.getElementById('certParticipantName').textContent = userData.displayName || userData.firstName || 'Participant Name';
      if (lockOverlay) lockOverlay.style.display = 'flex';
      if (certActions) certActions.style.display = 'none';
    }
  } catch (e) {
    console.warn('Certificate error:', e.message);
  }
}

function downloadCertificate() {
  window.print(); // Basic print-to-PDF — can be enhanced with html2canvas/jsPDF
}

function shareCertificate() {
  if (navigator.share) {
    navigator.share({
      title: 'Speaky-Spooky Certificate',
      text: `I completed Season V of the Speaky-Spooky Competitive Debate Championship!`,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(window.location.href);
    showToast('Link copied to clipboard!', 'info');
  }
}

// ── Profile ───────────────────────────────────────────────────
function loadProfile() {
  const d = userData;
  if (!d) return;
  const name = d.displayName || `${d.firstName||''} ${d.lastName||''}`.trim();
  document.getElementById('profileName').textContent       = name || '—';
  document.getElementById('profileEmail').textContent      = d.email || currentUser?.email || '—';
  document.getElementById('profileLevel').textContent      = d.level || '—';
  document.getElementById('profileFormat').textContent     = d.preferredFormat || '—';
  document.getElementById('profileInstitution').textContent = d.institution || '—';
  document.getElementById('profilePoints').textContent     = (d.points || 0).toLocaleString();
  const joined = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
  document.getElementById('profileJoined').textContent     = joined.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const av = document.getElementById('profileAvatar');
  if (av) av.textContent = name.charAt(0).toUpperCase();

  // Pre-fill edit fields
  document.getElementById('editDisplayName').value  = name || '';
  document.getElementById('editInstitution').value  = d.institution || '';
  const fmt = document.getElementById('editFormat');
  if (fmt) fmt.value = d.preferredFormat || 'open';
}

async function saveProfile() {
  if (!currentUser) return;
  const newName = document.getElementById('editDisplayName').value.trim();
  const newInst = document.getElementById('editInstitution').value.trim();
  const newFmt  = document.getElementById('editFormat').value;
  try {
    await db.collection(COLLECTIONS.USERS).doc(currentUser.uid).update({
      displayName: newName,
      institution: newInst,
      preferredFormat: newFmt
    });
    userData.displayName = newName;
    userData.institution = newInst;
    userData.preferredFormat = newFmt;
    loadProfile();
    showToast('Profile updated!', 'success');
  } catch(e) {
    showToast('Failed to save: ' + e.message, 'error');
  }
}

async function doSignOut() {
  if (typeof auth !== 'undefined') {
    await auth.signOut();
    window.location.href = '../index.html';
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof auth === 'undefined') return;
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }
    try {
      const docSnap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
      const data = docSnap.data() || {};
      loadCustomerDashboard(user, data);
      // Hide loader
      setTimeout(() => document.getElementById('loader')?.remove(), 400);
    } catch (e) {
      loadCustomerDashboard(user, {});
    }
  });
});
