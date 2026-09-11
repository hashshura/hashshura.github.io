// The post's own client script, run under a stub DOM.
//
// There is no browser here, so this cannot tell you the panel looks right. What
// it can tell you is that the script loads, that every control the room panel
// adds is actually wired to something, and that the handlers survive being
// pressed at the awkward moments — before a socket exists, and after it has
// gone. Those are the paths a person finds by accident and a syntax check
// never reaches.
//
//   node test/clienttest.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const POST = path.join(here, '../../_posts/2026-08-12-stick-fight.md');
const src = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(POST, 'utf8'))[1];

let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log('  FAIL ' + n + (x ? '  <' + x + '>' : '')); } else console.log('  ok   ' + n); };
function attempt(name, fn) { try { fn(); ok(name, true); } catch (e) { ok(name, false, e.message); } }

// A canvas context that answers every call with a no-op and every measurement
// with a plausible number, so drawing code runs without a canvas.
const ctx2d = new Proxy({}, {
  get(_t, k) {
    if (k === 'canvas') return { width: 960, height: 540 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    return typeof k === 'string' ? () => {} : undefined;
  },
  set: () => true
});

const els = {};
function mkEl(id) {
  return {
    id, style: {}, dataset: {}, children: [], hidden: false, value: '',
    textContent: '', innerHTML: '', checked: false,
    width: 960, height: 540, clientWidth: 960, clientHeight: 540,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    _l: {},
    addEventListener(t, f) { this._l[t] = f; },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, remove() {},
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    select() {}, focus() {}, blur() {}, setAttribute() {}, getAttribute: () => null,
    querySelector: () => mkEl('q'), querySelectorAll: () => []
  };
}
// Elements start in whatever state the post's own markup puts them in, so that
// "starts hidden" is a claim about the page rather than about this stub.
const HIDDEN = new Set(
  [...fs.readFileSync(POST, 'utf8').matchAll(/<[a-z]+[^>]*\bid="([^"]+)"[^>]*>/g)]
    .filter((m) => /\shidden(\s|>|=)/.test(m[0]))
    .map((m) => m[1])
);
const el = (id) => {
  if (!els[id]) { els[id] = mkEl(id); els[id].hidden = HIDDEN.has(id); }
  return els[id];
};

global.document = {
  getElementById: el,
  createElement: (t) => mkEl(t),
  addEventListener() {}, removeEventListener() {},
  querySelector: () => mkEl('q'), querySelectorAll: () => [],
  documentElement: mkEl('html'), body: mkEl('body'), hidden: false
};
global.window = {
  addEventListener() {}, removeEventListener() {},
  location: { search: '', origin: 'https://ashura.id', pathname: '/stick-fight' },
  performance: { now: () => Date.now() },
  devicePixelRatio: 1, prompt: () => null,
  matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
  StickSim: (await import('../../assets/js/stickfight-sim.js')).default,
  StickWire: (await import('../../assets/js/stickfight-wire.js')).default
};
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] === undefined ? null : this._d[k]; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
};
Object.defineProperty(global, 'navigator', {
  value: { clipboard: { writeText: () => Promise.resolve() }, userAgent: 'node' },
  configurable: true
});
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ rooms: [] }) });
global.WebSocket = class { constructor() { this.readyState = 1; } send() {} close() {} };

console.log('client under a stub DOM:');

let threw = null;
try { new Function(src)(); } catch (e) { threw = e; }
ok('the script loads', !threw, threw && threw.message);
if (threw) { console.log('\n1 FAILED'); process.exit(1); }

// It must have got all the way to the end: the capability guard near the top
// bails out silently, and a stub that trips it would pass every later check by
// never running any of it.
ok('it ran to the end (late controls are wired)', !!el('sf-solo')._l.click);

console.log('the room panel:');
ok('the panel exists and starts hidden', el('sf-room').hidden === true);
ok('ready is wired', !!el('sf-ready')._l.click);
ok('the in-room name box is wired', !!el('sf-roomname')._l.change);
ok('copy invite is wired', !!el('sf-invite')._l.click);
ok('the invite link box starts hidden', el('sf-invite-url').hidden === true);

console.log('pressed at the wrong moment:');
attempt('ready, with no socket', () => el('sf-ready')._l.click());
attempt('ready again, toggling back off', () => el('sf-ready')._l.click());
attempt('rename, with no socket', () => {
  el('sf-roomname').value = 'budi';
  el('sf-roomname')._l.change();
});
ok('the new name reached storage', global.localStorage.getItem('sf_name') === 'budi',
   String(global.localStorage.getItem('sf_name')));
ok('and the menu box agrees with the room box', el('sf-name').value === 'budi');
attempt('rename to blank falls back rather than clearing', () => {
  el('sf-roomname').value = '   ';
  el('sf-roomname')._l.change();
});
ok('a blank rename left a usable name', el('sf-roomname').value === 'you');
attempt('copy invite with no clipboard permission', () => {
  el('sf-invite-url').value = 'https://ashura.id/stick-fight?room=ABCD&key=k';
  el('sf-invite')._l.click();
});
attempt('leaving from the menu is a no-op', () => el('sf-exit')._l.click());

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
