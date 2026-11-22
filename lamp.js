/* FOREVYE ID — etkileşimli masa lambası
 * Yalnızca arayüz tercihlerini (açı, parlaklık, açık/kapalı) localStorage'a yazar; kimlik/güvenlik verisi YAZMAZ.
 * Başlık sürüklenebilir (fare/dokunmatik) ve klavye ile (←/→) döndürülebilir. Otomatik salınım ~40 sn, düşük genlikli;
 * prefers-reduced-motion veya sekme arka plandayken durur. */
(function () {
  const KEY = "fid_ui_lamp", MIN = -32, MAX = 28, DEF = { on: true, level: 1, angle: -6 };
  const LEVELS = [{ n: "Loş", v: 0.55 }, { n: "Orta", v: 0.85 }, { n: "Aydınlık", v: 1.15 }];
  const root = document.documentElement;
  const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let st = Object.assign({}, DEF);
  try { const p = JSON.parse(localStorage.getItem(KEY)); if (p && typeof p === "object") st = { on: p.on !== false, level: [0, 1, 2].includes(p.level) ? p.level : DEF.level, angle: Math.max(MIN, Math.min(MAX, +p.angle || DEF.angle)) }; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const clamp = (a) => Math.max(MIN, Math.min(MAX, a));

  const stage = document.createElement("div");
  stage.className = "lamp-stage"; stage.setAttribute("aria-hidden", "false");
  stage.innerHTML = `
  <svg class="lamp" viewBox="0 0 260 640" role="group" aria-label="Masa lambası">
    <defs><linearGradient id="coneG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4d69a" stop-opacity=".30"/><stop offset="1" stop-color="#f4d69a" stop-opacity="0"/></linearGradient></defs>
    <ellipse cx="130" cy="616" rx="96" ry="9" fill="#000" opacity=".45"/>
    <rect x="30" y="604" width="200" height="6" rx="3" fill="#1d1a14"/>
    <path d="M76 604 q0-22 54-22 q54 0 54 22z" fill="#141310" stroke="#2a251b"/>
    <g stroke="#1a1813" stroke-width="9" stroke-linecap="round" fill="none"><path d="M130 584 L84 392"/><path d="M84 392 L168 214"/></g>
    <g stroke="#2d281d" stroke-width="2" stroke-linecap="round" fill="none"><path d="M130 584 L84 392"/><path d="M84 392 L168 214"/></g>
    <circle cx="130" cy="584" r="8" fill="#201d16" stroke="#3a3324"/><circle cx="84" cy="392" r="8" fill="#201d16" stroke="#3a3324"/>
    <g class="lamp-head" id="lampHead" tabindex="0" role="slider" aria-label="Lamba başlığının açısı" aria-valuemin="${MIN}" aria-valuemax="${MAX}" style="transform-origin:168px 214px">
      <polygon class="lamp-cone" points="150,262 40,640 -80,640 -10,262" transform="translate(-6 0)"/>
      <circle cx="168" cy="214" r="9" fill="#201d16" stroke="#3a3324"/>
      <path d="M168 214 L120 238" stroke="#1a1813" stroke-width="8" stroke-linecap="round"/>
      <path class="lamp-shade" d="M92 232 Q112 196 150 236 L134 276 Q108 286 86 270 Z" fill="#181610" stroke="#3a3324"/>
      <ellipse class="lamp-bulb" cx="108" cy="276" rx="22" ry="7"/>
    </g>
    <g class="lamp-switch" id="lampSwitch" tabindex="0" role="switch" aria-label="Masa lambası ışığı">
      <rect x="112" y="590" width="36" height="14" rx="7" fill="#12110e" stroke="#3a3324"/><circle class="knob" cx="122" cy="597" r="5"/>
    </g>
  </svg>`;
  const bar = document.createElement("div");
  bar.className = "lamp-bar";
  bar.innerHTML = `<button type="button" class="btn sm" id="lbOn" aria-pressed="true"></button>
    <label class="sr" for="lbLevel">Lamba parlaklığı</label>
    <select id="lbLevel">${LEVELS.map((l, i) => `<option value="${i}">${l.n}</option>`).join("")}</select>
    <button type="button" class="btn sm" id="lbReset">Varsayılan</button>`;
  document.body.prepend(stage); document.body.appendChild(bar);

  const head = stage.querySelector("#lampHead"), sw = stage.querySelector("#lampSwitch");
  let sway = 0, dragging = false;
  function paint() {
    const a = clamp(st.angle + sway);
    head.style.transform = "rotate(" + a.toFixed(2) + "deg)";
    head.setAttribute("aria-valuenow", Math.round(st.angle));
    root.style.setProperty("--lamp-x", (82 - a * 0.55).toFixed(1) + "%");
    root.style.setProperty("--lamp-b", LEVELS[st.level].v);
    root.classList.toggle("lamp-off", !st.on);
    sw.setAttribute("aria-checked", st.on); bar.querySelector("#lbOn").textContent = st.on ? "Işığı kapat" : "Işığı aç";
    bar.querySelector("#lbOn").setAttribute("aria-pressed", st.on); bar.querySelector("#lbLevel").value = st.level;
  }
  const set = (p) => { Object.assign(st, p); st.angle = clamp(st.angle); save(); paint(); };

  /* sürükleme: işaretçinin pivota göre açısı */
  head.addEventListener("pointerdown", (e) => { dragging = true; head.setPointerCapture(e.pointerId); head.classList.add("grab"); e.preventDefault(); });
  head.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = head.ownerSVGElement.getBoundingClientRect(), k = r.width / 260;
    const dx = e.clientX - (r.left + 168 * k), dy = e.clientY - (r.top + 214 * k);
    /* başlık pivottan sola-aşağıya (~37°) bakar; işaretçi daha aşağıdaysa saat yönünün tersine (negatif) döner */
    const ang = 37 - Math.atan2(dy, -dx) * 180 / Math.PI;
    st.angle = clamp(ang); paint();
  });
  const end = () => { if (dragging) { dragging = false; head.classList.remove("grab"); save(); } };
  head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
  head.addEventListener("keydown", (e) => {
    const d = e.shiftKey ? 8 : 3;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { set({ angle: st.angle - d }); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { set({ angle: st.angle + d }); e.preventDefault(); }
  });
  const toggle = () => set({ on: !st.on });
  sw.addEventListener("click", toggle);
  sw.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { toggle(); e.preventDefault(); } });
  bar.querySelector("#lbOn").onclick = toggle;
  bar.querySelector("#lbLevel").onchange = (e) => set({ level: +e.target.value });
  bar.querySelector("#lbReset").onclick = () => set(Object.assign({}, DEF));

  /* yavaş salınım: ~40 sn, ±3°, sadece başlık; ~30 fps */
  let raf = 0, last = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    if (t - last < 33) return; last = t;
    if (dragging || !st.on) return;
    sway = Math.sin((t / 40000) * 2 * Math.PI) * 3; paint();
  }
  function run() {
    cancelAnimationFrame(raf); raf = 0;
    if (mq.matches || document.hidden) { sway = 0; paint(); return; }
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", run);
  (mq.addEventListener ? mq.addEventListener("change", run) : mq.addListener && mq.addListener(run));
  paint(); run();
})();
