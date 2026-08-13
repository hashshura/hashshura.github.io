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
// The room must not drive itself. Its loop is a self-scheduling setTimeout on the
// real timer queue, and the awaits in this harness give it chances to fire, so it
// ticked on top of the ticks driven here — the server ran 23 ticks where the client
// ran 15, and that mismatch alone produces a divergence no correction can fix. It
// looked exactly like a netcode bug. The harness drives every tick, or none.
const makeRoom = () => { const r = new Room(makeState(), env); r.startLoop = () => {}; return r; };
env.ROOM = { idFromName:(n)=>n, get:(n)=>({ fetch:(u,i)=>{ if(!rooms.has(n)) rooms.set(n,makeRoom());
  return rooms.get(n).fetch(new Req(typeof u==='string'?u:u.url, i)); } }) };

const LATENCY = Number(process.env.SF_LAT || 60);   // one way
const JITTER = Number(process.env.SF_JITTER || 0);  // added, randomly, per message
// Server ticks per client frame. A Durable Object's loop is a self-scheduling
// setTimeout, not a metronome, and a browser's rAF is its own clock — so the two
// simulations do not advance in lockstep the way an in-process test does.
const DRIFT = Number(process.env.SF_DRIFT || 1);
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pending = [];
// Ordering is preserved per direction — this is a WebSocket, not UDP — but the two
// directions are independent. Forcing one shared monotonic clock across both let
// the scheduled times run away from the clock under jitter, and nothing arrived.
const lastAt = { up: 0, down: 0 };
const deliver = (fn, ch = 'down') => {
  const at = Math.max(lastAt[ch], clock + LATENCY + (JITTER ? rnd() * JITTER : 0));
  lastAt[ch] = at;
  pending.push({ at, fn });
};
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
  send(d) { const s = this._s; deliver(() => s && s.send(d), 'up'); }
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
let serverAcc = 0;
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
// How much a client frame varies from 16.7ms, and how often the server's loop
// stalls and then catches up in a burst.
const FRAME_VAR = Number(process.env.SF_FRAMEVAR || 0);
const STALL = Number(process.env.SF_STALL || 0);
let stallLeft = 0, burstLeft = 0, frames = 0;
function tick() {                       // one slice of wall clock
  clock += 16.7 * (1 + (FRAME_VAR ? (rnd() - 0.5) * 2 * FRAME_VAR : 0));
  frames++;
  if (STALL && frames % 120 === 0) { stallLeft = STALL; burstLeft = STALL; }
  pump();
  if (stallLeft > 0) { stallLeft--; }            // the room's loop is not running
  else {
    serverAcc += DRIFT;
    if (burstLeft > 0) { serverAcc += 1; burstLeft--; }   // then it catches up
    while (serverAcc >= 1) { serverAcc -= 1; if (room() && room().world) room().tick(); }
  }
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

// The predicted body lives in whichever world holds a player called 'local'. Wait
// for it rather than assuming a fixed number of frames is enough: under server
// stalls the join takes longer, and a fixed wait turned that into a crash here.
const findPred = () => { for (let i = worlds.length - 1; i >= 0; i--) if (worlds[i].players['local']) return worlds[i].players['local']; return null; };
for (let i = 0; i < 400 && !findPred(); i++) { tick(); await new Promise((r) => setImmediate(r)); }
const pred = findPred();
ok('prediction is running', !!pred);
if (!pred) process.exit(1);

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
// The one the hips metric could never see: a correction applied per joint drew
// the body with its joints displaced by different amounts — a stickman pulled
// long. Compare each drawn bone against the same bone in the simulation.
const BONES = [[StickSim.HEAD, StickSim.CHEST], [StickSim.CHEST, StickSim.HIPS],
               [StickSim.CHEST, StickSim.HANDL], [StickSim.CHEST, StickSim.HANDR],
               [StickSim.HIPS, StickSim.FOOTL], [StickSim.HIPS, StickSim.FOOTR]];
const worstStretch = () => {
  let w = 0;
  for (const [a, b] of BONES) {
    const pa = pred.pts[a], pb = pred.pts[b];
    if (pa.dx === undefined || pb.dx === undefined) continue;
    const sim = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    const draw = Math.hypot(pa.dx - pb.dx, pa.dy - pb.dy);
    w = Math.max(w, Math.abs(draw - sim));
  }
  return w;
};
let stretch = 0;
const dhip = () => { const q = pred.pts[StickSim.HIPS];
  return { x: q.dx !== undefined ? q.dx : q.x, y: q.dy !== undefined ? q.dy : q.y }; };
// The actual complaint: does the body visibly jump? Measure the largest
// single-frame movement while walking. A run is ~4.4px per frame, so anything
// much beyond that is a correction the player sees as a teleport.
window.sfStats.errMax = 0;
let worstJump = 0, jumps = 0;
let last = dhip().x, lastY = dhip().y;
for (let i = 0; i < 300; i++) {
  const px = pred.pts[StickSim.HIPS].x;
  press(px > deck.x + deck.w - 130 ? 20 : (px < deck.x + 130 ? 175 : (i % 120 < 60 ? 175 : 20)));
  tick(); await new Promise((r) => setImmediate(r));
  const d = Math.abs(dhip().x - last) + Math.abs(dhip().y - lastY);
  last = dhip().x; lastY = dhip().y;
  stretch = Math.max(stretch, worstStretch());
  if (i > 30) { worstJump = Math.max(worstJump, d); if (d > 10) jumps++; }
}
release();
ok('the local body never teleports', worstJump < 10,
   'worst single-frame move ' + worstJump.toFixed(1) + 'px, ' + jumps + ' frames over 10px');
// The honest correctness measure, and the one the client computes itself: how far
// the state predicted for a tick sits from the state the server reports for that
// same tick. Undisturbed, that should be near zero. During a hit the client is
// *supposed* to disagree, so folding that in would make the number meaningless.
// Run-length compare the two input timelines: how many ticks each side spent on
// each packet. If they differ, the two simulations were never running the same
// thing and no correction can ever succeed.
if (process.env.SF_TIMELINE) {
  const srvRuns = [], cliRuns = [];
  const rl = (arr, seq) => { const last = arr[arr.length - 1];
    if (last && last.seq === seq) last.n++; else arr.push({ seq, n: 1 }); };
  const conn = room().conns.get([...room().conns.keys()][0]);
  const realTick = room().tick.bind(room());
  room().tick = function () { realTick(); rl(srvRuns, conn.ack); };
  let seen = -1;
  const probe = setInterval(() => {}, 1000);
  for (let i = 0; i < 120; i++) {
    press(i % 40 < 20 ? 175 : 20);
    tick(); await new Promise((r) => setImmediate(r));
    rl(cliRuns, window.sfStats.sentSeq);
  }
  clearInterval(probe);
  console.log('  server ran: ' + srvRuns.slice(-8).map(r => r.seq + 'x' + r.n).join(' '));
  console.log('  client ran: ' + cliRuns.slice(-8).map(r => r.seq + 'x' + r.n).join(' '));
}
console.log('  walking stats: ' + JSON.stringify(window.sfStats));
// The tight bound is the claim for ordinary play. Under deliberately hostile
// conditions — heavy jitter, a server freezing for a third of a second — the
// prediction is genuinely wrong more often, and the claim that still has to hold
// is the one above and below: whatever the disagreement, the body on screen does
// not teleport and does not stretch.
const HOSTILE = JITTER > 40 || STALL > 12 || DRIFT > 1.02;
ok('the prediction agrees with the server about the same moment, walking undisturbed',
   window.sfStats.errMax < (HOSTILE ? 80 : 22), 'worst same-tick error ' + window.sfStats.errMax + 'px, ' +
   window.sfStats.fix + ' corrections vs ' + window.sfStats.agree + ' agreements');

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
  stretch = Math.max(stretch, worstStretch());
  if (i > 20) worstAir = Math.max(worstAir, d);
}
release();
ok('jumping does not teleport the body', worstAir < 16,
   'worst single-frame move while jumping ' + worstAir.toFixed(1) + 'px');

