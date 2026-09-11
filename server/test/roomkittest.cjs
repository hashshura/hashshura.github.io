// Roomkit on its own, with no room around it: seats, reconnects, and the gate.
const K = require('../../assets/js/roomkit.js');

let fails = 0;
function ok(name, cond) {
  if (!cond) { fails++; console.log('  FAIL ' + name); } else console.log('  ok   ' + name);
}

console.log('names:');
ok('trims and caps', K.cleanName('   a very long name indeed  ', 12) === 'a very long');
ok('strips control chars', K.cleanName('as\x00i\x1ff\x7f', 12) === 'asif');
ok('empty falls back', K.cleanName('   ', 12, 'anon') === 'anon');
ok('no fallback means empty', K.cleanName('', 12) === '');

console.log('secrets:');
const key = K.makeInvite();
ok('invite matches itself', K.inviteOk({ invite: key }, key));
ok('invite rejects a miss', !K.inviteOk({ invite: key }, key.slice(0, -1) + (key.slice(-1) === '9' ? '0' : '9')));
ok('invite rejects empty', !K.inviteOk({ invite: key }, ''));
ok('no invite on room rejects all', !K.inviteOk({}, key));
ok('different lengths reject', !K.sameSecret('abc', 'abcd'));
ok('link carries code and key', K.inviteLink('https://x/y', 'ABCD', 'k1') === 'https://x/y?room=ABCD&key=k1');
ok('link without key', K.inviteLink('https://x/y', 'ABCD', '') === 'https://x/y?room=ABCD');

console.log('seats:');
const seats = new K.Seats({ max: 3, graceMs: 50, prefix: 'p' });
const a = seats.claim({ name: 'asif', ws: {} }).seat;
const b = seats.claim({ name: 'budi', ws: {} }).seat;
ok('slots are lowest free', a.slot === 0 && b.slot === 1);
ok('ids are distinct', a.id !== b.id);

// the whole point of the exercise: a score survives the round trip
a.extra.kills = 9;
seats.release(a);
ok('released seat is away', !a.ws && a.goneAt > 0);
ok('away seat still counted', seats.all().length === 2 && seats.live().length === 1);
const back = seats.claim({ token: a.token, ws: {} });
ok('token reclaims the same seat', back.reused && back.seat === a);
ok('reclaimed seat keeps its slot', back.seat.slot === 0);
ok('reclaimed seat keeps its score', back.seat.extra.kills === 9);
ok('reclaimed seat keeps its name', back.seat.name === 'asif');

const c = seats.claim({ name: 'citra', ws: {} }).seat;
ok('third player fits', c.slot === 2);
ok('fourth is refused', seats.claim({ name: 'dedi', ws: {} }).seat === null);

// a returning player is never refused for fullness — their seat was never given away
seats.release(c);
ok('room still full while c is away', seats.claim({ name: 'dedi', ws: {} }).seat === null);
ok('but c can come back', seats.claim({ token: c.token, ws: {} }).seat === c);

// grace expiry
seats.release(c);
ok('sweep keeps a fresh absence', seats.sweep(Date.now()).length === 0);
ok('sweep reaps an old one', seats.sweep(Date.now() + 5000).length === 1);
ok('and the slot is free again', seats.freeSlot() === 2);

console.log('ready gate:');
(async function () {
  let started = 0, changes = 0;
  const roster = [];
  const gate = new K.ReadyGate({
    members: () => roster,
    min: 2,
    countdownMs: 60,
    onStart: () => { started++; },
    onChange: () => { changes++; }
  });
  const s1 = { ready: false }, s2 = { ready: false }, s3 = { ready: false };

  roster.push(s1);
  gate.set(s1, true);
  ok('one player alone does not count down', !gate.counting());

  roster.push(s2);
  gate.rosterChanged();
  gate.set(s2, true);
  ok('two ready starts the countdown', gate.counting());
  ok('countdown reports an end time', gate.state().endsAt > Date.now());

  // un-readying mid-countdown must stop it
  gate.set(s2, false);
  ok('un-ready cancels', !gate.counting());
  await new Promise((r) => setTimeout(r, 90));
  ok('and no match started', started === 0);

  // a joiner during the countdown also cancels: they never agreed to this match
  gate.set(s2, true);
  ok('counting again', gate.counting());
  roster.push(s3);
  gate.rosterChanged();
  ok('a joiner cancels the countdown', !gate.counting());
  await new Promise((r) => setTimeout(r, 90));
  ok('still no match', started === 0);

  gate.set(s3, true);
  ok('all three ready, counting', gate.counting());
  await new Promise((r) => setTimeout(r, 90));
  ok('the match started', started === 1);

  // clear() puts everyone back to not-ready, which is the rematch case
  gate.clear();
  ok('clear un-readies everyone', !s1.ready && !s2.ready && !s3.ready);
  ok('clear stops any countdown', !gate.counting());

  // a gate that is disarmed cannot start, however ready the room is
  gate.disarm();
  s1.ready = s2.ready = s3.ready = true;
  gate.evaluate();
  ok('disarmed gate does not count', !gate.counting());
  gate.arm();
  ok('armed again it does', gate.counting());
  gate.cancel();

  ok('onChange fired along the way', changes > 0);

  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
