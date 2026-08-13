# Stick Fight server

Authoritative rooms for [the Stick Fight post](../_posts/2026-08-12-stick-fight.md),
as a Cloudflare Worker with two Durable Object classes.

- **Room** — one object per room code. Runs the simulation at 60Hz, broadcasts a
  binary snapshot every third tick (20Hz), and holds the salted password hash for
  a private room. Clients only ever send 4-byte inputs, so nobody can win by
  editing their own physics. Inputs are queued and applied one per tick, so a
  burst of network jitter is spread over consecutive ticks instead of the earlier
  input being overwritten unapplied.
- **Lobby** — one global object. Lists which rooms exist, how full they are, and
  which colo they woke up in, and the country it is in — the client shows that as a
  flag next to the measured ping. A new room is created with a `locationHint` from
  the creator's continent, so the fight runs near the people in it. Never sees a
  password.

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
  you were when it handled input that left a round trip ago, so blending toward it
  drags a walking body backwards every frame — mud, and then oscillation. So the
  snapshot is taken *exactly*, and then the inputs the server has not caught up
  with are replayed from a per-tick history on top of it. Each input carries a
  sequence number, the server echoes the one it applied, and the round trip is
  measured from that echo. Whatever difference survives the replay is genuine
  correction and is eased in with a per-frame cap; a respawn is teleported
  instead, because gliding across the map through the scenery looks worse.

  It ships **off**, because a wrong prediction is worse than a late one: the
  checkbox under the controls turns it on and the choice is remembered.
  `PREDICT_DEFAULT` in the post flips the default for everyone.

  Seven things this got wrong, all worth remembering:

  - **One clock.** The send times were stamped with `Date.now()` and the round trip
    measured against `performance.now()`. Epoch minus time-since-page-load put
    `rttEst` at about -1.7e12, the replay length rounded to zero ticks, and
    prediction was silently off — which feels exactly like having no prediction at
    all. Measured 190ms local response instead of 67ms.
  - **The acked packet is not a round-trip probe.** Inputs are sent only when they
    change, so `now - sentAt[ack]` measures how old the input the server is still
    re-using is — up to 250ms more than the round trip. That read 273ms on a 120ms
    link, sized the replay at 16 ticks instead of 4, and the body sprinted ahead
    and got yanked back every snapshot: 282px in a frame, which is what
    "unplayable" looks like. The server now also reports how many ticks it has been
    re-using that input, and the round trip is only sampled on a snapshot where
    that count is 0 or 1 — a fresh ack needs no correction, and one arrives with
    every input. Subtracting the held time instead does not work: it is counted in
    server ticks and the rest in client milliseconds, and the drift made the
    estimate sag from 84ms to 28ms between sends.
  - **Replay one way, not both.** The snapshot already contains every tick the
    server ran before sending it, so the only gap left to cover is the trip down.
    Replaying a full round trip's worth double-counts.
  - **Predict with the input that was SENT, not the input that was held.** Sending
    ran on its own 50ms timer, so the server's input timeline was a coarser version
    of the client's and the two simulations were never running the same thing. Run-
    length comparing them made it plain: identical packets, different durations.
    The body's shape disagreed by 27px while simply walking undisturbed, on every
    snapshot, forever — a correction that can never succeed. Sending now happens on
    the tick the input changes, and the tick's recorded input is the packet the
    server will act on.
  - **One offset for the body, not one per joint.** A correction is rarely the same
    size at every joint, and each offset eased out at its own capped rate, so for
    the twenty-odd frames a big correction takes to vanish the body was drawn with
    its joints displaced by different amounts: a stickman pulled long, which is
    what got reported. Corrections are now split into a translation, which eases,
    and a shape, which is simply taken.
  - **A snapshot carries no velocity.** Its ox/oy is the previous snapshot's
    position — two ticks of travel — so copying it into the prediction handed the
    body twice its speed and every correction overshot. Position comes from the
    server; velocity comes from our own history when we agree with it, and from the
    snapshot interval when we do not, because a shove is mostly velocity and ours
    would be wrong.
  - **Re-anchor when our own clock stalls.** A background tab or a long frame leaves
    the client's tick counter behind the room's, the tick subtraction wraps, and
    every snapshot lands with no usable history. Measured as three-second runs of
    blind correction on a real link.
  - **Do not predict a corpse.** While dead, the local simulation ran its own
    respawn, and the sim picks the spawn point from its own random state — a
    different one than the server picked. The body flicked between the two every
    snapshot: 56 jumps of up to 630px. While dead the client now mirrors the
    server and steps nothing.

  With all four fixed, the local body responds in a constant 67ms at 120ms, 300ms
  and 600ms round trips, the largest single-frame movement of the drawn body is
  3.4-5.4px against a 4.4px walking step, and there is no vertical desync and no
  respawn flicker.

  Testing notes worth keeping, because every one of these produced a convincing
  wrong answer:

  - **The room must not drive itself.** Its loop is a self-scheduling setTimeout on
    the real timer queue, and the awaits in a test give it chances to fire on top of
    the ticks the harness drives. The server ran 23 ticks where the client ran 15,
    and that mismatch alone produces a divergence no correction can fix. It looked
    exactly like a netcode bug.
  - **Only compare drawn coordinates from the same frame.** They are stored during
    the draw, while corrections arrive on the socket between frames, and the body is
    not drawn at all when it falls below the arena. Sampling them carelessly
    reported 226px of stretch, none of it real.
  - Measure the **drawn** position, not the simulated one. Corrections are eased out in the draw offset, so the simulation
  legitimately steps while the body on screen glides — assertions against the raw
  simulation report teleports that nobody can see. And the harness has to drive
  `Date.now()` from its fake clock, or the client's input throttling never fires
  and the whole send/ack cadence under test is fiction.

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
