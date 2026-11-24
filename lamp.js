/* FOREVYE ID — sabit sıcak ışıklı, sürüklenebilir mimari masa lambası.
 * Işık daima açıktır ve parlaklığı değişmez. Yalnızca başlık yönü saklanır. */
(function () {
  "use strict";
  const KEY = "fid_ui_lamp_angle_v1";
  const MIN = -34, MAX = 30, DEFAULT_ANGLE = -4;
  const clamp = (n) => Math.max(MIN, Math.min(MAX, n));
  let angle = DEFAULT_ANGLE;
  try {
    const stored = Number(localStorage.getItem(KEY));
    if (Number.isFinite(stored) && localStorage.getItem(KEY) !== null) angle = clamp(stored);
  } catch (_) { /* storage is optional */ }

  const stage = document.createElement("div");
  stage.className = "lamp-stage";
  stage.innerHTML = `
    <svg class="lamp" viewBox="0 0 300 660" role="img" aria-label="Sabit sıcak sarı ışıklı masa lambası">
      <defs>
        <linearGradient id="lampMetal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#39352d"/><stop offset=".22" stop-color="#96815c"/>
          <stop offset=".48" stop-color="#292720"/><stop offset=".72" stop-color="#b69a68"/><stop offset="1" stop-color="#302d25"/>
        </linearGradient>
        <linearGradient id="lampShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4b4537"/><stop offset=".38" stop-color="#24221c"/>
          <stop offset="1" stop-color="#11120f"/>
        </linearGradient>
        <linearGradient id="lampBeam" x1="0" y1="0" x2=".1" y2="1">
          <stop offset="0" stop-color="#ffd47a" stop-opacity=".30"/>
          <stop offset=".42" stop-color="#ffc45c" stop-opacity=".11"/>
          <stop offset="1" stop-color="#ffc45c" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stop-color="#ffe7ad" stop-opacity=".28"/><stop offset="1" stop-color="#f9bd58" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g class="lamp-beam-layer" id="lampBeamLayer" aria-hidden="true">
        <path class="lamp-beam" fill="url(#lampBeam)" d="M82 270 L-78 652 L238 652 L132 270Z"/>
        <ellipse cx="107" cy="336" rx="126" ry="160" fill="url(#lampGlow)"/>
      </g>
      <ellipse cx="132" cy="632" rx="110" ry="13" fill="#000" opacity=".55"/>
      <ellipse cx="132" cy="620" rx="102" ry="18" fill="#171713" stroke="#62543a" stroke-width="2"/>
      <ellipse cx="132" cy="615" rx="83" ry="9" fill="url(#lampMetal)" opacity=".95"/>
      <path d="M95 612 Q94 589 132 585 Q170 589 169 612Z" fill="#24231e" stroke="#81704c" stroke-width="1.6"/>
      <path d="M132 590 L87 406 L174 226" fill="none" class="lamp-metal" stroke="url(#lampMetal)" stroke-width="13"/>
      <path d="M132 590 L87 406 L174 226" fill="none" stroke="#c6aa74" stroke-opacity=".32" stroke-width="2.1"/>
      <path d="M130 583 L89 410" stroke="#11120f" stroke-width="3" opacity=".85"/>
      <path d="M91 399 Q110 385 124 401" fill="none" stroke="#95805a" stroke-width="4" stroke-linecap="round"/>
      <circle class="lamp-joint" cx="132" cy="590" r="10" fill="#29251d" stroke="#88704a" stroke-width="2"/>
      <circle class="lamp-joint" cx="87" cy="406" r="10" fill="#29251d" stroke="#88704a" stroke-width="2"/>
      <g class="lamp-head" id="lampHead" tabindex="0" role="slider" aria-label="Lamba başlığını sürükleyerek veya ok tuşlarıyla yönlendir" aria-valuemin="${MIN}" aria-valuemax="${MAX}" aria-valuenow="${Math.round(angle)}">
        <path d="M174 226 L132 247" fill="none" stroke="url(#lampMetal)" stroke-width="12" stroke-linecap="round"/>
        <path d="M174 226 L132 247" fill="none" stroke="#cfb17a" stroke-opacity=".38" stroke-width="2" stroke-linecap="round"/>
        <path class="lamp-shade" d="M88 239 Q115 194 159 226 L139 282 Q109 294 76 267Z" fill="url(#lampShade)" stroke="#8c764e" stroke-width="2"/>
        <path d="M88 239 Q115 194 159 226" fill="none" stroke="#b79a65" stroke-width="2.5"/>
        <path class="lamp-grip" d="M76 267 Q109 294 139 282" fill="none" stroke="#d8b66f" stroke-width="8" stroke-linecap="round"/>
        <ellipse class="lamp-bulb" cx="108" cy="278" rx="19" ry="7" fill="#ffe8ad"/>
        <path d="M88 281 Q107 290 128 282" fill="none" stroke="#ffe1a0" stroke-width="2" opacity=".9"/>
        <circle cx="174" cy="226" r="10" fill="#29251d" stroke="#b99b64" stroke-width="2"/>
        <circle cx="174" cy="226" r="3" fill="#e1c184"/>
      </g>
      <path d="M82 620 Q132 637 182 620" fill="none" stroke="#b49a6b" stroke-opacity=".38" stroke-width="1.5"/>
    </svg>`;
  document.body.appendChild(stage);

  const svg = stage.querySelector("svg");
  const head = stage.querySelector("#lampHead");
  const beamLayer = stage.querySelector("#lampBeamLayer");
  let drag = null;
  function save() { try { localStorage.setItem(KEY, String(angle)); } catch (_) {} }
  function paint() {
    const rotation = `rotate(${angle.toFixed(2)}deg)`;
    head.style.transform = rotation;
    beamLayer.style.transform = rotation;
    head.setAttribute("aria-valuenow", String(Math.round(angle)));
  }
  function toSvgPoint(event) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * 300 / rect.width,
      y: (event.clientY - rect.top) * 660 / rect.height
    };
  }
  function pointerAngle(point) { return Math.atan2(point.y - 226, point.x - 174) * 180 / Math.PI; }
  function normalizeDelta(value) {
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }
  head.addEventListener("pointerdown", (event) => {
    const point = toSvgPoint(event);
    drag = { pointerId: event.pointerId, startAngle: angle, startPointerAngle: pointerAngle(point) };
    try { head.setPointerCapture(event.pointerId); } catch (_) {}
    head.classList.add("grab");
    event.preventDefault();
  });
  head.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = normalizeDelta(pointerAngle(toSvgPoint(event)) - drag.startPointerAngle);
    angle = clamp(drag.startAngle + delta);
    paint();
  });
  function endDrag(event) {
    if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    drag = null; head.classList.remove("grab"); save();
  }
  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);
  head.addEventListener("lostpointercapture", endDrag);
  head.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 8 : 3;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") angle = clamp(angle - step);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") angle = clamp(angle + step);
    else return;
    paint(); save(); event.preventDefault();
  });
  paint();
})();
