// ============================================================
// firebase-config.js — Speaky-Spooky Platform
// Fill in your Firebase project credentials below
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBO76vCIReQidyAWf6SYj5fweTlP_nNjFo",
  authDomain: "speaky-spooky.firebaseapp.com",
  projectId: "speaky-spooky",
  storageBucket: "speaky-spooky.firebasestorage.app",
  messagingSenderId: "399531549487",
  appId: "1:399531549487:web:5c42decb6bf79893c137da",
  measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Firestore Collections Reference
const COLLECTIONS = {
  USERS: 'users',
  SLOTS: 'slots',
  RESULTS: 'results',
  LEADERBOARD: 'leaderboard',
  MATERIALS: 'materials',
  CERTIFICATES: 'certificates',
  GALLERY: 'gallery',
  REGISTRATIONS: 'registrations'
};
