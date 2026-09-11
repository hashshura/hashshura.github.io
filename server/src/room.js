/*
 * One Durable Object per room code: the authoritative fight.
 *
 * Clients only ever send inputs (4 bytes). This object steps the same physics
 * file the browser uses, at a fixed 60Hz, and broadcasts a binary snapshot every
 * third tick (20Hz). Nobody can cheat by editing their local simulation, because
 * their local simulation is only a drawing of this one.
 *
 * The loop is a self-scheduling setTimeout rather than an alarm: alarms are
 * second-granularity, and a fight needs 16ms. That is safe here because a
 * Durable Object stays resident while it holds open WebSockets — the loop is
 * started by the first player to join and stopped when the last one leaves.
 *
 * A room has two phases. In `fighting` you can drop in at any moment, which is
 * the whole character of the game and is deliberately not gated. When someone
 * reaches the kill target the round actually ends — it used to only end in each
 * client's drawing, while the server fought on forever — and the room goes to
 * `over`: scores on screen, everyone readies up, fresh arena. So the ready gate
 * sits between rounds rather than in front of them, and nobody is ever kept
 * waiting at a lobby to start playing.
 *
 * The social half of all this — seats, names, invite keys, the ready countdown,
 * and getting your seat back after a dropped connection — is not here. It is in
 * roomkit, shared with the other multiplayer game in this repo.
 */
import S from '../../assets/js/stickfight-sim.js';
import W from '../../assets/js/stickfight-wire.js';
import K from '../../assets/js/roomkit.js';

const MAX_PLAYERS = 6;
const TICK_MS = 1000 / 60;
const SNAP_EVERY = 2;          // broadcast at 30Hz. Outgoing WebSocket messages
                               // are not billed, so the only cost is bandwidth:
                               // ~4.5 KB/s for six players instead of 3.
const IDLE_CLOSE_MS = 12000;   // stop ticking soon after the room empties;
                               // an idle loop bills duration for nothing
const HEARTBEAT_MS = 30000;    // each beat is a billed request on the lobby;
                               // stay under the lobby's 45s staleness window