// Being hit: the server knocks us sideways; the client cannot have predicted it.
const sbody = room().world.players[srvId];
StickSim.step(room().world);
// Local, not uniform: a blade lands on the chest and the feet barely move. A
// uniform shove is a translation, which even a per-joint correction reproduces
// faithfully — it is the lopsided one that draws the body long.
sbody.pts.forEach((q, i) => {
  const share = i === StickSim.FOOTL || i === StickSim.FOOTR ? 0.1 : 1;
  q.ox += 14 * share; q.oy += 6 * share;
});
sbody.flail = 26;
let worstHit = 0, worstHitServer = 0, hitStretch = 0;
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
  hitStretch = Math.max(hitStretch, worstStretch());
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

// The honest correctness measure, and the one the client itself computes: how far
// the state we predicted for a tick sits from the state the server reports for
// that same tick. Comparing against the server's *live* body instead measures
// inherent turn lag — the server has not heard about a direction change yet — so
// a weaker prediction scores better on it, which is how a bad metric misleads.
ok('no bone is drawn longer than the simulation says it is', Math.max(stretch, hitStretch) < 2,
   'worst drawn-vs-simulated bone difference ' + Math.max(stretch, hitStretch).toFixed(1) +
   'px (walking ' + stretch.toFixed(1) + ', taking a hit ' + hitStretch.toFixed(1) + ')');
