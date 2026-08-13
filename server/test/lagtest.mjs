// Where does the input-to-pixel delay actually come from?
import WebSocketNode from 'ws';
const BASE = process.env.SF_BASE || 'https://stickfight.hashshura.workers.dev';
const WSB = BASE.replace(/^http/, 'ws');
const O = { Origin: 'https://ashura.id', 'Content-Type': 'application/json' };
const S = (await import('../../assets/js/stickfight-sim.js')).default;
const W = (await import('../../assets/js/stickfight-wire.js')).default;

// warm the connection, then measure the round trip to the room object
const { code } = await (await fetch(BASE + '/lobby/create', { method:'POST', headers:O,
  body: JSON.stringify({ name:'lag' }) })).json();
const pings = [];
for (let i = 0; i < 6; i++) {
  const t0 = performance.now();
  await fetch(`${BASE}/room/${code}/ping`, { cache:'no-store' });
  pings.push(performance.now() - t0);
}
pings.sort((a,b)=>a-b);
console.log('HTTP round trip to the room object: median', pings[3].toFixed(0) + 'ms',
            '(first, cold:', pings[pings.length-1].toFixed(0) + 'ms)');

const s = new WebSocketNode(`${WSB}/room/${code}/ws?name=probe`, { origin:'https://ashura.id' });
s.binaryType = 'arraybuffer';
const snaps = [];
let roster = null;
s.on('message', (data, isBinary) => {
  if (!isBinary) { roster = JSON.parse(data.toString()); return; }
  snaps.push({ t: performance.now(), buf: new Uint8Array(data).slice().buffer });
});
await new Promise(r => s.on('open', r));
await new Promise(r => setTimeout(r, 1500));

const gaps = snaps.slice(1).map((s2,i) => s2.t - snaps[i].t).sort((a,b)=>a-b);
console.log('snapshot arrival gap:  median', gaps[Math.floor(gaps.length/2)].toFixed(0) + 'ms',
            '| worst', gaps[gaps.length-1].toFixed(0) + 'ms  (server sends every 50ms)');

// input -> echo: aim is applied by the server the same tick it arrives, with no
// physics ramp-up, so it isolates the pipeline from the body's acceleration
const world = S.createWorld(roster.seed); world.players = {};
const bySlot = []; roster.slots.forEach(x => bySlot[x.slot] = x);
for (const sn of snaps) W.decodeSnapshot(sn.buf, world, bySlot, S);
const meId = bySlot[roster.you].id;
const echoes = [];
for (let round = 0; round < 8; round++) {
  const target = -1.2 + round * 0.2;
  snaps.length = 0;
  const sent = performance.now();
  s.send(W.encodeInput({ l:0, r:0, jump:0, duck:0, fire:0, discard:0, special:0, aim: target }));
  let seen = null;
  for (let i = 0; i < 40 && seen === null; i++) {
    await new Promise(r => setTimeout(r, 5));
    while (snaps.length && seen === null) {
      const sn = snaps.shift();
      W.decodeSnapshot(sn.buf, world, bySlot, S);
      if (Math.abs(world.players[meId].aim - target) < 0.02) seen = sn.t - sent;
    }
  }
  if (seen !== null) echoes.push(seen);
}
echoes.sort((a,b)=>a-b);
console.log('input -> echoed back in a snapshot: median', echoes[Math.floor(echoes.length/2)].toFixed(0) + 'ms',
            '| best', echoes[0].toFixed(0) + 'ms | worst', echoes[echoes.length-1].toFixed(0) + 'ms');
console.log('');
console.log('the client then interpolates over another 50ms before drawing it,');
console.log('and aim changes are rate-limited to 10Hz upstream (up to 100ms more).');
s.close();
process.exit(0);
