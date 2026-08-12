/*
 * Stick Fight — Cloudflare Worker entry point.
 *
 * Two Durable Object classes:
 *   Lobby — one global instance. Knows which rooms exist, how full they are and
 *           which colo they woke up in. Holds no secrets.
 *   Room  — one instance per room code. Owns the authoritative simulation, the
 *           WebSockets, and (for a private room) the salted password hash.
 *
 * Routes:
 *   GET  /lobby/list                 -> [{code,name,private,players,max,colo}]
 *   POST /lobby/create               -> {code}          body: {name,password}
 *   GET  /room/:code/ping            -> 204, for latency measurement
 *   GET  /room/:code/ws              -> WebSocket upgrade
 */
import { Room } from './room.js';
import { Lobby } from './lobby.js';
export { Room, Lobby };

const ALLOWED_ORIGINS = [
  /^https:\/\/ashura\.id$/,
  /^https:\/\/www\.ashura\.id$/,
  /^https:\/\/hashshura\.github\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

function allowed(origin) {
  return !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': allowed(origin) ? origin : 'https://ashura.id',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // The lobby is a plain HTTP API, so it gets CORS headers bolted on.
    if (url.pathname.startsWith('/lobby/')) {
      if (!allowed(origin)) return json({ error: 'origin' }, origin, 403);
      const stub = env.LOBBY.get(env.LOBBY.idFromName('global'));
      const res = await stub.fetch(request);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v);
      return out;
    }

    // Rooms are addressed by their code, so every client asking for ABCD lands
    // in the same object no matter which colo they entered through.
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})\/(ws|ping|config)$/);
    if (m) {
      if (m[2] === 'ws' && !allowed(origin)) {
        return new Response('bad origin', { status: 403 });
      }
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return stub.fetch(request);
    }

    return new Response('stick fight', { status: 404, headers: corsHeaders(origin) });
  }
};
