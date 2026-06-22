// ============================================================
// admin-dashboard.js — Speaky-Spooky Admin Panel
// ============================================================

let adminUser = null;
let allParticipants = [];
let allRegistrations = [];
let currentRegFilter = 'pending';
let editingSlotId = null;

// ── Admin Page Navigation ─────────────────────────────────
const adminPageTitles = {
  overview:      'Dashboard Overview',
  participants:  'All Participants',
  registrations: 'Registrations',
  slots:         'Manage Slots',
  results:       'Post Results',
  materials:     'Training Materials',
  gallery:       'Gallery',
  leaderboard:   'Leaderboard',
  certificates:  'Certificates',
  settings:      'Platform Settings'
};

function showAdminPage(name) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  const link = document.getElementById(`link-${name}`);
  if (page) page.classList.add('active');
  if (link) link.classList.add('active');
  const t = document.getElementById('adminPageTitle');
  if (t) t.textContent = adminPageTitles[name] || name;
  closeSidebar();
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
}
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const open = sidebar.classList.toggle('open');
  overlay.style.display = open ? 'block' : 'none';
});

// ── Modal Utils ───────────────────────────────────────────
function openSlotModal(slotData = null) {
  clearForm('slotForm');
  document.getElementById('slotModalTitle').textContent = slotData ? 'Edit Slot' : 'New Debate Slot';
  document.getElementById('slotEditId').value = slotData?.id || '';
  if (slotData) {
    setVal('slot-title', slotData.title);
    setVal('slot-roundNum', slotData.roundNumber);
    setVal('slot-opponent', slotData.opponent);
    setVal('slot-side', slotData.side);
    setVal('slot-motion', slotData.motion);
    setVal('slot-venue', slotData.venue);
    setVal('slot-adjudicator', slotData.adjudicator);
    setVal('slot-notes', slotData.notes);
    setVal('slot-format', slotData.format);
    setSelectedParticipant('slot', slotData.participantUid, slotData.participantName, slotData.participantEmail);
    if (slotData.dateTime?.toDate) {
      const dt = slotData.dateTime.toDate();
      document.getElementById('slot-datetime').value = dt.toISOString().slice(0,16);
    }
  }
  openModal('slotModal');
}
function openResultModal() { clearForm('resultForm'); openModal('resultModal'); }
function openMaterialModal() { clearForm('materialForm'); openModal('materialModal'); }
function openCertModal() { clearForm('certForm'); openModal('certModal'); }
function openLbUpdateModal(data = null) {
  clearForm('lbForm');
  if (data) {
    setSelectedParticipant('lb', data.uid, data.displayName, data.email);
    setVal('lb-points', data.points);
    setVal('lb-tier', data.tier);
    setVal('lb-wins', data.wins);
    setVal('lb-rounds', data.roundsPlayed);
  }
  openModal('lbModal');
}
function openGalleryModal() { clearForm('galleryForm'); openModal('galleryModal'); }

function setVal(id, val) { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; }
function getVal(id) { return document.getElementById(id)?.value || ''; }
function clearForm(formId) {
  const form = document.getElementById(formId);
  if (form) form.reset();
  form?.querySelectorAll('.participant-selected').forEach(el => el.remove());
  form?.querySelectorAll('[id$="participantResults"]').forEach(el => { el.style.display='none'; el.innerHTML=''; });
  form?.querySelectorAll('[id$="participantSearch"]').forEach(el => { el.value=''; });
  form?.querySelectorAll('[id$="participantUid"],[id$="participantName"]').forEach(el => { el.value=''; });
  form?.querySelectorAll('.form-error').forEach(el => el.classList.add('hidden'));
}

