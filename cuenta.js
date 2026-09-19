(() => {
  const cfg = window.PE_SUPABASE || {};
  const $ = (id) => document.getElementById(id);
  const authArea = $("authArea");
  const accountPanel = $("accountPanel");
  const forgotPasswordArea = $("forgotPasswordArea");
  const verifyOtpArea = $("verifyOtpArea");
  const resetPasswordArea = $("resetPasswordArea");
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
  const MIN_PASSWORD_LENGTH = 10;

  let currentLicense = null;
  let currentProfile = null;
  let adminProfiles = [];
  let adminLicenses = [];
  let selectedAdminUserId = null;
  let recoveryActive = requestedMode === "recovery";
  let recoverySessionReady = false;
  let recoveryEmail = sessionStorage.getItem("pe_recovery_email") || "";

  function setAuthMode(mode = "login", { updateUrl = false } = {}) {
    const next = mode === "signup" ? "signup" : "login";
    document.documentElement.dataset.authMode = next;
    if (updateUrl) {
      const url = new URL(location.href);
      if (next === "signup") url.searchParams.set("mode", "signup");
      else url.searchParams.delete("mode");
      history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setTimeout(() => {
      const target = next === "signup" ? $("signupEmail") : $("loginEmail");
      target?.focus();
    }, 30);
  }

  document.querySelectorAll("[data-auth-switch]").forEach(button => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authSwitch, { updateUrl: true }));
  });

  const publicKey = cfg.publishableKey || cfg.anonKey;
  if (!window.supabase || !cfg.url || !publicKey || cfg.url.includes("TU-PROYECTO")) {
    $("authMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
    $("signupMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
    if ($("forgotPasswordMessage")) $("forgotPasswordMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
    if ($("resetPasswordMessage")) $("resetPasswordMessage").textContent = "Falta configurar Supabase en supabase-config.js.";
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

  function setPasswordVisibility(button) {
    const input = $(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.classList.toggle("is-visible", !showing);
    button.setAttribute("aria-pressed", String(!showing));
    button.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
  }

  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => setPasswordVisibility(button));
  });

  function hideRecoveryAreas() {
    forgotPasswordArea?.classList.add("hidden");
    verifyOtpArea?.classList.add("hidden");
    resetPasswordArea?.classList.add("hidden");
  }

  function showAuthChoice(mode = "login") {
    recoveryActive = false;
    recoverySessionReady = false;
    hideRecoveryAreas();
    accountPanel.classList.add("hidden");
    authArea.classList.remove("hidden");
    setAuthMode(mode);
    const email = $("forgotEmail")?.value?.trim();
    if (email && !$("loginEmail").value) $("loginEmail").value = email;
  }

  function showForgotPassword() {
    recoveryActive = false;
    recoverySessionReady = false;
    authArea.classList.add("hidden");
    accountPanel.classList.add("hidden");
    verifyOtpArea?.classList.add("hidden");
    resetPasswordArea?.classList.add("hidden");
    forgotPasswordArea?.classList.remove("hidden");
    const loginEmail = $("loginEmail")?.value?.trim();
    if (loginEmail && !$("forgotEmail").value) $("forgotEmail").value = loginEmail;
    setTimeout(() => $("forgotEmail")?.focus(), 30);
  }

  function showVerifyOtp(email = recoveryEmail) {
    recoveryActive = false;
    recoverySessionReady = false;
    recoveryEmail = String(email || "").trim().toLowerCase();
    if (recoveryEmail) sessionStorage.setItem("pe_recovery_email", recoveryEmail);
    authArea.classList.add("hidden");
    accountPanel.classList.add("hidden");
    forgotPasswordArea?.classList.add("hidden");
    resetPasswordArea?.classList.add("hidden");
    verifyOtpArea?.classList.remove("hidden");
    if ($("recoveryEmailLabel")) $("recoveryEmailLabel").textContent = recoveryEmail || "Email de recuperación";
    if ($("verifyOtpMessage")) {
      $("verifyOtpMessage").classList.remove("success");
      $("verifyOtpMessage").textContent = "Ingresá el código que recibiste por email.";
    }
    setTimeout(() => $("recoveryOtp")?.focus(), 30);
  }

  function showResetPassword(sessionReady = false) {
    recoveryActive = true;
    recoverySessionReady = Boolean(sessionReady);
    authArea.classList.add("hidden");
    accountPanel.classList.add("hidden");
    forgotPasswordArea?.classList.add("hidden");
    verifyOtpArea?.classList.add("hidden");
    resetPasswordArea?.classList.remove("hidden");
    const form = $("resetPasswordForm");
    const button = $("saveNewPasswordButton");
    if (form) form.classList.toggle("recovery-waiting", !sessionReady);
    if (button) button.disabled = !sessionReady;
    if ($("resetPasswordMessage")) {
      $("resetPasswordMessage").classList.remove("success");
      $("resetPasswordMessage").textContent = sessionReady
        ? "Identidad verificada. Elegí una contraseña nueva."
        : "Validando la recuperación…";
    }
    if (sessionReady) setTimeout(() => $("resetPassword")?.focus(), 30);
  }

  const switchTab = (name) => {
    document.querySelectorAll(".account-tab").forEach(b => b.classList.toggle("active", b.dataset.accountTab === name));
    document.querySelectorAll(".account-tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${name}`));
  };
  document.querySelectorAll("[data-account-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.accountTab)));

  async function resolveAdminInstaller() {
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData?.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

    const storage = sb.storage.from(ADMIN_BUCKET);
    const { data: files, error: listError } = await storage.list("", {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" }
    });
    if (listError) throw new Error(`No se pudo acceder a la descarga privada: ${listError.message}`);

    const available = (files || []).filter(file => file?.name && !file.name.endsWith("/"));
    const exact = available.find(file => file.name === ADMIN_INSTALLER);
    const exe = available.find(file => /\.exe$/i.test(file.name));
    const selected = exact || exe;
    if (!selected) {
      throw new Error(`No encontré ningún instalador .exe dentro del bucket privado "${ADMIN_BUCKET}".`);
    }
    return selected.name;
  }

  function launchSignedDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
  }

  async function downloadAdmin(button) {
    const original = button?.textContent || "Descargar PE Admin ↓";
    if (button) { button.disabled = true; button.textContent = "Preparando descarga…"; }
    try {
      const installerPath = await resolveAdminInstaller();
      const { data, error } = await sb.storage
        .from(ADMIN_BUCKET)
        .createSignedUrl(installerPath, 180, { download: true });
      const signedUrl = data?.signedUrl || data?.signedURL;
      if (error || !signedUrl) throw new Error(error?.message || "Supabase no devolvió una URL de descarga.");
      launchSignedDownload(signedUrl, installerPath);
    } catch (error) {
      console.error("PE Admin download error:", error);
      alert(error?.message || "No se pudo descargar PE Admin.");
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
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

    if (recoveryActive) {
      showResetPassword(Boolean(user));
      return;
    }

    if (!user) {
      hideRecoveryAreas();
      authArea.classList.remove("hidden");
      accountPanel.classList.add("hidden");
      setAuthMode(requestedMode === "signup" ? "signup" : "login");
      if (params.get("reset") === "success") {
        $("authMessage").classList.add("success");
        $("authMessage").textContent = "Contraseña actualizada. Iniciá sesión con tu nueva contraseña.";
      }
      return;
    }

    hideRecoveryAreas();
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
    if (password.length < MIN_PASSWORD_LENGTH) { $("signupMessage").textContent = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`; return; }
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

  $("forgotPasswordButton").addEventListener("click", showForgotPassword);
  $("backToLoginButton").addEventListener("click", () => showAuthChoice("login"));
  $("changeRecoveryEmailButton")?.addEventListener("click", () => {
    if ($("forgotEmail") && recoveryEmail) $("forgotEmail").value = recoveryEmail;
    showForgotPassword();
  });

  async function requestRecoveryCode(email, { showGeneric = true } = {}) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Ingresá un email válido.");
    const redirectTo = `${location.origin}${location.pathname}?mode=forgot`;
    const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    if (error && (error.status === 429 || String(error.message || "").toLowerCase().includes("rate"))) {
      throw new Error("Se hicieron demasiados intentos. Esperá un minuto antes de volver a pedir el código.");
    }
    if (error) {
      console.error("Password recovery error:", error);
      throw new Error(showGeneric ? "No pudimos enviar el código en este momento. Intentá nuevamente en unos minutos." : error.message);
    }
    recoveryEmail = cleanEmail;
    sessionStorage.setItem("pe_recovery_email", recoveryEmail);
    return cleanEmail;
  }

  $("forgotPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("forgotEmail").value.trim().toLowerCase();
    const button = $("sendRecoveryButton");
    const message = $("forgotPasswordMessage");
    button.disabled = true;
    message.classList.remove("success");
    message.textContent = "Enviando código…";
    try {
      await requestRecoveryCode(email);
      message.classList.add("success");
      message.textContent = "Si existe una cuenta con ese email, el código fue enviado. Revisá también Spam.";
      setTimeout(() => showVerifyOtp(email), 350);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $("resendRecoveryButton")?.addEventListener("click", async () => {
    const button = $("resendRecoveryButton");
    const message = $("verifyOtpMessage");
    if (!recoveryEmail) { showForgotPassword(); return; }
    button.disabled = true;
    message.classList.remove("success");
    message.textContent = "Reenviando código…";
    try {
      await requestRecoveryCode(recoveryEmail);
      message.classList.add("success");
      message.textContent = "Código reenviado. Usá siempre el último que recibiste.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $("verifyOtpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = String($("recoveryOtp")?.value || "").replace(/\s+/g, "");
    const button = $("verifyOtpButton");
    const message = $("verifyOtpMessage");
    if (!recoveryEmail) { showForgotPassword(); return; }
    if (!/^\d{4,12}$/.test(token)) {
      message.textContent = "Ingresá el código numérico que recibiste por email.";
      return;
    }
    button.disabled = true;
    message.classList.remove("success");
    message.textContent = "Verificando código…";
    const { data, error } = await sb.auth.verifyOtp({
      email: recoveryEmail,
      token,
      type: "recovery"
    });
    button.disabled = false;
    if (error || !data?.session) {
      console.error("Recovery OTP error:", error);
      message.textContent = "El código no es válido o venció. Pedí uno nuevo e ingresá siempre el último.";
      return;
    }
    sessionStorage.removeItem("pe_recovery_email");
    recoveryActive = true;
    recoverySessionReady = true;
    message.classList.add("success");
    message.textContent = "Código correcto ✓";
    setTimeout(() => showResetPassword(true), 300);
  });

  $("resetPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("resetPassword").value;
    const password2 = $("resetPassword2").value;
    const message = $("resetPasswordMessage");
    const button = $("saveNewPasswordButton");

    message.classList.remove("success");
    if (!recoverySessionReady) {
      message.textContent = "La verificación venció. Volvé a solicitar un código nuevo.";
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      message.textContent = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
      return;
    }
    if (password !== password2) {
      message.textContent = "Las contraseñas no coinciden.";
      return;
    }

    button.disabled = true;
    message.textContent = "Guardando la contraseña nueva…";
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      button.disabled = false;
      message.textContent = error.message || "No se pudo cambiar la contraseña.";
      return;
    }

    // Después de una recuperación cerramos TODAS las sesiones para que un
    // refresh token robado anteriormente deje de servir.
    await sb.auth.signOut({ scope: "global" });
    message.classList.add("success");
    message.textContent = "Contraseña actualizada ✓ Redirigiendo al inicio de sesión…";
    setTimeout(() => { location.href = "cuenta.html?reset=success"; }, 900);
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
  $("logoutButton").addEventListener("click", async () => { await sb.auth.signOut({ scope: "local" }); location.href = "cuenta.html"; });
  $("refreshAdmin").addEventListener("click", loadAdmin);
  $("adminUserSearch").addEventListener("input", (e) => renderAdminUsers(e.target.value));

  $("saveLicense").addEventListener("click", async () => {
    if (!selectedAdminUserId) return;
    const payload = {
      user_id: selectedAdminUserId,
      customer: $("adminCustomer").value.trim() || "Licencia Práctica Emprendedora",
      plan: "PE Admin",
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

  sb.auth.getSession().then(({ data }) => {
    if (requestedMode === "forgot") {
      if (recoveryEmail) showVerifyOtp(recoveryEmail);
      else showForgotPassword();
      return;
    }
    if (requestedMode === "recovery") {
      recoveryActive = true;
      recoverySessionReady = Boolean(data.session);
      showResetPassword(recoverySessionReady);
      return;
    }
    loadAccount(data.session);
  });

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryActive = true;
      recoverySessionReady = Boolean(session);
      setTimeout(() => showResetPassword(recoverySessionReady), 0);
      return;
    }
    if (recoveryActive) return;
    setTimeout(() => loadAccount(session), 0);
  });
})();
