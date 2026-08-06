---
layout: post
title: I'm a Fucking Adult Yet I Am Learning How to Skate
comments: true
thumbnail: /assets/img/2026-07-21-skate-or-die.png
teaser: "Umur 26 saya baru belajar berdiri di atas papan, sementara adik saya sudah mau menikah. Ceritanya ditulis pakai tinta tak terlihat — cuma muncul kalau kamu ikut meluncur dan tidak nabrak."
---

<style>
#skate-banner{position:sticky;top:0;z-index:50;background:#fbfbf7;border-bottom:2px solid #222;margin:0 0 8px;box-shadow:0 4px 10px rgba(0,0,0,.06);}
#skate-banner canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;}
#skate-banner .bar{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555;padding:4px 10px 6px;font-family:inherit;}
#skate-banner .bar b{color:#111;}
#skate-progress{position:relative;height:4px;background:#e6e6df;}
#skate-progress > i{display:block;height:100%;width:0;background:#222;transition:width .2s;}

/* invisible-ink post body — unearned words are also unselectable */
#ink .w{opacity:0;transition:opacity .5s ease;user-select:none;-webkit-user-select:none;}
#ink .w.on{opacity:1;user-select:auto;-webkit-user-select:auto;}
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

_Umur 26, dan saya baru belajar berdiri di atas papan. Ceritanya ditulis pakai tinta tak terlihat—ia muncul kalau kamu ikut meluncur._

___

### Mei 2026

Saya beli longboard. Sebulan kemudian, saya dapat surfskate gratis. Tidak ada pencerahan, tidak ada film inspiratif sebelumnya. Saya memutuskan ingin bisa, lalu mulai.

Aspal mengajar tanpa kurikulum. Ia tidak peduli jabatanmu, gajimu, atau jumlah tahun yang kamu tulis di CV. Tarifnya lecet di dengkul, dibayar di tempat, tidak menerima transfer.

> _Gravitasi adalah satu-satunya atasan yang tidak pernah bohong soal deadline._

Saya sudah jatuh cukup sering untuk berhenti menganggap jatuh sebagai kabar buruk. Itu bukan filosofi. Itu statistik.

### Kalender

Agustus 2026: surfing. Secara teknis hanya memindahkan tempat jatuh dari beton ke air.

2027: salju Myoko, lalu Hokkaido. Jatuh dalam bahasa Jepang.

Empat medium, satu keterampilan yang sama—berdiri di atas sesuatu yang tidak stabil dan tetap memilih arah. Saya tidak sedang mengumpulkan hobi. Saya sedang memakai badan ini sebelum ia mulai mengajukan syarat dan ketentuan.

### Dua jenis waktu

Adik saya akan menikah. Saya senang, tanpa catatan kaki. Ia memilih jalannya lebih awal dan menjalaninya dengan serius, dan itu pantas dihormati.

Waktu saya berjalan di rute lain: Kyrgyzstan, Kazakhstan, Uzbekistan, China, Nagano. Punggung kuda, jalan tanpa aspal, bahasa yang tidak saya kuasai. Saya tidak melarikan diri dari apa pun. Saya hanya tidak pernah setuju bahwa urutan hidup ditentukan oleh orang-orang yang tidak akan menjalaninya.

Dewasa bukan checklist. Checklist itu formulir. Yang menyamakan keduanya biasanya belum pernah ditanya apa yang dia mau.

### Tidak ada papan skor

Alam semesta tidak menyimpan skor. Tidak ada juri, tidak ada papan peringkat, tidak ada notaris yang mencatat bahwa kamu tepat waktu. Semua ini akan jadi debu di atas batu yang berputar mengelilingi bola gas yang juga akan mati.

Itu bukan alasan untuk menyerah. Itu izin. Kalau memang tidak ada yang mengawasi, tidak ada juga yang berwenang memutuskan bahwa hidup saya salah bentuk.

Jadi saya carve. Saya jatuh. Saya bangun, cek dengkul, lanjut—sampai halaman ini penuh.

Terima kasih sudah ikut meluncur. Kalau nanti kita ketemu di trotoar dan saya jatuh, kamu boleh lihat. Asif, _signing off._ 🛹

