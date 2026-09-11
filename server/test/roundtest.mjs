// The round actually ending, and the rematch that follows.
//
// The interesting states here are only reachable by someone genuinely winning,
// so this drives a real fight: a one-kill room, two players, and one of them
// walking into the other swinging until the server says it is over. Slower than
// the rest of the tests and worth it — this is the path that used to exist only
// in the client's drawing.
//
//   npx wrangler dev --port 8799 --local
//   SF_BASE=http://127.0.0.1:8799 node test/roundtest.mjs
import WebSocketNode from 'ws';
const S = (await import('../../assets/js/stickfight-sim.js')).default;
const W = (await import('../../assets/js/stickfight-wire.js')).default;

const BASE = process.env.SF_BASE || 'http://127.0.0.1:8799';
const WSB = BASE.replace(/^http/, 'ws');
const O = { Origin: 'https://ashura.id', 'Content-Type': 'application/json' };

let fails = 0;
function ok(name, cond, extra) {
  if (!cond) { fails++; console.log('  FAIL ' + name + (extra ? '  <' + extra + '>' : '')); }
  else console.log('  ok   ' + name);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function open(code, q) {
  const ws = new WebSocketNode(`${WSB}/room/${code}/ws?` + new URLSearchParams(q).toString(),
                               { headers: { Origin: 'https://ashura.id' } });
  ws.binaryType = 'arraybuffer';
  ws.msgs = [];
  ws.world = S.createWorld(1);
  ws.world.players = {};
  ws.roster = [];
  ws.snaps = 0;
  ws.on('message', (d, isBinary) => {
    if (isBinary) {
      ws.snaps++;
      const buf = new Uint8Array(d).slice().buffer;
      try { W.decodeSnapshot(buf, ws.world, ws.roster, S); } catch (e) {}
      return;
    }
    let m; try { m = JSON.parse(d.toString()); } catch (e) { return; }
    ws.msgs.push(m);
    if (m.type === 'hello') { ws.me = m.you; ws.token = m.token; }
    if (m.type === 'roster') {
      ws.roster = [];
      for (const s of m.slots) ws.roster[s.slot] = s;
      if (m.seed != null && m.seed !== ws.seed) {
        ws.seed = m.seed;
        const keep = ws.world.players;
        ws.world = S.createWorld(m.seed);
        ws.world.players = keep;
      }
    }
  });
  return ws;
}
const waitOpen = (ws) => new Promise((res, rej) => {
  ws.on('open', res); ws.on('error', rej);
  ws.on('unexpected-response', (_q, r) => rej(new Error('http ' + r.statusCode)));
});
// Messages accumulate for the whole session, so "wait for a roster that says
// fighting" would match one from the round that just ended and return instantly.
// Every wait is therefore anchored to a mark taken before the thing that should
// cause it — which is the difference between testing a transition and testing
// that the past happened.
const mark = (ws) => ws.msgs.length;
async function waitFor(ws, pred, ms, what, from) {
  const start = from === undefined ? 0 : from;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = ws.msgs.slice(start).filter(pred).pop();
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('timed out waiting for ' + what);
}
const lastRoster = (ws) => ws.msgs.filter((m) => m.type === 'roster').pop();

console.log('rounds against ' + BASE + ':');

const made = await (await fetch(BASE + '/lobby/create', {
  method: 'POST', headers: O, body: JSON.stringify({ name: 'roundtest', killsToWin: 1 })
})).json();
const code = made.code;

const a = open(code, { name: 'attacker' });
const b = open(code, { name: 'victim' });
await waitOpen(a); await waitOpen(b);
await waitFor(a, (m) => m.type === 'roster', 3000, 'roster');
await sleep(400);

ok('the room honours its own kill target', lastRoster(a).killsToWin === 1);
ok('snapshots are flowing', a.snaps > 5, 'snaps=' + a.snaps);

// Walk A into B and swing. Aim is recomputed each tick from the decoded
// snapshot, so this chases a body that is being knocked about.
// One fight driver for both scenarios. The attacker holds a striking distance
// and swings off cooldown; the victim walks in but never swings. Two bodies
// converging is far more reliable than one chasing another around a multi-deck
// arena, where they kept ending up in range horizontally but a platform apart.
function drive(A, B, seqRef) {
  const me = A.world.players[A.me], foe = A.world.players[B.me];
  if (!me || !foe) return;
  const next = () => (seqRef.n = (seqRef.n + 1) & 0xffff);
  if (!me.dead) {
    const dx = foe.pts[S.HIPS].x - me.pts[S.HIPS].x;
    const dy = foe.pts[S.HIPS].y - me.pts[S.HIPS].y;
    const ad = Math.abs(dx), away = ad < 9, close = ad > 20;
    try {
      A.send(Buffer.from(W.encodeInput({
        l: ((close && dx < 0) || (away && dx > 0)) ? 1 : 0,
        r: ((close && dx > 0) || (away && dx < 0)) ? 1 : 0,
        // a periodic hop shakes the pair out of the stalemates the ragdolls can
        // settle into, which is the only thing that ever made this test fail
        jump: (dy < -40 || seqRef.n % 37 === 0) ? 1 : 0, duck: 0,
        fire: (ad < 34 && Math.abs(dy) < 55 && me.cd === 0) ? 1 : 0,
        discard: 0, special: 0, aim: Math.atan2(dy, dx)
      }, next())));
    } catch (e) {}
  }
  if (!foe.dead) {
    const bdx = me.pts[S.HIPS].x - foe.pts[S.HIPS].x;
    const bdy = me.pts[S.HIPS].y - foe.pts[S.HIPS].y;
    try {
      B.send(Buffer.from(W.encodeInput({
        l: bdx < -14 ? 1 : 0, r: bdx > 14 ? 1 : 0, jump: bdy < -40 ? 1 : 0,
        duck: 0, fire: 0, discard: 0, special: 0, aim: 0
      }, next())));
    } catch (e) {}
  }
}

const seqRef = { n: 0 };
let stopBrawl = false;
async function brawl(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until && !stopBrawl) {
    drive(a, b, seqRef);
    await sleep(50);
  }
}

