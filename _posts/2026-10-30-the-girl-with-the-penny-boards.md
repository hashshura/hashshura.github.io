---
layout: post
title: The girl with the Penny boards
comments: true
thumbnail: /assets/img/2026-10-30-the-girl-with-the-penny-boards.png
teaser: "I saw her sitting there. A short game-poem, written after Wordle's answer turned out to be “penny” and I challenged myself to make a poem of it. And she was still there. So was I."
---

<style>
/* The stage breaks out of the text column so the beach is big enough to walk
   around in, but never so tall that the pad falls off the bottom of a phone. */
#pb-stage{position:relative;left:50%;transform:translateX(-50%);width:calc(100vw - 8px);max-width:880px;margin:0 0 6px;}
@supports (height: 100dvh) {
  #pb-stage{width:min(calc(100vw - 8px), max(320px, calc((100dvh - 230px) * 1.25)), 880px);}
}
#pb-canvas{display:block;width:100%;height:auto;aspect-ratio:64/51;background:#fbfbf7;border:2px solid #222;border-radius:8px;
  touch-action:pan-y;user-select:none;-webkit-user-select:none;}

#pb-controls{display:flex;justify-content:center;margin:10px 0 4px;touch-action:none;user-select:none;-webkit-user-select:none;}
#pb-pad{display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(3,48px);gap:5px;touch-action:none;}
#pb-pad .pb-btn{pointer-events:none;}   /* the pad surface owns the gesture */
#pb-pad .up{grid-area:1/2/2/3;}
#pb-pad .lf{grid-area:2/1/3/2;}
#pb-pad .rt{grid-area:2/3/3/4;}
#pb-pad .dn{grid-area:3/2/4/3;}
.pb-btn{font:inherit;font-weight:bold;font-size:19px;line-height:1;border:2px solid #222;border-radius:13px;background:#fbfbf7;color:#222;
  display:flex;align-items:center;justify-content:center;padding:0;}
