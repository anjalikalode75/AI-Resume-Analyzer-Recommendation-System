# Setup & Deployment Guide

This is a static site — no build step. Open `index.html` in a browser via a local server.

## 1. Run locally

```bash
# from inside the project folder
python3 -m http.server 5500
# then open http://localhost:5500
```

(Do **not** open the .html files directly via `file://` — ES module imports won't work.)

## 2. Connect Firebase (already done for your project)

Your `js/firebase-config.js` already points to project **`resume-analyzer-f392a`**. In the [Firebase Console](https://console.firebase.google.com/project/resume-analyzer-f392a) make sure these are enabled:

| Service | Where | What to enable |
|---|---|---|
| Authentication | Authentication → Sign-in method | **Email/Password** and **Google** providers |
| Firestore | Firestore Database → Create database | Production mode, region of your choice |
| Storage | Storage → Get started | Default bucket |
| Authorized domains | Authentication → Settings → Authorized domains | Add `localhost` (default) and any hosting domain |

## 3. Deploy the new security rules ⚠️ Required

Without these, you will get **"Missing or insufficient permissions"** errors.

### Option A — Firebase CLI (recommended)

```bash
npm install -g firebase-tools
firebase login
firebase init firestore storage   # select existing project: resume-analyzer-f392a
# When asked for the rules files, point to the ones in this folder:
#   firestore.rules
#   storage.rules
firebase deploy --only firestore:rules,storage:rules
```

### Option B — Console copy-paste

1. Open [Firestore Rules](https://console.firebase.google.com/project/resume-analyzer-f392a/firestore/rules) → paste contents of `firestore.rules` → **Publish**.
2. Open [Storage Rules](https://console.firebase.google.com/project/resume-analyzer-f392a/storage/rules) → paste contents of `storage.rules` → **Publish**.

## 4. Fix the Gemini API key ⚠️ Required

Your current `AQ.` key has **zero quota** (HTTP 429 on every request).

1. Visit https://aistudio.google.com/app/apikey
2. Click **Create API key** → pick the `resume-analyzer-f392a` project (or any project)
3. Copy the new key (starts with `AIza…`)
4. Open `js/firebase-config.js`, replace the `GEMINI_API_KEY` value, save

The free tier gives ~15 requests/min which is plenty for testing.

## 5. Admin account

- The single admin is hardcoded as `anjalikalode75@gmail.com` (constant `ADMIN_EMAIL` in `js/firebase-config.js`).
- Sign up with that email like a normal user — the `isAdmin()` helper and Firestore/Storage rules grant admin reads automatically.
- There is **no public admin signup route** — only that exact email gets admin privileges.

## 6. Verifying it works (5-minute smoke test)

1. `python3 -m http.server 5500`, open `http://localhost:5500`
2. Sign up with a test email → should redirect to dashboard
3. Upload a PDF or DOCX resume → drag-and-drop area highlights, then file name appears
4. Click **Analyze**
   - ✅ **Success:** loading overlay cycles "Extracting → Uploading → Analyzing" then real ATS score + sections appear, toast says "Analysis complete!"
   - ❌ **HTTP 429:** toast clearly says "Gemini quota exceeded" → finish step 4 above
   - ❌ **HTTP 401/403:** toast says "Gemini rejected the API key" → recheck key
   - ❌ **Firestore "Missing or insufficient permissions":** rules not deployed → do step 3
5. Log out, log in again → dashboard auto-loads previous resumes
6. Click **Download Report** → PDF downloads

## 7. Known limitations (read AUDIT_REPORT.md §2 "Missing")

The features below are in your spec but **not** in this zip — they were intentionally deferred to keep the fix surgical:
analysis history page, resume comparison, analytics dashboard, admin panel UI, dedicated job-recommendation engine, notification center, full SaaS redesign.

Tell me which of those to build next and I will add them iteratively.

## 8. Security note

The Gemini API key is shipped in client JS — anyone can read it from devtools. For a real production launch, proxy the Gemini call through a small backend (Firebase Cloud Function or Lovable Cloud edge function) and keep the key server-side. Happy to wire that up next if you want.
