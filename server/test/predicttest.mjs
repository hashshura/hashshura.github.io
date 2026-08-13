// Boot the real client against an in-process Durable Object, add an artificial
// 120ms round trip, and check: does the local body respond immediately, and does
// it stay agreed with the server?
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');

class Res { constructor(b, i = {}) { this.body=b; this.status=i.status||200; this.ok=this.status<400;
    this._h=new Map(Object.entries(i.headers||{})); this.webSocket=i.webSocket; }
  get headers(){ return { get:(k)=>this._h.get(k), set:(k,v)=>this._h.set(k,v) }; }
  async json(){ return JSON.parse(this.body); } }
class Req { constructor(u, i = {}) { this.url=u; this.method=i.method||'GET';
    this._h=new Map(Object.entries(i.headers||{})); this._body=i.body; this.cf={colo:'SIN'}; }
  get headers(){ return { get:(k)=>this._h.get(k)||this._h.get(k.toLowerCase()) }; }
  async json(){ return JSON.parse(this._body); } }
globalThis.Response = Res;
// Buffers anything sent before a listener exists. The room sends the roster
// synchronously inside the upgrade, which in a browser cannot arrive before the
// handshake finishes — without buffering, the test silently loses it.
class FakeWS { constructor(){ this.l={}; this.q=[]; } accept(){}
  addEventListener(t,f){ (this.l[t] ||= []).push(f);
    if (t === 'message' && this.q.length) { const q = this.q; this.q = [];
      q.forEach((d) => this.emit('message', { data:d })); } }
  emit(t,e){ (this.l[t]||[]).forEach(f=>f(e)); }
  send(d){ if (!this.peer) return;
    if ((this.peer.l.message||[]).length) this.peer.emit('message', { data:d });
    else this.peer.q.push(d); }
  close(){ this.emit('close',{}); } }
globalThis.WebSocketPair = function(){ const a=new FakeWS(), b=new FakeWS(); a.peer=b; b.peer=a; return {0:a,1:b}; };
const makeState = () => { const m=new Map(); return { storage:{ async get(k){return m.get(k);},
  async put(k,v){m.set(k,v);}, async delete(k){m.delete(k);} } }; };

const { Room } = await import('../src/room.js');
const rooms = new Map();
const env = { LOBBY:{ idFromName:()=>'g', get:()=>({ fetch: async()=>new Res('{}') }) } };
env.ROOM = { idFromName:(n)=>n, get:(n)=>({ fetch:(u,i)=>{ if(!rooms.has(n)) rooms.set(n,new Room(makeState(),env));
  return rooms.get(n).fetch(new Req(typeof u==='string'?u:u.url, i)); } }) };

const LATENCY = Number(process.env.SF_LAT || 60);   // one way
const pending = [];
const deliver = (fn) => pending.push({ at: clock + LATENCY, fn });
function pump() { for (let i = pending.length - 1; i >= 0; i--) {
  if (pending[i].at <= clock) { const p = pending.splice(i,1)[0]; p.fn(); } } }

const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');
const NET = 'https://api.test';
globalThis.fetch = async (url, opts) => {
  const path = String(url).slice(NET.length);
  if (path.startsWith('/lobby/create')) {
    const room = env.ROOM.get('TEST');
    await room.fetch('https://do/room/TEST/config', { method:'POST', body: JSON.stringify({ name:'t' }) });
    return new Res(JSON.stringify({ code:'TEST' }));
  }
  if (path.startsWith('/lobby/list')) return new Res(JSON.stringify({ rooms: [] }));
  return new Res(null, { status: 204 });
};
globalThis.WebSocket = class {
  constructor(url) {
    this.readyState = 0;
    const u = new URL(url.replace(/^ws/, 'http'));
    env.ROOM.get('TEST').fetch('https://do' + u.pathname + u.search, { headers:{Upgrade:'websocket'} })
      .then((res) => { const sock = res.webSocket; this._s = sock;
        sock.addEventListener('message', (ev) => deliver(() => this.onmessage && this.onmessage(ev)));
        this.readyState = 1; deliver(() => this.onopen && this.onopen({})); });
  }
  send(d) { const s = this._s; deliver(() => s && s.send(d)); }
  close() {}
};

