// Run the Worker's Durable Objects in node, with the Workers APIs stubbed, so
// the join / password / snapshot / input path is exercised before any deploy.
// node 22 already exposes globalThis.crypto with subtle+getRandomValues

// --- minimal Response/Request (undici rejects status 101 and unknown init) ---
class Res {
  constructor(body, init = {}) {
    this.body = body; this.status = init.status || 200;
    this._h = new Map(Object.entries(init.headers || {}));
    this.webSocket = init.webSocket;
  }
  get headers() { return { get: (k) => this._h.get(k), set: (k, v) => this._h.set(k, v) }; }
  async json() { return JSON.parse(this.body); }
}
class Req {
  constructor(url, init = {}) {
    this.url = url; this.method = init.method || 'GET';
    this._h = new Map(Object.entries(init.headers || {}));
    this._body = init.body; this.cf = init.cf || { colo: 'SIN' };
  }
  get headers() { return { get: (k) => this._h.get(k) || this._h.get(k.toLowerCase()) }; }
  async json() { return JSON.parse(this._body); }
}
globalThis.Response = Res;

// --- fake WebSocketPair -----------------------------------------------------
class FakeWS {
  constructor(tag) { this.tag = tag; this.l = {}; this.sent = []; this.inbox = []; this.closed = null; }
  accept() {}
  addEventListener(t, fn) { (this.l[t] ||= []).push(fn); }
  emit(t, ev) { (this.l[t] || []).forEach((f) => f(ev)); }
  send(data) { this.sent.push(data); if (this.peer) { this.peer.inbox.push(data); this.peer.emit('message', { data }); } }
  close(code, reason) { this.closed = { code, reason }; this.emit('close', { code }); if (this.peer && !this.peer.closed) this.peer.emit('close', { code }); }
}
globalThis.WebSocketPair = function () {
  const a = new FakeWS('client'), b = new FakeWS('server');
  a.peer = b; b.peer = a;
  return { 0: a, 1: b };
};

// --- durable object plumbing ------------------------------------------------
function makeState() {
  const map = new Map();
  return { storage: {
    async get(k) { return map.get(k); },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); }
  } };
}

const { Room } = await import('../src/room.js');
// The room must not drive itself: its loop is a self-scheduling setTimeout on the
// real timer queue, and awaits here give it chances to fire on top of the ticks
// this harness drives. That made the server run 1.5x the client's tick rate.
const guardRoom = (r) => { r.startLoop = () => {}; return r; };
const { Lobby } = await import('../src/lobby.js');

const rooms = new Map();
const env = {};
env.ROOM = {
  idFromName: (n) => n,
  get: (n) => ({ fetch: (u, i) => {
    if (!rooms.has(n)) rooms.set(n, guardRoom(new Room(makeState(), env)));
    return rooms.get(n).fetch(new Req(typeof u === 'string' ? u : u.url, i));
  } })
};
let lobbyInstance = null;
env.LOBBY = {
  idFromName: () => 'global',
  get: () => ({ fetch: (u, i) => {
    if (!lobbyInstance) lobbyInstance = new Lobby(makeState(), env);
    return lobbyInstance.fetch(new Req(typeof u === 'string' ? u : u.url, i));
  } })
};

const lobby = env.LOBBY.get();
const ok = (label, cond, extra = '') =>
  console.log((cond ? '  ok   ' : '  FAIL ') + label + (extra ? '  ' + extra : ''));

// 1. create a private room
let res = await lobby.fetch('https://do/lobby/create', {
  method: 'POST', body: JSON.stringify({ name: 'ruang asif', password: 'rahasia' })
});
const { code } = await res.json();
ok('lobby creates a room', /^[A-Z2-9]{4}$/.test(code), 'code=' + code);

res = await lobby.fetch('https://do/lobby/list');
let { rooms: list } = await res.json();
ok('room appears in the list', list.length === 1 && list[0].code === code);
ok('marked private, password not exposed', list[0].private === true && !('password' in list[0]) && !('hash' in list[0]));

// 2. wrong password is refused
const room = rooms.get(code);
res = await room.fetch(new Req(`https://do/room/${code}/ws?name=intruder&pw=salah`,
  { headers: { Upgrade: 'websocket' } }));
ok('wrong password rejected', res.status === 403, 'status=' + res.status);

