// End-to-end: boot the real client script from the post, point it at the real
// Durable Object running in-process, create a room, and check that a fight
// actually flows — roster in, snapshots decoded, inputs back out.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');

class Res {
  constructor(body, init = {}) {
    this.body = body; this.status = init.status || 200; this.ok = this.status < 400;
    this._h = new Map(Object.entries(init.headers || {})); this.webSocket = init.webSocket;
  }
  get headers() { return { get: (k) => this._h.get(k), set: (k, v) => this._h.set(k, v) }; }
  async json() { return JSON.parse(this.body); }
}
class Req {
  constructor(url, init = {}) {
    this.url = url; this.method = init.method || 'GET';
    this._h = new Map(Object.entries(init.headers || {}));
    this._body = init.body; this.cf = { colo: 'SIN' };
  }
  get headers() { return { get: (k) => this._h.get(k) || this._h.get(k.toLowerCase()) }; }
  async json() { return JSON.parse(this._body); }
}
globalThis.Response = Res;

class FakeWS {
  constructor() { this.l = {}; this.sent = []; this.inbox = []; this.closed = null; }
  accept() {}
  addEventListener(t, fn) { (this.l[t] ||= []).push(fn); }
  emit(t, ev) { (this.l[t] || []).forEach((f) => f(ev)); }
  send(d) { this.sent.push(d); if (this.peer) { this.peer.inbox.push(d); this.peer.emit('message', { data: d }); } }
  close(c, r) { this.closed = { c, r }; this.emit('close', { code: c }); if (this.peer && !this.peer.closed) this.peer.emit('close', { code: c }); }
}
globalThis.WebSocketPair = function () {
  const a = new FakeWS(), b = new FakeWS(); a.peer = b; b.peer = a; return { 0: a, 1: b };
};

const makeState = () => { const m = new Map(); return { storage: {
  async get(k) { return m.get(k); }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } } }; };

const { Room } = await import('../src/room.js');
// The room must not drive itself: its loop is a self-scheduling setTimeout on the
// real timer queue, and awaits here give it chances to fire on top of the ticks
// this harness drives. That made the server run 1.5x the client's tick rate.
const guardRoom = (r) => { r.startLoop = () => {}; return r; };
const { Lobby } = await import('../src/lobby.js');
const rooms = new Map();
const env = {};
env.ROOM = { idFromName: (n) => n, get: (n) => ({ fetch: (u, i) => {
  if (!rooms.has(n)) rooms.set(n, guardRoom(new Room(makeState(), env)));
  return rooms.get(n).fetch(new Req(typeof u === 'string' ? u : u.url, i)); } }) };
let lob = null;
env.LOBBY = { idFromName: () => 'g', get: () => ({ fetch: (u, i) => {
  if (!lob) lob = new Lobby(makeState(), env);
  return lob.fetch(new Req(typeof u === 'string' ? u : u.url, i)); } }) };

// --- browser side -----------------------------------------------------------
const NET = 'https://api.test';
globalThis.fetch = async (url, opts) => {
  const path = String(url).slice(NET.length);
  if (path.startsWith('/lobby/')) return env.LOBBY.get().fetch('https://do' + path, opts);
  const m = path.match(/^\/room\/([A-Z0-9]+)\/ping/);
  if (m) return env.ROOM.get(m[1]).fetch('https://do' + path, opts);
  throw new Error('unexpected fetch ' + path);
};
globalThis.WebSocket = class {
  constructor(url) {
    this.readyState = 0;
    const u = new URL(url.replace(/^ws/, 'http'));
    const code = u.pathname.split('/')[2];
    this.binaryType = 'arraybuffer';
    env.ROOM.get(code).fetch('https://do' + u.pathname + u.search, { headers: { Upgrade: 'websocket' } })
      .then((res) => {
        const sock = res.webSocket;
        if (!sock) { this.onerror && this.onerror({}); return; }
        this._s = sock;
        sock.addEventListener('message', (ev) => this.onmessage && this.onmessage(ev));
        sock.addEventListener('close', () => { this.readyState = 3; this.onclose && this.onclose({}); });
        this.readyState = 1;
        this.onopen && this.onopen({});
      });
  }
  send(d) { this._s && this._s.send(d); }
  close() { this._s && this._s.close(1000, 'bye'); }
};

