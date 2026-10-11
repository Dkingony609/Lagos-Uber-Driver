import {
  vehiclesOverlap,
  updateTraffic,
  type TrafficCar,
} from "../src/traffic";
import { describe, it, expect } from "vitest";
import {
  initial,
  quote,
  entry,
  offer,
  accept,
  settle,
  purchaseFuel,
  consume,
  tick,
  interact,
  hire,
  dismiss,
  settleWages,
  rating,
  cancellationRate,
  tow,
  summary,
  collision,
  transition,
  repair,
  nextShift,
} from "../src/simulation";
import { validate, save, load, KEY, BACKUP } from "../src/persistence";
import { fuelPump, nodes, route, pathLength, road } from "../src/world";
const ticks = (s: ReturnType<typeof initial>, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) tick(s, {});
};
const arrive = (s: ReturnType<typeof initial>, id: number) => {
  Object.assign(s.owner, { x: nodes[id].x, y: nodes[id].y, speed: 0 });
  ticks(s, 2.1);
};
describe("quotes and accounting", () => {
  it("matches the published worked example", () => {
    expect(quote(2, 6, 18, 1, 4)).toMatchObject({
      gross: 2250,
      commission: 338,
      fuel: 0.78,
      net: 1171,
    });
  });
  it("settles exactly once without charging fuel twice", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    const t = s.trip!;
    t.quote = quote(2, 6, 18);
    t.state = "onboard";
    settle(s, t, "completed");
    settle(s, t, "completed");
    expect(s.wallet).toBe(26912);
    expect(s.ledger).toHaveLength(2);
    expect(s.driver.reviews).toBe(1);
    expect(validate(s)).toBe(true);
  });
  it("weights inventory costs and rejects unaffordable purchases atomically", () => {
    const s = initial();
    Object.assign(s.owner, fuelPump, { fuel: 10, basis: 800 });
    expect(purchaseFuel(s, 10)).toBe(true);
    expect(s.owner.basis).toBe(875);
    consume(s.owner, 10, 0);
    expect(s.owner.fuelExpense).toBeCloseTo(787.5);
    const before = structuredClone(s);
    expect(purchaseFuel(s, 40)).toBe(false);
    expect(s).toEqual(before);
    expect(summary(s).profit).toBeCloseTo(-787.5);
    expect(summary(s).cash).toBe(-9500);
  });
  it("rounds proportionate fleet wages and refunds a deposit once", () => {
    const s = initial();
    s.driver.completed = 5;
    expect(hire(s)).toBe(true);
    s.fleet!.driver.accrued = 800 / 6;
    settleWages(s);
    expect(s.fleet!.driver.wages).toBe(133);
    expect(dismiss(s)).toBe(true);
    expect(dismiss(s)).toBe(false);
    expect(s.wallet).toBe(25000 - 133);
    expect(validate(s)).toBe(true);
  });
});
describe("trips and progression", () => {
  it("uses continuous stop gates and boarding before completion", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    const t = s.trip!;
    t.noShow = false;
    expect(interact(s)).toBe(false);
    arrive(s, t.pickup);
    expect(t.state).toBe("at-pickup");
    expect(interact(s)).toBe(true);
    ticks(s, 0.4);
    expect(t.state).toBe("onboard");
    arrive(s, t.destination);
    expect(interact(s)).toBe(true);
    expect(s.driver.completed).toBe(1);
    expect(s.trip).toBe(null);
  });
  it("closes no-shows after grace without a review", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    const t = s.trip!;
    t.noShow = true;
    arrive(s, t.pickup);
    expect(interact(s)).toBe(false);
    ticks(s, 12.1);
    expect(interact(s)).toBe(true);
    expect(s.wallet).toBe(25255);
    expect(s.driver.reviews).toBe(0);
  });
  it("excludes offers and pending trips from cancellation denominator", () => {
    const s = initial();
    for (let i = 0; i < 5; i++) {
      s.offer = offer(s);
      accept(s);
      settle(
        s,
        s.trip!,
        "cancelled",
        i === 0 ? "Driver: rest" : "Passenger patience expired",
      );
    }
    expect(cancellationRate(s.driver)).toBe(0.2);
    expect(s.driver.reviews).toBe(0);
    s.offer = offer(s);
    accept(s);
    s.trip!.state = "onboard";
    settle(s, s.trip!, "cancelled", "Driver: rest");
    expect(s.driver.reviews).toBe(1);
    expect(rating(s.driver)).toBeCloseTo(97 / 21);
  });
  it("discloses collision, harsh braking and fatigue deductions", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    const t = s.trip!;
    t.state = "onboard";
    t.harsh = 3;
    t.fatigued = true;
    collision(s, 15);
    collision(s, 15);
    expect(s.owner.condition).toBe(94.75);
    settle(s, t, "completed");
    expect(t.stars).toBe(2);
    expect(t.reasons).toHaveLength(3);
  });
  it("expires an offer only once and freezes all systems on pause", () => {
    const s = initial();
    s.online = true;
    s.offer = offer(s);
    ticks(s, 20.1);
    expect(s.offer).toBeNull();
    expect(s.wallet).toBe(25000);
    s.paused = true;
    const before = structuredClone(s);
    ticks(s, 30);
    expect(s).toEqual(before);
  });
  it("provides zero-cash zero-fuel recovery with a reconciled grant", () => {
    const s = initial();
    entry(s, "owner", "test expense", -25000);
    s.owner.fuel = 0;
    tow(s);
    expect(s.wallet).toBe(0);
    expect(s.owner.fuel).toBe(1);
    expect(s.owner.x).toBe(nodes[30].x);
    expect(
      s.ledger
        .filter((e) => e.category === "recovery grant")
        .reduce((a, e) => a + e.amount, 0),
    ).toBe(2450);
    expect(validate(s)).toBe(true);
  });
  it("fleet drives a real graph route and earns only upon settlement", () => {
    const s = initial();
    s.driver.completed = 5;
    hire(s);
    const f = s.fleet!;
    f.assigned = true;
    f.active = true;
    const pos = { x: f.car.x, y: f.car.y };
    ticks(s, 15);
    expect(f.trip).not.toBeNull();
    expect(Math.hypot(f.car.x - pos.x, f.car.y - pos.y)).toBeGreaterThan(0);
    expect(f.driver.completed).toBe(0);
    ticks(s, 250);
    expect(f.driver.completed).toBeGreaterThan(0);
    expect(f.car.consumed).toBeGreaterThan(0);
    expect(f.driver.wages).toBeGreaterThan(0);
    f.pauseRequested = true;
    ticks(s, 250);
    expect(f.active).toBe(false);
    expect(validate(s)).toBe(true);
  });
  it("all 36 junctions and services are reachable", () => {
    for (const a of nodes)
      for (const b of nodes) {
        const r = route(a.id, b.id);
        expect(r[0]).toBe(a.id);
        expect(r.at(-1)).toBe(b.id);
        expect(pathLength(r)).toBeGreaterThanOrEqual(0);
        expect(road(a)).toBe(true);
      }
  });
});
describe("determinism and persistence", () => {
  it("replays seeded simulation exactly and keeps fleet RNG independent", () => {
    const a = initial(99),
      b = initial(99);
    a.online = b.online = true;
    ticks(a, 31);
    ticks(b, 31);
    expect(a).toEqual(b);
    const original = a.rng;
    offer(a, "owner");
    expect(a.rng).not.toBe(original);
    const owner = a.rng;
    a.fleet = {
      car: structuredClone(a.owner),
      driver: structuredClone(a.driver),
      active: false,
      pauseRequested: false,
      trip: null,
      delay: 10,
      reason: "",
      assigned: true,
    };
    offer(a, "fleet");
    expect(a.rng).toBe(owner);
  });
  it("rejects ledger tampering, invalid references and corrupt values", () => {
    const s = initial();
    expect(validate(s)).toBe(true);
    s.wallet++;
    expect(validate(s)).toBe(false);
    s.wallet--;
    s.offer = offer(s);
    s.offer.pickup = 100;
    expect(validate(s)).toBe(false);
    s.offer = null;
    s.owner.fuel = NaN;
    expect(validate(s)).toBe(false);
  });
  it("backs up valid saves and resumes a trip paused without rerolls", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => data.set(k, v),
    } as unknown as Storage;
    const s = initial();
    save(s, storage);
    s.offer = offer(s);
    accept(s);
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.state.paused).toBe(true);
    expect(loaded.state.trip).toEqual(s.trip);
    expect(loaded.state.rng).toBe(s.rng);
    data.set(KEY, "bad");
    expect(load(storage)).toMatchObject({ corrupt: true, hasBackup: true });
    expect(JSON.parse(data.get(BACKUP)!)).toMatchObject({ wallet: 25000 });
  });
});

