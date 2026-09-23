/*
 * Práctica Emprendedora · inicialización de tema compatible con CSP.
 *
 * Este archivo reemplaza los <script> inline que eran bloqueados por
 * Content-Security-Policy. Se carga en <head> para evitar flashes de tema.
 */
(() => {
  "use strict";

  const THEME_KEY = "pe-theme";
  const root = document.documentElement;

  function readInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;

      // Primera visita: Práctica Emprendedora abre en oscuro.
      localStorage.setItem(THEME_KEY, "dark");
      return "dark";
    } catch (_) {
      return "dark";
    }
  }

  function setTheme(theme, persist = true) {
    const next = theme === "light" ? "light" : "dark";
    root.dataset.theme = next;

    if (persist) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#0b1220" : "#f5f7fa");

    // Los botones comunes son gestionados por app.js.
    // Estos son los botones de las páginas legales, que no cargan app.js.
    document.querySelectorAll("[data-legal-theme-toggle]").forEach((button) => {
      const dark = next === "dark";
      button.classList.toggle("is-dark", dark);
      button.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
      button.setAttribute("title", dark ? "Tema claro" : "Tema oscuro");

      const label = button.querySelector(".theme-toggle-label");
      if (label) label.textContent = dark ? "Claro" : "Oscuro";
    });
  }

  // Esto se ejecuta antes de cargar styles.css para evitar el flash de color.
  setTheme(readInitialTheme(), false);

  // Cuenta necesita este dato antes del primer render para mostrar el formulario
  // correcto sin depender de JavaScript inline.
  try {
    const mode = new URLSearchParams(location.search).get("mode");
    root.dataset.authMode = mode === "signup" ? "signup" : "login";
  } catch (_) {
    root.dataset.authMode = "login";
  }

  function bindPageControls() {
    document.querySelectorAll("[data-legal-theme-toggle]").forEach((button) => {
      if (button.dataset.themeBound === "1") return;
      button.dataset.themeBound = "1";

      button.addEventListener("click", () => {
        const current = root.dataset.theme === "light" ? "light" : "dark";
        setTheme(current === "dark" ? "light" : "dark", true);
      });
    });

    document.querySelectorAll("[data-legal-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });

    // Sincroniza labels/meta una vez que el DOM ya existe.
    setTheme(root.dataset.theme, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPageControls, { once: true });
  } else {
    bindPageControls();
  }
})();
