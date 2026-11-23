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
      API_BASE: 'https://mikroklimakontrolmerkezi.forevye.workers.dev',
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

const workerApps = [
  { id: 'sanal-banka', name: 'Sanal Banka', scopes: ['kimlik', 'bakiye'], connected: true, displayName: 'Ana kartım' },
  { id: 'nexus-pass', name: 'Nexus Pass', scopes: ['kimlik', 'bakiye'], connected: false, displayName: '' },
  { id: 'mikro-klima', name: 'Mikro-Klima', scopes: ['kimlik'], connected: true, displayName: '' },
  { id: 'print', name: 'FOREVYE PRINT', scopes: ['kimlik', 'siparis'], connected: false, displayName: '' },
  { id: 'retro-camera', name: 'RETRO CAMERA', scopes: ['kimlik', 'fotograf'], connected: false, displayName: '' },
  { id: 'mantar-pano', name: 'Mantar Pano', scopes: ['kimlik'], connected: false, displayName: '' },
];

test('uygulama listesi doğrudan Worker tarafından sunulan /identity/apps rotasını çağırır', async () => {
  const calls = [];
  const api = makeApi(async (url, init) => {
    calls.push({ url, init });
    return response(200, workerApps);
  });
  const result = await api.apps({ page: 1, pageSize: 12 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://mikroklimakontrolmerkezi.forevye.workers.dev/identity/apps');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-access');
  assert.equal(result.total, 6);
  assert.equal(result.items[0].id, 'sanal-banka');
  assert.equal(result.items[0].connected, true);
  assert.equal(result.items[0].displayName, 'Ana kartım');
});

test('arama, kategori ve sayfalama Worker sözleşmesiyle uyumlu biçimde istemcide uygulanır', async () => {
  let calls = 0;
  const api = makeApi(async () => { calls++; return response(200, workerApps); });
  const result = await api.apps({ q: 'nexus', page: 1, pageSize: 12 });
  assert.equal(calls, 1);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'nexus-pass');
});

test('liste ekranında artık var olmayan /v1/me/apps veya /v1/catalog/apps çağrılmaz', async () => {
  const calls = [];
  const api = makeApi(async (url) => { calls.push(url); return response(200, workerApps); });
  await api.apps({ q: 'banka' });
  await api.catalog({ q: 'banka' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.endsWith('/identity/apps')));
  assert.ok(calls.every((url) => !url.includes('/v1/')));
});

test('401 yanıtı oturumu sona ermiş olarak tanımlar, yanlış endpoint yedeğine geçmez', async () => {
  const calls = [];
  const api = makeApi(async (url) => { calls.push(url); return response(401, { code: 'UNAUTHORIZED', message: 'Oturum geçersiz.' }); });
  await assert.rejects(api.apps({}), (error) => error.code === 'UNAUTHORIZED' && error.status === 401);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/identity/apps'));
});

test('ağ hatasında doğru Identity endpoint bilgisi korunur', async () => {
  const api = makeApi(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.apps({}), (error) => error.code === 'NETWORK' && error.endpoint.endsWith('/identity/apps'));
});
