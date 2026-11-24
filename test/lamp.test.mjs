import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../lamp.js', import.meta.url), 'utf8');

function createLamp() {
  const values = new Map();
  const handlers = new Map();
  const attrs = new Map();
  const beamLayer = { style: {} };
  const head = {
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { handlers.set(type, fn); },
    setAttribute(name, value) { attrs.set(name, value); },
    setPointerCapture() {},
  };
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 660 }) };
  const stage = {
    className: '', innerHTML: '',
    querySelector(selector) { return selector === 'svg' ? svg : selector === '#lampHead' ? head : selector === '#lampBeamLayer' ? beamLayer : null; },
  };
  const document = { createElement: () => stage, body: { appendChild(el) { assert.equal(el, stage); } } };
  const localStorage = { getItem: (k) => values.has(k) ? values.get(k) : null, setItem: (k, v) => values.set(k, String(v)) };
  vm.runInNewContext(source, { document, localStorage, Number, Math, String });
  const event = (type, data = {}) => handlers.get(type)({ preventDefault() {}, pointerId: 1, ...data });
  return { stage, head, beamLayer, attrs, values, event };
}

test('masa lambası sayfaya eklenir ve ışık sürekli açık SVG olarak çizilir', () => {
  const lamp = createLamp();
  assert.equal(lamp.stage.className, 'lamp-stage');
  assert.match(lamp.stage.innerHTML, /Sabit sıcak sarı ışıklı masa lambası/);
  assert.match(lamp.stage.innerHTML, /lamp-beam-layer/);
  assert.match(lamp.stage.innerHTML, /lamp-beam/);
  assert.match(lamp.stage.innerHTML, /lamp-bulb/);
  assert.doesNotMatch(lamp.stage.innerHTML, /lampSwitch|Işığı kapat|brightness/i);
  assert.equal(lamp.attrs.get('aria-valuenow'), '-4');
  assert.match(lamp.head.style.transform, /^rotate\(-4\./);
  assert.equal(lamp.beamLayer.style.transform, lamp.head.style.transform);
});

test('başlık sürüklenince döner, konum kaydedilir ve pointer bırakılınca sürükleme biter', () => {
  const lamp = createLamp();
  lamp.event('pointerdown', { clientX: 244, clientY: 226 });
  lamp.event('pointermove', { clientX: 242.936, clientY: 238.155 });
  assert.match(lamp.head.style.transform, /^rotate\(6\./);
  assert.equal(lamp.beamLayer.style.transform, lamp.head.style.transform);
  lamp.event('pointerup');
  assert.ok(Math.abs(Number(lamp.values.get('fid_ui_lamp_angle_v1')) - 6) < 0.02);
});

test('klavye ile açı ayarlanır ve mekanik sınırlar aşılmaz', () => {
  const lamp = createLamp();
  lamp.event('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.match(lamp.head.style.transform, /^rotate\(4\./);
  for (let i = 0; i < 10; i++) lamp.event('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.equal(lamp.attrs.get('aria-valuenow'), '30');
  assert.equal(lamp.values.get('fid_ui_lamp_angle_v1'), '30');
});

test('önceden saklanan lamba açısı sayfa açılışında geri yüklenir', () => {
  const lamp = createLamp();
  lamp.values.set('fid_ui_lamp_angle_v1', '17');
  const again = createLampWithStorage(lamp.values);
  assert.match(again.head.style.transform, /^rotate\(17\./);
  assert.equal(again.beamLayer.style.transform, again.head.style.transform);
  assert.equal(again.attrs.get('aria-valuenow'), '17');
});

function createLampWithStorage(values) {
  const handlers = new Map(); const attrs = new Map();
  const beamLayer = { style: {} };
  const head = { style: {}, classList: { add() {}, remove() {} }, addEventListener(t, fn) { handlers.set(t, fn); }, setAttribute(k,v) { attrs.set(k,v); }, setPointerCapture() {} };
  const svg = { getBoundingClientRect: () => ({ left:0, top:0, width:300, height:660 }) };
  const stage = { className:'', innerHTML:'', querySelector(s) { return s === 'svg' ? svg : s === '#lampHead' ? head : beamLayer; } };
  const document = { createElement: () => stage, body: { appendChild() {} } };
  const localStorage = { getItem: (k) => values.has(k) ? values.get(k) : null, setItem: (k,v) => values.set(k,String(v)) };
  vm.runInNewContext(source, { document, localStorage, Number, Math, String });
  return { head, beamLayer, attrs };
}