</div>

<script>
(function(){
  // ---- reveal setup: wrap every word in the post body into a span ----
  var ink = document.getElementById('ink');
  var words = [], real = [], hidden = [];

  // A hidden word lives in the DOM as an anagram of itself: the real string only
  // ever sits in this closure until the word is earned. Select-all, copy, or the
  // element inspector all get shuffled letters. Same glyphs in the same span, so
  // swapping the real word in never reflows the paragraph.
  function scramble(w){
    if (w.length < 3) return w;
    var a = w.split(''), out = w;
    for (var tries=0; tries<10 && out === w; tries++){
      for (var i=a.length-1;i>0;i--){
        var j = Math.floor(Math.random()*(i+1)), t = a[i]; a[i] = a[j]; a[j] = t;
      }
      out = a.join('');
    }
    return out;
  }

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
            s.className='w';
            real.push(parts[p]); hidden.push(scramble(parts[p]));
            s.textContent = hidden[hidden.length-1];
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
  // a flawless run should take ~20s no matter how long the post gets
  var PER_WORD = Math.max(1, 700 / TOTAL);
  var FINISH = TOTAL * PER_WORD;
  var PENALTY = FINISH * 0.30; // crashing chops 30% of the whole post
  var RAMP_BONUS = PER_WORD * 6; // nailing a ramp launch grants 6 words
  var NOTE_CHUNK = 3; // words per popup — one popup per word machine-guns
  document.getElementById('sk-total').textContent = TOTAL;

  var BEST_KEY = 'ashura_skate_highscore';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch(e){}

  var wordsEl = document.getElementById('sk-words');
  var progEl = document.querySelector('#skate-progress > i');
  function show(i, on){
    if (!!words[i]._on === !!on) return; // already in the right state
    words[i]._on = on;
    words[i].textContent = on ? real[i] : hidden[i];
    if (on) words[i].classList.add('on'); else words[i].classList.remove('on');
  }
  function reveal(score){
    var n = Math.min(TOTAL, Math.floor(score / PER_WORD));
    for (var i=0;i<TOTAL;i++) show(i, i<n);
    wordsEl.textContent = n;
    progEl.style.width = Math.min(100,(score/FINISH)*100)+'%';
    return n;
  }
  function revealAll(){
    for (var i=0;i<TOTAL;i++) show(i, true);
    wordsEl.textContent = TOTAL; progEl.style.width = '100%';
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

  var state = 'ready'; // ready | playing | won | score | scoredead
  var scoreMode = false;
  var player, obstacles, particles, notes, t, speed, spawnT, score, holdBoost, checkpoint, flash, shownWords;

  function reset(keepScore){
    var s = keepScore ? checkpoint : 0;
    player = { x: 70, y: GROUND, vy:0, r:12, rot:0, onGround:true, jumps:0 };
    obstacles = []; particles = []; notes = [];
    t = 0; speed = 4.2; spawnT = 40;
    score = s; holdBoost = 0; flash = 0; shownWords = Math.floor(s / PER_WORD);
  }

  function startScoreMode(){
    scoreMode = true; state = 'score';
    reset(false); revealAll();
    msgEl.textContent = 'Mode skor tertinggi — bertahan selama mungkin!';
  }

  function note(text, color, up){
    notes.push({text:text, color:color, x:player.x+18, y:player.y-player.r-18, vy:up||-0.9, life:52, max:52});
  }

  var GRAV = 0.6, JUMP = -9.2, DOUBLE = -7.8;

  function jump(){
    if (state==='ready'){ state='playing'; msgEl.textContent='Meluncur! Lompati rintangannya.'; return; }
    if (state==='won' || state==='scoredead'){ startScoreMode(); return; }
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
    flash = 22;
    for(var i=0;i<18;i++) spark(player.x,player.y,'#c0392b');
    if (scoreMode){ // endless run ends; record best
      if ((score|0) > best){ best = score|0; try{localStorage.setItem(BEST_KEY, String(best));}catch(e){} }
      state = 'scoredead';
      msgEl.textContent = '💥 Jatuh! Skor: '+(score|0)+' • Terbaik: '+best;
      return;
    }
    var before = Math.floor(score / PER_WORD);
    score = Math.max(0, score - PENALTY); // lose 10 words for crashing
    var lost = before - Math.floor(score / PER_WORD);
    checkpoint = score;
    msgEl.textContent = lost>0 ? ('💥 Nabrak! −'+lost+' kata') : '💥 Nabrak!';
    var px=player.x, py=player.y, pr=player.r;
    reset(true);
    notes.push({text: lost>0 ? ('−'+lost+' kata') : 'Nabrak!', color:'#c0392b', x:px+18, y:py-pr-18, vy:-0.9, life:70, max:70});
    state='playing';
    reveal(score);
  }

  function win(){
    state='won'; score=FINISH; revealAll();
    msgEl.textContent='Selesai! Semua kata terbuka 🎉';
    notes = [];
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

    // ride up ramps instead of passing through them (only while grounded/falling,
    // so an intentional jump still launches off the lip)
    if (player.vy >= 0){
      for (var rr=0;rr<obstacles.length;rr++){ var rp=obstacles[rr];
        if (rp.type==='ramp' && player.x>=rp.x && player.x<=rp.x+rp.w){
          var surf = rp.y - rp.h*((player.x-rp.x)/rp.w);
          if (player.y >= surf){ player.y=surf; player.vy=0; player.onGround=true; player.jumps=0; player.rot=-Math.atan2(rp.h,rp.w); }
        }
      }
    }

    for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=(pt.conf?0.12:0.08); pt.life--; if(pt.life<=0) particles.splice(p,1); }
    for (var q=notes.length-1;q>=0;q--){ var nt=notes[q]; nt.y+=nt.vy; nt.life--; if(nt.life<=0) notes.splice(q,1); }

    score += speed*0.09; // distance skated
    scoreEl.textContent = score|0;
    if (!scoreMode){
      var nowWords = Math.floor(score / PER_WORD);
      var gained = nowWords - shownWords;
      if (gained >= NOTE_CHUNK || (gained > 0 && nowWords >= TOTAL)){
        note('+'+gained+' kata', '#2e7d32'); shownWords = nowWords;
      }
      reveal(score);
      if (score>=FINISH) win();
    }
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
      fit("🛹 I'M A FUCKING ADULT", H*0.15, true); ctx.fillText("🛹 I'M A FUCKING ADULT", W/2, H*0.34);
      fit('yet I am learning how to skate', H*0.11, false); ctx.fillText('yet I am learning how to skate', W/2, H*0.52);
      fit('▶ Tap / Spasi untuk meluncur', H*0.095, false); ctx.fillText('▶ Tap / Spasi untuk meluncur', W/2, H*0.72);
    } else if (state==='won'){
      fit('🎉 SELAMAT!', H*0.2, true); ctx.fillText('🎉 SELAMAT!', W/2, H*0.38);
      fit('Semua kata terbuka — selamat membaca!', H*0.088, false); ctx.fillText('Semua kata terbuka — selamat membaca!', W/2, H*0.55);
      ctx.fillStyle='#e0a800'; fit('🏆 Tap untuk MODE SKOR TERTINGGI', H*0.088, true); ctx.fillText('🏆 Tap untuk MODE SKOR TERTINGGI', W/2, H*0.7);
    } else if (state==='scoredead'){
      ctx.fillStyle='#c0392b'; fit('💥 JATUH!', H*0.2, true); ctx.fillText('💥 JATUH!', W/2, H*0.38);
      ctx.fillStyle='#222'; fit('Skor: '+(score|0)+'  •  Terbaik: '+best, H*0.1, false); ctx.fillText('Skor: '+(score|0)+'  •  Terbaik: '+best, W/2, H*0.56);
      fit('Tap untuk coba lagi', H*0.09, false); ctx.fillText('Tap untuk coba lagi', W/2, H*0.7);
    }
    ctx.textAlign='left';
  }

  function loop(){
    if (state==='playing' || state==='score') update();
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
