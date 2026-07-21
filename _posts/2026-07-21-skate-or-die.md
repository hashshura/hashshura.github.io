---
layout: post
title: Skate or Die (baca sambil meluncur!)
comments: true
thumbnail: /assets/img/2026-07-21-skate-or-die.png
teaser: "Postingan ini ditulis pakai tinta tak terlihat. Kata-katanya cuma muncul kalau kamu berani meluncur dan menghindari rintangan. Jatuh? Sepuluh kata langsung lenyap. Berani coba?"
---

<style>
#skate-banner{position:sticky;top:0;z-index:50;background:#fbfbf7;border-bottom:2px solid #222;margin:0 0 8px;box-shadow:0 4px 10px rgba(0,0,0,.06);}
#skate-banner canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;}
#skate-banner .bar{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555;padding:4px 10px 6px;font-family:inherit;}
#skate-banner .bar b{color:#111;}
#skate-progress{position:relative;height:4px;background:#e6e6df;}
#skate-progress > i{display:block;height:100%;width:0;background:#222;transition:width .2s;}

/* invisible-ink post body */
#ink .w{opacity:0;transition:opacity .5s ease;}
#ink .w.on{opacity:1;}
#ink{min-height:40vh;}
</style>

<div id="skate-banner">
  <canvas id="skate-canvas" width="720" height="300"></canvas>
  <div id="skate-progress"><i></i></div>
  <div class="bar">
    <span>🛹 <b id="sk-words">0</b> / <b id="sk-total">0</b> kata terbuka</span>
    <span id="sk-msg">Tap / Spasi untuk mulai meluncur</span>
    <span>Skor: <b id="sk-score">0</b></span>
  </div>
</div>

<div id="ink" markdown="1">

_Katanya orang dewasa harus berhenti main-main. Tapi lihat—kamu di sini, mendorong sebuah papan skateboard hanya untuk memunculkan sebuah tulisan._

Setiap kata di halaman ini terkunci sebagai tinta tak terlihat. Ia baru muncul kalau kamu meluncur cukup jauh dan menghindari batu, kardus, serta kerucut yang menghadang. Sepuluh langkah, satu kata. Sabar sedikit, ya.

Tidak ada yang instan di sini, sama seperti kebanyakan hal yang layak dibaca. Tapi hati-hati: setiap kali kamu jatuh, sepuluh kata terakhir ikut lenyap dari halaman. Jadi jangan asal lompat—timing itu segalanya, dan kamu harus benar-benar bergerak maju.

Jadi teruslah meluncur. Lompati setiap rintangannya. Biarkan cerita ini menyusun dirinya sendiri, sedikit demi sedikit, tepat di bawah roda papanmu—sampai kata yang paling terakhir, dan papan itu akhirnya boleh berhenti.

Terima kasih sudah menemani sampai ke ujung jalan. Sekarang halaman ini sudah utuh, sama seperti tulisan biasa. Asif, _signing off._ 🛹

</div>