describe("shift boundaries and service rules", () => {
  it("rejects invalid and terminal state transitions", () => {
    const s = initial(),
      t = offer(s);
    expect(transition(t, "completed")).toBe(false);
    expect(transition(t, "pickup")).toBe(true);
    expect(transition(t, "onboard")).toBe(false);
    expect(transition(t, "cancelled")).toBe(true);
    expect(transition(t, "pickup")).toBe(false);
  });
  it("repairs only at a stopped service bay with affordable cash", () => {
    const s = initial();
    s.owner.condition = 15;
    expect(repair(s, 100)).toBe(false);
    Object.assign(s.owner, nodes[5]);
    expect(repair(s, 100)).toBe(true);
    expect(s.owner.condition).toBe(100);
    expect(s.wallet).toBe(16500);
    expect(s.clock).toBeCloseTo(29100);
  });
  it("checks pickup patience only once and retains its decision across reload", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    s.trip!.quote.pickupMinutes = 0;
    let t = s.trip!;
    ticks(s, 31);
    expect(t.patienceChecked).toBe(true);
    let resolved = s.driver.resolved;
    let rng = s.rng;
    const copy = JSON.parse(JSON.stringify(s));
    copy.paused = false;
    ticks(copy, 10);
    expect(copy.driver.resolved).toBe(resolved);
    expect(copy.rng).toBe(rng);
  });
  it("finishes a shift with a reconciled ledger and retains inventory next day", () => {
    const s = initial();
    s.online = true;
    s.offer = offer(s);
    s.clock = 72000;
    tick(s, {});
    expect(s.shift.ended).toBe(true);
    expect(s.paused).toBe(true);
    expect(s.offer).toBe(null);
    const fuel = s.owner.fuel;
    s.driver.fatigue = 90;
    nextShift(s);
    expect(s.clock).toBe(28800);
    expect(s.day).toBe(2);
    expect(s.driver.fatigue).toBe(50);
    expect(s.owner.fuel).toBe(fuel);
    expect(summary(s).cash).toBe(0);
    expect(validate(s)).toBe(true);
  });
  it("cannot complete an unboarded or settled trip", () => {
    const s = initial();
    s.offer = offer(s);
    accept(s);
    settle(s, s.trip!, "completed");
    expect(s.wallet).toBe(25000);
    expect(s.history).toHaveLength(0);
  });
});

