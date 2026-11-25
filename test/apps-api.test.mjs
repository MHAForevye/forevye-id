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


test('FOREVYE ID izin ekranı sanal-banka için yetki bilgisini ve PKCE onayını gerçek uçlara yollar', async () => {
  const calls = [];
  const api = makeApi(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/identity/authorize/info')) return response(200, { app: { id: 'sanal-banka', name: 'Sanal Banka', scopes: ['openid', 'profile:read'] }, email: 'uye@example.com' });
    if (url.endsWith('/identity/authorize')) return response(200, { redirect: 'https://forevye-nexus.forevyenexus.workers.dev/api/auth/id/callback?code=abc&state=xyz' });
    return response(404, { message: 'not found' });
  });
  const info = await api.authorizeInfo({ app: 'sanal-banka', redirect: 'https://forevye-nexus.forevyenexus.workers.dev/api/auth/id/callback' });
  assert.equal(info.app.id, 'sanal-banka');
  const grant = await api.authorize({ app: 'sanal-banka', redirect: 'https://forevye-nexus.forevyenexus.workers.dev/api/auth/id/callback', state: 'state-value', challenge: 'pkce-challenge-value' });
  assert.match(grant.redirect, /\/api\/auth\/id\/callback/);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith('/identity/authorize/info'));
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-access');
  assert.ok(calls[1].url.endsWith('/identity/authorize'));
  assert.deepEqual(JSON.parse(calls[1].init.body), { app: 'sanal-banka', redirect: 'https://forevye-nexus.forevyenexus.workers.dev/api/auth/id/callback', state: 'state-value', challenge: 'pkce-challenge-value' });
});

test('FOREVYE ID canlı sayfası lambayı ve kimlik sunucusu bağlantı durumunu yükler', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const lamp = fs.readFileSync(new URL('../lamp.js', import.meta.url), 'utf8');
  assert.match(html, /<script src="lamp\.js"><\/script>/);
  assert.match(css, /\.lamp-stage\{/);
  assert.match(lamp, /pointerdown/);
  assert.match(lamp, /pointermove/);
  assert.match(lamp, /ArrowLeft/);
  assert.match(html + app + css, /Bağlantıyı sına|data-server-check|connection-status/);
  assert.doesNotMatch(lamp, /Işığı kapat|lampSwitch|lbLevel/);
});
