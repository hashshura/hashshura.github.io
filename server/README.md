# Stick Fight server

Authoritative rooms for [the Stick Fight post](../_posts/2026-08-12-stick-fight.md),
as a Cloudflare Worker with two Durable Object classes.

- **Room** — one object per room code. Runs the simulation at 60Hz, broadcasts a
  binary snapshot every third tick (20Hz), and holds the salted password hash for
  a private room. Clients only ever send 4-byte inputs, so nobody can win by
  editing their own physics.
- **Lobby** — one global object. Lists which rooms exist, how full they are, and
  which colo they woke up in. Never sees a password.

Both import `../assets/js/stickfight-sim.js` and `../assets/js/stickfight-wire.js`
directly, so the server and the browser run byte-identical physics and speak the
same wire format. Editing the sim changes both at once, which is the point.

## Deploy

```sh
cd server
npm install
npx wrangler login          # opens a browser once
npx wrangler deploy
```

If `npm install` fails with `EEXIST` / `EACCES` under `~/.npm/_cacache`, the npm
cache has root-owned files from an earlier `sudo npm install`. No sudo needed —
just use a different cache:

```sh
npm install --cache /tmp/npm-cache-sf
```

(The permanent fix, if you want it, is `sudo chown -R $(whoami) ~/.npm`.)

## Run it locally first

`wrangler dev` runs the real Worker runtime, Durable Objects included, with no
login and no deploy:

```sh
npx wrangler dev --port 8787
node test/livetest.mjs      # drives the running Worker end to end
```

`livetest.mjs` is the most valuable of the tests, because it is the only one
talking to actual workerd rather than to stubs. It creates a private room, checks
the wrong password is refused, connects two real WebSocket clients, and asserts
snapshots arrive at 20Hz, decode exactly, and that input moves the right
stickman. Note it uses the `ws` package rather than node's built-in WebSocket:
the built-in cannot set an `Origin` header, and the Worker's allowlist rejects
requests without one — which is also worth knowing if you ever write a native
client.

That prints a URL like `https://stickfight.<subdomain>.workers.dev`. Two ways to
point the game at it:

- **Try it first**, without touching the post — in the browser console on the
  post's page:
  ```js
  localStorage.setItem('sf_server', 'https://stickfight.<subdomain>.workers.dev')
  ```
  then reload. "Buat room" and "Gabung room" light up.
- **Ship it** — set `NET_URL` at the top of the post's script to the same URL and
  commit.

### Own domain (optional)

Add a DNS record for `api.ashura.id` pointing at the Worker, uncomment the
`routes` line in `wrangler.toml`, and redeploy. Then `NET_URL` is
`https://api.ashura.id`. The origin allowlist in `src/index.js` already accepts
`ashura.id`, `hashshura.github.io` and localhost — add anything else there.

## Things worth knowing before inviting people

- **Durable Objects and the free plan.** The `[[migrations]]` block declares
  `new_sqlite_classes`, which is the flavour available without a paid Workers
  plan. Check your account's current limits before assuming this is free; if you
  are on a paid plan it works either way.
- **The room lives in one place.** A Durable Object is created in the colo of
  whoever made the room, and everyone else connects to it across the network. You
  and friends in SEA will see ~20-40ms; someone in Europe joining your room will
  feel it. That is why the lobby reports each room's colo and the client pings
  each room directly and sorts nearest-first.
- **Bandwidth.** A six-player fight is ~150 bytes per snapshot, so about 3 KB/s
  down and 0.08 KB/s up per client. Fine on mobile data.
- **What the free tier actually costs you.** Cloudflare bills a Durable Object for
  *incoming* WebSocket messages (at a 20:1 ratio) and for wall-clock duration;
  outgoing messages are free. So the 20Hz snapshot broadcast — the big-looking
  number — costs nothing, and the upstream input stream is the whole bill. Two
  ceilings, both per day on the free plan:
  - **100,000 requests** → with input sent on change (~10.6 msg/s while actually
    fighting) that is roughly **50 player-hours/day**. Sending blindly at 20Hz
    would have made it 28.
  - **13,000 GB-s duration** → a running room costs 0.128 GB-s per second no
    matter how many people are in it, so about **28 room-hours/day**. This is
    usually the one that binds: six people in one room is six times cheaper per
    player than six people in six rooms.
  Hence `IDLE_CLOSE_MS` being short and heartbeats being 30s apart: an empty room
  that keeps ticking bills duration for nothing.
- **Client prediction, local player only.** Your own body is simulated in the
  browser as well, so it answers the controls immediately; the server's snapshots
  correct it. Measured against an artificial link: the local body responds in a
  constant 67ms (that is the body's own acceleration, not the network) whether the
  round trip is 120ms, 300ms or 600ms, while the server's echo scales with
  distance. Without it, a non-host waited a full round trip to see their own
  input, and said so.

  The reconciliation is the subtle part. A snapshot shows where the server thought
  you were when it handled input that left a round trip ago, so a walking body is
  *supposed* to sit ahead of it by roughly speed x latency. Blending toward the
  snapshot regardless drags the body backwards every frame — mud, and then
  oscillation. So gaps that latency explains are ignored, middling ones eased out
  at 12%, and only an unpredictable event (a hit, a death, a respawn) or a gap
  four times larger than latency allows is taken outright. Steady-state
  disagreement measured 16px at 120ms, 34px at 300ms, 71px at 600ms, with no
  runaway and no vertical desync.

  What it does not fix: someone *else's* sword still lands a round trip late.
  That needs rollback, which is a much bigger change.
- **30Hz snapshots.** Outgoing WebSocket messages are not billed, so the rate costs
  bandwidth only (~4.5 KB/s for six players). The client interpolates over the gap
  it actually measures rather than a hardcoded one.
- **Caps.** Six players per room, forty rooms in the lobby, rooms with no players
  shut their loop down after 45s and drop off the list after 45s of silence. A
  client that stops sending inputs for 20s is disconnected so its stickman is not
  left standing there as a target.

## Tests

The interesting parts are testable without deploying, because none of this
touches a real Worker runtime:

```sh
cd test
node wiretest.cjs     # 60s six-player brawl through the wire format:
                      # byte sizes vs the old JSON, and pixel-exact decoding
node servertest.mjs   # Room + Lobby with WebSocketPair/Response stubbed:
                      # wrong password refused, roster, slots freed on leave,
                      # six-player cap, heartbeat, snapshot size, position match
node onlinetest.mjs   # the actual post script against an in-process Durable
                      # Object: create room, roster, decode, draw, inputs back
node padtest.mjs      # the touch d-pad: a thumb sliding from ◀ to ▲ has to hand
                      # the direction over, and corners give both at once
node prunetest.mjs    # an emptied room ages off the lobby list
```

`shim.cjs` is a Canvas2D-to-SVG shim so the drawing can be checked without a
browser — the same trick the other game posts use.
