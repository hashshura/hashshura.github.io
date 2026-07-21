---
layout: post
title: Skate or Die (main di HP-mu, sekarang!)
comments: true
---

_Katanya orang dewasa harus berhenti main-main. Katanya._

___

Beberapa malam terakhir saya iseng bikin game kecil. Bukan yang muluk-muluk—cukup satu jempol, satu papan skateboard, dan jalanan tak berujung yang penuh rintangan. Idenya sederhana: **ketuk layar buat lompat, hindari halangan yang muncul acak, kumpulkan koin, dan bertahan selama mungkin.**

Semakin lama kamu bertahan, semakin cepat papanmu meluncur. Langit pun berganti dari siang ke senja ke malam. Kalau lompatanmu mulus berturut-turut, kamu dapat **combo** yang bikin skor meledak.

> _Iya, saya tahu ini kekanak-kanakan. Justru itu poinnya._

Langsung saja. Ketuk **PLAY**, lalu ketuk di mana saja untuk melompat. Di HP tinggal tap, di laptop pakai **Spasi** atau **klik**.

___

<style>
#skate-wrap{max-width:480px;margin:0 auto;font-family:inherit;}
#skate-wrap .board{position:relative;width:100%;background:#0d1117;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);touch-action:manipulation;user-select:none;-webkit-user-select:none;}
#skate-canvas{display:block;width:100%;height:auto;cursor:pointer;}
#skate-wrap .hud{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 2px 0;font-size:14px;color:#8b949e;}
#skate-wrap .hud b{color:#e6edf3;}
#skate-wrap .hint{text-align:center;font-size:12px;color:#6e7681;margin-top:6px;}
</style>

<div id="skate-wrap">
  <div class="board">
    <canvas id="skate-canvas" width="480" height="270"></canvas>
  </div>
  <div class="hud">
    <span>Skor: <b id="sk-score">0</b></span>
    <span id="sk-combo" style="color:#f2cc60;"></span>
    <span>Terbaik: <b id="sk-best">0</b></span>
  </div>
  <div class="hint">Tap layar / Spasi / Klik untuk lompat. Tahan sedikit lebih lama untuk lompatan lebih tinggi.</div>
</div>

