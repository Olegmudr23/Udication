import test from "node:test";
import assert from "node:assert/strict";
import { defaults, finish, initialState, parseSettings, restoreTimer, tick } from "../lib/timer.ts";

test("a background tab completes exactly one session and prepares a break", () => {
  const now = Date.now();
  const state = { ...initialState(defaults, now), deadline: now + 1500000 };
  const done = tick(state, defaults, now + 3600000);
  assert.equal(done.completed, 1);
  assert.equal(done.minutes, 25);
  assert.equal(done.mode, "short");
  assert.equal(done.deadline, null);
  assert.deepEqual(tick(done, defaults, now + 3601000), done);
});

test("every fourth completed focus leads to a long break; skipping earns no session", () => {
  const state = { ...initialState(), cycle: 3 };
  assert.equal(finish(state, defaults, Date.now()).mode, "long");
  const skipped = finish(state, defaults, Date.now(), true);
  assert.equal(skipped.completed, 0);
  assert.equal(skipped.cycle, 3);
  assert.equal(skipped.mode, "short");
});

test("reload restores a running deadline and rollover resets daily statistics", () => {
  const now = Date.now();
  const state = { ...initialState(), deadline: now + 10000, completed: 2 };
  assert.equal(restoreTimer(state, defaults, now + 5000).remaining, 5);
  const old = { ...state, deadline: null, day: "2000-1-1", minutes: 50 };
  assert.equal(tick(old, defaults, now).completed, 0);
  assert.equal(tick(old, defaults, now).minutes, 0);
});

test("invalid saved preferences are replaced and auto-start uses a fresh deadline", () => {
  assert.deepEqual(parseSettings({ focus: -1, short: "10", long: 1000 }), defaults);
  const now = Date.now();
  const done = finish(initialState(), { ...defaults, autoStart: true }, now);
  assert.equal(done.deadline, now + 300000);
});

test("four work and rest cycles use 25/5 minutes then a 15 minute long break", () => {
  const now = new Date(2026, 9, 11, 12).getTime();
  let state = initialState(defaults, now);
  for (let cycle = 1; cycle <= 4; cycle++) {
    assert.equal(state.mode, "focus");
    assert.equal(state.remaining, 25 * 60);
    state = finish(state, defaults, now + cycle * 3600000);
    assert.equal(state.mode, cycle === 4 ? "long" : "short");
    assert.equal(state.remaining, cycle === 4 ? 15 * 60 : 5 * 60);
    state = finish(state, defaults, now + cycle * 3600000 + 1000000);
  }
  assert.equal(state.completed, 4);
  assert.equal(state.history.length, 8);
  assert.equal(state.mode, "focus");
  assert.equal(parseSettings({ long: 30 }).long, 30);
  assert.equal(parseSettings({ long: 5 }).long, 15);
  assert.equal(parseSettings({ long: 60 }).long, 15);
});

test("history records task, duration and actual deadline once and survives reload", () => {
  const now = Date.now();
  const state = { ...initialState(), sessionTask: "Конспект", deadline: now - 1000 };
  const done = tick(state, defaults, now);
  assert.deepEqual(done.history[0], {
    id: `${now - 1000}-focus-0`, mode: "focus", minutes: 25, endedAt: now - 1000, task: "Конспект",
  });
  assert.equal(done.alarmId, done.history[0].id);
  const restored = restoreTimer(JSON.parse(JSON.stringify(done)), defaults, now + 1000);
  assert.deepEqual(restored.history, done.history);
  assert.equal(restored.alarmId, done.alarmId);
  assert.equal(tick(restored, defaults, now + 2000).history.length, 1);
  assert.equal(finish(restored, defaults, now, true).history.length, 1);
});

test("yesterday's late completion keeps its date and does not count toward today's totals", () => {
  const now = new Date(2026, 9, 12, 9).getTime();
  const deadline = new Date(2026, 9, 11, 23, 30).getTime();
  const state = { ...initialState(defaults, deadline), deadline };
  const done = restoreTimer(state, defaults, now);
  assert.equal(done.history[0].endedAt, deadline);
  assert.equal(done.completed, 0);
  assert.equal(done.cycle, 1);
  const malformed = restoreTimer({ ...done, history: [null, {}, ...done.history, ...done.history] }, defaults, now);
  assert.equal(malformed.history.length, 1);
});
