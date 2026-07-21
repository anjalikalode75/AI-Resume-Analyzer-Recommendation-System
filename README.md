# ResumeIQ — AI Resume Analyzer & Career Recommender

A complete vanilla-JS web app that analyzes resumes with Google's Gemini AI and provides ATS scoring, skill-gap analysis, career recommendations, and a 6-month learning roadmap. Backed by Firebase (Auth, Firestore, Storage).

## ✨ Features
- Email/password + Google Sign-In (Firebase Auth)
- PDF & DOCX upload with drag-and-drop, client-side text extraction (PDF.js + Mammoth)
- Gemini AI analysis: ATS score, strengths, weaknesses, missing keywords, suggestions
- 6 career recommendations with match %, salary range, missing skills, growth path
- 6-month personalized learning roadmap
- Interactive charts (Chart.js): ATS doughnut, skills, radar of section strengths
- PDF report export (jsPDF)
- Resume history saved in Firestore + file in Firebase Storage
- Dark/light mode, fully responsive

## 🛠️ Tech Stack
Vanilla HTML/CSS/JS · Firebase v10 (modular) · Gemini API · Chart.js · jsPDF · PDF.js · Mammoth.js

---

## 🚀 How to Run (Local)

This is a static site — no build step. But because it uses ES modules and Firebase Auth, you **must** serve it over `http://` (not `file://`).

### Option 1 — VS Code Live Server
1. Open the folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → "Open with Live Server".

### Option 2 — Python (no installs needed)
```bash
cd "resume-analyzer new"
python3 -m http.server 5500
# Visit http://localhost:5500
```

### Option 3 — Node
```bash
npx serve .
```

---

## 🔑 Required Configuration

Open `js/firebase-config.js` and replace **two** values:

### 1. Gemini API key
Get a free key at https://aistudio.google.com/app/apikey — it must start with `AIza…`.
```js
export const GEMINI_API_KEY = "AIza…your-key-here…";
```
> If the key is missing or malformed the app falls back to a demo analysis so the UI keeps working, and a toast tells you to add a real key.

### 2. Firebase project
The bundled config points at a sample project. Replace `firebaseConfig` with your own from **Firebase Console → Project Settings → General → Your apps → Web app**.

In the Firebase console enable:
- **Authentication** → Sign-in methods: *Email/Password* + *Google*
- **Firestore Database** (start in production or test mode)
- **Storage**
- Add `localhost` to **Authentication → Settings → Authorized domains**

### 3. Firestore security rules (recommended)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /resumes/{id} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /analysis/{id} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

### 4. Storage security rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /resumes/{uid}/{file=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid
                         && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

---

## 📁 Project Structure
```
resume-analyzer new/
├── index.html              Landing page
├── login.html              Email/Google login
├── signup.html             Signup with password strength
├── forgot-password.html    Password reset
├── dashboard.html          Main app (upload, analysis, charts, roadmap)
├── profile.html            User profile
├── css/
│   ├── style.css           Design tokens + base components
│   ├── dashboard.css       Dashboard layout
│   ├── auth.css            Login/signup pages
│   ├── profile.css         Profile page
│   └── responsive.css      Breakpoints
├── js/
│   ├── firebase-config.js  Firebase + Gemini config (EDIT THIS)
│   ├── auth.js             Login/signup/reset/Google
│   ├── upload.js           PDF/DOCX drag-and-drop + text extraction
│   ├── ai-analysis.js      Gemini API call + mock fallback
│   ├── dashboard.js        Charts, render, history, PDF export
│   ├── profile.js          Profile page
│   ├── theme.js            Dark/light toggle
│   └── app.js              Landing-page animations
└── assets/                 icons / images / logos
```

---

## 🩹 What Was Fixed in This Version

| Area | Fix |
|---|---|
| **AI analysis** | Detects invalid Gemini keys (must start with `AIza`) and falls back to a working demo analysis instead of crashing. Network/parse errors are caught and surfaced as a toast. |
| **Dashboard** | Stats (`Resumes`, `Reports`) now update from Firestore. Demo-mode toast tells users when they're seeing mock data. |
| **Colors** | New professional SaaS palette: Primary `#2563EB`, Secondary `#7C3AED`, Accent `#06B6D4`, Success `#10B981`, Warning `#F59E0B`. Charts and PDF header recolored to match. |
| **Robustness** | `parseJsonSafe` no longer throws on malformed AI output. Firestore/Storage failures degrade gracefully — analysis still renders. |
| **Docs** | Full README with run instructions + Firebase rules. |

## ⚠️ Common Issues
- **"Missing or insufficient permissions"** → publish the Firestore/Storage rules above.
- **"AI analysis failed"** → your `GEMINI_API_KEY` is missing or invalid. The app will keep working with demo data until you fix it.
- **Login popup blocked** → allow popups for `localhost`, or use email/password login.
- **`file://` doesn't work** → use a local server (see options above).

---
Built with ❤️ — ship something amazing.
