const S = require('../../assets/js/stickfight-sim.js');
const Wire = require('../../assets/js/stickfight-wire.js');

// a live 6-player brawl on the "server"
const w = S.createWorld(42);
const slots = [];
for (let i=0;i<6;i++){ const p = S.addPlayer(w,'p'+i,'player'+i,i); slots.push(p.id); }
const roster = slots.map((id,i) => ({ id, name: 'player'+i, color: i }));
const base = Wire.newBaseline();

// the "client" world, built only from the wire
const cw = S.createWorld(42);
cw.players = {};

let seq = 0, sizes = [], keyframes = 0, maxErr = 0, jsonSizes = [];
for (let tick = 0; tick < 3600; tick++){
  Object.values(w.players).forEach((p,j) => {
    p.input.l = (tick+j*31)%140 < 45 ? 1:0;
    p.input.r = (tick+j*31)%140 >= 95 ? 1:0;
    p.input.jump = (tick+j*17)%120 < 5 ? 1:0;
    p.input.duck = (tick+j*29)%200 < 15 ? 1:0;
    p.input.aim = Math.sin((tick+j*10)*0.02)*3.1;
    p.input.fire = (tick+j*13)%35===0 ? 1:0;
  });
  S.step(w);
  if (tick % 3 === 0){                       // 20Hz broadcast
    const buf = Wire.encodeSnapshot(w, slots, base, seq);
    if (seq % Wire.SNAP_KEY === 0) keyframes++;
    sizes.push(buf.byteLength);
    jsonSizes.push(JSON.stringify(S.snapshot(w)).length);
    seq++;
    Wire.decodeSnapshot(buf, cw, roster, S);
    // does the client match the server, to the pixel?
    for (const id in w.players){
      const a = w.players[id], b = cw.players[id];
      if (!b) { maxErr = 9999; continue; }
      for (let k=0;k<7;k++){
        maxErr = Math.max(maxErr, Math.abs(Math.round(a.pts[k].x) - b.pts[k].x),
                                  Math.abs(Math.round(a.pts[k].y) - b.pts[k].y));
      }
    }
  }
}
const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
console.log('60s of 6-player brawl, 20Hz:');
console.log('  binary snapshot   avg', avg(sizes).toFixed(0), 'bytes  max', Math.max(...sizes),
            '->', (avg(sizes)*20/1024).toFixed(1), 'KB/s');
console.log('  old JSON snapshot avg', avg(jsonSizes).toFixed(0), 'bytes',
            '->', (avg(jsonSizes)*20/1024).toFixed(1), 'KB/s');
console.log('  saving           ', (100 - avg(sizes)/avg(jsonSizes)*100).toFixed(0) + '%');
console.log('  keyframes sent    ', keyframes, 'of', sizes.length, 'snapshots');
console.log('  client/server position mismatch:', maxErr, 'px (0 = exact)');

// input packet
const ib = Wire.encodeInput({l:1,r:0,jump:1,duck:0,fire:1,aim:-2.4567});
const back = Wire.decodeInput(ib, {});
console.log('input packet', ib.byteLength, 'bytes | round-trip',
            JSON.stringify(back), '| aim error', Math.abs(back.aim - (-2.4567)).toFixed(5));
console.log('  input upstream at 20Hz:', (4*20/1024).toFixed(2), 'KB/s');