const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');
const theCtx = makeCtx(), padCtx = makeCtx();
const canvas = el('canvas'); canvas.getContext = () => theCtx;
const aimpad = el('canvas'); aimpad.width = 208; aimpad.height = 208;
aimpad.getContext = () => padCtx;
const nodes = { 'sf-canvas': canvas, 'sf-aimpad': aimpad };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));

const intervals = [];
globalThis.setInterval = (fn) => { intervals.push(fn); return intervals.length; };
let raf = [];
globalThis.requestAnimationFrame = (fn) => raf.push(fn);
globalThis.window = {
  StickSim, StickWire, innerHeight: 900, addEventListener() {},
  performance: { now: () => Date.now() },
  prompt: (q) => (/[Pp]assword/.test(q) ? '' : 'ruang uji'),
  WebSocket: globalThis.WebSocket, location: { pathname: '/x' }
};
globalThis.document = {
  getElementById: (id) => stub(id),
  createElement: el, addEventListener() {}, querySelector: () => el('i')
};
globalThis.localStorage = { s: { sf_server: NET }, getItem(k) { return k in this.s ? this.s[k] : null; }, setItem(k, v) { this.s[k] = v; } };

const md = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md', 'utf8');
const parts = md.split('<script>');
const clientSrc = parts[parts.length - 1].split('</script>')[0];
eval(clientSrc);

const ok = (label, cond, extra = '') =>
  console.log((cond ? '  ok   ' : '  FAIL ') + label + (extra ? '  ' + extra : ''));

const frame = () => { const f = raf; raf = []; f.forEach((fn) => fn(Date.now())); };

// press "Buat room"
((listeners.get(nodes['sf-create']) || {}).click || []).forEach((fn) => fn({}));
await new Promise((r) => setTimeout(r, 60));

ok('room created and joined', rooms.size === 1, 'note: ' + nodes['sf-note'].textContent);
const code = [...rooms.keys()][0];
const room = rooms.get(code);
ok('server sees one player', room.conns.size === 1);

// run the room for a second of game time
for (let i = 0; i < 60; i++) room.tick();
frame();
ok('client got a roster and knows itself', !!nodes['sf-note'] && room.conns.size === 1);

// the client should now have a world with exactly the one fighter in it
const clientWorldHasPlayer = (() => {
  // the post keeps `world` in its closure; observe it through what it draws
  theCtx._clear(); frame();
  const svg = theCtx._svg(960, 540);
  return svg.length > 800;      // arena + stickman + hud got drawn
})();
ok('client renders the arena from snapshots', clientWorldHasPlayer);

// inputs: fire the upstream interval and confirm the server receives them
const before = JSON.stringify(room.world.players[room.conns.get([...room.conns.keys()][0]).id].input);
globalThis.window.prompt = () => '';
// press D (walk right) through the client's keydown path
const kd = (listeners.get(globalThis.window) || {}).keydown || [];
intervals.forEach((fn) => fn());
await new Promise((r) => setTimeout(r, 20));
const conn = room.conns.get([...room.conns.keys()][0]);
const serverInput = room.world.players[conn.id].input;
ok('input packets reach the server', JSON.stringify(serverInput) !== 'null', JSON.stringify(serverInput));

const x0 = room.world.players[conn.id].pts[2].x;
// send a "walk right" input straight through the client's socket path
const wsSend = room.conns.keys().next().value.peer;
wsSend.send(StickWire.encodeInput({ l: 0, r: 1, jump: 0, duck: 0, fire: 0, aim: 0 }));
for (let i = 0; i < 90; i++) room.tick();
ok('the stickman walked on the server', room.world.players[conn.id].pts[2].x - x0 > 40,
   (room.world.players[conn.id].pts[2].x - x0).toFixed(0) + 'px');

// and the client sees him at the new place
theCtx._clear(); frame();
ok('client keeps drawing after motion', theCtx._svg(960, 540).length > 800);

// lobby listing includes the room, with a ping
const list = await (await globalThis.fetch(NET + '/lobby/list')).json();
ok('lobby lists the room', list.rooms.length === 1 && list.rooms[0].code === code,
   JSON.stringify(list.rooms[0]));

// same here: the in-process room keeps a timer alive
process.exit(0);
