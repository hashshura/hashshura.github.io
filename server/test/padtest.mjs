// Does sliding across the pad hand over the direction? Drive the real handlers.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { makeCtx, el, listeners } = require('./shim.cjs');
const StickSim = require('../../assets/js/stickfight-sim.js');
const StickWire = require('../../assets/js/stickfight-wire.js');

const main = makeCtx(), padc = makeCtx();
const canvas = el('canvas'); canvas.width=420; canvas.height=660; canvas.getContext=()=>main;
const aimpad = el('canvas'); aimpad.width=256; aimpad.height=256; aimpad.getContext=()=>padc;
const padEl = el('div');
padEl.width = 190; padEl.height = 170;
padEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 190, height: 170 });
const btns = ['jump','l','r','duck'].map(k => { const b = el('button'); b.setAttribute('data-k', k); return b; });
padEl.querySelectorAll = () => btns;
const nodes = { 'sf-canvas': canvas, 'sf-aimpad': aimpad, 'sf-pad': padEl };
const stub = (id) => nodes[id] || (nodes[id] = el('div'));
global.window = { StickSim, StickWire, innerHeight:800, addEventListener(){}, performance:{now:()=>Date.now()} };
global.document = { getElementById: stub, createElement: el, addEventListener(){}, querySelector: ()=>el('i') };
global.localStorage = { s:{}, getItem(){return null;}, setItem(){} };
global.setInterval = () => 0;
let raf = []; global.requestAnimationFrame = fn => raf.push(fn);
const post = fs.readFileSync('../../_posts/2026-08-12-stick-fight.md', 'utf8');
const chunks = post.split('<script>');
eval(chunks[chunks.length - 1].split('</script>')[0]);
((listeners.get(nodes['sf-solo'])||{}).click||[]).forEach(fn=>fn({}));
const frame = () => { const f = raf; raf = []; f.forEach(fn=>fn(Date.now())); };
frame();

const L = listeners.get(padEl) || {};
const fire = (type, x, y) => (L[type]||[]).forEach(fn => fn({
  type, clientX:x, clientY:y, pointerId:1, pointerType:'touch', buttons:1, preventDefault(){} }));
const down = (k) => btns.find(b => b.getAttribute('data-k')===k).classList.contains('down');
const state = () => ['l','r','jump','duck'].filter(down).join('+') || 'none';

const ok = (l,c,x='') => console.log((c?'  ok   ':'  FAIL ')+l+(x?'  '+x:''));
// thumb lands on the left arrow (x=20, y=85 = middle-left)
fire('pointerdown', 20, 85);
ok('tap left  -> left', state() === 'l', state());
// slide up to the top button without lifting
fire('pointermove', 95, 12);
ok('slide to up -> jump', state() === 'jump', state());
// slide to the top-left corner: both
fire('pointermove', 20, 12);
ok('corner -> left+jump', state() === 'l+jump', state());
// slide down to duck
fire('pointermove', 95, 160);
ok('slide to down -> duck', state() === 'duck', state());
// centre = deadzone, nothing pressed
fire('pointermove', 95, 85);
ok('centre is a deadzone', state() === 'none', state());
fire('pointermove', 175, 85);
ok('slide to right -> right', state() === 'r', state());
fire('pointerup', 175, 85);
ok('lift clears everything', state() === 'none', state());
process.exit(0);
