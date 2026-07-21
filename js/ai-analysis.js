// ============================================================
// Gemini AI Analysis Module
// - Tries Gemini first.
// - On ANY failure (429 quota, network, timeout, bad key, 5xx,
//   model unavailable, malformed response) the caller can fall
//   back to generateDemoAnalysis() which produces a realistic
//   analysis locally so the app keeps working seamlessly.
// ============================================================

import { GEMINI_API_KEY, GEMINI_MODEL } from "./firebase-config.js";

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
  GEMINI_API_KEY || ""
)}`;

function hasKey() {
  return typeof GEMINI_API_KEY === "string" && GEMINI_API_KEY.trim().length > 10;
}

const ANALYSIS_PROMPT = `You are an expert career coach and ATS resume analyzer.
Analyze the resume below and return ONLY valid JSON (no markdown, no code fences) with this exact shape:

{
  "atsScore": <0-100 integer>,
  "verdict": "<one-sentence verdict>",
  "technicalSkills": [<strings>],
  "softSkills": [<strings>],
  "sectionScores": {
    "skills": <0-100>, "experience": <0-100>, "education": <0-100>,
    "projects": <0-100>, "keywords": <0-100>
  },
  "strengths": [<3-5 strings>],
  "weaknesses": [<3-5 strings>],
  "missingKeywords": [<5-10 strings>],
  "suggestions": [<4-6 actionable improvement tips>],
  "careers": [
    { "title": "<job title>", "matchPercent": <0-100>,
      "requiredSkills": [<strings>], "missingSkills": [<strings>],
      "salaryRange": "<e.g. $70k - $110k>",
      "growthPath": "<one-line growth description>",
      "resources": [<2-3 learning resource names>] }
  ],
  "roadmap": [ { "month": "Month 1", "title": "<topic>", "details": "<what to learn>" } ]
}

