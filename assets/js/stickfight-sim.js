/*
 * Stick Fight — the simulation.
 *
 * Deliberately free of any DOM or canvas reference: the browser runs this to
 * play offline against bots, and a Cloudflare Durable Object runs the very same
 * file as the authoritative server for a room. Inputs go in, world state comes
 * out; drawing and networking live elsewhere.
 *
 * The bodies are Verlet ragdolls — points joined by distance constraints, held
 * upright by soft "muscles" that go slack for a moment when you take a hit. That
 * slackness is the point: a flailing stickman is a genuinely unpredictable
 * target, so no two exchanges land the same way.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StickSim = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- arena ----------------------------------------------------------------
  // The arena is big and horizontal — 14 bodies wide, 8 tall — because a cramped
  // map plays worse than a spacious one. It is deliberately larger than any single
  // screen shows: the client draws a fixed-size window of it that follows you, the
  // same window size for every player on every device, so a phone and a laptop see
  // exactly as much of the fight as each other.
  var W = 960, H = 540;
  var DT = 1 / 60;          // the sim always steps at a fixed 60Hz
  var GRAV = 1500;
  var VOID_Y = H + 90;      // below this you are gone, knockback included

  // ---- body -----------------------------------------------------------------
  var HEAD = 0, CHEST = 1, HIPS = 2, HANDL = 3, HANDR = 4, FOOTL = 5, FOOTR = 6;
  var NECK = 13, SPINE = 25, ARM = 25, LEG = 29;
  var STAND_H = NECK + SPINE;

  // ---- weapons --------------------------------------------------------------
  // cd is in ticks (60 = 1s). Knockback is the identity here: the sword sends
  // people flying (and off ledges), the gun barely nudges but reaches across the
  // map, and fists are fast, weak, and desperate.
  var WEAPONS = {
    fist:  { melee: true,  dmg: 7,  cd: 20, reach: 26, arc: 1.0, knock: 3.4,  ammo: 0, recoil: 0   },
    sword: { melee: true,  dmg: 22, cd: 34, reach: 54, arc: 1.5, knock: 10.5, ammo: 0, recoil: 0   },
    gun:   { melee: false, dmg: 14, cd: 48, reach: 0,  arc: 0,   knock: 3.2,  ammo: 8, recoil: 2.2 }
  };
  var BULLET_SPEED = 15;    // px per tick — fast, but dodgeable at range
  var RESPAWN = 150;        // 2.5s
  var CRATE_EVERY = 270;    // a weapon appears every 4.5s
  var CRATE_FIRST = 150;    // the first one 2.5s in — everyone opens with fists
  var MAX_CRATES = 4;
  var MAX_HP = 100;
  var FLAIL_ON_HIT = 26;    // ticks of limp ragdoll after being hit
  var SWING_TICKS = 11;     // how long the arm takes to follow through
  // Specials. Each one spends the weapon: a big swing you get once per pickup.
  var SPIN_TICKS = 46;      // sword: one and a half turns, hits each enemy once
  var SPIN_DMG = 17, SPIN_KNOCK = 13;
  var SPRAY_SHOTS = 8;      // gun: alternating left and right until it is empty
  var SPRAY_EVERY = 5;

  function rnd(seedRef) { // small deterministic PRNG so server and replays agree
    seedRef.s = (seedRef.s * 1664525 + 1013904223) % 4294967296;
    return seedRef.s / 4294967296;
  }

  // ---- world ----------------------------------------------------------------
  // The map is generated from the room's seed, so every room is a different
  // arena and both ends compute the identical one. Row heights are fixed —
  // 114/94/90px apart, all inside a 139px jump — and only the platforms within
  // each row vary, which keeps every layout climbable without having to search
  // for one.
  var ROWS = [470, 356, 262, 172];

  function buildMap(rs) {
    var plats = [];

    // The floor sets the character of the map, so it varies the most: one wide
    // deck, one shoved to a side, or two with a pit down the middle. Randomising
    // only the width left every arena opening the same way.
    var style = Math.floor(rnd(rs) * 3);
    if (style === 0) {
      var gap = 100 + Math.round(rnd(rs) * 90);
      var half = Math.round((W - gap) / 2 - (10 + rnd(rs) * 70));
      plats.push({ x: Math.round(20 + rnd(rs) * 40), y: ROWS[0], w: half, h: 16 });
      plats.push({ x: Math.round(W - 20 - rnd(rs) * 40 - half), y: ROWS[0], w: half, h: 16 });
    } else {
      var bw = 360 + Math.floor(rnd(rs) * 380);
      var bx = style === 1
        ? Math.round(20 + rnd(rs) * Math.max(1, W - bw - 40))
        : Math.round((W - bw) / 2 + (rnd(rs) * 70 - 35));
      plats.push({ x: bx, y: ROWS[0], w: bw, h: 16 });
    }

    // two or three tiers above it, so the ceiling is not always in the same place
    var tiers = 2 + (rnd(rs) < 0.6 ? 1 : 0);
    for (var r = 1; r <= tiers; r++) {
      var below = plats.filter(function (q) { return q.y === ROWS[r - 1]; });
      var n = 1 + Math.floor(rnd(rs) * 3);           // 1, 2 or 3 ledges per row
      var slot = W / n;
      var row = [];
      for (var i = 0; i < n; i++) {
        // a lone ledge is a wide shelf; three are narrow perches
        var w = n === 1 ? Math.round(200 + rnd(rs) * 180)
                        : Math.round(110 + rnd(rs) * Math.max(20, slot * 0.6 - 110));
        if (w < 100) w = 100;
        var x = Math.round(i * slot + rnd(rs) * Math.max(8, slot - w - 8));
        var pl = { x: x, y: ROWS[r], w: w, h: 14 };
        // climbable from something below: if nothing on the row under it is
        // within a jump's horizontal reach, slide it until it is
        var near = below.some(function (q) {
          return pl.x < q.x + q.w + 150 && pl.x + pl.w > q.x - 150;
        });
        if (!near && below.length) {
          var q0 = below[Math.floor(rnd(rs) * below.length)];
          pl.x = Math.round(q0.x + q0.w / 2 - pl.w / 2);
        }
        row.push(pl);
      }
      // Space them out. The reachability nudge above can shove two ledges into
      // each other, which reads as one lumpy platform with a notch in it.
      row.sort(function (a, b) { return a.x - b.x; });
      var cursor = 10;
      for (var k = 0; k < row.length; k++) {
        if (row[k].x < cursor) row[k].x = cursor;
        if (row[k].x + row[k].w > W - 10) { row.length = k; break; }   // no room left
        cursor = row[k].x + row[k].w + 70;                             // a real gap
      }
      if (!row.length) row.push({ x: Math.round(W / 2 - 70), y: ROWS[r], w: 140, h: 14 });
      // Last word on climbability: the spacing pass can shift the one ledge that
      // was reachable out of reach again, which would strand a whole tier.
      var reachable = row.some(function (pl) {
        return below.some(function (q) {
          return pl.x < q.x + q.w + 150 && pl.x + pl.w > q.x - 150;
        });
      });
      if (!reachable && below.length) {
        var widest = row[0];
        for (var z = 1; z < row.length; z++) if (row[z].w > widest.w) widest = row[z];
        var anchor = below[Math.floor(rnd(rs) * below.length)];
        widest.x = Math.max(10, Math.min(W - 10 - widest.w,
                   Math.round(anchor.x + anchor.w / 2 - widest.w / 2)));
      }
      for (var m = 0; m < row.length; m++) plats.push(row[m]);
    }
    return plats;
  }

  function createWorld(seed) {
    var rs = { s: (seed || 12345) >>> 0 };
    var plats = buildMap(rs);
    var spawns = [];
    for (var i = 0; i < plats.length; i++) {
      spawns.push({ x: Math.round(plats[i].x + plats[i].w / 2), y: plats[i].y - 10 });
    }

    return {
      t: 0,
      w: W, h: H,
      seed: rs,
      platforms: plats,
      spawns: spawns,
      pickups: [],          // everyone starts bare-handed; crates drop in over time
      crateT: CRATE_FIRST,
      players: {},
      bullets: [],
      fx: []          // transient slash/hit marks, drained by the renderer each frame
    };
  }

  function addPlayer(world, id, name, colorIdx) {
    var i = Object.keys(world.players).length;
    var sp = world.spawns[i % world.spawns.length];
    var p = {
      id: id, name: (name || 'anon').slice(0, 12), color: colorIdx || i,
      hp: MAX_HP, kills: 0, deaths: 0, dead: false, respawn: 0,
      weapon: 'fist', ammo: 0, cd: 0, flail: 0, facing: 1, grounded: false,
      aim: 0, walk: 0, stride: 0, duckAmt: 1, swing: 0, swingKind: '', swingAim: 0, jumpCool: 0, coyote: 0,
      spin: 0, spinAim: 0, spinHits: null, spray: 0, sprayT: 0, sprayDir: 1, lastHitBy: null, lastHitAt: -999,
      pts: [], input: { l: 0, r: 0, jump: 0, duck: 0, fire: 0, discard: 0, special: 0, aim: 0 }
    };
    placeBody(p, sp.x, sp.y);
    world.players[id] = p;
    return p;
  }

  function placeBody(p, x, y) {
    var pts = [];
    function pt(px, py) { pts.push({ x: px, y: py, ox: px, oy: py }); }
    pt(x, y - LEG - SPINE - NECK);  // head
    pt(x, y - LEG - SPINE);         // chest
    pt(x, y - LEG);                 // hips
    pt(x - 10, y - LEG - SPINE + 8); // hand L
    pt(x + 10, y - LEG - SPINE + 8); // hand R
    pt(x - 7, y);                   // foot L
    pt(x + 7, y);                   // foot R
    p.pts = pts;
  }

  var LINKS = [
    [HEAD, CHEST, NECK, 1.0], [CHEST, HIPS, SPINE, 1.0],
    [CHEST, HANDL, ARM, 0.75], [CHEST, HANDR, ARM, 0.75],
    [HIPS, FOOTL, LEG, 0.85], [HIPS, FOOTR, LEG, 0.85],
    [HEAD, HIPS, NECK + SPINE, 0.35]   // keeps the spine from folding in half
  ];
  // segments used as hitboxes and for drawing
  var BONES = [[HEAD, CHEST], [CHEST, HIPS], [CHEST, HANDL], [CHEST, HANDR],
               [HIPS, FOOTL], [HIPS, FOOTR]];

  // ---- physics --------------------------------------------------------------
  function integrate(p) {
    var damp = p.grounded ? 0.86 : 0.995;
    for (var i = 0; i < p.pts.length; i++) {
      var q = p.pts[i];
      var vx = (q.x - q.ox) * (i === FOOTL || i === FOOTR ? damp : 0.995);
      var vy = (q.y - q.oy) * 0.995;
      if (vx > 22) vx = 22; else if (vx < -22) vx = -22;
      if (vy > 30) vy = 30; else if (vy < -30) vy = -30;
      q.ox = q.x; q.oy = q.y;
      q.x += vx;
      q.y += vy + GRAV * DT * DT;
    }
  }

  function solveLinks(p, stiff) {
    for (var k = 0; k < LINKS.length; k++) {
      var L = LINKS[k], a = p.pts[L[0]], b = p.pts[L[1]], w = L[3] * stiff;
      var isLeg = L[0] === HIPS && (L[1] === FOOTL || L[1] === FOOTR);
      // ducking is bent knees: the leg links simply get shorter
      var want = isLeg ? L[2] * p.duckAmt : L[2];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      // A leg has a knee: it resists being stretched but folds freely. Held rigid
      // it acts like a stilt, and the hips get vaulted into the air every time
      // they pass over the planted foot — a walk that hops by itself.
      if (isLeg && d < want) continue;
      var diff = (d - want) / d * 0.5 * w;
      dx *= diff; dy *= diff;
      a.x += dx; a.y += dy;
      b.x -= dx; b.y -= dy;
    }
  }

  function collide(world, p) {
    p.grounded = false;
    for (var i = 0; i < p.pts.length; i++) {
      var q = p.pts[i];
      // A living body stands on its feet and nothing else.
      //
      // Anything else that can land is a thing that can catch: a hand on a ledge
      // left people hanging in mid-air, and the hips catching a deck lip wedged
      // the stomach on the edge with the legs dangling underneath — 167 of 576
      // swept jump paths ended that way. A corpse stays solid all over so it
      // still tumbles and settles.
      var solid = p.dead || i === FOOTL || i === FOOTR;
      var planted = false;
      if (solid) {
        for (var j = 0; j < world.platforms.length; j++) {
          var pl = world.platforms[j];
          if (q.x < pl.x - 3 || q.x > pl.x + pl.w + 3) continue;
          // Land either by crossing the top surface this tick (however fast), or
          // by already standing on this platform and having sagged a few px into
          // it. Without that second case a planted foot that drifts down by more
          // than a pixel is lost for good and the body falls through the world.
          // Downward crossings only, so a deck can always be jumped up through
          // from below and landed on from above. The resting window is kept
          // thinner than the slab, or a foot that has already passed underneath
          // gets teleported back up onto it.
          var crossed = q.oy <= pl.y + 1 && q.y >= pl.y;
          var resting = q.g === pl.y && q.y >= pl.y - 2 && q.y < pl.y + 5;
          if (crossed || resting) {
            q.y = pl.y;
            var vx = q.x - q.ox;
            q.oy = q.y;
            q.ox = q.x - vx * 0.72;        // friction
            q.g = pl.y;
            planted = true;
            p.grounded = true;
          }
        }
      }
      if (!planted) q.g = -1;
      if (q.x < 6) { q.x = 6; q.ox = q.x + (q.ox - q.x) * 0.4; }
      if (q.x > W - 6) { q.x = W - 6; q.ox = q.x + (q.ox - q.x) * 0.4; }
    }
  }

  // Posture is solved as constraints, in the same relaxation loop as the links.
  //
  // The tempting alternative — teleport a limb toward its target each tick, and
  // shift its previous position with it so no velocity is invented — quietly
  // pumps energy: the teleport preserves velocity but creates constraint error,
  // and the link solver then converts that error into velocity. It looked fine
  // for forty ticks and then walked the stickman off the map at 1.4 px/tick.
  // Position projection cannot do that: when the pose is satisfied the
  // correction is zero, so equilibrium is actually an equilibrium.
  function pull(a, b, tx, ty, k) {
    // equal masses, so equal and opposite displacement
    var dx = (tx - a.x) * k * 0.5, dy = (ty - a.y) * k * 0.5;
    a.x += dx; a.y += dy;
    b.x -= dx; b.y -= dy;
  }

  function pose(p, first) {
    var power = p.dead ? 0 : (p.flail > 0 ? 0.12 : 1);
    if (power <= 0) return;
    var head = p.pts[HEAD], chest = p.pts[CHEST], hips = p.pts[HIPS];

    // Stand: rotate the head over the hips. Rotating toward the same distance,
    // rather than pulling to a fixed height, leaves the neck length to the links.
    var sx = head.x - hips.x, sy = head.y - hips.y;
    var slen = Math.sqrt(sx * sx + sy * sy) || 1;
    pull(head, hips, hips.x, hips.y - slen, 0.22 * power);

    // Feet under the hips, swinging with the stride while walking.
    if (p.grounded) {
      var stride = p.stride;
      var footY = hips.y + LEG * p.duckAmt;
      pull(p.pts[FOOTL], hips, hips.x - stride, footY, 0.16 * power);
      pull(p.pts[FOOTR], hips, hips.x + stride, footY, 0.16 * power);
    }

    // The weapon arm points where you aim — and while a melee attack is playing
    // out, it actually travels: a sword sweeps through the arc it is cutting, a
    // fist punches straight out and comes back. The hitbox moves with it, so the
    // animation is the attack rather than a decoration on top of one.
    var aimPow = p.flail > 0 ? 0.15 : 1;
    var ang = p.aim, reach = ARM;
    if (p.spin > 0) {
      // one and a half turns, starting from where you were aiming
      var t = 1 - p.spin / SPIN_TICKS;
      ang = p.spinAim + t * Math.PI * 3;
      reach = ARM * 1.3;
      aimPow = 1;
    } else if (p.spray > 0) {
      ang = p.sprayDir > 0 ? Math.PI : 0;            // whipping side to side
      reach = ARM * 1.1;
      aimPow = 1;
    } else if (p.swing > 0) {
      var k = 1 - p.swing / SWING_TICKS;             // 0 at the start, 1 at the end
      if (p.swingKind === 'sword') {
        var arc = WEAPONS.sword.arc;
        ang = p.swingAim - arc * 0.5 + arc * k;      // lead the blade through
        reach = ARM * 1.18;
      } else {
        ang = p.swingAim;
        reach = ARM * (1 + 0.5 * Math.sin(Math.PI * k));   // out, then back
      }
      aimPow = Math.max(aimPow, 1);
    }
    pull(p.pts[HANDR], chest, chest.x + Math.cos(ang) * reach,
         chest.y + Math.sin(ang) * reach, 0.5 * aimPow);
    pull(p.pts[HANDL], chest, chest.x - Math.cos(p.aim) * ARM * 0.5,
         chest.y + 8, 0.10 * aimPow);
  }

  // Running is a force, not a pose: it goes in as velocity and the ground has to
  // supply the friction. Much less authority in mid-air.
  function drive(p) {
    var move = (p.input.r ? 1 : 0) - (p.input.l ? 1 : 0);
    if (move) p.facing = move;
    p.stride = (p.grounded && move) ? Math.sin(p.walk) * 12 : 0;
    if (p.grounded) p.walk = move ? p.walk + 0.30 : 0;
    if (!move || p.flail > 0 || p.dead) return;
    var hips = p.pts[HIPS], chest = p.pts[CHEST];
    var speed = hips.x - hips.ox;
    var want = move * 4.4;
    if (Math.abs(speed) < Math.abs(want) || speed * want < 0) {
      var f = p.grounded ? 0.5 : 0.12;
      hips.ox -= (want - speed) * f;
      chest.ox -= (want - speed) * f * 0.4;
    }
  }

  function impulse(p, i, dx, dy) {
    var q = p.pts[i];
    q.ox -= dx; q.oy -= dy;
  }
  function impulseAll(p, dx, dy, spread) {
    for (var i = 0; i < p.pts.length; i++) impulse(p, i, dx * spread, dy * spread);
  }

  // ---- combat ---------------------------------------------------------------
  function hurt(world, victim, attacker, dmg, kx, ky, atIdx) {
    if (victim.dead) return;
    victim.hp -= dmg;
    victim.flail = FLAIL_ON_HIT;
    victim.lastHitBy = attacker ? attacker.id : null;
    victim.lastHitAt = world.t;
    impulseAll(victim, kx, ky, 0.55);
    impulse(victim, atIdx, kx * 0.9, ky * 0.9);   // the struck limb whips
    world.fx.push({ k: 'hit', x: victim.pts[atIdx].x, y: victim.pts[atIdx].y, t: 14 });
    if (victim.hp <= 0) kill(world, victim, attacker);
  }

  function kill(world, victim, killer) {
    victim.hp = 0;
    victim.dead = true;
    victim.deaths++;
    victim.respawn = RESPAWN;
    victim.weapon = 'fist'; victim.ammo = 0;
    if (killer && killer.id !== victim.id) killer.kills++;
    world.fx.push({ k: 'die', x: victim.pts[CHEST].x, y: victim.pts[CHEST].y, t: 26 });
  }

  // Discarding is just letting go: the weapon is gone, not dropped. Bare hands
  // hit for 7 but swing twice as fast as a sword, so it is a real choice.
  function discardWeapon(p) {
    if (p.weapon === 'fist' || p.dead) return;
    p.weapon = 'fist';
    p.ammo = 0;
    p.cd = Math.max(p.cd, 10);
  }

  // ---- specials --------------------------------------------------------------
  // Both spend the weapon on use. The sword becomes one enormous spin that will
  // clear a ledge; the gun empties itself sideways in both directions. You are
  // bare-handed afterwards either way, which is the price.
  function startSpecial(world, p) {
    if (p.dead || p.spin > 0 || p.spray > 0) return;
    if (p.weapon === 'sword') {
      p.spin = SPIN_TICKS;
      p.spinAim = p.aim;
      p.spinHits = {};
      p.weapon = 'fist'; p.ammo = 0; p.cd = 0;
      var chest = p.pts[CHEST];
      // a small hop into the spin, and permission to leave the ground for it
      for (var i = 0; i < p.pts.length; i++) p.pts[i].oy += 5.5;
      p.jumpCool = SPIN_TICKS;
      world.fx.push({ k: 'spin', x: chest.x, y: chest.y, a: p.aim,
                      r: Math.round(WEAPONS.sword.reach * 1.25), t: 22, big: true });
    } else if (p.weapon === 'gun') {
      p.spray = SPRAY_SHOTS;
      p.sprayT = 0;
      p.sprayDir = Math.cos(p.aim) >= 0 ? 1 : -1;
      p.weapon = 'fist'; p.ammo = 0; p.cd = 0;
    }
  }

  function spinTick(world, p) {
    p.spin--;
    var chest = p.pts[CHEST];
    var reach = WEAPONS.sword.reach * 1.25;
    for (var id in world.players) {
      var q = world.players[id];
      if (q === p || q.dead || p.spinHits[id]) continue;
      for (var i = 0; i < q.pts.length; i++) {
        var dx = q.pts[i].x - chest.x, dy = q.pts[i].y - chest.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach) continue;
        p.spinHits[id] = 1;
        // thrown outward from the spin, not along an aim direction
        var nx = dx / (d || 1), ny = dy / (d || 1);
        hurt(world, q, p, SPIN_DMG, nx * SPIN_KNOCK, ny * SPIN_KNOCK - 3.5, i);
        break;
      }
    }
    if (p.spin <= 0) p.spinHits = null;
  }

  function sprayTick(world, p) {
    p.sprayT--;
    if (p.sprayT > 0) return;
    p.sprayT = SPRAY_EVERY;
    p.spray--;
    var chest = p.pts[CHEST];
    var side = p.sprayDir;
    p.sprayDir = -side;                              // alternate every shot
    var a = side > 0 ? 0 : Math.PI;
    a += (rnd(world.seed) - 0.5) * 0.16;             // a little spread
    var ax = Math.cos(a), ay = Math.sin(a);
    world.bullets.push({
      x: chest.x + ax * 20, y: chest.y + ay * 20,
      vx: ax * BULLET_SPEED, vy: ay * BULLET_SPEED,
      by: p.id, life: 90
    });
    impulse(p, CHEST, -ax * 1.4, -ay * 1.4);
    world.fx.push({ k: 'jab', x: chest.x + ax * 26, y: chest.y + ay * 26, a: a, r: 0, t: 6 });
  }

  function useWeapon(world, p) {
    var w = WEAPONS[p.weapon];
    if (p.cd > 0 || p.dead) return;
    p.cd = w.cd;
    var chest = p.pts[CHEST];
    var ax = Math.cos(p.aim), ay = Math.sin(p.aim);

    if (w.melee) {
      p.swing = SWING_TICKS;
      p.swingKind = p.weapon;
      p.swingAim = p.aim;
      if (p.weapon === 'sword') {
        world.fx.push({ k: 'slash', x: chest.x, y: chest.y, a: p.aim,
                        arc: w.arc, r: w.reach, t: 9, big: true });
      } else {
        // bare hands leave no slice path — just the thud where the fist lands
        world.fx.push({ k: 'jab', x: chest.x + ax * w.reach * 0.85,
                        y: chest.y + ay * w.reach * 0.85, a: p.aim, r: 0, t: 8 });
      }
      for (var id in world.players) {
        var q = world.players[id];
        if (q === p || q.dead) continue;
        var best = -1, bestD = 1e9;
        for (var i = 0; i < q.pts.length; i++) {
          var dx = q.pts[i].x - chest.x, dy = q.pts[i].y - chest.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > w.reach) continue;
          var ang = Math.atan2(dy, dx);
          var diff = Math.abs(normAngle(ang - p.aim));
          if (diff > w.arc * 0.5) continue;
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0) hurt(world, q, p, w.dmg, ax * w.knock, ay * w.knock - 2.2, best);
      }
    } else {
      world.bullets.push({
        x: chest.x + ax * 20, y: chest.y + ay * 20,
        vx: ax * BULLET_SPEED, vy: ay * BULLET_SPEED,
        by: p.id, life: 90
      });
      impulse(p, CHEST, -ax * w.recoil, -ay * w.recoil);
      p.ammo--;
      if (p.ammo <= 0) { p.weapon = 'fist'; p.ammo = 0; }
    }
  }

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function stepBullets(world) {
    for (var b = world.bullets.length - 1; b >= 0; b--) {
      var bl = world.bullets[b];
      var hit = false;
      for (var s = 0; s < 3 && !hit; s++) {          // substep so it cannot tunnel
        bl.x += bl.vx / 3; bl.y += bl.vy / 3;
        for (var id in world.players) {
          var q = world.players[id];
          if (q.dead || q.id === bl.by) continue;
          for (var i = 0; i < q.pts.length; i++) {
            var dx = q.pts[i].x - bl.x, dy = q.pts[i].y - bl.y;
            var rad = i === HEAD ? 9 : 7;
            if (dx * dx + dy * dy < rad * rad) {
              var w = WEAPONS.gun;
              var sp = Math.sqrt(bl.vx * bl.vx + bl.vy * bl.vy) || 1;
              hurt(world, q, world.players[bl.by], w.dmg,
                   bl.vx / sp * w.knock, bl.vy / sp * w.knock - 1.4, i);
              hit = true; break;
            }
          }
          if (hit) break;
        }
      }
      bl.life--;
      if (hit || bl.life <= 0 || bl.x < -20 || bl.x > W + 20 || bl.y < -20 || bl.y > VOID_Y) {
        world.bullets.splice(b, 1);
      }
    }
  }

  // A crate lands on top of a ledge, never in mid-air and never on top of
  // another one. Whichever weapon is missing from the map gets priority, so a
  // fight is never all swords or all guns for long.
  function spawnCrate(world) {
    var haveSword = false, haveGun = false, i;
    for (i = 0; i < world.pickups.length; i++) {
      if (world.pickups[i].kind === 'sword') haveSword = true; else haveGun = true;
    }
    var kind = !haveSword ? 'sword' : (!haveGun ? 'gun' : (rnd(world.seed) < 0.5 ? 'sword' : 'gun'));
    for (var tries = 0; tries < 14; tries++) {
      var pl = world.platforms[Math.floor(rnd(world.seed) * world.platforms.length)];
      var x = Math.round(pl.x + 24 + rnd(world.seed) * Math.max(1, pl.w - 48));
      var y = pl.y - 4;
      var clash = false;
      for (i = 0; i < world.pickups.length; i++) {
        var pk = world.pickups[i];
        if (Math.abs(pk.x - x) < 80 && Math.abs(pk.y - y) < 30) { clash = true; break; }
      }
      if (!clash) {
        world.pickups.push({ kind: kind, x: x, y: y });
        world.fx.push({ k: 'pick', x: x, y: y, t: 16 });
        return;
      }
    }
  }

  function stepPickups(world) {
    world.crateT--;
    if (world.crateT <= 0) {
      world.crateT = CRATE_EVERY;
      if (world.pickups.length < MAX_CRATES) spawnCrate(world);
    }
    for (var i = world.pickups.length - 1; i >= 0; i--) {
      var pk = world.pickups[i];
      for (var id in world.players) {
        var p = world.players[id];
        if (p.dead) continue;
        var hips = p.pts[HIPS];
        var dx = hips.x - pk.x, dy = hips.y - pk.y;
        if (dx * dx + dy * dy < 26 * 26) {
          p.weapon = pk.kind;
          p.ammo = WEAPONS[pk.kind].ammo;
          p.cd = Math.max(p.cd, 12);
          world.pickups.splice(i, 1);        // taken; another will drop in later
          world.fx.push({ k: 'pick', x: pk.x, y: pk.y, t: 16 });
          break;
        }
      }
    }
  }

  // ---- the tick -------------------------------------------------------------
  function step(world) {
    world.t++;

    for (var id in world.players) {
      var p = world.players[id];

      if (p.dead) {
        p.respawn--;
        if (p.respawn <= 0) {
          var sp = world.spawns[Math.floor(rnd(world.seed) * world.spawns.length)];
          placeBody(p, sp.x, sp.y);
          p.dead = false; p.hp = MAX_HP; p.flail = 0; p.cd = 0;
        } else {
          // A corpse tumbles where it can be seen, then parks. Left falling it
          // gains 100px a tick, and every point moving that far forces a full
          // keyframe into every snapshot for something nobody is looking at.
          if (p.pts[HIPS].y < VOID_Y + 140) {
            p.duckAmt = 1; integrate(p); solveLinks(p, 0.35); collide(world, p);
          }
          continue;
        }
      }

      if (p.cd > 0) p.cd--;
      if (p.flail > 0) p.flail--;
      if (p.swing > 0) p.swing--;
      p.aim = p.input.aim;
      p.duckAmt = (p.input.duck && p.grounded && p.flail <= 0) ? 0.58 : 1;

      // jump: shove the whole body up, once per press
      if (p.input.jump && p.grounded && p.flail <= 0 && !p._jumped) {
        for (var i = 0; i < p.pts.length; i++) p.pts[i].oy += 11.5;
        p._jumped = true;
        p.jumpCool = 14;         // do not damp the jump we just asked for
      }
      if (p.jumpCool > 0) p.jumpCool--;
      if (!p.input.jump) p._jumped = false;

      drive(p);
      integrate(p);
      var wasGrounded = p.grounded;
      for (var k = 0; k < 4; k++) {
        solveLinks(p, p.flail > 0 ? 0.75 : 1);
        pose(p, k === 0);
      }
      collide(world, p);

      // Only a jump, a hit, or a fall should get you off the ground. Rigid legs
      // vault the hips over the planted foot as you walk, and landing compresses
      // them like a spring — either can throw the body into the air by itself,
      // which reads as the stickman jumping at random and ignoring the controls.
      // Bleed off upward motion that nobody asked for.
      if (!p.dead && (p.grounded || wasGrounded) && p.flail <= 0 && p.jumpCool <= 0) {
        for (var d = 0; d < p.pts.length; d++) {
          var q = p.pts[d], vy = q.y - q.oy;
          if (vy < 0) q.oy = q.y - vy * 0.12;
        }
      }

      // Coyote time. A walking body's contact flickers as the stride passes over
      // the planted foot, and every flicker was a jump press being thrown away.
      // Six ticks of grace also means stepping off a ledge still lets you jump.
      if (p.grounded) p.coyote = 6;
      else if (p.coyote > 0) { p.coyote--; p.grounded = true; }

      if (p.input.fire) useWeapon(world, p);
      if (p.input.discard && !p._dropped) { discardWeapon(p); p._dropped = true; }
      if (!p.input.discard) p._dropped = false;
      if (p.input.special && !p._special) { startSpecial(world, p); p._special = true; }
      if (!p.input.special) p._special = false;
      if (p.spin > 0) spinTick(world, p);
      if (p.spray > 0) sprayTick(world, p);

      // the void
      var hips = p.pts[HIPS];
      if (hips.y > VOID_Y) {
        var killer = (world.t - p.lastHitAt < 240 && p.lastHitBy) ? world.players[p.lastHitBy] : null;
        kill(world, p, killer);
        p.respawn = RESPAWN;
      }
    }

    stepBullets(world);
    stepPickups(world);

    for (var f = world.fx.length - 1; f >= 0; f--) {
      if (--world.fx[f].t <= 0) world.fx.splice(f, 1);
    }
    return world;
  }

  // ---- net: compact snapshots ----------------------------------------------
  // Points are quantised to whole pixels; a 6-player room is a couple of KB/s.
  function snapshot(world) {
    var ps = [];
    for (var id in world.players) {
      var p = world.players[id];
      var xy = [];
      for (var i = 0; i < p.pts.length; i++) {
        xy.push(Math.round(p.pts[i].x), Math.round(p.pts[i].y));
      }
      ps.push([p.id, p.name, p.hp | 0, p.kills, p.deaths, p.dead ? 1 : 0,
               p.weapon, p.ammo, p.cd, Math.round(p.aim * 100) / 100, p.color, xy]);
    }
    var bs = [];
    for (var b = 0; b < world.bullets.length; b++) {
      var bl = world.bullets[b];
      bs.push([Math.round(bl.x), Math.round(bl.y), Math.round(bl.vx), Math.round(bl.vy)]);
    }
    var pk = [];
    for (var k = 0; k < world.pickups.length; k++) pk.push(world.pickups[k].taken > 0 ? 0 : 1);
    return { t: world.t, p: ps, b: bs, k: pk, f: world.fx };
  }

  function applySnapshot(world, s) {
    world.t = s.t;
    var seen = {};
    for (var i = 0; i < s.p.length; i++) {
      var r = s.p[i], id = r[0];
      seen[id] = 1;
      var p = world.players[id] || addPlayer(world, id, r[1], r[10]);
      p.name = r[1]; p.hp = r[2]; p.kills = r[3]; p.deaths = r[4];
      p.dead = !!r[5]; p.weapon = r[6]; p.ammo = r[7]; p.cd = r[8];
      p.aim = r[9]; p.color = r[10];
      var xy = r[11];
      for (var j = 0; j < p.pts.length; j++) {
        p.pts[j].ox = p.pts[j].x; p.pts[j].oy = p.pts[j].y;
        p.pts[j].x = xy[j * 2]; p.pts[j].y = xy[j * 2 + 1];
      }
    }
    for (var id2 in world.players) if (!seen[id2]) delete world.players[id2];
    world.bullets = s.b.map(function (b) { return { x: b[0], y: b[1], vx: b[2], vy: b[3], life: 60 }; });
    for (var k = 0; k < world.pickups.length && k < s.k.length; k++) {
      world.pickups[k].taken = s.k[k] ? 0 : 1;
    }
    world.fx = s.f || [];
    return world;
  }

  return {
    W: W, H: H, DT: DT, MAX_HP: MAX_HP, WEAPONS: WEAPONS, SWING_TICKS: SWING_TICKS,
    SPIN_TICKS: SPIN_TICKS, SPRAY_SHOTS: SPRAY_SHOTS,
    HEAD: HEAD, CHEST: CHEST, HIPS: HIPS, HANDL: HANDL, HANDR: HANDR,
    FOOTL: FOOTL, FOOTR: FOOTR, BONES: BONES, ARM: ARM,
    createWorld: createWorld, addPlayer: addPlayer, step: step,
    snapshot: snapshot, applySnapshot: applySnapshot, normAngle: normAngle
  };
});
