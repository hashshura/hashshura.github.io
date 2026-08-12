---
layout: post
title: Stick Fight
comments: true
thumbnail: /assets/img/2026-08-12-stick-fight.png
teaser: "Ragdoll bertongkat di peta yang diacak tiap ronde. Semua mulai bertangan kosong; pedang dan pistol baru turun belakangan, dan dorongan pedang lebih berbahaya daripada damage-nya."
---

<style>
/* Mobile first: this is played with two thumbs on a phone, so the phone layout
   is the base and the desktop tweaks are the exception. The arena takes whatever
   height is left after the controls, and the controls never leave the screen. */
#sf-stage{position:relative;left:50%;transform:translateX(-50%);width:calc(100vw - 8px);max-width:1100px;margin:0 0 6px;}
@supports (height: 100dvh) {
  #sf-stage{width:min(calc(100vw - 8px), calc((100dvh - 300px) * 1.777), 1100px);}
}
@supports not (height: 100dvh) {
  #sf-stage{width:min(calc(100vw - 8px), calc((100vh - 300px) * 1.777), 1100px);}
}
#sf-wrap{position:relative;}
/* Weapon bar: one fixed-height line above the arena. It reports what you are
   holding and lets you throw it away. Fixed height because anything above the
   canvas that can wrap will shove the whole map down a line mid-fight. */
#sf-gear{display:flex;align-items:center;gap:8px;height:38px;margin:0 2px 5px;padding:0 9px;
  border:1.5px solid #ddd;border-radius:9px;background:#fbfbf7;font-size:13px;line-height:1;
  white-space:nowrap;overflow:hidden;}
#sf-gear[hidden]{display:none;}
#sf-gear-what{font-weight:bold;}
#sf-gear-dmg,#sf-gear-ammo{color:#777;font-size:12px;}
#sf-drop{margin-left:auto;font:inherit;font-size:12px;font-weight:bold;padding:7px 11px;
  border:1.5px solid #222;border-radius:8px;background:#fbfbf7;color:#222;cursor:pointer;flex:0 0 auto;}
#sf-drop:disabled{opacity:.35;cursor:not-allowed;border-color:#bbb;}

/* Scoreboard sits below everything, where wrapping to a second line moves
   nothing that matters. */
#sf-score{display:flex;flex-wrap:wrap;align-items:center;gap:5px 8px;margin:2px 2px 10px;font-size:13px;line-height:1;}
#sf-score[hidden]{display:none;}
#sf-score .who{display:flex;align-items:center;gap:5px;padding:5px 8px;border:1.5px solid #ddd;border-radius:8px;background:#fbfbf7;}
#sf-score .who.self{border-color:#222;font-weight:bold;}
#sf-score .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;}
#sf-score .k{font-weight:bold;font-variant-numeric:tabular-nums;}
#sf-score .goal{margin-left:auto;color:#999;font-size:11px;}
#sf-canvas{display:block;width:100%;height:auto;background:#fbfbf7;border:2px solid #222;border-radius:8px;cursor:crosshair;touch-action:none;user-select:none;-webkit-user-select:none;}
#sf-wrap.with-menu{min-height:min(74vh,470px);}

#sf-menu{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;background:rgba(251,251,247,.96);border:2px solid #222;border-radius:8px;font-family:inherit;overflow:auto;padding:14px 0;}
#sf-menu[hidden]{display:none;}   /* display:flex above outranks the browser's own */
#sf-menu h2{margin:0;font-size:clamp(19px,5.5vw,28px);}
#sf-menu p{margin:0;font-size:13px;color:#777;text-align:center;max-width:34em;padding:0 16px;}
#sf-menu .row{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;padding:0 12px;}
#sf-menu input{font:inherit;font-size:16px;padding:11px 13px;border:1.5px solid #ccc;border-radius:9px;background:#fff;min-width:140px;}
#sf-menu button{font:inherit;font-size:16px;font-weight:bold;padding:13px 20px;border:2px solid #222;border-radius:10px;background:#222;color:#fbfbf7;cursor:pointer;}
#sf-menu button.ghost{background:#fbfbf7;color:#222;}
#sf-menu button:disabled{opacity:.4;cursor:not-allowed;}
#sf-rooms{width:min(440px,94%);max-height:min(34vh,220px);overflow:auto;font-size:15px;}
#sf-rooms div{display:flex;justify-content:space-between;gap:8px;padding:12px 11px;border:1px dashed #ccc;border-radius:8px;margin-bottom:6px;cursor:pointer;}
#sf-rooms div:active{background:#eee;}
#sf-note{font-size:12px;color:#999;text-align:center;padding:0 12px;}
#sf-exit{position:absolute;top:7px;right:7px;z-index:5;font:inherit;font-size:12px;font-weight:bold;padding:8px 11px;border:1.5px solid #bbb;border-radius:8px;background:rgba(251,251,247,.92);color:#555;cursor:pointer;}
#sf-exit[hidden]{display:none;}

/* Controls: thumbs at the outer edges, but inset far enough that the analog is
   not jammed against the side of the screen. */
#sf-controls{display:none;justify-content:space-between;align-items:center;gap:10px;
  padding:0 8px 0 4px;margin:8px 0 16px;touch-action:none;user-select:none;-webkit-user-select:none;}
