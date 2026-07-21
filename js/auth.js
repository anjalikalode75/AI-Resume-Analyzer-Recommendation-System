// ============================================================
// Authentication Module
// Handles signup, login, password reset, and Google auth.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db, googleProvider, toast } from "./firebase-config.js";

// ---------- Validation helpers ----------
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (pwd) =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/popup-closed-by-user": "Sign-in cancelled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ---------- Save user to Firestore ----------
async function saveUserDoc(user, extra = {}) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      name: user.displayName || extra.name || "",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ---------- Signup ----------
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const pwd = document.getElementById("password");
  const strengthBar = document.getElementById("strengthBar");
  const strengthWrap = strengthBar?.parentElement;

  pwd?.addEventListener("input", () => {
    const v = pwd.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    strengthBar.style.width = `${(score / 4) * 100}%`;
    strengthWrap.classList.remove("medium", "strong");
    if (score >= 3) strengthWrap.classList.add("strong");
    else if (score === 2) strengthWrap.classList.add("medium");
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = pwd.value;
    const btn = document.getElementById("signupBtn");

    if (!name) return toast("Please enter your name", "error");
    if (!validateEmail(email)) return toast("Invalid email", "error");
    if (!validatePassword(password))
      return toast("Password must be 8+ chars with uppercase, number & symbol", "error");

    btn.disabled = true;
    btn.textContent = "Creating account...";
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await saveUserDoc(user, { name });
      await sendEmailVerification(user).catch(() => {});
      toast("Account created! Check your email to verify.", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 1200);
    } catch (err) {
      toast(friendlyError(err.code), "error");
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  });
}

// ---------- Login ----------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("loginBtn");

    if (!validateEmail(email)) return toast("Invalid email", "error");
    if (!password) return toast("Enter your password", "error");

    btn.disabled = true;
    btn.textContent = "Logging in...";
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Welcome back!", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 800);
    } catch (err) {
      toast(friendlyError(err.code), "error");
      btn.disabled = false;
      btn.textContent = "Login";
    }
  });
}

// ---------- Google sign-in ----------
const googleBtn = document.getElementById("googleBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await saveUserDoc(user);
      toast("Signed in with Google!", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 800);
    } catch (err) {
      toast(friendlyError(err.code), "error");
    }
  });
}

// ---------- Forgot password ----------
const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    if (!validateEmail(email)) return toast("Invalid email", "error");
    const btn = document.getElementById("resetBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      await sendPasswordResetEmail(auth, email);
      toast("Reset link sent! Check your inbox.", "success");
      btn.textContent = "Sent ✓";
    } catch (err) {
      toast(friendlyError(err.code), "error");
      btn.disabled = false;
      btn.textContent = "Send Reset Link";
    }
  });
}

// ---------- Auto-redirect if already logged in ----------
if (loginForm || signupForm) {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });
}
