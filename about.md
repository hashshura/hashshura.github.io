---
layout: page
title: About
---

<style>
.toy{margin:1.4rem auto 1.1rem;max-width:460px;}
.toy canvas{display:block;width:100%;height:auto;background:#fbfbf7;border:1.5px dashed #dcdcd2;border-radius:10px;cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none;}
.toy .hint{text-align:center;font-size:11px;color:#aaa;margin-top:3px;transition:opacity .4s;}
.toy.touched .hint{opacity:0;}
</style>

Halo, kamu yang di sana!

> _Iya, kamu. Siapa lagi?_ 😊

Salam kenal, saya adalah orang paling keren sedunia, Asif Hummam Rais.

Nama itu dipendekkan jadi Ashura. Dari situ, semuanya jadi agak aneh.

<div class="toy" data-toy="empatdua" data-h="230"></div>

Sisanya bukan angka, cuma keterangan tambahan.

<div class="toy" data-toy="fakta" data-h="230"></div>

<script>
(function(){
  var INK = '#222', PAPER = '#fbfbf7', MUTED = '#8a8a80', BLUE = '#3b7ea1', GOLD = '#e0a800';

  function ink(ctx, w){ ctx.strokeStyle=INK; ctx.fillStyle=INK; ctx.lineWidth=w||2.2; ctx.lineJoin='round'; ctx.lineCap='round'; }
  function txt(ctx, s, x, y, size, color, bold, maxW){
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = color || MUTED;
    var px = size || 13, pre = bold ? 'bold ' : '';
    ctx.font = pre + px + 'px sans-serif';
    if (maxW) while (px > 8 && ctx.measureText(s).width > maxW){ px--; ctx.font = pre + px + 'px sans-serif'; }
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function rr(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);        ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);      ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);        ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.stroke();
  }
  function arrowDown(ctx, x, y1, y2){
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    ctx.moveTo(x-5, y2-6); ctx.lineTo(x, y2); ctx.lineTo(x+5, y2-6);
    ctx.stroke();
  }
  function sparkle(ctx, x, y, r){
    ctx.beginPath();
    ctx.moveTo(x-r, y); ctx.lineTo(x+r, y);
    ctx.moveTo(x, y-r); ctx.lineTo(x, y+r);
    ctx.stroke();
  }
  // progress dots: filled = already seen
  function dots(ctx, W, H, n, at, seen){
    var gap = 13, x0 = W/2 - (n-1)*gap/2;
    for (var i=0;i<n;i++){
      ctx.beginPath();
      ctx.arc(x0 + i*gap, H-13, i===at ? 3.4 : 2.6, 0, 7);
      ctx.strokeStyle = '#c9c9bf'; ctx.lineWidth = 1.6;
      if (i===at){ ctx.fillStyle = INK; ctx.fill(); }
      else if (seen && seen[i]){ ctx.fillStyle = '#c9c9bf'; ctx.fill(); }
      else ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- toys ----
  var TOYS = {};

  // 1. every road leads back to 42
  var CARDS42 = [
    {
      title: 'Nama',
      note: ['Yang panjang tinggal di dokumen resmi.'],
      art: function(ctx, W, H){
        ink(ctx);
        txt(ctx, 'ASIF HUMMAM RAIS', W/2, 76, 17, INK, true, W*0.8);
        arrowDown(ctx, W/2, 92, 116);
        txt(ctx, 'ASHURA', W/2, 154, 34, INK, true, W*0.7);
      }
    },
    {
      title: 'Asy-Syura',
      note: ['Surat ke-42 di Al-Qur’an.', 'Angkanya sudah menempel dari awal.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 108;
        ink(ctx);
        // an open book
        ctx.beginPath();
        ctx.moveTo(cx-72, cy+26); ctx.quadraticCurveTo(cx-36, cy+14, cx, cy+22);
        ctx.quadraticCurveTo(cx+36, cy+14, cx+72, cy+26);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-72, cy+26); ctx.quadraticCurveTo(cx-64, cy-30, cx, cy-16);
        ctx.quadraticCurveTo(cx+64, cy-30, cx+72, cy+26);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy-16); ctx.lineTo(cx, cy+22); ctx.stroke();
        ctx.lineWidth = 1.5;
        for (var i=0;i<3;i++){
          ctx.beginPath();
          ctx.moveTo(cx-58, cy-4+i*10); ctx.lineTo(cx-14, cy-8+i*10); ctx.stroke();
        }
        txt(ctx, '42', cx+38, cy+14, 26, INK, true);
      }
    },
    {
      title: 'the answer to life, the universe, and everything',
      note: ['Ketik itu di Google. Dia menjawab tanpa basa-basi.'],
      art: function(ctx, W, H){
        var bw = Math.min(300, W-60), bx = W/2 - bw/2, by = 74;
        ink(ctx, 2);
        rr(ctx, bx, by, bw, 34, 17);
        ctx.beginPath(); ctx.arc(bx+22, by+17, 6.5, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx+27, by+22); ctx.lineTo(bx+33, by+28); ctx.stroke();
        txt(ctx, 'the answer to life, the universe…', bx + bw/2 + 12, by+21, 11, MUTED, false, bw-60);
        arrowDown(ctx, W/2, by+44, by+62);
        txt(ctx, '42', W/2, 168, 32, INK, true);
      }
    },
    {
      title: 'Tanggal lahir',
      note: ['Semua angkanya dijumlahkan. Hasilnya itu lagi.'],
      art: function(ctx, W, H){
        var n = 8, bw = 18, gap = 12, tot = n*bw + (n-1)*gap;
        var x0 = W/2 - tot/2, y = 84;
        ink(ctx, 1.9);
        for (var i=0;i<n;i++){
          var x = x0 + i*(bw+gap);
          ctx.strokeRect(x, y, bw, bw);
          if (i < n-1){
            ctx.beginPath();
            ctx.moveTo(x+bw+gap/2-4, y+bw/2); ctx.lineTo(x+bw+gap/2+4, y+bw/2);
            ctx.moveTo(x+bw+gap/2, y+bw/2-4); ctx.lineTo(x+bw+gap/2, y+bw/2+4);
            ctx.stroke();
          }
        }
        txt(ctx, '= 42', W/2, 152, 30, INK, true);
      }
    },
    {
      title: 'Ganteng',
      note: ['Satu-satunya di daftar ini yang tidak bisa diverifikasi.'],
      art: function(ctx, W, H){
        var cx = W/2 - 26, cy = 106;
        ink(ctx);
        // mirror on a stand
        ctx.beginPath(); ctx.ellipse(cx, cy, 30, 38, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy+38); ctx.lineTo(cx, cy+52);
        ctx.moveTo(cx-14, cy+52); ctx.lineTo(cx+14, cy+52);
        ctx.stroke();
        // the face in it
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(cx, cy-4, 15, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx-5, cy-8, 1.6, 0, 7); ctx.arc(cx+5, cy-8, 1.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy-5, 7, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
        ink(ctx, 1.7); ctx.strokeStyle = GOLD;
        sparkle(ctx, cx+34, cy-30, 6); sparkle(ctx, cx-36, cy+16, 5);
        txt(ctx, '42/42', W/2 + 62, cy+6, 24, INK, true);
      }
    },
    {
      title: 'Lima kebetulan',
      note: ['Semesta tidak sedang mengirim pesan.', 'Tapi angkanya bagus, jadi saya simpan.'],
      art: function(ctx, W, H, t){
        var cx = W/2, cy = 112;
        ink(ctx, 1.8); ctx.strokeStyle = GOLD;
        for (var i=0;i<8;i++){
          var a = i*Math.PI/4 + t*0.004;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a)*54, cy + Math.sin(a)*40);
          ctx.lineTo(cx + Math.cos(a)*66, cy + Math.sin(a)*50);
          ctx.stroke();
        }
        txt(ctx, '42', cx, cy + 22, 66, INK, true);
      }
    }
  ];

  TOYS.empatdua = {
    init: function(){ return { i:0, seen:[true], t:0, enter:0 }; },
    click: function(s){
      s.i = (s.i + 1) % CARDS42.length;
      s.seen[s.i] = true; s.enter = 12;
    },
    tick: function(s){ s.t++; if (s.enter>0) s.enter--; },
    draw: function(ctx, W, H, s){
      var c = CARDS42[s.i];
      ctx.save();
      if (s.enter>0){ ctx.globalAlpha = 1 - s.enter/14; ctx.translate(0, s.enter*0.8); }
      txt(ctx, c.title, W/2, 28, 14, INK, true, W*0.9);
      c.art(ctx, W, H, s.t);
      for (var i=0;i<c.note.length;i++) txt(ctx, c.note[i], W/2, H-46+i*16, 12, MUTED, false, W*0.9);
      ctx.restore();
      dots(ctx, W, H, CARDS42.length, s.i, s.seen);
    }
  };

  // 2. the rest of me, in no particular order
  var FACTS = [
    {
      title: 'Immortal di Dota 2',
      note: ['Lencana yang dibayar pakai ribuan jam', 'yang tidak akan pernah saya minta kembali.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 106;
        ink(ctx);
        // a badge/shield
        ctx.beginPath();
        ctx.moveTo(cx-30, cy-34); ctx.lineTo(cx+30, cy-34); ctx.lineTo(cx+30, cy+8);
        ctx.quadraticCurveTo(cx+30, cy+34, cx, cy+44);
        ctx.quadraticCurveTo(cx-30, cy+34, cx-30, cy+8);
        ctx.closePath(); ctx.stroke();
        // star inside
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var i=0;i<5;i++){
          var a = -Math.PI/2 + i*Math.PI*4/5;
          var x = cx + Math.cos(a)*15, y = cy - 2 + Math.sin(a)*15;
          if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath(); ctx.stroke();
      }
    },
    {
      title: 'Gitar, kalimba, otamatone',
      note: ['Dua alat musik, dan satu alat', 'untuk menguji kesabaran orang di rumah.'],
      art: function(ctx, W, H){
        var cy = 104;
        ink(ctx, 2);
        // guitar
        var gx = W*0.24;
        ctx.beginPath(); ctx.ellipse(gx, cy+14, 20, 26, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(gx, cy+16, 7, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx, cy-12); ctx.lineTo(gx, cy-52); ctx.stroke();
        ctx.strokeRect(gx-6, cy-62, 12, 12);
        // kalimba
        var kx = W*0.5;
        ctx.strokeRect(kx-22, cy-24, 44, 56);
        ctx.lineWidth = 1.6;
        for (var i=0;i<5;i++){
          ctx.beginPath();
          ctx.moveTo(kx-14+i*7, cy-14); ctx.lineTo(kx-14+i*7, cy+6+Math.abs(2-i)*4);
          ctx.stroke();
        }
        // otamatone: a note with a face
        var ox = W*0.77;
        ink(ctx, 2);
        ctx.beginPath(); ctx.ellipse(ox-4, cy+22, 15, 12, -0.3, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox+9, cy+18); ctx.lineTo(ox+9, cy-44); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox+9, cy-44); ctx.quadraticCurveTo(ox+26, cy-40, ox+22, cy-26);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ox-9, cy+18, 1.5, 0, 7); ctx.arc(ox-1, cy+18, 1.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ox-5, cy+27, 5, 3.4, 0, 0, 7); ctx.stroke();
      }
    },
    {
      title: 'Bisa gambar anime. Sedikit.',
      note: ['Cukup untuk pamer di grup,', 'belum cukup untuk dijual.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 104;
        ink(ctx, 2);
        // face: wide cheeks, soft chin
        ctx.beginPath();
        ctx.moveTo(cx-30, cy-12);
        ctx.quadraticCurveTo(cx-28, cy+20, cx, cy+34);
        ctx.quadraticCurveTo(cx+28, cy+20, cx+30, cy-12);
        ctx.stroke();
        // hair: a fringe across the forehead
        ctx.beginPath();
        ctx.moveTo(cx-31, cy-6);
        ctx.quadraticCurveTo(cx-34, cy-42, cx, cy-40);
        ctx.quadraticCurveTo(cx+34, cy-42, cx+31, cy-6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-30, cy-16); ctx.quadraticCurveTo(cx-14, cy-26, cx-4, cy-14);
        ctx.moveTo(cx-4, cy-14); ctx.quadraticCurveTo(cx+8, cy-26, cx+20, cy-16);
        ctx.moveTo(cx+20, cy-16); ctx.quadraticCurveTo(cx+27, cy-22, cx+30, cy-14);
        ctx.stroke();
        // big eyes
        ctx.beginPath(); ctx.ellipse(cx-12, cy+2, 5.5, 8, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx+12, cy+2, 5.5, 8, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx-12, cy+3, 2.6, 0, 7); ctx.arc(cx+12, cy+3, 2.6, 0, 7); ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy+18, 5, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
        // pencil
        ink(ctx, 1.9);
        ctx.beginPath();
        ctx.moveTo(cx+52, cy+34); ctx.lineTo(cx+76, cy-6); ctx.lineTo(cx+82, cy-2); ctx.lineTo(cx+58, cy+38);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+52, cy+34); ctx.lineTo(cx+50, cy+42); ctx.lineTo(cx+58, cy+38); ctx.stroke();
      }
    },
    {
      title: 'Sepeda',
      note: ['Roda pertama yang saya percaya.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 112, r = 26;
        ink(ctx);
        ctx.beginPath(); ctx.arc(cx-40, cy, r, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+40, cy, r, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-40, cy); ctx.lineTo(cx-8, cy-30); ctx.lineTo(cx+18, cy-30);
        ctx.lineTo(cx+40, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx-8, cy-30);
        ctx.moveTo(cx, cy); ctx.lineTo(cx+18, cy-30);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.stroke();
        // fork + handlebar
        ctx.beginPath(); ctx.moveTo(cx+18, cy-30); ctx.lineTo(cx+26, cy-42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+18, cy-44); ctx.lineTo(cx+34, cy-40); ctx.stroke();
        // saddle
        ctx.beginPath(); ctx.moveTo(cx-16, cy-34); ctx.lineTo(cx-1, cy-31); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-16, cy-34); ctx.quadraticCurveTo(cx-9, cy-40, cx-1, cy-31); ctx.stroke();
      }
    },
    {
      title: 'Papan, bukan kendaraan',
      note: ['Ke mana-mana meluncur.', 'Termasuk ke tempat kerja.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 118;
        ink(ctx);
        ctx.beginPath(); ctx.moveTo(cx-46, cy); ctx.lineTo(cx+46, cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-46, cy); ctx.quadraticCurveTo(cx-58, cy-2, cx-56, cy-10);
        ctx.moveTo(cx+46, cy); ctx.quadraticCurveTo(cx+58, cy-2, cx+56, cy-10);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx-26, cy+8, 6, 0, 7); ctx.arc(cx+26, cy+8, 6, 0, 7); ctx.stroke();
        // a small figure riding it
        ctx.beginPath(); ctx.arc(cx-2, cy-52, 13, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-2, cy-39); ctx.lineTo(cx-2, cy-16);
        ctx.moveTo(cx-2, cy-16); ctx.lineTo(cx-16, cy);
        ctx.moveTo(cx-2, cy-16); ctx.lineTo(cx+14, cy);
        ctx.moveTo(cx-2, cy-32); ctx.lineTo(cx+18, cy-38);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx-2, cy-53, 6, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
      }
    },
    {
      title: 'Benci ngoding',
      note: ['Tetap ngoding. Setiap hari kerja.', 'Ini bukan ironi, ini pekerjaan.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 100;
        ink(ctx);
        // laptop
        ctx.strokeRect(cx-52, cy-34, 104, 62);
        ctx.beginPath();
        ctx.moveTo(cx-64, cy+40); ctx.lineTo(cx-52, cy+28); ctx.lineTo(cx+52, cy+28); ctx.lineTo(cx+64, cy+40);
        ctx.closePath(); ctx.stroke();
        ctx.lineWidth = 1.6;
        for (var i=0;i<4;i++){
          ctx.beginPath();
          ctx.moveTo(cx-42, cy-22+i*13); ctx.lineTo(cx-42+[46,30,54,22][i], cy-22+i*13);
          ctx.stroke();
        }
        // flat face, unimpressed
        ink(ctx, 2);
        ctx.beginPath(); ctx.arc(cx+80, cy-4, 15, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx+72, cy-10); ctx.lineTo(cx+77, cy-10);
        ctx.moveTo(cx+83, cy-10); ctx.lineTo(cx+88, cy-10);
        ctx.moveTo(cx+74, cy+4); ctx.lineTo(cx+86, cy+2);
        ctx.stroke();
      }
    },
    {
      title: 'Manga dulu, anime kemudian',
      note: ['Animenya tetap saya tonton.', 'Tapi manga tidak pernah punya filler.'],
      art: function(ctx, W, H){
        var cx = W/2 - 10, cy = 112;
        ink(ctx);
        // open volume — same geometry as the surah book, which reads clearly
        ctx.beginPath();
        ctx.moveTo(cx-66, cy+22); ctx.quadraticCurveTo(cx-33, cy+10, cx, cy+18);
        ctx.quadraticCurveTo(cx+33, cy+10, cx+66, cy+22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-66, cy+22); ctx.quadraticCurveTo(cx-58, cy-34, cx, cy-20);
        ctx.quadraticCurveTo(cx+58, cy-34, cx+66, cy+22);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy-20); ctx.lineTo(cx, cy+18); ctx.stroke();
        // manga panels on both pages
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx-52, cy-10, 20, 12);
        ctx.strokeRect(cx-52, cy+5, 20, 9);
        ctx.strokeRect(cx-28, cy-11, 20, 25);
        ctx.strokeRect(cx+8, cy-11, 20, 25);
        ctx.strokeRect(cx+32, cy-10, 20, 24);
        // a speech bubble rising off the page
        ink(ctx, 2);
        ctx.beginPath();
        ctx.ellipse(cx+40, cy-48, 24, 15, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx+30, cy-35); ctx.lineTo(cx+22, cy-24); ctx.lineTo(cx+38, cy-34);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx+32, cy-48, 1.5, 0, 7); ctx.arc(cx+40, cy-48, 1.5, 0, 7);
        ctx.arc(cx+48, cy-48, 1.5, 0, 7); ctx.fill();
      }
    },
    {
      title: 'Dulu pembaca wuxia',
      note: ['Pendekar, jurus, dan dendam tujuh generasi.', 'Sekarang tinggal istilahnya yang nyangkut.'],
      art: function(ctx, W, H){
        var cy = 104;
        // an unrolled scroll on the left
        var sx = W*0.34;
        ink(ctx, 2);
        ctx.beginPath(); ctx.ellipse(sx, cy-42, 30, 6, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sx, cy+42, 30, 6, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx-30, cy-42); ctx.lineTo(sx-30, cy+42);
        ctx.moveTo(sx+30, cy-42); ctx.lineTo(sx+30, cy+42);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        for (var i=0;i<5;i++){
          var w = [40,30,44,26,36][i];
          ctx.beginPath();
          ctx.moveTo(sx+22 - w, cy-26+i*14); ctx.lineTo(sx+22, cy-26+i*14); ctx.stroke();
        }
        // a jianghu sword on the right, point up
        var gx = W*0.7;
        ink(ctx, 2.4);
        ctx.beginPath(); ctx.moveTo(gx, cy-52); ctx.lineTo(gx, cy+26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx-3, cy-46); ctx.lineTo(gx, cy-56); ctx.lineTo(gx+3, cy-46); ctx.stroke();
        ink(ctx, 2.8);
        ctx.beginPath(); ctx.moveTo(gx-18, cy+26); ctx.lineTo(gx+18, cy+26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx, cy+26); ctx.lineTo(gx, cy+52); ctx.stroke();
        ink(ctx, 2);
        ctx.beginPath(); ctx.arc(gx, cy+56, 4, 0, 7); ctx.stroke();
        // tassel
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(gx+16, cy+28); ctx.quadraticCurveTo(gx+30, cy+38, gx+24, cy+54);
        ctx.stroke();
      }
    },
    {
      title: 'Permanent Resident',
      note: ['Sudah bertahun-tahun di Singapura.', 'Tetap orang Purwokerto, kalau ditanya.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 96;
        ink(ctx);
        // an HDB block
        ctx.strokeRect(cx-34, cy-40, 68, 92);
        ctx.lineWidth = 1.5;
        for (var r=0;r<5;r++){
          for (var c=0;c<3;c++){
            ctx.strokeRect(cx-26 + c*19, cy-32 + r*17, 12, 11);
          }
        }
        ink(ctx, 2);
        ctx.beginPath(); ctx.moveTo(cx-44, cy+52); ctx.lineTo(cx+44, cy+52); ctx.stroke();
        // a smaller block beside it, and a palm
        ctx.strokeRect(cx+44, cy-8, 34, 60);
        ctx.lineWidth = 1.5;
        for (var r2=0;r2<3;r2++) ctx.strokeRect(cx+52, cy+2 + r2*17, 18, 11);
        ink(ctx, 2);
        ctx.beginPath(); ctx.moveTo(cx-58, cy+52); ctx.lineTo(cx-58, cy+22); ctx.stroke();
        ctx.lineWidth = 1.7;
        for (var f=0;f<4;f++){
          var a = -2.6 + f*0.5;
          ctx.beginPath();
          ctx.moveTo(cx-58, cy+22);
          ctx.quadraticCurveTo(cx-58+Math.cos(a)*14, cy+22+Math.sin(a)*12, cx-58+Math.cos(a)*24, cy+26+Math.sin(a)*10);
          ctx.stroke();
        }
      }
    },
    {
      title: 'Anak saya nanti wajib NS',
      note: ['Dua tahun, bukan pilihan saya, bukan pilihannya.', 'Permintaan maaf sudah saya siapkan dari sekarang.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 112;
        ink(ctx);
        // a very small person under a very large helmet
        ctx.beginPath(); ctx.arc(cx, cy+4, 14, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy+18); ctx.lineTo(cx, cy+36);
        ctx.moveTo(cx, cy+36); ctx.lineTo(cx-9, cy+50);
        ctx.moveTo(cx, cy+36); ctx.lineTo(cx+9, cy+50);
        ctx.moveTo(cx, cy+24); ctx.lineTo(cx-13, cy+32);
        ctx.moveTo(cx, cy+24); ctx.lineTo(cx+13, cy+32);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx-5, cy+4, 1.5, 0, 7); ctx.arc(cx+5, cy+4, 1.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx-4, cy+11); ctx.lineTo(cx+4, cy+11); ctx.stroke();
        // oversized helmet
        ink(ctx, 2.2);
        ctx.beginPath(); ctx.arc(cx, cy-6, 26, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx-30, cy-6); ctx.lineTo(cx+30, cy-6); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-30, cy-6); ctx.quadraticCurveTo(cx-34, cy-14, cx-26, cy-16);
        ctx.moveTo(cx+30, cy-6); ctx.quadraticCurveTo(cx+34, cy-14, cx+26, cy-16);
        ctx.stroke();
        // two years, counted on a wall
        ctx.lineWidth = 1.7;
        for (var i=0;i<8;i++){
          var x = cx + 48 + (i%4)*7;
          var yy = cy - 20 + Math.floor(i/4)*20;
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x+2, yy+14); ctx.stroke();
        }
      }
    },
    {
      title: 'Kalau bisa pergi, saya pergi',
      note: ['Peta lebih meyakinkan daripada rencana lima tahun.'],
      art: function(ctx, W, H){
        var cx = W/2, cy = 108, r = 34;
        ink(ctx);
        ctx.beginPath(); ctx.arc(cx-18, cy+6, r, 0, 7); ctx.stroke();
        ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.ellipse(cx-18, cy+6, 14, r, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx-52, cy+6); ctx.lineTo(cx+16, cy+6); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-48, cy-12); ctx.quadraticCurveTo(cx-18, cy-4, cx+12, cy-12);
        ctx.moveTo(cx-48, cy+24); ctx.quadraticCurveTo(cx-18, cy+16, cx+12, cy+24);
        ctx.stroke();
        // dotted flight path + a tiny plane
        ctx.strokeStyle = BLUE; ctx.lineWidth = 1.8;
        for (var i=0;i<9;i++){
          var a = -2.5 + i*0.18;
          ctx.beginPath();
          ctx.arc(cx-18, cy+6, r+16, a, a+0.1);
          ctx.stroke();
        }
        // a little paper plane at the head of the dotted path
        ink(ctx, 1.9); ctx.strokeStyle = BLUE;
        var px = cx + 36, py = cy - 34;
        ctx.beginPath();
        ctx.moveTo(px-13, py-7); ctx.lineTo(px+13, py+2); ctx.lineTo(px-9, py+9);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px-13, py-7); ctx.lineTo(px-4, py+3); ctx.lineTo(px-9, py+9);
        ctx.stroke();
      }
    }
  ];

  TOYS.fakta = {
    init: function(){
      var seen = []; for (var i=0;i<FACTS.length;i++) seen.push(false);
      seen[0] = true;
      return { i:0, seen:seen, bag:[], enter:0, t:0 };
    },
    click: function(s){
      // shuffle bag: every fact shows up once before any repeats
      if (!s.bag.length){
        for (var i=0;i<FACTS.length;i++) if (i !== s.i) s.bag.push(i);
        for (var k=s.bag.length-1;k>0;k--){
          var j = Math.floor(Math.random()*(k+1)), tmp = s.bag[k];
          s.bag[k] = s.bag[j]; s.bag[j] = tmp;
        }
      }
      s.i = s.bag.pop();
      s.seen[s.i] = true; s.enter = 12;
    },
    tick: function(s){ s.t++; if (s.enter>0) s.enter--; },
    draw: function(ctx, W, H, s){
      var c = FACTS[s.i];
      ctx.save();
      if (s.enter>0){ ctx.globalAlpha = 1 - s.enter/14; ctx.translate(s.enter*0.7, 0); }
      txt(ctx, c.title, W/2, 28, 14, INK, true, W*0.9);
      c.art(ctx, W, H, s.t);
      for (var i=0;i<c.note.length;i++) txt(ctx, c.note[i], W/2, H-46+i*16, 12, MUTED, false, W*0.9);
      ctx.restore();
      dots(ctx, W, H, FACTS.length, s.i, s.seen);
    }
  };

  // ------------------------------------------------------------ bootstrap ----
  var mounted = [];
  var nodes = document.querySelectorAll('.toy[data-toy]');
  for (var i=0;i<nodes.length;i++){
    (function(el, first){
      var def = TOYS[el.getAttribute('data-toy')];
      if (!def) return;
      var h = parseInt(el.getAttribute('data-h') || '230', 10);
      var cv = document.createElement('canvas');
      el.appendChild(cv);
      if (first){
        var hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = 'Tip: kartunya bisa diklik.';
        el.appendChild(hint);
      }
      var toy = { el:el, cv:cv, ctx:cv.getContext('2d'), def:def, h:h, s:def.init() };
      function size(){
        var w = Math.max(240, Math.min(460, el.clientWidth || 460));
        cv.width = Math.round(w); cv.height = h;
      }
      toy.size = size; size();
      function hit(){
        el.classList.add('touched');
        def.click && def.click(toy.s, cv.width, cv.height);
      }
      cv.addEventListener('mousedown', function(e){ e.preventDefault(); hit(); });
      // On touch, wait for the lift: a tap flips the card, a swipe scrolls past.
      var sx=0, sy=0, st=0, slid=false;
      cv.addEventListener('touchstart', function(e){
        var p = e.touches[0]; if (!p) return;
        sx = p.clientX; sy = p.clientY; st = Date.now(); slid = false;
      }, {passive:true});
      cv.addEventListener('touchmove', function(e){
        var p = e.touches[0]; if (!p) return;
        if (Math.abs(p.clientX-sx) > 10 || Math.abs(p.clientY-sy) > 10) slid = true;
      }, {passive:true});
      cv.addEventListener('touchend', function(e){
        if (slid || Date.now()-st > 600) return;
        e.preventDefault(); // also cancels the synthetic click
        hit();
      });
      mounted.push(toy);
    })(nodes[i], i === 0);
  }

  window.addEventListener('resize', function(){
    for (var i=0;i<mounted.length;i++) mounted[i].size();
  });

  function loop(){
    var vh = window.innerHeight || 800;
    for (var i=0;i<mounted.length;i++){
      var toy = mounted[i];
      var r = toy.cv.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue;
      var W = toy.cv.width, H = toy.cv.height;
      toy.def.tick && toy.def.tick(toy.s, W, H);
      toy.ctx.fillStyle = PAPER; toy.ctx.fillRect(0,0,W,H);
      toy.def.draw(toy.ctx, W, H, toy.s);
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
</script>