const main = makeCtx(), padc = makeCtx();
const canvas = el('canvas'); canvas.width=960; canvas.height=540; canvas.clientWidth=960;
canvas.getContext = () => main;
const aimpad = el('canvas'); aimpad.width=256; aimpad.height=256; aimpad.getContext=()=>padc;
const padEl = el('div'); padEl.querySelectorAll = () => [];
padEl.getBoundingClientRect = () => ({left:0,top:0,width:190,height:170});
const nodes = { 'sf-canvas':canvas, 'sf-aimpad':aimpad, 'sf-pad':padEl };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));
let clock = 1000;
const RealDate = Date;
globalThis.Date = new Proxy(RealDate, {
  apply: (t, self, a) => new RealDate(...a),
  construct: (t, a) => (a.length ? new RealDate(...a) : new RealDate(clock)),
  get: (t, k) => (k === 'now' ? () => clock : RealDate[k])
});
const intervals = [];
globalThis.setInterval = (fn) => { intervals.push(fn); return 1; };
let raf = [];
globalThis.requestAnimationFrame = (fn) => raf.push(fn);
globalThis.window = { StickSim, StickWire, innerHeight:900, addEventListener(){},
  performance: { now: () => clock }, prompt: () => '', location: { pathname:'/x' } };
globalThis.document = { getElementById: stub, createElement: el, addEventListener(){}, querySelector: ()=>el('i') };
globalThis.localStorage = { s:{ sf_server: NET, sf_predict: '1' }, getItem(k){ return k in this.s ? this.s[k] : null; }, setItem(){} };
const worlds = [];
const realCreate = StickSim.createWorld;
StickSim.createWorld = function (seed) { const w = realCreate(seed); worlds.push(w); return w; };

const post = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md','utf8');
eval(post.split('<script>').pop().split('</script>')[0]);

const room = () => rooms.get('TEST');
// The client's join path is promise-based, so the microtask queue has to drain
// between frames; a synchronous loop would never run a single .then().
const run = async (n) => { for (let i = 0; i < n; i++) { tick(); await new Promise((r) => setImmediate(r)); } };
function tick() {                       // one 16.7ms slice of wall clock
  clock += 16.7;
  pump();
  if (room() && room().world) room().tick();
  intervals.forEach((fn) => fn());
  const f = raf; raf = []; f.forEach((fn) => fn(clock));
}
const ok = (l,c,x='') => console.log((c?'  ok   ':'  FAIL ')+l+(x?'  '+x:''));

((listeners.get(nodes['sf-create'])||{}).click||[]).forEach(fn=>fn({}));
await run(120);
const chips = nodes['sf-score'].childNodes.filter(n => n.className && n.className.indexOf('who') === 0);
console.log('  debug: note=' + JSON.stringify(nodes['sf-note'].textContent),
            '| worlds=' + worlds.length, '| score chips=' + chips.length,
            '| gear=' + JSON.stringify(nodes['sf-gear-what'].textContent),
            '| snapshots seen by client=' + (worlds.length > 1 ? Object.keys(worlds[1].players).length + ' players decoded' : 'n/a'));
ok('joined the room over a 120ms link', !!room() && room().conns.size === 1);

// the predicted body is the client's second world
const predWorld = worlds[worlds.length-1];
const pred = predWorld && predWorld.players['local'];
ok('prediction is running', !!pred);

