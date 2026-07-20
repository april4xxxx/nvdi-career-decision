import test from "node:test";
import assert from "node:assert/strict";
import { calculateTaskEconomy, energyTierForMinutes, recoveryTierForMinutes } from "../api/_lib/economy.js";

test("maps duration to fixed energy and gold tiers", () => {
  assert.equal(energyTierForMinutes(30), "LIGHT");
  assert.equal(energyTierForMinutes(31), "MEDIUM");
  assert.equal(energyTierForMinutes(91), "HEAVY");
  assert.deepEqual(calculateTaskEconomy({ cat: "main", durationMinutes: 60 }), {
    durationMinutes: 60,
    energyTier: "MEDIUM",
    energy: 20,
    gold: 20,
    restore: 0
  });
});

test("recovery tasks use independent recovery tiers and grant no gold", () => {
  assert.deepEqual(calculateTaskEconomy({ cat: "mystic", durationMinutes: 30 }), {
    durationMinutes: 30,
    energyTier: "STANDARD",
    energy: 0,
    gold: 0,
    restore: 20
  });
});

test("uses 10/20/30 values with separate task and recovery boundaries", () => {
  assert.equal(calculateTaskEconomy({ cat: "daily", durationMinutes: 30 }).energy, 10);
  assert.equal(calculateTaskEconomy({ cat: "daily", durationMinutes: 90 }).energy, 20);
  assert.equal(calculateTaskEconomy({ cat: "daily", durationMinutes: 240 }).energy, 30);
  assert.equal(recoveryTierForMinutes(15), "MICRO");
  assert.equal(recoveryTierForMinutes(30), "STANDARD");
  assert.equal(recoveryTierForMinutes(60), "DEEP");
  assert.equal(calculateTaskEconomy({ cat: "mystic", durationMinutes: 240 }).restore, 30);
});
