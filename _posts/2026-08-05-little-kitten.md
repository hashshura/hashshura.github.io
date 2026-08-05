---
layout: post
title: Little Kitten
comments: true
thumbnail: /assets/img/2026-08-05-little-kitten.png
teaser: "Saya suka kucing dan tidak pernah berhasil memelihara satu pun — pernah hampir membunuh satu pakai segelas susu sapi. Ceritanya cuma muncul kalau kamu mau menyuapi kucing di atas dulu."
---

<style>
#kitten-banner{position:sticky;top:0;z-index:50;background:#fbfbf7;border-bottom:2px solid #222;margin:0 0 8px;box-shadow:0 4px 10px rgba(0,0,0,.06);}
#kitten-banner canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;}
#kitten-banner .bar{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#555;padding:4px 10px 6px;font-family:inherit;}
#kitten-banner .bar b{color:#111;}
#kitten-progress{position:relative;height:4px;background:#e6e6df;}
#kitten-progress > i{display:block;height:100%;width:0;background:#222;transition:width .2s;}

/* invisible-ink post body */
#ink .w{opacity:0;transition:opacity .5s ease;}
#ink .w.on{opacity:1;}
#ink{min-height:40vh;}
</style>

<div id="kitten-banner">
  <canvas id="kitten-canvas" width="720" height="340"></canvas>
  <div id="kitten-progress"><i></i></div>
  <div class="bar">
    <span>🐱 <b id="kt-words">0</b> / <b id="kt-total">0</b> kata terbuka</span>
    <span id="kt-msg">Tap makanannya untuk mulai</span>
    <span>Skor: <b id="kt-score">0</b></span>
  </div>
</div>

<div id="ink" markdown="1">

_Saya suka kucing. Saya belum pernah berhasil memelihara satu pun. Dua kalimat itu tinggal bertahun-tahun di kepala saya tanpa pernah saling menyapa._

___

### Susu sapi

SD. Satu anak kucing, satu anak manusia, dan niat baik tanpa ilmu.

Saya kasih dia susu sapi—susu kotak yang saya sendiri minum. Logikanya masuk akal untuk anak sembilan tahun: kucing suka susu.

Kucing dewasa tidak bisa mencerna laktosa. Saya baru tahu itu belasan tahun kemudian.

Diare. Lalu kalimat yang menutup perkara:

> _"Kayaknya kamu belum bisa pelihara kucing."_

Keluarga saya tidak salah. Kucing itu diberikan ke orang lain, dan saya dapat pelajaran pertama tentang mencintai sesuatu: niat baik yang tidak diverifikasi adalah cokelat dalam bentuk lain. Manis di tangan yang memberi, racun di perut yang menerima.

Cokelat di game di atas bukan metafora yang saya karang. Saya pernah jadi pemain yang mengkliknya, dan waktu itu tidak ada tap-untuk-lanjut.

### Satu ibu, empat anak

Belasan tahun kemudian. Kuliah, bab terakhir, periode ketika seseorang bisa duduk delapan jam di depan laptop, menghasilkan nol paragraf, dan tetap merasa habis.

Di depan rumah tinggal kucing liar: satu ibu, empat anak. Mereka tidak tahu apa itu tugas akhir, dan itu bagian terbaiknya. Mereka datang setiap hari, minta dielus, tidur di atas sandal, memperlakukan saya sebagai furnitur hangat yang bisa bergerak.

Saya lebih rajin menemui mereka daripada membuka dokumen skripsi. Prioritas itu tidak pernah saya sesali.

Lalu mereka naik ke plafon. Tengah malam, empat kucing kecil menggelar pertunjukan di atas kepala seisi rumah—gratis, tanpa diminta. Tetangga punya pendapat lain soal seni.

Saya tidak pernah jadi pemilik mereka. Selama beberapa bulan saya cuma orang yang mereka datangi. Ternyata itu bentuk hubungan yang lebih jujur: tidak ada yang dimiliki, tidak ada yang dijanjikan, dan mereka tetap datang.

### Yang tidak dicatat siapa pun

