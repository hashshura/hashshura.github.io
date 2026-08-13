// The post's own client script, in real time, against a real Worker.
//
// Everything else in this directory drives the room in-process with a fake clock,
// which turned out to be too kind: prediction measured smooth in every synthetic
// condition — jitter, drift, stalls — while a player on the actual deployed room
// reported endless rubber banding. So this one uses real WebSockets, real network
// latency, the room's own setTimeout loop, and real requestAnimationFrame timing,
// and reports what the body on screen actually does.
//
//   npx wrangler dev --port 8787 &   node wildtest.mjs
//   SF_BASE=https://stickfight.hashshura.workers.dev node wildtest.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import WebSocketNode from 'ws';            // node's built-in cannot set Origin
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');

const BASE = process.env.SF_BASE || 'http://127.0.0.1:8787';
const SECONDS = Number(process.env.SF_SECONDS || 14);
const ORIGIN = 'https://ashura.id';
const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');
const ok = (l, c, x = '') => console.log((c ? '  ok   ' : '  FAIL ') + l + (x ? '  ' + x : ''));

// A browser-shaped WebSocket over ws, so the Worker's origin allowlist is happy.
globalThis.WebSocket = class {
  constructor(url) {
    this.readyState = 0;
    const s = new WebSocketNode(url, { origin: ORIGIN });
    s.binaryType = 'arraybuffer';
    this._s = s;
    s.on('open', () => { this.readyState = 1; this.onopen && this.onopen({}); });
    s.on('message', (data, isBinary) => {
      const payload = isBinary ? new Uint8Array(data).slice().buffer : data.toString();
      this.onmessage && this.onmessage({ data: payload });
    });
    s.on('close', () => { this.readyState = 3; this.onclose && this.onclose({}); });
    s.on('error', () => { this.onerror && this.onerror({}); });
  }
  send(d) { try { this._s.send(d); } catch (e) {} }
  close() { try { this._s.close(); } catch (e) {} }
};
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) =>
  realFetch(url, { ...opts, headers: { ...(opts.headers || {}), Origin: ORIGIN } });

const main = makeCtx(), padc = makeCtx();
const canvas = el('canvas'); canvas.width = 960; canvas.height = 540; canvas.clientWidth = 960;
canvas.getContext = () => main;
const aimpad = el('canvas'); aimpad.width = 256; aimpad.height = 256; aimpad.getContext = () => padc;
const padEl = el('div'); padEl.querySelectorAll = () => [];
padEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 190, height: 170 });
const nodes = { 'sf-canvas': canvas, 'sf-aimpad': aimpad, 'sf-pad': padEl };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));

let sampleStretch = null;
const raf = [];
globalThis.requestAnimationFrame = (fn) => { raf.push(fn); return raf.length; };
globalThis.window = {
  StickSim, StickWire, innerHeight: 900, addEventListener() {},
  performance, prompt: () => '', location: { pathname: '/x' }
};
globalThis.document = { getElementById: stub, createElement: el, addEventListener() {}, querySelector: () => el('i') };
globalThis.localStorage = {
  s: { sf_server: BASE, sf_predict: '1', sf_name: 'wild' },
  getItem(k) { return k in this.s ? this.s[k] : null; },
  setItem(k, v) { this.s[k] = v; }
};
const worlds = [];
const realCreate = StickSim.createWorld;
StickSim.createWorld = function (seed) { const w = realCreate(seed); worlds.push(w); return w; };

const post = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md', 'utf8');
eval(post.split('<script>').pop().split('</script>')[0]);

// Real frames: whatever the event loop gives us, at roughly 60Hz.
let running = true;
(function pump() {
  if (!running) return;
  const batch = raf.splice(0, raf.length);
  const t = performance.now();
  for (const fn of batch) { try { fn(t); } catch (e) { console.log('  frame threw:', e.message); } }
  if (batch.length && sampleStretch) sampleStretch();
  setTimeout(pump, 16);
})();

const padAt = (x, type) => ((listeners.get(nodes['sf-pad']) || {})[type] || []).forEach((fn) =>
  fn({ clientX: x, clientY: 85, pointerId: 1, pointerType: 'touch', buttons: 1, preventDefault() {} }));
