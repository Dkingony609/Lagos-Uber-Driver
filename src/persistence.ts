import { C } from "./config";
import { initial, type State } from "./simulation";
export const KEY = "lagos-driver-v1",
  BACKUP = KEY + "-backup";
function bounded(n: unknown, min: number, max: number) {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
export function validate(data: unknown): data is State {
  try {
    const s = data as State;
    if (
      !s ||
      !Array.isArray(s.traffic) ||
      s.traffic.length !== 25 ||
      s.traffic.some(
        (c) =>
          !bounded(c.x, 0, 600) ||
          !bounded(c.y, 0, 600) ||
          !Array.isArray(c.loop) ||
          c.loop.some((n) => !Number.isInteger(n) || n < 0 || n > 35) ||
          !bounded(c.index, 0, c.loop.length - 1),
      ) ||
      s.schemaVersion !== C.schema ||
      !Number.isInteger(s.rng) ||
      !Number.isInteger(s.fleetRng) ||
      !bounded(s.wallet, 0, 1e12) ||
      !Array.isArray(s.ledger) ||
      !Array.isArray(s.history) ||
      !bounded(s.clock, 0, 1e9) ||
      !bounded(s.real, 0, 1e9) ||
      !Number.isInteger(s.serial) ||
      !s.shift ||
      typeof s.paused !== "boolean"
    )
      return false;
    if (
      !bounded(s.rng, 0, 4294967295) ||
      !bounded(s.fleetRng, 0, 4294967295) ||
      !bounded(s.rainAt, 0, 86400) ||
      !bounded(s.day, 1, 1e6) ||
      !bounded(s.archivedFleetFuelCost, 0, 1e12) ||
      !bounded(s.sound, 0, 1) ||
      !bounded(s.music, 0, 1) ||
      !bounded(s.offerDelay, -1, 1e6) ||
      !bounded(s.lastImpact, -100, s.real) ||
      typeof s.online !== "boolean" ||
      typeof s.rain !== "boolean" ||
      typeof s.notice !== "string" ||
      !bounded(s.shift.startWallet, 0, 1e12) ||
      !Number.isInteger(s.shift.startLedger) ||
      s.shift.startLedger < 0 ||
      s.shift.startLedger > s.ledger.length ||
      typeof s.shift.ended !== "boolean"
    )
      return false;
    if (
      s.fleet &&
      (typeof s.fleet.active !== "boolean" ||
        typeof s.fleet.assigned !== "boolean" ||
        typeof s.fleet.pauseRequested !== "boolean" ||
        !bounded(s.fleet.delay, -1, 1e6) ||
        typeof s.fleet.reason !== "string")
    )
      return false;
    const ids = new Set<string>();
    let cash = C.initialWallet;
    for (const e of s.ledger) {
      if (
        !e ||
        typeof e.id !== "string" ||
        ids.has(e.id) ||
        !Number.isInteger(e.amount) ||
        !bounded(e.time, 0, 1e9) ||
        typeof e.category !== "string"
      )
        return false;
      ids.add(e.id);
      cash += e.amount;
    }
    if (cash !== s.wallet) return false;
    for (const v of [s.owner, ...(s.fleet ? [s.fleet.car] : [])])
      if (
        !v ||
        !bounded(v.x, 0, 600) ||
        !bounded(v.y, 0, 600) ||
        !bounded(v.fuel, 0, 45) ||
        !bounded(v.condition, 0, 100) ||
        !bounded(v.basis, 0, 1e8) ||
        !bounded(v.speed, -100, 100) ||
        !bounded(v.heading, -1e9, 1e9) ||
        !bounded(v.fuelExpense, 0, 1e12) ||
        !bounded(v.consumed, 0, 1e9) ||
        !bounded(v.km, 0, 1e9)
      )
        return false;
    for (const d of [s.driver, ...(s.fleet ? [s.fleet.driver] : [])])
      if (
        !d ||
        !bounded(d.fatigue, 0, 100) ||
        !Number.isInteger(d.completed) ||
        d.completed < 0 ||
        !Number.isInteger(d.reviews) ||
        !bounded(d.stars, 0, d.reviews * 5) ||
        !bounded(d.accrued, -1, 1e9) ||
        !bounded(d.wages, 0, 1e12) ||
        !Number.isInteger(d.cancelled) ||
        !Number.isInteger(d.resolved) ||
        d.cancelled < 0 ||
        d.cancelled > d.resolved
      )
        return false;
    const tids = new Set<string>();
    for (const t of [
      ...s.history,
      ...[s.trip, s.offer, s.fleet?.trip].filter(Boolean),
    ]) {
      if (
        !t ||
        typeof t.name !== "string" ||
        !bounded(t.elapsed, 0, 1e9) ||
        !bounded(t.fuelStart, 0, 1e9) ||
        !bounded(t.expenseStart, 0, 1e12) ||
        typeof t.noShow !== "boolean" ||
        typeof t.patienceChecked !== "boolean" ||
        typeof t.settled !== "boolean" ||
        typeof t.collision !== "boolean" ||
        typeof t.fatigued !== "boolean" ||
        !bounded(t.gate, 0, 1e9) ||
        !bounded(t.accepted, 0, 1e9) ||
        !bounded(t.created, 0, 1e9) ||
        !bounded(t.harsh, 0, 1e9) ||
        tids.has(t.id) ||
        !["owner", "fleet"].includes(t.actor) ||
        !Number.isInteger(t.pickup) ||
        t.pickup < 0 ||
        t.pickup > 35 ||
        !Number.isInteger(t.destination) ||
        t.destination < 0 ||
        t.destination > 35 ||
        ![
          "offered",
          "pickup",
          "at-pickup",
          "boarding",
          "onboard",
          "completed",
          "cancelled",
          "no-show",
        ].includes(t.state) ||
        !t.quote ||
        !bounded(t.quote.gross, 0, 1e8) ||
        !Array.isArray(t.route) ||
        t.route.some((n) => !Number.isInteger(n) || n < 0 || n > 35) ||
        !Array.isArray(t.reasons)
      )
        return false;
      tids.add(t.id);
    }
    if (
      s.history.some(
        (t) =>
          !t.settled ||
          !["completed", "cancelled", "no-show"].includes(t.state),
      )
    )
      return false;
    if (
      s.trip &&
      (s.trip.actor !== "owner" || s.trip.settled || s.trip.state === "offered")
    )
      return false;
    if (
      s.offer &&
      (s.offer.actor !== "owner" ||
        s.offer.state !== "offered" ||
        s.offer.settled)
    )
      return false;
    if (s.trip && s.offer) return false;
    if (
      s.fleet?.trip &&
      (s.fleet.trip.actor !== "fleet" ||
        s.fleet.trip.settled ||
        s.fleet.trip.state === "offered")
    )
      return false;
    if (
      s.ledger.some(
        (e) => e.tripId && !s.history.some((t) => t.id === e.tripId),
      )
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function save(s: State, storage: Storage = localStorage) {
  if (!validate(s)) throw Error("Refusing to save an inconsistent game state");
  const previous = storage.getItem(KEY);
  if (previous) {
    try {
      if (validate(JSON.parse(previous))) storage.setItem(BACKUP, previous);
    } catch {
      /* leave good backup */
    }
  }
  storage.setItem(KEY, JSON.stringify(s));
}
export function load(storage: Storage = localStorage): {
  state: State;
  corrupt: boolean;
  hasBackup: boolean;
} {
  const raw = storage.getItem(KEY);
  if (!raw) return { state: initial(), corrupt: false, hasBackup: false };
  try {
    const s = JSON.parse(raw);
    if (validate(s)) {
      s.paused = true;
      return { state: s, corrupt: false, hasBackup: false };
    }
  } catch {
    /* restoration needs consent */
  }
  let good = false;
  try {
    good = validate(JSON.parse(storage.getItem(BACKUP) || "null"));
  } catch {
    /* no backup */
  }
  const clean = initial();
  clean.paused = true;
  return { state: clean, corrupt: true, hasBackup: good };
}
export function restore(storage: Storage = localStorage) {
  const s = JSON.parse(storage.getItem(BACKUP) || "null");
  if (!validate(s)) throw Error("No valid backup");
  s.paused = true;
  storage.setItem(KEY, JSON.stringify(s));
  return s;
}