Kucing tidak punya rencana lima tahun. Tidak menabung. Tidak peduli IPK, tidak peduli promosi, dan tidak akan datang ke pemakaman saya. Mereka makan, tidur, jatuh dari tempat tinggi dengan gaya, lalu mengulanginya besok tanpa rasa malu.

Tidak ada yang mencatat apa pun. Susu sapi itu tidak bisa saya tarik kembali. Kucing-kucing di plafon itu tidak mengingat nama saya, dan tidak perlu.

Justru karena itu urusannya jadi sederhana: kasih makan yang lapar hari ini. Bukan untuk pahala, bukan untuk cerita. Sepuluh menit dielus, bagi seekor kucing kecil, sudah seluruh dunia—dan dunia itu tidak butuh dicatat siapa pun untuk jadi nyata.

Terima kasih sudah menyuapinya sampai kenyang. Kalau hari ini kamu ketemu kucing liar: jangan kasih susu sapi. Kasih air. Kasih waktu. Asif, _signing off._ 🐾

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
  var FOOD_SCORE = 55;        // score per bite
  var TARGET_BITES = 28;      // a clean run ≈ 28 bites, however long the post gets
  var PER_WORD = Math.max(1.5, FOOD_SCORE * TARGET_BITES / TOTAL);
  var GROW_STEPS = 10;        // kitten reaches full size after 10 bites
  var STARVE_COST = 12 * PER_WORD;  // dying of hunger costs 12 words
  var POISON_COST = 30 * PER_WORD;  // chocolate costs more — it was your choice
  var FINISH = TOTAL * PER_WORD;
  document.getElementById('kt-total').textContent = TOTAL;

  var BEST_KEY = 'ashura_kitten_highscore';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch(e){}

  var wordsEl = document.getElementById('kt-words');
  var progEl = document.querySelector('#kitten-progress > i');
  function reveal(score){
    var n = Math.min(TOTAL, Math.floor(score / PER_WORD));
    for (var i=0;i<TOTAL;i++){
      if (i<n) words[i].classList.add('on'); else words[i].classList.remove('on');
    }
    wordsEl.textContent = n;
    progEl.style.width = Math.min(100,(score/FINISH)*100)+'%';
    return n;
  }
  function revealAll(){
    for (var i=0;i<TOTAL;i++) words[i].classList.add('on');
    wordsEl.textContent = TOTAL; progEl.style.width = '100%';
  }

  // ---- the game (white paper, doodle ink) ----
  var cv = document.getElementById('kitten-canvas');
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var scoreEl = document.getElementById('kt-score');
  var msgEl = document.getElementById('kt-msg');

  var R_MIN = 9, R_MAX = 26;
  var state = 'ready'; // ready | playing | dead | won | score | scoredead
  var scoreMode = false;
  var cat, items, particles, notes, tufts;
  var t, spawnT, score, checkpoint, flash, shownWords, shownStep, deathMsg;

  function areaTop(){ return H*0.30; }
  function areaBottom(){ return H-14; }

  function sizeCanvas(){
    var cssW = cv.clientWidth || cv.parentElement.clientWidth || 720;
    // roomy yard, but capped so the sticky banner never eats the whole viewport
    var h = Math.max(240, Math.min(380, cssW*0.5));
    cv.width = W = Math.round(cssW);
    cv.height = H = Math.round(h);
    makeTufts();
    if (cat){ cat.x=clamp(cat.x,20,W-20); cat.y=clamp(cat.y,areaTop(),areaBottom()); }
    if (items) for (var i=0;i<items.length;i++){
      items[i].x = clamp(items[i].x, 24, W-24);
      items[i].y = clamp(items[i].y, areaTop()+8, areaBottom()-4);
    }
  }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  // grass tufts are decoration only — fixed per size so they don't flicker
  function makeTufts(){
    tufts = [];
    for (var i=0;i<26;i++){
      var s = Math.sin(i*12.9898)*43758.5453; s -= Math.floor(s);
      var s2 = Math.sin(i*78.233)*43758.5453; s2 -= Math.floor(s2);
      tufts.push({x: s*W, y: areaTop()+s2*(areaBottom()-areaTop()), s: 3+s2*3});
    }
  }

  function catRadius(){
    if (scoreMode) return R_MAX;
    var f = Math.min(1, score / (GROW_STEPS*FOOD_SCORE));
    return R_MIN + (R_MAX-R_MIN)*f;
  }
  function growStep(){
    return Math.floor(Math.min(1, score/(GROW_STEPS*FOOD_SCORE))*GROW_STEPS);
  }
  function level(){ // difficulty driver
    if (scoreMode) return 8 + t/420;
    return score / FOOD_SCORE;
  }
  function foodLife(){ return Math.max(120, 230 - level()*7); }        // frames the food waits
  function spawnGap(){ return Math.max(26, 60 - level()*2.2); }        // frames between spawns
  function catSpeed(){ return Math.min(9, 4.8 + level()*0.22) * Math.max(0.6, Math.min(1, W/620)); }
  function pPoison(){ return Math.min(0.34, 0.05 + level()*0.032); }   // chocolate instead of food
  function pExtra(){ return level()>=6 ? Math.min(0.4, 0.16+level()*0.02) : 0; } // chocolate alongside food

  function reset(keepScore){
    score = keepScore ? checkpoint : 0;
    cat = { x: W*0.5, y: (areaTop()+areaBottom())/2, tx: null, ty: null,
            dir: 1, step: 0, blink: 0, pulse: 0, target: null, locked: false };
    items = []; particles = []; notes = [];
    t = 0; spawnT = 26; flash = 0;
    shownWords = Math.floor(score / PER_WORD); shownStep = growStep();
  }

  function startScoreMode(){
    scoreMode = true; state = 'score';
    reset(false); revealAll();
    msgEl.textContent = 'Mode skor tertinggi — kenyangkan dia selama mungkin!';
  }

  function note(text, color, up){
    notes.push({text:text, color:color, x:cat.x, y:cat.y-catRadius()-16, vy:up||-0.9, life:56, max:56});
  }
  function spark(x,y,c){ particles.push({x:x,y:y,vx:Math.random()*3-1.5,vy:Math.random()*3-1.5,life:16,s:2,c:c||'#222'}); }

  // ---- spawning ----
  function spawnPos(minFromCat){
    var pad = 26, top = areaTop()+10, bot = areaBottom()-6;
    for (var tries=0; tries<40; tries++){
      var x = pad + Math.random()*(W-pad*2);
      var y = top + Math.random()*(bot-top);
      if (Math.hypot(x-cat.x, y-cat.y) < minFromCat) continue;
      var clash = false;
      for (var i=0;i<items.length;i++) if (Math.hypot(x-items[i].x, y-items[i].y) < 54) { clash=true; break; }
      if (!clash) return {x:x,y:y};
    }
    return {x: pad+Math.random()*(W-pad*2), y: top+Math.random()*(bot-top)};
  }
  function addItem(type){
    var p = spawnPos(type==='food' ? 70 : 40);
    items.push({type:type, x:p.x, y:p.y, r:14, kind:Math.floor(Math.random()*3),
                life:foodLife(), max:foodLife(), bob:Math.random()*6});
  }
  function hasFood(){
    for (var i=0;i<items.length;i++) if (items[i].type==='food') return true;
    return false;
  }
  function spawnRound(){
    if (Math.random() < pPoison()){ addItem('choco'); return; } // a round with nothing safe: just wait
    addItem('food');
    if (Math.random() < pExtra()) addItem('choco');
  }

  // ---- eating, dying, winning ----
  function eat(it){
    cat.pulse = 14;
    for (var i=0;i<14;i++) spark(it.x, it.y, '#2e7d32');
    items.splice(items.indexOf(it),1);
    cat.target = null; cat.locked = false; cat.tx = null; cat.ty = null;
    score += FOOD_SCORE;
    spawnT = spawnGap();
    if (!scoreMode){
      var st = growStep();
      if (st > shownStep){ shownStep = st; note('Tumbuh! 🐱', '#e0a800', -1.2); }
    }
  }

  function poisoned(it){
    items.splice(items.indexOf(it),1);
    flash = 26;
    for (var i=0;i<26;i++) spark(cat.x, cat.y-catRadius(), '#6b4423');
    die('choco');
  }

  function starve(){
    flash = 22;
    for (var i=0;i<14;i++) spark(cat.x, cat.y-catRadius(), '#c0392b');
    die('hunger');
  }

  function die(cause){
    if (scoreMode){
      if ((score|0) > best){ best = score|0; try{ localStorage.setItem(BEST_KEY, String(best)); }catch(e){} }
      state = 'scoredead';
      deathMsg = cause==='choco' ? '🍫 Cokelat! Kucingnya keracunan' : '😿 Telat! Kucingnya kelaparan';
      msgEl.textContent = deathMsg + ' • Skor: '+(score|0)+' • Terbaik: '+best;
      return;
    }
    var before = Math.floor(score / PER_WORD);
    score = Math.max(0, score - (cause==='choco' ? POISON_COST : STARVE_COST));
    var lost = before - Math.floor(score / PER_WORD);
    checkpoint = score;
    deathMsg = cause==='choco' ? '🍫 Cokelat itu racun!' : '😿 Makanannya hilang!';
    msgEl.textContent = deathMsg + (lost>0 ? ' −'+lost+' kata' : '');
    state = 'dead';
    reveal(score);
  }

  function win(){
    state='won'; score=FINISH; revealAll();
    msgEl.textContent='Kenyang! Semua kata terbuka 🎉';
    notes = [];
    for(var i=0;i<50;i++) particles.push({x:W/2+(Math.random()*W*0.4-W*0.2),y:H*0.4,
      vx:Math.random()*6-3,vy:Math.random()*-4-1,life:60,s:3,conf:true,c:'#222'});
  }

  // ---- input ----
  function canvasPoint(e){
    var r = cv.getBoundingClientRect();
    var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (cv.width / r.width),
             y: (p.clientY - r.top) * (cv.height / r.height) };
  }
  function tap(e){
    if (e && e.type!=='keydown') e.preventDefault();
    if (state==='ready'){ state='playing'; msgEl.textContent='Klik makanannya, jangan sampai hilang!'; return; }
    if (state==='dead'){ reset(true); state='playing'; msgEl.textContent='Ayo lagi — jangan telat!'; reveal(score); return; }
    if (state==='won' || state==='scoredead'){ startScoreMode(); return; }
    if (state!=='playing' && state!=='score') return;
    if (!e || e.type==='keydown') return;
    var p = canvasPoint(e);
    if (cat.locked) return; // already committed to a chocolate — no take-backs
    // did we tap an item? (generous hit radius for fingers)
    for (var i=0;i<items.length;i++){
      var it = items[i];
      if (Math.hypot(p.x-it.x, p.y-it.y) < it.r+16){
        cat.target = it; cat.tx = it.x; cat.ty = it.y;
        if (it.type==='choco'){ cat.locked = true; msgEl.textContent='🍫 Jangan…!'; }
        return;
      }
    }
    // empty ground: just walk there (handy for camping where food might appear)
    cat.target = null; cat.tx = clamp(p.x,16,W-16); cat.ty = clamp(p.y,areaTop(),areaBottom());
  }

  // ---- update ----
  function update(){
    t++;
    if (flash>0) flash--;
    if (cat.pulse>0) cat.pulse--;
    cat.blink = (cat.blink+1) % 200;

    // walk toward the target
    if (cat.tx!=null){
      if (cat.target){ cat.tx = cat.target.x; cat.ty = cat.target.y; }
      var dx = cat.tx-cat.x, dy = cat.ty-cat.y, d = Math.hypot(dx,dy);
      var sp = catSpeed();
      if (d > 1.5){
        if (Math.abs(dx) > 2) cat.dir = dx>0 ? 1 : -1;
        cat.x += dx/d*Math.min(sp,d); cat.y += dy/d*Math.min(sp,d);
        cat.step += 0.25;
      } else { cat.tx = cat.ty = null; }
    }

    // reached the food (or the chocolate)?
    if (cat.target){
      var it = cat.target;
      if (Math.hypot(it.x-cat.x, it.y-cat.y) < catRadius()+it.r*0.8){
        if (it.type==='food') eat(it); else { poisoned(it); return; }
      }
    }

    // item timers
    for (var i=items.length-1;i>=0;i--){
      var o = items[i]; o.life--; o.bob += 0.08;
      if (o.life<=0){
        var wasFood = o.type==='food';
        if (cat.target===o){ cat.target=null; cat.locked=false; cat.tx=cat.ty=null; }
        items.splice(i,1);
        if (wasFood){ starve(); return; }   // chocolate expiring is a relief, not a loss
        spawnT = Math.min(spawnT, 18);
      }
    }

    // spawn the next round once no food is on the table
    if (!hasFood()){
      spawnT--;
      if (spawnT<=0){ spawnRound(); spawnT = spawnGap(); }
    }

    for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=(pt.conf?0.12:0.06); pt.life--; if(pt.life<=0) particles.splice(p,1); }
    for (var q=notes.length-1;q>=0;q--){ var nt=notes[q]; nt.y+=nt.vy; nt.life--; if(nt.life<=0) notes.splice(q,1); }

    scoreEl.textContent = score|0;
    if (!scoreMode){
      var nowWords = Math.floor(score / PER_WORD);
      if (nowWords > shownWords){ note('+'+(nowWords-shownWords)+' kata', '#2e7d32'); shownWords = nowWords; }
      reveal(score);
      if (score>=FINISH) win();
    }
  }

  // ---- drawing ----
  function ink2(){ ctx.strokeStyle='#222'; ctx.fillStyle='#222'; ctx.lineWidth=2.2; ctx.lineJoin='round'; ctx.lineCap='round'; }

  function drawCat(){
    var r = catRadius();
    var bounce = (cat.tx!=null) ? Math.abs(Math.sin(cat.step))*2 : Math.sin(t*0.05)*0.8;
    var pop = cat.pulse>0 ? 1 + cat.pulse/60 : 1;
    ctx.save();
    ctx.translate(cat.x, cat.y - bounce);
    ctx.scale(cat.dir*pop, pop);
    ink2();

    // body
    ctx.beginPath();
    ctx.ellipse(-r*0.15, -r*0.42, r*0.78, r*0.5, 0, 0, 7);
    ctx.stroke();
    // legs
    var sw = (cat.tx!=null) ? Math.sin(cat.step)*r*0.16 : 0;
    ctx.beginPath();
    ctx.moveTo(-r*0.55, -r*0.1); ctx.lineTo(-r*0.55+sw, 0);
    ctx.moveTo(r*0.2, -r*0.1);  ctx.lineTo(r*0.2-sw, 0);
    ctx.stroke();
    // tail — wags while walking
    var wag = Math.sin(t*0.12)*r*0.25;
    ctx.beginPath();
    ctx.moveTo(-r*0.85, -r*0.5);
    ctx.quadraticCurveTo(-r*1.5, -r*0.75-wag, -r*1.25, -r*1.35-wag*0.5);
    ctx.stroke();
    // head
    var hx = r*0.62, hy = -r*0.95;
    ctx.beginPath(); ctx.arc(hx, hy, r*0.5, 0, 7); ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(hx-r*0.42, hy-r*0.28); ctx.lineTo(hx-r*0.34, hy-r*0.72); ctx.lineTo(hx-r*0.05, hy-r*0.45);
    ctx.moveTo(hx+r*0.14, hy-r*0.46); ctx.lineTo(hx+r*0.42, hy-r*0.7); ctx.lineTo(hx+r*0.46, hy-r*0.24);
    ctx.stroke();
    // eyes (blink now and then) + nose + whiskers
    if (cat.blink > 6){
      ctx.beginPath();
      ctx.arc(hx-r*0.14, hy-r*0.06, Math.max(1.1,r*0.055), 0, 7);
      ctx.arc(hx+r*0.2,  hy-r*0.06, Math.max(1.1,r*0.055), 0, 7);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(hx-r*0.22, hy-r*0.06); ctx.lineTo(hx-r*0.06, hy-r*0.06);
      ctx.moveTo(hx+r*0.12, hy-r*0.06); ctx.lineTo(hx+r*0.28, hy-r*0.06);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(hx+r*0.03, hy+r*0.14); ctx.lineTo(hx+r*0.1, hy+r*0.2);
    ctx.moveTo(hx+r*0.28, hy+r*0.06); ctx.lineTo(hx+r*0.62, hy-r*0.02);
    ctx.moveTo(hx+r*0.28, hy+r*0.16); ctx.lineTo(hx+r*0.6,  hy+r*0.22);
    ctx.stroke();
    ctx.restore();
  }

  function drawTimerRing(o){
    var frac = Math.max(0, o.life/o.max);
    ctx.save();
    ctx.lineWidth = 2.6; ctx.lineCap='butt';
    ctx.strokeStyle = '#e6e6df';
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r+9, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = o.type==='choco' ? '#6b4423' : (frac<0.3 ? '#c0392b' : '#2e7d32');
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r+9, -Math.PI/2, -Math.PI/2 + Math.PI*2*frac); ctx.stroke();
    ctx.restore();
  }

  function drawItem(o){
    var y = o.y + Math.sin(o.bob)*1.6;
    drawTimerRing(o);
    ink2();
    if (o.type==='choco'){
      ctx.strokeStyle = '#6b4423'; ctx.fillStyle='#6b4423';
      ctx.strokeRect(o.x-13, y-9, 26, 18);
      ctx.beginPath();
      ctx.moveTo(o.x-13, y); ctx.lineTo(o.x+13, y);
      ctx.moveTo(o.x-4.5, y-9); ctx.lineTo(o.x-4.5, y+9);
      ctx.moveTo(o.x+4.5, y-9); ctx.lineTo(o.x+4.5, y+9);
      ctx.stroke();
      ctx.textAlign='center'; ctx.font='bold '+Math.round(H*0.055)+'px sans-serif';
      ctx.fillText('☠', o.x, y-16); ctx.textAlign='left';
      return;
    }
    if (o.kind===0){ // fish
      ctx.beginPath();
      ctx.moveTo(o.x-12, y); ctx.quadraticCurveTo(o.x-2, y-9, o.x+8, y);
      ctx.quadraticCurveTo(o.x-2, y+9, o.x-12, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x+8, y); ctx.lineTo(o.x+15, y-6); ctx.lineTo(o.x+15, y+6); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(o.x-7, y-2, 1.3, 0, 7); ctx.fill();
    } else if (o.kind===1){ // bowl of milk
      ctx.beginPath();
      ctx.moveTo(o.x-13, y-4); ctx.lineTo(o.x-9, y+8); ctx.lineTo(o.x+9, y+8); ctx.lineTo(o.x+13, y-4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x-13, y-4); ctx.quadraticCurveTo(o.x-6, y-1, o.x, y-4);
      ctx.quadraticCurveTo(o.x+6, y-7, o.x+13, y-4); ctx.stroke();
    } else { // a little pile of kibble
      ctx.beginPath(); ctx.arc(o.x-6, y+3, 4.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(o.x+5, y+3, 4.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(o.x, y-5, 4.5, 0, 7); ctx.stroke();
    }
  }

  function draw(){
    ctx.fillStyle = '#fbfbf7';
    ctx.fillRect(0,0,W,H);
    ink2();

    // yard: a doodled horizon line plus scattered grass
    var top = areaTop();
    ctx.beginPath();
    for (var gx=0; gx<=W; gx+=14){ var gy=top+Math.sin(gx*0.05)*1.6; if(gx===0) ctx.moveTo(gx,gy); else ctx.lineTo(gx,gy); }
    ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.lineWidth = 1.6;
    for (var i=0;i<tufts.length;i++){
      var tf = tufts[i];
      ctx.beginPath();
      ctx.moveTo(tf.x-tf.s, tf.y); ctx.lineTo(tf.x-tf.s*0.4, tf.y-tf.s);
      ctx.moveTo(tf.x, tf.y); ctx.lineTo(tf.x, tf.y-tf.s*1.3);
      ctx.moveTo(tf.x+tf.s, tf.y); ctx.lineTo(tf.x+tf.s*0.4, tf.y-tf.s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (var k=0;k<items.length;k++) drawItem(items[k]);

    for (var p=0;p<particles.length;p++){
      var pt=particles[p];
      ctx.fillStyle = pt.c || '#222';
      ctx.globalAlpha = Math.max(0, pt.life/(pt.conf?60:16));
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;

    drawCat();

    // floating notifications (+N kata / Tumbuh!)
    ctx.textAlign='center';
    for (var q=0;q<notes.length;q++){
      var nt=notes[q];
      ctx.globalAlpha=Math.max(0,Math.min(1, nt.life/nt.max*1.4));
      ctx.fillStyle=nt.color;
      ctx.font='bold '+Math.round(H*0.07)+'px sans-serif';
      ctx.fillText(nt.text, nt.x, nt.y);
    }
    ctx.globalAlpha=1; ctx.textAlign='left';

    // soft red blip on death — a fade, never a harsh strobe
    if (flash>0){
      ctx.globalAlpha=(flash/26)*0.2;
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
    function line(text, px, bold, y, color){
      ctx.fillStyle = color || '#222';
      fit(text, px, bold); ctx.fillText(text, W/2, y);
    }
    if (state==='ready'){
      line('🐱 LITTLE KITTEN', H*0.16, true, H*0.4);
      line('Klik makanan → kucingnya makan & tumbuh', H*0.075, false, H*0.56);
      line('🍫 Jangan pernah klik cokelat!', H*0.075, true, H*0.68, '#6b4423');
      line('▶ Tap untuk mulai', H*0.085, false, H*0.82);
    } else if (state==='dead'){
      line(deathMsg, H*0.13, true, H*0.4, '#c0392b');
      line('Tap untuk lanjut menyuapi', H*0.085, false, H*0.58);
    } else if (state==='won'){
      line('🎉 KENYANG!', H*0.18, true, H*0.36);
      line('Semua kata terbuka — selamat membaca!', H*0.08, false, H*0.53);
      line('🏆 Tap untuk MODE SKOR TERTINGGI', H*0.08, true, H*0.68, '#e0a800');
    } else if (state==='scoredead'){
      line(deathMsg, H*0.13, true, H*0.36, '#c0392b');
      line('Skor: '+(score|0)+'  •  Terbaik: '+best, H*0.09, false, H*0.54);
      line('Tap untuk coba lagi', H*0.08, false, H*0.68);
    }
    ctx.textAlign='left';
  }

  function loop(){
    if (state==='playing' || state==='score') update();
    else {
      for (var p=particles.length-1;p>=0;p--){ var pt=particles[p]; pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=(pt.conf?0.12:0.06); pt.life--; if(pt.life<=0) particles.splice(p,1); }
      for (var q=notes.length-1;q>=0;q--){ var nt=notes[q]; nt.y+=nt.vy; nt.life--; if(nt.life<=0) notes.splice(q,1); }
    }
    draw();
    requestAnimationFrame(loop);
  }

  cv.addEventListener('mousedown', tap);
  cv.addEventListener('touchstart', tap, {passive:false});
  window.addEventListener('resize', function(){ sizeCanvas(); });
  // space/enter only advances the non-playing screens; feeding needs a real aim
  window.addEventListener('keydown', function(e){
    if (e.code==='Space' || e.key===' ' || e.key==='Enter'){
      if (state==='playing' || state==='score') return;
      e.preventDefault(); tap(e);
    }
  });

  sizeCanvas();
  checkpoint = 0;
  reset(false);
  reveal(0);
  loop();
})();
</script>
