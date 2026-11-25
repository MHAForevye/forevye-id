import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = () => { const w = {}; vm.runInNewContext(readFileSync(new URL('../config.js', import.meta.url), 'utf8'), { window: w }); return w.FOREVYE_CONFIG; };

test('config.js: üretim ayarı gerçek Identity Worker\'a işaret eder (MOCK kapalı, HTTPS, sonda / yok)', () => {
  const c = load();
  assert.equal(c.MOCK, false);
  assert.match(c.API_BASE, /^https:\/\/[a-z0-9.-]+\.workers\.dev$/, 'API_BASE https + workers.dev olmalı, sonunda / olmamalı');
  assert.equal(c.API_BASE, 'https://mikroklimakontrolmerkezi.forevye.workers.dev');
});
test('worker/identity-cors.mjs yedek modül olarak işaretli (Mikro-Klima Worker\'ı CORS\'u kendi yönetir)', () => {
  assert.match(readFileSync(new URL('../worker/identity-cors.mjs', import.meta.url), 'utf8'), /YEDEK \/ ESKİ MODÜL/);
});