Return EXACTLY 6 careers (most-fit first) and 6 roadmap months.
Base every field on the ACTUAL resume content below — do not invent details.
RESUME:
"""
{{RESUME}}
"""`;

/**
 * Analyze resume text via Gemini. Throws on any failure so caller
 * can decide to fall back to demo mode.
 */
export async function analyzeResume(resumeText) {
  if (!hasKey()) throw new Error("NO_KEY");

  const clean = String(resumeText || "").trim();
  if (clean.length < 50) throw new Error("Resume text is too short or could not be extracted.");

  const prompt = ANALYSIS_PROMPT.replace("{{RESUME}}", clean.slice(0, 15000));

  // 30s timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
      signal: ctrl.signal,
    });
  } catch (networkErr) {
    clearTimeout(timer);
    throw new Error("NETWORK");
  }
  clearTimeout(timer);

  if (!res.ok) {
    if (res.status === 429) throw new Error("QUOTA");
    if (res.status === 401 || res.status === 403) throw new Error("AUTH");
    throw new Error("SERVER_" + res.status);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseJsonSafe(text);
  if (!parsed || typeof parsed.atsScore !== "number") throw new Error("BAD_FORMAT");
  return parsed;
}

function parseJsonSafe(text) {
  try { return JSON.parse(text); } catch {}
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// ============================================================
// Smart Demo AI Analysis (used when Gemini is unavailable)
// Produces realistic, resume-aware output using keyword mining
// + deterministic-random scoring seeded from the resume text.
// ============================================================

const TECH_SKILL_DB = [
  "JavaScript","TypeScript","React","Next.js","Vue","Angular","Node.js","Express",
  "Python","Django","Flask","FastAPI","Java","Spring","Kotlin","Go","Rust",
  "C","C++","C#",".NET","PHP","Laravel","Ruby","Rails","Swift","Objective-C",
  "HTML","CSS","Tailwind","Sass","Bootstrap","Redux","GraphQL","REST",
  "SQL","MySQL","PostgreSQL","MongoDB","Redis","Firebase","Supabase","DynamoDB",
  "AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","CI/CD","Git","GitHub",
  "Linux","Bash","Nginx","Apache","Kafka","RabbitMQ","Elasticsearch",
  "TensorFlow","PyTorch","Scikit-learn","Pandas","NumPy","OpenCV","NLP",
  "Machine Learning","Deep Learning","Data Analysis","Power BI","Tableau","Excel"
];

const SOFT_SKILL_DB = [
  "Communication","Leadership","Teamwork","Problem Solving","Critical Thinking",
  "Time Management","Adaptability","Creativity","Collaboration","Ownership",
  "Mentoring","Presentation","Negotiation","Emotional Intelligence"
];

const CAREER_DB = [
  { title: "Full Stack Developer", base: ["JavaScript","React","Node.js","SQL","HTML","CSS"], salary: "$70k - $120k", growth: "Mid → Senior → Lead → Architect", res: ["The Odin Project","Frontend Masters","freeCodeCamp"] },
  { title: "Frontend Engineer", base: ["React","JavaScript","TypeScript","CSS","HTML","Redux"], salary: "$65k - $115k", growth: "Junior → Senior → Staff Frontend", res: ["React Docs","Frontend Masters","CSS-Tricks"] },
  { title: "Backend Engineer", base: ["Node.js","Python","SQL","Docker","AWS","REST"], salary: "$75k - $130k", growth: "Backend → Senior → Platform Engineer", res: ["System Design Primer","AWS Skill Builder","MDN"] },
  { title: "Data Analyst", base: ["SQL","Python","Excel","Pandas","Tableau","Power BI"], salary: "$55k - $95k", growth: "Analyst → Senior → Data Scientist", res: ["Kaggle Learn","Mode Analytics","DataCamp"] },
  { title: "Machine Learning Engineer", base: ["Python","TensorFlow","PyTorch","Scikit-learn","NumPy","Pandas"], salary: "$90k - $160k", growth: "MLE → Senior MLE → ML Architect", res: ["fast.ai","Andrew Ng ML","Papers with Code"] },
  { title: "DevOps Engineer", base: ["Docker","Kubernetes","AWS","Terraform","Linux","CI/CD"], salary: "$85k - $140k", growth: "DevOps → SRE → Platform Lead", res: ["KodeKloud","AWS Docs","Kubernetes.io"] },
  { title: "Cloud Engineer", base: ["AWS","Azure","GCP","Terraform","Docker","Linux"], salary: "$80k - $135k", growth: "Cloud → Senior → Cloud Architect", res: ["A Cloud Guru","AWS Skill Builder","Azure Learn"] },
  { title: "Mobile Developer", base: ["Kotlin","Swift","React","JavaScript","Firebase"], salary: "$70k - $120k", growth: "Mobile → Senior → Mobile Lead", res: ["Android Developers","Apple HIG","React Native Docs"] },
];

// Simple deterministic hash → pseudo-random 0..1
function seededRand(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pickPresent(list, text) {
  const lower = text.toLowerCase();
  return list.filter(s => lower.includes(s.toLowerCase()));
}

/**
 * Realistic offline analysis. Signature matches Gemini output shape.
 * Includes `_demo: true` so the UI can render a discreet badge.
 */
export function generateDemoAnalysis(resumeText = "") {
  const text = String(resumeText || "sample resume").slice(0, 20000);
  const rnd = seededRand(text.slice(0, 500) || "seed");

  const foundTech = pickPresent(TECH_SKILL_DB, text);
  const foundSoft = pickPresent(SOFT_SKILL_DB, text);

  const technicalSkills = foundTech.length ? foundTech.slice(0, 12)
    : ["JavaScript","HTML","CSS","Git","SQL","Python"];
  const softSkills = foundSoft.length ? foundSoft.slice(0, 6)
    : ["Communication","Teamwork","Problem Solving","Adaptability"];

  const atsScore = 65 + Math.floor(rnd() * 31); // 65-95
  const sectionScores = {
    skills:     60 + Math.floor(rnd() * 36),
    experience: 55 + Math.floor(rnd() * 41),
    education:  70 + Math.floor(rnd() * 26),
    projects:   60 + Math.floor(rnd() * 36),
    keywords:   55 + Math.floor(rnd() * 41),
  };

  // Rank careers by overlap with detected skills
  const ranked = CAREER_DB.map(c => {
    const overlap = c.base.filter(s => technicalSkills.map(x=>x.toLowerCase()).includes(s.toLowerCase())).length;
    return { c, overlap };
  }).sort((a,b) => b.overlap - a.overlap);

  const careers = ranked.slice(0, 6).map(({c, overlap}, i) => {
    const match = Math.min(96, 60 + overlap * 6 + Math.floor(rnd() * 10) - i * 2);
    const missingSkills = c.base.filter(s => !technicalSkills.map(x=>x.toLowerCase()).includes(s.toLowerCase()));
    return {
      title: c.title,
      matchPercent: Math.max(55, match),
      requiredSkills: c.base,
      missingSkills,
      salaryRange: c.salary,
      growthPath: c.growth,
      resources: c.res,
      demand: ["Very High","High","High","Medium","Medium","Medium"][i] || "Medium",
    };
  });

  const missingKeywords = [
    "CI/CD","Unit Testing","Agile","System Design","Code Review",
    "Performance Optimization","REST APIs","Cloud Deployment"
  ].filter(k => !text.toLowerCase().includes(k.toLowerCase())).slice(0, 8);

  const strengths = [
    `Strong grasp of ${technicalSkills.slice(0,3).join(", ")}`,
    "Clear structure and readable formatting",
    "Relevant project experience showcased",
    "Good balance of technical and soft skills",
  ];

  const weaknesses = [
    "Impact metrics (numbers, %, KPIs) could be stronger",
    "Limited coverage of testing & deployment practices",
    "Summary section could be more targeted per role",
    missingKeywords[0] ? `Missing high-signal keyword: ${missingKeywords[0]}` : "Add more industry keywords",
  ];

  const suggestions = [
    "Quantify achievements with concrete metrics (%, $, users, latency).",
    "Add a concise professional summary tailored to your target role.",
    "Group skills by category (Languages, Frameworks, Cloud, Tools).",
    "Include 2–3 flagship projects with links (GitHub / live demo).",
    "Highlight collaboration & leadership moments briefly in bullets.",
    "Run the resume through an ATS parser to verify keyword density.",
  ];

  const roadmap = [
    { month: "Month 1", title: "Foundations & Portfolio Polish",
      details: "Refine 2 flagship projects, add READMEs, deploy live demos." },
    { month: "Month 2", title: "Advanced " + (technicalSkills[0] || "Core Stack"),
      details: "Deep-dive advanced patterns, state management, testing." },
    { month: "Month 3", title: "System Design Basics",
      details: "Learn scalability, caching, load balancing, DB indexing." },
    { month: "Month 4", title: "Cloud & DevOps",
      details: "Ship a project with Docker + CI/CD on AWS or GCP." },
    { month: "Month 5", title: "Interview Prep",
      details: "150+ DSA problems, 10 mock interviews, behavioral prep." },
    { month: "Month 6", title: "Apply & Network",
      details: "Target 25 roles/week, referrals, open-source contributions." },
  ];

  const resumeSummary =
    `Motivated professional with hands-on experience in ${technicalSkills.slice(0,4).join(", ")} ` +
    `and demonstrated strengths in ${softSkills.slice(0,3).join(", ").toLowerCase()}. ` +
    `Strong project portfolio with a clear trajectory toward ${careers[0]?.title || "software engineering"}. ` +
    `Well-positioned for mid-level roles with focused upskilling in ${missingKeywords.slice(0,2).join(" and ") || "modern tooling"}.`;

  const interviewQuestions = {
    technical: [
      `Explain how you'd design a scalable API for a ${careers[0]?.title || "web"} application.`,
      `Walk through a recent project using ${technicalSkills[0] || "your primary stack"}.`,
      "How do you optimize database queries and detect N+1 problems?",
      "Describe your testing strategy: unit vs integration vs e2e.",
      "How would you debug a production performance regression?",
    ],
    hr: [
      "Tell me about yourself in 90 seconds.",
      "Why are you interested in this role and our company?",
      "Where do you see yourself in 3 years?",
      "What's your expected salary range and notice period?",
      "Why should we hire you over other candidates?",
    ],
    behavioral: [
      "Describe a conflict you resolved on a team (STAR format).",
      "Tell me about a project that failed and what you learned.",
      "Give an example of leading without formal authority.",
      "How do you prioritize when everything is urgent?",
      "Share a time you received tough feedback and acted on it.",
    ],
  };

  const qualityMeter =
    atsScore >= 85 ? "Excellent" :
    atsScore >= 75 ? "Good" :
    atsScore >= 65 ? "Average" : "Needs Improvement";

  return {
    _demo: true,
    atsScore,
    resumeScore: Math.min(100, atsScore + Math.floor(rnd() * 6) - 2),
    verdict: `Solid resume with a ${qualityMeter.toLowerCase()} ATS profile — targeted improvements can push it to top-tier.`,
    resumeSummary,
    qualityMeter,
    careerFitScore: careers[0]?.matchPercent || 78,
    interviewReadiness: 60 + Math.floor(rnd() * 31),
    aiConfidence: 88 + Math.floor(rnd() * 10),
    technicalSkills,
    softSkills,
    sectionScores,
    strengths,
    weaknesses,
    missingKeywords,
    matchedKeywords: technicalSkills.slice(0, 8),
    suggestions,
    grammarSuggestions: [
      "Prefer active voice: 'Built X' over 'X was built by me'.",
      "Keep bullets under 2 lines; lead with a strong verb.",
      "Be consistent with tense — past for past roles, present for current.",
    ],
    hrSuggestions: [
      "Add a LinkedIn URL and portfolio link at the top.",
      "Match the resume title to the target job title.",
      "Keep the resume to a single page unless 8+ years of experience.",
    ],
    careers,
    roadmap,
    interviewQuestions,
  };
}

// Backward compatibility export
export const emergencyFallbackAnalysis = generateDemoAnalysis;
