// ============================================================
// Resume Upload Module
// Handles drag-and-drop, file validation, and text extraction.
// ============================================================

import { toast } from "./firebase-config.js";
// Firebase Storage removed — files stay in browser memory only.

// Configure PDF.js worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const ALLOWED = [".pdf", ".docx"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function isValidFile(file) {
  if (!file) return false;
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (!ALLOWED.includes(ext)) {
    toast("Only PDF and DOCX files are supported", "error");
    return false;
  }
  if (file.size > MAX_SIZE) {
    toast("File must be under 10MB", "error");
    return false;
  }
  return true;
}

// Extract text content from PDF or DOCX
export async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") return extractPdf(file);
  if (ext === "docx") return extractDocx(file);
  throw new Error("Unsupported file");
}

async function extractPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return text.trim();
}

async function extractDocx(file) {
  const buf = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

// Kept as a no-op for backward compatibility with any caller that still imports it.
// Returns null URL/path — analysis results (not the file) are what we persist.
export async function uploadResumeFile(_userId, file) {
  return { url: null, path: null, fileName: file?.name || null };
}

// Wire up dropzone & file input
export function initDropzone({ onFileSelected }) {
  const dz = document.getElementById("dropzone");
  const input = document.getElementById("fileInput");
  const browse = document.getElementById("browseBtn");
  const fname = document.getElementById("fileName");
  if (!dz || !input) return;

  const handle = (file) => {
    if (!isValidFile(file)) return;
    fname.textContent = `📄 ${file.name}`;
    onFileSelected(file);
  };

  browse?.addEventListener("click", (e) => {
    e.stopPropagation();
    input.click();
  });
  dz.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => e.target.files[0] && handle(e.target.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
    })
  );
  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  });
}
