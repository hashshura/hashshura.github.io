/*
 * Roomkit — the social half of a multiplayer room.
 *
 * Two games in this repo put strangers in a room together, and the games
 * themselves have nothing in common: one is a ragdoll brawl at 60Hz, the other
 * is a turn-based word game. But everything around the game is the same problem
 * twice — who is here, what are they called, are they ready, how does a friend
 * get in, and how do you get your seat back when the train goes into a tunnel.
 * That part lives here, and it is deliberately ignorant of both simulations: it
 * never sees a world, a tick, or a word list.
 *
 * Runs unchanged in a Durable Object and in node, same as the sim files, so the
 * tests can drive it without a Worker.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomKit = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- names ---------------------------------------------------------------

  // One place to decide what a name is allowed to be, because the answer has to
  // match in three: the join URL, the in-room rename, and whatever the menu put
  // in localStorage. Control characters go because they can break the layout of
  // everyone else's roster, which is a nasty thing to be able to do to a room.
  function cleanName(raw, max, fallback) {
    var s = String(raw == null ? '' : raw).replace(/[\x00-\x1f\x7f]/g, '').trim();
    s = s.slice(0, max || 12).trim();
    return s || (fallback === undefined ? '' : fallback);
  }

  // ---- invites -------------------------------------------------------------

  // An invite key stands in for the password, so a link can be handed to someone
  // without also handing over the password itself — and so it can be revoked by
  // remaking the room rather than by changing something the host has memorised.
  function makeInvite() { return rand(9); }

  // A token means "this is me coming back". Longer than an invite because it is
  // the only thing standing between a stranger and someone else's seat.
  function makeToken() { return rand(12); }

  function rand(n) {
    var b = new Uint8Array(n);
    (typeof crypto !== 'undefined' ? crypto : root.crypto).getRandomValues(b);
    return Array.prototype.join.call(b, '');
  }

  // Compared in constant time. The saving is theoretical at this scale, but a
  // timing-safe compare costs nothing to write and the alternative is explaining
  // one day why it was fine to leak the key one byte at a time.
  function sameSecret(a, b) {
    a = String(a || ''); b = String(b || '');
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // The room is open, or the key is right, or the password is. Passwords are
  // hashed by the caller, which owns the salt.
  function inviteOk(meta, key) {
    return !!(meta && meta.invite && sameSecret(key, meta.invite));
  }

  function inviteLink(base, code, key) {
    return base + '?room=' + encodeURIComponent(code) +
      (key ? '&key=' + encodeURIComponent(key) : '');
  }

  // ---- seats ---------------------------------------------------------------

  /*
   * Who is in the room, including the people who are only mostly in the room.
   *
   * A dropped connection does not free the seat straight away. It is marked away
   * and held for a grace period, so that a phone that lost signal for eight
   * seconds comes back to its own seat — its name, its slot, its score — instead
   * of arriving as a stranger with nothing. That is the whole reason seats are
   * kept separately from sockets: the socket is the thing that broke.
   *
   * `extra` is whatever the game wants to keep per player. Roomkit never looks
   * inside it, only carries it across the reconnect.
   */
  function Seats(opts) {
    opts = opts || {};
    this.max = opts.max || 6;
    this.graceMs = opts.graceMs === undefined ? 20000 : opts.graceMs;
    this.list = [];          // seat objects, in no particular order
    this.nextId = 1;
    this.prefix = opts.prefix || 'p';
  }

  // The lowest free slot, so colours and wire indices stay small and stable
  // rather than climbing forever as people come and go.
  Seats.prototype.freeSlot = function () {
    for (var i = 0; i < this.max; i++) {
      var taken = false;
      for (var j = 0; j < this.list.length; j++) if (this.list[j].slot === i) { taken = true; break; }
      if (!taken) return i;
    }
    return -1;
  };

  Seats.prototype.byToken = function (token) {
    if (!token) return null;
    for (var i = 0; i < this.list.length; i++) {
      if (sameSecret(this.list[i].token, token)) return this.list[i];
    }
    return null;
  };

  Seats.prototype.byId = function (id) {
    for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) return this.list[i];
    return null;
  };

  Seats.prototype.all = function () { return this.list.slice(); };
  Seats.prototype.live = function () {
    return this.list.filter(function (s) { return !!s.ws; });
  };
  Seats.prototype.away = function () {
    return this.list.filter(function (s) { return !s.ws; });
  };

  /*
   * Someone has connected. Either they are coming back to a seat they already
   * hold, or they are new and need one.
   *
   * Returns {seat, reused}. A null seat means the room is full — and note that a
   * returning player is never turned away for fullness, because their seat was
   * never given to anyone else.
   */
  Seats.prototype.claim = function (o) {
    o = o || {};
    var back = this.byToken(o.token);
    if (back) {
      back.ws = o.ws || null;
      back.goneAt = 0;
      back.seenAt = now();
      if (o.name) back.name = o.name;
      return { seat: back, reused: true };
    }
    var slot = this.freeSlot();
    if (slot < 0) return { seat: null, reused: false };
    var seat = {
      id: this.prefix + (this.nextId++),
      slot: slot,
      name: o.name || 'anon',
      token: makeToken(),
      ready: false,
      ws: o.ws || null,
      goneAt: 0,
      seenAt: now(),
      extra: o.extra || {}
    };
    this.list.push(seat);
    return { seat: seat, reused: false };
  };

  // The socket went away. The seat does not, yet.
  Seats.prototype.release = function (seat) {
    if (!seat) return;
    seat.ws = null;
    seat.goneAt = now();
    seat.ready = false;      // nobody can hold a room ready from a dead socket
  };

  Seats.prototype.remove = function (seat) {
    var i = this.list.indexOf(seat);
    if (i >= 0) this.list.splice(i, 1);
  };

  // Called on a slow timer. Returns the seats that have now really gone, so the
  // caller can tell the room and tidy up whatever it was keeping for them.
  Seats.prototype.sweep = function (t) {
    t = t || now();
    var gone = [], keep = [];
    for (var i = 0; i < this.list.length; i++) {
      var s = this.list[i];
      if (!s.ws && s.goneAt && t - s.goneAt > this.graceMs) gone.push(s);
      else keep.push(s);
    }
    this.list = keep;
    return gone;
  };

  // ---- the ready gate ------------------------------------------------------

  /*
   * Everybody presses Ready, a countdown runs, the thing starts.
   *
   * The countdown exists so that the last person to press does not start the
   * match in the same instant — they need a moment to put their thumbs back. It
   * is cancelled by anything that changes who is waiting: a player un-readying,
   * a player arriving, a player leaving. Arriving matters as much as the others,
   * because a joiner who lands during the countdown would otherwise be dropped
   * into a match they never agreed to.
   *
   * `members()` is asked for the current roster each time rather than the gate
   * keeping its own copy, so it can never disagree with the room about who is
   * here — which is the bug this shape is designed to make impossible.
   */
  function ReadyGate(opts) {
    opts = opts || {};
    this.members = opts.members;                    // () -> [seat]
    this.min = opts.min === undefined ? 2 : opts.min;
    this.countdownMs = opts.countdownMs === undefined ? 3000 : opts.countdownMs;
    this.onStart = opts.onStart || function () {};
    this.onChange = opts.onChange || function () {};
    this.timer = null;
    this.endsAt = 0;
    this.armed = true;
  }

  ReadyGate.prototype.satisfied = function () {
    var m = this.members();
    if (m.length < this.min) return false;
    for (var i = 0; i < m.length; i++) if (!m[i].ready) return false;
    return true;
  };

  ReadyGate.prototype.counting = function () { return !!this.timer; };

  // Set one player's flag and re-decide. Everything else here funnels through
  // this, so there is exactly one place where a countdown can begin.
  ReadyGate.prototype.set = function (seat, ready) {
    if (!seat) return;
    seat.ready = !!ready;
    this.evaluate();
  };

  ReadyGate.prototype.clear = function () {
    var m = this.members();
    for (var i = 0; i < m.length; i++) m[i].ready = false;
    this.cancel();
  };

  // The roster changed under us. Someone arriving is as much a reason to stop
  // counting as someone leaving.
  ReadyGate.prototype.rosterChanged = function () {
    this.cancel();
    this.evaluate();
  };

  ReadyGate.prototype.cancel = function () {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; this.endsAt = 0; }
  };

  ReadyGate.prototype.disarm = function () { this.armed = false; this.cancel(); };
  ReadyGate.prototype.arm = function () { this.armed = true; this.evaluate(); };

  ReadyGate.prototype.evaluate = function () {
    if (!this.armed || !this.satisfied()) { this.cancel(); this.onChange(); return; }
    if (this.timer) { this.onChange(); return; }
    var self = this;
    this.endsAt = now() + this.countdownMs;
    this.timer = setTimeout(function () {
      self.timer = null; self.endsAt = 0;
      // Checked again on the way out: three seconds is plenty of time for the
      // room to have stopped agreeing, and a cancel that raced the timer would
      // otherwise start a match nobody is waiting for.
      if (self.armed && self.satisfied()) self.onStart();
      else self.onChange();
    }, this.countdownMs);
    this.onChange();
  };

  ReadyGate.prototype.state = function () {
    return { counting: this.counting(), endsAt: this.endsAt || null };
  };

  function now() { return Date.now(); }

  return {
    cleanName: cleanName,
    makeInvite: makeInvite,
    makeToken: makeToken,
    inviteOk: inviteOk,
    inviteLink: inviteLink,
    sameSecret: sameSecret,
    Seats: Seats,
    ReadyGate: ReadyGate
  };
});