const over = (async () => {
  await brawl(90000);
  return null;
})();
const gotOver = await Promise.race([
  waitFor(a, (m) => m.type === 'roster' && m.phase === 'over', 90000, 'round over').catch(() => null),
  over
]);

stopBrawl = true;
ok('the round ended on its own', !!gotOver, 'phase=' + (lastRoster(a) || {}).phase);
if (!gotOver) {
  console.log('\n(no kill landed in 90s — the fight is physical, so this can happen;');
  console.log(' re-run before treating it as a failure)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
}

ok('a final table came with it', Array.isArray(gotOver.final) && gotOver.final.length === 2);
ok('the table is sorted by kills', gotOver.final[0].kills >= gotOver.final[1].kills);
ok('somebody is marked the winner', gotOver.final.some((r) => r.won));
ok('the winner is the one with the kills', gotOver.final[0].won === true);
ok('nobody is ready yet', gotOver.slots.every((s) => !s.ready));

const snapsAtEnd = a.snaps;
await sleep(700);
const snapsFrozen = a.snaps;
ok('the world stops ticking between rounds', a.snaps - snapsAtEnd < 3,
   'moved by ' + (a.snaps - snapsAtEnd));

// one ready is not enough
a.send(JSON.stringify({ type: 'ready', ready: true }));
await sleep(300);
const half = lastRoster(a);
ok('one ready is recorded', half.slots.some((s) => s.ready));
ok('but does not start anything', half.phase === 'over' && !half.countdownEndsAt);

// un-readying works
a.send(JSON.stringify({ type: 'ready', ready: false }));
await sleep(250);
ok('ready can be taken back', lastRoster(a).slots.every((s) => !s.ready));

// both ready -> countdown -> a fresh round
const seedBefore = lastRoster(a).seed;
const beforeReady = mark(a);
a.send(JSON.stringify({ type: 'ready', ready: true }));
b.send(JSON.stringify({ type: 'ready', ready: true }));
const counting = await waitFor(a, (m) => m.type === 'roster' && m.countdownEndsAt, 3000,
                               'countdown', beforeReady).catch(() => null);
ok('both ready starts a countdown', !!counting);

const fresh = await waitFor(a, (m) => m.type === 'roster' && m.phase === 'fighting', 8000,
                            'new round', beforeReady).catch(() => null);
ok('the next round starts', !!fresh);
if (fresh) {
  ok('on a fresh arena', fresh.seed !== seedBefore, fresh.seed + ' vs ' + seedBefore);
  ok('with the scores wiped', fresh.slots.every((s) => s.kills === 0));
  ok('and nobody left ready', fresh.slots.every((s) => !s.ready));
}
await sleep(600);
ok('and the world is ticking again', a.snaps > snapsFrozen + 5,
   'snaps ' + snapsFrozen + ' -> ' + a.snaps);

a.close(); b.close();
await sleep(300);

// ---- a score that survives losing the connection -------------------------
// The point of the seat token: drop at nine kills, come back at nine. Run in a
// room whose target is out of reach so the round cannot end underneath us.
console.log('\nscore across a reconnect:');
const made2 = await (await fetch(BASE + '/lobby/create', {
  method: 'POST', headers: O, body: JSON.stringify({ name: 'reconnect', killsToWin: 20 })
})).json();

const x = open(made2.code, { name: 'faller' });
const y = open(made2.code, { name: 'bystander' });
await waitOpen(x); await waitOpen(y);
await waitFor(x, (m) => m.type === 'roster', 3000, 'roster');
await sleep(400);
const xToken = x.token, xId = x.me;

// Deaths rather than kills. Both are carried across a reconnect by the same
// code, and a death can be produced on purpose — walk off the edge — where a
// kill depends on two ragdolls cooperating, which they intermittently refuse
// to do. This is the same mechanism, tested without the coin toss.
let seq3 = 0;
async function fallUntilDead(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      x.send(Buffer.from(W.encodeInput(
        { l: 0, r: 1, jump: 0, duck: 0, fire: 0, discard: 0, special: 0, aim: 0 },
        (seq3 = (seq3 + 1) & 0xffff))));
    } catch (e) {}
    const mine = x.world.players[x.me];
    if (mine && mine.deaths > 0) return mine.deaths;
    await sleep(50);
  }
  return 0;
}
const banked = await fallUntilDead(45000);
ok('the faller got a death on the board', banked > 0, 'deaths=' + banked);

if (banked > 0) {
  x.close();
  await sleep(600);
  const awayRow = lastRoster(y).slots.find((s) => s.id === xId);
  ok('the seat is held while away', !!awayRow && awayRow.away === true);

  const x2 = open(made2.code, { name: 'faller', token: xToken });
  await waitOpen(x2);
  const hi = await waitFor(x2, (m) => m.type === 'hello', 3000, 'hello');
  ok('the token got the seat back', hi.reused === true && hi.you === xId);

  // the body is respawned from the seat, so the count has to come back with it
  await waitFor(x2, (m) => m.type === 'roster', 3000, 'roster after return');
  await sleep(700);
  const mine2 = x2.world.players[xId];
  ok('the score came back with the seat', !!mine2 && mine2.deaths >= banked,
     'deaths=' + (mine2 && mine2.deaths) + ' want >= ' + banked);
  const backRow = lastRoster(x2).slots.find((s) => s.id === xId);
  ok('and it is back in the fight, not away', backRow && backRow.away === false);
  x2.close();
}
y.close();
await sleep(200);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
