(() => {
  const cfg = window.PE_SUPABASE || {};
  const $ = (id) => document.getElementById(id);
  const authArea = $("authArea");
  const accountPanel = $("accountPanel");
  const noLicense = $("noLicense");
  const licenseTabs = $("licenseTabs");
  const adminTabButton = $("adminTabButton");
  const licenseTabButton = document.querySelector('[data-account-tab="license"]');
  const devicesTabButton = document.querySelector('[data-account-tab="devices"]');
  const params = new URLSearchParams(location.search);
  const requestedNext = params.get("next") || "";
  const requestedMode = params.get("mode") || "";
  const ADMIN_BUCKET = "admin-downloads";
  const ADMIN_INSTALLER = "PracticaEmprendedora-Admin-Setup.exe";

  let currentLicense = null;
  let currentProfile = null;
  let adminProfiles = [];
  let adminLicenses = [];
  let selectedAdminUserId = null;

  const publicKey = cfg.publishableKey || cfg.anonKey;
  if (!window.supabase || !cfg.url || !publicKey || cfg.url.includes("TU-PROYECTO")) {
    $("authMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
    $("signupMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
    return;
  }

  const sb = window.supabase.createClient(cfg.url, publicKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const fmtDate = (value) => {
    if (!value) return "Sin vencimiento";
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
  };

  const statusLabel = (status) => ({ active: "Activa", paused: "Pausada", revoked: "Revocada" }[status] || "Sin licencia");

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.setAttribute("aria-pressed", String(!visible));
      button.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
      button.classList.toggle("is-visible", !visible);
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    });
  });

  const switchTab = (name) => {
    document.querySelectorAll(".account-tab").forEach(b => b.classList.toggle("active", b.dataset.accountTab === name));
    document.querySelectorAll(".account-tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${name}`));
  };
  document.querySelectorAll("[data-account-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.accountTab)));

  async function downloadAdmin(button) {
    const original = button?.textContent || "Descargar PE Admin ↓";
    if (button) { button.disabled = true; button.textContent = "Preparando descarga…"; }
    const { data, error } = await sb.storage.from(ADMIN_BUCKET).createSignedUrl(ADMIN_INSTALLER, 120, { download: true });
    if (button) { button.disabled = false; button.textContent = original; }
    if (error || !data?.signedUrl) {
      alert("No se pudo preparar la descarga. Revisá el bucket privado 'admin-downloads' y el nombre del instalador.");
      console.error(error);
      return;
    }
    window.location.href = data.signedUrl;
  }

  async function loadDevices() {
    if (!currentLicense) return;
    const { data, error } = await sb.from("license_devices").select("*").eq("license_id", currentLicense.id).order("last_seen_at", { ascending: false });
    const box = $("devicesList");
    if (error) { box.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; return; }
    const devices = data || [];
    const active = devices.filter(d => !d.revoked).length;
    $("deviceLimit").textContent = `${active} / ${currentLicense.max_devices} activos`;
    $("licenseDevicesMetric").textContent = `${active} / ${currentLicense.max_devices}`;
    box.innerHTML = devices.length ? devices.map(d => `
      <article class="device-row ${d.revoked ? "revoked" : ""}">
        <div><strong>${escapeHtml(d.device_name || "Equipo")}</strong><span>${escapeHtml(d.installation_id)}</span><small>Última conexión: ${fmtDate(d.last_seen_at)}</small></div>
        <span class="device-state ${d.revoked ? "device-state-bad" : ""}">${d.revoked ? "Revocado" : "Activo"}</span>
      </article>`).join("") : `<p class="empty-state">Todavía no hay dispositivos vinculados.</p>`;
  }

  async function loadAdminDevices(license) {
    const box = $("adminDevicesList");
    if (!box) return;
    if (!license) {
      box.innerHTML = `<div class="admin-inline-empty"><span>○</span><div><strong>Sin dispositivos</strong><p>Primero asigná una licencia a este email.</p></div></div>`;
      return;
    }
    const { data, error } = await sb.from("license_devices").select("*").eq("license_id", license.id).order("last_seen_at", { ascending: false });
    if (error) { box.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; return; }
    const devices = data || [];
    box.innerHTML = devices.length ? devices.map(d => `
      <article class="device-row ${d.revoked ? "revoked" : ""}">
        <div><strong>${escapeHtml(d.device_name || "Equipo")}</strong><span>${escapeHtml(d.installation_id)}</span><small>Última conexión: ${fmtDate(d.last_seen_at)}</small></div>
        <div class="device-admin-actions">
          <span class="device-state ${d.revoked ? "device-state-bad" : ""}">${d.revoked ? "Revocado" : "Activo"}</span>
          <button type="button" class="${d.revoked ? "account-secondary-btn" : "account-danger-btn"}" data-device-id="${d.id}" data-device-action="${d.revoked ? "release" : "revoke"}">${d.revoked ? "Liberar" : "Revocar"}</button>
        </div>
      </article>`).join("") : `<div class="admin-inline-empty"><span>○</span><div><strong>Todavía no hay equipos</strong><p>Se agregarán cuando el usuario inicie sesión en PE Admin.</p></div></div>`;

    box.querySelectorAll("[data-device-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.deviceId;
        const action = button.dataset.deviceAction;
        button.disabled = true;
        const result = action === "revoke"
          ? await sb.from("license_devices").update({ revoked: true }).eq("id", id)
          : await sb.from("license_devices").delete().eq("id", id);
        $("adminMessage").textContent = result.error ? result.error.message : (action === "revoke" ? "Dispositivo revocado ✓" : "Dispositivo liberado ✓");
        if (!result.error) await loadAdminDevices(license);
        else button.disabled = false;
      });
    });
  }

  function licenseForUser(userId) {
    return adminLicenses.find(l => l.user_id === userId) || null;
  }

  function renderAdminStats() {
    const now = Date.now();
    const in30 = now + 30 * 24 * 60 * 60 * 1000;
    const active = adminLicenses.filter(l => l.status === "active" && (!l.expires_at || new Date(l.expires_at).getTime() >= now)).length;
    const licensedIds = new Set(adminLicenses.map(l => l.user_id));
    const expiring = adminLicenses.filter(l => l.status === "active" && l.expires_at && new Date(l.expires_at).getTime() >= now && new Date(l.expires_at).getTime() <= in30).length;
    $("adminStatUsers").textContent = adminProfiles.length;
    $("adminStatActive").textContent = active;
    $("adminStatUnlicensed").textContent = adminProfiles.filter(p => !licensedIds.has(p.id)).length;
    $("adminStatExpiring").textContent = expiring;
    $("adminUserCount").textContent = adminProfiles.length;
  }

  function renderAdminUsers(filter = "") {
    const query = filter.trim().toLocaleLowerCase("es");
    const rows = adminProfiles.filter(u => {
      const hay = `${u.email || ""} ${u.display_name || ""}`.toLocaleLowerCase("es");
      return !query || hay.includes(query);
    });
    const box = $("adminUsersList");
    box.innerHTML = rows.length ? rows.map(u => {
      const lic = licenseForUser(u.id);
      const status = lic ? statusLabel(lic.status) : "Sin licencia";
      const cls = lic?.status === "active" ? "good" : lic ? "warn" : "none";
      return `<button type="button" class="admin-user-item ${u.id === selectedAdminUserId ? "selected" : ""}" data-admin-user-id="${u.id}">
        <span class="admin-user-avatar">${escapeHtml((u.email || "?").slice(0,1).toUpperCase())}</span>
        <span class="admin-user-copy"><strong>${escapeHtml(u.email || u.id)}</strong><small>${escapeHtml(u.display_name || (u.role === "admin" ? "Administrador" : "Cuenta registrada"))}</small></span>
        <span class="admin-user-status ${cls}">${status}</span>
      </button>`;
    }).join("") : `<p class="empty-state admin-search-empty">No encontré cuentas con esa búsqueda.</p>`;

    box.querySelectorAll("[data-admin-user-id]").forEach(button => {
      button.addEventListener("click", () => selectAdminUser(button.dataset.adminUserId));
    });
  }

  async function selectAdminUser(userId) {
    selectedAdminUserId = userId;
    renderAdminUsers($("adminUserSearch").value);
    const user = adminProfiles.find(u => u.id === userId);
    const lic = licenseForUser(userId);
    if (!user) return;

    $("adminEmptySelection").classList.add("hidden");
    $("adminEditorContent").classList.remove("hidden");
    $("adminSelectedEmail").textContent = user.email || user.id;
    $("adminSelectedName").textContent = user.display_name || (user.role === "admin" ? "Administrador del sistema" : "Cuenta registrada");
    $("adminSelectedLicenseState").textContent = lic ? statusLabel(lic.status) : "Sin licencia";
    $("adminSelectedLicenseState").className = `admin-state-chip ${lic?.status === "active" ? "good" : lic ? "warn" : "none"}`;
    $("adminCustomer").value = lic?.customer || user.display_name || "";
    $("adminPlan").value = lic?.plan || "PE Admin";
    $("adminStatus").value = lic?.status || "active";
    $("adminMaxDevices").value = lic?.max_devices || 1;
    $("adminExpiry").value = lic?.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 16) : "";
    $("deleteLicense").disabled = !lic;
    $("adminMessage").textContent = "";
    await loadAdminDevices(lic);
  }

  async function loadAdmin() {
    if (currentProfile?.role !== "admin") return;
    const [{ data: profiles, error: profilesError }, { data: licenses, error: licensesError }] = await Promise.all([
      sb.from("profiles").select("id,email,display_name,role,created_at").order("email"),
      sb.from("licenses").select("*").order("created_at", { ascending: false })
    ]);
    if (profilesError || licensesError) {
      $("adminMessage").textContent = profilesError?.message || licensesError?.message || "No se pudo cargar el panel.";
      return;
    }
    adminProfiles = profiles || [];
    adminLicenses = licenses || [];
    renderAdminStats();
    renderAdminUsers($("adminUserSearch").value);

    if (selectedAdminUserId && adminProfiles.some(u => u.id === selectedAdminUserId)) {
      await selectAdminUser(selectedAdminUserId);
    } else if (adminProfiles.length) {
      await selectAdminUser(adminProfiles[0].id);
    }
  }

  async function loadAccount(session) {
    const user = session?.user;
    if (!user) {
      authArea.classList.remove("hidden");
      accountPanel.classList.add("hidden");
      if (requestedMode === "signup") setTimeout(() => $("registerCard")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      return;
    }

    authArea.classList.add("hidden");
    accountPanel.classList.remove("hidden");
    $("accountEmail").textContent = user.email;
    $("noLicenseEmail").textContent = user.email;
    $("pendingDownloadCard").classList.toggle("hidden", requestedNext !== "admin-download");

    const [{ data: profile }, { data: license, error }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      sb.from("licenses").select("*").eq("user_id", user.id).maybeSingle()
    ]);
    currentProfile = profile;
    currentLicense = license;
    if (error) console.error(error);

    const isAdmin = profile?.role === "admin";
    adminTabButton.classList.toggle("hidden", !isAdmin);

    if (!license) {
      noLicense.classList.remove("hidden");
      if (isAdmin) {
        licenseTabs.classList.remove("hidden");
        licenseTabButton?.classList.add("hidden");
        devicesTabButton?.classList.add("hidden");
        switchTab("admin");
        await loadAdmin();
      } else {
        licenseTabs.classList.add("hidden");
      }
      return;
    }

    noLicense.classList.add("hidden");
    licenseTabs.classList.remove("hidden");
    licenseTabButton?.classList.remove("hidden");
    devicesTabButton?.classList.remove("hidden");
    switchTab("license");
    $("licenseCustomer").textContent = license.customer;
    $("licensePlan").textContent = license.plan;
    $("licenseExpiry").textContent = fmtDate(license.expires_at);
    $("licenseStatusMetric").textContent = statusLabel(license.status);
    $("licenseBadge").textContent = statusLabel(license.status).toUpperCase();
    $("licenseBadge").classList.toggle("bad", license.status !== "active");
    await loadDevices();
    if (isAdmin) await loadAdmin();
  }

  $("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("signupEmail").value.trim().toLowerCase();
    const password = $("signupPassword").value;
    const password2 = $("signupPassword2").value;
    const displayName = $("signupName").value.trim();
    if (password !== password2) { $("signupMessage").textContent = "Las contraseñas no coinciden."; return; }
    if (password.length < 8) { $("signupMessage").textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
    $("signupMessage").classList.remove("success");
    $("signupMessage").textContent = "Creando tu cuenta…";

    const redirectUrl = requestedNext
      ? `${location.origin}${location.pathname}?next=${encodeURIComponent(requestedNext)}`
      : `${location.origin}${location.pathname}`;
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: redirectUrl }
    });
    if (error) { $("signupMessage").textContent = error.message; return; }

    $("signupMessage").classList.add("success");
    if (data.session) {
      $("signupMessage").textContent = "Cuenta creada ✓";
      await loadAccount(data.session);
    } else {
      $("signupMessage").textContent = "Cuenta creada. Revisá tu email y confirmalo para continuar con la descarga.";
    }
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("authMessage").classList.remove("success");
    $("authMessage").textContent = "Ingresando…";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPassword").value });
    if (error) { $("authMessage").textContent = error.message; return; }
    $("authMessage").textContent = "";
    await loadAccount(data.session);
  });

  $("downloadAdminFromAccount").addEventListener("click", (e) => downloadAdmin(e.currentTarget));
  $("logoutButton").addEventListener("click", async () => { await sb.auth.signOut(); location.href = "cuenta.html"; });
  $("refreshAdmin").addEventListener("click", loadAdmin);
  $("adminUserSearch").addEventListener("input", (e) => renderAdminUsers(e.target.value));

  $("saveLicense").addEventListener("click", async () => {
    if (!selectedAdminUserId) return;
    const payload = {
      user_id: selectedAdminUserId,
      customer: $("adminCustomer").value.trim() || "Licencia Práctica Emprendedora",
      plan: $("adminPlan").value.trim() || "PE Admin",
      status: $("adminStatus").value,
      max_devices: Number($("adminMaxDevices").value || 1),
      expires_at: $("adminExpiry").value ? new Date($("adminExpiry").value).toISOString() : null,
      updated_at: new Date().toISOString()
    };
    $("adminMessage").classList.remove("success");
    $("adminMessage").textContent = "Guardando…";
    const { error } = await sb.from("licenses").upsert(payload, { onConflict: "user_id" });
    $("adminMessage").classList.toggle("success", !error);
    $("adminMessage").textContent = error ? error.message : "Licencia guardada ✓";
    if (!error) await loadAdmin();
  });

  $("deleteLicense").addEventListener("click", async () => {
    if (!selectedAdminUserId) return;
    if (!confirm("¿Eliminar la licencia de este usuario? La cuenta seguirá existiendo.")) return;
    const { error } = await sb.from("licenses").delete().eq("user_id", selectedAdminUserId);
    $("adminMessage").classList.toggle("success", !error);
    $("adminMessage").textContent = error ? error.message : "Licencia eliminada.";
    if (!error) await loadAdmin();
  });

  sb.auth.getSession().then(({ data }) => loadAccount(data.session));
  sb.auth.onAuthStateChange((_event, session) => loadAccount(session));
})();
