// ============================================================
// Dashboard Logic — orchestrates upload, analysis, charts, reports
// ============================================================

import { auth, db, toast } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { initDropzone, extractText, uploadResumeFile } from "./upload.js";
import { analyzeResume, generateDemoAnalysis } from "./ai-analysis.js";

let currentUser = null;
let selectedFile = null;
let lastAnalysis = null;
let charts = {};

// ---------- Auth gate ----------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  document.getElementById("userName").textContent = user.displayName || user.email.split("@")[0];
  document.getElementById("greeting").textContent = `Welcome back, ${
    (user.displayName || "there").split(" ")[0]
  } 👋`;
  loadPreviousResumes();
});

// ---------- Logout ----------
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// ---------- Sidebar toggle (mobile) ----------
document.getElementById("sideToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

// ---------- Upload flow ----------
initDropzone({
  onFileSelected: (file) => {
    selectedFile = file;
    document.getElementById("analyzeBtn").disabled = false;
  },
});

// Small helper: paced multi-step loader text
async function runSteps(el, steps) {
  for (const s of steps) {
    el.textContent = s.text;
    await new Promise((r) => setTimeout(r, s.ms));
  }
}

// (generateDemoAnalysis imported at top)

document.getElementById("analyzeBtn")?.addEventListener("click", async () => {
  if (!selectedFile || !currentUser) return;
  const overlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");
  overlay.classList.remove("hidden");

  try {
    loadingText.textContent = "⬆️  Uploading...";
    await new Promise((r) => setTimeout(r, 350));

    loadingText.textContent = "📄 Extracting resume content...";
    const text = await extractText(selectedFile);
    if (!text || text.length < 50) {
      throw new Error("Could not read resume content. Try a different file.");
    }

    const stepsPromise = runSteps(loadingText, [
      { text: "🧠 Analyzing skills...", ms: 600 },
      { text: "📊 Generating ATS score...", ms: 600 },
      { text: "🚀 Preparing career suggestions...", ms: 600 },
      { text: "📝 Finalizing report...", ms: 400 },
    ]);

    // Try Gemini — silently fall back to Smart Demo AI on ANY failure.
    let analysis;
    let usedDemo = false;
    try {
      analysis = await analyzeResume(text);
    } catch (aiErr) {
      console.warn("[AI] Gemini unavailable, using Smart Demo AI:", aiErr?.message);
      analysis = generateDemoAnalysis(text);
      usedDemo = true;
    }
    await stepsPromise;

    lastAnalysis = analysis;

    // Save to Firestore — never block the UI on failures.
    try {
      const resumeDoc = await addDoc(collection(db, "resumes"), {
        userId: currentUser.uid,
        fileName: selectedFile.name,
        fileUrl: null,
        filePath: null,
        atsScore: analysis.atsScore,
        demo: !!usedDemo,
        uploadDate: serverTimestamp(),
      });
      await addDoc(collection(db, "analysis"), {
        userId: currentUser.uid,
        resumeId: resumeDoc.id,
        ...analysis,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Firestore save skipped:", e?.message);
    }

    renderAnalysis(analysis);
    renderDemoBadge(usedDemo);
    overlay.classList.add("hidden");
    toast(usedDemo ? "Analysis ready (Demo AI)" : "Analysis complete!", "success");
    document.getElementById("analysis-section").scrollIntoView({ behavior: "smooth" });
    loadPreviousResumes();
  } catch (err) {
    console.error(err);
    // Absolute last resort: still show a demo analysis rather than an ugly error.
    try {
      const demo = generateDemoAnalysis("");
      lastAnalysis = demo;
      renderAnalysis(demo);
      renderDemoBadge(true);
      overlay.classList.add("hidden");
      toast("Showing Demo AI analysis", "success");
    } catch {
      overlay.classList.add("hidden");
      toast("Something went wrong. Please try again.", "error");
    }
  }
});

// Discreet "Demo AI Analysis" badge injected into the analysis panel header.
function renderDemoBadge(show) {
  const section = document.getElementById("analysis-section");
  if (!section) return;
  let badge = document.getElementById("demoAiBadge");
  if (!show) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement("span");
    badge.id = "demoAiBadge";
    badge.className = "demo-badge";
    badge.title = "AI service is busy — showing a locally generated demo analysis.";
    badge.innerHTML = "✨ Demo AI Analysis";
    const header = section.querySelector("h2, h3, .panel-header") || section;
    header.appendChild(badge);
  }
}

// ---------- Render analysis ----------
function renderAnalysis(a) {
  document.getElementById("analysis-section").classList.remove("hidden");
  document.getElementById("careers-section").classList.remove("hidden");
  document.getElementById("roadmap-section").classList.remove("hidden");

  // Stats
  document.getElementById("statAts").textContent = a.atsScore;
  document.getElementById("statMatch").textContent = a.careers?.[0]?.title || "—";

  // ATS Score
  document.getElementById("atsScoreText").textContent = a.atsScore;
  document.getElementById("atsVerdict").textContent = a.verdict || "";
  drawAtsChart(a.atsScore);

  // Charts
  drawSkillsChart(a);
  drawSectionsChart(a.sectionScores);

  // Lists
  fillList("strengthsList", a.strengths);
  fillList("weaknessesList", a.weaknesses);
  fillList("suggestionsList", a.suggestions);

  // Keyword chips
  const kw = document.getElementById("keywordsList");
  kw.innerHTML = "";
  (a.missingKeywords || []).forEach((k) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = k;
    kw.appendChild(span);
  });

  // Careers
  const cg = document.getElementById("careersGrid");
  cg.innerHTML = "";
  (a.careers || []).forEach((c) => {
    const skills = (c.requiredSkills || []).map((s) => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("");
    const missing = (c.missingSkills || []).map((s) => `<span class="skill-tag" style="color:#EF4444">${escapeHtml(s)}</span>`).join("");
    cg.insertAdjacentHTML(
      "beforeend",
      `<div class="career-card">
        <h4>${escapeHtml(c.title)}</h4>
        <small class="muted">Match: <strong>${c.matchPercent}%</strong></small>
        <div class="match-bar"><div style="width:${c.matchPercent}%"></div></div>
        <p class="muted" style="font-size:.88rem">${escapeHtml(c.growthPath || "")}</p>
        <p class="salary">💰 ${escapeHtml(c.salaryRange || "")}</p>
        <div style="margin-top:10px"><small class="muted">Required:</small><br>${skills}</div>
        ${missing ? `<div style="margin-top:8px"><small class="muted">You're missing:</small><br>${missing}</div>` : ""}
      </div>`
    );
  });

  // Roadmap
  const tl = document.getElementById("roadmapTimeline");
  tl.innerHTML = "";
  (a.roadmap || []).forEach((r) => {
    tl.insertAdjacentHTML(
      "beforeend",
      `<div class="timeline-item">
        <h4>${escapeHtml(r.month)} — ${escapeHtml(r.title)}</h4>
        <p>${escapeHtml(r.details)}</p>
      </div>`
    );
  });
}

function fillList(id, items = []) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    el.appendChild(li);
  });
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Charts ----------
function destroy(name) {
  if (charts[name]) charts[name].destroy();
}

function drawAtsChart(score) {
  destroy("ats");
  const ctx = document.getElementById("atsChart").getContext("2d");
  charts.ats = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [score, 100 - score],
          backgroundColor: ["#2563EB", "rgba(148,163,184,.2)"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 1200 } },
  });
}

function drawSkillsChart(a) {
  destroy("skills");
  const ctx = document.getElementById("skillsChart").getContext("2d");
  const tech = (a.technicalSkills || []).slice(0, 6);
  const soft = (a.softSkills || []).slice(0, 4);
  charts.skills = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Technical", "Soft"],
      datasets: [
        {
          data: [tech.length, soft.length],
          backgroundColor: ["#2563EB", "#06B6D4"],
          borderWidth: 0,
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

function drawSectionsChart(s = {}) {
  destroy("sections");
  const ctx = document.getElementById("sectionsChart").getContext("2d");
  charts.sections = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Skills", "Experience", "Education", "Projects", "Keywords"],
      datasets: [
        {
          label: "Score",
          data: [s.skills || 0, s.experience || 0, s.education || 0, s.projects || 0, s.keywords || 0],
          backgroundColor: "rgba(124,58,237,.25)",
          borderColor: "#7C3AED",
          borderWidth: 2,
          pointBackgroundColor: "#7C3AED",
        },
      ],
    },
    options: {
      scales: { r: { beginAtZero: true, max: 100, ticks: { display: false } } },
      plugins: { legend: { display: false } },
    },
  });
}

// ---------- Download PDF report ----------
document.getElementById("downloadReport")?.addEventListener("click", () => {
  if (!lastAnalysis) return toast("Run an analysis first", "error");
  generatePdfReport(lastAnalysis);
});

function generatePdfReport(a) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const line = (txt, y, opts = {}) => {
    doc.setFontSize(opts.size || 11);
    doc.setTextColor(opts.color || "#0F172A");
    doc.text(txt, opts.x || 14, y);
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(20);
  doc.text("ResumeIQ — AI Analysis Report", 14, 19);

  let y = 42;
  line(`Generated for: ${currentUser.displayName || currentUser.email}`, y); y += 7;
  line(`Date: ${new Date().toLocaleDateString()}`, y); y += 12;

  line(`ATS Score: ${a.atsScore}/100`, y, { size: 16, color: "#2563EB" }); y += 10;
  line(a.verdict || "", y); y += 12;

  line("Strengths:", y, { size: 13 }); y += 7;
  (a.strengths || []).forEach((s) => { line(`• ${s}`, y); y += 6; });
  y += 4;

  line("Weaknesses:", y, { size: 13 }); y += 7;
  (a.weaknesses || []).forEach((s) => { line(`• ${s}`, y); y += 6; });
  y += 4;

  if (y > 240) { doc.addPage(); y = 20; }
  line("Top Career Matches:", y, { size: 13 }); y += 7;
  (a.careers || []).slice(0, 5).forEach((c) => {
    line(`• ${c.title} — ${c.matchPercent}% match (${c.salaryRange})`, y); y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  });
  y += 4;

  if (y > 240) { doc.addPage(); y = 20; }
  line("6-Month Roadmap:", y, { size: 13 }); y += 7;
  (a.roadmap || []).forEach((r) => {
    line(`${r.month}: ${r.title}`, y); y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  doc.save(`ResumeIQ-Report-${Date.now()}.pdf`);
  toast("Report downloaded!", "success");
}

// ---------- Previous resumes ----------
async function loadPreviousResumes() {
  const el = document.getElementById("previousResumes");
  if (!el || !currentUser) return;
  try {
    const q = query(
      collection(db, "resumes"),
      where("userId", "==", currentUser.uid),
      orderBy("uploadDate", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      el.innerHTML = `<p class="muted">No resumes uploaded yet.</p>`;
      document.getElementById("statResumes").textContent = "0";
      document.getElementById("statReports").textContent = "0";
      return;
    }
    el.innerHTML = "";
    snap.forEach((d) => {
      const r = d.data();
      const date = r.uploadDate?.toDate?.().toLocaleDateString() || "";
      el.insertAdjacentHTML(
        "beforeend",
        `<div class="resume-item">
          <div class="info"><strong>📄 ${escapeHtml(r.fileName)}</strong><small>${date} • ATS ${r.atsScore || "—"}</small></div>
          ${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-outline">View</a>` : ""}
        </div>`
      );
    });
    document.getElementById("statResumes").textContent = snap.size;
    document.getElementById("statReports").textContent = snap.size;
  } catch (e) {
    console.warn("Could not load resumes:", e);
    el.innerHTML = `<p class="muted">Unable to load history.</p>`;
  }
}