// ── Auth init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof auth === 'undefined') return;
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    try {
      const docSnap = await db.collection('users').doc(user.uid).get();
      const data = docSnap.data() || {};
      if (!['admin','superadmin'].includes(data.role)) {
        await auth.signOut();
        window.location.href = 'login.html';
        return;
      }
      adminUser = user;
      const name = data.displayName || data.firstName || user.email;
      document.getElementById('adminName').textContent = name;
      document.getElementById('adminAvatar').textContent = name.charAt(0).toUpperCase();
      loadAdminOverview();
      loadParticipants();
      loadRegistrations();
      loadSlotsAdmin();
      loadResultsAdmin();
      loadMaterialsAdmin();
      loadGalleryAdmin();
      loadLeaderboardAdmin();
      loadCertificatesAdmin();
      loadSettings();
      document.getElementById('loader')?.classList.add('hidden');
      setTimeout(() => document.getElementById('loader')?.remove(), 500);
    } catch(e) {
      console.error('Admin auth error:', e);
      window.location.href = 'login.html';
    }
  });

  // Bind forms
  document.getElementById('slotForm')?.addEventListener('submit', handleSlotSubmit);
  document.getElementById('resultForm')?.addEventListener('submit', handleResultSubmit);
  document.getElementById('materialForm')?.addEventListener('submit', handleMaterialSubmit);
  document.getElementById('certForm')?.addEventListener('submit', handleCertSubmit);
  document.getElementById('lbForm')?.addEventListener('submit', handleLbSubmit);
  document.getElementById('galleryForm')?.addEventListener('submit', handleGallerySubmit);

  // Material issued-to toggle
  document.getElementById('mat-issuedTo')?.addEventListener('change', (e) => {
    document.getElementById('mat-specificField').style.display = e.target.value === 'specific' ? 'block' : 'none';
  });
});

async function adminSignOut() {
  await auth.signOut();
  window.location.href = '../index.html';
}

// ── Overview ──────────────────────────────────────────────
async function loadAdminOverview() {
  try {
    const [usersSnap, slotsSnap, resultsSnap, certsSnap, regsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('slots').get(),
      db.collection('results').get(),
      db.collection('certificates').get(),
      db.collection('registrations').orderBy('registeredAt','desc').limit(5).get()
    ]);
    const participantCount = usersSnap.docs.filter(d => !['admin','superadmin'].includes(d.data().role)).length;
    setVal2('astat-participants', participantCount);
    setVal2('astat-slots', slotsSnap.size);
    setVal2('astat-results', resultsSnap.size);
    setVal2('astat-certs', certsSnap.size);

    const container = document.getElementById('recentRegsContainer');
    if (container) {
      if (regsSnap.empty) { container.innerHTML = '<p class="t-small t-muted">No registrations yet.</p>'; }
      else {
        container.innerHTML = '';
        regsSnap.forEach(doc => {
          const d = doc.data();
          container.innerHTML += `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--ink-mid);border-radius:var(--radius-md);">
              <div class="participant-search-avatar">${(d.firstName||'?').charAt(0).toUpperCase()}</div>
              <div style="flex:1;min-width:0;">
                <div class="t-small" style="font-weight:600;">${d.firstName} ${d.lastName}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.email}</div>
              </div>
              <span class="badge ${d.status==='pending'?'badge-crimson':'badge-green'}">${d.status||'pending'}</span>
            </div>
          `;
        });
      }
    }
    document.getElementById('participantCountBadge').textContent = usersSnap.size;
    const pendingRegs = regsSnap.docs.filter(d => d.data().status === 'pending');
    if (pendingRegs.length > 0) {
      const badge = document.getElementById('pendingRegBadge');
      if (badge) { badge.textContent = pendingRegs.length; badge.style.display = 'inline-flex'; }
    }
  } catch(e) { console.warn('Overview error:', e.message); }
}

