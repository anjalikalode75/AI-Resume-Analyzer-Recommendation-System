// ============================================================
// Firebase Configuration
// ============================================================
// 👉 Replace the firebaseConfig values below with your own from
//    Firebase Console → Project Settings → Web App.
// 👉 Replace GEMINI_API_KEY with your key from
//    https://aistudio.google.com/app/apikey
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// Firebase Storage removed: resumes are processed in-browser (PDF.js / mammoth)
// and only analysis results are persisted to Firestore. This avoids the
// Storage paid-plan requirement and the "Uploading file to secure storage..." hang.


const firebaseConfig = {
  apiKey: "AIzaSyBj3NvW4llzyCPO7XFzS5uH2LCO4FIXYQo",
  authDomain: "resume-analyzer-f392a.firebaseapp.com",
  projectId: "resume-analyzer-f392a",
  storageBucket: "resume-analyzer-f392a.firebasestorage.app",
  messagingSenderId: "1049897116958",
  appId: "1:1049897116958:web:5a1ab4af8280395abd550f",
  measurementId: "G-NLX7EX65B2"
};

// ⚠️ GEMINI API KEY
// Get one from https://aistudio.google.com/app/apikey (starts with "AIza").
// "AQ." prefixed keys also work via ?key= IF the underlying Cloud project
// has Gemini quota enabled. The app does NOT validate the prefix.
export const GEMINI_API_KEY = "";
export const GEMINI_MODEL = "gemini-2.0-flash";

// Single predefined admin (no public admin signup).
export const ADMIN_EMAIL = "anjalikalode75@gmail.com";
export const isAdmin = (user) => !!user && user.email === ADMIN_EMAIL;

// Initialize Firebase services
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Keep user signed in across browser sessions
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Toast helper used across pages
export function toast(message, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove("show"), 3500);
}
