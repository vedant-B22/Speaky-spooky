# Speaky-Spooky — Competitive Debate Platform

Premium competitive debate platform with public landing page, participant dashboard, and full admin panel.

---

## 🗂 File Structure

```
speaky-spooky/
├── index.html                  ← Public landing page
├── .env                        ← Environment variables (fill before deploy)
├── firebase.json               ← Firebase hosting config
├── firestore.rules             ← Firestore security rules
│
├── css/
│   ├── global.css              ← Design system tokens & global styles
│   ├── nav.css                 ← Navigation component
│   ├── landing.css             ← Landing page sections
│   └── dashboard.css           ← Customer + Admin dashboard layout
│   └── admin.css               ← Admin-specific styles
│
├── js/
│   ├── firebase-config.js      ← 🔑 Firebase credentials (fill this)
│   ├── auth.js                 ← Auth logic (register, login, sign out)
│   ├── landing.js              ← Landing page animations & gallery
│   ├── customer-dashboard.js   ← Customer dashboard logic
│   └── admin-dashboard.js      ← Admin panel logic
│
├── customer/
│   └── dashboard.html          ← Participant dashboard
│
└── admin/
    ├── login.html              ← Admin login page
    └── dashboard.html          ← Admin panel
```

---

## 🚀 Setup Steps

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Email/Password provider
4. Enable **Firestore Database** → Start in production mode
5. Enable **Storage** (optional, for file uploads)
6. Enable **Hosting** (optional, for deployment)

### 2. Fill Firebase Credentials
Open `js/firebase-config.js` and replace all placeholder values:
```js
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",       // from Firebase Console → Project Settings
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Deploy Firestore Rules
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 4. Create Your First Admin Account
1. Register normally on the landing page
2. Go to Firebase Console → Firestore → `users` collection
3. Find your user document by UID
4. Change `role` field from `"participant"` to `"admin"`
5. Now you can log into `/admin/login.html`

### 5. Seed Initial Data (Optional)
In Firebase Console → Firestore, create these collections manually or through the admin panel:
- `users` — auto-created on registration
- `slots` — created via admin panel
- `results` — created via admin panel
- `leaderboard` — auto-updated when results are posted
- `materials` — created via admin panel
- `gallery` — created via admin panel
- `certificates` — created via admin panel
- `registrations` — auto-created on registration
- `settings` — created via admin Settings page

### 6. Deploy to Firebase Hosting (Optional)
```bash
firebase init hosting
firebase deploy
```
Or drag the folder into Netlify / Vercel.

---

## 🎯 Feature Checklist

### Public Landing Page
- [x] Animated hero with podium motif and particle effects
- [x] Live counter stats (debaters, rounds, certificates)
- [x] About section with debate format preview card
- [x] Gallery grid (loads from Firestore, falls back to demo)
- [x] How It Works step track
- [x] Live leaderboard preview (top 3 podium + table)
- [x] Register modal (full form with level, format, institution)
- [x] Login modal
- [x] Responsive navbar with mobile hamburger
- [x] Footer with all links

### Participant Dashboard (`/customer/dashboard.html`)
- [x] **Overview** — stats (rounds, wins, points, rank), upcoming slots preview, quick links
- [x] **My Slots & Schedule** — all assigned rounds with date, time, motion, opponent, side; filter by upcoming/completed/all
- [x] **My Results** — score breakdowns, win/loss, adjudicator feedback, points earned
- [x] **Training Materials** — resources issued by admin, with open/download links
- [x] **Leaderboard** — full season rankings with your position highlighted
- [x] **Certificate** — locked until admin issues it; shows full certificate with achievement, seal, signatures
- [x] **Profile** — view and edit name, institution, format preference

### Admin Panel (`/admin/dashboard.html`)
- [x] **Dashboard** — overview stats + recent registrations + quick action buttons
- [x] **Participants** — full table with search/filter; view, remove users
- [x] **Registrations** — pending/approved filter; approve or reject new signups
- [x] **Manage Slots** — create, edit, delete debate slots; assign participant, opponent, motion, venue, adjudicator, side, time
- [x] **Post Results** — record win/loss, scores, feedback; auto-updates user stats and leaderboard
- [x] **Training Materials** — upload resources to all or specific participants
- [x] **Gallery** — add/delete event photos shown on public site
- [x] **Leaderboard** — manually update points, tiers, wins, rounds for any participant
- [x] **Certificates** — issue official certificates to participants; revoke if needed
- [x] **Settings** — configure season name, status, deadline, description; promote users to admin; reset all points

---

## 🎨 Design System

| Token | Value | Use |
|-------|-------|-----|
| `--ink` | `#0A0A0F` | Page background |
| `--ink-mid` | `#12121A` | Section alt background |
| `--ink-surface` | `#1A1A26` | Cards, panels |
| `--gold` | `#C4A44A` | Primary accent, headings |
| `--crimson` | `#8B1A1A` | Admin accent, opposition |
| `--parchment` | `#F2EAD8` | Certificate background |
| Display font | Playfair Display | All headings |
| Body font | Inter | All body text |
| Mono font | Courier Prime | Stats, timers, IDs |

---

## 📋 Firestore Collections

| Collection | Description |
|------------|-------------|
| `users` | All user profiles (role: participant / admin) |
| `registrations` | Registration submissions (status: pending / approved / rejected) |
| `slots` | Debate round assignments per participant |
| `results` | Match outcomes with scores and feedback |
| `leaderboard` | Rankings (updated automatically when results posted) |
| `materials` | Training resources issued to participants |
| `gallery` | Public gallery images |
| `certificates` | Issued certificates |
| `settings` | Platform configuration |

---

## 🔐 Security Notes

- Firestore rules ensure participants can only read their own slots, results, and certificates
- Leaderboard and gallery are public-read (no auth required)
- Admin operations require `role: "admin"` or `"superadmin"` in the user document
- The `.env` file is for reference; all credentials go into `js/firebase-config.js` for this client-side setup
- For production, consider using Firebase App Check to prevent API abuse

---

## 💡 Extending

- **Email notifications**: Use Firebase Functions + SendGrid to email participants when slots are assigned or results are posted
- **File uploads**: Integrate Firebase Storage for direct PDF/image uploads in the admin panel
- **Video debate links**: Add a `meetLink` field to slots for Zoom/Meet integration
- **PDF certificates**: Use `html2canvas` + `jsPDF` for downloadable certificate PDFs
- **Real-time updates**: Replace `.get()` with `.onSnapshot()` for live dashboard updates
