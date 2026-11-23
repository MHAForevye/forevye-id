import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const apiSource = fs.readFileSync(new URL('../api.js', import.meta.url), 'utf8');

function makeApi(fetchImpl) {
  const store = new Map([['fid_tokens', JSON.stringify({ accessToken: 'test-access', refreshToken: null })]]);
  const localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const window = {
    FOREVYE_CONFIG: {
      MOCK: false,
      API_BASE: 'https://id.example.test',
      API_TIMEOUT_MS: 2000,
      HEALTH_TIMEOUT_MS: 1000,
      PASSWORD_MIN_LENGTH: 10,
    },
    location: { origin: 'https://mhaforevye.github.io' },
    dispatchEvent() {},
  };
  const context = {
    window, localStorage, fetch: fetchImpl, CustomEvent,
    AbortController, URLSearchParams, TextEncoder, setTimeout, clearTimeout,
    crypto: globalThis.crypto || { getRandomValues: (a) => a },
    navigator: { userAgent: 'Node test' },
    console,
  };
  vm.runInNewContext(apiSource, context, { filename: 'api.js' });
  return window.FID.api;
}

function response(status, data) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => data == null ? '' : JSON.stringify(data),
  };
}

test('yeni apps rotası 404 ise eski rota kullanılır ve query korunur', async () => {
  const calls = [];
  const api = makeApi(async (url) => {
    calls.push(url);
    if (url.includes('/v1/me/apps')) return response(404, { code: 'not_found' });
    return response(200, { items: [{ id: 'nexus', name: 'Nexus', scopes: [] }], total: 1, page: 1, pageSize: 12, categories: ['finans'] });
  });
  const result = await api.apps({ q: 'nexus', category: 'finans', page: 2, pageSize: 12 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'nexus');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /\/identity\/apps\?/);
  assert.match(calls[1], /q=nexus/);
  assert.match(calls[1], /category=finans/);
  assert.match(calls[1], /page=2/);
});

test('yeni apps rotası 405 ise eski rotaya düşer', async () => {
  const calls = [];
  const api = makeApi(async (url) => {
    calls.push(url);
    return url.includes('/v1/me/apps') ? response(405, { message: 'method not allowed' }) : response(200, []);
  });
  const result = await api.apps({ page: 1, pageSize: 12 });
  assert.equal(result.total, 0);
  assert.equal(calls.length, 2);
});

test('yeni rota 500 döndürürse fallback yapıp hatayı gizlemez', async () => {
  const calls = [];
  const api = makeApi(async (url) => {
    calls.push(url);
    return response(503, { code: 'unavailable', message: 'temporary outage' });
  });
  await assert.rejects(api.apps({}), (error) => error.status === 503 && error.endpoint.includes('/v1/me/apps'));
  assert.equal(calls.length, 1);
});

test('iki uygulama listesi rotası da yoksa iki adresi raporlar', async () => {
  const calls = [];
  const api = makeApi(async (url) => {
    calls.push(url);
    return response(404, { code: 'not_found', message: 'not found' });
  });
  await assert.rejects(api.apps({}), (error) => {
    assert.equal(error.code, 'APP_REGISTRY_UNAVAILABLE');
    assert.equal(error.attempts.length, 2);
    assert.match(error.attempts[0], /v1\/me\/apps/);
    assert.match(error.attempts[1], /identity\/apps/);
    return true;
  });
  assert.equal(calls.length, 2);
});

test('bağlantı hatasında endpoint bilgisi korunur', async () => {
  const api = makeApi(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.apps({}), (error) => error.code === 'NETWORK' && error.endpoint.includes('/v1/me/apps'));
});