function setVal2(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ── Participants ──────────────────────────────────────────
async function loadParticipants() {
  try {
    // Fetch ALL users then filter client-side to avoid index/orderBy issues
    const snap = await db.collection('users').get();
    allParticipants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role !== 'admin' && u.role !== 'superadmin' && u.role !== 'removed')
      .sort((a, b) => {
        // Sort by createdAt descending, handle missing field
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
    renderParticipants(allParticipants);
    // Update badge count
    const badge = document.getElementById('participantCountBadge');
    if (badge) badge.textContent = allParticipants.length;
  } catch(e) {
    console.warn('Participants error:', e.message);
    renderParticipants([]);
  }
}

function filterParticipants() {
  const query = document.getElementById('participantSearch')?.value.toLowerCase() || '';
  const level = document.getElementById('participantLevelFilter')?.value || '';
  const filtered = allParticipants.filter(p =>
    (!query || (p.displayName||'').toLowerCase().includes(query) || (p.email||'').toLowerCase().includes(query)) &&
    (!level || p.level === level)
  );
  renderParticipants(filtered);
}

function renderParticipants(list) {
  const tbody = document.getElementById('participantsTableBody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No participants found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="participant-search-avatar">${(p.displayName||'?').charAt(0).toUpperCase()}</div>
          <span style="font-weight:600;">${p.displayName||`${p.firstName||''} ${p.lastName||''}`}</span>
        </div>
      </td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${p.email||'—'}</td>
      <td><span class="badge badge-grey">${p.level||'—'}</span></td>
      <td style="font-size:0.8rem;">${p.preferredFormat||'—'}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${p.institution||'—'}</td>
      <td style="font-family:var(--ff-mono);color:var(--gold);">${(p.points||0).toLocaleString()}</td>
      <td><span class="badge ${p.active!==false?'badge-green':'badge-grey'}">${p.active!==false?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-table-action" onclick="viewParticipant('${p.id}')">View</button>
          <button class="btn-table-action danger" onclick="if(confirm('Remove this participant?')) removeParticipant('${p.id}')">Remove</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function removeParticipant(uid) {
  try {
    await db.collection('users').doc(uid).update({ active: false, role: 'removed' });
    showToast('Participant removed.', 'info');
    loadParticipants();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function viewParticipant(uid) {
  // Open participant's leaderboard entry or slot management for that user
  showToast('Viewing participant: ' + uid.substring(0,8) + '…', 'info');
}

// ── Registrations ─────────────────────────────────────────
async function loadRegistrations() {
  try {
    const snap = await db.collection('registrations').orderBy('registeredAt','desc').get();
    allRegistrations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filterRegistrations('pending');
  } catch(e) { console.warn('Registrations error:', e.message); }
}

function filterRegistrations(filter) {
  currentRegFilter = filter;
  document.querySelectorAll('.reg-filter-btn').forEach(b => {
    b.className = `btn btn-sm reg-filter-btn ${b.dataset.filter === filter ? 'btn-primary' : 'btn-ghost'}`;
  });
  let list = allRegistrations;
  if (filter !== 'all') list = allRegistrations.filter(r => r.status === filter);
  const tbody = document.getElementById('registrationsTableBody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No registrations in this category.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => {
    const dt = r.registeredAt?.toDate ? r.registeredAt.toDate() : new Date();
    return `
      <tr>
        <td style="font-weight:600;">${r.firstName} ${r.lastName}</td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${r.email||'—'}</td>
        <td><span class="badge badge-grey">${r.level||'—'}</span></td>
        <td style="font-size:0.8rem;">${r.format||'—'}</td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td><span class="badge ${r.status==='pending'?'badge-crimson':r.status==='approved'?'badge-green':'badge-grey'}">${r.status||'pending'}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            ${r.status==='pending' ? `<button class="btn-table-action approve" onclick="approveRegistration('${r.id}','${r.uid}')">✓ Approve</button>` : ''}
            <button class="btn-table-action danger" onclick="if(confirm('Reject?')) rejectRegistration('${r.id}')">✕ Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function approveRegistration(regId, uid) {
  try {
    await db.collection('registrations').doc(regId).update({ status: 'approved' });
    if (uid) await db.collection('users').doc(uid).update({ registrationStatus: 'approved' });
    showToast('Registration approved!', 'success');
    loadRegistrations();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function rejectRegistration(regId) {
  try {
    await db.collection('registrations').doc(regId).update({ status: 'rejected' });
    showToast('Registration rejected.', 'info');
    loadRegistrations();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ── Slots ─────────────────────────────────────────────────
async function loadSlotsAdmin() {
  const tbody = document.getElementById('slotsAdminTable');
  try {
    const snap = await db.collection('slots').orderBy('dateTime','desc').get();
    if (snap.empty) { if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">No slots yet. Create one with + New Slot.</td></tr>'; return; }
    if (tbody) tbody.innerHTML = snap.docs.map(doc => {
      const d = { id: doc.id, ...doc.data() };
      const dt = d.dateTime?.toDate ? d.dateTime.toDate() : new Date(d.dateTime||Date.now());
      return `
        <tr>
          <td style="font-family:var(--ff-mono);">${d.roundNumber||'?'}</td>
          <td style="font-weight:600;">${d.participantName||'—'}</td>
          <td>${d.opponent||'—'}</td>
          <td style="font-size:0.8rem;">${dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} ${dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
          <td><span class="badge badge-grey">${d.format||'—'}</span></td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${d.venue||'—'}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.motion?`"${d.motion}"`:''}</td>
          <td><span class="badge ${d.status==='upcoming'?'badge-gold':d.status==='completed'?'badge-green':'badge-crimson'}">${d.status||'upcoming'}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn-table-action" onclick="editSlot('${doc.id}')">Edit</button>
              <button class="btn-table-action approve" onclick="markSlotComplete('${doc.id}')">✓ Done</button>
              <button class="btn-table-action danger" onclick="if(confirm('Delete slot?')) deleteSlot('${doc.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) { console.warn('Slots error:', e.message); }
}

async function handleSlotSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('slotFormError');
  errEl.classList.add('hidden');
  const participantUid = getVal('slot-participantUid');
  if (!participantUid) { errEl.textContent = 'Please select a participant.'; errEl.classList.remove('hidden'); return; }
  const dateVal = getVal('slot-datetime');
  if (!dateVal) { errEl.textContent = 'Please set a date and time.'; errEl.classList.remove('hidden'); return; }
  const slotData = {
    title: getVal('slot-title') || `Round ${getVal('slot-roundNum')||'?'}`,
    roundNumber: parseInt(getVal('slot-roundNum')) || null,
    participantUid,
    participantName: getVal('slot-participantName'),
    opponent: getVal('slot-opponent'),
    side: getVal('slot-side'),
    dateTime: firebase.firestore.Timestamp.fromDate(new Date(dateVal)),
    format: getVal('slot-format'),
    motion: getVal('slot-motion'),
    venue: getVal('slot-venue'),
    adjudicator: getVal('slot-adjudicator'),
    notes: getVal('slot-notes'),
    status: 'upcoming',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    const editId = getVal('slotEditId');
    if (editId) {
      await db.collection('slots').doc(editId).update(slotData);
    } else {
      slotData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('slots').add(slotData);
    }
    showToast('Slot saved!', 'success');
    closeModal('slotModal');
    loadSlotsAdmin();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

async function editSlot(id) {
  const doc = await db.collection('slots').doc(id).get();
  if (doc.exists) openSlotModal({ id, ...doc.data() });
}

async function markSlotComplete(id) {
  await db.collection('slots').doc(id).update({ status: 'completed' });
  showToast('Slot marked complete.', 'success');
  loadSlotsAdmin();
}

async function deleteSlot(id) {
  await db.collection('slots').doc(id).delete();
  showToast('Slot deleted.', 'info');
  loadSlotsAdmin();
}

// ── Results ───────────────────────────────────────────────
async function loadResultsAdmin() {
  const tbody = document.getElementById('resultsAdminTable');
  try {
    const snap = await db.collection('results').orderBy('date','desc').get();
    if (snap.empty) { if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No results posted yet.</td></tr>'; return; }
    if (tbody) tbody.innerHTML = snap.docs.map(doc => {
      const d = { id: doc.id, ...doc.data() };
      const dt = d.date?.toDate ? d.date.toDate() : new Date();
      return `
        <tr>
          <td style="font-family:var(--ff-mono);">${d.roundNumber||'?'}</td>
          <td style="font-weight:600;">${d.participantName||'—'}</td>
          <td>${d.opponent||'—'}</td>
          <td><span class="badge ${d.outcome==='win'?'badge-gold':'badge-crimson'}">${d.outcome||'—'}</span></td>
          <td style="font-family:var(--ff-mono);">${d.myScore||'—'} vs ${d.opponentScore||'—'}</td>
          <td style="font-family:var(--ff-mono);color:var(--gold);">+${d.points||0}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
          <td>
            <button class="btn-table-action danger" onclick="if(confirm('Delete result?')) deleteResult('${doc.id}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) { console.warn('Results error:', e.message); }
}

async function handleResultSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('resultFormError');
  errEl.classList.add('hidden');
  const participantUid = getVal('result-participantUid');
  if (!participantUid) { errEl.textContent = 'Please select a participant.'; errEl.classList.remove('hidden'); return; }
  const points = parseInt(getVal('result-points')) || 0;
  const outcome = getVal('result-outcome');
  const resultData = {
    participantUid,
    participantName: getVal('result-participantName'),
    roundNumber: parseInt(getVal('result-roundNum')) || null,
    outcome,
    myScore: parseInt(getVal('result-myScore')) || 0,
    opponentScore: parseInt(getVal('result-opponentScore')) || 0,
    opponent: getVal('result-opponent'),
    points,
    motion: getVal('result-motion'),
    mySide: getVal('result-mySide'),
    opponentSide: getVal('result-mySide') === 'Proposition' ? 'Opposition' : 'Proposition',
    format: getVal('result-format'),
    feedback: getVal('result-feedback'),
    adjudicator: getVal('result-adjudicator'),
    date: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.collection('results').add(resultData);
    // Update user stats
    const userRef = db.collection('users').doc(participantUid);
    await userRef.update({
      roundsPlayed: firebase.firestore.FieldValue.increment(1),
      wins: outcome === 'win' ? firebase.firestore.FieldValue.increment(1) : firebase.firestore.FieldValue.increment(0),
      losses: outcome === 'loss' ? firebase.firestore.FieldValue.increment(1) : firebase.firestore.FieldValue.increment(0),
      points: firebase.firestore.FieldValue.increment(points)
    });
    // Update leaderboard
    const userData = (await userRef.get()).data();
    await db.collection('leaderboard').doc(participantUid).set({
      uid: participantUid,
      displayName: userData.displayName || userData.firstName || 'Debater',
      institution: userData.institution || '—',
      email: userData.email || '',
      points: userData.points || 0,
      wins: userData.wins || 0,
      losses: userData.losses || 0,
      roundsPlayed: userData.roundsPlayed || 0,
      tier: getAutoTier(userData.points || 0),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Result posted & leaderboard updated!', 'success');
    closeModal('resultModal');
    loadResultsAdmin();
    loadLeaderboardAdmin();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

function getAutoTier(points) {
  if (points >= 2000) return 'Champion';
  if (points >= 1500) return 'Gold';
  if (points >= 800)  return 'Silver';
  if (points >= 400)  return 'Bronze';
  return 'Participant';
}

async function deleteResult(id) {
  await db.collection('results').doc(id).delete();
  showToast('Result deleted.', 'info');
  loadResultsAdmin();
}

// ── Materials ─────────────────────────────────────────────
async function loadMaterialsAdmin() {
  const container = document.getElementById('materialsAdminList');
  try {
    const snap = await db.collection('materials').orderBy('issuedAt','desc').get();
    if (snap.empty) { if (container) container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">No materials yet.</div>'; return; }
    if (container) container.innerHTML = '';
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      const dt = d.issuedAt?.toDate ? d.issuedAt.toDate() : new Date();
      const el = document.createElement('div');
      el.className = 'material-card';
      el.innerHTML = `
        <div class="material-icon">${{'pdf':'📄','video':'🎬','doc':'📝','link':'🔗','audio':'🎧'}[d.type]||'📎'}</div>
        <div class="material-body">
          <div class="material-title">${d.title||'Untitled'}</div>
          <div class="material-desc">${d.description||''}</div>
          <div class="material-meta">
            <span class="badge badge-grey">${d.type||'Resource'}</span>
            <span class="t-xs t-muted">Issued: ${dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
            <span class="t-xs t-muted">To: ${d.issuedTo==='all'?'All Participants':d.issuedTo}</span>
          </div>
        </div>
        <div class="material-actions">
          ${d.fileUrl ? `<a href="${d.fileUrl}" target="_blank" class="btn btn-ghost btn-sm">Preview</a>` : ''}
          <button class="btn-table-action danger" onclick="if(confirm('Delete material?')) deleteMaterial('${doc.id}')">Delete</button>
        </div>
      `;
      container.appendChild(el);
    });
  } catch(e) { console.warn('Materials admin error:', e.message); }
}

async function handleMaterialSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('materialFormError');
  errEl.classList.add('hidden');
  let issuedTo = getVal('mat-issuedTo');
  if (issuedTo === 'specific') {
    const email = getVal('mat-specificEmail').trim();
    if (!email) { errEl.textContent = 'Please enter participant email.'; errEl.classList.remove('hidden'); return; }
    // Find UID by email
    try {
      const snap = await db.collection('users').where('email','==',email).limit(1).get();
      if (snap.empty) { errEl.textContent = 'No user with that email found.'; errEl.classList.remove('hidden'); return; }
      issuedTo = snap.docs[0].id;
    } catch(e2) { errEl.textContent = e2.message; errEl.classList.remove('hidden'); return; }
  }
  try {
    await db.collection('materials').add({
      title: getVal('mat-title'),
      description: getVal('mat-desc'),
      type: getVal('mat-type'),
      issuedTo,
      fileUrl: getVal('mat-fileUrl'),
      season: getVal('mat-season'),
      issuedAt: firebase.firestore.FieldValue.serverTimestamp(),
      issuedBy: adminUser.uid
    });
    showToast('Material issued successfully!', 'success');
    closeModal('materialModal');
    loadMaterialsAdmin();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

async function deleteMaterial(id) {
  await db.collection('materials').doc(id).delete();
  showToast('Material deleted.', 'info');
  loadMaterialsAdmin();
}

// ── Gallery ───────────────────────────────────────────────
async function loadGalleryAdmin() {
  const grid = document.getElementById('galleryAdminGrid');
  try {
    const snap = await db.collection('gallery').orderBy('order').get();
    if (snap.empty) { if (grid) grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">No gallery images yet. Add some!</div>'; return; }
    if (grid) {
      grid.innerHTML = '';
      snap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        const card = document.createElement('div');
        card.className = 'gallery-admin-card';
        card.innerHTML = `
          <img src="${d.imageUrl}" alt="${d.title||''}" onerror="this.parentElement.style.background='var(--ink-muted)'">
          <div class="gallery-admin-card-label">${d.title||''}</div>
          <div class="gallery-admin-card-overlay">
            <div class="t-small" style="color:white;text-align:center;padding:0 12px;">${d.caption||''}</div>
            <button class="btn btn-crimson btn-sm" onclick="deleteGalleryItem('${doc.id}')">Delete</button>
          </div>
        `;
        grid.appendChild(card);
      });
    }
  } catch(e) { console.warn('Gallery admin error:', e.message); }
}

async function handleGallerySubmit(e) {
  e.preventDefault();
  try {
    await db.collection('gallery').add({
      imageUrl: getVal('gal-imageUrl'),
      title: getVal('gal-title'),
      caption: getVal('gal-caption'),
      order: parseInt(getVal('gal-order')) || 99,
      tall: getVal('gal-size') === 'tall',
      wide: getVal('gal-size') === 'wide',
      addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Image added to gallery!', 'success');
    closeModal('galleryModal');
    loadGalleryAdmin();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function deleteGalleryItem(id) {
  if (!confirm('Remove this image from gallery?')) return;
  await db.collection('gallery').doc(id).delete();
  showToast('Image removed.', 'info');
  loadGalleryAdmin();
}

// ── Leaderboard ───────────────────────────────────────────
async function loadLeaderboardAdmin() {
  const tbody = document.getElementById('lbAdminTable');
  try {
    const snap = await db.collection('leaderboard').orderBy('points','desc').get();
    if (snap.empty) { if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No leaderboard data yet.</td></tr>'; return; }
    if (tbody) tbody.innerHTML = snap.docs.map((doc, i) => {
      const d = doc.data();
      return `
        <tr>
          <td style="font-family:var(--ff-mono);${i<3?'color:var(--gold);font-weight:700;':''}">${i+1}</td>
          <td style="font-weight:600;">${d.displayName||'—'}</td>
          <td style="font-family:var(--ff-mono);">${d.roundsPlayed||0}</td>
          <td style="font-family:var(--ff-mono);">${d.wins||0}</td>
          <td style="font-family:var(--ff-mono);color:var(--gold);font-weight:700;">${(d.points||0).toLocaleString()}</td>
          <td><span class="badge ${d.points>=1500?'badge-gold':'badge-grey'}">${d.tier||'Participant'}</span></td>
          <td>
            <button class="btn-table-action" onclick="openLbUpdateModal({uid:'${doc.id}',displayName:'${d.displayName||''}',email:'${d.email||''}',points:${d.points||0},tier:'${d.tier||''}',wins:${d.wins||0},roundsPlayed:${d.roundsPlayed||0}})">Edit</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) { console.warn('LB admin error:', e.message); }
}

async function handleLbSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('lbFormError');
  errEl.classList.add('hidden');
  const uid = getVal('lb-participantUid');
  if (!uid) { errEl.textContent = 'Please select a participant.'; errEl.classList.remove('hidden'); return; }
  const points = parseInt(getVal('lb-points')) || 0;
  const wins   = parseInt(getVal('lb-wins')) || 0;
  const rounds = parseInt(getVal('lb-rounds')) || 0;
  const tier   = getVal('lb-tier');
  try {
    await db.collection('leaderboard').doc(uid).set({
      uid, points, wins, roundsPlayed: rounds, tier,
      displayName: getVal('lb-participantName'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    // Also sync to users
    await db.collection('users').doc(uid).update({ points, wins, roundsPlayed: rounds });
    showToast('Leaderboard updated!', 'success');
    closeModal('lbModal');
    loadLeaderboardAdmin();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

// ── Certificates ──────────────────────────────────────────
async function loadCertificatesAdmin() {
  const tbody = document.getElementById('certsAdminTable');
  try {
    const snap = await db.collection('certificates').orderBy('issuedAt','desc').get();
    if (snap.empty) { if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No certificates issued yet.</td></tr>'; return; }
    if (tbody) tbody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const dt = d.issuedAt?.toDate ? d.issuedAt.toDate() : new Date();
      return `
        <tr>
          <td style="font-weight:600;">${d.participantName||'—'}</td>
          <td>${d.season||'—'}</td>
          <td style="color:var(--gold);">${d.achievement||'—'}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${dt.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
          <td style="font-family:var(--ff-mono);font-size:0.8rem;">${doc.id.substring(0,12).toUpperCase()}</td>
          <td>
            <button class="btn-table-action danger" onclick="if(confirm('Revoke certificate?')) revokeCertificate('${doc.id}','${d.uid||''}')">Revoke</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(e) { console.warn('Certs error:', e.message); }
}

async function handleCertSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('certFormError');
  errEl.classList.add('hidden');
  const uid = getVal('cert-participantUid');
  if (!uid) { errEl.textContent = 'Please select a participant.'; errEl.classList.remove('hidden'); return; }
  try {
    await db.collection('certificates').add({
      uid,
      participantName: getVal('cert-participantName'),
      season: getVal('cert-season'),
      achievement: getVal('cert-achievement'),
      notes: getVal('cert-notes'),
      issuedAt: firebase.firestore.FieldValue.serverTimestamp(),
      issuedBy: adminUser.uid
    });
    await db.collection('users').doc(uid).update({ certificateIssued: true });
    showToast('Certificate issued!', 'success');
    closeModal('certModal');
    loadCertificatesAdmin();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

async function revokeCertificate(certId, uid) {
  await db.collection('certificates').doc(certId).delete();
  if (uid) await db.collection('users').doc(uid).update({ certificateIssued: false });
  showToast('Certificate revoked.', 'info');
  loadCertificatesAdmin();
}

// ── Settings ──────────────────────────────────────────────
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('platform').get();
    if (doc.exists) {
      const d = doc.data();
      setVal('setting-season', d.seasonName);
      setVal('setting-status', d.status);
      setVal('setting-description', d.description);
      if (d.deadline) setVal('setting-deadline', new Date(d.deadline.toDate()).toISOString().slice(0,10));
    }
  } catch(e) { console.warn('Settings load error:', e.message); }
}

async function saveSettings() {
  try {
    await db.collection('settings').doc('platform').set({
      seasonName: getVal('setting-season'),
      status: getVal('setting-status'),
      description: getVal('setting-description'),
      deadline: getVal('setting-deadline') ? firebase.firestore.Timestamp.fromDate(new Date(getVal('setting-deadline'))) : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    showToast('Settings saved!', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function promoteToAdmin() {
  const email = document.getElementById('promoteEmail')?.value.trim();
  if (!email) { showToast('Enter an email address.', 'error'); return; }
  try {
    const snap = await db.collection('users').where('email','==',email).limit(1).get();
    if (snap.empty) { showToast('No user found with that email.', 'error'); return; }
    await snap.docs[0].ref.update({ role: 'admin' });
    showToast(`${email} promoted to admin!`, 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function resetAllPoints() {
  try {
    const batch = db.batch();
    const snap = await db.collection('users').get();
    snap.forEach(doc => {
      if (!['admin','superadmin'].includes(doc.data().role)) {
        batch.update(doc.ref, { points: 0, wins: 0, losses: 0, roundsPlayed: 0 });
      }
    });
    await batch.commit();
    const lb = await db.collection('leaderboard').get();
    const batch2 = db.batch();
    lb.forEach(doc => { batch2.update(doc.ref, { points: 0, wins: 0, roundsPlayed: 0 }); });
    await batch2.commit();
    showToast('All points reset.', 'info');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ── Participant Search ─────────────────────────────────────
function buildParticipantSearch(context, query, onSelect) {
  const resultsEl = document.getElementById(`${context}-participantResults`);
  if (!resultsEl) return;
  if (!query || query.length < 2) { resultsEl.style.display = 'none'; return; }
  const matches = allParticipants.filter(p =>
    (p.email||'').toLowerCase().includes(query.toLowerCase()) ||
    (p.displayName||'').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);
  if (!matches.length) { resultsEl.style.display = 'none'; return; }
  resultsEl.style.display = 'block';
  resultsEl.className = 'participant-search-results';
  resultsEl.innerHTML = matches.map(p => `
    <button type="button" class="participant-search-item" onclick="selectParticipant('${context}','${p.id}','${(p.displayName||`${p.firstName||''} ${p.lastName||''}`).trim()}','${p.email||''}')">
      <div class="participant-search-avatar">${(p.displayName||p.firstName||'?').charAt(0).toUpperCase()}</div>
      <div class="participant-search-info">
        <div class="participant-search-name">${p.displayName||`${p.firstName||''} ${p.lastName||''}`}</div>
        <div class="participant-search-email">${p.email||''}</div>
      </div>
    </button>
  `).join('');
}

function selectParticipant(context, uid, name, email) {
  document.getElementById(`${context}-participantUid`).value = uid;
  document.getElementById(`${context}-participantName`).value = name;
  const searchEl = document.getElementById(`${context}-participantSearch`);
  if (searchEl) searchEl.value = email || name;
  const resultsEl = document.getElementById(`${context}-participantResults`);
  if (resultsEl) { resultsEl.style.display = 'none'; }
  setSelectedParticipant(context, uid, name, email);
}

function setSelectedParticipant(context, uid, name, email) {
  document.getElementById(`${context}-participantUid`).value = uid;
  document.getElementById(`${context}-participantName`).value = name || '';
  if (email) { const s = document.getElementById(`${context}-participantSearch`); if (s) s.value = email; }
}

function searchParticipantsForSlot()   { buildParticipantSearch('slot',   getVal('slot-participantSearch')); }
function searchParticipantsForResult() { buildParticipantSearch('result', getVal('result-participantSearch')); }
function searchParticipantsForCert()   { buildParticipantSearch('cert',   getVal('cert-participantSearch')); }
function searchParticipantsForLb()     { buildParticipantSearch('lb',     getVal('lb-participantSearch')); }
