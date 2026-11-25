/**
 * !! YEDEK / ESKİ MODÜL — GEREKMEZ !!
 * Mikro-Klima Worker'ı (MikroKlimaKontrolMerkezi/worker/index.js) CORS'u artık KENDİ İÇİNDE yönetir ve iki GitHub hesabının
 * origin'lerini (mhaforevye.github.io, frovyes.github.io) koda gömülü tutar (worker/origins.js). Bu modülü Worker'a EKLEMEYİN:
 * ikinci bir CORS katmanı yalnızca ID_ORIGIN'e baktığı için yanlış yapılandırmada çakışıp erişimi yeniden kapatabilir.
 * Yalnızca Mikro-Klima dışında, kendi CORS'u olmayan bir Worker'ı FOREVYE ID'ye bağlamak gerekirse kullanın.
 */
/**
 * FOREVYE ID CORS middleware for the Mikro-Klima Cloudflare Worker.
 * Import this module in the existing Worker and wrap the existing /identity/*
 * router/dispatcher. Do not replace the Worker's business routes with this file.
 */
const IDENTITY_PREFIX = "/identity";
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]);
const ALLOWED_HEADERS = new Set(["authorization", "content-type", "accept"]);

function isIdentityRequest(request) {
  const path = new URL(request.url).pathname;
  return path === IDENTITY_PREFIX || path.startsWith(IDENTITY_PREFIX + "/");
}

function configuredOrigins(env) {
  return String(env?.ID_ORIGIN || env?.ID_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try { return new URL(value).origin; } catch { return ""; }
    })
    .filter(Boolean);
}

function corsHeaders(origin) {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  });
}

function mergeVary(headers, value) {
  const existing = headers.get("Vary");
  const values = (existing ? existing.split(",") : []).map((part) => part.trim()).filter(Boolean);
  if (!values.some((part) => part.toLowerCase() === value.toLowerCase())) values.push(value);
  headers.set("Vary", values.join(", "));
}

function jsonError(status, code, message) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

/**
 * @param {Request} request Incoming Worker request.
 * @param {object} env Cloudflare env; must contain ID_ORIGIN.
 * @param {(request: Request) => Promise<Response>} next Existing route dispatcher.
 */
export async function withIdentityCors(request, env, next) {
  if (!isIdentityRequest(request)) return next(request);

  const origin = request.headers.get("Origin");
  // No Origin means a same-origin or server-to-server request; do not invent CORS headers.
  if (!origin) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, POST, PATCH, PUT, DELETE, OPTIONS" } });
    return next(request);
  }

  const allowed = configuredOrigins(env).includes(origin);
  if (!allowed) return jsonError(403, "ORIGIN_NOT_ALLOWED", "Bu kaynak FOREVYE ID API erişim listesinde değil.");

  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    const requestedMethod = (request.headers.get("Access-Control-Request-Method") || "").toUpperCase();
    if (requestedMethod && !ALLOWED_METHODS.has(requestedMethod)) {
      return new Response(null, { status: 405, headers });
    }
    const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
      .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (requestedHeaders.some((header) => !ALLOWED_HEADERS.has(header))) {
      return new Response(null, { status: 400, headers });
    }
    return new Response(null, { status: 204, headers });
  }

  let response;
  try {
    response = await next(request);
  } catch (error) {
    // Keep CORS on thrown server errors too, without exposing internal exception details.
    response = jsonError(500, "INTERNAL_ERROR", "Kimlik sunucusunda beklenmeyen bir hata oluştu.");
  }

  const responseHeaders = new Headers(response.headers);
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "vary") mergeVary(responseHeaders, "Origin");
    else responseHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
