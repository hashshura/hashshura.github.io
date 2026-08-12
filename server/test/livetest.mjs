// Talk to the actual Worker running in workerd via `wrangler dev`.
const BASE = process.env.SF_BASE || 'http://127.0.0.1:8787';
const WSB = BASE.replace(/^http/, 'ws');
const O = { 'Origin': 'https://ashura.id', 'Content-Type': 'application/json' };
import WebSocketNode from 'ws';   // node's built-in WebSocket cannot set Origin
const S = (await import('../../assets/js/stickfight-sim.js')).default;
const W = (await import('../../assets/js/stickfight-wire.js')).default;
const ok = (l, c, x='') => console.log((c ? '  ok   ' : '  FAIL ') + l + (x ? '  ' + x : ''));

const res = await fetch(BASE + '/lobby/create', { method:'POST', headers:O,
  body: JSON.stringify({ name:'live', password:'pw123' }) });
const { code } = await res.json();
ok('created room', !!code, code);

// wrong password
const bad = await new Promise((r) => {
  const s = new WebSocketNode(`${WSB}/room/${code}/ws?name=nope&pw=wrong`, { origin:'https://ashura.id' });
  s.on('open', () => r('opened'));
  s.on('error', () => r('refused'));
  s.on('unexpected-response', () => r('refused'));
});
ok('wrong password refused by workerd', bad === 'refused', bad);

// two real clients
function client(name) {
  return new Promise((resolve) => {
    const s = new WebSocketNode(`${WSB}/room/${code}/ws?name=${name}&pw=pw123`, { origin:'https://ashura.id' });
    s.binaryType = 'arraybuffer';
    const st = { s, name, roster: null, snaps: [], times: [] };
    s.on('message', (data, isBinary) => {
      if (!isBinary) st.roster = JSON.parse(data.toString());
      else {
        const b = new Uint8Array(data).slice().buffer;
        st.snaps.push(b); st.times.push(Date.now());
      }
    });
    s.on('open', () => resolve(st));
    s.on('error', () => resolve(st));
  });
}
const A = await client('asif'), B = await client('lawan');
await new Promise((r) => setTimeout(r, 1200));
ok('both connected', A.s.readyState === 1 && B.s.readyState === 1);
ok('roster lists two fighters', A.roster && A.roster.slots.length === 2,
   A.roster ? A.roster.slots.map(s=>s.name).join(',') : 'none');

ok('snapshots arriving', A.snaps.length > 15, A.snaps.length + ' in 1.2s');
const gaps = A.times.slice(1).map((t,i) => t - A.times[i]).sort((a,b)=>a-b);
ok('at roughly 20Hz', Math.abs(gaps[Math.floor(gaps.length/2)] - 50) < 22,
   'median gap ' + gaps[Math.floor(gaps.length/2)] + 'ms');
const sizes = A.snaps.map(s => s.byteLength);
ok('snapshots compact', Math.max(...sizes) < 220,
   'avg ' + (sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(0) + 'B max ' + Math.max(...sizes) + 'B');

// decode into a client world, then walk right and watch the server agree
const cw = S.createWorld(1); cw.players = {};
const rosterBySlot = []; A.roster.slots.forEach(s => rosterBySlot[s.slot] = s);
let decoded = 0;
for (const b of A.snaps) if (W.decodeSnapshot(b, cw, rosterBySlot, S) >= 0) decoded++;
ok('every snapshot decodes', decoded === A.snaps.length, decoded + '/' + A.snaps.length);
ok('client world has both', Object.keys(cw.players).length === 2, Object.keys(cw.players).join(','));

const myId = rosterBySlot[A.roster.you].id;
const x0 = cw.players[myId].pts[S.HIPS].x;
const iv = setInterval(() => A.s.send(W.encodeInput({ l:0, r:1, jump:0, duck:0, fire:0, aim:0 })), 50);
await new Promise((r) => setTimeout(r, 1500));
clearInterval(iv);
for (const b of A.snaps) W.decodeSnapshot(b, cw, rosterBySlot, S);
const moved = cw.players[myId].pts[S.HIPS].x - x0;
ok('my input moved me on the server', moved > 60, moved.toFixed(0) + 'px right');

// fire a weapon: cooldown should appear in the snapshot
A.s.send(W.encodeInput({ l:0, r:0, jump:0, duck:0, fire:1, aim:0 }));
await new Promise((r) => setTimeout(r, 200));
for (const b of A.snaps.slice(-6)) W.decodeSnapshot(b, cw, rosterBySlot, S);
ok('weapon use shows a cooldown', cw.players[myId].cd > 0, 'cd=' + cw.players[myId].cd);

A.s.close(); B.s.close();
await new Promise((r) => setTimeout(r, 400));
const list = await (await fetch(BASE + '/lobby/list', { headers:O })).json();
ok('lobby still lists the room', list.rooms.some(r => r.code === code));
process.exit(0);