#sf-controls.on{display:flex;}
#sf-pad{display:grid;grid-template-columns:repeat(3,66px);grid-template-rows:repeat(3,56px);gap:5px;touch-action:none;}
#sf-pad .sf-btn{pointer-events:none;}   /* the pad surface owns the gesture */
#sf-pad .up{grid-area:1/2/2/3;}
#sf-pad .lf{grid-area:2/1/3/2;}
#sf-pad .rt{grid-area:2/3/3/4;}
#sf-pad .dn{grid-area:3/2/4/3;}
.sf-btn{font:inherit;font-weight:bold;font-size:21px;line-height:1;border:2px solid #222;border-radius:13px;background:#fbfbf7;color:#222;cursor:pointer;touch-action:none;display:flex;align-items:center;justify-content:center;padding:0;}
.sf-btn.down{background:#222;color:#fbfbf7;}
#sf-aimwrap{display:flex;flex-direction:column;align-items:center;gap:6px;padding-right:6px;}
#sf-special{font:inherit;font-size:13px;font-weight:bold;letter-spacing:.03em;width:132px;height:42px;
  border:2px solid #222;border-radius:11px;background:#fbfbf7;color:#222;cursor:pointer;touch-action:none;}
#sf-special:disabled{opacity:.32;cursor:not-allowed;border-color:#bbb;}
#sf-special.down{background:#222;color:#fbfbf7;}
#sf-aimpad{width:132px;height:132px;border:2px solid #222;border-radius:50%;background:#fbfbf7;touch-action:none;cursor:grab;}
#sf-aimpad.down{background:#f1f1e9;cursor:grabbing;}

#sf-help{font-size:12px;color:#777;margin:0 0 18px;line-height:1.6;}
#sf-help b{color:#222;}

/* Narrow phones: shrink a little rather than overflowing */
@media (max-width:400px){
  #sf-pad{grid-template-columns:repeat(3,58px);grid-template-rows:repeat(3,50px);}
  #sf-aimpad{width:116px;height:116px;}
  #sf-special{width:116px;height:38px;font-size:12px;}
  .sf-btn{font-size:19px;border-radius:11px;}
}
/* Desktop: keyboard is the real control, so the pads step back */
@media (min-width:760px){
  #sf-pad{grid-template-columns:repeat(3,56px);grid-template-rows:repeat(3,48px);}
  #sf-aimpad{width:112px;height:112px;}
  #sf-special{width:112px;}
  #sf-controls{opacity:.85;}
}
</style>

<div id="sf-stage">
<div id="sf-gear" hidden>
  <span id="sf-gear-what">✊ TANGAN</span>
  <span id="sf-gear-dmg"></span>
  <span id="sf-gear-ammo"></span>
  <button type="button" id="sf-drop" disabled>buang</button>
</div>
<div id="sf-wrap" class="with-menu">
  <canvas id="sf-canvas" width="960" height="540"></canvas>
  <button id="sf-exit" hidden title="kembali ke menu (Esc)">✕ menu</button>
  <div id="sf-menu">
    <h2>🥢 STICK FIGHT</h2>
    <p id="sf-tagline">Ragdoll bertongkat. Pedang mendorong keras, pistol menjangkau jauh, dan jurangnya tidak memaafkan.</p>
    <div class="row">
      <input id="sf-name" maxlength="12" placeholder="namamu" />
      <button id="sf-solo">Main lawan bot</button>
    </div>
    <div class="row">
      <button id="sf-create" class="ghost">Buat room</button>
      <button id="sf-join" class="ghost">Gabung room</button>
    </div>
    <p id="sf-note"></p>
    <div id="sf-rooms" hidden></div>
  </div>
</div>

<div id="sf-score" hidden></div>

<div id="sf-controls">
  <div id="sf-pad">
    <button class="sf-btn up" data-k="jump">▲</button>
    <button class="sf-btn lf" data-k="l">◀</button>
    <button class="sf-btn rt" data-k="r">▶</button>
    <button class="sf-btn dn" data-k="duck">▼</button>
  </div>
  <div id="sf-aimwrap">
    <canvas id="sf-aimpad" width="256" height="256" title="arahkan lalu lepas untuk menyerang"></canvas>
    <button type="button" id="sf-special" disabled>✷ <span>SPESIAL</span></button>
  </div>
</div>
</div>

<p id="sf-help">
  <b>Keyboard:</b> A/D jalan, W lompat, S merunduk. Panah (atau gerakkan mouse) untuk mengarahkan senjata, <b>spasi</b> atau klik untuk menyerang.<br>
  <b>HP:</b> di layar sentuh, tombol arah di kiri; lingkaran di kanan untuk mengarahkan senjata — <b>lepas jarimu untuk menyerang</b>.<br>
  <b>Spesial (tombol ✷ atau E):</b> pedang berputar 360° dan melempar semua yang kena; pistol memberondong kiri-kanan sampai habis. Dua-duanya menghabiskan senjatanya.<br>
  <b>Senjata:</b> tombol <b>buang</b> (atau Q) melepas senjatamu. Semua mulai bertangan kosong (7 damage). Pedang (22 + dorongan keras) dan pistol (14, 8 butir) muncul sendiri di peta tiap beberapa detik — ambil dengan menabraknya.<br>
  <b>Jatuh ke jurang tetap mati</b> — dorongan pedang lebih berbahaya daripada damage-nya. Petanya diacak tiap ronde.
</p>

<script src="/assets/js/stickfight-sim.js"></script>
<script src="/assets/js/stickfight-wire.js"></script>
<script>
(function () {
  var S = window.StickSim;
  var cv = document.getElementById('sf-canvas');
  var menu = document.getElementById('sf-menu');
  var note = document.getElementById('sf-note');
  var roomsEl = document.getElementById('sf-rooms');
  var nameEl = document.getElementById('sf-name');
  var wrap = document.getElementById('sf-wrap');
  var controls = document.getElementById('sf-controls');
  var ap = document.getElementById('sf-aimpad');
  if (!S || !cv || !cv.getContext) { if (menu) menu.innerHTML = '<p>Perangkat ini tidak bisa menjalankan gamenya.</p>'; return; }
  var ctx = cv.getContext('2d');
  if (!ctx) { menu.innerHTML = '<p>Canvas tidak tersedia.</p>'; return; }

  // The room server: a Worker with one Durable Object per room code.
  // See server/ in the repo. Set sf_server in localStorage to point at a local
  // `wrangler dev` instead, without editing the post.
  var NET_URL = 'https://stickfight.hashshura.workers.dev';
  try { NET_URL = localStorage.getItem('sf_server') || NET_URL; } catch (e) {}

  var INK = '#222', PAPER = '#fbfbf7';
  var TEAM = ['#222', '#c0392b', '#2e7d32', '#3b7ea1', '#e0a800', '#7d3c98'];
  var KILLS_TO_WIN = 10;   // the room may override this on join

  var world = null, me = null, mode = 'menu', bots = [], winner = null;
  var scale = 1, camY = 0;

  try { nameEl.value = localStorage.getItem('sf_name') || ''; } catch (e) {}

  function sizeCanvas() {
    var wCss = cv.clientWidth || 960;
    cv.width = Math.round(Math.min(1200, Math.max(280, wCss)));
    cv.height = Math.round(cv.width * S.H / S.W);
    scale = cv.width / S.W;
  }

  // ---- input ---------------------------------------------------------------
  var keys = {};
  var mouse = { cx: 0, cy: 0, has: false };
  var pad = { l: 0, r: 0, jump: 0, duck: 0, aim: null, fire: 0, discard: 0, special: 0 };  // touch
  var touches = {};

  window.addEventListener('keydown', function (e) {
    if (mode === 'menu') return;
    var k = e.key.toLowerCase();
    if (['a','d','w','s','q','e',' ','arrowleft','arrowright','arrowup','arrowdown'].indexOf(k) >= 0) e.preventDefault();
    keys[k] = 1;
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = 0; });

  cv.addEventListener('mousemove', function (e) {
    var r = cv.getBoundingClientRect();
    mouse.cx = (e.clientX - r.left) / r.width * cv.width;
    mouse.cy = (e.clientY - r.top) / r.height * cv.height;
    mouse.has = true;
  });
  cv.addEventListener('mousedown', function (e) { e.preventDefault(); keys[' '] = 1; });
  window.addEventListener('mouseup', function () { keys[' '] = 0; });

  // Controls are real buttons under the arena rather than zones drawn inside it.
  // Drawn-on-canvas pads were tiny on a phone and sat on top of the fight.
  var apCtx = ap && ap.getContext ? ap.getContext('2d') : null;
  var padDrag = null;

  // The d-pad is one continuous surface, not four separate buttons. Your thumb
  // lands on ◀ and slides up to ▲ and the direction follows it, corners give you
  // both at once. As four independent buttons, sliding off one left you pressing
  // nothing at all, which is what made the movement feel dead.
  var padEl = document.getElementById('sf-pad');
  var padBtns = {};
  if (padEl && padEl.querySelectorAll) {
    var all = padEl.querySelectorAll('.sf-btn');
    for (var bi = 0; bi < all.length; bi++) {
      padBtns[all[bi].getAttribute('data-k')] = all[bi];
    }
    var mark = function () {
      for (var k in padBtns) {
        if (pad[k]) padBtns[k].classList.add('down');
        else padBtns[k].classList.remove('down');
      }
    };
    var setDir = function (e) {
      var r = padEl.getBoundingClientRect();
      var dx = (e.clientX - r.left) - r.width / 2;
      var dy = (e.clientY - r.top) - r.height / 2;
      // The pad captures the pointer, so a thumb that slides off it keeps
      // steering — drift a little above the pad while your other hand attacks and
      // "up" stays held, which reads as the stickman jumping on its own. Let go
      // once the finger has clearly left the pad.
      if (Math.abs(dx) > r.width * 0.85 || Math.abs(dy) > r.height * 0.85) {
        clearDir();
        return;
      }
      var dead = Math.min(r.width, r.height) * 0.15;
      pad.l = dx < -dead ? 1 : 0;
      pad.r = dx > dead ? 1 : 0;
      pad.jump = dy < -dead ? 1 : 0;
      pad.duck = dy > dead ? 1 : 0;
      mark();
    };
    var clearDir;   // hoisted: setDir bails out through it
    clearDir = function () { pad.l = pad.r = pad.jump = pad.duck = 0; mark(); };
    padEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (padEl.setPointerCapture && e.pointerId != null) {
        try { padEl.setPointerCapture(e.pointerId); } catch (err) {}
      }
      setDir(e);
    });
    padEl.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' && !e.buttons) return;   // only while held down
      if (e.cancelable) e.preventDefault();                  // never scroll the page
      setDir(e);
    });
    padEl.addEventListener('pointerup', clearDir);
    padEl.addEventListener('pointercancel', clearDir);
    padEl.addEventListener('lostpointercapture', clearDir);
  }

  // The aim pad: drag to point the weapon, and lifting your finger attacks in
  // whatever direction you left it pointing. A plain tap attacks along the
  // current aim. One thumb, one gesture, no separate fire button to reach for.
  function aimFrom(e) {
    var r = ap.getBoundingClientRect();
    var dx = (e.clientX - r.left) - r.width / 2;
    var dy = (e.clientY - r.top) - r.height / 2;
    if (dx * dx + dy * dy > 100) {
      pad.aim = Math.atan2(dy, dx);
      if (padDrag) padDrag.moved = 1;
    }
  }
  if (ap) {
    ap.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      padDrag = { moved: 0, t0: Date.now() };
      ap.classList.add('down');
      if (ap.setPointerCapture && e.pointerId != null) {
        try { ap.setPointerCapture(e.pointerId); } catch (err) {}
      }
      aimFrom(e);
    });
    ap.addEventListener('pointermove', function (e) {
      if (!padDrag) return;
      if (e.cancelable) e.preventDefault();
      aimFrom(e);
    });
    var endPad = function () {
      if (padDrag) pad.fire = 4;        // release = attack, tap or drag alike
      padDrag = null;
      ap.classList.remove('down');
    };
    ap.addEventListener('pointerup', endPad);
    ap.addEventListener('pointercancel', endPad);
  }

  // The whole arena is always on screen, at the same framing for everybody. A
  // phone that zoomed in to make the fighters readable would also see less of the
  // map than a laptop — that is a competitive disadvantage, not a comfort. The
  // arena is portrait and small instead, so the figures are big without hiding
  // anything.
  var cam = { x: S.W / 2, y: S.H / 2, z: 1 };
  function updateCamera() { cam.z = 1; cam.x = S.W / 2; cam.y = S.H / 2; }
  function screenToWorld(cx, cy) {
    var eff = scale * cam.z;
    return { x: (cx - cv.width / 2) / eff + cam.x, y: (cy - cv.height / 2) / eff + cam.y };
  }

  function gatherInput(p) {
    var i = p.input;
    i.l = (keys['a'] || pad.l) ? 1 : 0;
    i.r = (keys['d'] || pad.r) ? 1 : 0;
    i.jump = keys['w'] || pad.jump ? 1 : 0;
    i.duck = keys['s'] || pad.duck ? 1 : 0;

    // aim: arrow keys act like a stick, else the mouse, else the touch ring
    var ax = (keys['arrowright'] ? 1 : 0) - (keys['arrowleft'] ? 1 : 0);
    var ay = (keys['arrowdown'] ? 1 : 0) - (keys['arrowup'] ? 1 : 0);
    if (ax || ay) i.aim = Math.atan2(ay, ax);
    else if (pad.aim !== null) i.aim = pad.aim;
    else if (mouse.has) {
      var c = p.pts[S.CHEST];
      var m = screenToWorld(mouse.cx, mouse.cy);
      i.aim = Math.atan2(m.y - c.y, m.x - c.x);
    }
    i.fire = (keys[' '] || pad.fire > 0) ? 1 : 0;
    if (pad.fire > 0) pad.fire--;
    i.discard = (keys['q'] || pad.discard > 0) ? 1 : 0;
    if (pad.discard > 0) pad.discard--;
    i.special = (keys['e'] || pad.special > 0) ? 1 : 0;
    if (pad.special > 0) pad.special--;
    // latch it: the sender samples every 50ms and a tap can be shorter than that
    if (i.fire && typeof pendingFire !== 'undefined') pendingFire = true;
  }

  // ---- bots ----------------------------------------------------------------
  // Enough to be a nuisance: chase, keep roughly the right distance for whatever
  // they are holding, grab crates when unarmed, and aim with a wobble so they
  // miss like a person does.
  function botThink(w, b, tick) {
    var i = b.input, hips = b.pts[S.HIPS], chest = b.pts[S.CHEST];
    i.l = i.r = i.jump = i.duck = i.fire = 0;
    if (b.dead) return;

    // nearest living enemy
    var foe = null, best = 1e9;
    for (var id in w.players) {
      var q = w.players[id];
      if (q === b || q.dead) continue;
      var d = Math.abs(q.pts[S.HIPS].x - hips.x) + Math.abs(q.pts[S.HIPS].y - hips.y) * 1.3;
      if (d < best) { best = d; foe = q; }
    }

    // Unarmed bots go shopping. Crates are worth crossing the map for: a fist
    // does 7 damage and a sword does 22 with a shove.
    var goal = null, goalIsCrate = false;
    if (b.weapon === 'fist' && w.pickups.length) {
      var crate = null, cb = 1e9;
      for (var k = 0; k < w.pickups.length; k++) {
        var pk = w.pickups[k];
        var dd = Math.abs(pk.x - hips.x) + Math.abs(pk.y - hips.y) * 1.3;
        if (dd < cb) { cb = dd; crate = pk; }
      }
      if (crate) { goal = { x: crate.x, y: crate.y }; goalIsCrate = true; }
    }
    if (!goal && foe) goal = { x: foe.pts[S.CHEST].x, y: foe.pts[S.CHEST].y };
    if (!goal) {                      // nothing to do: patrol a random ledge
      var pl = w.platforms[(b.color + Math.floor(tick / 240)) % w.platforms.length];
      goal = { x: pl.x + pl.w / 2, y: pl.y - 20 };
    }

    // Keep the distance the weapon wants, but never just stand there: the old
    // deadband was wider than the approach step, so bots idled in place.
    var want = goalIsCrate ? 0 : (b.weapon === 'gun' ? 190 : 26);
    var dx = goal.x - hips.x;
    var adx = Math.abs(dx);
    if (adx > want + 14) { if (dx > 0) i.r = 1; else i.l = 1; }
    else if (adx < want - 14) { if (dx > 0) i.l = 1; else i.r = 1; }
    else if ((tick + b.color * 40) % 150 < 40) { i[dx > 0 ? 'l' : 'r'] = 1; }  // circle a bit

    // Climb toward anything above, and hop over anything in the way.
    var dy = goal.y - hips.y;
    if (dy < -40 && b.grounded && (tick + b.color * 17) % 26 < 10) i.jump = 1;
    b._px = b._px === undefined ? hips.x : b._px;
    b._stuck = (Math.abs(hips.x - b._px) < 0.6 && (i.l || i.r)) ? (b._stuck || 0) + 1 : 0;
    b._px = hips.x;
    if (b._stuck > 20) { i.jump = 1; b._stuck = 0; }        // shove yourself loose
    if (b.grounded && hips.y > S.H - 90 && dy < -20) i.jump = 1;   // climb off the floor

    // duck now and then when someone is shooting from roughly your height
    if (foe && foe.weapon === 'gun' && Math.abs(foe.pts[S.CHEST].y - chest.y) < 30 &&
        (tick + b.color * 31) % 120 < 22) i.duck = 1;

    if (!foe) return;
    var fx = foe.pts[S.CHEST].x - chest.x, fy = foe.pts[S.CHEST].y - chest.y;
    i.aim = Math.atan2(fy, fx) + Math.sin(tick * 0.05 + b.color) * 0.18;   // hand wobble
    var dist = Math.sqrt(fx * fx + fy * fy);
    var reach = b.weapon === 'gun' ? 620 : S.WEAPONS[b.weapon].reach + 14;
    if (dist < reach && b.cd === 0) i.fire = 1;
  }

  // ---- drawing -------------------------------------------------------------
  // in online mode a point is drawn between the last two snapshots
  var lerpA = 1;
  function px(q) { return lerpA >= 1 ? q.x : q.ox + (q.x - q.ox) * lerpA; }
  function py(q) { return lerpA >= 1 ? q.y : q.oy + (q.y - q.oy) * lerpA; }

  function ink(w, c) { ctx.strokeStyle = c || INK; ctx.lineWidth = w || 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function txt(s, x, y, size, color, bold, align) {
    ctx.save();
    ctx.textAlign = align || 'center';
    ctx.fillStyle = color || INK;
    ctx.font = (bold ? 'bold ' : '') + Math.round(size || 13) + 'px sans-serif';
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  function drawArena(w) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(-40, -40, S.W + 80, S.H + 120);
    // the void: hatching below the lowest deck, so the danger reads
    ctx.save();
    ctx.globalAlpha = 0.16;
    ink(1.6);
    for (var x = -60; x < S.W + 60; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, S.H); ctx.lineTo(x + 52, S.H - 58);
      ctx.stroke();
    }
    ctx.restore();
    for (var i = 0; i < w.platforms.length; i++) {
      var pl = w.platforms[i];
      ink(2.6);
      ctx.beginPath();
      ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + pl.w, pl.y);
      ctx.stroke();
      ink(1.6);
      for (var d = 0; d < pl.w; d += 16) {
        ctx.beginPath();
        ctx.moveTo(pl.x + d, pl.y + 2); ctx.lineTo(pl.x + d + 9, pl.y + pl.h);
        ctx.stroke();
      }
    }
  }

  function drawCrate(pk) {
    ink(2);
    ctx.save();
    ctx.translate(pk.x, pk.y - 14);
    if (pk.kind === 'sword') {
      ctx.beginPath(); ctx.moveTo(-9, 9); ctx.lineTo(9, -9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(10, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(4, 12); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(9, -3); ctx.lineTo(9, 3); ctx.lineTo(-2, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(-4, 10); ctx.stroke();
    }
    ctx.restore();
    ink(1.4, '#aaa');
    ctx.beginPath(); ctx.arc(pk.x, pk.y - 14, 19, 0, 7); ctx.stroke();
  }

  function drawWeapon(p) {
    var chest = { x: px(p.pts[S.CHEST]), y: py(p.pts[S.CHEST]) };
    var hand = { x: px(p.pts[S.HANDR]), y: py(p.pts[S.HANDR]) };
    var a = Math.atan2(hand.y - chest.y, hand.x - chest.x);
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(a);
    ink(2.4, TEAM[p.color % TEAM.length]);
    if (p.weapon === 'sword') {
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(30, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    } else if (p.weapon === 'gun') {
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(16, -2); ctx.lineTo(16, 2); ctx.lineTo(4, 2); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(p) {
    var col = TEAM[p.color % TEAM.length];
    var pts = p.pts;
    // a corpse thrown into the void keeps tumbling; stop drawing it once it is
    // past the hatching rather than smearing it down off the canvas
    if (py(pts[S.HIPS]) > S.H + 24) return;
    ctx.save();
    if (p.dead) ctx.globalAlpha = 0.35;
    ink(p.id === (me && me.id) ? 3 : 2.4, col);
    for (var i = 0; i < S.BONES.length; i++) {
      var b = S.BONES[i];
      ctx.beginPath();
      ctx.moveTo(px(pts[b[0]]), py(pts[b[0]]));
      ctx.lineTo(px(pts[b[1]]), py(pts[b[1]]));
      ctx.stroke();
    }
    var h = { x: px(pts[S.HEAD]), y: py(pts[S.HEAD]) };
    ctx.beginPath(); ctx.arc(h.x, h.y, 8, 0, 7); ctx.stroke();
    if (p.dead) {            // X eyes, the universal signal
      ink(1.6, col);
      ctx.beginPath();
      ctx.moveTo(h.x - 5, h.y - 3); ctx.lineTo(h.x - 1, h.y + 1);
      ctx.moveTo(h.x - 1, h.y - 3); ctx.lineTo(h.x - 5, h.y + 1);
      ctx.moveTo(h.x + 1, h.y - 3); ctx.lineTo(h.x + 5, h.y + 1);
      ctx.moveTo(h.x + 5, h.y - 3); ctx.lineTo(h.x + 1, h.y + 1);
      ctx.stroke();
    }
    ctx.restore();
    if (p.dead) return;
    drawWeapon(p);

    // health bar and name above the head
    var bx = h.x - 17, by = h.y - 22;
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx, by, 34, 4);
    ctx.fillStyle = p.hp > 50 ? '#2e7d32' : (p.hp > 22 ? '#e0a800' : '#c0392b');
    ctx.fillRect(bx, by, 34 * Math.max(0, p.hp) / S.MAX_HP, 4);
    ink(1, '#999'); ctx.strokeRect(bx, by, 34, 4);
    txt(p.name, h.x, by - 5, 10, '#666', p.id === (me && me.id));
  }

  function drawFx(w) {
    for (var i = 0; i < w.fx.length; i++) {
      var f = w.fx[i];
      if (f.k === 'slash') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t / 9);
        ink(f.big ? 3.4 : 2, f.big ? '#222' : '#888');
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, f.a - f.arc / 2, f.a + f.arc / 2);
        ctx.stroke();
        ctx.restore();
      } else if (f.k === 'spin') {
        // a full ring, opening outward, with a couple of trailing sweep lines
        ctx.save();
        // clamped: ctx.arc throws on a negative radius, and the effect's timer is
        // set by the simulation, which may outlive the number assumed here
        var g = Math.max(0, Math.min(1, 1 - f.t / 26));
        ctx.globalAlpha = Math.max(0, Math.min(1, f.t / 26)) * 0.9;
        ink(3.2, '#222');
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2, f.r * (0.45 + g * 0.75)), 0, Math.PI * 2);
        ctx.stroke();
        ink(2, '#888');
        for (var sp = 0; sp < 3; sp++) {
          var sa = f.a + g * Math.PI * 3 - sp * 0.5;
          ctx.beginPath();
          ctx.arc(f.x, f.y, Math.max(2, f.r * 0.95), sa, sa + 0.45);
          ctx.stroke();
        }
        ctx.restore();
      } else if (f.k === 'jab') {
        // a punch has no slice path: just a short impact burst at the knuckles
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t / 8);
        ink(2.2, '#555');
        for (var j = 0; j < 3; j++) {
          var ja = f.a + (j - 1) * 0.5;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(ja) * 3, f.y + Math.sin(ja) * 3);
          ctx.lineTo(f.x + Math.cos(ja) * 9, f.y + Math.sin(ja) * 9);
          ctx.stroke();
        }
        ctx.restore();
      } else if (f.k === 'hit' || f.k === 'die') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t / (f.k === 'die' ? 26 : 14));
        ink(2, '#c0392b');
        var n = f.k === 'die' ? 8 : 5, rad = f.k === 'die' ? 22 : 12;
        for (var s = 0; s < n; s++) {
          var a = s / n * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4);
          ctx.lineTo(f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad);
          ctx.stroke();
        }
        ctx.restore();
      } else if (f.k === 'pick') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.t / 16);
        ink(2, '#2e7d32');
        ctx.beginPath(); ctx.arc(f.x, f.y - 14, 22 - f.t, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }
    for (var b = 0; b < w.bullets.length; b++) {
      var bl = w.bullets[b];
      ink(2.2, '#222');
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(bl.x - bl.vx * 0.7, bl.y - bl.vy * 0.7);
      ctx.stroke();
    }
  }

  // Drawn in canvas pixels, not arena units. Scaling it with the arena meant a
  // 390px phone rendered 11px text at about 4px — the scoreboard was unreadable
  // exactly where the screen was smallest.
  // Only things that must sit over the arena are drawn on it now: the respawn
  // countdown and the win banner. The running score is DOM, above the canvas.
  function drawHud(w) {
    var cw = cv.width, ch = cv.height;
    var u = Math.max(13, Math.min(20, cw / 28));
    if (me && me.dead) {
      txt('mati — hidup lagi dalam ' + Math.ceil(me.respawn / 60) + 's',
          cw / 2, ch * 0.13, u * 1.4, '#c0392b', true);
    }
    if (winner) {
      ctx.save();
      ctx.fillStyle = 'rgba(251,251,247,.88)';
      ctx.fillRect(0, ch / 2 - u * 3.4, cw, u * 6.8);
      txt(winner + ' menang', cw / 2, ch / 2 + u * 0.2, u * 2.4, INK, true);
      txt('klik untuk main lagi', cw / 2, ch / 2 + u * 2.4, u, '#666');
      ctx.restore();
    }
  }

  // Weapon bar. Damage and knockback come from the sim's own table, so the
  // numbers on screen cannot drift from the ones doing the hitting.
  var gearEl = document.getElementById('sf-gear');
  var gearWhat = document.getElementById('sf-gear-what');
  var gearDmg = document.getElementById('sf-gear-dmg');
  var gearAmmo = document.getElementById('sf-gear-ammo');
  var dropBtn = document.getElementById('sf-drop');
  var gearLast = '';
  var GEAR_NAME = { fist: '✊ TANGAN', sword: '⚔ PEDANG', gun: '🔫 PISTOL' };
  var GEAR_PUSH = { fist: 'dorongan kecil', sword: 'dorongan kuat', gun: 'dorongan kecil' };
  function drawGear() {
    if (!gearEl || !me) return;
    var wp = S.WEAPONS[me.weapon];
    var sig = me.weapon + ':' + me.ammo;
    if (sig === gearLast) return;
    gearLast = sig;
    gearWhat.textContent = GEAR_NAME[me.weapon] || me.weapon;
    gearDmg.textContent = wp.dmg + ' dmg · ' + GEAR_PUSH[me.weapon] +
      ' · jeda ' + (wp.cd / 60).toFixed(2) + 's';
    gearAmmo.textContent = wp.ammo ? '· ' + me.ammo + ' butir' : '';
    dropBtn.disabled = me.weapon === 'fist';
    if (specialBtn) {
      // the special spends the weapon, so it is only offered while you hold one
      specialBtn.disabled = me.weapon === 'fist';
      var label = SPECIAL_NAME[me.weapon] || '✷ SPESIAL';
      if (me.weapon === 'gun') label += ' ×' + me.ammo;   // it sprays what is left
      if (specialBtn.textContent !== label) specialBtn.textContent = label;
    }
  }
  if (dropBtn) {
    dropBtn.addEventListener('click', function () {
      pad.discard = 3;         // a few frames, so one press is one throw
    });
  }
  var specialBtn = document.getElementById('sf-special');
  var SPECIAL_NAME = { sword: '✷ PUTAR', gun: '✷ BERONDONG', fist: '✷ SPESIAL' };
  if (specialBtn) {
    specialBtn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (specialBtn.disabled) return;
      pad.special = 3;
      specialBtn.classList.add('down');
    });
    var offSpecial = function () { specialBtn.classList.remove('down'); };
    specialBtn.addEventListener('pointerup', offSpecial);
    specialBtn.addEventListener('pointercancel', offSpecial);
  }

  // The score strip. Rebuilt only when the line-up changes and retouched only
  // when a number changes, so it is not doing DOM work sixty times a second.
  var scoreEl = document.getElementById('sf-score');
  var scoreRows = {}, scoreKey = '', scoreAt = 0;
  function drawScore(w) {
    if (!scoreEl) return;
    var now = Date.now();
    if (now - scoreAt < 120) return;
    scoreAt = now;
    var ids = Object.keys(w.players);
    ids.sort(function (a, b) { return w.players[b].kills - w.players[a].kills ||
                                      (a < b ? -1 : 1); });
    var key = ids.map(function (id) { return id + ':' + w.players[id].name; }).join('|');
    if (key !== scoreKey) {
      scoreKey = key;
      scoreEl.innerHTML = '';
      scoreRows = {};
      for (var i = 0; i < ids.length; i++) {
        var p = w.players[ids[i]];
        var row = document.createElement('span');
        row.className = 'who' + (p.id === (me && me.id) ? ' self' : '');
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = TEAM[p.color % TEAM.length];
        var nm = document.createElement('span');
        nm.textContent = p.name;
        var kills = document.createElement('span');
        kills.className = 'k';
        row.appendChild(dot); row.appendChild(nm); row.appendChild(kills);
        scoreEl.appendChild(row);
        scoreRows[p.id] = { kills: kills, last: -1 };
      }
      var goal = document.createElement('span');
      goal.className = 'goal';
      goal.textContent = 'sampai ' + KILLS_TO_WIN + ' kill' +
        (mode === 'online' ? (myPing ? ' · ' + myPing + 'ms' : ' · online') : '');
      scoreEl.appendChild(goal);
    }
    for (var k = 0; k < ids.length; k++) {
      var q = w.players[ids[k]], cell = scoreRows[q.id];
      if (!cell) continue;
      var val = q.kills + (q.dead ? ' ☠' : '');
      if (val !== cell.last) { cell.kills.textContent = val; cell.last = val; }
    }
  }

  // The aim pad doubles as the cooldown readout: the ring fills as the weapon
  // comes back, so "can I swing yet" is answered where your thumb already is.
  function drawAimPad() {
    if (!apCtx) return;
    var W2 = ap.width, C = W2 / 2, R = W2 * 0.40;
    apCtx.clearRect(0, 0, W2, W2);
    var wp = me ? S.WEAPONS[me.weapon] : null;
    var frac = (me && wp && wp.cd) ? Math.min(1, 1 - me.cd / wp.cd) : 1;
    apCtx.lineWidth = W2 * 0.055;
    apCtx.lineCap = 'butt';
    apCtx.strokeStyle = '#e6e6df';
    apCtx.beginPath(); apCtx.arc(C, C, R, 0, Math.PI * 2); apCtx.stroke();
    apCtx.strokeStyle = frac >= 1 ? '#2e7d32' : '#c0392b';
    apCtx.beginPath();
    apCtx.arc(C, C, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    apCtx.stroke();

    var a = me ? me.aim : (pad.aim || 0);
    apCtx.strokeStyle = '#222';
    apCtx.lineWidth = W2 * 0.045;
    apCtx.lineCap = 'round';
    apCtx.beginPath();
    apCtx.moveTo(C, C);
    apCtx.lineTo(C + Math.cos(a) * R * 0.72, C + Math.sin(a) * R * 0.72);
    apCtx.stroke();
    apCtx.beginPath();
    apCtx.arc(C + Math.cos(a) * R * 0.72, C + Math.sin(a) * R * 0.72, W2 * 0.05, 0, 7);
    apCtx.fillStyle = '#222'; apCtx.fill();

    var label = !me ? '' : (me.weapon === 'gun' ? 'PISTOL ' + me.ammo
      : (me.weapon === 'sword' ? 'PEDANG' : 'TANGAN'));
    apCtx.fillStyle = '#555';
    apCtx.textAlign = 'center';
    apCtx.font = 'bold ' + Math.round(W2 * 0.075) + 'px sans-serif';
    apCtx.fillText(label, C, W2 * 0.87);      // inside the circle, not clipped by it
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    // world, seen through the camera
    var eff = scale * cam.z;
    ctx.setTransform(eff, 0, 0, eff, cv.width / 2 - cam.x * eff, cv.height / 2 - cam.y * eff);
    drawArena(world);
    for (var i = 0; i < world.pickups.length; i++) drawCrate(world.pickups[i]);
    for (var id in world.players) drawPlayer(world.players[id]);
    drawFx(world);
    // hud, in canvas pixels so it stays legible on a small screen
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawHud(world);
    drawAimPad();
    drawScore(world);
    drawGear();
  }

  // ---- game loop -----------------------------------------------------------
  var acc = 0, last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!world) return;
    if (!last) last = now;
    var dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    var steps = 0;
    while (acc >= S.DT && steps < 6) {
      acc -= S.DT; steps++;
      if (mode === 'solo') {
        if (me && !winner) gatherInput(me);
        for (var b = 0; b < bots.length; b++) botThink(world, bots[b], world.t);
        S.step(world);
        checkWin();
      }
    }
    if (mode === 'online' && me) gatherInput(me);   // read controls, server decides
    updateCamera();
    // Snapshots land at 20Hz, so draw part-way between the last two rather than
    // stepping 50ms at a time. decodeSnapshot leaves the previous position in
    // ox/oy, which is exactly the "from" this needs.
    lerpA = mode === 'online'
      ? Math.max(0, Math.min(1, ((now - snapAt) || 0) / 50))
      : 1;
    try { render(); } catch (e) { /* never let a draw glitch kill the loop */ }
  }

  function checkWin() {
    if (winner) return;
    for (var id in world.players) {
      if (world.players[id].kills >= KILLS_TO_WIN) { winner = world.players[id].name; return; }
    }
  }

  function startSolo() {
    var name = (nameEl.value || 'kamu').slice(0, 12);
    try { localStorage.setItem('sf_name', name); } catch (e) {}
    world = S.createWorld(Date.now() % 100000);   // new arena every match
    me = S.addPlayer(world, 'me', name, 0);
    bots = [];
    var botNames = ['botak', 'bonar', 'bombom'];
    for (var i = 0; i < 3; i++) bots.push(S.addPlayer(world, 'b' + i, botNames[i], i + 1));
    winner = null;
    mode = 'solo';
    showGame();
    last = 0; acc = 0;
  }

  var exitBtn = document.getElementById('sf-exit');
  function showGame() {
    menu.hidden = true;
    wrap.classList.remove('with-menu');
    controls.classList.add('on');
    if (exitBtn) exitBtn.hidden = false;
    if (scoreEl) { scoreEl.hidden = false; scoreKey = ''; }
    if (gearEl) { gearEl.hidden = false; gearLast = ''; }
  }
  function showMenu() {
    menu.hidden = false;
    wrap.classList.add('with-menu');
    controls.classList.remove('on');
    if (exitBtn) exitBtn.hidden = true;
    if (scoreEl) scoreEl.hidden = true;
    if (gearEl) gearEl.hidden = true;
  }
  function leaveMatch() {
    if (mode === 'menu') return;
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    mode = 'menu';
    me = null; bots = []; winner = null;
    pad.l = pad.r = pad.jump = pad.duck = 0;
    showMenu();
    note.textContent = '';
  }
  if (exitBtn) exitBtn.addEventListener('click', leaveMatch);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') leaveMatch();
  });

  document.getElementById('sf-solo').addEventListener('click', startSolo);

  cv.addEventListener('click', function () {
    if (winner) startSolo();
  });

  // ---- multiplayer ---------------------------------------------------------
  // The room is authoritative: we send 4-byte inputs and draw the snapshots it
  // sends back. No local prediction, so a swing lands when the server says it
  // did — at 20Hz with interpolation that reads as a slight weight, not as lag.
  var Wire = window.StickWire;
  var ws = null, roster = [], myId = null, snapAt = 0, myPing = 0, mapSeed = null;
  var createBtn = document.getElementById('sf-create');
  var joinBtn = document.getElementById('sf-join');

  function api(path, opts) {
    return fetch(NET_URL + path, opts).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  // Latency is measured against the room's own Durable Object, not the edge, so
  // it reflects the distance to where the fight actually runs. This relies on the
  // connection to the origin already being warm — refreshRooms() fetches the room
  // list first, and these pings then share that HTTP/2 connection. Measured cold,
  // the first number would include a TLS handshake (~450ms from Jakarta) instead
  // of the ~25ms round trip that actually matters.
  function pingRoom(code) {
    var t0 = (window.performance || Date).now();
    return fetch(NET_URL + '/room/' + code + '/ping', { cache: 'no-store' })
      .then(function () { return Math.round((window.performance || Date).now() - t0); })
      .catch(function () { return 9999; });
  }

  function connect(code, password, ping) {
    var name = (nameEl.value || 'kamu').slice(0, 12);
    try { localStorage.setItem('sf_name', name); } catch (e) {}
    note.textContent = 'Menyambung ke ' + code + '…';
    var url = NET_URL.replace(/^http/, 'ws') + '/room/' + code + '/ws?name=' +
              encodeURIComponent(name) + '&pw=' + encodeURIComponent(password || '');
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    myPing = ping || 0;

    ws.onopen = function () {
      world = S.createWorld(1);      // replaced as soon as the roster names the seed
      world.players = {};
      bots = []; winner = null; myId = null;
      mode = 'online';
      showGame();
      last = 0; acc = 0;
    };
    ws.onmessage = function (ev) {
      if (typeof ev.data === 'string') {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'roster') {
          // Every room generates its own arena from a seed. Without rebuilding on
          // it we would draw different platforms than the ones being fought on.
          if (msg.seed != null && msg.seed !== mapSeed) {
            mapSeed = msg.seed;
            var keep = world ? world.players : {};
            world = S.createWorld(mapSeed);
            world.players = keep;
          }
          roster = [];
          for (var i = 0; i < msg.slots.length; i++) roster[msg.slots[i].slot] = msg.slots[i];
          if (roster[msg.you]) myId = roster[msg.you].id;
          KILLS_TO_WIN = msg.killsToWin || KILLS_TO_WIN;
        }
        return;
      }
      Wire.decodeSnapshot(ev.data, world, roster, S);
      snapAt = (window.performance || Date).now();
      me = myId ? world.players[myId] : null;
      checkWin();
    };
    ws.onclose = function () {
      if (mode !== 'online') return;
      mode = 'menu'; showMenu(); ws = null;
      note.textContent = 'Sambungan terputus.';
    };
    ws.onerror = function () { note.textContent = 'Gagal menyambung.'; };
  }

  function refreshRooms() {
    roomsEl.hidden = false;
    roomsEl.innerHTML = '<div>mencari room…</div>';
    api('/lobby/list').then(function (data) {
      var rooms = (data.rooms || []).slice(0, 12);
      if (!rooms.length) { roomsEl.innerHTML = '<div>belum ada room. buat satu?</div>'; return; }
      return Promise.all(rooms.map(function (r) {
        return pingRoom(r.code).then(function (ms) { r.ping = ms; return r; });
      })).then(function (list) {
        list.sort(function (a, b) { return a.ping - b.ping; });   // nearest first
        roomsEl.innerHTML = '';
        list.forEach(function (r) {
          var row = document.createElement('div');
          row.innerHTML = '<span>' + (r.private ? '🔒 ' : '') +
            r.code + ' · ' + escapeHtml(r.name) + '</span>' +
            '<span>' + r.players + '/' + r.max + ' · ' +
            (r.ping > 3000 ? '—' : r.ping + 'ms') + '</span>';
          row.addEventListener('click', function () {
            if (r.players >= r.max) { note.textContent = 'Room itu sudah penuh.'; return; }
            var pw = r.private ? (window.prompt('Password room ' + r.code) || '') : '';
            if (r.private && !pw) return;
            connect(r.code, pw, r.ping);
          });
          roomsEl.appendChild(row);
        });
      });
    }).catch(function () {
      roomsEl.innerHTML = '<div>server tidak menjawab.</div>';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  if (!NET_URL) {
    createBtn.disabled = joinBtn.disabled = true;
    note.textContent = 'Room online belum aktif — servernya belum dipasang.';
  } else {
    createBtn.addEventListener('click', function () {
      var rn = window.prompt('Nama room:', 'ruang ' + (nameEl.value || 'kita'));
      if (rn === null) return;
      var pw = window.prompt('Password (kosongkan kalau mau room terbuka):', '') || '';
      note.textContent = 'Membuat room…';
      api('/lobby/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rn, password: pw })
      }).then(function (res) {
        if (res.error) { note.textContent = res.error; return; }
        connect(res.code, pw, 0);
      }).catch(function () { note.textContent = 'Gagal membuat room.'; });
    });
    joinBtn.addEventListener('click', refreshRooms);
  }

  // Send input only when it actually changes.
  //
  // Cloudflare bills an incoming WebSocket message as a request (at 20:1), and
  // outgoing ones as nothing — so the upstream input stream, not the 20Hz
  // snapshot broadcast, is what burns the free tier. Blindly sending 20 packets
  // a second costs ~1 billed request per player per second even while standing
  // still. The server treats input as sticky state, so a repeat is redundant
  // anyway; a keepalive every 250ms keeps us well inside its 20s idle timeout.
  // Buttons go up the instant they change, because a late jump is a death. Aim
  // is different: it slides continuously, so left alone it would change on every
  // single sample and cost as much as sending blindly. It is quantised to ~3.6
  // degrees and rate-limited to 10Hz, which no one can feel, plus a 4Hz keepalive
  // so the server never thinks we went quiet.
  var lastBits = -1, lastAim = null, lastSentAt = 0, pendingFire = false;
  setInterval(function () {
    if (mode !== 'online' || !ws || ws.readyState !== 1 || !me) return;
    var i = me.input;
    var fire = (i.fire || pendingFire) ? 1 : 0;
    var bits = (i.l ? 1 : 0) | (i.r ? 2 : 0) | (i.jump ? 4 : 0) | (i.duck ? 8 : 0) |
               (fire ? 16 : 0) | (i.discard ? 32 : 0) | (i.special ? 64 : 0);
    var aimQ = Math.round(i.aim * 16) / 16;
    var now = Date.now();
    var since = now - lastSentAt;
    var bitsChanged = bits !== lastBits;
    var aimDue = aimQ !== lastAim && since >= 100;
    if (!bitsChanged && !aimDue && since < 250) return;
    lastBits = bits; lastAim = aimQ; lastSentAt = now; pendingFire = false;
    ws.send(Wire.encodeInput({
      l: i.l, r: i.r, jump: i.jump, duck: i.duck, fire: fire, discard: i.discard,
      special: i.special, aim: aimQ
    }));
  }, 50);

  window.addEventListener('resize', sizeCanvas);
  sizeCanvas();
  requestAnimationFrame(frame);
})();
</script>
