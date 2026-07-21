---
layout: post
title: Skate or Die (main di HP-mu, sekarang!)
comments: true
---

_Katanya orang dewasa harus berhenti main-main. Katanya._

___

Beberapa malam terakhir saya iseng bikin game kecil. Bukan yang muluk-muluk—cukup satu jempol, satu papan skateboard, dan jalanan tak berujung yang penuh rintangan. Idenya sederhana: **ketuk layar buat lompat, hindari halangan yang muncul acak, kumpulkan koin, dan bertahan selama mungkin.**

Kali ini saya bikin sedikit nakal: postingan ini **terkunci di balik game-nya**. Main dulu, kumpulkan skor, baru sisa ceritanya kebuka sedikit demi sedikit. Kalau nabrak, ya ulang lagi dari nol—namanya juga skate or die.

> _Iya, saya tahu ini kekanak-kanakan. Justru itu poinnya._

Ketuk **PLAY** di bawah untuk masuk mode fullscreen. Di HP tinggal tap, di laptop pakai **Spasi** atau **klik**. Tekan **Esc** kapan saja untuk keluar dari fullscreen.

___

<style>
#skate-wrap{max-width:480px;margin:0 auto;font-family:inherit;}
#skate-wrap .board{position:relative;width:100%;background:#0d1117;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);touch-action:manipulation;user-select:none;-webkit-user-select:none;}
#skate-wrap .board.fullscreen{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;border-radius:0;z-index:9999;box-shadow:none;}
#skate-canvas{display:block;width:100%;height:auto;cursor:pointer;}
#skate-wrap .board.fullscreen #skate-canvas{width:100vw;height:100vh;}
#skate-wrap .hud{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 2px 0;font-size:14px;color:#8b949e;}
#skate-wrap .hud b{color:#e6edf3;}
#skate-wrap .hint{text-align:center;font-size:12px;color:#6e7681;margin-top:6px;}
body.skate-locked{overflow:hidden;}
.gate{position:relative;margin:22px 0;border-radius:10px;overflow:hidden;transition:filter .4s ease;}
.gate.locked{filter:blur(7px) grayscale(.4);pointer-events:none;user-select:none;}
.gate.unlocked{filter:none;}
.gate-badge{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;background:rgba(13,17,23,.55);color:#f2cc60;font-size:13px;font-weight:600;text-align:center;opacity:0;transition:opacity .3s;z-index:2;}
.gate.locked .gate-badge{opacity:1;}
.gate-badge small{color:#8b949e;font-weight:400;}
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
  <div class="hint">Tap layar / Spasi / Klik untuk lompat. Tahan sedikit lebih lama untuk lompatan lebih tinggi. Awas, makin jauh makin gila kecepatannya.</div>
</div>

<script>
(function(){
  var cv = document.getElementById('skate-canvas');
  var boardEl = cv.parentElement;
  var wrapEl = document.getElementById('skate-wrap');
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, GROUND = H - 46;
  var scoreEl = document.getElementById('sk-score');
  var bestEl  = document.getElementById('sk-best');
  var comboEl = document.getElementById('sk-combo');

  var BEST_KEY = 'ashura_skate_best';
  var WIN_KEY = 'ashura_skate_won';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch(e){}
  bestEl.textContent = best;

  var FINISH_SCORE = 1500;
  window.__skateScore = 0;
  window.__skateWon = false;
  try { window.__skateWon = localStorage.getItem(WIN_KEY) === '1'; } catch(e){}

  var state = 'ready'; // ready | playing | dead | won
  var player, obstacles, coins, particles, t, speed, spawnT, coinT, score, combo, holdBoost;
  var groundOffset = 0;

  function resizeCanvas(fullscreen){
    if (fullscreen){
      W = window.innerWidth; H = window.innerHeight;
    } else {
      W = 480; H = 270;
    }
    GROUND = H - 46;
    cv.width = W; cv.height = H;
    if (player) player.y = Math.min(player.y, GROUND);
  }

  function enterFullscreen(){
    boardEl.classList.add('fullscreen');
    document.body.classList.add('skate-locked');
    resizeCanvas(true);
  }
  function exitFullscreen(){
    boardEl.classList.remove('fullscreen');
    document.body.classList.remove('skate-locked');
    resizeCanvas(false);
  }

  function reset(){
    player = { x: 64, y: GROUND, vy: 0, r: 14, rot: 0, onGround: true, jumps: 0 };
    obstacles = []; coins = []; particles = [];
    t = 0; speed = 4.4; spawnT = 46; coinT = 100;
    score = 0; combo = 0; holdBoost = 0;
    window.__skateScore = 0;
  }

  var GRAV = 0.62, JUMP = -9.6, DOUBLE = -8.2;

  function jump(){
    if (state === 'ready'){ state = 'playing'; enterFullscreen(); reset(); player.x = 64; return; }
    if (state === 'dead' || state === 'won'){ reset(); state = 'playing'; return; }
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

  function spawnObstacle(){
    var roll = Math.random();
    if (roll < 0.36){
      obstacles.push({type:'cone', x:W+20, y:GROUND, w:20, h:24});
    } else if (roll < 0.62){
      obstacles.push({type:'barrier', x:W+20, y:GROUND, w:16, h:44});
    } else if (roll < 0.84){
      obstacles.push({type:'cone', x:W+20, y:GROUND, w:20, h:24});
      obstacles.push({type:'cone', x:W+52, y:GROUND, w:20, h:24});
    } else if (roll < 0.94){
      obstacles.push({type:'bird', x:W+20, y:GROUND-70, w:26, h:16, flap:0});
    } else {
      obstacles.push({type:'barrier', x:W+20, y:GROUND, w:16, h:44});
      obstacles.push({type:'bird', x:W+70, y:GROUND-66, w:26, h:16, flap:Math.random()*6});
    }
  }
  function spawnCoin(){
    var yy = GROUND - (30 + Math.random()*80);
    var n = 1 + (Math.random()*3|0);
    for (var i=0;i<n;i++) coins.push({x:W+20+i*22, y:yy, r:7, spin:0});
  }

  function skyColor(){
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

  function win(){
    state = 'won';
    window.__skateWon = true;
    try { localStorage.setItem(WIN_KEY, '1'); } catch(e){}
    if (score > best){ best = score; bestEl.textContent = best; try{localStorage.setItem(BEST_KEY, String(best));}catch(e){} }
    for (var i=0;i<40;i++) spark(player.x, player.y, ['#f2cc60','#58a6ff','#3fb950','#f78166'][i%4]);
  }

  function update(){
    t++;
    speed += 0.0034; // ramps up fast — harder over time
    groundOffset = (groundOffset + speed) % 40;

    if (holdBoost > 0 && !player.onGround && player.vy < 0){ player.vy -= 0.42; holdBoost--; }

    player.vy += GRAV;
    player.y += player.vy;
    if (player.y >= GROUND){ player.y = GROUND; player.vy = 0; player.onGround = true; player.jumps = 0; }
    player.rot = player.onGround ? 0 : player.rot + 0.22;

    spawnT--; if (spawnT <= 0){ spawnObstacle(); spawnT = Math.max(26, 70 - t*0.02) + Math.random()*26; }
    coinT--; if (coinT <= 0){ spawnCoin(); coinT = 120 + Math.random()*120; }

    for (var i=obstacles.length-1;i>=0;i--){
      var o = obstacles[i];
      o.x -= speed;
      if (o.type==='bird'){ o.flap+=0.3; o.y = GROUND-70 + Math.sin(o.flap)*8; }
      var top = o.y - o.h;
      var cx = Math.max(o.x, Math.min(player.x, o.x+o.w));
      var cy = Math.max(top, Math.min(player.y, o.y));
      var dx = player.x-cx, dy = player.y-cy;
      if (dx*dx+dy*dy < (player.r-1)*(player.r-1)) hit();
      if (o.x + o.w < -10){
        obstacles.splice(i,1);
        combo++; score += 10 + combo*2;
        if (combo>1 && combo%5===0) for(var k=0;k<8;k++) spark(player.x,player.y-player.r,'#f2cc60');
      }
    }

    for (var j=coins.length-1;j>=0;j--){
      var c = coins[j]; c.x -= speed; c.spin += 0.2;
      var ddx = c.x-player.x, ddy = c.y-player.y;
      if (ddx*ddx+ddy*ddy < (c.r+player.r)*(c.r+player.r)){
        coins.splice(j,1); score += 25; for(var m=0;m<5;m++) spark(c.x,c.y,'#f2cc60'); continue;
      }
      if (c.x < -10) coins.splice(j,1);
    }

    for (var p=particles.length-1;p>=0;p--){
      var pt = particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08; pt.life--;
      if (pt.life<=0) particles.splice(p,1);
    }

    if (state==='playing') score += 0.1;
    scoreEl.textContent = score|0;
    window.__skateScore = score|0;
    comboEl.textContent = combo>=3 ? ('COMBO x'+combo+'!') : '';

    if (state==='playing' && score >= FINISH_SCORE) win();
  }

  function drawPlayer(){
    ctx.save();
    ctx.translate(player.x, player.y - player.r);
    ctx.rotate(player.rot);
    ctx.fillStyle = '#f78166';
    ctx.fillRect(-16, player.r-2, 32, 5);
    ctx.fillStyle = '#30363d';
    ctx.beginPath(); ctx.arc(-10, player.r+4, 3, 0, 7); ctx.arc(10, player.r+4, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath(); ctx.arc(0,0,player.r-3,0,7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(4,-2,2,0,7); ctx.fill();
    ctx.restore();
  }

  function draw(){
    ctx.fillStyle = skyColor();
    ctx.fillRect(0,0,W,H);
    var phase = (t % 1400)/1400;
    if (phase>0.6){
      ctx.fillStyle='rgba(255,255,255,'+((phase-0.6)/0.4*0.8)+')';
      for(var s=0;s<40;s++){ var sx=(s*97+37)%W, sy=(s*53+11)%(GROUND-40); ctx.fillRect(sx,sy,1.5,1.5); }
    }
    var arcx = W*0.5 + Math.cos(phase*Math.PI*2 - Math.PI/2)*W*0.4;
    var arcy = 70 + Math.sin(phase*Math.PI*2 - Math.PI/2)*40;
    ctx.fillStyle = phase<0.5?'#ffd33d':'#e6edf3';
    ctx.beginPath(); ctx.arc(arcx, arcy, 16, 0, 7); ctx.fill();

    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, GROUND, W, H-GROUND);
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,GROUND); ctx.lineTo(W,GROUND); ctx.stroke();
    ctx.fillStyle='#30363d';
    for(var d=-1; d*40-groundOffset < W; d++){ ctx.fillRect(d*40-groundOffset, GROUND+18, 20, 3); }

    for (var j=0;j<coins.length;j++){
      var c=coins[j];
      ctx.save(); ctx.translate(c.x,c.y);
      ctx.scale(Math.abs(Math.cos(c.spin)),1);
      ctx.fillStyle='#f2cc60'; ctx.beginPath(); ctx.arc(0,0,c.r,0,7); ctx.fill();
      ctx.fillStyle='#bb8009'; ctx.beginPath(); ctx.arc(0,0,c.r*0.5,0,7); ctx.fill();
      ctx.restore();
    }

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

    for (var p=0;p<particles.length;p++){ var pt=particles[p]; ctx.globalAlpha=Math.max(0,pt.life/20); ctx.fillStyle=pt.c; ctx.fillRect(pt.x,pt.y,pt.s,pt.s); }
    ctx.globalAlpha=1;

    drawPlayer();

    ctx.textAlign='center';
    var big = Math.max(22, Math.min(44, W*0.055));
    var mid = big*0.55, small = big*0.42;
    if (state==='ready'){
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#e6edf3'; ctx.font='bold '+big+'px sans-serif'; ctx.fillText('🛹 SKATE OR DIE', W/2, H/2-14);
      ctx.font=mid+'px sans-serif'; ctx.fillStyle='#f2cc60'; ctx.fillText('▶ PLAY', W/2, H/2+22);
      ctx.fillStyle='#8b949e'; ctx.font=small+'px sans-serif'; ctx.fillText('Tap / Spasi / Klik untuk lompat (bisa double jump)', W/2, H/2+50);
      ctx.fillText('Kumpulkan skor '+FINISH_SCORE+' buat buka seluruh cerita', W/2, H/2+50+small+6);
    } else if (state==='dead'){
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#f85149'; ctx.font='bold '+big+'px sans-serif'; ctx.fillText('WASTED', W/2, H/2-16);
      ctx.fillStyle='#e6edf3'; ctx.font=mid+'px sans-serif'; ctx.fillText('Skor: '+(score|0)+'   Terbaik: '+best, W/2, H/2+22);
      ctx.fillStyle='#f2cc60'; ctx.font=small+'px sans-serif'; ctx.fillText('Tap untuk main lagi', W/2, H/2+50);
    } else if (state==='won'){
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#3fb950'; ctx.font='bold '+big+'px sans-serif'; ctx.fillText('🎉 SELAMAT!', W/2, H/2-16);
      ctx.fillStyle='#e6edf3'; ctx.font=mid+'px sans-serif'; ctx.fillText('Skor: '+(score|0)+' — kamu berhasil!', W/2, H/2+22);
      ctx.fillStyle='#f2cc60'; ctx.font=small+'px sans-serif'; ctx.fillText('Cerita lengkap sudah terbuka. Tap untuk keluar.', W/2, H/2+50);
    }
    ctx.textAlign='left';
  }

  function loop(){
    if (state==='playing') update();
    else { t++; for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08; pt.life--; if(pt.life<=0) particles.splice(p,1);} }
    draw();
    requestAnimationFrame(loop);
  }

  function press(e){
    if(e.type!=='keydown') e.preventDefault();
    if (state==='won'){ exitFullscreen(); state='ready'; return; }
    jump();
  }
  cv.addEventListener('mousedown', press);
  cv.addEventListener('touchstart', press, {passive:false});
  window.addEventListener('mouseup', releaseJump);
  window.addEventListener('touchend', releaseJump);
  window.addEventListener('keydown', function(e){
    if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ e.preventDefault(); press(e); }
    if(e.key==='Escape' && boardEl.classList.contains('fullscreen')){ exitFullscreen(); if(state==='playing') state='ready'; }
  });
  window.addEventListener('keyup', function(e){ if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ releaseJump(); }});
  window.addEventListener('resize', function(){ if (boardEl.classList.contains('fullscreen')) resizeCanvas(true); });

  reset();
  loop();
})();
</script>

<div class="gate locked" data-unlock="200">
  <div class="gate-badge">🔒 Kumpulkan skor 200<br><small>main dulu di atas ya</small></div>

### Sedikit catatan

Rintangannya dibuat acak: ada kerucut lalu-lintas, palang jingga yang lebih tinggi, kadang dua kerucut berdempet yang harus kamu lewati dengan _double jump_, dan sesekali burung ungu yang terbang rendah—kalau kamu asal lompat, malah nabrak dia. Jadi timing itu segalanya.

</div>

<div class="gate locked" data-unlock="600">
  <div class="gate-badge">🔒 Kumpulkan skor 600<br><small>lumayan jauh, tapi bisa!</small></div>

Koin emas menambah skor dengan cepat, dan tiap rintangan yang berhasil dilewati menaikkan **combo**. Semakin panjang combo, semakin gila skornya. Papan juga makin ngebut seiring waktu—jangan kaget kalau tiba-tiba semua terasa dua kali lebih cepat dari tadi.

> _Target saya cuma satu: bikin kamu bilang “ah, sekali lagi” minimal lima kali._

</div>

<div class="gate locked" data-unlock="1500">
  <div class="gate-badge">🔒 Skor 1500 buat tamat<br><small>ini levelnya udah brutal, semangat</small></div>

Skor terbaikmu tersimpan di HP, jadi silakan pamer ke teman. Kalau papanmu hancur, ya tinggal ketuk lagi—tidak ada nyawa terbatas di sini, cuma keras kepala.

Selamat mencoba. Sampai jumpa di ujung jalan.

Asif, _signing off_. 🛹

</div>

<script>
(function(){
  var gates = Array.prototype.slice.call(document.querySelectorAll('.gate'));
  var WIN_KEY = 'ashura_skate_won';
  var won = false;
  try { won = localStorage.getItem(WIN_KEY) === '1'; } catch(e){}

  function refresh(){
    var score = window.__skateScore || 0;
    var allWon = won || window.__skateWon;
    gates.forEach(function(g){
      var need = parseInt(g.getAttribute('data-unlock'), 10) || 0;
      if (allWon || score >= need){
        g.classList.remove('locked'); g.classList.add('unlocked');
      }
    });
  }
  refresh();
  setInterval(refresh, 300);
})();
</script>
