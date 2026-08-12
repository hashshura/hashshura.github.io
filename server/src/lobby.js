/*
 * The lobby: one global Durable Object listing the rooms that exist.
 *
 * It never sees a password — it forwards the one from a create request straight
 * to the room, which salts and hashes it and keeps it. All the lobby publishes is
 * whether a room is private, so the client knows to ask for one.
 *
 * Rooms heartbeat every 10s; anything quiet for 45s is dropped from the list, so
 * a room whose object went away does not linger.
 */
const STALE_MS = 45000;
const EMPTY_MS = 20000;   // an empty room stops being advertised this soon
const MAX_ROOMS = 40;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I/L/O/0/1

export class Lobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = null;
  }

  async load() {
    if (!this.rooms) this.rooms = (await this.state.storage.get('rooms')) || {};
    return this.rooms;
  }

  async save() {
    await this.state.storage.put('rooms', this.rooms);
  }

  prune() {
    const now = Date.now();
    for (const code of Object.keys(this.rooms)) {
      const r = this.rooms[code];
      if (now - r.ts > STALE_MS) { delete this.rooms[code]; continue; }
      // Rooms heartbeat for a while after everyone leaves, so "went silent" is
      // not enough on its own — an empty room has to age out on emptiness.
      if (r.emptySince && now - r.emptySince > EMPTY_MS) delete this.rooms[code];
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    await this.load();

    if (path === '/lobby/list') {
      this.prune();
      await this.save();
      const list = Object.values(this.rooms)
        .sort((a, b) => b.ts - a.ts)
        .map((r) => ({
          code: r.code, name: r.name, private: !!r.private,
          players: r.players, max: r.max, colo: r.colo
        }));
      return json({ rooms: list });
    }

    if (path === '/lobby/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      this.prune();
      if (Object.keys(this.rooms).length >= MAX_ROOMS) {
        return json({ error: 'lobby penuh, coba lagi nanti' }, 429);
      }
      let code;
      do { code = randomCode(4); } while (this.rooms[code]);
      const colo = (request.cf && request.cf.colo) || '??';

      // hand the password to the room; the lobby keeps only the flag
      const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
      await stub.fetch('https://do/room/' + code + '/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: body.name || 'room ' + code,
          password: body.password || '',
          colo
        })
      });

      this.rooms[code] = {
        code,
        name: (body.name || 'room ' + code).slice(0, 24),
        private: !!(body.password && body.password.length),
        players: 0, max: 6, colo, ts: Date.now(),
        // the host is about to connect; give them a moment before ageing out
        emptySince: Date.now()
      };
      await this.save();
      return json({ code, colo });
    }

    if (path === '/lobby/beat' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const r = this.rooms[body.code];
      if (r) {
        r.players = body.players | 0;
        r.max = body.max || r.max;
        r.ts = Date.now();
        if (r.players > 0) r.emptySince = 0;
        else if (!r.emptySince) r.emptySince = Date.now();
        await this.save();
      }
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
}

function randomCode(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
