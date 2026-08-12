/*
 * Stick Fight — the wire format.
 *
 * Shared by the browser and the Durable Object, like the simulation is. JSON
 * snapshots were 752 bytes for six players (~15 KB/s down at 20 Hz), most of it
 * spent re-sending names, colours and float coordinates that barely changed.
 *
 * Here the roster (id, name, colour) is sent once on join, players live in
 * numbered slots, and each snapshot carries positions as int8 deltas against the
 * previous one — whole pixels, since nothing on screen is smaller than a limb.
 * A slot whose limb moved more than 127px in one interval (a respawn, a good
 * sword hit) falls back to absolute int16 for that slot only. Every SNAP_KEY
 * snapshots everything goes absolute anyway, so a client can always resync.
 *
 * Six players, no keyframes: ~140 bytes, or about 2.8 KB/s at 20 Hz.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StickWire = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PTS = 7;                 // points per body, must match the sim
  var MAX_SLOTS = 8;
  var SNAP_KEY = 30;           // force a full keyframe every 30 snapshots (1.5s)
  var WEAPON_ID = { fist: 0, sword: 1, gun: 2 };
  var WEAPON_NAME = ['fist', 'sword', 'gun'];
  var FX_ID = { slash: 0, hit: 1, die: 2, pick: 3, jab: 4 };
  var FX_NAME = ['slash', 'hit', 'die', 'pick', 'jab'];

  var T_SNAPSHOT = 1, T_ROSTER = 2, T_INPUT = 3, T_EVENT = 4;

  function clampI8(v) { return v < -127 ? -127 : (v > 127 ? 127 : v); }

  // ---- snapshots (server -> client) ----------------------------------------
  // `base` is the last snapshot actually sent; it is mutated to become the new
  // baseline. Pass the same object every time for one room.
  function encodeSnapshot(world, slots, base, seq) {
    var present = [], i, s, p;
    for (i = 0; i < slots.length; i++) {
      if (slots[i] && world.players[slots[i]]) present.push(i);
    }

    var keyAll = (seq % SNAP_KEY) === 0;
    var keys = {}, sizes = 0;
    for (i = 0; i < present.length; i++) {
      s = present[i];
      p = world.players[slots[s]];
      var need = keyAll || !base.pos[s];
      if (!need) {
        for (var j = 0; j < PTS; j++) {
          if (Math.abs(Math.round(p.pts[j].x) - base.pos[s][j * 2]) > 127 ||
              Math.abs(Math.round(p.pts[j].y) - base.pos[s][j * 2 + 1]) > 127) { need = true; break; }
        }
      }
      keys[s] = need;
      sizes += 7 + (need ? PTS * 4 : PTS * 2);
    }

    var bullets = world.bullets.length > 40 ? world.bullets.slice(0, 40) : world.bullets;
    var fx = world.fx.length > 12 ? world.fx.slice(0, 12) : world.fx;
    var len = 1 + 4 + 1 + 1 + sizes + 1 + bullets.length * 6 + 1 + 1 + fx.length * 8;
    var buf = new ArrayBuffer(len), dv = new DataView(buf), o = 0;

    dv.setUint8(o, T_SNAPSHOT); o += 1;
    dv.setUint32(o, world.t); o += 4;
    var slotMask = 0, keyMask = 0;
    for (i = 0; i < present.length; i++) {
      slotMask |= 1 << present[i];
      if (keys[present[i]]) keyMask |= 1 << present[i];
    }
    dv.setUint8(o, slotMask); o += 1;
    dv.setUint8(o, keyMask); o += 1;

    for (i = 0; i < present.length; i++) {
      s = present[i];
      p = world.players[slots[s]];
      dv.setUint8(o, Math.max(0, Math.min(255, p.hp | 0))); o += 1;
      dv.setUint8(o, Math.min(255, p.kills)); o += 1;
      dv.setUint8(o, Math.min(255, p.deaths)); o += 1;
      // weapon in the top 2 bits, ammo in 5, dead in 1
      dv.setUint8(o, (WEAPON_ID[p.weapon] << 6) | (Math.min(31, p.ammo) << 1) | (p.dead ? 1 : 0)); o += 1;
      dv.setUint8(o, Math.min(255, p.cd)); o += 1;
      dv.setInt16(o, Math.round(p.aim * 10000)); o += 2;

      if (!base.pos[s]) base.pos[s] = new Int16Array(PTS * 2);
      var bp = base.pos[s];
      for (var k = 0; k < PTS; k++) {
        var x = Math.round(p.pts[k].x), y = Math.round(p.pts[k].y);
        if (keys[s]) {
          dv.setInt16(o, x); o += 2;
          dv.setInt16(o, y); o += 2;
        } else {
          dv.setInt8(o, clampI8(x - bp[k * 2])); o += 1;
          dv.setInt8(o, clampI8(y - bp[k * 2 + 1])); o += 1;
        }
        bp[k * 2] = x; bp[k * 2 + 1] = y;
      }
    }
    for (s = 0; s < MAX_SLOTS; s++) {          // forget slots that left
      if (base.pos[s] && !(slotMask & (1 << s))) base.pos[s] = null;
    }

    dv.setUint8(o, bullets.length); o += 1;
    for (i = 0; i < bullets.length; i++) {
      dv.setInt16(o, Math.round(bullets[i].x)); o += 2;
      dv.setInt16(o, Math.round(bullets[i].y)); o += 2;
      dv.setInt8(o, clampI8(Math.round(bullets[i].vx))); o += 1;
      dv.setInt8(o, clampI8(Math.round(bullets[i].vy))); o += 1;
    }

    var pickMask = 0;
    for (i = 0; i < world.pickups.length && i < 8; i++) {
      if (world.pickups[i].taken <= 0) pickMask |= 1 << i;
    }
    dv.setUint8(o, pickMask); o += 1;

    dv.setUint8(o, fx.length); o += 1;
    for (i = 0; i < fx.length; i++) {
      var f = fx[i];
      dv.setUint8(o, FX_ID[f.k] | (f.big ? 128 : 0)); o += 1;
      dv.setInt16(o, Math.round(f.x)); o += 2;
      dv.setInt16(o, Math.round(f.y)); o += 2;
      dv.setInt16(o, Math.round((f.a || 0) * 10000)); o += 2;
      dv.setUint8(o, Math.min(255, Math.round(f.r || 0))); o += 1;
    }
    return buf;
  }

  // Applies a snapshot onto a local world. `roster` maps slot -> {id,name,color};
  // `mine` is the id to keep pointing at. Returns the tick decoded.
  function decodeSnapshot(buf, world, roster, sim) {
    var dv = new DataView(buf), o = 0;
    if (dv.getUint8(o) !== T_SNAPSHOT) return -1;
    o += 1;
    var tick = dv.getUint32(o); o += 4;
    var slotMask = dv.getUint8(o); o += 1;
    var keyMask = dv.getUint8(o); o += 1;
    world.t = tick;

    var seen = {};
    for (var s = 0; s < MAX_SLOTS; s++) {
      if (!(slotMask & (1 << s))) continue;
      var info = roster[s];
      var hp = dv.getUint8(o); o += 1;
      var kills = dv.getUint8(o); o += 1;
      var deaths = dv.getUint8(o); o += 1;
      var wa = dv.getUint8(o); o += 1;
      var cd = dv.getUint8(o); o += 1;
      var aim = dv.getInt16(o) / 10000; o += 2;
      var key = !!(keyMask & (1 << s));

      var id = info ? info.id : 'slot' + s;
      var p = world.players[id];
      if (!p) {
        p = sim.addPlayer(world, id, info ? info.name : '?', info ? info.color : s);
      }
      seen[id] = 1;
      p.hp = hp; p.kills = kills; p.deaths = deaths;
      p.weapon = WEAPON_NAME[wa >> 6]; p.ammo = (wa >> 1) & 31; p.dead = !!(wa & 1);
      p.cd = cd; p.aim = aim;

      for (var k = 0; k < PTS; k++) {
        var q = p.pts[k];
        q.ox = q.x; q.oy = q.y;                 // keep a velocity for interpolation
        if (key) {
          q.x = dv.getInt16(o); o += 2;
          q.y = dv.getInt16(o); o += 2;
        } else {
          q.x = q.ox + dv.getInt8(o); o += 1;
          q.y = q.oy + dv.getInt8(o); o += 1;
        }
      }
    }
    for (var pid in world.players) if (!seen[pid]) delete world.players[pid];

    var nb = dv.getUint8(o); o += 1;
    world.bullets.length = 0;
    for (var b = 0; b < nb; b++) {
      var bx = dv.getInt16(o); o += 2;
      var by = dv.getInt16(o); o += 2;
      var bvx = dv.getInt8(o); o += 1;
      var bvy = dv.getInt8(o); o += 1;
      world.bullets.push({ x: bx, y: by, vx: bvx, vy: bvy, life: 60 });
    }

    var pickMask = dv.getUint8(o); o += 1;
    for (var i = 0; i < world.pickups.length; i++) {
      world.pickups[i].taken = (pickMask & (1 << i)) ? 0 : 1;
    }

    var nf = dv.getUint8(o); o += 1;
    world.fx.length = 0;
    for (var f = 0; f < nf; f++) {
      var kind = dv.getUint8(o); o += 1;
      var fxx = dv.getInt16(o); o += 2;
      var fxy = dv.getInt16(o); o += 2;
      var fxa = dv.getInt16(o) / 10000; o += 2;
      var fxr = dv.getUint8(o); o += 1;
      world.fx.push({ k: FX_NAME[kind & 127], big: !!(kind & 128), x: fxx, y: fxy,
                      a: fxa, r: fxr, arc: 1.5, t: 9 });
    }
    return tick;
  }

  // ---- input (client -> server): 4 bytes ------------------------------------
  function encodeInput(i) {
    var buf = new ArrayBuffer(4), dv = new DataView(buf);
    dv.setUint8(0, T_INPUT);
    dv.setUint8(1, (i.l ? 1 : 0) | (i.r ? 2 : 0) | (i.jump ? 4 : 0) |
                   (i.duck ? 8 : 0) | (i.fire ? 16 : 0));
    dv.setInt16(2, Math.round(i.aim * 10000));
    return buf;
  }
  function decodeInput(buf, into) {
    var dv = new DataView(buf);
    if (dv.getUint8(0) !== T_INPUT) return null;
    var b = dv.getUint8(1);
    into.l = b & 1 ? 1 : 0;
    into.r = b & 2 ? 1 : 0;
    into.jump = b & 4 ? 1 : 0;
    into.duck = b & 8 ? 1 : 0;
    into.fire = b & 16 ? 1 : 0;
    into.aim = dv.getInt16(2) / 10000;
    return into;
  }

  function newBaseline() { return { pos: new Array(MAX_SLOTS).fill(null) }; }

  return {
    T_SNAPSHOT: T_SNAPSHOT, T_ROSTER: T_ROSTER, T_INPUT: T_INPUT, T_EVENT: T_EVENT,
    MAX_SLOTS: MAX_SLOTS, SNAP_KEY: SNAP_KEY,
    encodeSnapshot: encodeSnapshot, decodeSnapshot: decodeSnapshot,
    encodeInput: encodeInput, decodeInput: decodeInput, newBaseline: newBaseline
  };
});
