/*
 * One Durable Object per room code: the authoritative match.
 *
 * Unlike stick fight there is no physics to tick — nothing moves between
 * keystrokes. So this object is purely event-driven: a client sends the word
 * it finished typing, the server resolves one discrete action against the
 * shared sim and broadcasts what changed. The only timer it runs is the
 * ready-up countdown, and a slow housekeeping beat for stale connections and
 * the lobby heartbeat.
 *
 * Vanish and traps are why the broadcast is per-connection rather than one
 * shared buffer: a vanished player's position, and any ranger's live trap,
 * must not appear on anyone else's client.
 */
import S from '../../assets/js/wordfall-sim.js';

const MAX_PLAYERS = 6;
const READY_COUNTDOWN_MS = 3000;
const HOUSEKEEP_MS = 5000;
// Generous on purpose. A closed socket is the reliable signal that somebody
// left — the browser sends it. This timeout only exists to reap sockets whose
// other end died without saying so, and it must not fire on a real player: a
// backgrounded phone has its timers suspended by the OS, so the client
// heartbeat simply stops arriving while the tab is not visible. At 45s that
// dropped people out of rooms for glancing at another app.
const IDLE_TIMEOUT_MS = 300000;
const HEARTBEAT_MS = 30000;
// How long a seat is held open after its socket drops. A phone closes the
// WebSocket within seconds of the tab going to the background, so without this
// a glance at another app ended the match for you — and rejoining made a second
// copy of you, because the old seat was still sitting there.
const RECONNECT_GRACE_MS = 45000;
const RESET_AFTER_MS = 6000;    // how long the "match over" screen holds before the lobby reopens
const CLASSES = ['rogue', 'fighter', 'ranger', 'mage'];

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.conns = new Map();     // ws -> seat id, for routing messages
    this.seats = new Map();     // id -> {id,name,cls,token,ready,seenAt,ws,goneAt}
    this.phase = 'lobby';       // lobby | countdown | playing | ended
    this.world = null;
    this.countdownTimer = null;
    this.countdownEndsAt = 0;
    this.houseTimer = null;
    this.effectTimer = null;
    this.lastBeat = 0;
    this.meta = null;
    this.nextId = 1;
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
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
      });
    }

    if (tail === 'config' && request.method === 'POST') {
      const body = await request.json();
      const salt = crypto.getRandomValues(new Uint8Array(8)).join('-');
      this.meta = {
        code,
        name: (body.name || 'room').slice(0, 24),
        colo: body.colo || '??',
        mapSize: S.MAP_SIZES[body.mapSize] ? body.mapSize : 'medium',
        salt,
        // An invite key stands in for the password, so a link can be handed to
        // someone without also handing over the password itself.
        invite: crypto.getRandomValues(new Uint8Array(9)).join(''),
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
    // Durable Objects are created on demand, so any made-up code would
    // otherwise open a room that nobody created: not in the room list, so
    // nobody can find you, and never startable since that needs two players.
    // A room only exists once the lobby has configured it.
    if (!meta) return new Response('no such room', { status: 404 });
    const name = (url.searchParams.get('name') || 'anon').slice(0, 12);
    const cls = CLASSES.includes(url.searchParams.get('cls')) ? url.searchParams.get('cls') : 'rogue';
    const pass = url.searchParams.get('pw') || '';

    const invite = url.searchParams.get('key') || '';
    const invited = !!(meta && meta.invite && invite === meta.invite);
    if (meta && meta.hash && !invited) {
      const given = await sha256(meta.salt + pass);
      if (given !== meta.hash) return new Response('wrong password', { status: 403 });
    }
    // A token means "this is me coming back", and that is allowed mid-match:
    // the seat, the words and the position are all still there.
    const token = url.searchParams.get('token') || '';
    let seat = null;
    if (token) {
      for (const st of this.seats.values()) if (st.token === token) { seat = st; break; }
    }
    if (!seat) {
      if (this.seats.size >= MAX_PLAYERS) return new Response('room full', { status: 409 });
      if (this.phase === 'playing') return new Response('match in progress', { status: 409 });
    }

    const pair = new WebSocketPair();
    this.accept(pair[1], name, cls, seat);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  accept(ws, name, cls, seat) {
    ws.accept();
    const rejoin = !!seat;
    if (seat) {
      // Same seat, new socket. Drop the stale one if it is somehow still here.
      if (seat.ws && seat.ws !== ws) { this.conns.delete(seat.ws); try { seat.ws.close(1000, 'replaced'); } catch (e) {} }
      seat.ws = ws;
      seat.goneAt = 0;
      seat.seenAt = Date.now();
    } else {
      const id = 'p' + (this.nextId++);
      seat = { id, name, cls, ready: false, seenAt: Date.now(), ws, goneAt: 0,
               token: crypto.getRandomValues(new Uint8Array(12)).join('') };
      this.seats.set(id, seat);
    }
    this.conns.set(ws, seat.id);

    ws.addEventListener('message', (ev) => this.onMessage(ws, ev));
    const bye = () => this.drop(ws);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);

    // The token is how they get back into this exact seat.
    this.send(ws, JSON.stringify({ type: 'hello', you: seat.id, token: seat.token, phase: this.phase }));

    if (rejoin && this.phase === 'playing') {
      this.send(ws, JSON.stringify({ type: 'start', seed: this.world.seed, grid: this.world.grid }));
      this.broadcastState();
    } else {
      this.cancelCountdown();   // a joiner needs a chance to ready up too
      this.broadcastLobby();
    }
    this.startHousekeeping();
    this.lastBeat = Date.now();
    this.beat().catch(() => {});
  }

  // The socket is gone, but the person may be back in a moment. In the lobby
  // there is nothing to preserve, so the seat goes at once and the room count is
  // immediately right. Mid-match the seat is held for the grace period.
  drop(ws) {
    const id = this.conns.get(ws);
    if (id === undefined) return;
    this.conns.delete(ws);
    const seat = this.seats.get(id);
    if (!seat || seat.ws !== ws) return;
    seat.ws = null;

    if (this.phase === 'playing') {
      seat.goneAt = Date.now();
      this.broadcastState();
    } else {
      this.seats.delete(id);
      if (this.world) S.removePlayer(this.world, id);
      this.cancelCountdown();
      this.broadcastLobby();
    }
    this.lastBeat = Date.now();
    this.beat().catch(() => {});
  }

  // Sockets the runtime has already closed do not always deliver a close event,
  // and a seat left sitting there is what made a room read 1/6 with nobody in it
  // and produced a second copy of a returning player.
  reapDeadSockets() {
    for (const seat of this.seats.values()) {
      if (seat.ws && seat.ws.readyState !== undefined && seat.ws.readyState > 1) this.drop(seat.ws);
    }
  }

  liveSeats() {
    return [...this.seats.values()].filter((s) => s.ws);
  }

  onMessage(ws, ev) {
    const c = this.seats.get(this.conns.get(ws));
    if (!c) return;
    c.seenAt = Date.now();
    if (typeof ev.data !== 'string') return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }

    if (msg.type === 'setClass' && (this.phase === 'lobby' || this.phase === 'countdown')) {
      // Chosen in the room, so everyone can watch each other pick.
      if (CLASSES.includes(msg.cls)) c.cls = msg.cls;
      c.ready = false;
      this.cancelCountdown();
      this.broadcastLobby();
      return;
    }
    if (msg.type === 'ready' && (this.phase === 'lobby' || this.phase === 'countdown')) {
      c.ready = !!msg.ready;
      if (!c.ready) this.cancelCountdown();
      this.broadcastLobby();
      this.maybeStartCountdown();
    } else if (msg.type === 'action' && this.phase === 'playing') {
      this.handleAction(c.id, msg.slot, msg.word);
    }
  }

  handleAction(id, slot, word) {
    if (!S.SLOTS.includes(slot) || typeof word !== 'string') return;
    const p = this.world.players[id];
    if (!p || p.dead) return;
    // The client already clears its buffer on any submit, right or wrong; the
    // server only needs to reject a mismatch, never explain it.
    // Only the front of the slot's queue can be fired; the two behind it are
    // shown so you can read ahead, not so you can skip ahead.
    const live = S.currentWord(p, slot);
    if (!live || word.trim().toLowerCase() !== live.toLowerCase()) return;

    const result = S.resolveAction(this.world, id, slot, Date.now());
    if (!result) return;
    this.broadcastState(result);
    this.checkWinner();
  }

  // ---- lobby / ready-up ----------------------------------------------------
  maybeStartCountdown() {
    if (this.phase !== 'lobby') return;
    const conns = this.liveSeats();
    if (conns.length < 2 || !conns.every((c) => c.ready)) return;
    this.phase = 'countdown';
    this.countdownEndsAt = Date.now() + READY_COUNTDOWN_MS;
    this.countdownTimer = setTimeout(() => this.startMatch(), READY_COUNTDOWN_MS);
    this.broadcastLobby();
  }

  cancelCountdown() {
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    if (this.phase === 'countdown') this.phase = 'lobby';
  }

  broadcastLobby() {
    const roster = [...this.seats.values()].map((c) => ({
      id: c.id, name: c.name, cls: c.cls, ready: c.ready, away: !c.ws
    }));
    this.sendAll({
      type: 'lobby', phase: this.phase, roster,
      countdownEndsAt: this.phase === 'countdown' ? this.countdownEndsAt : null,
      room: this.meta ? { code: this.meta.code, name: this.meta.name,
                          mapSize: this.meta.mapSize, invite: this.meta.invite || '' } : null
    });
  }

  // ---- match -----------------------------------------------------------
  startMatch() {
    this.countdownTimer = null;
    const conns = this.liveSeats();
    if (conns.length < 2 || !conns.every((c) => c.ready)) { this.phase = 'lobby'; this.broadcastLobby(); return; }

    this.phase = 'playing';
    const seed = Date.now() % 100000;
    const mapSize = this.meta ? this.meta.mapSize : 'medium';
    this.world = S.createWorld(seed, conns.length, mapSize);
    for (const c of conns) S.addPlayer(this.world, c.id, c.name, c.cls);

    this.sendAll({ type: 'start', seed, grid: this.world.grid });
    this.broadcastState();
  }

  // A player only ever sees: their own exact position and words, everyone
  // else's position unless that player is currently vanished, their own
  // trap (never anyone else's), and whatever just happened for FX/animation.
  buildStateFor(viewerId) {
    const now = Date.now();
    const players = {};
    for (const id in this.world.players) {
      const p = this.world.players[id];
      const mine = id === viewerId;
      const hideMe = !mine && S.isVanished(p, now);
      players[id] = {
        cls: p.cls, name: p.name, hp: p.hp, dead: p.dead,
        x: hideMe ? null : p.x, y: hideMe ? null : p.y,
        hidden: hideMe,
        stunned: S.isStunned(p, now),
        stunUntil: p.stunnedUntil || 0,
        stunSpan: p.stunSpan || 0,
        // A charged mage is worth seeing coming, so this is public.
        charged: !!p.charged && (!p.chargedUntil || p.chargedUntil > now)
      };
    }
    const me = this.world.players[viewerId];
    return {
      type: 'state', you: viewerId, players,
      words: me && !me.dead ? me.words : null,
      specialReadyAt: me ? me.specialCooldownUntil : null,
      // Only ever your own: the client counts this down on its own clock to
      // show how much of your vanish is left.
      vanishUntil: me ? me.vanishUntil : 0,
      chargedUntil: me ? (me.charged ? me.chargedUntil : 0) : 0,
      // Med kits are on open ground for anyone to take.
      kits: this.world.kits.map(function (k) { return { x: k.x, y: k.y }; }),
      trap: me && this.world.traps[viewerId] ? this.world.traps[viewerId] : null
    };
  }

  broadcastState(event) {
    if (!this.world) return;
    for (const seat of this.liveSeats()) {
      const payload = this.buildStateFor(seat.id);
      if (event) payload.event = event;
      this.send(seat.ws, JSON.stringify(payload));
    }
    this.scheduleEffectExpiry();
  }

  // Vanish and stun end on a clock, but every other broadcast here is caused
  // by somebody acting — so a rogue who vanished and then stood still stayed
  // invisible on everyone else's screen indefinitely, because no message ever
  // went out to say the three seconds were up. Wake up exactly when the next
  // timed effect lapses and re-send then.
  scheduleEffectExpiry() {
    if (this.effectTimer) { clearTimeout(this.effectTimer); this.effectTimer = null; }
    if (!this.world || this.phase !== 'playing') return;
    const now = Date.now();
    // Kits are on a clock of their own, so the wake-up below has to account for
    // the next one or a quiet stretch would produce none.
    let next = this.world.nextKitAt || Infinity;
    for (const id in this.world.players) {
      const p = this.world.players[id];
      if (p.vanishUntil > now) next = Math.min(next, p.vanishUntil);
      if (p.stunnedUntil > now) next = Math.min(next, p.stunnedUntil);
    }
    if (next === Infinity) return;
    this.effectTimer = setTimeout(() => {
      this.effectTimer = null;
      if (this.phase !== 'playing' || !this.world) return;
      S.spawnKits(this.world, Date.now());
      this.broadcastState();
    }, Math.max(20, next - now + 25));
  }

  checkWinner() {
    if (!this.world || this.phase !== 'playing') return;
    const winner = S.checkWinner(this.world);
    if (winner === undefined) return;   // still contested
    this.phase = 'ended';
    this.sendAll({ type: 'ended', winner });
    setTimeout(() => this.resetToLobby(), RESET_AFTER_MS);
  }

  resetToLobby() {
    this.phase = 'lobby';
    if (this.effectTimer) { clearTimeout(this.effectTimer); this.effectTimer = null; }
    this.world = null;
    for (const c of this.seats.values()) c.ready = false;
    this.broadcastLobby();
  }

  // ---- plumbing --------------------------------------------------------
  send(ws, data) {
    try { ws.send(data); } catch (e) { this.drop(ws); }
  }

  sendAll(obj) {
    const data = JSON.stringify(obj);
    for (const seat of this.liveSeats()) this.send(seat.ws, data);
  }

  startHousekeeping() {
    if (this.houseTimer) return;
    const run = () => {
      this.houseTimer = setTimeout(() => {
        try { this.housekeep(); } catch (e) { /* one bad beat must not kill the room */ }
        if (this.seats.size === 0) { this.houseTimer = null; return; }
        run();
      }, HOUSEKEEP_MS);
    };
    run();
  }

  housekeep() {
    const now = Date.now();
    this.reapDeadSockets();
    for (const seat of [...this.seats.values()]) {
      if (seat.ws && now - seat.seenAt > IDLE_TIMEOUT_MS) {
        try { seat.ws.close(1001, 'idle'); } catch (e) {}
        this.drop(seat.ws);
        continue;
      }
      // Held seat whose owner never came back: now they are really gone.
      if (!seat.ws && seat.goneAt && now - seat.goneAt > RECONNECT_GRACE_MS) {
        this.seats.delete(seat.id);
        if (this.world) S.removePlayer(this.world, seat.id);
        if (this.phase === 'playing') { this.checkWinner(); this.broadcastState(); }
        else this.broadcastLobby();
      }
    }
    if (now - this.lastBeat > HEARTBEAT_MS) {
      this.lastBeat = now;
      this.beat().catch(() => {});
    }
  }

  async beat() {
    if (!this.meta) return;
    const stub = this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
    await stub.fetch('https://do/lobby/beat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: this.meta.code, players: this.seats.size, max: MAX_PLAYERS })
    });
  }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
