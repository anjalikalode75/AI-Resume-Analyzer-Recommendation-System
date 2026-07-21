# Resume Analyzer — Audit Report

**Date:** 2026-06-06
**Project:** `resume-analyzer new/` (static HTML + vanilla JS + Firebase + Gemini)
**Audit type:** Static code review + live Gemini endpoint probe
**Scope:** Per user request, identify root cause of resume analysis failure first; only minimal, surgical fixes applied.

---

## 1. Root cause of "resume analysis doesn't work"

There are **two independent bugs**, both required to fix.

### Bug A — Prefix-based API key validation (CODE BUG, FIXED ✅)
`js/ai-analysis.js` had:

```js
function hasValidKey() {
  return GEMINI_API_KEY.startsWith("AIza") && GEMINI_API_KEY.length > 30;
}
```

Your configured key is `AQ.Ab8RN6...`. The function returned `false`, so `analyzeResume()` **never called Gemini** — it returned `mockAnalysis()` every time. The dashboard correctly showed a toast saying "demo analysis", but to the user it looked like the AI was just always returning the same scores.

**Fix applied:** validation now only checks that a key is present (length > 10). The only real validation is whether the live HTTP request succeeds.

### Bug B — Your Gemini key has zero quota (EXTERNAL, requires your action ⚠️)
Live probe of Google's endpoint with your `AQ.` key:

```
HTTP 429
"Quota exceeded for metric: generativelanguage.googleapis.com/
 generate_content_free_tier_requests, limit: 0, model: gemini-2.0-flash"
```

Your `AQ.` key is technically accepted by the `?key=` endpoint, but the Google Cloud project it belongs to has **no Gemini free-tier quota and no billing**. After Bug A is fixed, every request will return HTTP 429 until you do **one** of:

1. **Recommended:** Go to https://aistudio.google.com/app/apikey, create a free AI Studio key (starts with `AIza…`), paste it into `js/firebase-config.js` line `GEMINI_API_KEY`. Free tier works immediately.
2. Or enable billing on the Google Cloud project tied to the existing `AQ.` key.

The fixed code now surfaces the 429 with a clear message instead of silently faking it.

---

## 2. Feature inventory

### Existing & working
| Feature | File | Status |
|---|---|---|
| Firebase init (Auth, Firestore, Storage) | `js/firebase-config.js` | ✅ Works (config valid) |
| Email signup with password strength meter | `js/auth.js` | ✅ |
| Email login | `js/auth.js` | ✅ |
| Google sign-in (popup) | `js/auth.js` | ✅ (requires Google provider enabled in Firebase console) |
| Forgot password | `js/auth.js`, `forgot-password.html` | ✅ |
| Auth persistence (browserLocalPersistence) | `js/firebase-config.js` | ✅ |
| Auto-redirect when logged in | `js/auth.js` | ✅ |
| Auth gate on dashboard | `js/dashboard.js` | ✅ |
| PDF text extraction (pdf.js) | `js/upload.js` | ✅ |
| DOCX text extraction (mammoth) | `js/upload.js` | ✅ |
| Drag-and-drop upload + file validation | `js/upload.js` | ✅ |
| Firebase Storage upload | `js/upload.js` | ✅ (subject to Storage rules — see §4) |
| Firestore save of resumes + analysis | `js/dashboard.js` | ✅ (subject to Firestore rules) |
| Chart.js doughnut/radar charts | `js/dashboard.js` | ✅ |
| jsPDF report export | `js/dashboard.js` | ✅ |
| Dark/light mode toggle | `js/theme.js` | ✅ |
| Profile page | `js/profile.js`, `profile.html` | ✅ basic |
| Landing page with scroll reveal | `js/app.js`, `index.html` | ✅ |

### Broken (before fix)
| Feature | Cause |
|---|---|
| **Real Gemini AI analysis** | Bug A (prefix check) + Bug B (zero quota) |
| Honest user feedback on AI failure | Silent mock fallback masked the real error |

