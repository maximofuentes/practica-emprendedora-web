(() => {
  // Este archivo puede terminar cargándose más de una vez (por ejemplo si una
  // página incluye site-auth.js en dos bloques). Este guard evita inicializar
  // dos observadores de sesión y, por lo tanto, duplicar el avatar.
  if (window.__PE_SITE_AUTH_INITIALIZED__) return;
  window.__PE_SITE_AUTH_INITIALIZED__ = true;

  const cfg = window.PE_SUPABASE || {};
  const publicKey = cfg.publishableKey || cfg.anonKey;
  const ADMIN_BUCKET = "admin-downloads";
  const ADMIN_INSTALLER = "PracticaEmprendedora-Admin-Setup.exe";

  if (!window.supabase || !cfg.url || !publicKey || cfg.url.includes("TU-PROYECTO")) return;

  const sb = window.supabase.createClient(cfg.url, publicKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Los eventos de Supabase pueden dispararse casi al mismo tiempo que la
  // carga inicial. Antes, dos refreshUI() podían esperar consultas distintas y
  // ambos terminar agregando un avatar. El contador invalida renders viejos.
  let profileRenderGeneration = 0;
  let refreshGeneration = 0;
  let profileEventsController = null;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function currentSession() {
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }

  function validAvatarUrl(user) {
    const candidate = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
    return /^https?:\/\//i.test(candidate) ? candidate : "";
  }

  function avatarMarkup(user) {
    const email = user?.email || "Cuenta";
    const initial = (email.trim().charAt(0) || "@").toUpperCase();
    const avatar = validAvatarUrl(user);
    if (avatar) {
      return `<img class="pe-profile-avatar-img" src="${esc(avatar)}" alt="Perfil de ${esc(email)}" referrerpolicy="no-referrer" />`;
    }
    return `<span class="pe-profile-avatar-fallback" aria-hidden="true">${esc(initial)}</span>`;
  }

  function removeProfileMenu() {
    document.querySelectorAll("[data-pe-profile-menu], #peProfileMenuRoot").forEach(el => el.remove());
    if (profileEventsController) {
      profileEventsController.abort();
      profileEventsController = null;
    }
  }

  function hideGuestActions(signedIn) {
    document.documentElement.dataset.peAuth = signedIn ? "signed-in" : "guest";

    document.querySelectorAll('[data-auth-account-label]').forEach(el => {
      el.hidden = signedIn;
      if (!signedIn) el.textContent = "Ingresar";
    });

    document.querySelectorAll('a[href*="mode=signup"], .nav-cta-account, .account-top-cta').forEach(el => {
      el.hidden = signedIn;
      el.setAttribute("aria-hidden", String(signedIn));
      if (signedIn) el.setAttribute("tabindex", "-1");
      else el.removeAttribute("tabindex");
    });
  }

  async function loadAccountSummary(user) {
    const [{ data: profile }, { data: license }] = await Promise.all([
      sb.from("profiles").select("role,display_name").eq("id", user.id).maybeSingle(),
      sb.from("licenses").select("status,plan,customer,expires_at").eq("user_id", user.id).maybeSingle()
    ]);
    return { profile: profile || null, license: license || null };
  }

  function statusText(license) {
    if (!license) return "Sin licencia";
    const map = { active: "Licencia activa", paused: "Licencia pausada", revoked: "Licencia revocada" };
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return "Licencia vencida";
    return map[license.status] || "Licencia asignada";
  }

  function findProfileContainer() {
    return document.querySelector(".download-nav-actions") || document.querySelector(".nav-links") || document.querySelector(".nav-wrap");
  }

  async function renderProfileMenu(session, expectedRefreshGeneration) {
    const renderGeneration = ++profileRenderGeneration;
    const user = session?.user;
    if (!user) {
      removeProfileMenu();
      return;
    }

    // Esperamos la información de cuenta SIN tocar todavía el DOM. Si durante
    // esta espera cambió la sesión o comenzó otro refresh, este render se tira.
    const { profile, license } = await loadAccountSummary(user);
    if (
      renderGeneration !== profileRenderGeneration ||
      expectedRefreshGeneration !== refreshGeneration
    ) return;

    const latestSession = await currentSession();
    if (
      renderGeneration !== profileRenderGeneration ||
      expectedRefreshGeneration !== refreshGeneration ||
      !latestSession?.user ||
      latestSession.user.id !== user.id
    ) return;

    const container = findProfileContainer();
    if (!container) return;

    // Justo antes de insertar hacemos una limpieza final. Además usamos un ID
    // único para que el DOM nunca pueda conservar más de un menú de perfil.
    removeProfileMenu();

    const wrap = document.createElement("div");
    wrap.id = "peProfileMenuRoot";
    wrap.className = "pe-profile-menu";
    wrap.dataset.peProfileMenu = "";
    wrap.innerHTML = `
      <button class="pe-profile-button" type="button" aria-haspopup="menu" aria-expanded="false" title="${esc(user.email || "Mi cuenta")}">
        <span class="pe-profile-avatar">${avatarMarkup(user)}</span>
      </button>
      <div class="pe-profile-dropdown" role="menu" hidden>
        <div class="pe-profile-summary">
          <span class="pe-profile-avatar pe-profile-avatar-large">${avatarMarkup(user)}</span>
          <div>
            <strong>${esc(profile?.display_name || user.email || "Mi cuenta")}</strong>
            <span>${esc(user.email || "")}</span>
          </div>
        </div>
        <div class="pe-profile-license ${license?.status === "active" ? "good" : ""}">
          <span>${esc(statusText(license))}</span>
          <strong>${esc(license?.plan || "PE Admin")}</strong>
        </div>
        <a class="pe-profile-action" role="menuitem" href="cuenta.html#licenseTabs">
          <span>Licencia y cuenta</span><b>→</b>
        </a>
        <button class="pe-profile-action pe-profile-logout" type="button" role="menuitem" data-pe-signout>
          <span>Cerrar sesión</span><b>↗</b>
        </button>
      </div>`;

    container.appendChild(wrap);
    const button = wrap.querySelector(".pe-profile-button");
    const dropdown = wrap.querySelector(".pe-profile-dropdown");
    profileEventsController = new AbortController();
    const { signal } = profileEventsController;

    const close = () => {
      if (!wrap.isConnected) return;
      dropdown.hidden = true;
      button.setAttribute("aria-expanded", "false");
      wrap.classList.remove("open");
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = dropdown.hidden;
      dropdown.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      wrap.classList.toggle("open", opening);
    }, { signal });

    wrap.querySelector("[data-pe-signout]").addEventListener("click", async () => {
      const signout = wrap.querySelector("[data-pe-signout]");
      signout.disabled = true;
      signout.querySelector("span").textContent = "Cerrando…";
      await sb.auth.signOut();
      window.location.href = "index.html";
    }, { signal });

    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) close();
    }, { capture: true, signal });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    }, { signal });
  }

  async function downloadAdmin(button) {
    const session = await currentSession();
    if (!session) {
      const target = encodeURIComponent("admin-download");
      window.location.href = `cuenta.html?mode=signup&next=${target}`;
      return;
    }

    const original = button?.textContent || "Descargar Admin";
    if (button) {
      button.disabled = true;
      button.textContent = "Preparando descarga…";
    }

    const { data, error } = await sb.storage
      .from(ADMIN_BUCKET)
      .createSignedUrl(ADMIN_INSTALLER, 120, { download: true });

    if (button) {
      button.disabled = false;
      button.textContent = original;
    }

    if (error || !data?.signedUrl) {
      alert("No se pudo preparar la descarga de PE Admin. Revisá que el instalador esté subido al bucket privado 'admin-downloads'.");
      console.error(error);
      return;
    }
    window.location.href = data.signedUrl;
  }

  async function refreshUI() {
    const myGeneration = ++refreshGeneration;
    const session = await currentSession();
    if (myGeneration !== refreshGeneration) return;

    hideGuestActions(Boolean(session));

    document.querySelectorAll("[data-admin-download]").forEach(button => {
      const guest = button.dataset.guestLabel || "Crear cuenta para descargar";
      const logged = button.dataset.loggedLabel || "Descargar Admin";
      button.textContent = session ? logged : guest;
      button.classList.toggle("is-authenticated", Boolean(session));
    });

    document.querySelectorAll("[data-auth-email]").forEach(el => {
      el.textContent = session?.user?.email || "";
      el.classList.toggle("hidden", !session);
    });

    if (session) await renderProfileMenu(session, myGeneration);
    else {
      profileRenderGeneration++;
      removeProfileMenu();
    }
  }

  document.querySelectorAll("[data-admin-download]").forEach(button => {
    button.addEventListener("click", () => downloadAdmin(button));
  });

  refreshUI();
  sb.auth.onAuthStateChange(() => refreshUI());
})();