// 3. two players join with the right password
async function join(name) {
  const r = await room.fetch(new Req(`https://do/room/${code}/ws?name=${name}&pw=rahasia`,
    { headers: { Upgrade: 'websocket' } }));
  return r.webSocket;
}
const a = await join('asif'), b = await join('lawan');
ok('both joined', !!a && !!b && room.conns.size === 2);

const roster = a.inbox.filter((m) => typeof m === 'string').map(JSON.parse).pop();
ok('roster names both players', roster.slots.length === 2 &&
   roster.slots.map((s) => s.name).sort().join(',') === 'asif,lawan', JSON.stringify(roster.slots.map(s=>s.name)));

// 4. inputs move the right stickman, and only that one
const Wire = (await import('../../assets/js/stickfight-wire.js')).default;
const idA = room.conns.get(a.peer).id, idB = room.conns.get(b.peer).id;
for (let i = 0; i < 60; i++) room.tick();            // settle on the platform
const ax0 = room.world.players[idA].pts[2].x, bx0 = room.world.players[idB].pts[2].x;
a.send(Wire.encodeInput({ l: 0, r: 1, jump: 0, duck: 0, fire: 0, aim: 0.5 }));
for (let i = 0; i < 120; i++) room.tick();
const movedA = room.world.players[idA].pts[2].x - ax0;
const movedB = room.world.players[idB].pts[2].x - bx0;
ok('input moves the sender', movedA > 60, 'moved ' + movedA.toFixed(0) + 'px');
ok('and nobody else', Math.abs(movedB) < 4, 'other moved ' + movedB.toFixed(1) + 'px');
ok('aim was applied', Math.abs(room.world.players[idA].aim - 0.5) < 0.001);

// 5. snapshots are binary, small, and decode into a client world
const S = (await import('../../assets/js/stickfight-sim.js')).default;
const binary = a.inbox.filter((m) => m instanceof ArrayBuffer);
ok('snapshots broadcast', binary.length > 40, binary.length + ' snapshots');
const sizes = binary.map((x) => x.byteLength);
ok('snapshots stay compact', Math.max(...sizes) < 200,
   'avg ' + (sizes.reduce((x, y) => x + y, 0) / sizes.length).toFixed(0) + 'B max ' + Math.max(...sizes) + 'B');

const cw = S.createWorld(1); cw.players = {};
const rosterBySlot = [];
roster.slots.forEach((s) => { rosterBySlot[s.slot] = s; });
let decoded = 0;
for (const buf of binary) if (Wire.decodeSnapshot(buf, cw, rosterBySlot, S) >= 0) decoded++;
ok('client decodes every snapshot', decoded === binary.length);
ok('client sees both fighters', Object.keys(cw.players).length === 2, Object.keys(cw.players).join(','));
const err = Math.abs(cw.players[idA].pts[2].x - Math.round(room.world.players[idA].pts[2].x));
ok('client position matches server', err === 0, err + 'px off');

// 6. leaving frees the slot
b.close(1000, 'bye');
ok('slot freed on disconnect', room.conns.size === 1 && room.slots.filter(Boolean).length === 1);

// 7. room fills up
const extra = [];
for (let i = 0; i < 6; i++) extra.push(await join('x' + i));
ok('capped at six players', room.conns.size === 6, room.conns.size + ' connected');
const full = await room.fetch(new Req(`https://do/room/${code}/ws?name=late&pw=rahasia`,
  { headers: { Upgrade: 'websocket' } }));
ok('seventh player refused', full.status === 409, 'status=' + full.status);

// 8. heartbeat updates the lobby's player count
await room.beat();
res = await lobby.fetch('https://do/lobby/list');
list = (await res.json()).rooms;
ok('lobby knows the room is busy', list[0].players === 6, 'players=' + list[0].players);

// 9. a public room needs no password
res = await lobby.fetch('https://do/lobby/create', { method: 'POST', body: JSON.stringify({ name: 'terbuka' }) });
const open = (await res.json()).code;
const openRoom = rooms.get(open);
const oc = await openRoom.fetch(new Req(`https://do/room/${open}/ws?name=siapa`,
  { headers: { Upgrade: 'websocket' } }));
ok('public room joins without a password', !!oc.webSocket);

// 10. ping answers for latency probing
const png = await openRoom.fetch(new Req(`https://do/room/${open}/ping`));
ok('ping route answers 204', png.status === 204);

// the room loop is a self-scheduling setTimeout, so node would never exit
process.exit(0);