<script>
(function(){
  var cv = document.getElementById('skate-canvas');
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var GROUND = H - 46;
  var scoreEl = document.getElementById('sk-score');
  var bestEl  = document.getElementById('sk-best');
  var comboEl = document.getElementById('sk-combo');

  var BEST_KEY = 'ashura_skate_best';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch(e){}
  bestEl.textContent = best;

  var state = 'ready'; // ready | playing | dead
  var player, obstacles, coins, particles, t, speed, spawnT, coinT, score, combo, holdBoost;
  var groundOffset = 0;

  function reset(){
    player = { x: 64, y: GROUND, vy: 0, r: 14, rot: 0, onGround: true, jumps: 0 };
    obstacles = []; coins = []; particles = [];
    t = 0; speed = 3.4; spawnT = 60; coinT = 90;
    score = 0; combo = 0; holdBoost = 0;
  }

  var GRAV = 0.62, JUMP = -9.6, DOUBLE = -8.2;

  function jump(){
    if (state === 'ready'){ state = 'playing'; return; }
    if (state === 'dead'){ reset(); state = 'playing'; return; }
    if (player.onGround){
      player.vy = JUMP; player.onGround = false; player.jumps = 1; holdBoost = 9;
      puff(player.x, player.y+player.r);
    } else if (player.jumps < 2){
      player.vy = DOUBLE; player.jumps = 2; holdBoost = 6;
      for (var i=0;i<6;i++) spark(player.x, player.y, '#58a6ff');
    }
  }
  function releaseJump(){ holdBoost = 0; }

  function puff(x,y){ for(var i=0;i<5;i++) particles.push({x:x+(Math.random()*16-8),y:y,vx:-speed*0.6-Math.random(),vy:Math.random()*-1,life:20,c:'#484f58',s:3}); }
  function spark(x,y,c){ particles.push({x:x,y:y,vx:Math.random()*3-1.5,vy:Math.random()*3-1.5,life:16,c:c,s:2}); }

  // obstacle types: cone (jump), barrier (jump high), ramp (bounce/score), bird (duck? we make low+high mix)
  function spawnObstacle(){
    var roll = Math.random();
    if (roll < 0.5){
      obstacles.push({type:'cone', x:W+20, y:GROUND, w:20, h:24});
    } else if (roll < 0.78){
      obstacles.push({type:'barrier', x:W+20, y:GROUND, w:16, h:40});
    } else if (roll < 0.92){
      // gap of two cones
      obstacles.push({type:'cone', x:W+20, y:GROUND, w:20, h:24});
      obstacles.push({type:'cone', x:W+52, y:GROUND, w:20, h:24});
    } else {
      // flying bird you must be on ground to avoid (jump into it = hit)
      obstacles.push({type:'bird', x:W+20, y:GROUND-70, w:26, h:16, flap:0});
    }
  }
  function spawnCoin(){
    var yy = GROUND - (30 + Math.random()*80);
    var n = 1 + (Math.random()*3|0);
    for (var i=0;i<n;i++) coins.push({x:W+20+i*22, y:yy, r:7, spin:0});
  }

  function skyColor(){
    // cycle day -> sunset -> night over ~1400 ticks
    var phase = (t % 1400) / 1400;
    var day = [24,32,54], sunset=[74,44,54], night=[8,12,26];
    function lerp(a,b,f){return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];}
    var c;
    if (phase < 0.5) c = lerp(day, sunset, phase/0.5);
    else c = lerp(sunset, night, (phase-0.5)/0.5);
    return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';
  }

  function hit(){
    state = 'dead';
    for (var i=0;i<20;i++) spark(player.x, player.y, '#f85149');
    if (score > best){ best = score; bestEl.textContent = best; try{localStorage.setItem(BEST_KEY, String(best));}catch(e){} }
  }

  function update(){
    t++;
    speed += 0.0016; // gradual acceleration
    groundOffset = (groundOffset + speed) % 40;

    // hold-to-jump-higher
    if (holdBoost > 0 && !player.onGround && player.vy < 0){ player.vy -= 0.42; holdBoost--; }

    player.vy += GRAV;
    player.y += player.vy;
    if (player.y >= GROUND){ player.y = GROUND; player.vy = 0; player.onGround = true; player.jumps = 0; }
    player.rot = player.onGround ? 0 : player.rot + 0.22;

    // spawn
    spawnT--; if (spawnT <= 0){ spawnObstacle(); spawnT = Math.max(42, 95 - t*0.02) + Math.random()*40; }
    coinT--; if (coinT <= 0){ spawnCoin(); coinT = 120 + Math.random()*120; }

    // obstacles
    for (var i=obstacles.length-1;i>=0;i--){
      var o = obstacles[i];
      o.x -= speed;
      if (o.type==='bird'){ o.flap+=0.3; o.y = GROUND-70 + Math.sin(o.flap)*8; }
      // collision (circle vs rect)
      var top = o.y - o.h;
      var cx = Math.max(o.x, Math.min(player.x, o.x+o.w));
      var cy = Math.max(top, Math.min(player.y, o.y));
      var dx = player.x-cx, dy = player.y-cy;
      if (dx*dx+dy*dy < (player.r-2)*(player.r-2)) hit();
      if (o.x + o.w < -10){
        obstacles.splice(i,1);
        combo++; score += 10 + combo*2; // reward clearing
        if (combo>1 && combo%5===0) for(var k=0;k<8;k++) spark(player.x,player.y-player.r,'#f2cc60');
      }
    }

    // coins
    for (var j=coins.length-1;j>=0;j--){
      var c = coins[j]; c.x -= speed; c.spin += 0.2;
      var ddx = c.x-player.x, ddy = c.y-player.y;
      if (ddx*ddx+ddy*ddy < (c.r+player.r)*(c.r+player.r)){
        coins.splice(j,1); score += 25; for(var m=0;m<5;m++) spark(c.x,c.y,'#f2cc60'); continue;
      }
      if (c.x < -10) coins.splice(j,1);
    }

    // particles
    for (var p=particles.length-1;p>=0;p--){
      var pt = particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08; pt.life--;
      if (pt.life<=0) particles.splice(p,1);
    }

    if (state==='playing') score += 0.1;
    scoreEl.textContent = score|0;
    comboEl.textContent = combo>=3 ? ('COMBO x'+combo+'!') : '';
  }

  function drawPlayer(){
    ctx.save();
    ctx.translate(player.x, player.y - player.r);
    ctx.rotate(player.rot);
    // board
    ctx.fillStyle = '#f78166';
    ctx.fillRect(-16, player.r-2, 32, 5);
    ctx.fillStyle = '#30363d';
    ctx.beginPath(); ctx.arc(-10, player.r+4, 3, 0, 7); ctx.arc(10, player.r+4, 3, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath(); ctx.arc(0,0,player.r-3,0,7); ctx.fill();
    // face dot
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(4,-2,2,0,7); ctx.fill();
    ctx.restore();
  }

  function draw(){
    // sky
    ctx.fillStyle = skyColor();
    ctx.fillRect(0,0,W,H);
    // stars at night
    var phase = (t % 1400)/1400;
    if (phase>0.6){
      ctx.fillStyle='rgba(255,255,255,'+((phase-0.6)/0.4*0.8)+')';
      for(var s=0;s<20;s++){ var sx=(s*97+37)%W, sy=(s*53+11)%(GROUND-40); ctx.fillRect(sx,sy,1.5,1.5); }
    }
    // sun/moon
    var arcx = W*0.5 + Math.cos(phase*Math.PI*2 - Math.PI/2)*W*0.4;
    var arcy = 70 + Math.sin(phase*Math.PI*2 - Math.PI/2)*40;
    ctx.fillStyle = phase<0.5?'#ffd33d':'#e6edf3';
    ctx.beginPath(); ctx.arc(arcx, arcy, 16, 0, 7); ctx.fill();

    // ground
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, GROUND, W, H-GROUND);
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,GROUND); ctx.lineTo(W,GROUND); ctx.stroke();
    // dashes
    ctx.fillStyle='#30363d';
    for(var d=-1; d*40-groundOffset < W; d++){ ctx.fillRect(d*40-groundOffset, GROUND+18, 20, 3); }

    // coins
    for (var j=0;j<coins.length;j++){
      var c=coins[j];
      ctx.save(); ctx.translate(c.x,c.y);
      ctx.scale(Math.abs(Math.cos(c.spin)),1);
      ctx.fillStyle='#f2cc60'; ctx.beginPath(); ctx.arc(0,0,c.r,0,7); ctx.fill();
      ctx.fillStyle='#bb8009'; ctx.beginPath(); ctx.arc(0,0,c.r*0.5,0,7); ctx.fill();
      ctx.restore();
    }

    // obstacles
    for (var i=0;i<obstacles.length;i++){
      var o=obstacles[i];
      if (o.type==='cone'){
        ctx.fillStyle='#f78166';
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x+o.w/2, o.y-o.h); ctx.lineTo(o.x+o.w, o.y); ctx.fill();
        ctx.fillStyle='#fff'; ctx.fillRect(o.x+3, o.y-o.h*0.55, o.w-6, 3);
      } else if (o.type==='barrier'){
        ctx.fillStyle='#db6d28'; ctx.fillRect(o.x, o.y-o.h, o.w, o.h);
        ctx.fillStyle='#e6edf3'; for(var b=0;b<o.h;b+=10) ctx.fillRect(o.x, o.y-o.h+b, o.w, 4);
      } else if (o.type==='bird'){
        ctx.fillStyle='#a371f7';
        var wy = Math.sin(o.flap)*6;
        ctx.beginPath(); ctx.ellipse(o.x+o.w/2, o.y-o.h/2, o.w/2, o.h/2, 0,0,7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(o.x+o.w/2, o.y-o.h/2); ctx.lineTo(o.x, o.y-o.h/2-wy-6); ctx.lineTo(o.x+o.w/2, o.y-o.h/2-2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(o.x+o.w/2, o.y-o.h/2); ctx.lineTo(o.x+o.w, o.y-o.h/2-wy-6); ctx.lineTo(o.x+o.w/2, o.y-o.h/2-2); ctx.fill();
      }
    }

    // particles
    for (var p=0;p<particles.length;p++){ var pt=particles[p]; ctx.globalAlpha=Math.max(0,pt.life/20); ctx.fillStyle=pt.c; ctx.fillRect(pt.x,pt.y,pt.s,pt.s); }
    ctx.globalAlpha=1;

    drawPlayer();

    // overlays
    ctx.textAlign='center';
    if (state==='ready'){
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#e6edf3'; ctx.font='bold 26px sans-serif'; ctx.fillText('🛹 SKATE OR DIE', W/2, H/2-14);
      ctx.font='15px sans-serif'; ctx.fillStyle='#f2cc60'; ctx.fillText('▶ PLAY', W/2, H/2+16);
      ctx.fillStyle='#8b949e'; ctx.font='12px sans-serif'; ctx.fillText('Tap / Spasi / Klik untuk lompat (bisa double jump)', W/2, H/2+38);
    } else if (state==='dead'){
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#f85149'; ctx.font='bold 26px sans-serif'; ctx.fillText('WASTED', W/2, H/2-16);
      ctx.fillStyle='#e6edf3'; ctx.font='16px sans-serif'; ctx.fillText('Skor: '+(score|0)+'   Terbaik: '+best, W/2, H/2+10);
      ctx.fillStyle='#f2cc60'; ctx.font='14px sans-serif'; ctx.fillText('Tap untuk main lagi', W/2, H/2+34);
    }
    ctx.textAlign='left';
  }

  function loop(){
    if (state==='playing') update();
    else { // idle animation still ticks sky slowly
      t++; for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08; pt.life--; if(pt.life<=0) particles.splice(p,1);} 
    }
    draw();
    requestAnimationFrame(loop);
  }

  // input
  function press(e){ if(e.type!=='keydown') e.preventDefault(); jump(); }
  cv.addEventListener('mousedown', press);
  cv.addEventListener('touchstart', press, {passive:false});
  window.addEventListener('mouseup', releaseJump);
  window.addEventListener('touchend', releaseJump);
  window.addEventListener('keydown', function(e){ if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ e.preventDefault(); jump(); }});
  window.addEventListener('keyup', function(e){ if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ releaseJump(); }});

  reset();
  loop();
})();
</script>

___

### Sedikit catatan

Rintangannya dibuat acak: ada kerucut lalu-lintas, palang jingga yang lebih tinggi, kadang dua kerucut berdempet yang harus kamu lewati dengan _double jump_, dan sesekali burung ungu yang terbang rendah—kalau kamu asal lompat, malah nabrak dia. Jadi timing itu segalanya.

Koin emas menambah skor dengan cepat, dan tiap rintangan yang berhasil dilewati menaikkan **combo**. Semakin panjang combo, semakin gila skornya. Skor terbaikmu tersimpan di HP, jadi silakan pamer ke teman.

> _Target saya cuma satu: bikin kamu bilang “ah, sekali lagi” minimal lima kali._

Selamat mencoba. Kalau papanmu hancur, ya tinggal ketuk lagi.

Asif, _signing off_. 🛹

<script>
// nudge canvas to internal res on hi-dpi without changing CSS width
(function(){
  var cv=document.getElementById('skate-canvas');
  // keep logical 480x270; CSS scales it. Nothing else needed.
})();
</script>