.pb-btn.down{background:#222;color:#fbfbf7;}

#pb-levels{display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin:8px 0 2px;}
#pb-levels button{font:inherit;font-size:12px;font-weight:bold;width:30px;height:30px;border:1.5px solid #222;border-radius:50%;
  background:#fbfbf7;color:#222;cursor:pointer;padding:0;}
#pb-levels button.cur{background:#222;color:#fbfbf7;}
#pb-levels button:disabled{opacity:.25;cursor:default;border-color:#bbb;}

@media (max-width:400px){
  #pb-pad{grid-template-columns:repeat(3,50px);grid-template-rows:repeat(3,44px);}
}
/* Desktop: the keyboard is the real control, so the pad steps back */
@media (min-width:760px){
  #pb-pad{grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,38px);}
  #pb-controls{opacity:.8;}
}

/* The poem is played inside the game. Written out in full here it waits until
   the last line is earned; the words stay in the markup for crawlers and for
   anyone without JS, who simply sees it. */
#pb-poem{margin:22px 0 10px;}
#pb-poem.locked{display:none;}
#pb-poem.new{animation:inkfade 1.6s ease both;}
#pb-poem .st{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:1.05rem;line-height:1.6;margin:0 0 1.1em;}
@keyframes inkfade{from{opacity:0}to{opacity:1}}

/* Escape hatch for anyone who cannot play: off-screen until focused, so Tab
   reaches it and a screen reader announces it, without tempting a mouse. */
.ink-skip{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
.ink-skip:focus{position:static;width:auto;height:auto;display:inline-block;margin:6px 0 2px;padding:6px 10px;font-size:13px;border:1.5px dashed #bbb;border-radius:8px;background:#fbfbf7;color:#222;}
.ink-tools{margin:4px 0 0;text-align:right;}
.ink-reset{font:inherit;font-size:11px;color:#aaa;background:none;border:0;padding:2px 4px;cursor:pointer;text-decoration:underline dotted;}
.ink-reset:hover,.ink-reset:focus{color:#555;}
</style>

<div id="pb-stage">
  <canvas id="pb-canvas" width="640" height="510"></canvas>
  <div id="pb-controls">
    <div id="pb-pad">
      <button type="button" class="pb-btn up" data-k="u" tabindex="-1">▲</button>
      <button type="button" class="pb-btn lf" data-k="l" tabindex="-1">◀</button>
      <button type="button" class="pb-btn rt" data-k="r" tabindex="-1">▶</button>
      <button type="button" class="pb-btn dn" data-k="d" tabindex="-1">▼</button>
    </div>
  </div>
  <div id="pb-levels">
    <button type="button">1</button><button type="button">2</button><button type="button">3</button><button type="button">4</button>
    <button type="button">5</button><button type="button">6</button><button type="button">7</button><button type="button">8</button>
  </div>
</div>

<p class="ink-tools">
  <a href="#pb-poem" class="ink-skip" id="ink-skip">Skip the game — show the whole poem</a>
  <button type="button" class="ink-reset" id="ink-reset">⟲ reset progress</button>
</p>

<div id="pb-poem">
  <p class="st"><span>I saw her sitting there,</span><br><span>The girl with the Penny boards.</span></p>
  <p class="st"><span>Legs stretched out, curly hair loose,</span><br><span>Clothes simple, yet she looked like a pretty penny.</span></p>
  <p class="st"><span>I saw them lying there,</span><br><span>Two Penny boards, Tweetie and Rambo.</span></p>
  <p class="st"><span>“You’ve been sitting here a while,” I said,</span><br><span>“…A penny for your thoughts.”</span></p>
  <p class="st"><span>I saw myself resting beside her,</span><br><span>Like the bad penny that always turns up.</span></p>
  <p class="st"><span>With her around, comfort was there,</span><br><span>And it wasn’t long until the penny dropped.</span></p>
  <p class="st"><span>I saw the skies so brightly lit,</span><br><span>“In for a penny, in for a pound,” I thought.</span></p>
  <p class="st"><span>No need for doubt, she was the one—</span><br><span>The girl with the Penny boards.</span></p>
</div>

<!-- main post text goes here -->

<script>
(function(){
  // the play area is 640x400; the poem gets a band of its own above and below
  var W = 640, H = 400, TOP = 46, BOT = 64, CH = TOP + H + BOT;
  var INK = '#222', PAPER = '#fbfbf7', HAIR = '#6b4430', HAIR_D = '#3d2619';
  var SAND = '#f6efde', SEA = '#cfe5ea', SEA_D = '#7fb0bf', LEAF = '#d4e3bc';
  var WOOD = '#c9a57a', WOOD_L = '#e2cda9', WOOD_D = '#a9845a', BAMBOO = '#eadfc4', MAT = '#e7a1c0';
  var YEL = '#f2c230', PINK = '#ec6fa6', COPPER = '#c8803f', COPPER_D = '#7a4a1e', SILVER = '#c9ccd1', GOLD = '#e7b72c';
  var TAU = Math.PI * 2;
  var UI_FONT = '-apple-system,"Helvetica Neue",Arial,sans-serif';
  var POEM_FONT = 'Georgia,"Times New Roman",serif';
  // the world is drawn at 640 wide whatever the screen; on a phone that shrinks
  // the canvas text below legible, so text grows to make up for it
  var ui = 1;
  function U(px){ return Math.round(px*ui); }

  var stage = document.getElementById('pb-stage');
  var cv = document.getElementById('pb-canvas');
  var ctx = cv && cv.getContext && cv.getContext('2d');
  var poemEl = document.getElementById('pb-poem');
  var stanzas = [].slice.call(document.querySelectorAll('#pb-poem .st'));
  var lvBtns = [].slice.call(document.querySelectorAll('#pb-levels button'));
  // the poem lives once, in the markup below the game; the game borrows it
  var POEM = stanzas.map(function(p){
    var s = p.querySelectorAll('span');
    return [s[0].textContent, s[1].textContent];
  });
  var N = POEM.length;

  // ---- how far this reader has got: a count of couplets earned ----
  var SAVE_KEY = 'ashura_ink_' + ((window.location && window.location.pathname) || 'penny');
  var cleared = 0;
  try { cleared = Math.max(0, Math.min(N, parseInt(localStorage.getItem(SAVE_KEY) || '0', 10) || 0)); } catch(e){}
  function save(){ try { localStorage.setItem(SAVE_KEY, String(cleared)); } catch(e){} }

  var cur = 0;
  function syncPoem(justFinished){
    if (cleared >= N) poemEl.classList.remove('locked'); else poemEl.classList.add('locked');
    if (justFinished) poemEl.classList.add('new');
    for (var b=0;b<lvBtns.length;b++){
      lvBtns[b].disabled = b > Math.min(cleared, N-1);
      if (b === cur) lvBtns[b].classList.add('cur'); else lvBtns[b].classList.remove('cur');
    }
  }
  function revealAll(){ cleared = N; save(); syncPoem(); }

  // No canvas means no way to earn the lines, so give them away rather than
  // leaving a poem nobody can read.
  if (!ctx){ revealAll(); return; }

  // ---- input: WASD, arrows, or the pad; four directions and nothing else ----
  var keyHeld = {l:0,r:0,u:0,d:0}, keyTap = {l:0,r:0,u:0,d:0}, pad = {l:0,r:0,u:0,d:0};
  var KEYMAP = {a:'l', arrowleft:'l', d:'r', arrowright:'r', w:'u', arrowup:'u', s:'d', arrowdown:'d'};
  function stageVisible(){
    var r = stage.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 800);
  }
  window.addEventListener('keydown', function(e){
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    var k = KEYMAP[(e.key || '').toLowerCase()];
    if (!k) return;
    // arrows scroll the page; only steal them while the game is on screen
    if (e.key.indexOf('Arrow') === 0){ if (!stageVisible()) return; e.preventDefault(); }
    keyHeld[k] = 1; keyTap[k] = 1;   // the tap latch keeps a press shorter than a frame
  });
  window.addEventListener('keyup', function(e){
    var k = KEYMAP[(e.key || '').toLowerCase()];
    if (k) keyHeld[k] = 0;
  });
  window.addEventListener('blur', function(){ keyHeld = {l:0,r:0,u:0,d:0}; });

  // The d-pad is one continuous surface, not four buttons: a thumb can slide
  // from ▲ to ▼ without lifting, which is exactly what pumping Rambo needs.
  var padEl = document.getElementById('pb-pad');
  var padBtns = {};
  if (padEl){
    var all = padEl.querySelectorAll('.pb-btn');
    for (var bi=0; bi<all.length; bi++) padBtns[all[bi].getAttribute('data-k')] = all[bi];
    var mark = function(){
      for (var k in padBtns){ if (pad[k]) padBtns[k].classList.add('down'); else padBtns[k].classList.remove('down'); }
    };
    // Each finger on the pad is tracked by its own pointer id, and the held
    // direction is all of them together: hold ◀ with one thumb, tap ▲ with
    // another, and lifting ▲ leaves ◀ still held.
    var touches = {};
    var recompute = function(){
      var was = pad.l + pad.r*2 + pad.u*4 + pad.d*8;
      pad.l = pad.r = pad.u = pad.d = 0;
      for (var id in touches){ var t = touches[id]; pad.l |= t.l; pad.r |= t.r; pad.u |= t.u; pad.d |= t.d; }
      // a direction newly reached also counts as a tap, same as a key
      if (pad.l && !(was&1)) keyTap.l = 1;
      if (pad.r && !(was&2)) keyTap.r = 1;
      if (pad.u && !(was&4)) keyTap.u = 1;
      if (pad.d && !(was&8)) keyTap.d = 1;
      mark();
    };
    var release = function(e){ delete touches[e.pointerId]; recompute(); };
    var setDir = function(e){
      var r = padEl.getBoundingClientRect();
      var dx = (e.clientX - r.left) - r.width/2, dy = (e.clientY - r.top) - r.height/2;
      if (Math.abs(dx) > r.width*0.85 || Math.abs(dy) > r.height*0.85){ release(e); return; }
      var dead = Math.min(r.width, r.height) * 0.15;
      touches[e.pointerId] = { l: dx < -dead ? 1 : 0, r: dx > dead ? 1 : 0,
                               u: dy < -dead ? 1 : 0, d: dy > dead ? 1 : 0 };
      recompute();
    };
    padEl.addEventListener('pointerdown', function(e){
      e.preventDefault();
      if (padEl.setPointerCapture && e.pointerId != null){ try { padEl.setPointerCapture(e.pointerId); } catch(err){} }
      setDir(e);
    });
    padEl.addEventListener('pointermove', function(e){
      if (e.pointerType === 'mouse' && !e.buttons) return;
      if (e.cancelable) e.preventDefault();
      setDir(e);
    });
    padEl.addEventListener('pointerup', release);
    padEl.addEventListener('pointercancel', release);
    padEl.addEventListener('lostpointercapture', release);
    padEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  var ZERO = {x:0, y:0};
  var dir = ZERO, prevDir = ZERO, fresh = false, kick = false;
  function readInput(){
    var l = keyHeld.l || keyTap.l || pad.l, r = keyHeld.r || keyTap.r || pad.r;
    var u = keyHeld.u || keyTap.u || pad.u, d = keyHeld.d || keyTap.d || pad.d;
    keyTap = {l:0,r:0,u:0,d:0};
    prevDir = dir;
    dir = { x: (r?1:0) - (l?1:0), y: (d?1:0) - (u?1:0) };
    fresh = !!(dir.x || dir.y) && !(prevDir.x || prevDir.y);
    // a kick is any direction that was not held a frame ago
    kick = !!((dir.x && dir.x !== prevDir.x) || (dir.y && dir.y !== prevDir.y));
  }

  // ---- small helpers ----
  function clamp(v,a,b){ return v<a ? a : (v>b ? b : v); }
  function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
  function wrapA(a){ while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function rnd(i){ var s = Math.sin(i*12.9898 + 4.1)*43758.5453; return s - Math.floor(s); }
  function segHit(ax,ay,bx,by,cx,cy,dx,dy){
    var d = (bx-ax)*(dy-cy) - (by-ay)*(dx-cx);
    if (Math.abs(d) < 1e-9) return false;
    var t = ((cx-ax)*(dy-cy) - (cy-ay)*(dx-cx)) / d;
    var u = ((cx-ax)*(by-ay) - (cy-ay)*(bx-ax)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // ---- the player, and the level-scoped state ----
  var P, S, mode = 'play', clearT = 0, l1A = 0, l2A = 0;
  function newPlayer(x, y){
    return { x:x, y:y, vx:0, vy:0, face:1, step:0, mode:'walk', stun:0,
             h:0, s:0, lastSteer:0, carve:0, flipT:99, pumpFx:0 };
  }

  function walk(D, mul){
    var sp = 2.0 * (mul || 1);
    var n = Math.hypot(D.x, D.y) || 1;
    P.vx += (D.x/n*sp - P.vx) * 0.22;
    P.vy += (D.y/n*sp - P.vy) * 0.22;
    P.x += P.vx; P.y += P.vy;
    if (Math.abs(P.vx) > 0.15) P.face = P.vx > 0 ? 1 : -1;
    P.step += Math.hypot(P.vx, P.vy) * 0.11;
  }
  function stunned(){
    P.stun--; P.x += P.vx; P.y += P.vy; P.vx *= 0.86; P.vy *= 0.86;
  }
  // push a body (radius r) out of circles {x,y,r} and boxes {x,y,w,h}
  function collide(o, r, solids){
    var hit = false;
    for (var i=0;i<solids.length;i++){
      var s = solids[i], dx, dy, d;
      if (s.r != null){
        dx = o.x - s.x; dy = o.y - s.y; d = Math.hypot(dx, dy);
        if (d < s.r + r){ if (d < 1e-3){ dx = 1; d = 1; } o.x = s.x + dx/d*(s.r+r); o.y = s.y + dy/d*(s.r+r); hit = true; }
      } else {
        var cx = clamp(o.x, s.x, s.x+s.w), cy = clamp(o.y, s.y, s.y+s.h);
        dx = o.x - cx; dy = o.y - cy; d = Math.hypot(dx, dy);
        if (d < r){
          if (d < 1e-3){
            var l = o.x-s.x, rr = s.x+s.w-o.x, t = o.y-s.y, b = s.y+s.h-o.y, m = Math.min(l, rr, t, b);
            if (m === l) o.x = s.x - r; else if (m === rr) o.x = s.x + s.w + r;
            else if (m === t) o.y = s.y - r; else o.y = s.y + s.h + r;
          } else { o.x = cx + dx/d*r; o.y = cy + dy/d*r; }
          hit = true;
        }
      }
    }
    return hit;
  }
  function bounds(o, x0, y0, x1, y1){
    var hit = false;
    if (o.x < x0){ o.x = x0; hit = true; } if (o.x > x1){ o.x = x1; hit = true; }
    if (o.y < y0){ o.y = y0; hit = true; } if (o.y > y1){ o.y = y1; hit = true; }
    return hit;
  }

  // Tweetie, the penny board: every newly pressed direction is a kick; holding
  // only steers. Light and quick, and it stops quickly too.
  function rideTweetie(D, K){
    var ox = P.x, oy = P.y;
    if (K && (D.x || D.y)){
      var n = Math.hypot(D.x, D.y);
      P.vx += D.x/n*2.3; P.vy += D.y/n*2.3; P.pumpFx = 10;
    } else if (D.x || D.y){
      var s0 = Math.hypot(P.vx, P.vy);
      if (s0 > 0.2){
        var a = Math.atan2(P.vy, P.vx), diff = wrapA(Math.atan2(D.y, D.x) - a);
        if (Math.abs(diff) < 2.6){ a += Math.sign(diff)*Math.min(Math.abs(diff), 0.075); P.vx = Math.cos(a)*s0; P.vy = Math.sin(a)*s0; }
      }
    }
    var s = Math.hypot(P.vx, P.vy);
    if (s > 4.6){ P.vx *= 4.6/s; P.vy *= 4.6/s; }
    P.vx *= 0.976; P.vy *= 0.976;
    P.x += P.vx; P.y += P.vy;
    if (Math.abs(P.vx) > 0.1) P.face = P.vx > 0 ? 1 : -1;
    if (P.pumpFx > 0) P.pumpFx--;
    return {ox:ox, oy:oy};
  }

  // Rambo, the surfskate: holding a direction only carves toward it. Speed comes
  // from weaving: every change of carve direction after a real carve is a pump.
  function rideRambo(des, o){
    var steer = 0, diff = 0;
    if (des !== null){
      diff = wrapA(des - P.h);
      if (Math.abs(diff) > Math.PI - 0.06) diff = (P.lastSteer || 1) * Math.abs(diff);
      if (Math.abs(diff) > 0.02) steer = diff > 0 ? 1 : -1;
    }
    P.flipT++;
    if (steer){
      if (P.lastSteer && steer !== P.lastSteer){
        if (P.carve > 0.2 && P.flipT >= 9){
          P.s += 0.78 * Math.min(1, P.carve/0.45);
          P.flipT = 0; P.pumpFx = 12;
        }
        P.carve = 0;
      }
      P.lastSteer = steer;
      var rate = 0.085 - Math.min(0.03, Math.abs(P.s)*0.007);
      var before = P.h;
      P.h += steer * Math.min(Math.abs(diff), rate);
      if (o.clampH) P.h = clamp(P.h, -o.clampH, o.clampH);
      P.carve += Math.abs(P.h - before);
    }
    P.s *= o.fr;
    if (o.g) P.s += o.g * Math.cos(P.h);
    P.s = clamp(P.s, -2.5, o.max || 4.4);
    P.vx = Math.cos(P.h) * P.s; P.vy = Math.sin(P.h) * P.s;
    P.x += P.vx; P.y += P.vy;
    P.face = Math.cos(P.h) >= 0 ? 1 : -1;
    if (P.pumpFx > 0) P.pumpFx--;
  }

  // ---- drawing helpers ----
  function pen(c, w){ ctx.strokeStyle = c || INK; ctx.lineWidth = w || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  function ln(x1,y1,x2,y2){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function circ(x,y,r,fill,noStroke){ ctx.beginPath(); ctx.arc(x,y,r,0,TAU); if (fill){ ctx.fillStyle = fill; ctx.fill(); } if (!noStroke) ctx.stroke(); }
  function ell(x,y,rx,ry,fill){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU); ctx.fillStyle = fill || INK; ctx.fill(); }
  function box(x,y,w,h,fill){ ctx.beginPath(); ctx.rect(x,y,w,h); if (fill){ ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); }
  function font(px, o){ return (o && o.italic ? 'italic ' : '') + (o && o.bold ? 'bold ' : '') + px + 'px ' + (o && o.serif ? POEM_FONT : UI_FONT); }
  function text(str, x, y, px, color, opts){
    opts = opts || {};
    ctx.font = font(px, opts);
    while (px > 8 && ctx.measureText(str).width > (opts.max || W*0.92)){ px--; ctx.font = font(px, opts); }
    ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color || INK; ctx.fillText(str, x, y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  function wrapText(str, maxW){
    var words = str.split(' '), lines = [], line = '';
    for (var i=0;i<words.length;i++){
      var test = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(test).width > maxW){ lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  // A nudge for someone who has been stuck a good while, never a tutorial.
  // Levels only ask for one; it is drawn in the band under the play area.
  var hintMsg = '';
  function hint(str){ hintMsg = str; }

  // ---- the beach ----
  function drawSand(){
    ctx.fillStyle = SAND; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e4d8bb';
    for (var i=0;i<70;i++){ ctx.beginPath(); ctx.arc(rnd(i)*W, rnd(i+70)*H, 0.7 + rnd(i+140)*0.8, 0, TAU); ctx.fill(); }
  }
  // the sea along the bottom edge, foam breathing in and out
  function drawSea(y0){
    var t = S ? S.t : 0;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x=0; x<=W; x+=8) ctx.lineTo(x, y0 + Math.sin(x*0.045 + t*0.03)*2.5 + Math.sin(t*0.012)*2);
    ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = SEA; ctx.fill();
    pen(SEA_D, 1.6); ctx.beginPath();
    for (x=0; x<=W; x+=8){ var y = y0 + Math.sin(x*0.045 + t*0.03)*2.5 + Math.sin(t*0.012)*2; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    pen(SEA_D, 1.2); ctx.globalAlpha = 0.7;
    for (var k=0;k<9;k++){
      var wx = ((rnd(k)*W + t*0.25*(k%2 ? 1 : -1)) % W + W) % W, wy = y0 + 14 + rnd(k+9)*(H - y0 - 18);
      ctx.beginPath(); ctx.arc(wx, wy, 6, 1.15*Math.PI, 1.85*Math.PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawPalm(x, y, h, lean){
    var tx = x + lean, ty = y - h;
    pen(INK, 2.4); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean*0.15, y - h*0.55, tx, ty); ctx.stroke();
    pen(INK, 1.1);
    for (var i=1;i<6;i++){ var t = i/6, px = lerp(x, tx, t*t*0.7 + t*0.3), py = lerp(y, ty, t); ln(px - 2.5, py, px + 2.5, py - 1); }
    var fr = [[-1, -0.3], [-0.8, 0.45], [-0.25, -0.9], [0.3, -0.85], [0.85, 0.4], [1, -0.25]];
    for (var f=0; f<fr.length; f++){
      var ex = tx + fr[f][0]*h*0.42, ey = ty + fr[f][1]*h*0.22 + h*0.12;
      var mx = tx + fr[f][0]*h*0.22, my = ty - h*0.14 + fr[f][1]*h*0.05;
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(mx, my - 5, ex, ey);
      ctx.quadraticCurveTo(mx, my + 4, tx, ty);
      ctx.fillStyle = LEAF; ctx.fill(); pen(INK, 1.4); ctx.stroke();
    }
    pen(INK, 1.2); circ(tx - 2, ty + 3, 2.4, '#8a6a3d'); circ(tx + 2.5, ty + 4, 2.4, '#8a6a3d');
  }
  // lying flat on the sand, so it is ground you walk over, not a wall
  function drawSurfboard(x, y, col, tilt){
    ell(x + 1, y + 2, 23, 6, 'rgba(0,0,0,0.06)');
    ctx.beginPath(); ctx.ellipse(x, y, 23, 5.5, tilt || 0, 0, TAU);
    ctx.fillStyle = col; ctx.fill(); pen(INK, 1.6); ctx.stroke();
    pen(INK, 0.9); ln(x - 19*Math.cos(tilt || 0), y - 19*Math.sin(tilt || 0), x + 19*Math.cos(tilt || 0), y + 19*Math.sin(tilt || 0));
  }
  function drawRock(x, y, r){
    pen(INK, 1.6); ctx.beginPath(); ctx.ellipse(x, y - r*0.35, r, r*0.6, 0, Math.PI, TAU); ctx.closePath();
    ctx.fillStyle = '#d6d2c8'; ctx.fill(); ctx.stroke();
  }

  // her veranda: posts, a bamboo blind, the daybed with its white mattress
  // and batik pillows, and the pink mat by the door. (bx, by) is the front edge
  // of the deck; she sits on the mattress at SEAT height above it.
  var SEAT = 27;
  function drawVeranda(bx, by){
    pen(INK, 2);
    box(bx - 92, by - 128, 184, 9, WOOD_D);
    pen(INK, 1.4); for (var r=-80; r<=80; r+=20) ln(bx + r, by - 128, bx + r - 6, by - 136);
    pen(INK, 2);
    ctx.fillStyle = WOOD_L; ctx.fillRect(bx - 84, by - 44, 168, 38);
    box(bx - 74, by - 118, 148, 76, BAMBOO);
    pen('#b9a77f', 0.8); for (var bl=bx - 70; bl < bx + 72; bl += 4) ln(bl, by - 116, bl, by - 44);
    pen('#9d8a62', 1); ln(bx - 74, by - 96, bx + 74, by - 96); ln(bx - 74, by - 66, bx + 74, by - 66);
    pen(INK, 2);
    box(bx - 84, by - 120, 9, 116, WOOD); box(bx + 75, by - 120, 9, 116, WOOD);
    // the side rail on the left, as in the photo
    box(bx - 84, by - 50, 16, 4, WOOD); ln(bx - 72, by - 46, bx - 72, by - 8);
    pen('#b59a72', 1); for (var fl=by - 38; fl < by - 6; fl += 7) ln(bx - 75, fl, bx + 75, fl);
    pen(INK, 2); box(bx - 88, by - 8, 176, 12, WOOD);
    pen(INK, 1); for (var pl=bx - 66; pl < bx + 88; pl += 22) ln(pl, by - 8, pl, by + 4);
    // daybed
    pen(INK, 2);
    ln(bx - 50, by - SEAT + 14, bx - 50, by - 8); ln(bx + 50, by - SEAT + 14, bx + 50, by - 8);
    box(bx - 54, by - SEAT + 6, 108, 8, WOOD);
    var cols = ['#f0a02a', '#f3b63e', '#efe3c9', '#ece0cb', '#f3c94b'];
    for (var p=0;p<5;p++){
      var px = bx - 40 + p*20;
      pen(INK, 1.5); ctx.beginPath(); ctx.ellipse(px, by - SEAT - 9, 11.5, 10, (p - 2)*0.08, 0, TAU);
      ctx.fillStyle = cols[p]; ctx.fill(); ctx.stroke();
      pen(p < 2 || p === 4 ? '#b5651d' : '#8a6aa8', 1); ctx.beginPath(); ctx.arc(px - 2, by - SEAT - 10, 3, 0.5, 4); ctx.stroke();
    }
    pen(INK, 2);
    ctx.beginPath(); ctx.moveTo(bx - 54, by - SEAT + 6); ctx.lineTo(bx - 54, by - SEAT); ctx.quadraticCurveTo(bx - 54, by - SEAT - 3, bx - 50, by - SEAT - 3);
    ctx.lineTo(bx + 50, by - SEAT - 3); ctx.quadraticCurveTo(bx + 54, by - SEAT - 3, bx + 54, by - SEAT); ctx.lineTo(bx + 54, by - SEAT + 6); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    // the pink mat on the floor by the door
    pen(INK, 1.4); ctx.beginPath(); ctx.moveTo(bx + 56, by - 18); ctx.lineTo(bx + 76, by - 18); ctx.lineTo(bx + 79, by - 10); ctx.lineTo(bx + 58, by - 10); ctx.closePath();
    ctx.fillStyle = MAT; ctx.fill(); ctx.stroke();
  }
  // Solid over its whole footprint, so you bump into it rather than walking
  // in behind the blind. Drawn at VBACK, i.e. behind anyone standing at it.
  var VBACK = 60;
  function verandaSolids(bx, by){
    return [{x:bx - 92, y:by - 138, w:184, h:124}, {x:bx - 80, y:by - 6, r:5}, {x:bx + 80, y:by - 6, r:5}, {x:bx - 16, y:by - 4, r:9}];
  }

  // ---- people ----
  // The girl: drawn a little smaller than the narrator.
  // Hair in loose beach waves past the shoulders, a side part, a plain tee.
  var GR = 6.6;
  function hairBack(hx, hy, len){
    var sway = S ? Math.sin(S.t*0.025)*0.8 : 0, bot = hy + len, i, y;
    ctx.beginPath();
    ctx.moveTo(hx - GR - 0.5, hy - 1);
    for (i=1;i<=6;i++){ y = hy - 1 + (bot - hy + 1)*i/6; ctx.lineTo(hx - GR - 1 - i*0.45 + Math.sin(i*1.7)*1.1 + sway*i/6, y); }
    ctx.lineTo(hx - GR*0.35, bot - 1.5); ctx.lineTo(hx, bot - 3); ctx.lineTo(hx + GR*0.35, bot - 1.5);
    for (i=6;i>=1;i--){ y = hy - 1 + (bot - hy + 1)*i/6; ctx.lineTo(hx + GR + 1 + i*0.45 + Math.sin(i*1.7 + 1.3)*1.1 + sway*i/6, y); }
    ctx.lineTo(hx + GR + 0.5, hy - 1);
    ctx.arc(hx, hy, GR + 1.4, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = HAIR; ctx.fill(); pen(HAIR_D, 1); ctx.stroke();
    // a few thin waves through it
    pen(HAIR_D, 0.8);
    [-1, 1].forEach(function(side){
      ctx.beginPath();
      for (var k=0;k<=10;k++){ var yy = hy + 2 + (len - 5)*k/10, xx = hx + side*(GR + 1.2 + k*0.2) + Math.sin(k*1.4 + side)*0.9 + sway*k/10; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    });
  }
  function girlFace(hx, hy, look){
    pen(INK, 1.8); circ(hx, hy, GR, PAPER);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(hx - 2.3 + look*1.3, hy + 1, 1, 0, TAU); ctx.arc(hx + 2.3 + look*1.3, hy + 1, 1, 0, TAU); ctx.fill();
    pen(INK, 1.2); ctx.beginPath(); ctx.arc(hx + look*1.3, hy + 3, 1.9, 0.25*Math.PI, 0.75*Math.PI); ctx.stroke();
    // the top of her hair, parted to one side
    ctx.beginPath();
    ctx.arc(hx, hy, GR + 1.3, Math.PI*1.02, Math.PI*1.98);
    ctx.quadraticCurveTo(hx + GR*0.6, hy - GR*0.35, hx + GR*0.15, hy - GR*0.82);
    ctx.quadraticCurveTo(hx - GR*0.6, hy - GR*0.45, hx - GR - 1.2, hy + 1.2);
    ctx.closePath();
    ctx.fillStyle = HAIR; ctx.fill(); pen(HAIR_D, 1); ctx.stroke();
  }
  function tee(x, top, bot, hw){
    pen(INK, 1.9); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x - hw, top); ctx.lineTo(x + hw, top); ctx.lineTo(x + hw - 1, bot); ctx.lineTo(x - hw + 1, bot); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // seated on something sy high, feet down at fy: legs stretched out long
  function girlSit(gx, sy, fy, look){
    var hx = gx + look*1.1, hy = sy - 25;
    hairBack(hx, hy, 19);
    pen(INK, 2.2); ln(gx - 3, sy + 1, gx - 9, fy); ln(gx + 3, sy + 1, gx + 8, fy);
    ell(gx - 10, fy + 1, 3.3, 2); ell(gx + 9, fy + 1, 3.3, 2);
    tee(gx, sy - 17, sy + 1, 6);
    pen(INK, 1.9); ln(gx - 6, sy - 15, gx - 11, sy); ln(gx + 6, sy - 15, gx + 11, sy);
    girlFace(hx, hy, look || 0);
  }
  function girlStand(x, y, f, step, riding){
    var sw = riding ? 0 : Math.sin(step)*3.5, hy = y - 37;
    hairBack(x + f*0.6, hy, 19);
    pen(INK, 2.2);
    if (riding){ ln(x - 1, y - 15, x - 6, y); ln(x + 1, y - 15, x + 6, y); }
    else { ln(x - 2, y - 15, x - 3 + sw, y); ln(x + 2, y - 15, x + 3 - sw, y); }
    tee(x, y - 31, y - 14, 6);
    pen(INK, 1.9);
    if (riding){ ln(x - 6, y - 29, x - 15, y - 22); ln(x + 6, y - 29, x + 15, y - 24); }
    else { ln(x - 6, y - 29, x - 9 - sw*0.5, y - 17); ln(x + 6, y - 29, x + 9 + sw*0.5, y - 17); }
    girlFace(x + f*0.6, hy, f*0.8);
  }
  // The narrator.
  function meHead(x, y, f){
    pen(INK, 2); circ(x, y, 7.5, PAPER);
    pen(INK, 3.4); ctx.beginPath(); ctx.arc(x, y, 6.6, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
    var ex1 = x - 2.7 + f*1.4, ex2 = x + 2.7 + f*1.4, ey = y + 1;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex1, ey, 0.9, 0, TAU); ctx.arc(ex2, ey, 0.9, 0, TAU); ctx.fill();
    pen(INK, 1.1); circ(ex1, ey, 2.4); circ(ex2, ey, 2.4); ln(ex1 + 2.4, ey - 0.3, ex2 - 2.4, ey - 0.3);
    ln(ex1 - 2.4, ey - 0.4, x - 7.3, ey - 1.2); ln(ex2 + 2.4, ey - 0.4, x + 7.3, ey - 1.2);
  }
  // pose is stand | ride | sit; sitting, y is the seat and fy the floor
  function me(x, y, f, step, pose, moving, fy){
    pen(INK, 2.3);
    if (pose === 'sit'){
      ln(x - 3, y, x - 5, fy); ln(x + 3, y, x + 5, fy);
      ln(x, y, x, y - 18);
      pen(INK, 2); ln(x, y - 15, x - 7, y - 1); ln(x, y - 15, x + 7, y - 1);
      meHead(x, y - 27, 0);
      return;
    }
    if (pose === 'ride'){
      ln(x, y - 17, x - 7, y); ln(x, y - 17, x + 7, y);
      ln(x, y - 17, x, y - 35);
      pen(INK, 2); ln(x, y - 31, x - 12, y - 26); ln(x, y - 31, x + 12, y - 28);
    } else {
      var sw = moving ? Math.sin(step)*5 : 0;
      ln(x, y - 17, x - 2 + sw, y); ln(x, y - 17, x + 2 - sw, y);
      ln(x, y - 17, x, y - 35);
      pen(INK, 2); ln(x, y - 31, x - 6 - sw*0.6, y - 20); ln(x, y - 31, x + 6 + sw*0.6, y - 20);
    }
    meHead(x, y - 43, f);
  }
  function meWalking(){ me(P.x, P.y, P.face, P.step, 'stand', Math.hypot(P.vx, P.vy) > 0.2); }

  // a penny board side-on, wheels on the ground at (x, y)
  function drawBoard(kind, x, y, f, alpha){
    var L = kind === 't' ? 13 : 19, wr = kind === 't' ? 2.3 : 3.3, h = kind === 't' ? 4 : 5;
    var col = kind === 't' ? YEL : PINK;
    var ga = ctx.globalAlpha;
    if (alpha != null) ctx.globalAlpha = ga * alpha;
    ctx.save(); ctx.translate(x, y); ctx.scale(f || 1, 1);
    var top = -(2*wr + 2) - h, bot = top + h;
    pen(INK, 1.5);
    ln(-L+5, bot, -L+5, -wr); ln(L-5, bot, L-5, -wr);
    circ(-L+5, -wr, wr, PAPER); circ(L-5, -wr, wr, PAPER);
    ctx.beginPath();
    ctx.moveTo(-L-1, top-2.5);
    ctx.quadraticCurveTo(-L+2, top, -L+5, top);
    ctx.lineTo(L-4, top);
    ctx.quadraticCurveTo(L+1, top, L+1, top + h*0.5);
    ctx.quadraticCurveTo(L+1, bot, L-4, bot);
    ctx.lineTo(-L+5, bot);
    ctx.quadraticCurveTo(-L+1, bot, -L-1, top-2.5);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); pen(INK, 1.8); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = ga;
    return -top;   // deck height, for whoever stands on it
  }
  function drawCoin(x, y, r, col, rim){
    pen(rim || COPPER_D, 1.4); circ(x, y, r, col || COPPER);
    pen(rim || COPPER_D, 0.9); circ(x, y, r*0.58);
  }
  function drawSorted(list){
    list.sort(function(a,b){ return a.y - b.y; });
    for (var i=0;i<list.length;i++) list[i].f();
  }
  function sparkle(arr, x, y, n, col){
    for (var i=0;i<n;i++){
      var a = Math.random()*TAU, sp = 0.6 + Math.random()*2.2;
      arr.push({x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 0.6, life:40 + Math.random()*20, c:col || COPPER});
    }
  }
  function stepParts(arr, g){
    for (var i=arr.length-1;i>=0;i--){
      var p = arr[i]; p.x += p.vx; p.y += p.vy; p.vy += (g == null ? 0.05 : g); p.vx *= 0.99; p.life--;
      if (p.life <= 0) arr.splice(i, 1);
    }
  }
  function drawParts(arr){
    for (var i=0;i<arr.length;i++){
      var p = arr[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life/30));
      ctx.fillStyle = p.c; ctx.fillRect(p.x-1.5, p.y-1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  function heart(x, y, s, col){
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-6, -2, -3, -7, 0, -3.5);
    ctx.bezierCurveTo(3, -7, 6, -2, 0, 3);
    ctx.fillStyle = col || PINK; ctx.fill();
    ctx.restore();
  }
  function drawStunStars(){
    if (P.stun <= 0) return;
    pen('#999', 1.4);
    for (var i=0;i<3;i++){
      var a = S.t*0.15 + i*TAU/3, x = P.x + Math.cos(a)*10, y = P.y - 58 + Math.sin(a)*3;
      ln(x-2, y, x+2, y); ln(x, y-2, x, y+2);
    }
  }

  // =====================================================================
  // Levels 1 and 8 share a beach: up from the water to her veranda.
  // Level 1 stops you short of her; level 8 lets you sit down.
  // =====================================================================
  var SHORE = 352;
  function beach(){
    S.bx = 474; S.by = 176; S.gx = S.bx - 16;
    S.palms = [[104,150,62,8],[226,96,54,-7],[606,150,60,-9],[48,262,52,6],[320,300,50,5],[572,318,56,-6]];
    S.surf = [[168,322,'#8fd0e0',-0.12],[214,336,'#f3d36b',0.18]];
    S.rocks = [[452,334,10],[488,342,7],[640 - 120,250,8]];
    S.solids = verandaSolids(S.bx, S.by);
    S.palms.forEach(function(p){ S.solids.push({x:p[0], y:p[1], r:6}); });
    S.rocks.forEach(function(p){ S.solids.push({x:p[0], y:p[1] - 2, r:p[2]}); });
    S.boards = [{k:'t', x:S.bx - 42, y:S.by + 22, f:-1}, {k:'r', x:S.bx + 40, y:S.by + 24, f:1}];
    S.seat = {x:S.bx + 18, y:S.by - SEAT};
    P = newPlayer(84, 326);
  }
  function beachDraw(girlFn, boardAlpha){
    drawSand(); drawSea(SHORE);
    S.surf.forEach(function(p){ drawSurfboard(p[0], p[1], p[2], p[3]); });
    var list = [];
    S.palms.forEach(function(p){ list.push({y:p[1], f:function(){ drawPalm(p[0], p[1], p[2], p[3]); }}); });
    S.rocks.forEach(function(p){ list.push({y:p[1], f:function(){ drawRock(p[0], p[1], p[2]); }}); });
    list.push({y:S.by - VBACK, f:function(){
      drawVeranda(S.bx, S.by); girlFn();
      if (P.mode === 'sit') me(S.seat.x, S.seat.y, 1, 0, 'sit', false, S.by - 6);
    }});
    S.boards.forEach(function(b){ list.push({y:b.y, f:function(){ drawBoard(b.k, b.x, b.y, b.f, boardAlpha); }}); });
    if (P.mode !== 'sit') list.push({y:P.y, f:function(){ drawStunStars(); meWalking(); }});
    drawSorted(list);
  }

  var LV = [];

  // 1 — I saw her sitting there. She is a blur until you stand near enough
  // to see her; come too close and she glances up and you back off.
  LV.push({
    init: function(){ beach(); S.focus = 0; S.glance = 0; S.moved = false; },
    update: function(D, live){
      if (D.x || D.y) S.moved = true;
      if (P.stun > 0) stunned(); else walk(D);
      collide(P, 7, S.solids); bounds(P, 10, 60, W-10, SHORE - 4);
      var d = dist(P.x, P.y, S.gx, S.by);
      if (live){
        if (d < 165) S.focus = Math.min(1, S.focus + 1/75); else S.focus = Math.max(0, S.focus - 1/140);
        if (d < 62 && P.stun <= 0){
          var ax = (P.x - S.gx)/d, ay = (P.y - S.by)/d;
          P.vx = ax*3.6; P.vy = ay*3.6; P.stun = 26; S.glance = 70;
        }
        if (S.focus >= 1) complete();
      }
      if (S.done) S.focus = 1;
      if (S.glance > 0) S.glance--;
    },
    draw: function(){
      var blur = 1 - S.focus;
      var look = S.glance > 0 ? clamp((P.x - S.gx)/60, -1, 1) : 0;
      beachDraw(function(){
        if (blur < 0.03){ girlSit(S.gx, S.by - SEAT, S.by - 6, look); return; }
        // out of focus: the same doodle, several times, slightly apart
        var rad = blur*7;
        ctx.globalAlpha = 0.28;
        for (var k=0;k<5;k++){
          var a = k*TAU/5 + S.t*0.01;
          ctx.save(); ctx.translate(Math.cos(a)*rad, Math.sin(a)*rad*0.7);
          girlSit(S.gx, S.by - SEAT, S.by - 6, look);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }, clamp((S.focus - 0.55)*2.2, 0, 1));
      if (mode === 'play' && !S.moved && S.pt > 420) hint('WASD · arrow keys · or the pad below');
    }
  });

  // 2 — the portrait: pennies laid along her outline, picked up in order,
  // each one drawing the next bit of line. Legs, then hair, then clothes.
  function portrait(){
    // resample a polyline to points `step` apart, so outlines can be any shape
    function dense(pts, step){
      var out = [pts[0]], need = step;
      for (var k=1;k<pts.length;k++){
        var ax = pts[k-1][0], ay = pts[k-1][1], bx = pts[k][0], by = pts[k][1], seg = Math.hypot(bx-ax, by-ay), pos = 0;
        while (seg - pos >= need){ pos += need; var t = pos/seg; out.push([ax + (bx-ax)*t, ay + (by-ay)*t]); need = step; }
        need -= (seg - pos);
      }
      out.push(pts[pts.length-1]);
      return out;
    }
    function arcPts(cx, cy, r, a0, a1, n){ var o=[]; for (var i=0;i<=n;i++){ var a = a0 + (a1-a0)*i/n; o.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); } return o; }
    function quad(a, c, b, n){ var o=[]; for (var i=0;i<=n;i++){ var t=i/n, u=1-t; o.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0], u*u*a[1]+2*u*t*c[1]+t*t*b[1]]); } return o; }
    // legs stretched out, with a little bend at the knee
    var legL = quad([246,374], [278,322], [292,262], 20), legR = quad([348,262], [362,322], [394,374], 20);
    var head = arcPts(320, 108, 29, Math.PI/2, Math.PI/2 + TAU, 48);
    // hair: down the left side, over the crown, down the right; then waved
    var base = [], i;
    for (i=0;i<=10;i++) base.push([279 + i*0.5, 232 - i*12.4]);
    base = base.concat(arcPts(320, 108, 37, Math.PI*1.08, Math.PI*1.92, 28));
    for (i=0;i<=10;i++) base.push([356 + i*0.5, 104 + i*12.4]);
    base = dense(base, 2);
    var hair = [], run = 0;
    for (i=0;i<base.length;i++){
      var a = base[Math.max(0, i-1)], b = base[Math.min(base.length-1, i+1)];
      var nx = -(b[1]-a[1]), ny = b[0]-a[0], nl = Math.hypot(nx, ny) || 1;
      if (i) run += Math.hypot(base[i][0]-base[i-1][0], base[i][1]-base[i-1][1]);
      var off = Math.sin(run*TAU/38)*3;
      hair.push([base[i][0] + nx/nl*off, base[i][1] + ny/nl*off]);
    }
    // a plain tee: short sleeves, soft shoulders, a scooped neck
    var shirt = [[306,146]].concat(quad([306,146],[284,149],[278,158],6).slice(1))
      .concat([[268,192],[286,197]]).concat(quad([286,197],[289,230],[291,262],6).slice(1))
      .concat(quad([291,262],[320,266],[349,262],6).slice(1)).concat(quad([349,262],[351,230],[354,197],6).slice(1))
      .concat([[372,192],[362,158]]).concat(quad([362,158],[356,149],[334,146],6).slice(1))
      .concat(quad([334,146],[320,164],[306,146],8).slice(1));
    var strokes = [
      {pts:dense(legL, 3), col:INK, n:2}, {pts:dense(legR, 3), col:INK, n:2},
      {pts:dense(head, 3), col:INK, n:5}, {pts:hair, col:HAIR, n:7}, {pts:dense(shirt, 3), col:INK, n:8}
    ];
    var coins = [];
    strokes.forEach(function(st, si){
      for (var k=0;k<st.n;k++){
        var idx = Math.round(k*(st.pts.length - 1)/(st.n - 1));
        coins.push({x:st.pts[idx][0], y:st.pts[idx][1], s:si, idx:idx, got:false});
      }
    });
    S.strokes = strokes; S.coins = coins;
  }
  LV.push({
    init: function(){ portrait(); S.next = 0; S.parts = []; S.lit = 0; P = newPlayer(70, 372); },
    update: function(D, live){
      walk(D, 1.4); bounds(P, 10, 50, W-10, H-6);   // a brisker walk: the outline is long
      if (live){
        var c = S.coins[S.next];
        if (c && dist(P.x, P.y - 8, c.x, c.y) < 15){
          c.got = true; S.next++; sparkle(S.parts, c.x, c.y, 6);
          if (S.next >= S.coins.length) complete();
        }
      }
      if (S.done) S.lit = Math.min(1, S.lit + 1/90);
      stepParts(S.parts);
    },
    draw: function(){
      drawSand();
      // each penny taken uncovers her outline up to where it lay
      var i, upTo = [];
      for (i=0;i<S.coins.length;i++){ var cc = S.coins[i]; if (cc.got) upTo[cc.s] = cc.idx; }
      for (var si=0; si<S.strokes.length; si++){
        if (!upTo[si]) continue;
        var st = S.strokes[si];
        pen(st.col, 2.6 + S.lit*0.8);
        ctx.beginPath(); ctx.moveTo(st.pts[0][0], st.pts[0][1]);
        for (var k=1;k<=upTo[si];k++) ctx.lineTo(st.pts[k][0], st.pts[k][1]);
        ctx.stroke();
      }
      for (i=0;i<S.coins.length;i++){
        var c = S.coins[i];
        if (c.got) continue;
        var isNext = i === S.next;
        ctx.globalAlpha = isNext ? 1 : 0.22;
        drawCoin(c.x, c.y, isNext ? 6 + Math.sin(S.t*0.15)*0.8 : 5);
        ctx.globalAlpha = 1;
        if (isNext){ pen(COPPER, 1.2); ctx.globalAlpha = 0.5; circ(c.x, c.y, 11 + (S.t % 40)/4); ctx.globalAlpha = 1; }
      }
      if (S.lit > 0){
        // finished: a face appears in the drawing
        ctx.globalAlpha = S.lit;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(309, 108, 2.4, 0, TAU); ctx.arc(331, 108, 2.4, 0, TAU); ctx.fill();
        pen(INK, 2.2); ctx.beginPath(); ctx.arc(320, 114, 7, 0.2*Math.PI, 0.8*Math.PI); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawParts(S.parts);
      meWalking();
      drawCoin(22, 24, 6);
      text(S.next + ' / ' + S.coins.length, 34, 25, U(13), '#555', {align:'left'});
    }
  });

  // 3 — Tweetie and Rambo, lying there. Bring both back to her veranda.
  // Tweetie (yellow, a penny board) kicks and stops quick, but small wheels:
  // cracks at speed and any gravel throw you off. Rambo (pink, a surfskate)
  // can't be pushed; it only goes if you weave, and it rolls over anything.
  var GRAVEL0 = 402, GRAVEL1 = 462;
  LV.push({
    init: function(){
      S.bx = 96; S.by = 178; S.gx = S.bx - 16;
      S.deliver = {x:104, y:200};
      S.solids = verandaSolids(S.bx, S.by);
      S.cracks = [
        [[196,44],[206,74],[194,104],[208,134],[198,164]],
        [[200,236],[190,266],[204,296],[194,330],[206,364],[198,396]],
        [[282,96],[272,128],[288,158],[276,192],[290,224],[280,258],[292,292],[282,326]],
        [[352,170],[364,196],[350,222],[362,250],[352,276]],
        [[316,360],[340,352],[352,370]]
      ];
      S.gravel = [];
      for (var i=0;i<170;i++) S.gravel.push([GRAVEL0 + rnd(i)*(GRAVEL1-GRAVEL0), 44 + rnd(i+300)*352, 0.8 + rnd(i+600)*1.4]);
      S.boards = [
        {k:'t', name:'Tweetie', x:338, y:82, f:-1, state:'lying', armed:true},
        {k:'r', name:'Rambo', x:588, y:300, f:-1, state:'lying', armed:true}
      ];
      S.slots = {t:{x:62, y:206}, r:{x:140, y:208}};
      S.delivered = 0; S.tags = 0; S.tHold = 0; S.rSlow = 0;
      P = newPlayer(206, 262);
    },
    update: function(D, live){
      var b, i;
      if (P.stun > 0) stunned();
      else if (P.mode === 'walk') walk(D, (P.x > GRAVEL0 && P.x < GRAVEL1) ? 0.55 : 1);
      else if (P.mode === 't'){
        var o = rideTweetie(D, live && kick);
        var sp = Math.hypot(P.vx, P.vy);
        S.tHold = (D.x || D.y) && sp < 0.4 ? S.tHold + 1 : Math.max(0, S.tHold - 2);
        if (P.x > GRAVEL0 - 4){ this.throwOff('gravel', GRAVEL0 - 16); }
        else if (sp > 1.35){
          for (var c=0;c<S.cracks.length && P.mode==='t';c++){
            var cr = S.cracks[c];
            for (var k=1;k<cr.length;k++){
              if (segHit(o.ox, o.oy, P.x, P.y, cr[k-1][0], cr[k-1][1], cr[k][0], cr[k][1])){ this.throwOff('crack'); break; }
            }
          }
        }
      } else if (P.mode === 'r'){
        var des = (D.x || D.y) ? Math.atan2(D.y, D.x) : null;
        var gravel = P.x > GRAVEL0 && P.x < GRAVEL1;
        rideRambo(des, {fr: gravel ? 0.986 : 0.992, g: P.x > GRAVEL1 ? 0.028 : 0});
        S.rSlow = Math.abs(P.s) < 0.6 ? S.rSlow + 1 : 0;
      }
      var hit = collide(P, 7, S.solids) | bounds(P, 10, 44, W-10, H-6);
      if (hit && P.mode === 'r') P.s *= 0.4;
      if (hit && P.mode === 't'){ P.vx *= 0.4; P.vy *= 0.4; }

      for (i=0;i<S.boards.length;i++){
        b = S.boards[i];
        if (b.state === 'ridden'){ b.x = P.x; b.y = P.y; b.f = P.face; continue; }
        if (b.state !== 'lying') continue;
        var d = dist(P.x, P.y, b.x, b.y);
        if (!b.armed){ if (d > 22) b.armed = true; continue; }
        if (live && P.mode === 'walk' && P.stun <= 0 && d < 13){
          b.state = 'ridden'; P.mode = b.k;
          if (b.k === 'r'){
            var sp0 = Math.hypot(P.vx, P.vy);
            P.h = sp0 > 0.3 ? Math.atan2(P.vy, P.vx) : Math.PI;
            P.s = 0; P.lastSteer = 0; P.carve = 0; P.flipT = 99;
          }
        }
      }
      // ride into her to hand a board back
      if (live && P.mode !== 'walk' && dist(P.x, P.y, S.deliver.x, S.deliver.y) < 60){
        for (i=0;i<S.boards.length;i++){
          b = S.boards[i];
          if (b.state !== 'ridden') continue;
          b.state = 'home'; b.x = S.slots[b.k].x; b.y = S.slots[b.k].y; b.f = b.k === 't' ? -1 : 1;
          P.mode = 'walk'; P.vx = 0.8; P.vy = 1.2; S.delivered++;
        }
        if (S.delivered >= 2) complete();
      }
      if (S.done) S.tags = Math.min(1, S.tags + 1/60);
    },
    throwOff: function(why, bx){
      var b = P.mode === 't' ? S.boards[0] : S.boards[1];
      b.state = 'lying'; b.armed = false; b.x = bx != null ? bx : P.x - P.vx*2; b.y = P.y;
      P.mode = 'walk'; P.stun = 34;
      if (why === 'gravel'){ P.x = (bx || P.x) + 12; P.vx = 0.6; P.vy = 0; }
      else { P.vx *= 0.35; P.vy *= 0.35; }
    },
    draw: function(){
      var i;
      drawSand();
      // the concrete path, the gravel strip, then the road falling away downhill
      ctx.fillStyle = '#ecebe5'; ctx.fillRect(186, 0, GRAVEL0 - 186, H);
      pen('#000', 1); ctx.globalAlpha = 0.07;
      for (var x=186; x<GRAVEL0; x+=40) ln(x, 0, x, H);
      for (var y=20; y<H; y+=40) ln(186, y, GRAVEL0, y);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8f8a80';
      for (i=0;i<S.gravel.length;i++){ var g = S.gravel[i]; ctx.beginPath(); ctx.arc(g[0], g[1], g[2], 0, TAU); ctx.fill(); }
      pen('#c8bfa8', 1.5);
      for (x=GRAVEL1+26; x<W; x+=44) for (y=70; y<H; y+=56){ ln(x-4, y-5, x+2, y); ln(x+2, y, x-4, y+5); }
      pen('#555', 1.7);
      S.cracks.forEach(function(cr){
        ctx.beginPath(); ctx.moveTo(cr[0][0], cr[0][1]);
        for (var k=1;k<cr.length;k++) ctx.lineTo(cr[k][0], cr[k][1]);
        ctx.stroke();
      });

      var list = [];
      list.push({y:S.by - VBACK, f:function(){ drawVeranda(S.bx, S.by); girlSit(S.gx, S.by - SEAT, S.by - 6, clamp((P.x - S.gx)/120, -1, 1)); }});
      S.boards.forEach(function(b){
        if (b.state === 'ridden') return;
        list.push({y:b.y, f:function(){
          drawBoard(b.k, b.x, b.y, b.f);
          if (S.tags > 0){ ctx.globalAlpha = S.tags; text(b.name, b.x, b.y + 8 + U(6), U(12), b.k === 't' ? '#b08a10' : '#c2457d', {bold:true}); ctx.globalAlpha = 1; }
        }});
      });
      list.push({y:P.y, f:function(){
        drawStunStars();
        if (P.mode === 't' || P.mode === 'r'){
          var deck = drawBoard(P.mode, P.x, P.y, P.face);
          me(P.x, P.y - deck, P.face, 0, 'ride');
          if (P.pumpFx > 0){ pen(P.mode === 'r' ? PINK : YEL, 1.6); ctx.globalAlpha = P.pumpFx/12; ln(P.x - P.face*24, P.y - 6, P.x - P.face*34, P.y - 8); ln(P.x - P.face*24, P.y - 2, P.x - P.face*36, P.y - 1); ctx.globalAlpha = 1; }
        } else meWalking();
      }});
      drawSorted(list);

      // nudges only once someone has clearly been stuck for a while
      if (mode === 'play'){
        if (P.mode === 'r' && S.rSlow > 60*10) hint('Rambo won’t be pushed. it wants to weave.');
        else if (P.mode === 't' && S.tHold > 60*6) hint('Tweetie goes by taps, not holds');
        else if (S.delivered === 0 && P.mode === 'walk' && S.pt > 60*40) hint('they’re hers. bring them back to her.');
      }
    }
  });

  // 4 — a penny for your thoughts. Her thoughts drift above her; rushing
  // scares them off. Stand still near her and they come to you, one by one.
  var ICONS = 6;
  function drawIcon(k, x, y){
    pen(INK, 1.4);
    if (k === 0){ ctx.save(); ctx.translate(x, y + 4); ctx.scale(0.55, 0.55); drawBoard('t', 0, 0, 1); ctx.restore(); }
    else if (k === 1){ ctx.save(); ctx.translate(x, y + 4); ctx.scale(0.45, 0.45); drawBoard('r', 0, 0, 1); ctx.restore(); }
    else if (k === 2){
      ctx.beginPath();
      for (var i=0;i<10;i++){ var a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? 2.6 : 6; ctx.lineTo(x + Math.cos(a)*r, y + Math.sin(a)*r); }
      ctx.closePath(); ctx.fillStyle = YEL; ctx.fill(); ctx.stroke();
    } else if (k === 3){
      pen('#3b7ea1', 1.8); ctx.beginPath();
      for (var j=0;j<=12;j++){ var xx = x - 6 + j, yy = y + Math.sin(j*0.9)*2.5; if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    } else if (k === 4){
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0.6, TAU - 0.6, false); ctx.arc(x + 3, y, 4.2, TAU - 0.9, 0.9, true); ctx.closePath();
      ctx.fillStyle = '#f5e7a8'; ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.lineTo(x - 2, y - 4); ctx.lineTo(x + 1, y); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x + 7, y + 4); ctx.closePath();
      ctx.fillStyle = '#dfe6ee'; ctx.fill(); ctx.stroke();
    }
  }
  function drawBubble(b, alpha){
    ctx.globalAlpha = alpha;
    pen(INK, 1.6); circ(b.x, b.y, 13, '#ffffff');
    drawIcon(b.k, b.x, b.y);
    ctx.globalAlpha = 1;
  }
  LV.push({
    init: function(){
      S.bx = 320; S.by = 216; S.gx = S.bx - 16;
      S.solids = verandaSolids(S.bx, S.by);
      S.palms = [[90,170,60,7],[556,166,58,-8],[146,320,46,4],[514,322,50,-5]];
      S.palms.forEach(function(p){ S.solids.push({x:p[0], y:p[1], r:6}); });
      S.bubbles = [];
      for (var i=0;i<ICONS;i++) S.bubbles.push({k:i, a:i*TAU/ICONS, x:S.gx, y:S.by - 100, st:'orbit', scare:0});
      S.got = 0; S.still = 0; S.cool = 0; S.scared = 0;
      P = newPlayer(320, 340);
    },
    home: function(b){ return {x:S.gx + Math.cos(b.a + S.t*0.006)*60, y:S.by - 104 + Math.sin(b.a + S.t*0.006)*20}; },
    update: function(D, live){
      walk(D); collide(P, 7, S.solids); bounds(P, 10, 44, W-10, SHORE - 4);
      var sp = Math.hypot(P.vx, P.vy), d = dist(P.x, P.y, S.gx, S.by);
      S.still = sp < 0.12 ? S.still + 1 : 0;
      if (S.cool > 0) S.cool--;
      if (sp > 1.5 && d < 170) S.scared = 70;
      if (S.scared > 0) S.scared--;
      var drifting = null, i, b;
      for (i=0;i<S.bubbles.length;i++) if (S.bubbles[i].st === 'drift') drifting = S.bubbles[i];
      if (live && !drifting && S.still > 55 && d < 210 && S.cool <= 0 && S.got < 5){
        for (i=0;i<S.bubbles.length;i++){ b = S.bubbles[(i + S.got*2) % S.bubbles.length]; if (b.st === 'orbit'){ b.st = 'drift'; break; } }
      }
      for (i=0;i<S.bubbles.length;i++){
        b = S.bubbles[i];
        if (b.st === 'orbit' || b.st === 'back'){
          var h = this.home(b);
          b.x += (h.x - b.x)*(b.st === 'back' ? 0.08 : 0.05); b.y += (h.y - b.y)*(b.st === 'back' ? 0.08 : 0.05);
          if (b.st === 'back' && dist(b.x, b.y, h.x, h.y) < 4) b.st = 'orbit';
          b.scare += ((S.scared > 0 ? 1 : 0) - b.scare)*0.1;
        } else if (b.st === 'drift'){
          if (sp > 0.25){ b.st = 'back'; S.cool = 50; continue; }
          var tx = P.x, ty = P.y - 60, dd = dist(b.x, b.y, tx, ty);
          b.x += (tx - b.x)/dd*1.25; b.y += (ty - b.y)/dd*1.25 + Math.sin(S.t*0.08)*0.2;
          if (dd < 10){ b.st = 'got'; S.got++; S.cool = 40; S.still = 0; if (S.got >= 5) complete(); }
        } else if (b.st === 'got'){
          var n = 0; for (var j=0;j<i;j++) if (S.bubbles[j].st === 'got') n++;
          var a = S.t*0.03 + n*TAU/5;
          b.x += (P.x + Math.cos(a)*22 - b.x)*0.2; b.y += (P.y - 70 + Math.sin(a)*8 - b.y)*0.2;
        }
      }
    },
    draw: function(){
      drawSand(); drawSea(SHORE + 8);
      var list = [];
      S.palms.forEach(function(p){ list.push({y:p[1], f:function(){ drawPalm(p[0], p[1], p[2], p[3]); }}); });
      list.push({y:S.by - VBACK, f:function(){ drawVeranda(S.bx, S.by); girlSit(S.gx, S.by - SEAT, S.by - 6, clamp((P.x - S.gx)/120, -1, 1)); }});
      list.push({y:P.y, f:meWalking});
      drawSorted(list);
      // the little trail of dots from her head to her thoughts
      pen(INK, 1.2); ctx.globalAlpha = 0.6;
      circ(S.gx + 8, S.by - SEAT - 36, 2.2, '#fff'); circ(S.gx + 13, S.by - SEAT - 45, 3, '#fff');
      ctx.globalAlpha = 1;
      for (var i=0;i<S.bubbles.length;i++){
        var b = S.bubbles[i];
        var al = b.st === 'got' ? 0.95 : (b.st === 'orbit' ? 1 - b.scare*0.75 : 1);
        if (b.st === 'got'){ ctx.save(); ctx.translate(b.x, b.y); ctx.scale(0.7, 0.7); ctx.translate(-b.x, -b.y); drawBubble(b, al); ctx.restore(); }
        else drawBubble(b, al);
      }
      // the "..." of someone working up to saying something
      var dots = Math.min(3, Math.floor(S.still/22));
      ctx.fillStyle = '#777';
      for (var k=0;k<dots;k++){ ctx.beginPath(); ctx.arc(P.x + 12 + k*5, P.y - 54, 1.6, 0, TAU); ctx.fill(); }
      text(S.got + ' / 5', 16, 25, U(13), '#555', {align:'left'});
      if (mode === 'play' && S.pt > 60*35 && S.got === 0) hint('you don’t have to do anything. just be there.');
    }
  });

  // 5 — the bad penny. You start beside her. Every way out leads back in.
  LV.push({
    init: function(){
      S.bx = 320; S.by = 206; S.gx = S.bx - 16; S.seat = {x:S.bx + 18, y:S.by - SEAT};
      S.solids = verandaSolids(S.bx, S.by);
      S.palms = [[86,96,52,7],[184,150,44,-5],[470,92,56,-7],[566,160,48,6],[86,330,50,5],[196,362,44,-4],[470,344,52,6],[570,306,46,-6]];
      S.palms.forEach(function(p){ S.solids.push({x:p[0], y:p[1], r:6}); });
      S.turns = 0; S.glance = 0; S.note = null; S.parts = [];
      P = newPlayer(S.seat.x, S.by - 2); P.mode = 'sit';
    },
    update: function(D, live){
      if (P.mode === 'sit'){
        if (live && (D.x || D.y) && !S.done){ P.mode = 'walk'; P.y = S.by + 12; }
        stepParts(S.parts); if (S.glance > 0) S.glance--;
        return;
      }
      walk(D); collide(P, 7, S.solids);
      var wrapped = false;
      if (P.x < -14){ P.x = W + 12; wrapped = true; } else if (P.x > W + 14){ P.x = -12; wrapped = true; }
      if (P.y < 20){ P.y = H + 10; wrapped = true; } else if (P.y > H + 12){ P.y = 22; wrapped = true; }
      if (wrapped && live){
        S.turns++; S.glance = 90;
        S.note = {t:120, s:['…and back again.', 'there I am again.', 'fine. sit down, then.'][Math.min(2, S.turns-1)]};
      }
      if (S.glance > 0) S.glance--;
      if (S.note && --S.note.t <= 0) S.note = null;
      if (live && S.turns >= 3 && dist(P.x, P.y, S.seat.x, S.by + 4) < 14){
        P.mode = 'sit';
        sparkle(S.parts, S.seat.x, S.by - 60, 10, '#8a6a4a');
        complete();
      }
      stepParts(S.parts);
    },
    draw: function(){
      drawSand();
      // trodden paths away from the veranda, off every edge: a shade darker
      // than the sand, edged with footprint dashes
      ctx.fillStyle = '#ede1c3';
      ctx.fillRect(0, S.by + 14, W, 32);
      ctx.fillRect(S.bx - 18, S.by + 14, 36, H - S.by - 14);
      ctx.fillRect(S.bx - 18, 0, 36, S.by - 138);
      pen('#cdbd96', 1.4);
      ctx.setLineDash([5, 6]);
      ln(0, S.by + 14, S.bx - 18, S.by + 14); ln(S.bx + 18, S.by + 14, W, S.by + 14);
      ln(0, S.by + 46, S.bx - 18, S.by + 46); ln(S.bx + 18, S.by + 46, W, S.by + 46);
      ln(S.bx - 18, S.by + 46, S.bx - 18, H); ln(S.bx + 18, S.by + 46, S.bx + 18, H);
      ln(S.bx - 18, S.by - 138, S.bx - 18, 0); ln(S.bx + 18, S.by - 138, S.bx + 18, 0);
      ctx.setLineDash([]);
      var list = [];
      S.palms.forEach(function(p){ list.push({y:p[1], f:function(){ drawPalm(p[0], p[1], p[2], p[3]); }}); });
      var look = S.glance > 0 ? clamp((P.x - S.gx)/80, -1, 1) : 0.6;
      list.push({y:S.by - VBACK, f:function(){
        drawVeranda(S.bx, S.by); girlSit(S.gx, S.by - SEAT, S.by - 6, look);
        if (P.mode === 'sit') me(S.seat.x, S.seat.y, 1, 0, 'sit', false, S.by - 6);
      }});
      if (P.mode !== 'sit') list.push({y:P.y, f:meWalking});
      drawSorted(list);
      drawParts(S.parts);
      // one tarnished penny for every time you turned up again
      for (var i=0;i<S.turns;i++) drawCoin(22 + i*16, 24, 6, '#9b7a55', '#5e4630');
      if (S.note){
        ctx.globalAlpha = Math.min(1, S.note.t/30);
        var nx = clamp(P.x, 80, W-80), ny = P.mode === 'sit' ? S.by - 80 : clamp(P.y - 64, 30, H - 30);
        text(S.note.s, nx, ny, U(13), '#666', {italic:true, serif:true});
        ctx.globalAlpha = 1;
      }
      if (mode === 'play' && P.mode === 'sit' && S.pt > 60*20 && !S.done) hint('you could always get up');
    }
  });

  // 6 — comfort. She walks with you now, along wherever you've been, and the
  // beach is dark except around her. Leave her light and everything drags.
  var FENCES = [{x:148, y:40, w:22, h:254}, {x:300, y:118, w:22, h:282}, {x:452, y:40, w:22, h:254}];
  LV.push({
    init: function(){
      S.solids = FENCES.slice();
      S.lamp = {x:584, y:104};
      S.solids.push({x:S.lamp.x, y:S.lamp.y, r:6});
      P = newPlayer(64, 348);
      S.G = {x:40, y:360, face:1, step:0};
      S.trail = [{x:P.x, y:P.y}]; S.gi = 0;
      S.R = 100; S.drop = null; S.lit = 0; S.parts = []; S.lost = 0;
    },
    update: function(D, live){
      var G = S.G;
      var inLight = dist(P.x, P.y, G.x, G.y) < S.R;
      S.lost = inLight ? 0 : S.lost + 1;
      if (!S.drop){
        walk(D, inLight ? 1 : 0.35); collide(P, 7, S.solids); bounds(P, 10, 50, W-10, H-6);
        var last = S.trail[S.trail.length-1];
        if (dist(P.x, P.y, last.x, last.y) > 3) S.trail.push({x:P.x, y:P.y});
      } else { P.vx *= 0.8; P.vy *= 0.8; }
      // she keeps to your footsteps, a few steps behind
      if (S.gi < S.trail.length - 9){
        var tp = S.trail[S.gi], dx = tp.x - G.x, dy = tp.y - G.y, d = Math.hypot(dx, dy);
        if (d < 1.4) S.gi++;
        else { G.x += dx/d*1.35; G.y += dy/d*1.35; G.step += 0.19; if (Math.abs(dx) > 0.3) G.face = dx > 0 ? 1 : -1; }
      }
      if (live && !S.drop && dist(P.x, P.y, S.lamp.x, S.lamp.y + 30) < 46 && dist(G.x, G.y, P.x, P.y) < 90){
        S.drop = {x:P.x + 18, y:-10, vy:0, bounces:0, floor:P.y + 2};
      }
      if (S.drop){
        S.lit = Math.min(1, S.lit + 1/70);
        var p = S.drop;
        if (p.bounces < 4){
          p.vy += 0.32; p.y += p.vy;
          if (p.y >= p.floor){
            p.y = p.floor; p.vy = -p.vy*0.42; p.bounces++;
            sparkle(S.parts, p.x, p.y, 4);
            if (p.bounces >= 4){ p.vy = 0; complete(); }
          }
        }
      }
      stepParts(S.parts);
    },
    draw: function(){
      var G = S.G;
      drawSand();
      FENCES.forEach(function(h){
        pen(INK, 2); box(h.x, h.y, h.w, h.h, BAMBOO);
        pen('#a8936a', 1);
        for (var x=h.x + 4; x<h.x + h.w; x+=5) ln(x, h.y + 2, x, h.y + h.h - 2);
        pen('#8c7650', 1.2);
        for (var y=h.y + 14; y<h.y + h.h; y+=30) ln(h.x, y, h.x + h.w, y);
      });
      // lamp post at the end of the walk
      pen(INK, 2.2); ln(S.lamp.x, S.lamp.y, S.lamp.x, S.lamp.y - 52);
      box(S.lamp.x - 6, S.lamp.y - 64, 12, 12, '#fff3c4');
      var list = [];
      list.push({y:G.y, f:function(){ girlStand(G.x, G.y, G.face, G.step, false); }});
      list.push({y:P.y, f:meWalking});
      drawSorted(list);
      if (S.drop) drawCoin(S.drop.x, S.drop.y, 6);
      drawParts(S.parts);

      // the dark, with one warm hole in it that follows her
      var dark = 1 - S.lit;
      if (dark > 0){
        var cx = G.x, cy = G.y - 20;
        var grad = ctx.createRadialGradient(cx, cy, S.R*0.55, cx, cy, S.R*1.12);
        grad.addColorStop(0, 'rgba(255,214,140,' + (0.10*dark) + ')');
        grad.addColorStop(1, 'rgba(22,20,34,' + (0.94*dark) + ')');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        // the lamp shows through, so there is somewhere to walk to
        var lg = ctx.createRadialGradient(S.lamp.x, S.lamp.y - 58, 2, S.lamp.x, S.lamp.y - 58, 30);
        lg.addColorStop(0, 'rgba(255,236,170,' + (0.95*dark) + ')'); lg.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = lg; ctx.fillRect(S.lamp.x - 32, S.lamp.y - 90, 64, 64);
        // and you can still make yourself out in the dark, barely
        if (dist(P.x, P.y, G.x, G.y) > S.R*0.8){
          ctx.globalAlpha = 0.35 * dark;
          pen('#cfcfe0', 2); circ(P.x, P.y - 43, 7.5); ln(P.x, P.y - 35, P.x, P.y - 17); ln(P.x, P.y - 17, P.x - 3, P.y); ln(P.x, P.y - 17, P.x + 3, P.y);
          ctx.globalAlpha = 1;
        }
      }
      if (mode === 'play' && !S.drop && S.lost > 60*12) hint('it’s easier with her near');
    }
  });

  // 7 — in for a penny, in for a pound. Both of you ride the coast road,
  // under a sky that keeps getting brighter. No brakes, no going back.
  var ROAD_LEN = 3000, HORIZON = 112, BEACH = 146;
  function roadY(x){ return 276 + 48*Math.sin(x/270) + 16*Math.sin(x/83 + 1); }
  LV.push({
    init: function(){
      P = newPlayer(120, roadY(120)); P.mode = 'r'; P.h = 0; P.s = 1.4;
      S.cam = 0; S.G = {x:84, y:roadY(84) + 22};
      S.coins = []; S.pence = 0; S.fw = []; S.parts = []; S.slow = 0;
      for (var x=260, k=0; x<ROAD_LEN - 120; x+=48, k++){
        var p = x/ROAD_LEN, kind;
        if (p < 0.3) kind = {v:1, r:5, c:COPPER, rim:COPPER_D};
        else if (p < 0.55) kind = {v:2, r:6, c:COPPER, rim:COPPER_D};
        else if (p < 0.8) kind = {v:(k%2 ? 20 : 10), r:6.5, c:SILVER, rim:'#7d8187'};
        else kind = {v:100, r:7.5, c:GOLD, rim:'#8a6a12'};
        S.coins.push({x:x, y:roadY(x) + Math.sin(k*Math.PI/2)*30, kind:kind, got:false});
      }
      S.stars = [];
      for (var i=0;i<90;i++) S.stars.push({x:rnd(i)*W*1.6, y:6 + rnd(i+90)*(HORIZON - 16), r:0.6 + rnd(i+180)*1.3, tw:rnd(i+270)*TAU});
    },
    update: function(D, live){
      var des = null;
      if (live && (D.y || D.x > 0)) des = clamp(Math.atan2(D.y, Math.max(D.x, 0)), -1.25, 1.25);
      var off = Math.abs(P.y - roadY(P.x)) > 60;
      rideRambo(des, {fr: off ? 0.975 : 0.994, clampH: 1.25, max: 5});
      if (P.s < 0) P.s = 0;
      if (bounds(P, -1e9, BEACH + 18, 1e9, H - 8)) P.s *= 0.96;
      S.cam = Math.max(S.cam, P.x - 210);
      if (P.x < S.cam + 18){ P.x = S.cam + 18; }
      S.slow = P.s < 0.4 ? S.slow + 1 : 0;
      for (var i=0;i<S.coins.length;i++){
        var c = S.coins[i];
        if (!c.got && dist(P.x, P.y - 6, c.x, c.y) < 15){ c.got = true; S.pence += c.kind.v; sparkle(S.parts, c.x, c.y, 5, c.kind.c); }
      }
      // she glides alongside on Tweetie, on whichever side of you has room
      var G = S.G, ry = roadY(P.x - 30);
      var ty = P.y > ry ? P.y - 30 : P.y + 30;
      ty = clamp(ty, BEACH + 22, H - 10);
      G.x += (P.x - 34 - G.x)*0.08; G.y += (ty - G.y)*0.05;
      var p = clamp(P.x/ROAD_LEN, 0, 1);
      if (Math.random() < p*p*0.05 + (S.done ? 0.18 : 0)) this.firework();
      for (var f=S.fw.length-1; f>=0; f--){ var q = S.fw[f]; q.x += q.vx; q.y += q.vy; q.vy += 0.025; q.vx *= 0.985; q.life--; if (q.life <= 0) S.fw.splice(f, 1); }
      stepParts(S.parts);
      if (live && P.x > ROAD_LEN + 10) complete();
    },
    firework: function(){
      var x = 40 + Math.random()*(W - 80), y = 20 + Math.random()*(HORIZON - 54);
      var cols = [YEL, PINK, '#8fd6ff', '#fff3b0', '#c9a7ff'], c = cols[(Math.random()*cols.length)|0];
      for (var i=0;i<28;i++){
        var a = i*TAU/28, sp = 1 + Math.random()*0.7;
        S.fw.push({x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:55 + Math.random()*20, c:c});
      }
    },
    draw: function(){
      var p = clamp(P.x/ROAD_LEN, 0, 1);
      drawSand();
      // the sky: deep night that warms toward the end of the road
      var sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
      function mix(a, b, t){ return 'rgb(' + [0,1,2].map(function(i){ return Math.round(a[i] + (b[i]-a[i])*t); }).join(',') + ')'; }
      sky.addColorStop(0, mix([18,20,48], [44,40,104], p));
      sky.addColorStop(1, mix([52,44,86], [246,170,96], p));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HORIZON); ctx.clip();
      for (var i=0;i<S.stars.length;i++){
        var st = S.stars[i], sx = ((st.x - S.cam*0.08) % (W*1.6) + W*1.6) % (W*1.6);
        if (sx > W) continue;
        ctx.globalAlpha = (0.45 + 0.55*Math.abs(Math.sin(S.t*0.03 + st.tw))) * (0.55 + p*0.45);
        ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(sx, st.y, st.r*(1 + p*0.6), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (var f=0; f<S.fw.length; f++){
        var q = S.fw[f]; ctx.globalAlpha = Math.min(1, q.life/30); ctx.fillStyle = q.c; ctx.fillRect(q.x - 1.3, q.y - 1.3, 2.6, 2.6);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // the sea under it, catching the light, then the shore
      var sea = ctx.createLinearGradient(0, HORIZON, 0, BEACH);
      sea.addColorStop(0, mix([40,52,90], [120,150,180], p)); sea.addColorStop(1, mix([70,90,120], [180,205,215], p));
      ctx.fillStyle = sea; ctx.fillRect(0, HORIZON, W, BEACH - HORIZON);
      pen('rgba(255,255,255,0.35)', 1);
      for (var w=0; w<7; w++){ var wx = ((rnd(w)*W - S.cam*0.2) % W + W) % W, wy = HORIZON + 6 + rnd(w+7)*(BEACH - HORIZON - 12); ln(wx - 8, wy, wx + 8, wy); }
      pen(INK, 2); ln(0, HORIZON, W, HORIZON);
      pen(SEA_D, 1.6); ctx.beginPath();
      for (var x=0; x<=W; x+=8){ var yy = BEACH + Math.sin((x + S.cam)*0.04 + S.t*0.03)*2; if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
      ctx.stroke();

      ctx.save(); ctx.translate(-S.cam, 0);
      var x0 = Math.floor(S.cam/8)*8;
      pen('#999', 1.8);
      [-60, 60].forEach(function(o){
        ctx.beginPath();
        for (var x=x0; x<=S.cam + W + 8; x+=8){ var y = roadY(x) + o; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      });
      pen('#ccc', 1.6); ctx.setLineDash([10, 14]);
      ctx.beginPath();
      for (x=x0; x<=S.cam + W + 8; x+=8){ var ry = roadY(x); if (x === x0) ctx.moveTo(x, ry); else ctx.lineTo(x, ry); }
      ctx.stroke(); ctx.setLineDash([]);
      // the end of the road: two posts and a string of flags
      if (S.cam + W > ROAD_LEN - 40){
        var fy = roadY(ROAD_LEN);
        pen(INK, 2); ln(ROAD_LEN, fy - 70, ROAD_LEN, fy - 112); ln(ROAD_LEN, fy + 70, ROAD_LEN, fy + 10);
        pen(INK, 1.2); ctx.beginPath(); ctx.moveTo(ROAD_LEN, fy - 110); ctx.quadraticCurveTo(ROAD_LEN + 6, fy - 40, ROAD_LEN, fy + 12); ctx.stroke();
        for (var k=0;k<9;k++){
          var t = k/8, ax = ROAD_LEN + 6*2*t*(1-t), ay = lerp(fy - 110, fy + 12, t);
          ctx.fillStyle = k%2 ? PINK : YEL; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 9, ay + 5); ctx.lineTo(ax, ay + 10); ctx.closePath(); ctx.fill();
        }
      }
      for (i=0;i<S.coins.length;i++){
        var c = S.coins[i];
        if (c.got || c.x < S.cam - 10 || c.x > S.cam + W + 10) continue;
        drawCoin(c.x, c.y, c.kind.r, c.kind.c, c.kind.rim);
      }
      drawParts(S.parts);
      var G = S.G, list = [];
      list.push({y:G.y, f:function(){ var deck = drawBoard('t', G.x, G.y, 1); girlStand(G.x, G.y - deck, 1, 0, true); }});
      list.push({y:P.y, f:function(){
        var deck = drawBoard('r', P.x, P.y, P.face);
        me(P.x, P.y - deck, P.face, 0, 'ride');
        if (P.pumpFx > 0){ pen(PINK, 1.6); ctx.globalAlpha = P.pumpFx/12; ln(P.x - 24, P.y - 6, P.x - 36, P.y - 8); ln(P.x - 24, P.y - 2, P.x - 38, P.y - 1); ctx.globalAlpha = 1; }
      }});
      drawSorted(list);
      ctx.restore();

      var pounds = '£' + (S.pence/100).toFixed(2);
      ctx.font = 'bold ' + U(14) + 'px ' + UI_FONT;
      ctx.globalAlpha = 0.85; ctx.fillStyle = PAPER; ctx.fillRect(10, 12, ctx.measureText(pounds).width + 16, U(14) + 10); ctx.globalAlpha = 1;
      text(pounds, 18, 17 + U(14)/2, U(14), INK, {align:'left', bold:true});
      if (mode === 'play' && S.slow > 60*8) hint('the same as with Rambo before');
    }
  });

  // 8 — no need for doubt. The beach from level 1, nothing blurred, nothing
  // pushing you back. The doubts are there and come to nothing when you walk
  // through them. This time you sit down.
  LV.push({
    init: function(){
      beach();
      S.doubts = [[150,296],[226,250],[296,206],[356,262],[404,198],[268,320],[426,250]].map(function(d, i){ return {x:d[0], y:d[1], f:1, i:i}; });
      S.parts = []; S.hearts = 0;
    },
    update: function(D, live){
      if (P.mode !== 'sit'){
        walk(D); collide(P, 7, S.solids); bounds(P, 10, 60, W-10, SHORE - 4);
      }
      for (var i=0;i<S.doubts.length;i++){
        var d = S.doubts[i];
        if (d.f > 0 && dist(P.x, P.y - 16, d.x, d.y) < 28) d.gone = true;
        if (d.gone) d.f = Math.max(0, d.f - 0.035);
      }
      if (live && P.mode !== 'sit' && dist(P.x, P.y, S.seat.x, S.by - 2) < 12){
        P.mode = 'sit';
        complete();
      }
      if (S.done) S.hearts = Math.min(1, S.hearts + 1/80);
      stepParts(S.parts);
    },
    draw: function(){
      beachDraw(function(){ girlSit(S.gx, S.by - SEAT, S.by - 6, P.mode === 'sit' ? 1 : clamp((P.x - S.gx)/100, -1, 1)); }, 1);
      // doubts: grey scribbles that come undone as you pass
      for (var i=0;i<S.doubts.length;i++){
        var d = S.doubts[i];
        if (d.f <= 0) continue;
        ctx.globalAlpha = 0.55*d.f;
        pen('#9a9a9a', 1.4);
        ctx.beginPath();
        var r = 13*(0.6 + 0.4*d.f);
        for (var k=0;k<=40;k++){
          var a = k*0.62 + d.i, rr = r*(0.55 + 0.45*Math.abs(Math.sin(k*1.7 + d.i)));
          var x = d.x + Math.cos(a)*rr*1.3 + Math.sin(S.t*0.02 + k)*0.6, y = d.y + Math.sin(a)*rr;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (S.hearts > 0){
        ctx.globalAlpha = S.hearts;
        heart(S.bx + 2, S.by - SEAT - 46 - S.hearts*10, 1.3, PINK);
        ctx.globalAlpha = 1;
      }
    }
  });

  // ---- the poem, in its own bands above and below the play area ----
  // The first line is there from the start of a level, up top. The second
  // line arrives underneath once the level is done.
  function drawPoem(){
    var p = POEM[cur], px = U(17);
    pen('#e2ded2', 1); ln(0, TOP - 0.5, W, TOP - 0.5); ln(0, TOP + H + 0.5, W, TOP + H + 0.5);
    ctx.globalAlpha = l1A;
    text(p[0], W/2, TOP/2 + 1, px, INK, {italic:true, serif:true, max:W*0.86});
    ctx.globalAlpha = 1;
    var by = TOP + H + 25;
    if (l2A > 0){
      ctx.globalAlpha = l2A;
      text(p[1], W/2, by, px, INK, {italic:true, serif:true, max:W*0.92});
      ctx.globalAlpha = 1;
    } else if (mode === 'play' && hintMsg){
      text(hintMsg, W/2, by, U(13), '#888', {max:W*0.92});
    }
    if (mode === 'wait'){
      ctx.globalAlpha = 0.45 + 0.45*Math.abs(Math.sin(S.t*0.05));
      text(cur < N-1 ? '→ press a direction to go on' : 'the end · press a direction to start over', W/2, CH - 13, U(11), '#888');
      ctx.globalAlpha = 1;
    }
  }

  // ---- the frame of it all: load, tick, finish, move on ----
  function load(i){
    cur = i; mode = 'play'; clearT = 0; l1A = 0; l2A = 0;
    S = {t:0, pt:0, done:false};
    LV[i].init();
    syncPoem();
  }
  function complete(){
    if (mode !== 'play') return;
    mode = 'clear'; clearT = 0; S.done = true;
    var was = cleared;
    if (cleared < cur + 1){ cleared = cur + 1; save(); }
    syncPoem(was < N && cleared >= N);
  }
  function tick(){
    readInput();
    S.t++;
    l1A = Math.min(1, l1A + 1/40);
    var live = mode === 'play';
    if (live) S.pt++;
    LV[cur].update(live ? dir : ZERO, live);
    if (mode === 'clear'){
      clearT++;
      if (clearT > 40) l2A = Math.min(1, l2A + 1/50);
      if (clearT > 150) mode = 'wait';
    } else if (mode === 'wait' && fresh) load(cur < N-1 ? cur + 1 : 0);
  }

  var scale = 1;
  function size(){
    var cssW = cv.clientWidth || (cv.parentElement && cv.parentElement.clientWidth) || W;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW*dpr); cv.height = Math.round(cssW*dpr*CH/W);
    scale = cv.width / W;
    ui = Math.max(1, 0.92*W/cssW);
  }
  function draw(){
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, CH);
    // the play area, shifted under the top band and kept out of both bands
    ctx.save();
    ctx.translate(0, TOP);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    hintMsg = '';
    LV[cur].draw();
    text((cur + 1) + ' / ' + N, W - 14, 24, U(12), cur === 6 ? '#ddd' : '#aaa', {align:'right'});
    ctx.restore();
    drawPoem();
  }

  var last = 0, acc = 0, STEP = 1000/60;
  function loop(ts){
    try {
      ts = ts || 0;
      if (!last) last = ts;
      acc += Math.min(100, ts - last); last = ts;
      var n = 0;
      while (acc >= STEP && n < 4){ tick(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      draw();
    } catch(e){
      // the game died mid-run; don't hold the poem hostage to it
      revealAll();
      return;
    }
    requestAnimationFrame(loop);
  }

  for (var lb=0; lb<lvBtns.length; lb++) (function(i){
    lvBtns[i].addEventListener('click', function(){ if (i <= cleared && i < N) load(i); });
  })(lb);
  var skipEl = document.getElementById('ink-skip');
  if (skipEl) skipEl.addEventListener('click', function(){ revealAll(); });
  var resetEl = document.getElementById('ink-reset');
  if (resetEl) resetEl.addEventListener('click', function(){
    cleared = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch(e){}
    load(0);
  });
  window.addEventListener('resize', size);

  try {
    size();
    load(Math.min(cleared, N-1));
    requestAnimationFrame(loop);
  } catch(e){
    revealAll();
  }
})();
</script>
