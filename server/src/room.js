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
 */
import S from '../../assets/js/stickfight-sim.js';
import W from '../../assets/js/stickfight-wire.js';

const MAX_PLAYERS = 6;
const TICK_MS = 1000 / 60;
const SNAP_EVERY = 3;          // broadcast at 20Hz
const IDLE_CLOSE_MS = 45000;   // drop a room that nobody is in
const HEARTBEAT_MS = 10000;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.conns = new Map();            // ws -> {slot,id,name,color,seenAt}
    this.slots = new Array(W.MAX_SLOTS).fill(null);
    this.world = null;
    this.base = W.newBaseline();
    this.seq = 0;
    this.tickTimer = null;
    this.lastBeat = 0;
    this.emptyAt = Date.now();
    this.meta = null;                  // {code,name,hash,salt,colo}
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
        salt,
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
    const name = (url.searchParams.get('name') || 'anon').slice(0, 12);
    const pass = url.searchParams.get('pw') || '';

    if (meta && meta.hash) {
      const given = await sha256(meta.salt + pass);
      if (given !== meta.hash) return new Response('wrong password', { status: 403 });
    }
    if (this.conns.size >= MAX_PLAYERS) return new Response('room full', { status: 409 });

    const pair = new WebSocketPair();
    this.accept(pair[1], name);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  accept(ws, name) {
    ws.accept();
    const slot = this.slots.indexOf(null);
    if (slot < 0) { ws.close(1013, 'full'); return; }

    if (!this.world) this.world = S.createWorld(Date.now() % 100000);
    const id = 'p' + (this.nextId++);
    this.slots[slot] = id;
    S.addPlayer(this.world, id, name, slot);
    this.conns.set(ws, { slot, id, name, color: slot, seenAt: Date.now() });

    ws.addEventListener('message', (ev) => {
      const c = this.conns.get(ws);
      if (!c) return;
      c.seenAt = Date.now();
      if (typeof ev.data === 'string') return;            // no text protocol
      const p = this.world && this.world.players[c.id];
      if (p) W.decodeInput(toBuffer(ev.data), p.input);
    });
    const bye = () => this.drop(ws);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);

    this.sendRoster();
    this.startLoop();
  }

  drop(ws) {
    const c = this.conns.get(ws);
    if (!c) return;
    this.conns.delete(ws);
    this.slots[c.slot] = null;
    if (this.world) delete this.world.players[c.id];
    if (this.conns.size === 0) this.emptyAt = Date.now();
    this.sendRoster();
  }

  sendRoster() {
    const slots = [];
    for (const [, c] of this.conns) slots.push({ slot: c.slot, id: c.id, name: c.name, color: c.color });
    for (const [ws, c] of this.conns) {
      this.send(ws, JSON.stringify({
        type: 'roster', you: c.slot, slots,
        room: this.meta ? { code: this.meta.code, name: this.meta.name } : null,
        killsToWin: 10
      }));
    }
  }

  send(ws, data) {
    try { ws.send(data); } catch (e) { this.drop(ws); }
  }

  startLoop() {
    if (this.tickTimer) return;
    let next = Date.now() + TICK_MS;
    const run = () => {
      this.tickTimer = setTimeout(() => {
        try { this.tick(); } catch (e) { /* one bad tick must not kill the room */ }
        if (this.conns.size === 0 && Date.now() - this.emptyAt > IDLE_CLOSE_MS) {
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
    S.step(this.world);

    if (this.world.t % SNAP_EVERY === 0) {
      const buf = W.encodeSnapshot(this.world, this.slots, this.base, this.seq++);
      for (const [ws] of this.conns) this.send(ws, buf);
      this.world.fx.length = 0;         // effects are one-shot; clients got them
    }

    const now = Date.now();
    // hang up on a client that stopped talking; its stickman would stand there
    for (const [ws, c] of this.conns) {
      if (now - c.seenAt > 20000) { try { ws.close(1001, 'idle'); } catch (e) {} this.drop(ws); }
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
      body: JSON.stringify({
        code: this.meta.code, players: this.conns.size, max: MAX_PLAYERS
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