const KILLS_TO_WIN = 10;       // the default; a room may be made with its own
const READY_COUNTDOWN_MS = 3000;
// Long enough to walk through a tunnel, short enough that a seat held by someone
// who has actually gone does not keep a six-player room at five.
const RECONNECT_GRACE_MS = 25000;
const IDLE_DROP_MS = 20000;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Who is in the room, including whoever is currently reconnecting.
    this.seats = new K.Seats({ max: MAX_PLAYERS, graceMs: RECONNECT_GRACE_MS, prefix: 'p' });
    this.sockets = new Map();          // ws -> seat, for routing messages
    this.slots = new Array(W.MAX_SLOTS).fill(null);
    this.world = null;
    this.base = W.newBaseline();
    this.seq = 0;
    this.tickTimer = null;
    this.lastBeat = 0;
    this.emptyAt = Date.now();
    this.meta = null;                  // {code,name,hash,salt,colo,invite}
    this.place = null;                 // {colo,country} — where this object runs
    this.mapSeed = 0;
    this.phase = 'fighting';
    this.finalTable = [];              // the scores as they stood when it ended

    // Only ever armed between rounds. Live seats only: a seat that is away
    // cannot press anything, so waiting for it would hang the room until its
    // grace period ran out.
    this.gate = new K.ReadyGate({
      members: () => this.seats.live(),
      min: 2,
      countdownMs: READY_COUNTDOWN_MS,
      onStart: () => this.startRound(),
      onChange: () => this.sendRoster()
    });
    this.gate.disarm();
  }

  async loadMeta() {
    if (!this.meta) this.meta = (await this.state.storage.get('meta')) || null;
    return this.meta;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const code = url.pathname.split('/')[2];
    const tail = url.pathname.split('/')[3];

    if (tail === 'ping') {
      // Deliberately answered by the room itself, not by the edge, so the round
      // trip a client measures is the real distance to where the fight runs.
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
      });
    }

    // Called once by the lobby when the room is created.
    if (tail === 'config' && request.method === 'POST') {
      const body = await request.json();
      const salt = crypto.getRandomValues(new Uint8Array(8)).join('-');
      this.meta = {
        code,
        name: (body.name || 'room').slice(0, 24),
        colo: body.colo || '??',
        // A short round is the difference between showing someone the game and
        // making them sit through it, so the target is the room's to choose.
        killsToWin: Math.max(1, Math.min(50, body.killsToWin | 0 || KILLS_TO_WIN)),
        salt,
        // Stands in for the password, so a link can be handed to a friend
        // without also handing over the password itself.
        invite: K.makeInvite(),
        hash: body.password ? await sha256(salt + body.password) : null
      };
      await this.state.storage.put('meta', this.meta);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (tail !== 'ws') return new Response('nope', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const meta = await this.loadMeta();
    const name = K.cleanName(url.searchParams.get('name'), 12, 'anon');
    const pass = url.searchParams.get('pw') || '';
    const token = url.searchParams.get('token') || '';

    // The invite key is an alternative to the password, never a way past a check
    // that would otherwise have failed for a public room.
    if (meta && meta.hash && !K.inviteOk(meta, url.searchParams.get('key'))) {
      const given = await sha256(meta.salt + pass);
      if (given !== meta.hash) return new Response('wrong password', { status: 403 });
    }

    // Asked before accepting, so a full room is refused with a status the client
    // can explain rather than an immediate close nobody can read. A returning
    // player is not subject to this: their seat was never given away.
    if (!this.seats.byToken(token) && this.seats.freeSlot() < 0) {
      return new Response('room full', { status: 409 });
    }

    const pair = new WebSocketPair();
    this.accept(pair[1], name, token);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  accept(ws, name, token) {
    ws.accept();
    const { seat, reused } = this.seats.claim({ name, token, ws });
    if (!seat) { ws.close(1013, 'full'); return; }

    // The per-player state the fight itself needs. On a reconnect this is
    // already populated — including the score, which is the point.
    const x = seat.extra;
    x.q = x.q || [];
    x.ack = x.ack || 0;
    x.ackTick = 0;
    x.kills = x.kills || 0;
    x.deaths = x.deaths || 0;

    this.sockets.set(ws, seat);
    seat.seenAt = Date.now();

    if (!this.world) {
      this.mapSeed = Date.now() % 100000;      // one arena per room, per session
      this.world = S.createWorld(this.mapSeed);
    }
    this.spawn(seat);
    this.reslot();

    ws.addEventListener('message', (ev) => {
      const c = this.sockets.get(ws);
      if (!c) return;
      c.seenAt = Date.now();
      if (typeof ev.data === 'string') { this.onText(c, ev.data); return; }
      // Queue rather than apply. Two inputs landing in the same 16ms window used
      // to mean the first was overwritten unapplied, so a burst of network jitter
      // turned into uneven acceleration. The queue is short on purpose: it exists
      // to spread a jitter burst over consecutive ticks, not to buffer play.
      const decoded = W.decodeInput(toBuffer(ev.data), {});
      if (decoded) {
        c.extra.q.push(decoded);
        if (c.extra.q.length > 4) c.extra.q.shift();
      }
    });
    const bye = () => this.drop(ws);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);

    // The token is how they get back into this exact seat, with this exact
    // score, if the connection drops.
    this.send(ws, JSON.stringify({
      type: 'hello', you: seat.id, slot: seat.slot, token: seat.token, reused: !!reused
    }));
    this.sendRoster();
    this.gate.rosterChanged();
    this.startLoop();
    this.lastBeat = Date.now();
    this.beat().catch(() => {});
  }

  // Put a seat's body into the world, carrying its score back in. Called on join,
  // on reconnect, and for everyone at the start of a fresh round.
  spawn(seat) {
    if (!this.world) return;
    const p = S.addPlayer(this.world, seat.id, seat.name, seat.slot);
    p.kills = seat.extra.kills || 0;
    p.deaths = seat.extra.deaths || 0;
    return p;
  }

  // The wire indexes players by slot, so this array has to agree with the seats.
  reslot() {
    this.slots.fill(null);
    for (const s of this.seats.all()) this.slots[s.slot] = s.id;
  }

  // Keep the seat's copy of the score up to date with the world's, so that a
  // disconnect at nine kills is a return at nine kills.
  saveScore(seat) {
    const p = this.world && this.world.players[seat.id];
    if (!p) return;
    seat.extra.kills = p.kills;
    seat.extra.deaths = p.deaths;
  }

  onText(seat, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'setName') {
      // Joining by link never shows the menu's name box, so the room is the only
      // place some players can name themselves.
      const n = K.cleanName(msg.name, 12);
      if (!n) return;
      seat.name = n;
      const p = this.world && this.world.players[seat.id];
      if (p) p.name = n;
      this.sendRoster();
      return;
    }

    if (msg.type === 'ready') {
      // Only means anything between rounds. During a fight there is nothing to
      // be ready for — you are already in it.
      if (this.phase !== 'over') return;
      this.gate.set(seat, !!msg.ready);
      return;
    }
  }

  drop(ws) {
    const seat = this.sockets.get(ws);
    if (!seat) return;
    this.sockets.delete(ws);
    this.saveScore(seat);
    // The seat is kept for the grace period; only the body leaves, so nobody has
    // to fight a statue while its owner reconnects.
    this.seats.release(seat);
    if (this.world) delete this.world.players[seat.id];
    if (this.seats.live().length === 0) this.emptyAt = Date.now();
    this.sendRoster();
    this.gate.rosterChanged();
    // tell the lobby straight away; an empty room should stop being advertised
    this.lastBeat = Date.now();
    this.beat().catch(() => {});
  }

  roster() {
    return this.seats.all().map((s) => ({
      slot: s.slot, id: s.id, name: s.name, color: s.slot,
      ready: !!s.ready, away: !s.ws,
      kills: (this.world && this.world.players[s.id] ? this.world.players[s.id].kills
                                                    : s.extra.kills) || 0
    }));
  }

  sendRoster() {
    const slots = this.roster();
    const gate = this.gate.state();
    for (const [ws, c] of this.sockets) {
      this.send(ws, JSON.stringify({
        type: 'roster', you: c.slot, slots, seed: this.mapSeed,
        phase: this.phase,
        countdownEndsAt: gate.endsAt,
        final: this.phase === 'over' ? this.finalTable : null,
        room: this.meta ? { code: this.meta.code, name: this.meta.name,
                            invite: this.meta.invite || '' } : null,
        killsToWin: this.killTarget()
      }));
    }
  }

  // ---- rounds --------------------------------------------------------------

  killTarget() {
    return (this.meta && this.meta.killsToWin) || KILLS_TO_WIN;
  }

  endRound(winner) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    for (const s of this.seats.all()) this.saveScore(s);
    this.finalTable = this.seats.all()
      .map((s) => ({ name: s.name, kills: s.extra.kills || 0, deaths: s.extra.deaths || 0,
                     won: s.id === winner }))
      .sort((a, b) => b.kills - a.kills);
    // Everyone starts the interval un-ready, including anyone who somehow had a
    // flag left over, and only now can the gate do anything.
    this.gate.clear();
    this.gate.arm();
    this.sendRoster();
  }

  startRound() {
    this.gate.disarm();
    this.phase = 'fighting';
    this.finalTable = [];
    // A fresh arena each round, so a map that favoured someone does not decide
    // the whole evening.
    this.mapSeed = Date.now() % 100000;
    this.world = S.createWorld(this.mapSeed);
    this.base = W.newBaseline();
    for (const s of this.seats.all()) {
      s.ready = false;
      s.extra.kills = 0;
      s.extra.deaths = 0;
      s.extra.q = [];
      if (s.ws) this.spawn(s);
    }
    this.reslot();
    this.sendRoster();
    this.startLoop();
  }

  send(ws, data) {
    try { ws.send(data); } catch (e) { this.drop(ws); }
  }

  sendAll(data) {
    for (const [ws] of this.sockets) this.send(ws, data);
  }

  startLoop() {
    if (this.tickTimer) return;
    let next = Date.now() + TICK_MS;
    const run = () => {
      this.tickTimer = setTimeout(() => {
        try { this.tick(); } catch (e) { /* one bad tick must not kill the room */ }
        if (this.sockets.size === 0 && Date.now() - this.emptyAt > IDLE_CLOSE_MS) {
          this.tickTimer = null;
          this.world = null;
          this.base = W.newBaseline();
          return;
        }
        next += TICK_MS;
        run();
      }, Math.max(0, next - Date.now()));
    };
    run();
  }

  tick() {
    if (!this.world) return;
    const now = Date.now();

    // Between rounds the bodies stop where they fell. Housekeeping carries on,
    // because that is what notices the room has emptied.
    if (this.phase === 'fighting') {
      // one queued input per tick, in the order they were sent
      for (const [, c] of this.sockets) {
        const p = this.world.players[c.id];
        if (!p) continue;
        if (c.extra.q.length) {
          const inp = c.extra.q.shift();
          p.input.l = inp.l; p.input.r = inp.r; p.input.jump = inp.jump;
          p.input.duck = inp.duck; p.input.fire = inp.fire;
          p.input.discard = inp.discard; p.input.special = inp.special;
          p.input.aim = inp.aim;
          c.extra.ack = inp.seq;
          c.extra.ackTick = this.world.t;
        }
        p.ack = c.extra.ack;       // travels in the snapshot, so the client can replay
        // and how long we have been re-using it, so the client's round-trip estimate
        // is not inflated by its own send throttling
        p.held = Math.min(255, this.world.t - (c.extra.ackTick || 0));
      }

      S.step(this.world);

      if (this.world.t % SNAP_EVERY === 0) {
        const buf = W.encodeSnapshot(this.world, this.slots, this.base, this.seq++);
        this.sendAll(buf);
        this.world.fx.length = 0;         // effects are one-shot; clients got them
      }

      // The round now genuinely ends here rather than only in each client's
      // drawing. Checked after the step, so the killing blow is in the snapshot
      // everyone has already been sent.
      for (const id in this.world.players) {
        if (this.world.players[id].kills >= this.killTarget()) { this.endRound(id); break; }
      }
    }

    // hang up on a client that stopped talking; its stickman would stand there
    for (const [ws, c] of this.sockets) {
      if (now - c.seenAt > IDLE_DROP_MS) { try { ws.close(1001, 'idle'); } catch (e) {} this.drop(ws); }
    }
    // and let go of seats whose owner is not coming back
    const gone = this.seats.sweep(now);
    if (gone.length) {
      for (const s of gone) { if (this.world) delete this.world.players[s.id]; }
      this.reslot();
      this.sendRoster();
      this.gate.rosterChanged();
    }
    if (now - this.lastBeat > HEARTBEAT_MS) {
      this.lastBeat = now;
      this.beat().catch(() => {});
    }
  }

  // Where this object actually woke up. The lobby could only record the colo that
  // served the creator's HTTP request — where the host entered the network, which
  // is not where the room was then placed. A Jakarta host whose room lands in
  // Tokyo was labelled 🇮🇩 CGK, so the flag next to the ping agreed with everyone's
  // expectations and told them nothing. This asks from the inside instead.
  //
  // request.cf is no help here: the config call arrives as a DO-to-DO subrequest,
  // which carries no cf object. So the object looks itself up once and remembers.
  async whereAmI() {
    if (this.place) return this.place;
    this.place = (await this.state.storage.get('place')) || null;
    if (this.place) return this.place;
    try {
      const res = await fetch('https://workers.cloudflare.com/cf.json');
      const cf = await res.json();
      this.place = { colo: cf.colo || '??', country: (cf.country || '').toUpperCase() };
    } catch (e) {
      // Not worth a retry storm — the lobby keeps whatever it had.
      return null;
    }
    await this.state.storage.put('place', this.place);
    return this.place;
  }

  async beat() {
    if (!this.meta) return;
    const place = await this.whereAmI();
    const stub = this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
    await stub.fetch('https://do/lobby/beat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: this.meta.code, players: this.seats.live().length, max: MAX_PLAYERS,
        colo: place ? place.colo : undefined,
        country: place ? place.country : undefined
      })
    });
  }
}

function toBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (data && data.buffer) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return new ArrayBuffer(0);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