// Fuel service now requires entering the forecourt, rather than stopping on the junction.
it("requires the drive-in fuel pump and cannot power reverse on an empty tank", () => {
  const s = initial();
  Object.assign(s.owner, nodes[17]);
  expect(purchaseFuel(s, 5)).toBe(false);
  Object.assign(s.owner, fuelPump);
  s.owner.speed = 2;
  expect(purchaseFuel(s, 5)).toBe(false);
  s.owner.speed = 0;
  expect(purchaseFuel(s, 5)).toBe(true);
  s.owner.fuel = 0;
  tick(s, { down: true }, 1);
  expect(s.owner.speed).toBe(0);
});

it("queues traffic at signals and behind the player, and distinguishes adjacent-lane footprints", () => {
  const car: TrafficCar = {
    id: 0,
    x: 137,
    y: 71,
    heading: 0,
    index: 0,
    loop: [1, 2],
    speed: 0,
    waiting: false,
    color: 0,
  };
  updateTraffic([car], 1, false, false, 12);
  expect(car.waiting).toBe(true);
  expect(car.x).toBe(137);
  updateTraffic([car], 1, false, false, 24);
  expect(car.waiting).toBe(false);
  expect(car.x).toBeGreaterThan(137);
  const obstacle = { x: car.x + 10, y: car.y };
  updateTraffic([car], 1, false, false, 24, obstacle);
  expect(car.waiting).toBe(true);
  expect(
    vehiclesOverlap(
      { x: 100, y: 100, heading: 0 },
      { x: 100, y: 106, heading: 0 },
    ),
  ).toBe(false);
  expect(
    vehiclesOverlap(
      { x: 100, y: 100, heading: 0 },
      { x: 105, y: 100, heading: Math.PI / 2 },
    ),
  ).toBe(true);
});
