import test from "node:test";
import assert from "node:assert/strict";
import { withIdentityCors } from "../worker/identity-cors.mjs";

const env = { ID_ORIGIN: "https://mhaforevye.github.io" };
const url = "https://mikroklimakontrolmerkezi.forevye.workers.dev/identity/login";

test("allowed GitHub Pages origin gets a successful preflight", async () => {
  const request = new Request(url, {
    method: "OPTIONS",
    headers: {
      Origin: "https://mhaforevye.github.io",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  const response = await withIdentityCors(request, env, () => assert.fail("preflight must not reach route dispatcher"));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://mhaforevye.github.io");
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/i);
});

test("unknown origins are rejected without reflecting an arbitrary origin", async () => {
  const request = new Request(url, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
  const response = await withIdentityCors(request, env, () => assert.fail("blocked origin must not reach route dispatcher"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("actual responses keep their status/body and receive CORS headers", async () => {
  const request = new Request(url, { headers: { Origin: "https://mhaforevye.github.io" } });
  const response = await withIdentityCors(request, env, async () => new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json", Vary: "Accept-Encoding" } }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://mhaforevye.github.io");
  assert.equal(response.headers.get("vary"), "Accept-Encoding, Origin");
  assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
});

test("non-identity routes pass through untouched", async () => {
  const request = new Request("https://example.workers.dev/api/health", { method: "OPTIONS", headers: { Origin: "https://mhaforevye.github.io" } });
  const response = await withIdentityCors(request, env, async () => new Response("market", { status: 200 }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(await response.text(), "market");
});

test("preflight rejects unsupported request headers", async () => {
  const request = new Request(url, { method: "OPTIONS", headers: { Origin: "https://mhaforevye.github.io", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-secret-header" } });
  const response = await withIdentityCors(request, env, () => assert.fail("invalid headers must not reach route dispatcher"));
  assert.equal(response.status, 400);
});