// press right and watch how fast the LOCAL body moves versus the server's
const srvId = room().conns.get([...room().conns.keys()][0]).id;
const srv = room().world.players[srvId];
const x0p = pred.pts[StickSim.HIPS].x, x0s = srv.pts[StickSim.HIPS].x;
const keydown = null;
pad_press();
function pad_press(){ const L = listeners.get(nodes['sf-pad']) || {};
  (L.pointerdown||[]).forEach(fn => fn({ clientX:175, clientY:85, pointerId:1, pointerType:'touch', buttons:1, preventDefault(){} })); }
let localAt = null, serverAt = null;
for (let i=1;i<=60;i++){
  tick(); await new Promise((r) => setImmediate(r));
  if (!localAt && Math.abs(pred.pts[StickSim.HIPS].x - x0p) > 3) localAt = i * 16.7;
  if (!serverAt && Math.abs(srv.pts[StickSim.HIPS].x - x0s) > 3) serverAt = i * 16.7;
}
// Both pay the same acceleration ramp; what prediction removes is the one-way
// trip. So the test is the gap between them, not an absolute number.
ok('local body reacts a full network hop sooner than the server',
   localAt !== null && serverAt !== null && serverAt - localAt >= 45,
   'local ' + localAt.toFixed(0) + 'ms vs server ' + serverAt.toFixed(0) + 'ms on a ' + (LATENCY*2) + 'ms round trip');

// Pace back and forth well inside a deck for six seconds and watch the gap. A
// body walking off the map would diverge for legitimate reasons (one side falls,
// the other does not), which says nothing about the reconciliation.
const L = listeners.get(nodes['sf-pad']) || {};
const press = (x) => (L.pointerdown||[]).forEach(fn => fn({ clientX:x, clientY:85,
  pointerId:1, pointerType:'touch', buttons:1, preventDefault(){} }));
const release = () => (L.pointerup||[]).forEach(fn => fn({ pointerId:1, pointerType:'touch', preventDefault(){} }));
let worstX = 0, worstY = 0, samples = 0;
const deck = room().world.platforms.slice().sort((a,b)=>b.y-a.y)[0];
for (let i = 0; i < 360; i++) {
  const px = pred.pts[StickSim.HIPS].x;
  press(px > deck.x + deck.w - 130 ? 20 : (px < deck.x + 130 ? 175 : (i % 120 < 60 ? 175 : 20)));
  tick(); await new Promise((r) => setImmediate(r));
  const sv = room().world.players[srvId].pts[StickSim.HIPS];
  if (i > 60) { samples++;
    worstX = Math.max(worstX, Math.abs(pred.pts[StickSim.HIPS].x - sv.x));
    worstY = Math.max(worstY, Math.abs(pred.pts[StickSim.HIPS].y - sv.y)); }
}
release();
const dhip = () => { const q = pred.pts[StickSim.HIPS];
  return { x: q.dx !== undefined ? q.dx : q.x, y: q.dy !== undefined ? q.dy : q.y }; };
// The actual complaint: does the body visibly jump? Measure the largest
// single-frame movement while walking. A run is ~4.4px per frame, so anything
// much beyond that is a correction the player sees as a teleport.
let worstJump = 0, jumps = 0;
let last = dhip().x, lastY = dhip().y;
for (let i = 0; i < 300; i++) {
  const px = pred.pts[StickSim.HIPS].x;
  press(px > deck.x + deck.w - 130 ? 20 : (px < deck.x + 130 ? 175 : (i % 120 < 60 ? 175 : 20)));
  tick(); await new Promise((r) => setImmediate(r));
  const d = Math.abs(dhip().x - last) + Math.abs(dhip().y - lastY);
  last = dhip().x; lastY = dhip().y;
  if (i > 30) { worstJump = Math.max(worstJump, d); if (d > 10) jumps++; }
}
release();
ok('the local body never teleports', worstJump < 10,
   'worst single-frame move ' + worstJump.toFixed(1) + 'px, ' + jumps + ' frames over 10px');

