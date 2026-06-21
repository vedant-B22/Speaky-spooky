// ============================================================
// landing.js — Landing Page Interactions
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initNav();
  initParticles();
  initCounters();
  initGallery();
  initScrollReveal();
});

// ── Loader ─────────────────────────────────────────────────
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }, 600);
  });
}

// ── Navbar ─────────────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('mainNav');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
    });
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
      });
    });
  }

  // Active link on scroll
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 100;
    sections.forEach(sec => {
      const top = sec.offsetTop, bottom = top + sec.offsetHeight;
      const id = sec.getAttribute('id');
      document.querySelectorAll(`.nav-link[href="#${id}"]`).forEach(l => {
        l.classList.toggle('active', scrollY >= top && scrollY < bottom);
      });
    });
  }, { passive: true });
}

// ── Particles ──────────────────────────────────────────────
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const count = window.innerWidth < 768 ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: ${Math.random() * 20}%;
      animation-duration: ${6 + Math.random() * 12}s;
      animation-delay: ${Math.random() * 8}s;
      width: ${1 + Math.random() * 2}px;
      height: ${1 + Math.random() * 2}px;
      opacity: ${0.1 + Math.random() * 0.4};
    `;
    container.appendChild(p);
  }
}

// ── Counters ───────────────────────────────────────────────
function initCounters() {
  const nums = document.querySelectorAll('.hero-stat-num[data-count]');
  if (!nums.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      let current = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current).toLocaleString();
        if (current >= target) clearInterval(timer);
      }, 16);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  nums.forEach(n => observer.observe(n));
}

// ── Gallery ────────────────────────────────────────────────
function initGallery() {
  // Try loading from Firestore
  if (typeof db !== 'undefined') {
    loadGalleryFromFirestore();
  } else {
    showDemoGallery();
  }

  // Lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.getElementById('lightboxClose');
  if (lightboxClose) {
    lightboxClose.addEventListener('click', () => lightbox.classList.remove('open'));
  }
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.classList.remove('open');
    });
  }
}

async function loadGalleryFromFirestore() {
  const grid = document.getElementById('galleryGrid');
  try {
    const snap = await db.collection(COLLECTIONS.GALLERY).orderBy('order').limit(12).get();
    if (snap.empty) { showDemoGallery(); return; }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = `gallery-item${data.tall ? ' gallery-item--tall' : ''}${data.wide ? ' gallery-item--wide' : ''}`;
      item.innerHTML = `
        <img src="${data.imageUrl}" alt="${data.caption || ''}" loading="lazy">
        <div class="gallery-overlay">
          <div class="t-small" style="font-weight:600;">${data.title || ''}</div>
          <div class="t-xs t-muted">${data.caption || ''}</div>
        </div>
      `;
      item.addEventListener('click', () => openLightbox(data.imageUrl, data.caption));
      grid.appendChild(item);
    });
  } catch (e) {
    console.warn('Gallery load failed:', e.message);
    showDemoGallery();
  }
}

function showDemoGallery() {
  const grid = document.getElementById('galleryGrid');
  const placeholder = document.getElementById('galleryPlaceholder');
  if (grid) grid.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';

  // Bind lightbox to demo items
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const caption = item.querySelector('.t-small')?.textContent || '';
      openLightbox(null, caption);
    });
  });
}

function openLightbox(src, caption) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');
  if (!lightbox) return;
  if (img && src) { img.src = src; img.style.display = 'block'; }
  else if (img)   { img.style.display = 'none'; }
  if (cap) cap.textContent = caption || '';
  lightbox.classList.add('open');
}

// ── Scroll Reveal ──────────────────────────────────────────
function initScrollReveal() {
  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .reveal-delay-1 { transition-delay: 0.1s; }
    .reveal-delay-2 { transition-delay: 0.2s; }
    .reveal-delay-3 { transition-delay: 0.3s; }
    .user-nav-pill { display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--ink-surface);border:1px solid var(--ink-border);border-radius:100px;font-size:0.8rem;color:var(--text-secondary); }
    .user-nav-avatar { width:26px;height:26px;border-radius:50%;background:var(--gold-pale);border:1px solid var(--gold);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem; }
  `;
  document.head.appendChild(style);

  // Add reveal class to target elements
  document.querySelectorAll('.card, .pillar, .hiw-step, .lb-podium-item').forEach((el, i) => {
    el.classList.add('reveal');
    if (i % 3 === 1) el.classList.add('reveal-delay-1');
    if (i % 3 === 2) el.classList.add('reveal-delay-2');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Leaderboard Preview from Firestore ─────────────────────
async function loadLeaderboardPreview() {
  if (typeof db === 'undefined') return;
  try {
    const snap = await db.collection(COLLECTIONS.LEADERBOARD)
      .orderBy('points', 'desc').limit(8).get();
    if (snap.empty) return;

    const users = [];
    snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

    // Update top 3
    const top3 = document.getElementById('lbTop3');
    if (top3 && users.length >= 3) {
      const ranks = [users[1], users[0], users[2]]; // silver, gold, bronze order
      const classes = ['lb-silver', 'lb-gold', 'lb-bronze'];
      const rankNums = [2, 1, 3];
      top3.innerHTML = ranks.map((u, i) => `
        <div class="lb-podium-item ${classes[i]}">
          ${i === 1 ? '<div class="lb-crown">♛</div>' : ''}
          <div class="lb-rank">${rankNums[i]}</div>
          <div class="lb-avatar ${i===1?'lb-avatar--gold':''}">${(u.displayName||'?').charAt(0).toUpperCase()}</div>
          <div class="lb-name">${u.displayName || 'Debater'}</div>
          <div class="lb-score">${(u.points||0).toLocaleString()} pts</div>
          <div class="lb-badge badge ${i===1?'badge-gold':'badge-grey'}">${u.tier||'Finalist'}</div>
        </div>
      `).join('');
    }

    // Update table
    const tbody = document.getElementById('lbTableBody');
    if (tbody && users.length > 3) {
      tbody.innerHTML = users.slice(3).map((u, i) => `
        <tr>
          <td>${i + 4}</td>
          <td>${u.displayName || 'Debater'}</td>
          <td>${u.roundsPlayed || 0}</td>
          <td>${u.wins || 0}</td>
          <td>${(u.points || 0).toLocaleString()}</td>
          <td><span class="badge ${u.points > 1500 ? 'badge-gold' : 'badge-grey'}">${u.tier || 'Silver'}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.warn('Leaderboard load failed:', e.message);
  }
}

// Run leaderboard load
if (typeof db !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadLeaderboardPreview);
}
