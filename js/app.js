// ============================================================
// Landing Page Interactions
// ============================================================

// Smooth scroll-reveal animations using IntersectionObserver
document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll(
    ".feature-card, .step, .testimonial, .section-head, .hero-text, .hero-visual"
  );
  targets.forEach((el) => el.classList.add("reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Mobile menu (simple toggle)
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");
  hamburger?.addEventListener("click", () => {
    if (!navLinks) return;
    const open = navLinks.style.display === "flex";
    navLinks.style.display = open ? "" : "flex";
    if (!open) {
      navLinks.style.flexDirection = "column";
      navLinks.style.position = "absolute";
      navLinks.style.top = "72px";
      navLinks.style.left = "0";
      navLinks.style.right = "0";
      navLinks.style.background = "var(--surface)";
      navLinks.style.padding = "20px";
      navLinks.style.borderBottom = "1px solid var(--border)";
    }
  });
});
