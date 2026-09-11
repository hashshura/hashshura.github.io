// The room protocol end to end: seats, names, invites, and coming back.
// Point it at a local worker:  npx wrangler dev --port 8799 --local
//   SF_BASE=http://127.0.0.1:8799 node test/roomtest.mjs
import WebSocketNode from 'ws';

const BASE = process.env.SF_BASE || 'http://127.0.0.1:8799';
const WSB = BASE.replace(/^http/, 'ws');
const O = { Origin: 'https://ashura.id', 'Content-Type': 'application/json' };

let fails = 0;
function ok(name, cond, extra) {
  if (!cond) { fails++; console.log('  FAIL ' + name + (extra ? '  <' + extra + '>' : '')); }
  else console.log('  ok   ' + name);
}

// A socket that remembers the JSON it was sent, so a test can wait for the
// message it cares about rather than guessing at ordering.
function open(code, q) {
  const url = `${WSB}/room/${code}/ws?` + new URLSearchParams(q).toString();
  const ws = new WebSocketNode(url, { headers: { Origin: 'https://ashura.id' } });
  ws.msgs = [];
  ws.binaryType = 'arraybuffer';
  ws.on('message', (d, isBinary) => {
    if (isBinary) return;                       // snapshots are not our business
    try { ws.msgs.push(JSON.parse(d.toString())); } catch (e) {}
  });
  return ws;
}
function waitOpen(ws) {
  return new Promise((res, rej) => {
    ws.on('open', res);
    ws.on('error', rej);
    ws.on('unexpected-response', (_q, r) => rej(new Error('http ' + r.statusCode)));
  });
}
async function waitFor(ws, type, ms = 3000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = ws.msgs.filter((m) => m.type === type).pop();
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('timed out waiting for ' + type);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('room protocol against ' + BASE + ':');

// ---- a public room -------------------------------------------------------
const made = await (await fetch(BASE + '/lobby/create', {
  method: 'POST', headers: O, body: JSON.stringify({ name: 'roomtest' })
})).json();
const code = made.code;
ok('lobby created a room', !!code, JSON.stringify(made));

const a = open(code, { name: 'asif' });
await waitOpen(a);
const helloA = await waitFor(a, 'hello');
ok('hello carries a seat id', !!helloA.you);
ok('hello carries a token', !!helloA.token && helloA.token.length > 8);
ok('first player is not a reconnect', helloA.reused === false);

const rosterA = await waitFor(a, 'roster');
ok('roster names the room', rosterA.room && rosterA.room.code === code);
ok('roster carries an invite key', !!(rosterA.room && rosterA.room.invite));
ok('a fresh room is fighting', rosterA.phase === 'fighting');
ok('roster carries the kill target', rosterA.killsToWin === 10);
ok('we are in it', rosterA.slots.some((s) => s.name === 'asif'));
const invite = rosterA.room.invite;

// ---- renaming from inside ------------------------------------------------
a.send(JSON.stringify({ type: 'setName', name: 'asif2' }));
await sleep(200);
const renamed = await waitFor(a, 'roster');
ok('setName is reflected in the roster', renamed.slots.some((s) => s.name === 'asif2'));

a.send(JSON.stringify({ type: 'setName', name: '   ' }));
await sleep(200);
const blanked = a.msgs.filter((m) => m.type === 'roster').pop();
ok('a blank name is refused', blanked.slots.some((s) => s.name === 'asif2'));

// ---- ready is meaningless mid-fight --------------------------------------
a.send(JSON.stringify({ type: 'ready', ready: true }));
await sleep(200);
const midfight = a.msgs.filter((m) => m.type === 'roster').pop();
const meRow = midfight.slots.find((s) => s.name === 'asif2');
ok('ready is ignored while fighting', meRow && meRow.ready === false);

// ---- a second player, and the score surviving a reconnect ----------------
const b = open(code, { name: 'budi' });
await waitOpen(b);
const helloB = await waitFor(b, 'hello');
ok('second player gets its own seat', helloB.you !== helloA.you);
ok('second player gets slot 1', helloB.slot === 1);

await sleep(300);
const two = a.msgs.filter((m) => m.type === 'roster').pop();
ok('both players are in the roster', two.slots.length === 2);

// drop A and come back with the token
a.close();
await sleep(400);
const afterDrop = b.msgs.filter((m) => m.type === 'roster').pop();
const awayRow = afterDrop.slots.find((s) => s.id === helloA.you);
ok('a dropped seat is kept, marked away', !!awayRow && awayRow.away === true);

const a2 = open(code, { name: 'asif2', token: helloA.token });
await waitOpen(a2);
const helloA2 = await waitFor(a2, 'hello');
ok('the token is recognised as a return', helloA2.reused === true);
ok('and gives back the same seat', helloA2.you === helloA.you);
ok('and the same slot', helloA2.slot === helloA.slot);

await sleep(300);
const back = a2.msgs.filter((m) => m.type === 'roster').pop();
const backRow = back.slots.find((s) => s.id === helloA.you);
ok('the returned seat is no longer away', backRow && backRow.away === false);
ok('and kept its name', backRow && backRow.name === 'asif2');

// a made-up token must not hand over anyone's seat
const c = open(code, { name: 'citra', token: 'not-a-real-token' });
await waitOpen(c);
const helloC = await waitFor(c, 'hello');
ok('a bogus token gets a new seat, not someone else\'s', helloC.you !== helloA.you && helloC.reused === false);

a2.close(); b.close(); c.close();

// ---- a private room, and the invite key as a way past the password -------
const priv = await (await fetch(BASE + '/lobby/create', {
  method: 'POST', headers: O, body: JSON.stringify({ name: 'locked', password: 'hunter2' })
})).json();

let refused = false;
try {
  const bad = open(priv.code, { name: 'nope', pw: 'wrong' });
  await waitOpen(bad);
  bad.close();
} catch (e) { refused = /403/.test(String(e.message)); }
ok('a wrong password is refused', refused);

const withPw = open(priv.code, { name: 'host', pw: 'hunter2' });
await waitOpen(withPw);
const hp = await waitFor(withPw, 'roster');
ok('the right password gets in', !!hp.room);
const privInvite = hp.room.invite;
ok('a private room has an invite key too', !!privInvite);

const withKey = open(priv.code, { name: 'friend', key: privInvite });
await waitOpen(withKey);
await waitFor(withKey, 'hello');
ok('the invite key gets in without the password', true);

let keyRefused = false;
try {
  const badKey = open(priv.code, { name: 'nope', key: privInvite.slice(0, -1) + 'x' });
  await waitOpen(badKey);
  badKey.close();
} catch (e) { keyRefused = /403/.test(String(e.message)); }
ok('a wrong invite key is still refused', keyRefused);

withPw.close(); withKey.close();
await sleep(200);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
