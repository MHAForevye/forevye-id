/* FOREVYE ID — API katmanı
 * MOCK:true  → tarayıcıda çalışan demo arka uç (localStorage)
 * MOCK:false → config.js içindeki API_BASE adresindeki gerçek servis
 * Arayüz (app.js) her iki modda da aynı FID.api.* fonksiyonlarını çağırır.
 */
(function () {
  const C = window.FOREVYE_CONFIG;
  const USERNAME_RE = /^#[A-Z0-9]{8,29}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  /* Üretimde uygulama listesi Mikro-Klima Identity Worker'ından gelir:
   * GET /identity/apps. Bu Worker /v1/catalog/apps veya /v1/me/apps rotalarını sunmaz.
   * Aşağıdaki DEMO_CATALOG yalnızca MOCK:true içindir. */
  const DEMO_CATALOG = [
    { id: "sanal-banka", name: "Sanal Banka", description: "Sanal hesap, bakiye ve işlem geçmişi.", category: "finans", scopes: ["openid", "profile:read", "balance:read"] },
    { id: "nexus-pass", name: "Nexus Pass", description: "Dijital geçiş ve üyelik kartları.", category: "finans", scopes: ["openid", "profile:read", "balance:read"] },
    { id: "mikro-klima", name: "Mikro-Klima", description: "Ortam sıcaklığı ve nem kontrol merkezi.", category: "iot", scopes: ["openid", "profile:read"] },
    { id: "print", name: "FOREVYE PRINT", description: "Baskı siparişleri ve takibi.", category: "uretkenlik", scopes: ["openid", "profile:read", "orders:read"] },
    { id: "retro-camera", name: "RETRO CAMERA", description: "Retro filtreli kamera uygulaması.", category: "medya", scopes: ["openid", "profile:read", "profile_photo:read"] },
    { id: "mantar-pano", name: "Mantar Pano", description: "Notlar ve hatırlatıcılar için dijital pano.", category: "uretkenlik", scopes: ["openid", "profile:read"] }
  ];
  /* Protokol scope'ları makine odaklıdır; metinler yalnızca kullanıcıya gösterilen varsayılan etiketlerdir.
   * Sunucu scope'u kendi etiketiyle döndürürse o kullanılır. Eski Türkçe isimler geriye dönük uyumluluk içindir. */
  const SCOPE_LABEL = {
    "openid": "Kimlik (User ID)", "profile:read": "Profil adı ve kullanıcı adı", "email:read": "E-posta adresi",
    "balance:read": "Bakiye", "transactions:read": "İşlem geçmişi", "orders:read": "Siparişleri görme", "orders:write": "Sipariş oluşturma",
    "profile_photo:read": "Profil fotoğrafı",
    kimlik: "Kimlik (User ID)", bakiye: "Bakiye ve işlemler", siparis: "Siparişler", fotograf: "Profil fotoğrafı"
  };
  const scopeId = (s) => (typeof s === "string" ? s : s && s.id) || "";
  const scopeText = (s) => (s && typeof s === "object" && (s.label || s.description)) || SCOPE_LABEL[scopeId(s)] || scopeId(s);
  /* Sunucu/mock farklı şekil dönebilir; arayüz tek biçim görür. */
  function normApp(a) {
    return {
      id: a.id || a.appId || a.app_id, name: a.name || a.id || "Uygulama", description: a.description || a.shortDescription || a.short_description || "",
      category: a.category || "diger", iconUrl: a.iconUrl || a.icon_url || null, coverUrl: a.coverImageUrl || a.cover_image_url || null,
      appUrl: a.appUrl || a.app_url || null, status: a.status || "published", scopes: (a.scopes || a.allowedScopes || []).slice(),
      connected: !!a.connected, needsConsent: !!(a.needsConsent || a.needs_consent), displayName: a.displayName || ""
    };
  }
  function filterCatalog(list, { q, category, page, pageSize }) {
    q = (q || "").trim().toLocaleLowerCase("tr");
    let r = list.filter((a) => (!category || a.category === category) && (!q || (a.name + " " + a.description + " " + a.id).toLocaleLowerCase("tr").includes(q)));
    const categories = [...new Set(list.map((a) => a.category))].sort();
    const size = pageSize || 12, p = Math.max(1, page || 1), total = r.length;
    return { items: r.slice((p - 1) * size, p * size), total, page: p, pageSize: size, categories };
  }

  class ApiError extends Error {
    constructor(msg, code, status, cause) {
      super(msg); this.name = "ApiError"; this.code = code || "ERROR"; this.status = status || null;
      if (cause) this.cause = cause;
      this.endpoint = null;
      this.attempts = null;
    }
  }

  /* ---------- Doğrulayıcılar (sunucu da aynı kuralları uygular) ---------- */
  function validateUsername(u) {
    if (!u || u[0] !== "#") return "Kullanıcı adı '#' ile başlamalıdır.";
    const body = u.slice(1);
    if (body.length < 8 || body.length > 29) return "'#' hariç 8–29 karakter olmalıdır (toplam 9–30).";
    if (!USERNAME_RE.test(u)) return "Yalnızca İngilizce BÜYÜK harf (A–Z) ve rakam (0–9) kullanılabilir.";
    return null;
  }
  function validatePassword(p) {
    if (!p || p.length < C.PASSWORD_MIN_LENGTH) return "Parola en az " + C.PASSWORD_MIN_LENGTH + " karakter olmalıdır.";
    if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return "Parola en az bir harf ve bir rakam içermelidir.";
    return null;
  }
  async function sniffImage(file) {
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const s = (i, n) => String.fromCharCode(...b.slice(i, i + n));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
    if (b[0] === 0x89 && s(1, 3) === "PNG") return "png";
    if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "webp";
    if (s(0, 3) === "GIF") return "gif";
    return null;
  }

  /* ---------- Kripto yardımcıları (yalnızca mock) ---------- */
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
  const rndHex = (n) => hex(rnd(n));
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function b32enc(bytes) { let bits = "", out = ""; bytes.forEach((b) => (bits += b.toString(2).padStart(8, "0"))); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return out; }
  function b32dec(s) { let bits = ""; for (const ch of s) bits += B32.indexOf(ch).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); }
  async function hashPw(pw, saltHex) {
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256));
  }
  async function totp(secret, t) {
    const counter = Math.floor((t || Date.now()) / 30000);
    const msg = new ArrayBuffer(8); new DataView(msg).setUint32(4, counter);
    const key = await crypto.subtle.importKey("raw", b32dec(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
    const o = h[19] & 0xf;
    const code = ((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000;
    return String(code).padStart(6, "0");
  }
  async function totpOk(secret, code) {
    for (const d of [-30000, 0, 30000]) if ((await totp(secret, Date.now() + d)) === code) return true;
    return false;
  }

  /* ========================================================================
   *  MOCK ARKA UÇ
   * ====================================================================== */
  const DB_KEY = "fid_db", TOK_KEY = "fid_token";
  const now = () => Date.now();
  const H = 3600e3, D = 24 * H;
  function loadDb() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || fresh(); } catch (e) { return fresh(); } }
  function fresh() { return { users: {}, sessions: {}, mail: [], events: [], attempts: {}, catalog: DEMO_CATALOG.map((a) => Object.assign({ status: "published" }, a)) }; }
  function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function deviceInfo() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Bilinmiyor";
    const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Tarayıcı";
    const type = /Mobi|Android|iPhone/.test(ua) ? "Mobil" : "Masaüstü";
    return { type, label: br + " · " + os };
  }
  function mail(db, to, subject, body) { db.mail.unshift({ id: rndHex(4), to, subject, body, at: now() }); db.mail = db.mail.slice(0, 40); }
  function event(db, userId, type, detail) { db.events.unshift({ id: rndHex(4), userId, type, detail: detail || "", at: now() }); db.events = db.events.slice(0, 300); }
  const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const byEmail = (db, email) => Object.values(db.users).find((u) => u.email === email.trim().toLowerCase());
  const byToken = (db) => { const s = db.sessions[localStorage.getItem(TOK_KEY)]; if (!s || s.revoked) return null; return { s, u: db.users[s.userId] }; };
  function need(db) { const a = byToken(db); if (!a) throw new ApiError("Oturum geçersiz. Lütfen yeniden giriş yapın.", "UNAUTHORIZED"); a.s.lastActive = now(); return a; }
  function throttle(db, key, max, windowMs, msg) {
    const a = (db.attempts[key] || []).filter((t) => now() - t < windowMs);
    if (a.length >= max) throw new ApiError(msg || "Çok fazla deneme. Biraz bekleyip tekrar deneyin.", "RATE_LIMIT");
    a.push(now()); db.attempts[key] = a;
  }
  function publicUser(u) {
    return {
      userId: u.id, email: u.email, emailVerified: u.verified, username: u.username || null,
      photo: u.photo || null, photoNextChangeAt: u.photoAt ? u.photoAt + C.PHOTO_COOLDOWN_HOURS * H : null,
      usernameNextChangeAt: nextUsernameChange(u), usernameChangesLeftInWindow: u.username ? changesLeft(u) : null,
      twoFactor: { enabled: !!u.tf, method: u.tf ? u.tf.method : null },
      google: { linked: !!u.google, email: u.google ? u.google.email : null }, createdAt: u.createdAt
    };
  }
  function changesLeft(u) {
    const h = u.unameHistory || [];
    if (!h.length) return C.USERNAME_FIRST_WINDOW_MAX_CHANGES;
    const first = u.unameFirstAt;
    if (now() - first < C.USERNAME_FIRST_WINDOW_HOURS * H) return Math.max(0, C.USERNAME_FIRST_WINDOW_MAX_CHANGES - h.length);
    return 0;
  }
  function nextUsernameChange(u) {
    const h = u.unameHistory || [];
    if (!h.length) return null;
    if (now() - u.unameFirstAt < C.USERNAME_FIRST_WINDOW_HOURS * H && h.length < C.USERNAME_FIRST_WINDOW_MAX_CHANGES) return null;
    const last = h[h.length - 1].at;
    return last + C.USERNAME_COOLDOWN_DAYS * D;
  }
  function newSession(db, u, method) {
    const id = rndHex(12), d = deviceInfo();
    const known = (u.devices || []).includes(d.label);
    db.sessions[id] = { id, userId: u.id, device: d.label, deviceType: d.type, ip: "Yerel (demo)", createdAt: now(), lastActive: now(), revoked: false };
    u.devices = u.devices || []; if (!known) { u.devices.push(d.label); if (u.devices.length > 1) { mail(db, u.email, "Yeni cihazdan giriş", "Hesabınıza daha önce kullanılmamış bir cihazdan giriş yapıldı: " + d.label + ". Siz değilseniz parolanızı değiştirip tüm oturumları kapatın."); event(db, u.id, "new_device", d.label); } }
    event(db, u.id, "login", (method || "parola") + " · " + d.label);
    localStorage.setItem(TOK_KEY, id);
    return id;
  }
  function checkPending(db, u, kind, code) {
    const p = u.pending && u.pending[kind];
    if (!p || p.exp < now()) throw new ApiError("Kodun süresi dolmuş veya hiç gönderilmemiş. Yeni kod isteyin.", "CODE_EXPIRED");
    p.tries = (p.tries || 0) + 1;
    if (p.tries > 5) { delete u.pending[kind]; throw new ApiError("Çok fazla hatalı deneme. Yeni kod isteyin.", "RATE_LIMIT"); }
    if (p.code !== String(code).trim()) throw new ApiError("Kod hatalı.", "CODE_INVALID");
    delete u.pending[kind];
  }
  function sendCode(db, u, kind, subject) {
    const c = code6(); u.pending = u.pending || {};
    u.pending[kind] = { code: c, exp: now() + 10 * 60e3, tries: 0 };
    mail(db, u.email, subject, "Doğrulama kodunuz: " + c + " (10 dakika geçerli, tek kullanımlık).");
  }

  const mock = {
    async register({ email, password }) {
      const db = loadDb(); email = (email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new ApiError("Geçerli bir e-posta adresi girin.", "VALIDATION");
      const pe = validatePassword(password); if (pe) throw new ApiError(pe, "VALIDATION");
      if (byEmail(db, email)) throw new ApiError("Bu e-posta ile zaten bir hesap var.", "EMAIL_TAKEN");
      const salt = rndHex(16), id = "usr_" + rndHex(8);
      const u = db.users[id] = { id, email, salt, hash: await hashPw(password, salt), verified: false, createdAt: now(), pwUpdatedAt: now(), apps: {} };
      /* Yeni kayıt hiçbir uygulamaya otomatik izin vermez; izinler uygulamaya ilk girişte/“Bağla” ile verilir. */
      sendCode(db, u, "verify", "FOREVYE ID e-posta doğrulama");
      event(db, id, "register"); save(db);
      return { email, verificationRequired: true };
    },
    async verifyEmail({ email, code }) {
      const db = loadDb(); const u = byEmail(db, email || "");
      if (!u) throw new ApiError("Hesap bulunamadı.", "NOT_FOUND");
      throttle(db, "v:" + u.id, 10, 10 * 60e3);
      checkPending(db, u, "verify", code); u.verified = true; event(db, u.id, "email_verified"); save(db);
      return { ok: true };
    },
    async resendVerification({ email }) {
      const db = loadDb(); const u = byEmail(db, email || "");
      if (u && !u.verified) { throttle(db, "rs:" + u.id, 3, 10 * 60e3, "Çok sık kod istediniz. Birkaç dakika bekleyin."); sendCode(db, u, "verify", "FOREVYE ID e-posta doğrulama"); save(db); }
      return { ok: true };
    },
    async login({ email, password, code, challengeId }) {
      const db = loadDb(); email = (email || "").trim().toLowerCase();
      throttle(db, "l:" + email, 8, 5 * 60e3, "Çok fazla giriş denemesi. 5 dakika sonra tekrar deneyin.");
      const u = byEmail(db, email);
      if (!u) { save(db); throw new ApiError("E-posta veya parola hatalı.", "BAD_CREDENTIALS"); }
      if (!challengeId) {
        if ((await hashPw(password || "", u.salt)) !== u.hash) { event(db, u.id, "failed_login"); save(db); throw new ApiError("E-posta veya parola hatalı.", "BAD_CREDENTIALS"); }
        if (!u.verified) { save(db); throw new ApiError("E-posta adresinizi doğrulamadan giriş yapamazsınız.", "EMAIL_NOT_VERIFIED"); }
        if (u.tf) {
          if (u.tf.method === "email") sendCode(db, u, "login2fa", "FOREVYE ID giriş kodu");
          save(db); return { twoFactorRequired: true, method: u.tf.method, challengeId: u.id };
        }
        newSession(db, u); save(db); return { user: publicUser(u) };
      }
      if (challengeId !== u.id) throw new ApiError("Doğrulama oturumu geçersiz.", "BAD_CHALLENGE");
      if (u.tf.method === "email") checkPending(db, u, "login2fa", code);
      else if (!(await totpOk(u.tf.secret, String(code).trim()))) { save(db); throw new ApiError("Authenticator kodu hatalı.", "CODE_INVALID"); }
      newSession(db, u, "2FA"); save(db); return { user: publicUser(u) };
    },
    async logout() { const db = loadDb(); const a = byToken(db); if (a) { a.s.revoked = true; event(db, a.u.id, "logout"); save(db); } localStorage.removeItem(TOK_KEY); return { ok: true }; },
    async logoutAll() { const db = loadDb(); const { u } = need(db); Object.values(db.sessions).forEach((s) => { if (s.userId === u.id) s.revoked = true; }); event(db, u.id, "logout_all"); save(db); localStorage.removeItem(TOK_KEY); return { ok: true }; },
    async forgot({ email }) {
      const db = loadDb(); const u = byEmail(db, email || "");
      if (u && u.verified) { throttle(db, "f:" + u.id, 3, 15 * 60e3, "Çok sık istek. Biraz bekleyin."); sendCode(db, u, "reset", "FOREVYE ID parola sıfırlama"); }
      save(db); return { ok: true }; // hesap var/yok bilgisi sızdırılmaz
    },
    async reset({ email, code, password }) {
      const db = loadDb(); const u = byEmail(db, email || "");
      if (!u) throw new ApiError("Kod hatalı veya süresi dolmuş.", "CODE_INVALID");
      const pe = validatePassword(password); if (pe) throw new ApiError(pe, "VALIDATION");
      checkPending(db, u, "reset", code);
      u.salt = rndHex(16); u.hash = await hashPw(password, u.salt); u.pwUpdatedAt = now();
      Object.values(db.sessions).forEach((s) => { if (s.userId === u.id) s.revoked = true; });
      event(db, u.id, "password_reset"); mail(db, u.email, "Parolanız değiştirildi", "FOREVYE ID parolanız sıfırlandı ve tüm oturumlar kapatıldı."); save(db);
      return { ok: true };
    },
    async me() { const db = loadDb(); const { u } = need(db); save(db); return publicUser(u); },
    async setUsername({ username }) {
      const db = loadDb(); const { u } = need(db);
      const err = validateUsername(username); if (err) throw new ApiError(err, "VALIDATION");
      if (u.username === username) throw new ApiError("Bu zaten kullanıcı adınız.", "VALIDATION");
      if (Object.values(db.users).some((x) => x.id !== u.id && x.username === username)) throw new ApiError("Bu kullanıcı adı alınmış.", "USERNAME_TAKEN");
      if (u.username) {
        const nxt = nextUsernameChange(u);
        if (nxt && nxt > now()) throw new ApiError("Kullanıcı adını en erken " + new Date(nxt).toLocaleString("tr-TR") + " tarihinde değiştirebilirsiniz.", "COOLDOWN");
        if (now() - u.unameFirstAt < C.USERNAME_FIRST_WINDOW_HOURS * H && changesLeft(u) <= 0) throw new ApiError("İlk 48 saatlik değişiklik hakkınız doldu.", "COOLDOWN");
        u.unameHistory.push({ from: u.username, to: username, at: now() });
      } else { u.unameHistory = []; u.unameFirstAt = now(); }
      // ilk atama sayılmaz; 48 saatlik pencere ilk atamadan başlar
      u.username = username; event(db, u.id, "username", username); save(db);
      return publicUser(u);
    },
    async uploadPhoto({ blob, dataUrl }) {
      const db = loadDb(); const { u } = need(db);
      if (u.photoAt && now() - u.photoAt < C.PHOTO_COOLDOWN_HOURS * H) throw new ApiError("Profil fotoğrafı 24 saatte bir değiştirilebilir. Sonraki hak: " + new Date(u.photoAt + C.PHOTO_COOLDOWN_HOURS * H).toLocaleString("tr-TR"), "COOLDOWN");
      if (blob.size > C.PHOTO_MAX_BYTES) throw new ApiError("Dosya 2 MB sınırını aşıyor.", "VALIDATION");
      const t = await sniffImage(blob); if (!["jpg", "png", "webp"].includes(t)) throw new ApiError("Yalnızca JPG, PNG veya WEBP kabul edilir.", "VALIDATION");
      u.photo = dataUrl; u.photoAt = now(); event(db, u.id, "photo"); save(db); return publicUser(u);
    },
    async deletePhoto() { const db = loadDb(); const { u } = need(db); u.photo = null; event(db, u.id, "photo_removed"); save(db); return publicUser(u); },
    async sessions() {
      const db = loadDb(); const { u, s } = need(db); save(db);
      return Object.values(db.sessions).filter((x) => x.userId === u.id && !x.revoked).sort((a, b) => b.lastActive - a.lastActive)
        .map((x) => ({ id: x.id, device: x.device, deviceType: x.deviceType, location: x.ip, lastActive: x.lastActive, createdAt: x.createdAt, status: "Etkin", current: x.id === s.id }));
    },
    async revokeSession(id) {
      const db = loadDb(); const { u, s } = need(db); const t = db.sessions[id];
      if (!t || t.userId !== u.id) throw new ApiError("Oturum bulunamadı.", "NOT_FOUND");
      t.revoked = true; event(db, u.id, "session_revoked"); save(db);
      if (id === s.id) localStorage.removeItem(TOK_KEY);
      return { ok: true, wasCurrent: id === s.id };
    },
    async events() { const db = loadDb(); const { u } = need(db); return db.events.filter((e) => e.userId === u.id).slice(0, 25); },
    async catalog(params) {
      const db = loadDb(); need(db);
      const pub = (db.catalog || []).filter((a) => a.status === "published").map((a) => normApp(Object.assign({}, a)));
      return filterCatalog(pub, params || {});
    },
    async apps(params) {
      const db = loadDb(); const { u } = need(db);
      const all = (db.catalog || []).filter((a) => a.status === "published" || (u.apps[a.id] && u.apps[a.id].connected)).map((a) => {
        const x = u.apps[a.id] || { connected: false, displayName: "" };
        return normApp(Object.assign({}, a, { connected: x.connected, displayName: x.displayName }));
      });
      return filterCatalog(all, params || {});
    },
    /* Yalnızca demo: katalogu büyüterek ön yüzün sabit uygulama sayısına bağlı olmadığını denemek için. */
    demoGrowCatalog(n) {
      const db = loadDb(); const cats = ["finans", "iot", "uretkenlik", "medya", "oyun"]; const have = db.catalog.length;
      for (let i = have; i < n; i++) db.catalog.push({ id: "demo-app-" + (i + 1), name: "Demo Uygulama " + (i + 1), description: "Registry'ye sonradan eklenmiş örnek uygulama.", category: cats[i % cats.length], scopes: ["openid", "profile:read"], status: "published" });
      save(db);
    },
    async setAppName(id, displayName) {
      const db = loadDb(); const { u } = need(db); if (!u.apps[id]) throw new ApiError("Uygulama bulunamadı.", "NOT_FOUND");
      displayName = (displayName || "").trim(); if (displayName.length > 32) throw new ApiError("Görünen ad en fazla 32 karakter olabilir.", "VALIDATION");
      u.apps[id].displayName = displayName; save(db); return { ok: true };
    },
    async connectApp(id) { const db = loadDb(); const { u } = need(db); if (!(db.catalog || []).some((a) => a.id === id && a.status === "published")) throw new ApiError("Uygulama bulunamadı veya yayında değil.", "NOT_FOUND"); u.apps[id] = u.apps[id] || {}; u.apps[id].connected = true; save(db); return { ok: true }; },
    async disconnectApp(id) { const db = loadDb(); const { u } = need(db); if (u.apps[id]) u.apps[id].connected = false; event(db, u.id, "app_disconnected", id); save(db); return { ok: true }; },
    async twoFaStart({ method, password }) {
      const db = loadDb(); const { u } = need(db);
      if ((await hashPw(password || "", u.salt)) !== u.hash) throw new ApiError("Parola hatalı (güvenli yeniden doğrulama).", "BAD_CREDENTIALS");
      if (!["email", "totp"].includes(method)) throw new ApiError("Geçersiz yöntem.", "VALIDATION");
      if (method === "email") { sendCode(db, u, "tfsetup", "FOREVYE ID 2FA kurulum kodu"); u.tfDraft = { method }; save(db); return { method }; }
      const secret = b32enc(rnd(20)); u.tfDraft = { method, secret }; save(db);
      return { method, secret, uri: "otpauth://totp/FOREVYE%20ID:" + encodeURIComponent(u.email) + "?secret=" + secret + "&issuer=FOREVYE%20ID" };
    },
    async twoFaEnable({ code }) {
      const db = loadDb(); const { u } = need(db); const d = u.tfDraft; if (!d) throw new ApiError("Önce kurulumu başlatın.", "VALIDATION");
      if (d.method === "email") checkPending(db, u, "tfsetup", code);
      else if (!(await totpOk(d.secret, String(code).trim()))) throw new ApiError("Authenticator kodu hatalı.", "CODE_INVALID");
      u.tf = { method: d.method, secret: d.secret }; delete u.tfDraft; event(db, u.id, "2fa_enabled", d.method);
      mail(db, u.email, "İki aşamalı doğrulama açıldı", "Yöntem: " + (d.method === "email" ? "E-posta kodu" : "Authenticator uygulaması")); save(db); return publicUser(u);
    },
    async twoFaDisable({ password }) {
      const db = loadDb(); const { u } = need(db);
      if ((await hashPw(password || "", u.salt)) !== u.hash) throw new ApiError("Parola hatalı.", "BAD_CREDENTIALS");
      u.tf = null; event(db, u.id, "2fa_disabled"); mail(db, u.email, "İki aşamalı doğrulama kapatıldı", "Hesabınızda 2FA devre dışı bırakıldı."); save(db); return publicUser(u);
    },
    async googleLogin() {
      // DEMO: gerçek Google akışı yok; sahte bir Google hesabıyla giriş/bağlama simüle edilir.
      const db = loadDb(); const gmail = "demo.kullanici@gmail.com"; let me = byToken(db);
      if (me) { me.u.google = { sub: "g_demo", email: gmail }; event(db, me.u.id, "google_linked"); save(db); return { user: publicUser(me.u) }; }
      let u = Object.values(db.users).find((x) => x.google);
      if (!u) {
        const id = "usr_" + rndHex(8);
        u = db.users[id] = { id, email: gmail, salt: rndHex(16), hash: rndHex(32), verified: true, createdAt: now(), pwUpdatedAt: now(), google: { sub: "g_demo", email: gmail }, apps: {} };
      }
      newSession(db, u, "Google"); save(db); return { user: publicUser(u) };
    },
    async googleUnlink() { const db = loadDb(); const { u } = need(db); u.google = null; event(db, u.id, "google_unlinked"); save(db); return publicUser(u); },
    async deleteAccount({ password, unlinkGoogle }) {
      const db = loadDb(); const { u } = need(db);
      if ((await hashPw(password || "", u.salt)) !== u.hash && !u.google) throw new ApiError("Parola hatalı.", "BAD_CREDENTIALS");
      Object.values(db.sessions).forEach((s) => { if (s.userId === u.id) s.revoked = true; });
      delete db.users[u.id]; save(db); localStorage.removeItem(TOK_KEY);
      return { ok: true, googleLinkRemoved: !!unlinkGoogle };
    },
    hasSession() { const db = loadDb(); return !!byToken(db); },
    demoMailbox() { return loadDb().mail; },
    demoReset() { localStorage.removeItem(DB_KEY); localStorage.removeItem(TOK_KEY); }
  };

  /* ========================================================================
   *  GERÇEK API İSTEMCİSİ  (şartname bölüm 15 uç noktaları)
   *  Not: bölüm 15'te olmayan uçlar README'de "Varsayım" olarak işaretlidir.
   * ====================================================================== */
  const TK = "fid_tokens";
  let refreshInFlight = null;
  function apiBase() {
    const raw = String(C.API_BASE || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(raw)) throw new ApiError("API_BASE geçerli bir HTTPS adresi olmalı. config.js dosyasını kontrol edin.", "CONFIG");
    return raw;
  }
  function saveTokens(value) {
    if (!value || typeof value.accessToken !== "string" || !value.accessToken) {
      throw new ApiError("Sunucu oturum anahtarı döndürmedi. API yanıt sözleşmesini kontrol edin.", "BAD_RESPONSE");
    }
    const next = { accessToken: value.accessToken, refreshToken: typeof value.refreshToken === "string" ? value.refreshToken : null };
    localStorage.setItem(TK, JSON.stringify(next));
    return next;
  }
  const loadTokens = () => { try { const t = JSON.parse(localStorage.getItem(TK) || "{}"); return t && typeof t === "object" ? t : {}; } catch (e) { return {}; } };
  const clearTokens = () => { try { localStorage.removeItem(TK); } catch (e) {} };
  const tokens = loadTokens;

  async function timedFetch(url, init = {}, timeoutMs = C.API_TIMEOUT_MS || 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    } catch (e) {
      if (controller.signal.aborted || (e && e.name === "AbortError")) {
        const err = new ApiError("Sunucu isteği zaman aşımına uğradı (" + Math.round(timeoutMs / 1000) + " sn). Worker yanıt vermiyor olabilir.", "TIMEOUT");
        throw err;
      }
      const origin = (window.location && window.location.origin) || "bu site";
      const err = new ApiError("Sunucu isteği tamamlanamadı. Worker kapalı/yanlış adresli olabilir veya CORS, " + origin + " kaynağına izin vermiyor. API_BASE: " + String(C.API_BASE || "tanımsız"), "NETWORK", null, e);
      throw err;
    } finally { clearTimeout(timer); }
  }
  async function readResponse(res) {
    if (res.status === 204) return null;
    const raw = await res.text().catch(() => "");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return { message: raw.slice(0, 500), nonJson: true }; }
  }
  function responseError(res, data) {
    let msg = data && (data.message || data.err || (typeof data.error === "string" ? data.error : data.error && data.error.message));
    if (!msg && res.status === 404) msg = "Bu API uç noktası sunucuda bulunamadı (404). Worker sürümünü ve /identity rotalarını kontrol edin.";
    if (!msg && res.status === 405) msg = "Sunucu bu isteği desteklemiyor (405). API uç noktası veya HTTP yöntemi uyumsuz.";
    if (!msg && res.status === 429) msg = "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.";
    if (!msg && res.status >= 500) msg = "Kimlik sunucusunda geçici bir hata oluştu (" + res.status + "). Worker günlüklerini kontrol edin.";
    if (!msg) msg = "İstek başarısız (" + res.status + ")";
    return new ApiError(msg, (data && data.code) || "HTTP_" + res.status, res.status);
  }
  async function refreshAccessToken() {
    const current = tokens();
    if (!current.refreshToken) return false;
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const res = await timedFetch(apiBase() + "/identity/token/refresh", {
          method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken })
        }, C.API_TIMEOUT_MS || 12000);
        const data = await readResponse(res);
        if (!res.ok) {
          if ([400, 401, 403, 404].includes(res.status)) { clearTokens(); return false; }
          throw responseError(res, data);
        }
        saveTokens(data);
        return true;
      })().finally(() => { refreshInFlight = null; });
    }
    return refreshInFlight;
  }
  async function http(path, { method = "GET", body, form, auth = true, retry = true } = {}) {
    const base = apiBase();
    const headers = { Accept: "application/json" };
    if (auth && tokens().accessToken) headers.Authorization = "Bearer " + tokens().accessToken;
    if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await timedFetch(base + path, {
        method, headers, body: form || (body !== undefined && body !== null ? JSON.stringify(body) : undefined)
      });
    } catch (e) {
      if (e && typeof e === "object") e.endpoint = base + path;
      throw e;
    }
    if (res.status === 401 && auth) {
      if (retry && tokens().refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return http(path, { method, body, form, auth, retry: false });
      }
      clearTokens();
      throw new ApiError("Oturumunuz sona erdi. Lütfen yeniden giriş yapın.", "UNAUTHORIZED", 401);
    }
    const data = await readResponse(res);
    if (!res.ok) {
      const err = responseError(res, data);
      err.endpoint = base + path;
      throw err;
    }
    return data;
  }
  function loadGis() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.id) return res();
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = res; s.onerror = () => rej(new ApiError("Google betiği yüklenemedi.", "NETWORK")); document.head.appendChild(s);
    });
  }
  /* Sunucu dizi de döndürebilir ({items,total,...} da); ikincisi sunucu taraflı sayfalama demektir. */
  function normList(r, params) {
    if (Array.isArray(r)) return filterCatalog(r.map(normApp), params || {});
    const items = (r.items || r.apps || []).map(normApp);
    return { items, total: r.total != null ? r.total : items.length, page: r.page || 1, pageSize: r.pageSize || items.length || 12, categories: r.categories || [...new Set(items.map((a) => a.category))].sort() };
  }
  const real = {
    register: (b) => http("/identity/register", { method: "POST", body: b, auth: false }),
    verifyEmail: (b) => http("/identity/email/verify", { method: "POST", body: b, auth: false }),
    resendVerification: (b) => http("/identity/email/resend", { method: "POST", body: b, auth: false }),
    async login(b) { const r = await http("/identity/login", { method: "POST", body: b, auth: false }); if (r.accessToken) saveTokens(r); else if (r.twoFactorRequired) clearTokens(); if (r.accessToken && !r.user) r.user = await real.me(); return r; },
    async logout() { try { await http("/identity/logout", { method: "POST" }); } finally { localStorage.removeItem(TK); } return { ok: true }; },
    async logoutAll() { try { await http("/identity/logout-all", { method: "POST" }); } finally { localStorage.removeItem(TK); } return { ok: true }; },
    forgot: (b) => http("/identity/password/forgot", { method: "POST", body: b, auth: false }),
    reset: (b) => http("/identity/password/reset", { method: "POST", body: b, auth: false }),
    me: () => http("/identity/profile"),
    setUsername: (b) => http("/identity/username", { method: "PATCH", body: b }),
    async uploadPhoto({ blob }) { const f = new FormData(); f.append("photo", blob, "profil.webp"); return http("/identity/profile/photo", { method: "POST", form: f }); },
    deletePhoto: () => http("/identity/profile/photo", { method: "DELETE" }),
    sessions: () => http("/identity/sessions"),
    revokeSession: (id) => http("/identity/sessions/" + encodeURIComponent(id), { method: "DELETE" }),
    events: () => http("/identity/security-events"),
    /* Mikro-Klima Worker'ın gerçek uç noktası GET /identity/apps'tir.
       /v1/me/apps için Authorization başlığıyla yapılan CORS preflight bu Worker'da
       desteklenmiyor; tarayıcı 404/405'i JavaScript'e ulaştırmadan NETWORK hatası üretir.
       Bu yüzden var olmayan /v1 uçlarına istek atma. Arama/kategori/sayfalama normList'te
       istemci tarafında uygulanır; sunucu mevcut kullanıcıya ait gerçek kayıtları döndürür. */
    async catalog(params) {
      const r = await http("/identity/apps");
      return normList(r, params);
    },
    async apps(params) {
      try {
        const r = await http("/identity/apps");
        return normList(r, params);
      } catch (e) {
        if (e && typeof e === "object" && !e.endpoint) e.endpoint = apiBase() + "/identity/apps";
        throw e;
      }
    },
    setAppName: (id, displayName) => http("/identity/apps/" + encodeURIComponent(id), { method: "PATCH", body: { displayName } }),
    connectApp: (id) => http("/identity/apps/" + encodeURIComponent(id), { method: "POST" }),
    disconnectApp: (id) => http("/identity/apps/" + encodeURIComponent(id), { method: "DELETE" }),
    twoFaStart: (b) => http("/identity/2fa/enable", { method: "POST", body: b }),
    twoFaEnable: (b) => http("/identity/2fa/enable", { method: "POST", body: b }),
    twoFaDisable: (b) => http("/identity/2fa/disable", { method: "POST", body: b }),
    async googleLogin() {
      if (!C.GOOGLE_CLIENT_ID) throw new ApiError("GOOGLE_CLIENT_ID config.js içinde tanımlı değil.", "CONFIG");
      throw new ApiError("Google Identity Services bağlantısı henüz eklenmedi (README: Google bölümü).", "NOT_IMPLEMENTED");
    },
    /* Google Identity Services: resmi düğme kimlik jetonunu (credential) verir; doğrulama sunucuda yapılır */
    async googleButton(el, onCredential) {
      if (!C.GOOGLE_CLIENT_ID) throw new ApiError("Google ile giriş için GOOGLE_CLIENT_ID config.js içinde tanımlı olmalı.", "CONFIG");
      await loadGis();
      google.accounts.id.initialize({ client_id: C.GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential) });
      google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", locale: "tr", width: 300 });
    },
    async googleSignIn(credential) {
      const r = await http("/identity/oauth/google", { method: "POST", body: { credential }, auth: false });
      if (r.accessToken) { saveTokens(r); r.user = await real.me(); } else if (r.twoFactorRequired) clearTokens();
      return r;
    },
    googleLink: (credential) => http("/identity/oauth/google/link", { method: "POST", body: { credential } }),
    /* "FOREVYE ID ile giriş": uygulama izni (kod + PKCE). Kodu uygulama sunucuda/istemcide token/exchange ile değiştirir. */
    authorizeInfo: (b) => http("/identity/authorize/info", { method: "POST", body: b }),
    authorize: (b) => http("/identity/authorize", { method: "POST", body: b }),
    googleUnlink: () => http("/identity/oauth/google", { method: "DELETE" }),
    deleteAccount: (b) => http("/identity/account", { method: "DELETE", body: b }),
    hasSession: () => !!tokens().accessToken
  };

  window.FID = { api: C.MOCK ? mock : real, ApiError, SCOPE_LABEL, scopeId, scopeText, validateUsername, validatePassword, sniffImage, totp, EMAIL_RE, config: C };
})();
