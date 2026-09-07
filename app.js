const header = document.querySelector(".site-header");
const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");
const navAnchors = document.querySelectorAll(".nav-links a");

const onScroll = () => {
  header.classList.toggle("scrolled", window.scrollY > 12);
};

onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

menuBtn?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuBtn.classList.toggle("active", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});

navAnchors.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtn.classList.remove("active");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

const counters = document.querySelectorAll("[data-count]");

const counterObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = Number(el.dataset.count || 0);
      const duration = 900;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);

        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  },
  { threshold: 0.6 }
);

counters.forEach((counter) => counterObserver.observe(counter));

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.dataset.copy;
    const original = button.textContent;

    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copiado ✓";
    } catch {
      button.textContent = text;
    }

    setTimeout(() => {
      button.textContent = original;
    }, 1800);
  });
});

document.getElementById("year").textContent = new Date().getFullYear();


// Modal de PE Orange Admin
const adminModal = document.getElementById("adminModal");
const openAdminModalButton = document.querySelector("[data-open-admin-modal]");
const closeAdminModalButtons = document.querySelectorAll("[data-close-admin-modal]");
const setAdminModal = (open) => {
  if (!adminModal) return;
  adminModal.classList.toggle("open", open);
  adminModal.setAttribute("aria-hidden", String(!open));
  document.body.style.overflow = open ? "hidden" : "";
  if (open) adminModal.querySelector(".admin-modal-close")?.focus();
  else openAdminModalButton?.focus();
};
openAdminModalButton?.addEventListener("click", () => setAdminModal(true));
closeAdminModalButtons.forEach((button) => button.addEventListener("click", () => setAdminModal(false)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && adminModal?.classList.contains("open")) setAdminModal(false);
});