ok('and does not run away from the server', worstX < 140,
   'worst gap to the live server body ' + worstX.toFixed(0) + 'px over ' + samples + ' samples');
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
console.log('  stats: ' + JSON.stringify(window.sfStats));
ok('the respawned body does not flick between spawn points', flicks === 0,
   flicks + ' unexplained jump(s), worst ' + worstDeath.toFixed(0) + 'px, ' + positions.size + ' distinct places');
// The reported sequence, exactly: on, walk, off, walk, on, walk. Prediction is
// restarted each time it comes back, and anything left over from the previous
// session is a trap — the tick ring is 256 entries, so four seconds of walking
// with prediction off lines an old entry up with a current tick number.
const fire = (id, type) => ((listeners.get(nodes[id]) || {})[type] || []).forEach((fn) => fn({ target: nodes[id] }));
const padAt = (x, type) => ((listeners.get(nodes['sf-pad']) || {})[type] || []).forEach((fn) =>
  fn({ clientX: x, clientY: 85, pointerId: 1, pointerType: 'touch', buttons: 1, preventDefault(){} }));
const walk = (dir) => { padAt(dir > 0 ? 175 : 15, 'pointerup'); padAt(dir > 0 ? 175 : 15, 'pointerdown'); };
const lag = (on) => { nodes['sf-lagcomp'].checked = on; fire('sf-lagcomp', 'change'); };
const live = () => { for (let i = worlds.length - 1; i >= 0; i--) if (worlds[i].players['local']) return worlds[i].players['local']; return null; };
const body = () => live() || room().world.players[srvId];

// Nobody presses jump for the rest of this test, and the deck is flat, so the body
// on screen should not move vertically. Measure the DRAWN position: a vertical
// correction is eased into the draw offset without the simulation ever leaving the
// ground, and that is what hopping looks like.
let hops = 0, worstRise = 0, checking = false;
let hopY = null;
const drawnY = () => { const p = body(); if (!p) return null;
  const q = p.pts[StickSim.HIPS]; return q.dy !== undefined ? q.dy : q.y; };
const watch = async (frames) => {
  for (let i = 0; i < frames; i++) {
    if (i % 30 === 0) walk(i % 60 === 0 ? 1 : -1);
    tick(); await new Promise((r) => setImmediate(r));
    const p = body(), y = drawnY();
    if (!checking || !p || p.dead || y === null) { hopY = y; continue; }
    if (hopY !== null) {
      const d = Math.abs(y - hopY);
      if (d > 3) { hops++; worstRise = Math.max(worstRise, d); }
    }
    hopY = y;
  }
};

walk(1);
await watch(40);
checking = true;
for (let cycle = 0; cycle < 3; cycle++) {
  lag(false); await watch(70);        // walk around with it off, long enough to wrap
  lag(true);  await watch(70);        // and back on
}
ok('nobody pressed jump, so the body on screen does not bounce', hops <= 2,
   hops + ' frame(s) moving vertically on flat ground, worst ' + worstRise.toFixed(1) + 'px');
console.log('  stats: ' + JSON.stringify(window.sfStats));
process.exit(0);