const walk = (dir) => { padAt(dir > 0 ? 175 : 15, 'pointerup'); padAt(dir > 0 ? 175 : 15, 'pointerdown'); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

((listeners.get(nodes['sf-create']) || {}).click || []).forEach((fn) => fn({}));
await wait(2500);
ok('the client joined a real room', worlds.length >= 2,
   'note=' + JSON.stringify(nodes['sf-note'].textContent) + ' worlds=' + worlds.length);
if (worlds.length < 2) { running = false; process.exit(1); }

// The predicted world is the one holding a player called 'local'.
const predOf = () => { for (let i = worlds.length - 1; i >= 0; i--) if (worlds[i].players['local']) return worlds[i]; return null; };
ok('prediction is running', !!predOf());

const drawn = () => {
  const p = predOf().players['local'], q = p.pts[StickSim.HIPS];
  return { x: q.dx !== undefined ? q.dx : q.x, y: q.dy !== undefined ? q.dy : q.y, dead: p.dead };
};

// The complaint that no hips-only metric could see: a correction applied per joint
// draws the body with its joints displaced by different amounts — a stickman pulled
// long. Compare every drawn bone against the same bone in the simulation.
const BONES = [[StickSim.HEAD, StickSim.CHEST], [StickSim.CHEST, StickSim.HIPS],
               [StickSim.CHEST, StickSim.HANDL], [StickSim.CHEST, StickSim.HANDR],
               [StickSim.HIPS, StickSim.FOOTL], [StickSim.HIPS, StickSim.FOOTR]];
const worstStretch = () => {
  const p = predOf().players['local'];
  let w = 0;
  for (const [a, b] of BONES) {
    const pa = p.pts[a], pb = p.pts[b];
    if (pa.dx === undefined || pb.dx === undefined) continue;
    w = Math.max(w, Math.abs(Math.hypot(pa.dx - pb.dx, pa.dy - pb.dy) -
                             Math.hypot(pa.x - pb.x, pa.y - pb.y)));
  }
  return w;
};
let stretch = 0;
// Skip a corpse and the frames just after a respawn: the draw path does not
// refresh every joint for those, so the stale coordinates left behind read as
// enormous stretch — 226px of it, none of it real.
sampleStretch = () => {
  const p = predOf() && predOf().players['local'];
  // drawPlayer returns early once the hips fall below the arena — the body is not
  // drawn at all down there, so its stored draw coordinates are stale, and
  // comparing them reports a stretch that nobody could see.
  if (!p || p.dead || p.respawn > 0 || p.pts[StickSim.HIPS].y > 564) return;
  const w = worstStretch(); if (w > stretch) stretch = w;
  if (w > 20 && !globalThis.dumped && process.env.SF_DUMP) {
    globalThis.dumped = true;
    const names = { [StickSim.HEAD]:'head', [StickSim.CHEST]:'chest', [StickSim.HIPS]:'hips',
                    [StickSim.HANDL]:'handL', [StickSim.HANDR]:'handR',
                    [StickSim.FOOTL]:'footL', [StickSim.FOOTR]:'footR' };
    console.log('  stretch dump (drawn minus simulated, per joint):');
    for (const i of Object.keys(names)) {
      const q = p.pts[i];
      console.log('    ' + names[i].padEnd(6) + ' off=(' +
        (q.dx === undefined ? 'undrawn' : (q.dx - q.x).toFixed(1) + ',' + (q.dy - q.y).toFixed(1)) + ')');
    }
  }
};

// Walk back and forth for a while and watch the body on screen. A walking step is
// about 4.4px per frame; a rubber band is a frame that moves much further, and
// especially a frame that moves *backwards* against the direction being held.
let worst = 0, big = 0, reversals = 0, samples = 0, dir = 1;
let prev = drawn(), prevDx = 0;
const t0 = Date.now();
walk(dir);
while (Date.now() - t0 < SECONDS * 1000) {
  await wait(16);
  if ((Date.now() - t0) % 1500 < 20) { dir = -dir; walk(dir); }
  const now = drawn();
  if (now.dead || prev.dead) { prev = now; continue; }
  const dx = now.x - prev.x, dy = now.y - prev.y;
  const moved = Math.abs(dx) + Math.abs(dy);
  samples++;
  if (moved > worst) worst = moved;
  if (moved > 12) big++;
  // a step in the opposite direction to the previous step, while walking
  if (Math.abs(dx) > 3 && Math.abs(prevDx) > 3 && Math.sign(dx) !== Math.sign(prevDx)) reversals++;
  prev = now; prevDx = dx;
}
walk(0);

ok('the body was drawn and moving', samples > 300 && worst > 1,
   samples + ' frames sampled over ' + SECONDS + 's');
// A handful of large frames is honest: when this process is starved the client's
// clock falls behind the room's, and catching up is a teleport. What must not
// happen is a steady stream of them, which is what rubber banding was.
ok('no steady stream of frames jumping further than a walking step should', big <= 8,
   big + ' frame(s) over 12px out of ' + samples + ', worst ' + worst.toFixed(1) + 'px, ' +
   window.sfStats.resync + ' clock resyncs');
// Direction reverses when the player turns around, roughly nine times in 14s.
// Hundreds of reversals is the body being pulled back and forth: rubber banding.
ok('no bone is drawn longer than the simulation says it is', stretch < 2,
   'worst drawn-vs-simulated bone difference ' + stretch.toFixed(2) + 'px');
console.log('  stats: ' + JSON.stringify(window.sfStats));
ok('the body is not being yanked back and forth', reversals < samples * 0.05,
   reversals + ' direction reversals in ' + samples + ' frames (' +
   (100 * reversals / Math.max(1, samples)).toFixed(1) + '%)');

running = false;
process.exit(0);