<script>
(function(){
  // ---- reveal setup: wrap every word in the post body into a span ----
  var ink = document.getElementById('ink');
  var words = [];
  (function walk(node){
    // snapshot children first: we mutate the tree as we go, and appending a
    // DocumentFragment empties it, so a live childNodes loop would re-process
    // the spans we just created (infinite loop).
    var kids = Array.prototype.slice.call(node.childNodes);
    for (var k=0;k<kids.length;k++){
      var n = kids[k];
      if (n.nodeType===3){ // text node
        if (!/\S/.test(n.nodeValue)) continue; // whitespace-only, leave as is
        var parts = n.nodeValue.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        for (var p=0;p<parts.length;p++){
          if (/\S/.test(parts[p])){
            var s = document.createElement('span');
            s.className='w'; s.textContent=parts[p];
            frag.appendChild(s); words.push(s);
          } else if (parts[p]){
            frag.appendChild(document.createTextNode(parts[p]));
          }
        }
        node.replaceChild(frag, n);
      } else if (n.nodeType===1){ // element (e.g. <em>) — recurse, never a created span
        walk(n);
      }
    }
  })(ink);

  var TOTAL = words.length;
  var PER_WORD = 10;
  var PENALTY = PER_WORD * 10; // crashing costs you 10 words
  var RAMP_BONUS = PER_WORD * 5; // nailing a ramp launch grants 5 words
  var FINISH = TOTAL * PER_WORD;
  document.getElementById('sk-total').textContent = TOTAL;

  var wordsEl = document.getElementById('sk-words');
  var progEl = document.querySelector('#skate-progress > i');
  function reveal(score){
    var n = Math.min(TOTAL, Math.floor(score / PER_WORD));
    for (var i=0;i<TOTAL;i++){
      if (i<n) words[i].classList.add('on'); else words[i].classList.remove('on');
    }
    wordsEl.textContent = n;
    progEl.style.width = Math.min(100,(score/FINISH)*100)+'%';
    return n;
  }

  // ---- the game (white, doodle style) ----
  var cv = document.getElementById('skate-canvas');
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, GROUND;
  var scoreEl = document.getElementById('sk-score');
  var msgEl = document.getElementById('sk-msg');

  function sizeCanvas(){
    var cssW = cv.clientWidth || cv.parentElement.clientWidth || 720;
    // taller aspect so a double-jump never clips off the top; capped so the
    // sticky banner never eats the whole viewport.
    var h = Math.max(220, Math.min(340, cssW*0.42));
    cv.width = W = Math.round(cssW);
    cv.height = H = Math.round(h);
    GROUND = H - 34;
    if (player) player.y = Math.min(player.y, GROUND);
  }

  var state = 'ready'; // ready | playing | won
  var player, obstacles, particles, notes, t, speed, spawnT, score, holdBoost, checkpoint, flash, shownWords;

  function reset(keepScore){
    var s = keepScore ? checkpoint : 0;
    player = { x: 70, y: GROUND, vy:0, r:12, rot:0, onGround:true, jumps:0 };
    obstacles = []; particles = []; notes = [];
    t = 0; speed = 4.2; spawnT = 40;
    score = s; holdBoost = 0; flash = 0; shownWords = Math.floor(s / PER_WORD);
  }

  function note(text, color, up){
    notes.push({text:text, color:color, x:player.x+18, y:player.y-player.r-18, vy:up||-0.9, life:52, max:52});
  }

  var GRAV = 0.6, JUMP = -9.2, DOUBLE = -7.8;

  function jump(){
    if (state==='ready'){ state='playing'; msgEl.textContent='Meluncur! Lompati rintangannya.'; return; }
    if (state==='won'){ return; }
    if (player.onGround){
      // launch off a ramp if you jump right at its lip → bonus words
      var ramp=null;
      for (var i=0;i<obstacles.length;i++){ var o=obstacles[i];
        if (o.type==='ramp' && !o.used && player.x > o.x+o.w*0.45 && player.x < o.x+o.w+14){ ramp=o; break; } }
      if (ramp){ rampBonus(ramp); player.vy=JUMP*1.5; holdBoost=12; }
      else { player.vy=JUMP; holdBoost=9; }
      player.onGround=false; player.jumps=1; puff(player.x,player.y+player.r);
    }
    else if (player.jumps<2){ player.vy=DOUBLE; player.jumps=2; holdBoost=6; for(var i=0;i<6;i++) spark(player.x,player.y,'#222'); }
  }
  function releaseJump(){ holdBoost=0; }

  function rampBonus(o){
    o.used=true;
    score += RAMP_BONUS;
    shownWords = Math.floor(score / PER_WORD); // suppress the plain +N note; show AWESOME instead
    note('AWESOME! +'+(RAMP_BONUS/PER_WORD)+' kata', '#e0a800', -1.3);
    msgEl.textContent='🤩 AWESOME! Bonus '+(RAMP_BONUS/PER_WORD)+' kata!';
    for (var i=0;i<24;i++) spark(player.x, player.y-player.r, '#e0a800');
  }

  function puff(x,y){ for(var i=0;i<5;i++) particles.push({x:x+(Math.random()*14-7),y:y,vx:-speed*0.5-Math.random(),vy:Math.random()*-1,life:18,s:2}); }
  function spark(x,y,c){ particles.push({x:x,y:y,vx:Math.random()*3-1.5,vy:Math.random()*3-1.5,life:14,s:2}); }

  function spawnObstacle(){
    var roll = Math.random();
    if (roll<0.12) obstacles.push({type:'ramp', x:W+20, y:GROUND, w:52, h:30, used:false});
    else if (roll<0.44) obstacles.push({type:'rock', x:W+20, y:GROUND, w:24, h:18});
    else if (roll<0.7) obstacles.push({type:'box', x:W+20, y:GROUND, w:22, h:30});
    else if (roll<0.88){ obstacles.push({type:'cone', x:W+20, y:GROUND, w:18, h:22}); obstacles.push({type:'cone', x:W+50, y:GROUND, w:18, h:22}); }
    else obstacles.push({type:'bird', x:W+20, y:GROUND-58, w:24, h:14, flap:0});
  }

  function hit(){
    var before = Math.floor(score / PER_WORD);
    score = Math.max(0, score - PENALTY); // lose 10 words for crashing
    var lost = before - Math.floor(score / PER_WORD);
    checkpoint = score;
    flash = 22;
    msgEl.textContent = lost>0 ? ('💥 Nabrak! −'+lost+' kata') : '💥 Nabrak!';
    for(var i=0;i<18;i++) spark(player.x,player.y,'#c0392b');
    var px=player.x, py=player.y, pr=player.r;
    reset(true);
    notes.push({text: lost>0 ? ('−'+lost+' kata') : 'Nabrak!', color:'#c0392b', x:px+18, y:py-pr-18, vy:-0.9, life:70, max:70});
    state='playing';
    reveal(score);
  }

  function win(){
    state='won'; score=FINISH; reveal(score);
    msgEl.textContent='Selesai! Halaman terbuka penuh 🎉';
    for(var i=0;i<50;i++) particles.push({x:W/2+(Math.random()*W*0.4-W*0.2),y:H*0.4,vx:Math.random()*6-3,vy:Math.random()*-4-1,life:60,s:3,conf:true});
  }

  function update(){
    t++; speed += 0.0022;
    if (flash>0) flash--;

    if (holdBoost>0 && !player.onGround && player.vy<0){ player.vy-=0.4; holdBoost--; }
    player.vy += GRAV; player.y += player.vy;
    if (player.y>=GROUND){ player.y=GROUND; player.vy=0; player.onGround=true; player.jumps=0; }
    player.rot = player.onGround ? 0 : player.rot+0.2;

    spawnT--; if (spawnT<=0){ spawnObstacle(); spawnT = Math.max(30, 66 - t*0.02) + Math.random()*24; }

    for (var i=obstacles.length-1;i>=0;i--){
      var o=obstacles[i]; o.x-=speed;
      if (o.type==='bird'){ o.flap+=0.3; o.y=GROUND-58+Math.sin(o.flap)*7; }
      if (o.type!=='ramp'){ // ramps are launch pads, not lethal
        var top=o.y-o.h;
        var cx=Math.max(o.x,Math.min(player.x,o.x+o.w));
        var cy=Math.max(top,Math.min(player.y,o.y));
        var dx=player.x-cx, dy=player.y-cy;
        if (dx*dx+dy*dy < (player.r-1)*(player.r-1)){ hit(); return; }
      }
      if (o.x+o.w<-10){ obstacles.splice(i,1); if (o.type!=='ramp') score += 4; }
    }

    for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=(pt.conf?0.12:0.08); pt.life--; if(pt.life<=0) particles.splice(p,1); }
    for (var q=notes.length-1;q>=0;q--){ var nt=notes[q]; nt.y+=nt.vy; nt.life--; if(nt.life<=0) notes.splice(q,1); }

    score += speed*0.09; // distance skated
    scoreEl.textContent = score|0;
    var nowWords = Math.floor(score / PER_WORD);
    if (nowWords > shownWords){ note('+'+(nowWords-shownWords)+' kata', '#2e7d32'); shownWords = nowWords; }
    reveal(score);
    if (score>=FINISH) win();
  }

  function ink2(){ ctx.strokeStyle='#222'; ctx.fillStyle='#222'; ctx.lineWidth=2.4; ctx.lineJoin='round'; ctx.lineCap='round'; }

  function drawPlayer(){
    ctx.save(); ctx.translate(player.x, player.y-player.r); ctx.rotate(player.rot); ink2();
    // deck
    ctx.beginPath(); ctx.moveTo(-16,player.r); ctx.lineTo(16,player.r); ctx.stroke();
    // wheels
    ctx.beginPath(); ctx.arc(-9,player.r+4,2.4,0,7); ctx.arc(9,player.r+4,2.4,0,7); ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(0,-2,player.r-4,0,7); ctx.stroke();
    // little smile
    ctx.beginPath(); ctx.arc(0,-2,4,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.restore();
  }

  function draw(){
    ctx.fillStyle = '#fbfbf7';
    ctx.fillRect(0,0,W,H);
    ink2();

    // ground — slightly wavy doodle line
    ctx.beginPath();
    for (var gx=0; gx<=W; gx+=12){ var gy=GROUND+Math.sin((gx+t*speed)*0.05)*1.2; if(gx===0) ctx.moveTo(gx,gy); else ctx.lineTo(gx,gy); }
    ctx.stroke();
    // dashes
    var off=(t*speed)%36;
    for(var d=-1; d*36-off<W; d++){ ctx.beginPath(); ctx.moveTo(d*36-off+8,GROUND+12); ctx.lineTo(d*36-off+24,GROUND+12); ctx.stroke(); }

    // obstacles (doodle outlines)
    for (var i=0;i<obstacles.length;i++){
      var o=obstacles[i]; ink2();
      if (o.type==='ramp'){
        // up-ramp rising to the right, with a gold star at the lip
        ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+o.w,o.y-o.h); ctx.lineTo(o.x+o.w,o.y); ctx.closePath(); ctx.stroke();
        ctx.fillStyle='#e0a800'; ctx.textAlign='center';
        ctx.font='bold '+Math.round(H*0.075)+'px sans-serif';
        ctx.fillText('★', o.x+o.w, o.y-o.h-4);
        ctx.textAlign='left';
      } else if (o.type==='rock'){
        ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.quadraticCurveTo(o.x+2,o.y-o.h,o.x+o.w*0.45,o.y-o.h);
        ctx.quadraticCurveTo(o.x+o.w,o.y-o.h*0.8,o.x+o.w,o.y); ctx.closePath(); ctx.stroke();
      } else if (o.type==='box'){
        ctx.strokeRect(o.x,o.y-o.h,o.w,o.h);
        ctx.beginPath(); ctx.moveTo(o.x,o.y-o.h); ctx.lineTo(o.x+o.w,o.y); ctx.moveTo(o.x+o.w,o.y-o.h); ctx.lineTo(o.x,o.y); ctx.stroke();
      } else if (o.type==='cone'){
        ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+o.w/2,o.y-o.h); ctx.lineTo(o.x+o.w,o.y); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x+3,o.y-o.h*0.5); ctx.lineTo(o.x+o.w-3,o.y-o.h*0.5); ctx.stroke();
      } else if (o.type==='bird'){
        var wy=Math.sin(o.flap)*6;
        ctx.beginPath(); ctx.arc(o.x+o.w/2,o.y-o.h/2,o.h/2,0,7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y-o.h/2); ctx.lineTo(o.x,o.y-o.h/2-wy-6);
        ctx.moveTo(o.x+o.w/2,o.y-o.h/2); ctx.lineTo(o.x+o.w,o.y-o.h/2-wy-6); ctx.stroke();
      }
    }

    // particles
    ctx.fillStyle='#222';
    for (var p=0;p<particles.length;p++){ var pt=particles[p]; ctx.globalAlpha=Math.max(0,pt.life/(pt.conf?60:18)); ctx.fillRect(pt.x,pt.y,pt.s,pt.s); }
    ctx.globalAlpha=1;

    drawPlayer();

    // floating notifications (+1 kata / −10 kata)
    ctx.textAlign='center';
    for (var q=0;q<notes.length;q++){
      var nt=notes[q];
      ctx.globalAlpha=Math.max(0,Math.min(1, nt.life/nt.max*1.4));
      ctx.fillStyle=nt.color;
      ctx.font='bold '+Math.round(H*0.075)+'px sans-serif';
      ctx.fillText(nt.text, nt.x, nt.y);
    }
    ctx.globalAlpha=1; ctx.textAlign='left';

    // subtle red blip on crash — a soft fade, never a harsh strobe
    if (flash>0){
      ctx.globalAlpha=(flash/22)*0.22;
      ctx.fillStyle='#c0392b';
      ctx.fillRect(0,0,W,H);
      ctx.globalAlpha=1;
    }

    // overlays — auto-shrink so text never clips on narrow screens
    ctx.textAlign='center'; ctx.fillStyle='#222';
    function fit(text, px, bold){
      var pre = bold ? 'bold ' : '';
      px = Math.round(px);
      ctx.font = pre+px+'px sans-serif';
      while (px>9 && ctx.measureText(text).width > W*0.9){ px--; ctx.font = pre+px+'px sans-serif'; }
    }
    if (state==='ready'){
      fit('🛹 SKATE OR DIE', H*0.18, true); ctx.fillText('🛹 SKATE OR DIE', W/2, H*0.42);
      fit('▶ Tap / Spasi untuk meluncur', H*0.1, false); ctx.fillText('▶ Tap / Spasi untuk meluncur', W/2, H*0.62);
    } else if (state==='won'){
      fit('🎉 SELAMAT!', H*0.2, true); ctx.fillText('🎉 SELAMAT!', W/2, H*0.4);
      fit('Semua kata terbuka.', H*0.1, false); ctx.fillText('Semua kata terbuka.', W/2, H*0.58);
      fit('Selamat membaca! Tap untuk lanjut.', H*0.09, false); ctx.fillText('Selamat membaca! Tap untuk lanjut.', W/2, H*0.72);
    }
    ctx.textAlign='left';
  }

  function loop(){
    if (state==='playing') update();
    else { for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=(pt.conf?0.12:0.08); pt.life--; if(pt.life<=0) particles.splice(p,1);} }
    draw();
    requestAnimationFrame(loop);
  }

  function press(e){ if(e && e.type!=='keydown') e.preventDefault(); jump(); }
  cv.addEventListener('mousedown', press);
  cv.addEventListener('touchstart', press, {passive:false});
  window.addEventListener('mouseup', releaseJump);
  window.addEventListener('touchend', releaseJump);
  window.addEventListener('keydown', function(e){ if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ e.preventDefault(); press(e); }});
  window.addEventListener('keyup', function(e){ if(e.code==='Space'||e.key===' '||e.key==='ArrowUp'){ releaseJump(); }});
  window.addEventListener('resize', function(){ sizeCanvas(); });

  // tap ANYWHERE on the page to jump (click doesn't fire on scroll, so it
  // won't hijack scrolling). Skip links/buttons and the canvas (handled above).
  document.addEventListener('click', function(e){
    if (e.target===cv || (e.target.closest && e.target.closest('a,button,input,textarea,select,label'))) return;
    jump(); releaseJump();
  });

  sizeCanvas();
  checkpoint = 0;
  reset(false);
  reveal(0);
  loop();
})();
</script>
