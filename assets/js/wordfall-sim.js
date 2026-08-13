/*
 * Wordfall — the simulation.
 *
 * Deliberately free of any DOM, canvas or wall-clock reference — the browser
 * runs this to predict its own actions, and a Cloudflare Durable Object runs
 * the very same file as the authoritative server for a room. Time only ever
 * enters as a `now` (ms) argument the caller supplies, same as the seed: it
 * keeps a server tick and a client's local prediction byte-for-byte
 * reproducible from the same inputs.
 *
 * There is no physics tick here, unlike stick fight. Nothing moves on its
 * own between keystrokes, so the whole match is just: a player finishes
 * typing a word, the server (or a predicting client) resolves one discrete
 * action, and cooldowns are plain "unlocks again at this timestamp" values
 * checked against `now`. No loop needed to keep those honest.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WordfallSim = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- grid -------------------------------------------------------------
  var MAP_SIZES = { small: 8, medium: 12, big: 16 };
  var DEFAULT_SIZE = 16;
  var FLOOR = 0, WALL = 1, RIVER = 2;
  var MAX_PLAYERS = 6;
  var MAX_HP = 100;

  function rnd(seedRef) { // small deterministic PRNG so server and predicting clients agree
    seedRef.s = (seedRef.s * 1664525 + 1013904223) % 4294967296;
    return seedRef.s / 4294967296;
  }

  function inBounds(x, y, w, h) { return x >= 0 && x < w && y >= 0 && y < h; }

  // Spines carve the map into rooms and corridors: a handful of long straight
  // walls, each with one or two doorway gaps, plus a couple of short stubs
  // branching off them so a room reads as a room instead of one bare
  // rectangle with a slit in it. Size comes from the grid itself, not a
  // fixed constant, so the same carving logic works at 8x8, 12x12 or 16x16.
  function carveWalls(grid, rs) {
    var h = grid.length, w = grid[0].length;
    var numSpines = 3 + Math.floor(rnd(rs) * 2); // 3-4
    var spines = [];
    for (var s = 0; s < numSpines; s++) {
      var horiz = rnd(rs) < 0.5;
      var pos = 2 + Math.floor(rnd(rs) * ((horiz ? h : w) - 4));
      spines.push({ horiz: horiz, pos: pos });
    }

    spines.forEach(function (spine) {
      var len = spine.horiz ? w : h;
      var doors = [];
      var numDoors = 1 + (rnd(rs) < 0.5 ? 1 : 0);
      for (var d = 0; d < numDoors; d++) {
        var doorAt = 1 + Math.floor(rnd(rs) * (len - 2));
        var doorW = 1 + Math.floor(rnd(rs) * 2);
        for (var wd = 0; wd < doorW; wd++) doors.push(doorAt + wd);
      }
      for (var i = 0; i < len; i++) {
        if (doors.indexOf(i) !== -1) continue;
        var x = spine.horiz ? i : spine.pos;
        var y = spine.horiz ? spine.pos : i;
        if (inBounds(x, y, w, h)) grid[y][x] = WALL;
      }

      var numStubs = 1 + Math.floor(rnd(rs) * 2);
      for (var k = 0; k < numStubs; k++) {
        var at = 2 + Math.floor(rnd(rs) * (len - 4));
        var stubLen = 2 + Math.floor(rnd(rs) * 4);
        var side = rnd(rs) < 0.5 ? -1 : 1;
        for (var j = 1; j <= stubLen; j++) {
          var sx = spine.horiz ? at : spine.pos + side * j;
          var sy = spine.horiz ? spine.pos + side * j : at;
          if (inBounds(sx, sy, w, h)) grid[sy][sx] = WALL;
        }
      }
    });
  }

  function floodFill(grid, blocks) {
    var h = grid.length, w = grid[0].length;
    var seen = [];
    for (var y = 0; y < h; y++) seen.push(new Array(w).fill(false));
    var comps = [];
    for (var y0 = 0; y0 < h; y0++) {
      for (var x0 = 0; x0 < w; x0++) {
        if (seen[y0][x0] || blocks.indexOf(grid[y0][x0]) !== -1) continue;
        var stack = [[x0, y0]], cells = [];
        seen[y0][x0] = true;
        while (stack.length) {
          var cur = stack.pop(), x = cur[0], y = cur[1];
          cells.push([x, y]);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var nx = x + d[0], ny = y + d[1];
            if (inBounds(nx, ny, w, h) && !seen[ny][nx] && blocks.indexOf(grid[ny][nx]) === -1) {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          });
        }
        comps.push(cells);
      }
    }
    return comps;
  }

  // If carving left isolated pockets, punch through the nearest blocking cell
  // between the pocket and the main region rather than regenerating the map.
  function ensureConnected(grid, blocks) {
    var guard = 0;
    while (guard++ < 200) {
      var comps = floodFill(grid, blocks);
      if (comps.length <= 1) return;
      comps.sort(function (a, b) { return b.length - a.length; });
      var main = comps[0], pocket = comps[1];
      var best = null, bestDist = Infinity;
      pocket.forEach(function (p) {
        main.forEach(function (m) {
          var dist = Math.abs(p[0] - m[0]) + Math.abs(p[1] - m[1]);
          if (dist < bestDist) { bestDist = dist; best = { p: p, m: m }; }
        });
      });
      var x = best.p[0], y = best.p[1], tx = best.m[0], ty = best.m[1];
      while (x !== tx || y !== ty) {
        if (x !== tx) x += x < tx ? 1 : -1;
        else if (y !== ty) y += y < ty ? 1 : -1;
        // Clear whatever is actually blocking here, not just WALL — the
        // second connectivity pass also blocks on RIVER, and a straight-line
        // path that happens to cross a river left it blocking, made this a
        // no-op, and the loop burned its whole guard without ever reconnecting.
        if (blocks.indexOf(grid[y][x]) !== -1) grid[y][x] = FLOOR;
      }
    }
  }

  // Rivers block walking exactly like walls, but a ranged attack passes over
  // them — the map should still read as "a river cuts the arena", so it is a
  // width-1 random walk biased to cross from one edge toward the opposite one
  // rather than wander forever.
  function carveRiver(grid, rs, vertical) {
    var h = grid.length, w = grid[0].length;
    var x, y, dx, dy;
    if (vertical) { x = Math.floor(rnd(rs) * w); y = 0; dx = 0; dy = 1; }
    else { x = 0; y = Math.floor(rnd(rs) * h); dx = 1; dy = 0; }
    var guard = 0;
    while (inBounds(x, y, w, h) && guard++ < w * h) {
      grid[y][x] = RIVER;
      if (rnd(rs) < 0.3) {
        if (vertical) x += rnd(rs) < 0.5 ? -1 : 1;
        else y += rnd(rs) < 0.5 ? -1 : 1;
        x = Math.max(0, Math.min(w - 1, x));
        y = Math.max(0, Math.min(h - 1, y));
        grid[y][x] = RIVER;
      }
      x += dx; y += dy;
    }
  }

  // Farthest-point sampling over floor tiles, so six spawns land spread across
  // the arena instead of clustered near whichever tile the PRNG hit first.
  function pickSpawns(grid, rs, count) {
    var h = grid.length, w = grid[0].length;
    var floorCells = [];
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++)
        if (grid[y][x] === FLOOR) floorCells.push([x, y]);

    var spawns = [floorCells[Math.floor(rnd(rs) * floorCells.length)]];
    while (spawns.length < count && spawns.length < floorCells.length) {
      var best = null, bestScore = -1;
      floorCells.forEach(function (c) {
        var minDist = Infinity;
        spawns.forEach(function (s) {
          var d = Math.abs(c[0] - s[0]) + Math.abs(c[1] - s[1]);
          if (d < minDist) minDist = d;
        });
        if (minDist > bestScore) { bestScore = minDist; best = c; }
      });
      spawns.push(best);
    }
    return spawns;
  }

  function buildMap(rs, w, h) {
    var grid = [];
    for (var y = 0; y < h; y++) grid.push(new Array(w).fill(FLOOR));
    carveWalls(grid, rs);
    ensureConnected(grid, [WALL]);
    var numRivers = 1 + (rnd(rs) < 0.5 ? 1 : 0);
    for (var r = 0; r < numRivers; r++) carveRiver(grid, rs, rnd(rs) < 0.5);
    ensureConnected(grid, [WALL, RIVER]);
    return grid;
  }

  // ---- classes & word pools ----------------------------------------------
  // Difficulty is obscurity/awkwardness, not raw length: at typing speed the
  // gap between a 4-letter and a 9-letter word is a fraction of a second, but
  // an unfamiliar word (it changes every use, so it never gets muscle-memoried)
  // costs real time regardless of how short it is.
  var CLASSES = {
    rogue: {
      words: {
        move: ['cat','dog','run','hop','zip','jog','tap','fox','dip','fly','bat','rat','hat','sit','sip','wag','tag','hip','lap','nap','pat','mat'],
        attack: ['fang','claw','jab','snip','nick','dart','flick','prick','slice','jolt','poke','stab','swipe','nip','cut','gore','gash','tear','rip','chop','slit','hack'],
        special: ['shadow','cloak','vanish','phantom','mirage','elusive','wraith','spectre','illusion','stealth','unseen','ghostly','veil','evasive','nightfall','obscure','fleeting','invisible','vapor','fade','blur']
      },
      attackShape: 'point', attackDmg: 14,
      special: { kind: 'vanish', durationMs: 3000, cooldownMs: 5000 }
    },
    fighter: {
      words: {
        move: ['stomp','march','charge','trudge','plod','lumber','wade','tromp','stamp','clomp','stride','plough','wallow','hobble','shuffle','stagger','waddle','clump','thump','pound','trample'],
        attack: ['cleave','slash','hew','smash','cleaver','sunder','rend','crush','batter','pummel','hammer','shatter','maul','gouge','bludgeon','thrash','wallop','clobber','ram','smite','demolish'],
        special: ['guardwall','bulwark','ironclad','phalanx','barricade','juggernaut','stonewall','fortress','vanguard','stalwart','rampart','blockade','garrison','formation','resilient','unbreakable','defiant','immovable','entrenched','bastion','impenetrable','indomitable']
      },
      attackShape: 'wide3', attackDmg: 12,
      special: { kind: 'shieldStun', dmg: 20, stunMs: 2000, cooldownMs: 7000 }
    },
    ranger: {
      words: {
        move: ['dash','sprint','stride','trek','scamper','weave','prowl','dodge','glide','scout','roam','hike','creep','skirt','flank','circle','drift','veer','tiptoe','sidestep','traverse'],
        attack: ['arrow','volley','snipe','pierce','skewer','longshot','shoot','quiver','bullseye','deadeye','marksman','impale','puncture','headshot','flight','aim','target','crossfire','trajectory','fletching'],
        special: ['snare','ambush','tripwire','decoy','stakeout','camouflage','pitfall','deadfall','lure','bait','concealed','hidden','sabotage','entangle','ensnare','trapdoor','covert','clandestine','lurking','waylay','entrap']
      },
      attackShape: 'line3', attackDmg: 15,
      special: { kind: 'trap', dmg: 18, stunMs: 2000, cooldownMs: 3000 }
    },
    mage: {
      words: {
        move: ['quicksand','labyrinth','zephyr','ponderous','cumbersome','encumber','staggering','lethargic','sluggishly','unwieldy','laborious','torpid','listless','arduous','faltering','stumbling','hindered','weighted','encumbered','burdened','exhausted'],
        attack: ['beam','lance','bolt','streak','torrent','cascade','surge','blast','ray','flare','current','channel','conduit','discharge','radiance','streaming','arcane','conjure','emission','projection'],
        special: ['sanctuary','restoration','rejuvenate','benediction','absolution','resurgence','convalesce','renewal','regenerate','revitalize','redemption','salvation','restorative','invigorate','replenish','recuperate','consecration','purification','sanctify','wellspring']
      },
      attackShape: 'beamInf', attackDmg: 16,
      special: { kind: 'heal', amount: 30, cooldownMs: 8000 }
    }
  };

  var SLOTS = ['moveUp', 'moveDown', 'moveLeft', 'moveRight',
               'atkUp', 'atkDown', 'atkLeft', 'atkRight', 'special'];
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function slotPool(cls, slot) {
    if (slot === 'special') return CLASSES[cls].words.special;
    if (slot.indexOf('move') === 0) return CLASSES[cls].words.move;
    return CLASSES[cls].words.attack;
  }

  // `avoid` is every word currently live in one of the player's other 8 slots,
  // not just this slot's own last word — two directions sharing a word by
  // chance would make a submitted word ambiguous about which action it meant.
  function pickWord(pool, rs, avoid) {
    var choices = pool.filter(function (w) { return avoid.indexOf(w) === -1; });
    if (!choices.length) choices = pool;   // pool exhausted by an unlucky avoid set
    return choices[Math.floor(rnd(rs) * choices.length)];
  }

  function otherWords(p, exceptSlot) {
    var out = [];
    for (var s in p.words) if (s !== exceptSlot && p.words[s]) out.push(p.words[s]);
    return out;
  }

  // ---- world ---------------------------------------------------------------
  // `size` is a MAP_SIZES key ('small'/'medium'/'big'), a raw tile count, or
  // omitted for the default — resolved once here so nothing downstream needs
  // to know grid dimensions are a per-match choice rather than a constant.
  function createWorld(seed, playerCount, size) {
    var n = MAP_SIZES[size] || (typeof size === 'number' && size > 0 ? size : DEFAULT_SIZE);
    var rs = { s: (seed || 12345) >>> 0 };
    var grid = buildMap(rs, n, n);
    var spawns = pickSpawns(grid, rs, playerCount || MAX_PLAYERS);
    return {
      seed: seed, rs: rs, grid: grid, spawns: spawns, w: n, h: n,
      players: {},        // id -> player state
      occupancy: {},       // "x,y" -> id
      traps: {},           // id -> {x,y} (owner's active trap, one at a time)
      alive: 0
    };
  }

  function key(x, y) { return x + ',' + y; }

  function addPlayer(world, id, name, cls) {
    var spawn = world.spawns[world.alive % world.spawns.length];
    var p = {
      id: id, name: name, cls: cls, hp: MAX_HP, dead: false,
      x: spawn[0], y: spawn[1],
      words: {}, stunnedUntil: 0, vanishUntil: 0, specialCooldownUntil: 0
    };
    SLOTS.forEach(function (slot) {
      p.words[slot] = pickWord(slotPool(cls, slot), world.rs, otherWords(p, slot));
    });
    world.players[id] = p;
    world.occupancy[key(p.x, p.y)] = id;
    world.alive++;
    return p;
  }

  function removePlayer(world, id) {
    var p = world.players[id];
    if (!p) return;
    if (!p.dead) world.alive--;
    delete world.occupancy[key(p.x, p.y)];
    delete world.traps[id];
    delete world.players[id];
  }

  function isStunned(p, now) { return p.stunnedUntil > now; }
  function isVanished(p, now) { return p.vanishUntil > now; }

  function walkable(world, x, y) {
    if (!inBounds(x, y, world.w, world.h)) return false;
    var t = world.grid[y][x];
    if (t === WALL || t === RIVER) return false;
    return !world.occupancy[key(x, y)];
  }

  // Returns both who got hit and every cell the shape actually swept (whether
  // occupied or not) — the client needs the full sweep to draw the attack
  // itself, not just its consequences.
  function targetsInShape(world, actor, dir, shape) {
    var gw = world.w, gh = world.h;
    if (shape === 'self3x3') {
      var hits3 = [], tiles3 = [];
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var sx = actor.x + dx, sy = actor.y + dy;
          if (!inBounds(sx, sy, gw, gh) || world.grid[sy][sx] === WALL) continue;
          tiles3.push([sx, sy]);
          var sid = world.occupancy[key(sx, sy)];
          if (sid) hits3.push(sid);
        }
      }
      return { hits: hits3, tiles: tiles3 };
    }
    var d = DIRS[dir], hits = [], tiles = [];
    if (shape === 'point') {
      var x = actor.x + d[0], y = actor.y + d[1];
      if (inBounds(x, y, gw, gh) && world.grid[y][x] !== WALL) {
        tiles.push([x, y]);
        var id = world.occupancy[key(x, y)];
        if (id) hits.push(id);
      }
    } else if (shape === 'wide3') {
      // a row of three at depth 1, perpendicular to the attack direction
      var perp = d[0] !== 0 ? [0, 1] : [1, 0];
      for (var i = -1; i <= 1; i++) {
        var wx = actor.x + d[0] + perp[0] * i, wy = actor.y + d[1] + perp[1] * i;
        if (!inBounds(wx, wy, gw, gh) || world.grid[wy][wx] === WALL) continue;
        tiles.push([wx, wy]);
        var wid = world.occupancy[key(wx, wy)];
        if (wid) hits.push(wid);
      }
    } else if (shape === 'line3' || shape === 'beamInf') {
      var max = shape === 'line3' ? 3 : Math.max(gw, gh);
      for (var step = 1; step <= max; step++) {
        var lx = actor.x + d[0] * step, ly = actor.y + d[1] * step;
        if (!inBounds(lx, ly, gw, gh)) break;
        if (world.grid[ly][lx] === WALL) break;   // walls stop a line; rivers don't
        tiles.push([lx, ly]);
        var lid = world.occupancy[key(lx, ly)];
        if (lid) hits.push(lid);
      }
    }
    return { hits: hits, tiles: tiles };
  }

  // Resolves one completed word against one action slot. Returns a result
  // object describing what happened (for the caller to broadcast/apply), or
  // null if the action could not be taken (dead, stunned, on cooldown).
  function resolveAction(world, id, slot, now) {
    var p = world.players[id];
    if (!p || p.dead) return null;
    if (isStunned(p, now)) return null;

    var def = CLASSES[p.cls];
    var result = { id: id, slot: slot, ok: false };

    if (slot.indexOf('move') === 0) {
      var dir = slot.slice(4).toLowerCase();
      var d = DIRS[dir];
      var nx = p.x + d[0], ny = p.y + d[1];
      if (!walkable(world, nx, ny)) { rerollWord(world, p, slot); return result; }
      delete world.occupancy[key(p.x, p.y)];
      p.x = nx; p.y = ny;
      world.occupancy[key(p.x, p.y)] = id;
      result.ok = true; result.x = p.x; result.y = p.y;

      var trapHit = findTrapAt(world, p.x, p.y, id);
      if (trapHit) {
        var trapDef = CLASSES[world.players[trapHit.owner] ? world.players[trapHit.owner].cls : 'ranger'].special;
        applyDamage(world, id, trapDef.dmg, now, result);
        p.stunnedUntil = now + trapDef.stunMs;
        delete world.traps[trapHit.owner];
        result.trapTriggered = { owner: trapHit.owner };
      }
    } else if (slot.indexOf('atk') === 0) {
      var adir = slot.slice(3).toLowerCase();
      // Vanish hides a player's position from opponents' screens, but the hit
      // detection below is always against real position — an attack that
      // happens to land on a vanished tile still connects, and connecting is
      // exactly what breaks the vanish (see applyDamage).
      var swept = targetsInShape(world, p, adir, def.attackShape);
      var hits = swept.hits.filter(function (hid) { return hid !== id; });
      result.ok = true; result.dir = adir; result.tiles = swept.tiles; result.hits = [];
      hits.forEach(function (hid) { applyDamage(world, hid, def.attackDmg, now, result); });
    } else if (slot === 'special') {
      if (p.specialCooldownUntil > now) { return result; }
      result.ok = true;
      result.special = def.special.kind;
      p.specialCooldownUntil = now + def.special.cooldownMs;
      if (def.special.kind === 'vanish') {
        p.vanishUntil = now + def.special.durationMs;
      } else if (def.special.kind === 'shieldStun') {
        var sswept = targetsInShape(world, p, null, 'self3x3');
        var shits = sswept.hits.filter(function (hid) { return hid !== id; });
        result.tiles = sswept.tiles; result.hits = [];
        shits.forEach(function (hid) {
          applyDamage(world, hid, def.special.dmg, now, result);
          world.players[hid].stunnedUntil = now + def.special.stunMs;
        });
      } else if (def.special.kind === 'trap') {
        world.traps[id] = { x: p.x, y: p.y };
        result.trapPlaced = { x: p.x, y: p.y };
      } else if (def.special.kind === 'heal') {
        p.hp = Math.min(MAX_HP, p.hp + def.special.amount);
        result.healedTo = p.hp;
      }
    }

    rerollWord(world, p, slot);
    return result;
  }

  function findTrapAt(world, x, y, steppingId) {
    for (var owner in world.traps) {
      if (owner === steppingId) continue;
      var t = world.traps[owner];
      if (t.x === x && t.y === y) return { owner: owner };
    }
    return null;
  }

  function applyDamage(world, targetId, dmg, now, result) {
    var t = world.players[targetId];
    if (!t || t.dead) return;
    t.hp -= dmg;
    var revealed = isVanished(t, now);
    if (revealed) t.vanishUntil = now;   // a landed hit breaks vanish immediately
    var entry = { id: targetId, dmg: dmg, hp: Math.max(0, t.hp) };
    if (revealed) entry.revealed = true;
    if (result.hits) result.hits.push(entry);
    else result.hits = [entry];
    if (t.hp <= 0 && !t.dead) {
      t.dead = true;
      t.hp = 0;
      delete world.occupancy[key(t.x, t.y)];
      delete world.traps[targetId];
      world.alive--;
    }
  }

  function rerollWord(world, p, slot) {
    p.words[slot] = pickWord(slotPool(p.cls, slot), world.rs, otherWords(p, slot));
  }

  // Last one standing: null while the match is still contested, a player id
  // once exactly one remains (or nobody, on a mutual last-hit — a draw).
  function checkWinner(world) {
    if (world.alive > 1) return undefined;
    var last = null, count = 0;
    for (var id in world.players) {
      if (!world.players[id].dead) { last = id; count++; }
    }
    return count === 1 ? last : null;
  }

  return {
    MAP_SIZES: MAP_SIZES, DEFAULT_SIZE: DEFAULT_SIZE, FLOOR: FLOOR, WALL: WALL, RIVER: RIVER,
    MAX_PLAYERS: MAX_PLAYERS, MAX_HP: MAX_HP, CLASSES: CLASSES, SLOTS: SLOTS,
    createWorld: createWorld, addPlayer: addPlayer, removePlayer: removePlayer,
    resolveAction: resolveAction, checkWinner: checkWinner,
    isStunned: isStunned, isVanished: isVanished
  };
});
