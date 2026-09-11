# Wordfall server

Authoritative rooms for [the Wordfall post](../_posts/2026-08-13-wordfall.md),
as a Cloudflare Worker with two Durable Object classes.

- **Room** — one object per room code. Unlike Stick Fight there is no physics to
  tick: nothing moves between keystrokes, so the object is purely event-driven.
  A client sends the word it finished typing, the server resolves one discrete
  action against the shared sim and broadcasts what changed. Broadcasts are
  per-connection rather than one shared buffer, because a vanished player's
  position and a ranger's live trap must not appear on anyone else's screen.
- **Lobby** — one global object. Lists which rooms exist and how full they are.
  Never sees a password.

## Shared with Stick Fight

The ready countdown, invite keys, seat tokens and name rules come from
`../assets/js/roomkit.js`, shared with the Stick Fight server. It knows nothing
about either game — no world, no tick, no word list.

The seat book here is deliberately *not* shared. A lobby seat is dropped the
moment its socket goes, so the room count is immediately right; a mid-match seat
is held for the grace period, because a backgrounded phone closes its WebSocket
within seconds and losing the match for glancing at another app is not
acceptable. That split is this game's own, and folding it into the shared
version would only make both harder to read.

## Deploy

```sh
cd server-wordfall
npm install
npx wrangler deploy
```

## Tests

```sh
npx wrangler dev --port 8798 --local
WF_BASE=http://127.0.0.1:8798 npm run test:live
```

`test/lobbytest.mjs` covers the lobby and the ready gate: that one player cannot
start a match, that a joiner or a class change cancels a countdown, that
un-readying stops it, and that two ready players do start one. It exists because
the gate became shared code — a bug in it is now two games' bug.
