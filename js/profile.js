// ============================================================
// Profile Page Logic
// ============================================================

import { auth, db, storage, toast } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

let user = null;

onAuthStateChanged(auth, (u) => {
  if (!u) return (window.location.href = "login.html");
  user = u;
  document.getElementById("profileName").textContent = u.displayName || "User";
  document.getElementById("profileEmail").textContent = u.email;
  document.getElementById("displayName").value = u.displayName || "";
  if (u.photoURL) document.getElementById("profilePic").src = u.photoURL;
  else
    document.getElementById("profilePic").src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.displayName || u.email)}`;
  loadUserResumes();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

document.getElementById("sideToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

// Update display name
document.getElementById("saveProfile")?.addEventListener("click", async () => {
  const name = document.getElementById("displayName").value.trim();
  if (!name) return toast("Name cannot be empty", "error");
  try {
    await updateProfile(user, { displayName: name });
    await setDoc(doc(db, "users", user.uid), { name }, { merge: true });
    document.getElementById("profileName").textContent = name;
    toast("Profile updated!", "success");
  } catch (e) {
    toast(e.message, "error");
  }
});

// Change password
document.getElementById("changePwdBtn")?.addEventListener("click", async () => {
  const pwd = document.getElementById("newPassword").value;
  if (pwd.length < 8) return toast("Password must be 8+ characters", "error");
  try {
    await updatePassword(user, pwd);
    document.getElementById("newPassword").value = "";
    toast("Password updated!", "success");
  } catch (e) {
    toast(e.code === "auth/requires-recent-login" ? "Please log in again to change password" : e.message, "error");
  }
});

// Profile picture upload
document.getElementById("picUpload")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast("Image must be under 2MB", "error");
  try {
    const r = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    await updateProfile(user, { photoURL: url });
    await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
    document.getElementById("profilePic").src = url;
    toast("Profile picture updated!", "success");
  } catch (err) {
    toast(err.message, "error");
  }
});

// Load user's resumes
async function loadUserResumes() {
  const el = document.getElementById("userResumes");
  try {
    const q = query(
      collection(db, "resumes"),
      where("userId", "==", user.uid),
      orderBy("uploadDate", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      el.innerHTML = `<p class="muted">No resumes yet. <a href="dashboard.html" class="link">Upload one</a>.</p>`;
      return;
    }
    el.innerHTML = "";
    snap.forEach((d) => {
      const r = d.data();
      const date = r.uploadDate?.toDate?.().toLocaleDateString() || "";
      el.insertAdjacentHTML(
        "beforeend",
        `<div class="resume-item">
          <div class="info"><strong>📄 ${r.fileName}</strong><small>${date} • ATS ${r.atsScore || "—"}</small></div>
          ${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-outline">View</a>` : ""}
        </div>`
      );
    });
  } catch (e) {
    el.innerHTML = `<p class="muted">Unable to load resumes.</p>`;
  }
}
