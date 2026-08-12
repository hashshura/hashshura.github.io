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
  // Portrait, because a phone is portrait: the whole arena fits a phone screen
  // at a readable size, so nobody needs a zoomed-in camera and everybody sees the
  // same map. Roughly 7 bodies wide and 11 tall — a climbing map, which suits
  // knockback being the thing that kills you.
  var W = 420, H = 660;
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
  var PICKUP_RESPAWN = 420; // 7s
  var MAX_HP = 100;
  var FLAIL_ON_HIT = 26;    // ticks of limp ragdoll after being hit

  function rnd(seedRef) { // small deterministic PRNG so server and replays agree
    seedRef.s = (seedRef.s * 1664525 + 1013904223) % 4294967296;
    return seedRef.s / 4294967296;
  }

  // ---- world ----------------------------------------------------------------
  function createWorld(seed) {
    return {
      t: 0,
      w: W, h: H,
      seed: { s: (seed || 12345) >>> 0 },
      // platforms floating over a void; falling off is a real way to die
      // Stacked decks about 90px apart — a jump clears ~139px — staggered so you
      // climb by alternating sides. The bottom deck is narrower than the arena, so
      // there is a pit on both sides of it and no safe floor anywhere.
      platforms: [
        { x: 75,  y: 600, w: 270, h: 14 },
        { x: 15,  y: 514, w: 140, h: 12 },
        { x: 265, y: 514, w: 140, h: 12 },
        { x: 140, y: 428, w: 140, h: 12 },
        { x: 20,  y: 342, w: 130, h: 12 },
        { x: 270, y: 342, w: 130, h: 12 },
        { x: 135, y: 256, w: 150, h: 12 },
        { x: 15,  y: 170, w: 120, h: 12 },
        { x: 285, y: 170, w: 120, h: 12 }
      ],
      spawns: [ {x:210,y:590}, {x:85,y:504}, {x:335,y:504}, {x:210,y:418},
                {x:85,y:332}, {x:335,y:332}, {x:210,y:246}, {x:75,y:160} ],
      pickups: [
        { kind: 'sword', x: 210, y: 252, taken: 0 },
        { kind: 'sword', x: 210, y: 424, taken: 0 },
        { kind: 'gun',   x: 85,  y: 510, taken: 0 },
        { kind: 'gun',   x: 335, y: 510, taken: 0 },
        { kind: 'gun',   x: 75,  y: 166, taken: 0 },
        { kind: 'gun',   x: 345, y: 166, taken: 0 }
      ],
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
      aim: 0, walk: 0, stride: 0, duckAmt: 1, lastHitBy: null, lastHitAt: -999,
      pts: [], input: { l: 0, r: 0, jump: 0, duck: 0, fire: 0, aim: 0 }
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
      // ducking is bent knees: the leg links simply get shorter
      var want = (L[0] === HIPS && (L[1] === FOOTL || L[1] === FOOTR))
        ? L[2] * p.duckAmt : L[2];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
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
      // On a living body only the feet and hips are solid. Letting a hand or the
      // head land on a platform means any jump that brushes a ledge leaves you
      // dangling from an arm, which is reproducible and looks broken. A corpse is
      // solid all over, so it still tumbles and settles on whatever it lands on.
      var solid = p.dead || i === FOOTL || i === FOOTR || i === HIPS;
      var planted = false;
      if (solid) {
        for (var j = 0; j < world.platforms.length; j++) {
          var pl = world.platforms[j];
          if (q.x < pl.x - 3 || q.x > pl.x + pl.w + 3) continue;
          // Land either by crossing the top surface this tick (however fast), or
          // by already standing on this platform and having sagged a few px into
          // it. Without that second case a planted foot that drifts down by more
          // than a pixel is lost for good and the body falls through the world.
          var crossed = q.oy <= pl.y + 1 && q.y >= pl.y;
          var resting = q.g === pl.y && q.y >= pl.y - 2 && q.y < pl.y + 10;
          if (crossed || resting) {
            q.y = pl.y;
            var vx = q.x - q.ox;
            q.oy = q.y;
            q.ox = q.x - vx * 0.72;        // friction
            q.g = pl.y;
            planted = true;
            // hips count as footing too, or landing rump-first on a ledge leaves
            // you sitting there unable to jump
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

  function pose(p) {
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

    // The weapon arm points where you aim; the other arm counterposes.
    var aimPow = p.flail > 0 ? 0.15 : 1;
    pull(p.pts[HANDR], chest, chest.x + Math.cos(p.aim) * ARM,
         chest.y + Math.sin(p.aim) * ARM, 0.35 * aimPow);
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

  function useWeapon(world, p) {
    var w = WEAPONS[p.weapon];
    if (p.cd > 0 || p.dead) return;
    p.cd = w.cd;
    var chest = p.pts[CHEST];
    var ax = Math.cos(p.aim), ay = Math.sin(p.aim);

    if (w.melee) {
      world.fx.push({ k: 'slash', x: chest.x, y: chest.y, a: p.aim,
                      arc: w.arc, r: w.reach, t: 9, big: p.weapon === 'sword' });
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

  function stepPickups(world) {
    for (var i = 0; i < world.pickups.length; i++) {
      var pk = world.pickups[i];
      if (pk.taken > 0) { pk.taken--; continue; }
      for (var id in world.players) {
        var p = world.players[id];
        if (p.dead) continue;
        var hips = p.pts[HIPS];
        var dx = hips.x - pk.x, dy = hips.y - pk.y;
        if (dx * dx + dy * dy < 26 * 26) {
          p.weapon = pk.kind;
          p.ammo = WEAPONS[pk.kind].ammo;
          p.cd = Math.max(p.cd, 12);
          pk.taken = PICKUP_RESPAWN;
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
          p.duckAmt = 1; integrate(p); solveLinks(p, 0.35); collide(world, p);  // corpse keeps tumbling
          continue;
        }
      }

      if (p.cd > 0) p.cd--;
      if (p.flail > 0) p.flail--;
      p.aim = p.input.aim;
      p.duckAmt = (p.input.duck && p.grounded && p.flail <= 0) ? 0.58 : 1;

      // jump: shove the whole body up, once per press
      if (p.input.jump && p.grounded && p.flail <= 0 && !p._jumped) {
        for (var i = 0; i < p.pts.length; i++) p.pts[i].oy += 11.5;
        p._jumped = true;
      }
      if (!p.input.jump) p._jumped = false;

      drive(p);
      integrate(p);
      for (var k = 0; k < 4; k++) {
        solveLinks(p, p.flail > 0 ? 0.75 : 1);
        pose(p);
      }
      collide(world, p);

      if (p.input.fire) useWeapon(world, p);

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
    W: W, H: H, DT: DT, MAX_HP: MAX_HP, WEAPONS: WEAPONS,
    HEAD: HEAD, CHEST: CHEST, HIPS: HIPS, HANDL: HANDL, HANDR: HANDR,
    FOOTL: FOOTL, FOOTR: FOOTR, BONES: BONES, ARM: ARM,
    createWorld: createWorld, addPlayer: addPlayer, step: step,
    snapshot: snapshot, applySnapshot: applySnapshot, normAngle: normAngle
  };
});
