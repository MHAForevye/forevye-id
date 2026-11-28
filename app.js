/* FOREVYE ID — arayüz */
(function () {
  const { api, scopeText, validateUsername, validatePassword, sniffImage, EMAIL_RE, config: C } = window.FID;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (t) => (t ? new Date(t).toLocaleString("tr-TR") : "—");
  const app = (html) => { $("#app").innerHTML = html; };
  /* SVG ikon seti — 24px ızgara, 1.75 kontur */
  const ICO = {
    profile: '<circle cx="12" cy="8.5" r="3.75"/><path d="M4.75 19.5c1.2-3.3 4-5 7.25-5s6.05 1.7 7.25 5"/>',
    security: '<path d="M12 3.25 5 6v5.6c0 4.4 3 8 7 9.15 4-1.15 7-4.75 7-9.15V6l-7-2.75Z"/><path d="m9.25 12.25 1.9 1.9 3.6-3.9"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.75h5V7M6.5 7l.8 12.25h9.4L17.5 7M10.25 10.75v5M13.75 10.75v5"/>',
    logout: '<path d="M14.5 4.75H18a1.25 1.25 0 0 1 1.25 1.25v12A1.25 1.25 0 0 1 18 19.25h-3.5M10 8l-4 4 4 4M6 12h9"/>',
    alert: '<path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 10v4M12 16.75v.01"/>'
  };
  const icon = (n, cls) => `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
  const LOGO = `<span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M10 7.5h12.5M10 7.5v17M10 15.5h9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="23" cy="23" r="2.1" fill="currentColor"/></svg></span>`;
  let user = null;
  const ctx = {};
  let lastMail = 0;
  let serverState = { state: C.MOCK ? "demo" : "checking" };

  function renderServerStatus(state) {
    serverState = state || serverState;
    const host = $("#connection-status");
    if (!host) return;
    if (C.MOCK) { host.hidden = true; return; }
    const s = serverState;
    const cls = s.state === "online" ? "online" : s.state === "degraded" ? "degraded" : s.state === "offline" ? "offline" : "checking";
    const label = cls === "online" ? "Kimlik sunucusu erişilebilir" : cls === "degraded" ? "Sunucu yanıt veriyor ancak hata döndürüyor" : cls === "offline" ? "Kimlik sunucusuna bağlantı yok" : "Kimlik sunucusu kontrol ediliyor";
    const extra = s.state === "offline"
      ? `<small>${esc(s.message || "Worker adresi, DNS ve CORS ayarlarını kontrol edin.")}</small>`
      : s.state === "degraded"
        ? `<small>HTTP ${esc(s.status || "5xx")} · ${esc(s.message || "Identity API rotası yanıt vermedi.")}</small>`
        : s.state === "online"
          ? `<small>GET /identity/profile · HTTP ${esc(s.status)}${s.status === 401 || s.status === 403 ? " · API açık, oturum gerekiyor" : ""} · ${esc(s.latencyMs)} ms</small>`
          : `<small>${esc(C.API_BASE)} · /identity/profile</small>`;
    host.hidden = false;
    host.innerHTML = `<div class="connection-pill ${cls}"><span class="connection-dot"></span><span class="connection-copy"><b>${label}</b>${extra}</span><button type="button" class="btn sm" data-server-check>Bağlantıyı sına</button></div>`;
  }
  async function checkServer() {
    if (C.MOCK || !api.health) return;
    renderServerStatus({ state: "checking" });
    const result = await api.health();
    if (result.mode === "mock") return;
    if (!result.reachable) renderServerStatus({ state: "offline", message: result.message });
    else if (!result.healthy) renderServerStatus({ state: "degraded", status: result.status, message: result.message });
    else renderServerStatus({ state: "online", status: result.status, latencyMs: result.latencyMs });
  }
  document.addEventListener("click", (event) => {
    const button = event.target && event.target.closest && event.target.closest("[data-server-check]");
    if (button) { button.disabled = true; checkServer().finally(() => { if (button.isConnected) button.disabled = false; }); }
  });
  window.addEventListener("fid:api-status", (event) => {
    const d = event.detail || {};
    if (d.state === "offline") renderServerStatus({ state: "offline", message: d.message });
    else if (d.state === "degraded") renderServerStatus({ state: "degraded", status: d.status, message: d.message });
    else if (d.state === "online") renderServerStatus({ state: "online", status: d.status, latencyMs: d.latencyMs || "—" });
  });

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200); }
  /* "FOREVYE ID ile giriş" yarıda kaldıysa (önce giriş gerekti) giriş sonrası oraya dön */
  function afterLogin() { const p = sessionStorage.getItem("fid.pending"); if (p) { sessionStorage.removeItem("fid.pending"); location.hash = p; return; } go("/profil"); }
  function go(h) { if (location.hash === "#" + h) route(); else location.hash = h; }
  function mailCheck() {
    if (!C.MOCK) return;
    const n = api.demoMailbox().length;
    if (n > lastMail) toast("📬 Demo posta kutusuna yeni e-posta geldi");
    lastMail = n;
    const b = $(".demo-btn"); if (b) b.textContent = "📬 Demo posta (" + n + ")";
  }
  function bindForm(sel, fn) {
    const f = $(sel); if (!f) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = f.querySelector("button.pri"); const er = f.querySelector(".err");
      if (er) er.textContent = ""; if (b) b.disabled = true;
      try { await fn(Object.fromEntries(new FormData(f)), f); }
      catch (x) { if (er) er.textContent = x.message; else toast(x.message); if (x.code === "UNAUTHORIZED") go("/giris"); }
      finally { if (b && document.contains(b)) b.disabled = false; mailCheck(); }
    });
  }
  const authShell = (inner) => `<div class="auth"><div class="card"><div class="brand" style="margin-bottom:1.1rem">${LOGO}<span class="brand-name">FOREVYE <b>ID</b></span></div>${inner}${!C.MOCK && serverState.state === "offline" ? `<p class="hint">Giriş, kayıt ve doğrulama işlemleri için kimlik sunucusu bağlantısı gereklidir. Üstteki bağlantı durumundan tekrar deneyebilirsiniz.</p>` : ""}</div></div>`;
  const pwHint = `<div class="hint">En az ${C.PASSWORD_MIN_LENGTH} karakter, harf ve rakam içermeli.</div>`;

  /* ---------------- Kimlik ekranları ---------------- */
  async function vLogin() {
    if (ctx.tf) {
      app(authShell(`<h1>İki aşamalı doğrulama</h1><p class="mut">${ctx.tf.method === "email" ? "E-postanıza gönderilen 6 haneli kodu girin." : "Authenticator uygulamanızdaki 6 haneli kodu girin."}</p>
        <form id="f"><label>Kod</label><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus><div class="err"></div><button class="btn pri block">Doğrula</button></form>
        <p class="sm mut" style="margin-top:1rem"><a href="#/giris" id="back">Geri dön</a></p>`));
      $("#back").onclick = (e) => { e.preventDefault(); ctx.tf = null; route(); };
      bindForm("#f", async (d) => { const r = await api.login({ email: ctx.tf.email, challengeId: ctx.tf.challengeId, code: d.code }); ctx.tf = null; user = r.user; afterLogin(); });
      return;
    }
    app(authShell(`<h1>Giriş yap</h1><p class="mut">Tüm FOREVYE uygulamaları için tek hesap.</p>
      <form id="f"><label>E-posta</label><input type="email" name="email" autocomplete="username" required value="${esc(ctx.email || "")}">
      <label>Parola</label><input type="password" name="password" autocomplete="current-password" required>
      <div class="err"></div><button class="btn pri block">Giriş yap</button></form>
      <div class="sep">veya</div><button class="btn block" id="g" type="button">Google ile giriş</button>
      <p class="sm" style="margin-top:1rem"><a href="#/sifremi-unuttum">Şifremi unuttum</a> · <a href="#/kayit">Hesap oluştur</a></p>`));
    bindForm("#f", async (d) => {
      try {
        const r = await api.login(d);
        if (r.twoFactorRequired) { ctx.tf = { method: r.method, challengeId: r.challengeId, email: d.email }; return route(); }
        user = r.user; afterLogin();
      } catch (e) { if (e.code === "EMAIL_NOT_VERIFIED") { ctx.email = d.email; toast(e.message); go("/dogrula"); } else throw e; }
    });
    if (C.MOCK) $("#g").onclick = async () => { try { const r = await api.googleLogin(); user = r.user; afterLogin(); } catch (e) { toast(e.message); } mailCheck(); };
    else {   // gerçek Google düğmesi (GIS)
      const box = document.createElement("div"); box.style.cssText = "display:flex;justify-content:center"; $("#g").replaceWith(box);
      api.googleButton(box, async (cred) => {
        try { const r = await api.googleSignIn(cred); if (r.twoFactorRequired) { ctx.tf = { method: r.method, challengeId: r.challengeId, email: r.email }; return route(); } user = r.user; afterLogin(); }
        catch (e) { toast(e.message); }
      }).catch((e) => { box.innerHTML = '<span class="sm mut">' + esc(e.message) + "</span>"; });
    }
  }

  async function vRegister() {
    app(authShell(`<h1>Hesap oluştur</h1><p class="mut">Yalnızca e-posta ve parola yeterli. Telefon, doğum tarihi veya gerçek ad istenmez.</p>
      <form id="f"><label>E-posta</label><input type="email" name="email" autocomplete="email" required>
      <label>Parola</label><input type="password" name="password" autocomplete="new-password" required>${pwHint}
      <label>Parola tekrarı</label><input type="password" name="password2" autocomplete="new-password" required>
      <label style="display:flex;gap:.5rem;align-items:flex-start;color:var(--txt)"><input type="checkbox" name="terms" required style="margin-top:.25rem"><span class="sm">Kullanım Koşulları ve Gizlilik Bildirimi'ni kabul ediyorum. <span class="mut">(Metinler yayın öncesi hazırlanacaktır.)</span></span></label>
      <div class="err"></div><button class="btn pri block">Hesap oluştur</button></form>
      <p class="sm" style="margin-top:1rem">Zaten hesabın var mı? <a href="#/giris">Giriş yap</a></p>`));
    bindForm("#f", async (d) => {
      if (!EMAIL_RE.test(d.email)) throw new Error("Geçerli bir e-posta girin.");
      const pe = validatePassword(d.password); if (pe) throw new Error(pe);
      if (d.password !== d.password2) throw new Error("Parolalar eşleşmiyor.");
      await api.register({ email: d.email, password: d.password });
      ctx.email = d.email; go("/dogrula");
    });
  }

  async function vVerify() {
    app(authShell(`<h1>E-postanı doğrula</h1><p class="mut"><b>${esc(ctx.email || "E-posta adresinize")}</b> gönderilen 6 haneli kodu girin. Doğrulanmamış hesaplar tam erişim alamaz.</p>
      <form id="f"><label>E-posta</label><input type="email" name="email" required value="${esc(ctx.email || "")}">
      <label>Doğrulama kodu</label><input name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code">
      <div class="err"></div><button class="btn pri block">Doğrula</button></form>
      <p class="sm" style="margin-top:1rem"><a href="#" id="rs">Kodu yeniden gönder</a> · <a href="#/giris">Girişe dön</a></p>`));
    bindForm("#f", async (d) => { await api.verifyEmail(d); ctx.email = d.email; toast("E-posta doğrulandı. Giriş yapabilirsiniz."); go("/giris"); });
    $("#rs").onclick = async (e) => { e.preventDefault(); const em = $("#f [name=email]").value; try { await api.resendVerification({ email: em }); toast("Kod gönderildi (gerekiyorsa)."); } catch (x) { toast(x.message); } mailCheck(); };
  }

  async function vForgot() {
    app(authShell(`<h1>Şifremi unuttum</h1><p class="mut">Doğrulanmış e-posta adresinize sıfırlama kodu göndeririz.</p>
      <form id="f"><label>E-posta</label><input type="email" name="email" required><div class="err"></div><button class="btn pri block">Kod gönder</button></form>
      <p class="sm" style="margin-top:1rem"><a href="#/giris">Girişe dön</a></p>`));
    bindForm("#f", async (d) => { await api.forgot(d); ctx.email = d.email; toast("Hesap varsa kod gönderildi."); go("/sifirla"); });
  }
  async function vReset() {
    app(authShell(`<h1>Yeni parola belirle</h1>
      <form id="f"><label>E-posta</label><input type="email" name="email" required value="${esc(ctx.email || "")}">
      <label>Sıfırlama kodu</label><input name="code" inputmode="numeric" maxlength="6" required>
      <label>Yeni parola</label><input type="password" name="password" autocomplete="new-password" required>${pwHint}
      <label>Yeni parola tekrarı</label><input type="password" name="password2" autocomplete="new-password" required>
      <div class="err"></div><button class="btn pri block">Parolayı sıfırla</button></form>`));
    bindForm("#f", async (d) => { if (d.password !== d.password2) throw new Error("Parolalar eşleşmiyor."); await api.reset(d); toast("Parola değişti. Tüm oturumlar kapatıldı."); go("/giris"); });
  }

  /* ---------------- Oturum açmış düzen ---------------- */
  function layout(active, inner) {
    const link = (h, t, ic) => `<a href="#${h}" class="${active === h ? "on" : ""}"${active === h ? ' aria-current="page"' : ""}>${icon(ic)}<span>${t}</span></a>`;
    app(`<div class="shell"><nav class="side" aria-label="Hesap menüsü"><div class="brand" style="margin-bottom:1rem">${LOGO}<span class="brand-name">FOREVYE <b>ID</b></span></div>
      ${link("/profil", "Profil", "profile")}${link("/guvenlik", "Güvenlik", "security")}${link("/uygulamalar", "Uygulamalar", "apps")}${link("/hesap-sil", "Hesabı sil", "trash")}
      <div class="grow"></div><a href="#" id="lo" class="lo">${icon("logout")}<span>Çıkış yap</span></a></nav><main>${inner}</main></div>`);
    $("#lo").onclick = async (e) => { e.preventDefault(); await api.logout(); user = null; go("/giris"); };
  }
  const avatar = (u) => `<div class="avatar">${u.photo ? `<img alt="Profil fotoğrafı" src="${esc(u.photo)}">` : icon("profile", "avatar-ph")}</div>`;

  /* ---------------- Profil ---------------- */
  async function vProfile() {
    const u = user = await api.me();
    const photoLocked = u.photoNextChangeAt && u.photoNextChangeAt > Date.now();
    const nx = u.usernameNextChangeAt && u.usernameNextChangeAt > Date.now() ? u.usernameNextChangeAt : null;
    layout("/profil", `<h1>Profil</h1>
      <div class="card wide"><div class="row" style="gap:1.2rem">${avatar(u)}<div><div class="mut sm">Merkezi User ID</div><div class="mono">${esc(u.userId)}</div>
        <div class="mut sm" style="margin-top:.4rem">E-posta</div><div>${esc(u.email)} <span class="badge ok">doğrulandı</span></div></div></div></div>

      <div class="card wide"><h2>Kullanıcı adı</h2>
        <p class="mut sm">Yalnızca hesap kimliğidir; kullanıcılar birbirini bulamaz/arayamaz. '#' ile başlar, ardından 8–29 karakter: yalnızca İngilizce BÜYÜK harf ve rakam. Küçük harfler otomatik büyütülmez.</p>
        <form id="uf"><input type="text" name="username" placeholder="#FOREVYENEXUS2026" value="${esc(u.username || "#")}" maxlength="30" autocapitalize="characters" autocomplete="off" spellcheck="false" ${nx ? "disabled" : ""}>
        <div class="err"></div>
        ${nx ? `<div class="notice">Sonraki değişiklik hakkı: <b>${fmt(nx)}</b></div>` : u.username ? `<div class="hint">İlk 48 saatte en fazla 2 değişiklik; sonrasında her değişiklikten sonra 15 gün beklenir. Eski ad hemen serbest kalır. ${u.usernameChangesLeftInWindow != null ? "İlk pencerede kalan hak: " + u.usernameChangesLeftInWindow : ""}</div>` : `<div class="hint">Henüz kullanıcı adı seçmediniz. İlk seçim değişiklik hakkından sayılmaz (varsayım).</div>`}
        <div style="margin-top:.8rem"><button class="btn pri" ${nx ? "disabled" : ""}>${u.username ? "Değiştir" : "Kullanıcı adını seç"}</button></div></form></div>

      <div class="card wide"><h2>Profil fotoğrafı</h2>
        <p class="mut sm">Tek merkezi fotoğraf; tüm bağlı uygulamalarda görünür. JPG, PNG, WEBP · en fazla 2 MB · GIF yok · 24 saatte bir değiştirilebilir.</p>
        ${photoLocked ? `<div class="notice">Sonraki fotoğraf değişikliği: <b>${fmt(u.photoNextChangeAt)}</b></div>` : ""}
        <div class="row"><label class="btn ${photoLocked ? "" : "pri"}" style="margin:0;${photoLocked ? "opacity:.5;pointer-events:none" : ""}">Fotoğraf seç<input id="pf" type="file" accept="image/jpeg,image/png,image/webp" hidden ${photoLocked ? "disabled" : ""}></label>
        ${u.photo ? `<button class="btn dng" id="pd" type="button">Fotoğrafı kaldır</button>` : ""}</div>
        <div class="err" id="perr"></div><div id="crop"></div></div>`);
    bindForm("#uf", async (d) => { const r = await api.setUsername({ username: d.username.trim() }); user = r; toast("Kullanıcı adı kaydedildi."); vProfile(); });
    const pd = $("#pd"); if (pd) pd.onclick = async () => { if (!confirm("Fotoğraf kaldırılsın mı? Varsayılan FOREVYE simgesi gösterilir.")) return; await api.deletePhoto(); toast("Fotoğraf kaldırıldı."); vProfile(); };
    const pf = $("#pf"); if (pf) pf.onchange = () => pf.files[0] && startCrop(pf.files[0]);
  }

  async function startCrop(file) {
    const host = $("#crop"), perr = $("#perr"); perr.textContent = ""; host.innerHTML = "";
    if (file.size > C.PHOTO_MAX_BYTES) { perr.textContent = "Dosya 2 MB sınırını aşıyor."; return; }
    const t = await sniffImage(file);
    if (t === "gif") { perr.textContent = "GIF desteklenmez."; return; }
    if (!t) { perr.textContent = "Yalnızca gerçek JPG, PNG veya WEBP içeriği kabul edilir (uzantıya güvenilmez)."; return; }
    const url = URL.createObjectURL(file);
    host.innerHTML = `<div class="row" style="margin-top:.8rem"><span class="mut sm">Kırpma:</span><div class="seg"><button type="button" data-m="sq" class="on">Kare (1:1)</button><button type="button" data-m="free">Serbest</button></div></div>
      <div class="crop" id="cw"><img id="ci" alt="" src="${url}"><div class="box" id="cb"><div class="h" id="ch"></div></div></div>
      <div class="row" style="margin-top:.8rem"><div><div class="mut sm">Önizleme</div><canvas id="pv" style="width:96px;height:96px;border-radius:50%;background:var(--panel2);display:block"></canvas></div>
      <div><button class="btn pri" id="sv" type="button">Kaydet</button> <button class="btn" id="cn" type="button">Vazgeç</button></div></div>`;
    const img = $("#ci"), box = $("#cb"), cv = $("#pv");
    await img.decode().catch(() => {});
    let mode = "sq";
    const W = () => img.clientWidth, Hh = () => img.clientHeight;
    const r = { x: 0, y: 0, w: 0, h: 0 };
    function init() { const s = Math.min(W(), Hh()) * 0.8; r.w = s; r.h = s; r.x = (W() - s) / 2; r.y = (Hh() - s) / 2; draw(); }
    function clamp() { r.w = Math.max(30, Math.min(r.w, W())); r.h = Math.max(30, Math.min(r.h, Hh())); if (mode === "sq") { const s = Math.min(r.w, r.h, W(), Hh()); r.w = s; r.h = s; } r.x = Math.max(0, Math.min(r.x, W() - r.w)); r.y = Math.max(0, Math.min(r.y, Hh() - r.h)); }
    function draw() {
      clamp(); Object.assign(box.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
      const k = img.naturalWidth / W(), sw = r.w * k, sh = r.h * k, sc = Math.min(1, 512 / Math.max(sw, sh));
      cv.width = Math.max(1, Math.round(sw * sc)); cv.height = Math.max(1, Math.round(sh * sc));
      cv.getContext("2d").drawImage(img, r.x * k, r.y * k, sw, sh, 0, 0, cv.width, cv.height);
    }
    let drag = null;
    box.addEventListener("pointerdown", (e) => { drag = { t: e.target.id === "ch" ? "rs" : "mv", sx: e.clientX, sy: e.clientY, o: { ...r } }; box.setPointerCapture(e.pointerId); e.preventDefault(); });
    box.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (drag.t === "mv") { r.x = drag.o.x + dx; r.y = drag.o.y + dy; } else { r.w = drag.o.w + dx; r.h = mode === "sq" ? drag.o.w + dx : drag.o.h + dy; } draw(); });
    box.addEventListener("pointerup", () => { drag = null; });
    host.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { host.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b)); mode = b.dataset.m; if (mode === "sq") { const s = Math.min(r.w, r.h); r.w = s; r.h = s; } draw(); }));
    $("#cn").onclick = () => { host.innerHTML = ""; URL.revokeObjectURL(url); };
    $("#sv").onclick = async () => {
      $("#sv").disabled = true; perr.textContent = "";
      try {
        let blob = await new Promise((res) => cv.toBlob(res, "image/webp", 0.9));
        if (!blob || blob.type !== "image/webp") blob = await new Promise((res) => cv.toBlob(res, "image/png"));
        if (blob.size > C.PHOTO_MAX_BYTES) throw new Error("Kırpılmış dosya 2 MB'ı aşıyor; daha küçük bir alan seçin.");
        const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
        await api.uploadPhoto({ blob, dataUrl }); toast("Profil fotoğrafı güncellendi."); vProfile();
      } catch (e) { perr.textContent = e.message; $("#sv") && ($("#sv").disabled = false); }
    };
    init();
  }

  /* ---------------- Güvenlik ---------------- */
  const EVT = { google_linked: "Google hesabı bağlandı", google_unlinked: "Google bağlantısı kaldırıldı", app_authorized: "Uygulamaya giriş izni verildi", register: "Hesap oluşturuldu", email_verified: "E-posta doğrulandı", login: "Giriş", failed_login: "Başarısız giriş denemesi", new_device: "Yeni cihazdan giriş", logout: "Çıkış", logout_all: "Tüm cihazlardan çıkış", password_reset: "Parola sıfırlandı", username: "Kullanıcı adı değişti", photo: "Profil fotoğrafı güncellendi", photo_removed: "Profil fotoğrafı kaldırıldı", session_revoked: "Oturum sonlandırıldı", app_disconnected: "Uygulama bağlantısı kaldırıldı", "2fa_enabled": "2FA etkinleştirildi", "2fa_disabled": "2FA kapatıldı", google_linked: "Google bağlandı", google_unlinked: "Google bağlantısı kaldırıldı" };
  async function vSecurity() {
    const u = user = await api.me();
    const [sessions, events] = await Promise.all([api.sessions(), api.events ? api.events().catch(() => []) : []]);
    const s = ctx.tfSetup;
    let tf;
    if (u.twoFactor.enabled) {
      tf = `<p>Durum: <span class="badge ok">Açık</span> · Yöntem: <b>${u.twoFactor.method === "email" ? "E-posta kodu" : "Authenticator"}</b></p>
        <form id="tfoff"><label>Kapatmak için parolanız</label><input type="password" name="password" required><div class="err"></div><button class="btn dng" style="margin-top:.8rem">2FA'yı kapat</button></form>
        <p class="hint">Yöntemi değiştirmek için önce kapatıp yeniden etkinleştirin. Aynı anda yalnızca bir yöntem etkindir (açık karar, bkz. README).</p>`;
    } else if (s) {
      tf = `<form id="tfon"><p class="mut sm">${s.method === "email" ? "E-postanıza bir kurulum kodu gönderdik." : "Authenticator uygulamanıza aşağıdaki anahtarı elle ekleyin, ardından üretilen kodu girin."}</p>
        ${s.method === "totp" ? `<div class="mut sm">Gizli anahtar</div><div class="mono" style="font-size:1.05rem;margin:.2rem 0">${esc(s.secret)}</div><div class="mut sm">otpauth bağlantısı</div><div class="mono sm">${esc(s.uri)}</div>` : ""}
        <label>6 haneli kod</label><input name="code" inputmode="numeric" maxlength="6" required><div class="err"></div>
        <div class="row" style="margin-top:.8rem"><button class="btn pri">Etkinleştir</button><button class="btn" type="button" id="tfx">Vazgeç</button></div></form>`;
    } else {
      tf = `<p>Durum: <span class="badge">Kapalı</span> <span class="mut sm">İsteğe bağlı.</span></p>
        <form id="tfgo"><label>Yöntem</label><div class="row"><label style="margin:0;color:var(--txt)"><input type="radio" name="method" value="email" checked> E-posta kodu</label><label style="margin:0;color:var(--txt)"><input type="radio" name="method" value="totp"> Authenticator uygulaması</label></div>
        <label>Güvenli yeniden doğrulama: parolanız</label><input type="password" name="password" required><div class="err"></div><button class="btn pri" style="margin-top:.8rem">Kuruluma başla</button></form>
        <p class="hint">Yedek kurtarma kodu sunulmaz. E-posta/Authenticator erişimi kaybedilirse kurtarma e-posta üzerinden yürür.</p>`;
    }
    layout("/guvenlik", `<h1>Güvenlik</h1>
      <div class="card wide"><h2>İki aşamalı doğrulama (2FA)</h2>${tf}</div>
      <div class="card wide"><div class="row sp"><h2 style="margin:0">Açık oturumlar ve cihazlar</h2><button class="btn dng sm" id="la">Tüm cihazlardan çıkış</button></div>
        <p class="hint">Yaklaşık konum/IP ve son etkinlik gösterilir; hassas konum takibi yapılmaz. Bir uygulamadan çıkmak diğerlerini kapatmaz.</p>
        <div class="list">${sessions.map((x) => `<div class="row sp"><div><b>${esc(x.device)}</b> ${x.current ? '<span class="badge ok">bu cihaz</span>' : ""} <span class="badge">${esc(x.deviceType || "")}</span><div class="mut sm">${esc(x.location)} · Son etkinlik: ${fmt(x.lastActive)} · ${esc(x.status)}</div></div>
          <button class="btn sm" data-rv="${esc(x.id)}">Oturumu kapat</button></div>`).join("")}</div></div>
      ${C.MOCK ? "" : `<div class="card wide"><h2>Google ile giriş</h2>${u.google.linked ? `<p>Bağlı Google hesabı: <b>${esc(u.google.email)}</b></p><button class="btn dng sm" id="gun">Google bağlantısını kaldır</button><p class="hint">Hesabın parolası yoksa önce “Şifremi unuttum” ile bir parola belirle.</p>` : `<p class="mut sm">Google hesabını bağlarsan onunla da giriş yapabilirsin.</p><div id="gbox" style="margin-top:.5rem"></div>`}</div>`}
      <div class="card wide"><h2>Güvenlik olayları</h2><div class="list">${events.length ? events.map((e) => `<div class="row sp"><span>${esc(EVT[e.type] || e.type)} <span class="mut sm">${esc(e.detail)}</span></span><span class="mut sm">${fmt(e.at)}</span></div>`).join("") : '<div class="mut">Kayıt yok.</div>'}</div>
        <p class="hint">Yeni cihaz girişleri ve şüpheli girişler e-posta ile bildirilir. Şüpheli girişte otomatik hesap kilitleme veya zorunlu ek doğrulama yoktur; yalnızca bildirim gönderilir.</p></div>`);
    bindForm("#tfgo", async (d) => { ctx.tfSetup = await api.twoFaStart(d); vSecurity(); });
    bindForm("#tfon", async (d) => { await api.twoFaEnable({ code: d.code }); ctx.tfSetup = null; toast("2FA etkinleştirildi."); vSecurity(); });
    bindForm("#tfoff", async (d) => { await api.twoFaDisable(d); toast("2FA kapatıldı."); vSecurity(); });
    if (!C.MOCK) {
      const gb = $("#gbox"); if (gb) api.googleButton(gb, async (cred) => { try { await api.googleLink(cred); toast("Google hesabı bağlandı."); vSecurity(); } catch (e) { toast(e.message); } }).catch((e) => { gb.textContent = e.message; });
      const gu = $("#gun"); if (gu) gu.onclick = async () => { if (!confirm("Google bağlantısı kaldırılsın mı?")) return; try { await api.googleUnlink(); toast("Google bağlantısı kaldırıldı."); vSecurity(); } catch (e) { toast(e.message); } };
    }
    const tfx = $("#tfx"); if (tfx) tfx.onclick = () => { ctx.tfSetup = null; vSecurity(); };
    $("#la").onclick = async () => { if (!confirm("Tüm cihazlardaki oturumlar kapatılsın mı? Bu cihaz dahil.")) return; await api.logoutAll(); user = null; go("/giris"); };
    document.querySelectorAll("[data-rv]").forEach((b) => (b.onclick = async () => { const r = await api.revokeSession(b.dataset.rv); if (r.wasCurrent) { user = null; go("/giris"); } else { toast("Oturum kapatıldı."); vSecurity(); } }));
  }

  /* ---------------- Uygulamalar (Registry kataloğundan dinamik) ---------------- */
  const appsQ = { q: "", category: "", page: 1, pageSize: 12 };
  const initial = (n) => esc(String(n || "?").trim().charAt(0).toUpperCase());
  const statusBadge = (a) => a.status === "suspended" ? '<span class="badge warn">askıda</span>'
    : a.connected ? (a.needsConsent ? '<span class="badge warn">yeni izin gerekiyor</span>' : '<span class="badge ok">bağlı</span>') : '<span class="badge">bağlı değil</span>';
  function appCard(a) {
    const icon = a.iconUrl ? `<img alt="" src="${esc(a.iconUrl)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${initial(a.name)}'}))">` : initial(a.name);
    const open = a.connected && a.appUrl && a.status !== "suspended" && /^https:\/\//.test(a.appUrl) ? `<a class="btn sm pri" href="${esc(a.appUrl)}" rel="noopener">Aç</a>` : "";
    const connect = !a.connected && a.status !== "suspended" ? (C.MOCK ? `<button class="btn sm" data-cn="${esc(a.id)}">Bağla (demo)</button>` : a.appUrl && /^https:\/\//.test(a.appUrl) ? `<a class="btn sm" href="${esc(a.appUrl)}" rel="noopener">İzinleri gör</a>` : "") : "";
    return `<article class="app-card"><div class="app-head"><div class="app-icon">${icon}</div><div class="app-title"><h2>${esc(a.name)}</h2>${statusBadge(a)}</div></div>
      <p class="mut app-desc">${esc(a.description || "Açıklama eklenmemiş.")}</p>
      <details class="app-scopes"><summary>İzinler (${a.scopes.length})</summary><ul>${a.scopes.map((s) => `<li>${esc(scopeText(s))}</li>`).join("")}</ul></details>
      ${a.connected ? `<form data-nf="${esc(a.id)}" class="row"><input type="text" name="n" maxlength="32" aria-label="${esc(a.name)} için görünen ad" placeholder="Bu uygulamaya özel görünen ad" value="${esc(a.displayName)}" style="flex:1;min-width:160px"><button class="btn sm">Kaydet</button></form>` : ""}
      <div class="row sp app-actions">${open || connect || "<span></span>"}${a.connected ? `<button class="btn dng sm" data-dc="${esc(a.id)}">Bağlantıyı kaldır</button>` : ""}</div></article>`;
  }
  function renderAppsUnavailable(error) {
    const attempts = Array.isArray(error && error.attempts) ? error.attempts : [error && error.endpoint].filter(Boolean);
    const routeText = attempts.length ? attempts.map((x) => `<code>${esc(x)}</code>`).join("<br>") : `<code>${esc(C.API_BASE)}/identity/apps</code>`;
    const status = error && error.status ? `HTTP ${error.status}` : (error && error.code) || "NETWORK";
    layout("/uygulamalar", `<h1>Uygulamalarım</h1>
      <p class="mut">Bağlı uygulamalarını, izinlerini ve uygulama erişimlerini buradan yönetebilirsin.</p>
      <section class="card wide app-load-error" role="alert" aria-live="assertive">
        <div class="app-load-error-mark" aria-hidden="true">${icon("alert")}</div>
        <div class="app-load-error-body">
          <span class="badge warn">${esc(status)}</span>
          <h2>Uygulama listesi yüklenemedi</h2>
          <p>${esc((error && error.message) || "Kimlik sunucusundan uygulama listesi alınamadı.")}</p>
          <div class="app-diagnostics">
            <div><span class="mut sm">Kimlik API adresi</span><code>${esc(C.API_BASE || "tanımlı değil")}</code></div>
            <div><span class="mut sm">Denetlenen uygulama uçları</span>${routeText}</div>
            <div><span class="mut sm">Hata kodu</span><code>${esc((error && error.code) || "UNKNOWN")}</code></div>
          </div>
          <div class="row app-error-actions">
            <button class="btn pri" id="apps-retry" type="button">Yeniden dene</button>
            <button class="btn" id="apps-copy" type="button">Tanı bilgisini kopyala</button>
            <a class="btn" href="#/profil">Profile dön</a>
          </div>
          <p class="hint">Bu ekran uygulama verisi uydurmaz veya sahte bağlantı durumu göstermez. Sunucu yanıt verdiğinde liste otomatik olarak gerçek hesabından yüklenir.</p>
        </div>
      </section>`);
    const retry = $("#apps-retry");
    if (retry) retry.onclick = () => { retry.disabled = true; vApps().finally(() => { if (retry.isConnected) retry.disabled = false; }); };
    const copy = $("#apps-copy");
    if (copy) copy.onclick = async () => {
      const report = ["FOREVYE ID uygulamalar tanısı", "API: " + (C.API_BASE || "tanımlı değil"), "Kod: " + ((error && error.code) || "UNKNOWN"), "HTTP: " + ((error && error.status) || "—"), "Mesaj: " + ((error && error.message) || "—"), "Uçlar: " + attempts.join(" | ")].join("\n");
      try { await navigator.clipboard.writeText(report); toast("Tanı bilgisi kopyalandı."); }
      catch (e) { toast("Kopyalanamadı; ekrandaki hata kodunu paylaşabilirsin."); }
    };
  }
  async function vApps() {
    layout("/uygulamalar", `<h1>Uygulamalarım</h1><p class="mut">Bağlı uygulamalarını, izinlerini ve uygulama erişimlerini buradan yönetebilirsin.</p><div class="card wide app-loading" role="status"><span class="app-loading-dot"></span> Uygulama listesi sunucudan yükleniyor…</div>`);
    try {
      user = await api.me();
      const r = await api.apps(appsQ);
      const pages = Math.max(1, Math.ceil(r.total / Math.max(1, r.pageSize || 12)));
      if (appsQ.page > pages) { appsQ.page = pages; return vApps(); }
      layout("/uygulamalar", `<h1>Uygulamalarım</h1>
        <p class="mut">Her uygulama yalnızca kendi izin kapsamını alır ve diğer uygulamaların oturum/verilerine erişemez. Bir bağlantıyı kaldırmak diğerlerini ve merkezi hesabı etkilemez.</p>
        <div class="toolbar"><input type="search" id="aq" aria-label="Uygulama ara" placeholder="Uygulama ara…" value="${esc(appsQ.q)}">
          <select id="ac" aria-label="Kategori"><option value="">Tüm kategoriler</option>${r.categories.map((c) => `<option value="${esc(c)}"${c === appsQ.category ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
        <div class="hint" role="status">${r.total} uygulama</div>
        <div class="app-grid">${r.items.length ? r.items.map(appCard).join("") : '<div class="card wide mut">Eşleşen uygulama yok.</div>'}</div>
        ${pages > 1 ? `<div class="row pager"><button class="btn sm" id="pp"${appsQ.page <= 1 ? " disabled" : ""}>‹ Önceki</button><span class="mut sm">Sayfa ${appsQ.page} / ${pages}</span><button class="btn sm" id="pn"${appsQ.page >= pages ? " disabled" : ""}>Sonraki ›</button></div>` : ""}`);
      let t; const aq = $("#aq");
      aq.oninput = () => { clearTimeout(t); t = setTimeout(() => { appsQ.q = aq.value; appsQ.page = 1; vApps().then(() => { const n = $("#aq"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 300); };
      $("#ac").onchange = (e) => { appsQ.category = e.target.value; appsQ.page = 1; vApps(); };
      if ($("#pp")) $("#pp").onclick = () => { appsQ.page--; vApps(); };
      if ($("#pn")) $("#pn").onclick = () => { appsQ.page++; vApps(); };
      document.querySelectorAll("[data-dc]").forEach((b) => (b.onclick = async () => { if (!confirm("Bu uygulamanın hesabınıza erişimi kaldırılsın mı?")) return; try { await api.disconnectApp(b.dataset.dc); } catch (x) { toast(x.message); } vApps(); }));
      document.querySelectorAll("[data-cn]").forEach((b) => (b.onclick = async () => { try { await api.connectApp(b.dataset.cn); } catch (x) { toast(x.message); } vApps(); }));
      document.querySelectorAll("[data-nf]").forEach((f) => f.addEventListener("submit", async (e) => { e.preventDefault(); try { await api.setAppName(f.dataset.nf, new FormData(f).get("n")); toast("Görünen ad kaydedildi."); } catch (x) { toast(x.message); } }));
    } catch (e) {
      if (e && e.code === "UNAUTHORIZED") throw e;
      renderAppsUnavailable(e);
    }
  }

  /* ---------------- Uygulama girişi ("FOREVYE ID ile giriş") ---------------- */
  async function vAuthorize() {
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    const b = { app: q.get("app"), redirect: q.get("redirect"), state: q.get("state"), challenge: q.get("challenge") };
    if (C.MOCK) throw new Error("Uygulama girişi demo modunda yok (MOCK:false gerekir).");
    if (!api.hasSession()) { sessionStorage.setItem("fid.pending", location.hash); return go("/giris"); }
    let info;
    try { info = await api.authorizeInfo({ app: b.app, redirect: b.redirect }); }
    catch (e) { if (e.code === "UNAUTHORIZED") sessionStorage.setItem("fid.pending", location.hash); throw e; }
    // Daha önce izin verilmiş uygulamalarda oturum açıksa tekrar onay ekranı gösterme.
    if (info.connected) {
      const granted = await api.authorize(b);
      location.replace(granted.redirect);
      return;
    }
    app(authShell(`<h1>${esc(info.app.name)} erişim istiyor</h1><p class="mut"><b>${esc(info.email)}</b> hesabınla giriş yapılacak. Parolan uygulamaya verilmez.</p>
      <div class="row" style="margin:.6rem 0">${info.app.scopes.map((s) => `<span class="badge">${esc(scopeText(s))}</span>`).join("")}</div>
      <div class="err"></div><button class="btn pri block" id="ok">İzin ver ve devam et</button><button class="btn block" id="no" style="margin-top:.6rem">Vazgeç</button>
      <p class="hint">Bu izni “Bağlı uygulamalar” sayfasından istediğin zaman kaldırabilirsin.</p>`));
    $("#ok").onclick = async () => { $("#ok").disabled = true; try { const r = await api.authorize(b); location.href = r.redirect; } catch (e) { $(".err").textContent = e.message; $("#ok").disabled = false; } };
    $("#no").onclick = () => go("/profil");
  }

  /* ---------------- Hesap silme ---------------- */
  async function vDelete() {
    const u = user = await api.me(); const g = u.google.linked;
    layout("/hesap-sil", `<h1>Hesabı sil</h1>
      <div class="notice">Bu işlem geri alınamaz. FOREVYE ID silindiğinde bağlı tüm uygulamalarda kimlik doğrulama erişiminiz sona erer.</div>
      <div class="card wide"><h2>Silmeden önce bilmeniz gerekenler</h2>
        <p class="mut sm">Aşağıdaki verilerin akıbeti ilgili uygulamanın veri politikasına göre silme, anonimleştirme veya zorunlu saklama şeklinde belirlenir:</p>
        <ul><li><b>Bakiye</b> (Sanal Banka)</li><li><b>Fotoğraflar</b> (profil ve uygulama içi)</li><li><b>Siparişler</b> (FOREVYE PRINT)</li><li><b>Dijital haklar</b></li><li><b>İşlem kayıtları</b></li></ul>
        <div class="notice info">Saklama/silme süreleri henüz tanımlanmadı (şartname bölüm 18). Yayın öncesi bu liste uygulama bazlı net sürelerle güncellenmelidir.</div></div>
      <form id="f" class="card wide">
        ${g ? `<h2>Google bağlantısı</h2><p class="mut sm">İki ayrı işlem vardır: <b>(1)</b> FOREVYE veritabanındaki harici kimlik kaydının silinmesi, <b>(2)</b> Google tarafındaki uygulama izninin (OAuth grant) iptali. Hangisinin yapılacağı aşağıda belirtilir. Google hesabınız hiçbir durumda silinmez.</p>
        <label style="color:var(--txt);display:flex;gap:.5rem"><input type="radio" name="unlink" value="1" checked><span>Google bağlantısını da kaldır: kayıt silinir ve Google'daki FOREVYE izni iptal edilir.</span></label>
        <label style="color:var(--txt);display:flex;gap:.5rem"><input type="radio" name="unlink" value="0"><span>Kaldırma: Google'daki izin olduğu gibi kalır; yerel kayıt hesapla birlikte silinir. İzni Google hesap ayarlarından ayrıca kaldırabilirsiniz.</span></label>` : ""}
        <label>Onay için parolanız</label><input type="password" name="password" ${g ? "" : "required"} autocomplete="current-password">
        <label style="color:var(--txt);display:flex;gap:.5rem;margin-top:1rem"><input type="checkbox" name="ok" required><span>Yukarıdaki sonuçları okudum ve hesabımı kalıcı olarak silmek istiyorum.</span></label>
        <div class="err"></div><button class="btn dng" style="margin-top:.8rem">Hesabımı kalıcı olarak sil</button></form>`);
    bindForm("#f", async (d) => {
      if (!confirm("SON ONAY: Hesabınız kalıcı olarak silinecek. Devam edilsin mi?")) return;
      await api.deleteAccount({ password: d.password, unlinkGoogle: d.unlink === "1" });
      user = null; toast("Hesabınız silindi."); go("/kayit");
    });
  }

  /* ---------------- Demo posta kutusu ---------------- */
  function demoBox() {
    if (!C.MOCK || $(".demo-btn")) return;
    const b = document.createElement("button"); b.className = "demo-btn"; b.textContent = "📬 Demo posta"; document.body.appendChild(b);
    let box = null;
    b.onclick = () => {
      if (box) { box.remove(); box = null; return; }
      box = document.createElement("div"); box.className = "mailbox";
      const mails = api.demoMailbox();
      box.innerHTML = `<div class="row sp"><b>Demo posta kutusu</b><button class="btn sm" id="rst">Demoyu sıfırla</button></div><div class="row" style="margin:.4rem 0"><button class="btn sm" id="grow">Katalogu 60 uygulamaya çıkar</button></div><p class="hint">Gerçek sunucuda bu e-postalar e-posta sağlayıcısıyla gönderilir.</p>` +
        (mails.length ? mails.map((m) => `<div class="m"><div class="sm mut">${fmt(m.at)} · ${esc(m.to)}</div><b>${esc(m.subject)}</b><div>${esc(m.body)}</div></div>`).join("") : '<div class="mut">Henüz e-posta yok.</div>');
      document.body.appendChild(box);
      $("#grow").onclick = () => { api.demoGrowCatalog(60); toast("Katalog 60 uygulamaya çıkarıldı."); if (location.hash === "#/uygulamalar") route(); };
      $("#rst").onclick = () => { if (confirm("Tüm demo verileri silinsin mi?")) { api.demoReset(); location.hash = "#/giris"; location.reload(); } };
    };
    lastMail = api.demoMailbox().length; mailCheck();
  }

  /* ---------------- Yönlendirici ---------------- */
  const routes = { "/giris": vLogin, "/kayit": vRegister, "/dogrula": vVerify, "/sifremi-unuttum": vForgot, "/sifirla": vReset, "/profil": vProfile, "/guvenlik": vSecurity, "/uygulamalar": vApps, "/hesap-sil": vDelete, "/baglan": vAuthorize };
  const guarded = new Set(["/profil", "/guvenlik", "/uygulamalar", "/hesap-sil"]);
  async function route() {
    const p = (location.hash || "#/giris").slice(1).split("?")[0];
    const fn = routes[p];
    if (!fn) return go("/giris");
    try {
      if (guarded.has(p)) { if (!api.hasSession()) return go("/giris"); }
      else if (p === "/giris" && !ctx.tf && api.hasSession()) { try { await api.me(); return afterLogin(); } catch (e) {} }
      await fn();
    } catch (e) {
      if (e.code === "UNAUTHORIZED") return go("/giris");
      app(authShell(`<h1>Bir sorun oluştu</h1><p class="err">${esc(e.message)}</p><a class="btn block" href="#/giris">Girişe dön</a>`));
    }
    demoBox(); mailCheck();
  }
  window.addEventListener("hashchange", route);
  if (!C.MOCK) checkServer();
  route();
})();