// Jumping: the server starts the jump a round trip after we do, so for that
// window the two bodies are at genuinely different heights.
let worstAir = 0;
let ly = dhip().y, lx = dhip().x;
for (let i = 0; i < 300; i++) {
  press(i % 90 < 8 ? 95 : (i % 40 < 20 ? 175 : 20));      // up, then left/right
  if (i % 90 === 8) release();
  tick(); await new Promise((r) => setImmediate(r));
  const d = Math.abs(dhip().x - lx) + Math.abs(dhip().y - ly);
  lx = dhip().x; ly = dhip().y;
  if (i > 20) worstAir = Math.max(worstAir, d);
}
release();
ok('jumping does not teleport the body', worstAir < 16,
   'worst single-frame move while jumping ' + worstAir.toFixed(1) + 'px');

// Being hit: the server knocks us sideways; the client cannot have predicted it.
const sbody = room().world.players[srvId];
StickSim.step(room().world);
sbody.pts.forEach((q) => { q.ox += 9; q.oy += 4; });     // a sword's shove
sbody.flail = 26;
let worstHit = 0, worstHitServer = 0;
let sx = sbody.pts[StickSim.HIPS].x, sy = sbody.pts[StickSim.HIPS].y;
lx = pred.pts[StickSim.HIPS].dx !== undefined ? pred.pts[StickSim.HIPS].dx : pred.pts[StickSim.HIPS].x;
ly = pred.pts[StickSim.HIPS].dy !== undefined ? pred.pts[StickSim.HIPS].dy : pred.pts[StickSim.HIPS].y;
for (let i = 0; i < 90; i++) {
  tick(); await new Promise((r) => setImmediate(r));
  const h = pred.pts[StickSim.HIPS];
  const dxNow = h.dx !== undefined ? h.dx : h.x, dyNow = h.dy !== undefined ? h.dy : h.y;
  const d = Math.abs(dxNow - lx) + Math.abs(dyNow - ly);
  lx = dxNow; ly = dyNow;
  worstHit = Math.max(worstHit, d);
  // the same body on the server: pure physics, no corrections. If the client is
  // not adding jumps, its worst frame should look like the server's worst frame.
  const sv = room().world.players[srvId].pts[StickSim.HIPS];
  worstHitServer = Math.max(worstHitServer, Math.abs(sv.x - sx) + Math.abs(sv.y - sy));
  sx = sv.x; sy = sv.y;
}
// The replay covers one tick per tick of latency, so on the frame a correction
// lands, more of the body's own motion is compressed into it the further away you
// are. Hence the latency term: it is not slack for sloppiness, it is the shape of
// the problem.
ok('a hit moves the drawn body no harder than physics moves it on the server',
   worstHit <= worstHitServer * 1.4 + 4 + LATENCY * 0.045,
   'client ' + worstHit.toFixed(1) + 'px vs server ' + worstHitServer.toFixed(1) + 'px in the worst frame');

ok('gap stays within what latency explains', worstX < 25 + LATENCY * 0.35, 'worst horizontal gap ' + worstX.toFixed(0) + 'px over ' + samples + ' samples');
ok('no vertical desync', worstY < 40, 'worst vertical gap ' + worstY.toFixed(0) + 'px');
// Death and respawn: the server picks a spawn point with its own random state,
// and if the local prediction respawns too it picks a different one — so the body
// would flick between the two until they agree.
const sbody2 = room().world.players[srvId];
sbody2.pts.forEach((q) => { q.y = 760; q.oy = 760; });   // into the pit, which is fatal
await run(8);
let worstDeath = 0, flicks = 0, aliveFor = -1, positions = new Set();
let px0 = pred.pts[StickSim.HIPS].x, py0 = pred.pts[StickSim.HIPS].y;
for (let i = 0; i < 320; i++) {
  tick(); await new Promise((r) => setImmediate(r));
  const h = pred.pts[StickSim.HIPS];
  const moved = Math.abs(h.x - px0) + Math.abs(h.y - py0);
  px0 = h.x; py0 = h.y;
  // Two teleports are expected and correct: the news of the death arriving a
  // latency late, and the respawn itself. A flicker is a jump AFTER that — the
  // local body and the server disagreeing about where the spawn was.
  aliveFor = pred.dead ? -1 : aliveFor + 1;
  if (aliveFor > 3 && moved > 40) {
    worstDeath = Math.max(worstDeath, moved); flicks++; positions.add(Math.round(h.x / 50));
    if (process.env.SF_DEBUG) console.log('    flick at frame ' + i + ' -> ' + h.x.toFixed(0) + ',' + h.y.toFixed(0) + ' moved ' + moved.toFixed(0));
  }
}
ok('the test actually killed and respawned him', sbody2.deaths > 0 && !sbody2.dead,
   'deaths=' + sbody2.deaths + ' dead=' + sbody2.dead + ' hp=' + sbody2.hp);