### Missing (in your spec but not implemented)
> You asked for a full SaaS rebuild. The current project is a small static site. Honest list of what is **NOT** in the zip yet:

- ❌ Resume analysis history page (data IS saved to `analysis` collection, but no UI lists past reports)
- ❌ Resume comparison (compare 2 resumes side-by-side)
- ❌ Dedicated analytics dashboard (avg ATS, user activity, skill trends)
- ❌ Job recommendation engine beyond what Gemini returns inline
- ❌ Notification system (only toast exists)
- ❌ Admin panel UI (admin email constant is now added; UI not built)
- ❌ Major SaaS visual redesign (existing CSS is kept as-is)
- ❌ Build pipeline / bundler (project is plain `<script type="module">`)

I did not implement those because (a) you said "do not break existing functionality" and (b) building all of them safely is a multi-iteration project. See §6 for recommended next steps.

---

## 3. Firebase audit

| Area | Finding |
|---|---|
| Web config | Valid, matches project `resume-analyzer-f392a` |
| Auth providers | Code uses Email/Password + Google. **You must enable both** in Firebase Console → Authentication → Sign-in method |
| Authorized domains | When deploying, add your hosting domain in Auth → Settings → Authorized domains |
| Firestore rules | **No rules file existed.** Added `firestore.rules` (owner-only + admin) |
| Storage rules | **No rules file existed.** Added `storage.rules` (per-user folder, 10 MB, PDF/DOCX only) |
| Persistence | `browserLocalPersistence` set — correct |
| Error handling | Existing `friendlyError()` map is decent; kept as-is |

---

## 4. Other issues found (documented, not all fixed)

| # | Severity | Issue | Fixed? |
|---|---|---|---|
| 1 | 🔴 High | Prefix-based API key validation | ✅ |
| 2 | 🔴 High | Silent mock fallback masks real errors | ✅ |
| 3 | 🟡 Med | Missing Firestore security rules | ✅ (file added — you must deploy them) |
| 4 | 🟡 Med | Missing Storage security rules | ✅ (file added) |
| 5 | 🟡 Med | No admin role concept | ✅ partial (`ADMIN_EMAIL` constant + `isAdmin()` helper) |
| 6 | 🟡 Med | Gemini key shipped in client-side JS (anyone who opens devtools can steal it) | ⚠️ Documented — see §6 |
| 7 | 🟢 Low | No loading skeleton on dashboard initial load | ❌ |
| 8 | 🟢 Low | No retry button after Gemini failure | ❌ |
| 9 | 🟢 Low | No mobile-first review of dashboard charts | ❌ |
| 10 | 🟢 Low | `app.js` mobile menu uses inline styles | ❌ |

---

## 5. Files modified / added

**Modified**
- `js/ai-analysis.js` — removed prefix check; throw real errors; added `emergencyFallbackAnalysis` opt-in
- `js/dashboard.js` — handle real errors from Gemini; do not save mock results to Firestore
- `js/firebase-config.js` — added `ADMIN_EMAIL` + `isAdmin()`, clarified key comment

**Added**
- `firestore.rules` — owner + admin access
- `storage.rules` — per-user folder with file-type + size limits
- `AUDIT_REPORT.md` — this file
- `SETUP.md` — deployment / connection steps

---

## 6. Recommended next steps (in priority order)

1. **Replace the Gemini key** with an `AIza…` key from AI Studio (or enable billing on current Cloud project). Without this nothing else matters.
2. Deploy the new Firestore & Storage rules (see SETUP.md).
3. Move the Gemini key off the client. The current setup leaks your key to anyone who opens browser devtools. Proper fix = a tiny backend (Cloud Function / Lovable Cloud edge function) that proxies the request and adds the key server-side.
4. Build the missing SaaS features incrementally — I recommend starting with **Analysis History** (the data is already in Firestore, just needs a `history.html` page).
