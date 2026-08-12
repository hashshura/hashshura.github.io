// Does the score strip populate above the arena, and stay off the canvas?
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');
const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');

const main = makeCtx(), padc = makeCtx();
const canvas = el('canvas'); canvas.width = 390; canvas.height = 219; canvas.clientWidth = 390;
canvas.getContext = () => main;
const aimpad = el('canvas'); aimpad.width = 256; aimpad.height = 256; aimpad.getContext = () => padc;
const padEl = el('div'); padEl.querySelectorAll = () => [];
padEl.getBoundingClientRect = () => ({left:0,top:0,width:190,height:170});
const nodes = { 'sf-canvas': canvas, 'sf-aimpad': aimpad, 'sf-pad': padEl };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));
global.window = { StickSim, StickWire, innerHeight:800, addEventListener(){}, performance:{now:()=>Date.now()} };
global.document = { getElementById: stub, createElement: el, addEventListener(){}, querySelector: ()=>el('i') };
global.localStorage = { s:{}, getItem(){return null;}, setItem(){} };
global.setInterval = () => 0;
let raf = []; global.requestAnimationFrame = fn => raf.push(fn);
const post = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md','utf8');
eval(post.split('<script>').pop().split('</script>')[0]);

const ok = (l,c,x='') => console.log((c?'  ok   ':'  FAIL ')+l+(x?'  '+x:''));
const score = nodes['sf-score'];
score.hidden = true;      // the markup carries the hidden attribute; the stub does not parse it

((listeners.get(nodes['sf-solo'])||{}).click||[]).forEach(fn=>fn({}));
let clock = 1000;
const frame = () => { clock += 16.7; const f = raf; raf = []; f.forEach(fn => fn(clock)); };
for (let i=0;i<10;i++) frame();
await new Promise(r => setTimeout(r, 140));
frame();

const rows = score.childNodes.filter(n => n.className && n.className.indexOf('who') === 0);
ok('strip shown during a match', score.hidden === false);
ok('one chip per fighter', rows.length === 4, rows.length + ' chips');
const txts = rows.map(r => r.childNodes.map(c => c.textContent).join(''));
ok('chips carry names and kills', txts.every(t => t.length > 0), JSON.stringify(txts));
ok('you are marked', rows.some(r => r.className.indexOf('self') > 0));
const goal = score.childNodes.find(n => n.className === 'goal');
ok('goal line present', !!goal && /kill/.test(goal.textContent), goal && goal.textContent);

// the canvas must no longer draw a scoreboard panel
main._clear(); frame();
const svg = main._svg(390, 219);
// the scoreboard panel must be gone from the canvas; the small labels over each
// fighter's head are meant to stay
ok('no score panel drawn on the arena', !svg.includes('sampai'));
ok('fighters still labelled in the arena', svg.includes('>kamu<'));

// weapon bar: does it report the sim's own numbers, and does discard reach it?
const gear = nodes['sf-gear'], what = nodes['sf-gear-what'], dmg = nodes['sf-gear-dmg'],
      ammo = nodes['sf-gear-ammo'], drop = nodes['sf-drop'];
ok('weapon bar visible in a match', gear.hidden === false);
ok('starts bare-handed', /TANGAN/.test(what.textContent), what.textContent);
ok('shows damage from the sim table', dmg.textContent.indexOf(StickSim.WEAPONS.fist.dmg + ' dmg') === 0, dmg.textContent);
ok('discard disabled while unarmed', drop.disabled === true);

// specials: offered only while armed, and they spend the weapon
const special = nodes['sf-special'];
ok('special disabled bare-handed', special.disabled === true);
const meId = 'me';
const w = StickSim;   // give the local player a sword through the sim
// find the world the client made by driving a pickup: simpler, drive the sim directly
const world = StickSim.createWorld(1);
const p = StickSim.addPlayer(world, 'x', 'x');
for (let i=0;i<90;i++) StickSim.step(world);
p.weapon = 'sword';
p.input.special = 1; StickSim.step(world);
ok('sword special starts a spin, blade still in hand', p.weapon === 'sword' && p.spin > 0,
   'spin=' + p.spin + ' weapon=' + p.weapon);
p.input.special = 0;
for (let i=0;i<60;i++) StickSim.step(world);      // let the spin finish first
ok('spin ends by itself, sword spent', p.spin === 0 && p.weapon === 'fist');
p.weapon = 'gun'; p.ammo = 8;
p.input.special = 1; StickSim.step(world);
ok('gun special starts a spray, gun still in hand', p.weapon === 'gun' && p.spray > 0,
   'spray=' + p.spray + ' weapon=' + p.weapon);
for (let i=0;i<60;i++) StickSim.step(world);
ok('and both are spent once the move ends', p.weapon === 'fist' && p.spin === 0 && p.spray === 0);
process.exit(0);
