// Press the SPESIAL button while holding a sword and see whether the sim spins.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');
const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');

const main = makeCtx(), padc = makeCtx();
const canvas = el('canvas'); canvas.width = 960; canvas.height = 540; canvas.clientWidth = 960;
canvas.getContext = () => main;
const aimpad = el('canvas'); aimpad.width = 256; aimpad.height = 256; aimpad.getContext = () => padc;
const padEl = el('div'); padEl.querySelectorAll = () => [];
padEl.getBoundingClientRect = () => ({left:0,top:0,width:190,height:170});
const nodes = { 'sf-canvas': canvas, 'sf-aimpad': aimpad, 'sf-pad': padEl };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));
global.window = { StickSim, StickWire, innerHeight:900, addEventListener(t,f){ (this._l ||= {})[t] = f; },
  performance:{now:()=>Date.now()} };
global.document = { getElementById: stub, createElement: el, addEventListener(){}, querySelector: ()=>el('i') };
global.localStorage = { s:{}, getItem(){return null;}, setItem(){} };
global.setInterval = () => 0;
let raf = []; global.requestAnimationFrame = fn => raf.push(fn);
// capture whatever world the client builds, since it lives in its closure
const worlds = [];
const realCreate = StickSim.createWorld;
StickSim.createWorld = function (seed) { const w = realCreate(seed); worlds.push(w); return w; };

const post = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md','utf8');
eval(post.split('<script>').pop().split('</script>')[0]);
// a fake clock: the client steps its simulation on a fixed timestep from the rAF
// timestamp, so real-time-instant frames would advance almost nothing
let clock = 1000;
const frame = () => { clock += 16.7; const f = raf; raf = []; f.forEach(fn => fn(clock)); };
const ok = (l,c,x='') => console.log((c?'  ok   ':'  FAIL ')+l+(x?'  '+x:''));

((listeners.get(nodes['sf-solo'])||{}).click||[]).forEach(fn=>fn({}));
for (let i=0;i<80;i++) frame();

// `me` lives in the client's closure; reach it through the world it drew
const btn = nodes['sf-special'];
ok('button exists', !!btn);
ok('disabled while bare-handed', btn.disabled === true, 'disabled=' + btn.disabled);

// hand the local player a sword the way a crate would
const w = worlds[worlds.length - 1];
const player = w && w.players['me'];
ok('local player found', !!player, player && player.id);
player.weapon = 'sword';
for (let i=0;i<20;i++) frame();
await new Promise(r => setTimeout(r, 140));
frame();
ok('button enabled once armed', btn.disabled === false, 'disabled=' + btn.disabled);
ok('button says PUTAR', /PUTAR/.test(btn.textContent), btn.textContent);

const handlers = listeners.get(btn) || {};
ok('button has a pointerdown handler', !!(handlers.pointerdown || []).length,
   Object.keys(handlers).join(','));
(handlers.pointerdown || []).forEach(fn => fn({ preventDefault(){} }));
for (let i=0;i<4;i++) frame();
ok('the sim started spinning', player.spin > 0, 'spin=' + player.spin + ' weapon=' + player.weapon);

// the blade must stay in hand for the whole move, or it looks like nothing happened
const held = [];
for (let i = 0; i < 50; i++) { held.push(player.weapon); frame(); }
ok('sword stays drawn during the spin', held.slice(0, 40).every(x => x === 'sword'),
   held[0] + ' ... ' + held[39]);
ok('and is spent when the spin ends', player.weapon === 'fist');
ok('button disabled again afterwards', nodes['sf-special'].disabled === true);
process.exit(0);