ok('the respawned body does not flick between spawn points', flicks === 0,
   flicks + ' unexplained jump(s), worst ' + worstDeath.toFixed(0) + 'px, ' + positions.size + ' distinct places');
// Toggle lag compensation off, move around, then back on. The tick counter and
// the input history number the packets the server acks, so freezing them while
// the toggle is off used to mean every packet went out under the same sequence
// number, and switching back on replayed a history recorded before the switch.
const fire = (id, type) => ((listeners.get(nodes[id]) || {})[type] || []).forEach((fn) => fn({ target: nodes[id] }));
const padAt = (x, type) => ((listeners.get(nodes['sf-pad']) || {})[type] || []).forEach((fn) =>
  fn({ clientX: x, clientY: 85, pointerId: 1, pointerType: 'touch', buttons: 1, preventDefault(){} }));
// Pace back and forth rather than holding one direction: walking straight for
// two seconds takes him off the edge, and a fall reads as a lurch.
const walk = (dir) => { padAt(dir > 0 ? 175 : 15, 'pointerup'); padAt(dir > 0 ? 175 : 15, 'pointerdown'); };

walk(1);
await run(14);
nodes['sf-lagcomp'].checked = false; fire('sf-lagcomp', 'change');
walk(-1);
await run(24);
nodes['sf-lagcomp'].checked = true;  fire('sf-lagcomp', 'change');
const live = () => { const w = worlds[worlds.length - 1]; return w && w.players['local']; };
await run(2);
let worstToggle = 0, bigToggle = 0, died = false;
// The drawn position, not the simulated one: corrections are eased out in the
// draw offset, so the simulation can step while the body on screen glides.
const drawn = () => { const q = live().pts[StickSim.HIPS];
  return { x: q.dx !== undefined ? q.dx : q.x, y: q.dy !== undefined ? q.dy : q.y }; };
let tx = drawn().x, ty = drawn().y;
const startX = tx; let travelled = 0;
for (let i = 0; i < 90; i++) {
  if (i % 18 === 0) walk(i % 36 === 0 ? 1 : -1);
  tick(); await new Promise((r) => setImmediate(r));
  const h = drawn();
  const moved = Math.abs(h.x - tx) + Math.abs(h.y - ty);
  tx = h.x; ty = h.y;
  if (live().dead) died = true;
  travelled = Math.max(travelled, Math.abs(h.x - startX));
  if (i > 3 && !died) { worstToggle = Math.max(worstToggle, moved); if (moved > 20) bigToggle++;
    if (process.env.SF_DEBUG && moved > 20) console.log('    lurch f' + i + ' moved=' + moved.toFixed(0) +
      ' x=' + h.x.toFixed(0) + ' y=' + h.y.toFixed(0)); }
}
ok('he stayed on the map and kept walking across the switch', travelled > 30 && !died,
   'travelled ' + travelled.toFixed(0) + 'px, died=' + died);
ok('switching lag compensation back on does not lurch the body', bigToggle === 0,
   bigToggle + ' frame(s) over 20px, worst ' + worstToggle.toFixed(1) + 'px');
process.exit(0);
