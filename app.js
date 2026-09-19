// -----------------------------------------------------------------------------
// Tema claro / oscuro
// El tema claro es el predeterminado para mantener la estética institucional.
// La preferencia queda guardada para todas las páginas del sitio.
// -----------------------------------------------------------------------------
const PE_THEME_KEY = "pe-theme";

function applyPETheme(theme, persist = true) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  if (persist) {
    try { localStorage.setItem(PE_THEME_KEY, next); } catch (_) {}
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const dark = next === "dark";
    button.classList.toggle("is-dark", dark);
    button.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    button.setAttribute("title", dark ? "Tema claro" : "Tema oscuro");
    const label = button.querySelector(".theme-toggle-label");
    if (label) label.textContent = dark ? "Claro" : "Oscuro";
  });

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", next === "dark" ? "#0b1422" : "#ffffff");
}

let initialPETheme = "light";
try {
  initialPETheme = localStorage.getItem(PE_THEME_KEY) === "dark" ? "dark" : "light";
} catch (_) {}
applyPETheme(initialPETheme, false);

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyPETheme(current === "dark" ? "light" : "dark");
  });
});

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

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();


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


// -----------------------------------------------------------------------------
// Muestra REAL de reportes en la landing.
// Conserva el formato monoespaciado de los .TXT generados por el simulador.
// -----------------------------------------------------------------------------
(() => {
  const schoolSection = document.querySelector("#colegios");
  const main = document.querySelector("main");
  if (!main || document.querySelector("#reportes")) return;

  const styles = document.createElement("style");
  styles.id = "pe-report-showcase-styles";
  styles.textContent = `
    .pe-reports-section { position: relative; overflow: hidden; }
    .pe-reports-section::before {
      content: ""; position: absolute; width: 520px; height: 520px;
      left: -270px; top: 90px; border-radius: 50%;
      background: rgba(107,183,255,.08); filter: blur(90px); pointer-events: none;
    }
    .pe-reports-heading { max-width: 850px; margin-bottom: 38px; }
    .pe-reports-heading h2 { margin-bottom: 16px; }
    .pe-reports-heading p { max-width: 760px; color: var(--muted); font-size: 17px; line-height: 1.7; }

    .pe-report-showcase {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px; align-items: start;
    }
    .pe-report-preview {
      min-width: 0; overflow: hidden; border: 1px solid var(--line, rgba(255,255,255,.09));
      border-radius: 6px; background: #ffffff;
      box-shadow: none;
    }
    .pe-report-windowbar {
      min-height: 54px; padding: 0 17px; display: flex; align-items: center;
      justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(255,255,255,.07);
      background: #f8fafc;
    }
    .pe-report-windowbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .pe-report-dots { display: flex; gap: 5px; flex: 0 0 auto; }
    .pe-report-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.18); }
    .pe-report-windowbar strong {
      overflow: hidden; color: #24324a; font-size: 12px; font-weight: 800;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .pe-report-kind {
      flex: 0 0 auto; padding: 6px 9px; border: 1px solid rgba(89,230,173,.18);
      border-radius: 4px; color: #2563eb; background: #eff6ff;
      font-size: 9px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase;
    }

    .pe-report-paper {
      position: relative; background: #f4f4ef; border-top: 1px solid #d6d6cf;
      border-bottom: 1px solid #d6d6cf;
    }
    .pe-report-scroll {
      position: relative; height: 510px; overflow: auto; padding: 22px 18px 26px;
      scrollbar-width: thin; scrollbar-color: #a9a9a3 #e5e5df;
    }
    .pe-report-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
    .pe-report-scroll::-webkit-scrollbar-track { background: #e5e5df; }
    .pe-report-scroll::-webkit-scrollbar-thumb { background: #a9a9a3; border-radius: 99px; border: 2px solid #e5e5df; }
    .pe-report-scroll.expanded { height: min(78vh, 980px); }
    .pe-report-original {
      margin: 0; min-width: max-content; color: #111; background: transparent;
      font-family: "Courier New", Courier, Consolas, monospace;
      font-size: 10.5px; font-weight: 400; line-height: 1.24;
      white-space: pre; tab-size: 8; letter-spacing: 0; text-align: left;
      font-variant-ligatures: none;
    }
    .pe-report-fade {
      position: absolute; left: 0; right: 0; bottom: 0; height: 72px; pointer-events: none;
      background: linear-gradient(to bottom, rgba(244,244,239,0), #f4f4ef 82%);
      transition: opacity .2s ease;
    }
    .pe-report-paper.is-expanded .pe-report-fade { opacity: 0; }

    .pe-report-toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 16px; background: #ecece7; border-top: 1px solid #d7d7d0;
      color: #555; font-size: 10px;
    }
    .pe-report-toolbar span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pe-report-toggle {
      flex: 0 0 auto; border: 1px solid #bfc3c8; border-radius: 8px; padding: 7px 10px;
      background: #fff; color: #1e2a35; font: 700 10px/1.1 Inter, ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    }
    .pe-report-toggle:hover { background: #f8fafc; }

    .pe-report-caption {
      display: flex; align-items: flex-start; gap: 11px; padding: 17px 20px 20px;
      border-top: 1px solid rgba(255,255,255,.07); background: #ffffff;
    }
    .pe-report-caption-icon {
      width: 32px; height: 32px; flex: 0 0 auto; display: grid; place-items: center;
      border-radius: 4px; color: #2563eb; background: #eff6ff;
      font-size: 14px; font-weight: 900;
    }
    .pe-report-caption strong { display: block; margin-bottom: 3px; color: var(--text,#f5f8fb); font-size: 13px; }
    .pe-report-caption p { margin: 0; color: var(--muted,#91a5b7); font-size: 11px; line-height: 1.55; }
    .pe-reports-note {
      max-width: 760px; margin: 24px auto 0; color: var(--muted,#91a5b7);
      font-size: 12px; line-height: 1.6; text-align: center;
    }

    @media (max-width: 1100px) {
      .pe-report-showcase { grid-template-columns: 1fr; }
      .pe-report-scroll { height: 470px; }
    }
    @media (max-width: 620px) {
      .pe-report-scroll { height: 390px; padding: 16px 12px 22px; }
      .pe-report-original { font-size: 9px; line-height: 1.22; }
      .pe-report-windowbar { padding: 0 12px; }
      .pe-report-kind { display: none; }
      .pe-report-toolbar { align-items: flex-start; flex-direction: column; }
      .pe-report-toggle { width: 100%; }
    }
  `;
  document.head.appendChild(styles);

  const reporteEconomico = `            Reporte de la Compañía IGUALES para el Período 

                   DECISIONES TOMADAS DEL PERIODO
                   ---------- ------- --- -------
Precio De Venta u$s     80    Ampliación Planta     		u$s      0
Marketing       u$s      0    Ped. Prestamo Bco NACION	u$s  80000
Nivel de Prod.  (%)     75    Dev. Prestamo Bco NACION	u$s      0
Inv. en Capac.  u$s      0    Ped. Prestamo Bco PROVINCIA	u$s  80000
Inv. en I & D   u$s      0    Dev. Prestamo Bco PROVINCIA	u$s      0
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        BALANCE EN u$s              ESTADO DE RESULTADO EN u$s
        ------- -- ---              ------ -- --------- -- ---
Efectivo             108416        Ventas                96000
                                   Costo Merc. Vend.     71962
Stock                     0        ---------------------------
                                   Margen Bruto          24038
Planta                80000        Subsidios              6000
---------------------------        Marketing                 0
Total Activo         188416        Mantenimiento           800
---------------------------        Capacitación              0
Prestamos Tomados    160000        I & D                     0
                                   Indemnizaciones           0
Ut. Acumuladas        28416        Mantenimiento Stock       0
                                   Intereses               534
Capital                   0        Penalidad                 0
                                   ---------------------------
---------------------------        Util. ante Imp.       28704
Pasivo+Patrimonio    188416        Impuestos Ganancias     288
                                   ---------------------------
                                   Util. del Período     28416
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                   INFORME PRIVADO DE LA EMPRESA
                   ------- ------- -- -- -------
  Reporte Producción              Reporte de Marketing en Unid.
  ------- ---------- ------- --   ------- -- --------- -- -----
Cap. de la Planta      1600        Ordenes Recibidas       1229
Producción             1200        Ventas realizadas       1200
Nivel Utilizado  (%)     75        Ordenes no realiz.        29
Prod. Costo/Unid.     59.97        Stock en Unidades          0
Empleados                60
Empleados Indemniz. 
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                      REPORTE DE CREDITOS
                      ------- -- --------
    Banco NACION	                     Banco PROVINCIA	
Máximo Crédito     u$s 100000        Máximo Crédito      u$s 100000
Tasa Interés Anual (%)  26.00        Tasa Interés Anual  (%)  35.00
Préstamos Tomados  u$s  80000        Préstamos Tomados   u$s  80000
Prést. Adicional   u$s      0        Prést. Adicional    u$s      0
                                     Giro en Descub.     u$s      0
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
DATOS PARA EL PERIODO 1
----- ---- -- ------- --
Capacitación Acumulada   u$s      0
Planta                   u$s  80000
Capacidad Producción (100%)    1600 unidades
I&D Acumulado            u$s      0`;
  const informeIndustrial = `            Informe Industrial de la Zona 1 para el Período 0

      UNIDADES                                               DOLARES
      --------                                               -------
Capacidad Total                       3200               Ingreso por vtas    u$s     192000
Total Producido                       2400               Precio Promedio     u$s         80
Total Ord. Recibidas                  2458               Costo Prod. Prom.   u$s      59.97
Total Vendido                         2400
Stock Total                              0

      PRODUCTIVIDAD                                          ECONOMIA
      -------------                                          --------
Cant. Empleados                        120               Banco NACION	
Ventas/Empleado     u$s               1600               *Préstamo Límite    u$s     100000
Capac. Prom. Utiliz.  %                 75               *Tasa Prima                   1.00
                                                         Banco PROVINCIA	
Inv. y des. acum.   u$s                  0               *Préstamo Límite    u$s     100000
                                                         *Tasa Prima                   1.00

Tasa de Mantenimiento %                  1               Limite Giro Desc.   u$s          1
Mantenim. de Stock  u$s                  1 c/u           Tasa Giro Desc. Anual %          3
Indemnización x Empleado               300               Tasa Imp. Ganancias   %          1
Valor de la Penalidad                  500

 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                              INFORME DE COMPETICION
                              ------- -- -----------
Nombre              Ventas     Precio     UnidVend     UtilPeri      UtilAcum    %Mercado Pos.
---------------    --------   --------    --------    ---------     ---------   --------- ----
Empresa 1             96000         80        1200        28416         28416         50    -
Empresa 2             96000         80        1200        28416         28416         50    -`;

  const escapar = (texto) => texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const reportCard = (titulo, tipo, archivo, texto, numero, captionTitle, captionText) => `
    <article class="pe-report-preview reveal">
      <div class="pe-report-windowbar">
        <div class="pe-report-windowbar-left">
          <div class="pe-report-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <strong>${titulo}</strong>
        </div>
        <span class="pe-report-kind">${tipo}</span>
      </div>
      <div class="pe-report-paper">
        <div class="pe-report-scroll">
          <pre class="pe-report-original">${escapar(texto)}</pre>
          <div class="pe-report-fade" aria-hidden="true"></div>
        </div>
        <div class="pe-report-toolbar">
          <span>${archivo} · formato real del simulador</span>
          <button class="pe-report-toggle" type="button" aria-expanded="false">Ver completo</button>
        </div>
      </div>
      <div class="pe-report-caption">
        <div class="pe-report-caption-icon">${numero}</div>
        <div><strong>${captionTitle}</strong><p>${captionText}</p></div>
      </div>
    </article>`;

  const section = document.createElement("section");
  section.className = "section section-alt pe-reports-section";
  section.id = "reportes";
  section.innerHTML = `
    <div class="container">
      <div class="pe-reports-heading reveal">
        <div class="eyebrow">Los mismos documentos que genera la partida</div>
        <h2>Así se ven los reportes dentro de Práctica Emprendedora.</h2>
        <p>
          Sin gráficos inventados ni resúmenes decorativos: la muestra conserva las columnas,
          títulos, separadores y alineación del formato utilizado en los reportes reales.
        </p>
      </div>
      <div class="pe-report-showcase">
        ${reportCard(
          "Reporte Económico · IGUALES", "Individual", "COMZONA1IGUALES.txt", reporteEconomico,
          "01", "Reporte Económico de la empresa", "Decisiones, balance, estado de resultados, producción, marketing, créditos y datos del próximo período."
        )}
        ${reportCard(
          "Informe Industrial · Zona 1", "Global", "INDZONA1IGUALES.txt", informeIndustrial,
          "02", "Informe Industrial del mercado", "Capacidad, producción, productividad, economía y comparación competitiva de todas las empresas."
        )}
      </div>
      <p class="pe-reports-note reveal">
        La vista previa usa ejemplos reales del formato de salida del simulador. Podés desplazarte horizontalmente en pantallas chicas o abrir cada documento completo.
      </p>
    </div>`;

  if (schoolSection) schoolSection.before(section);
  else main.appendChild(section);

  section.querySelectorAll(".pe-report-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const paper = button.closest(".pe-report-paper");
      const scroll = paper?.querySelector(".pe-report-scroll");
      if (!paper || !scroll) return;
      const expanded = !paper.classList.contains("is-expanded");
      paper.classList.toggle("is-expanded", expanded);
      scroll.classList.toggle("expanded", expanded);
      button.textContent = expanded ? "Reducir vista" : "Ver completo";
      button.setAttribute("aria-expanded", String(expanded));
      if (!expanded) scroll.scrollTop = 0;
    });
  });

  section.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
})();
