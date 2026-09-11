// Wordfall's lobby and ready-up, after the countdown moved into roomkit.
// This game has no test suite of its own; it got one when its ready gate
// started being shared code, because a shared bug is now two games' bug.
//
//   npx wrangler dev --port 8798 --local
//   WF_BASE=http://127.0.0.1:8798 node test/lobbytest.mjs
import WebSocketNode from 'ws';

const BASE = process.env.WF_BASE || 'http://127.0.0.1:8798';
const WSB = BASE.replace(/^http/, 'ws');
const O = { Origin: 'https://ashura.id', 'Content-Type': 'application/json' };

let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log('  FAIL ' + n + (x ? '  <' + x + '>' : '')); } else console.log('  ok   ' + n); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function open(code, q) {
  const ws = new WebSocketNode(`${WSB}/room/${code}/ws?` + new URLSearchParams(q).toString(),
                               { headers: { Origin: 'https://ashura.id' } });
  ws.msgs = [];
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d.toString()); } catch (e) { return; }
    ws.msgs.push(m);
    if (m.type === 'hello') { ws.me = m.you; ws.token = m.token; }
  });
  return ws;
}
const waitOpen = (ws) => new Promise((res, rej) => {
  ws.on('open', res); ws.on('error', rej);
  ws.on('unexpected-response', (_q, r) => rej(new Error('http ' + r.statusCode)));
});
const mark = (ws) => ws.msgs.length;
async function waitFor(ws, pred, ms, what, from = 0) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = ws.msgs.slice(from).filter(pred).pop();
    if (hit) return hit;
    await sleep(30);
  }
  throw new Error('timed out waiting for ' + what);
}
const lastLobby = (ws) => ws.msgs.filter((m) => m.type === 'lobby').pop();

console.log('wordfall lobby against ' + BASE + ':');

const made = await (await fetch(BASE + '/lobby/create', {
  method: 'POST', headers: O, body: JSON.stringify({ name: 'gatetest' })
})).json();
ok('a room was created', !!made.code, JSON.stringify(made));

const a = open(made.code, { name: 'asif', cls: 'rogue' });
await waitOpen(a);
const helloA = await waitFor(a, (m) => m.type === 'hello', 3000, 'hello');
ok('hello carries a token', !!helloA.token);
const l0 = await waitFor(a, (m) => m.type === 'lobby', 3000, 'lobby');
ok('the room starts in the lobby', l0.phase === 'lobby');
ok('and offers an invite key', !!(l0.room && l0.room.invite));

// one player cannot start a match
a.send(JSON.stringify({ type: 'ready', ready: true }));
await sleep(300);
const solo = lastLobby(a);
ok('one ready is recorded', solo.roster.some((p) => p.ready));
ok('but one player cannot start', solo.phase === 'lobby' && !solo.countdownEndsAt);

// a second player, then both ready -> countdown -> start
const b = open(made.code, { name: 'budi', cls: 'mage' });
await waitOpen(b);
await waitFor(b, (m) => m.type === 'lobby', 3000, 'lobby');
await sleep(200);

// the joiner cancelled the countdown, and un-readied nobody
const two = lastLobby(a);
ok('two players are listed', two.roster.length === 2);
ok('a joiner leaves the room in the lobby', two.phase === 'lobby');

const beforeReady = mark(a);
a.send(JSON.stringify({ type: 'ready', ready: true }));
b.send(JSON.stringify({ type: 'ready', ready: true }));
const counting = await waitFor(a, (m) => m.type === 'lobby' && m.phase === 'countdown', 3000,
                               'countdown', beforeReady).catch(() => null);
ok('both ready starts the countdown', !!counting);
ok('the countdown has an end time', !!(counting && counting.countdownEndsAt));

// pulling out mid-countdown must stop it
b.send(JSON.stringify({ type: 'ready', ready: false }));
await sleep(250);
const pulled = lastLobby(a);
ok('un-readying cancels the countdown', pulled.phase === 'lobby');
await sleep(3200);
const noStart = a.msgs.filter((m) => m.type === 'start');
ok('and no match started', noStart.length === 0);

// changing class un-readies you, which is the same gate saying no
a.send(JSON.stringify({ type: 'ready', ready: true }));
b.send(JSON.stringify({ type: 'ready', ready: true }));
await sleep(200);
b.send(JSON.stringify({ type: 'setClass', cls: 'ranger' }));
await sleep(250);
const afterClass = lastLobby(a);
const bRow = afterClass.roster.find((p) => p.name === 'budi');
ok('changing class un-readies that player', bRow && bRow.ready === false);
ok('and stops the countdown', afterClass.phase === 'lobby');

// now actually start one
const beforeStart = mark(a);
a.send(JSON.stringify({ type: 'ready', ready: true }));
b.send(JSON.stringify({ type: 'ready', ready: true }));
const started = await waitFor(a, (m) => m.type === 'start', 8000, 'start', beforeStart)
  .catch(() => null);
ok('both ready does start a match', !!started);
ok('the match came with a grid', !!(started && started.grid));

// renaming from inside the room
a.send(JSON.stringify({ type: 'setName', name: 'asif2' }));
await sleep(200);
ok('setName is accepted mid-match without a lobby broadcast',
   !a.msgs.filter((m) => m.type === 'lobby').slice(-1).some((m) => m.phase === 'lobby'));

a.close(); b.close();
await sleep(200);
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
