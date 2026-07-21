// ============================================================
// Dark / Light Mode Toggle
// ============================================================
(function () {
  const KEY = "resumeiq-theme";
  const saved = localStorage.getItem(KEY) || "light";
  document.documentElement.setAttribute("data-theme", saved);

  function setIcon(btn, theme) {
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    setIcon(btn, document.documentElement.getAttribute("data-theme"));
    btn?.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(KEY, next);
      setIcon(btn, next);
    });
  });
})();
