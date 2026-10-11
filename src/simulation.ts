import { C, speedKmh, gameDeceleration } from "./config";
import {
  createTraffic,
  updateTraffic,
  trafficBlocks,
  type TrafficCar,
} from "./traffic";
import {
  nodes,
  endpoints,
  services,
  distance,
  nearest,
  route,
  pathLength,
  road,
  type Point,
} from "./world";
export type Entry = {
  id: string;
  time: number;
  actor: string;
  category: string;
  amount: number;
  tripId?: string;
};
export type Vehicle = Point & {
  heading: number;
  speed: number;
  fuel: number;
  basis: number;
  condition: number;
  km: number;
  consumed: number;
  fuelExpense: number;
};
export type Driver = {
  fatigue: number;
  stars: number;
  reviews: number;
  completed: number;
  resolved: number;
  cancelled: number;
  wages: number;
  accrued: number;
};
export type Quote = {
  pickupKm: number;
  km: number;
  pickupMinutes: number;
  minutes: number;
  gross: number;
  commission: number;
  fuel: number;
  net: number;
};
export type Trip = {
  id: string;
  day: number;
  actor: "owner" | "fleet";
  name: string;
  pickup: number;
  destination: number;
  quote: Quote;
  state:
    | "offered"
    | "pickup"
    | "at-pickup"
    | "boarding"
    | "onboard"
    | "completed"
    | "cancelled"
    | "no-show";
  created: number;
  accepted: number;
  elapsed: number;
  expires: number;
  noShow: boolean;
  patienceChecked: boolean;
  gate: number;
  boarding: number;
  collision: boolean;
  harsh: number;
  fatigued: boolean;
  lastCollision: number;
  lastBrake: number;
  settled: boolean;
  route: number[];
  stars?: number;
  reasons: string[];
  fuelStart: number;
  expenseStart: number;
};
export type Receipt = {
  trip: Trip;
  net: number;
  fuel: number;
  fuelCost: number;
  message: string;
};
export type Shift = {
  startWallet: number;
  startLedger: number;
  ownerFuel: number;
  fleetFuel: number;
  ended: boolean;
};
export type State = {
  schemaVersion: number;
  seed: number;
  rng: number;
  fleetRng: number;
  clock: number;
  real: number;
  day: number;
  paused: boolean;
  online: boolean;
  offerDelay: number;
  wallet: number;
  ledger: Entry[];
  owner: Vehicle;
  driver: Driver;
  trip: Trip | null;
  offer: Trip | null;
  history: Trip[];
  fleet: null | {
    car: Vehicle;
    driver: Driver;
    active: boolean;
    pauseRequested: boolean;
    trip: Trip | null;
    delay: number;
    reason: string;
    assigned: boolean;
  };
  receipt: Receipt | null;
  rainAt: number;
  rain: boolean;
  notice: string;
  shift: Shift;
  serial: number;
  sound: number;
  music: number;
  lastImpact: number;
  traffic: TrafficCar[];
  archivedFleetFuelCost: number;
};
export const newCar = (id: number, fuel = 20): Vehicle => ({
  ...nodes[id],
  heading: -Math.PI / 2,
  speed: 0,
  fuel,
  basis: C.fuelPrice,
  condition: 100,
  km: 0,
  consumed: 0,
  fuelExpense: 0,
});
export const newDriver = (): Driver => ({
  fatigue: 0,
  stars: 0,
  reviews: 0,
  completed: 0,
  resolved: 0,
  cancelled: 0,
  wages: 0,
  accrued: 0,
});
export function initial(seed = 609): State {
  return {
    schemaVersion: 1,
    seed,
    rng: seed,
    fleetRng: seed + 99,
    clock: C.shiftStartHour * 3600,
    real: 0,
    day: 1,
    paused: false,
    online: false,
    offerDelay: 10,
    wallet: C.initialWallet,
    ledger: [],
    owner: newCar(30),
    driver: newDriver(),
    trip: null,
    offer: null,
    history: [],
    fleet: null,
    receipt: null,
    rainAt: 12 * 3600 + (seed % 120) * 60,
    rain: false,
    notice: "Welcome to the depot. Go online to find your first passenger.",
    shift: {
      startWallet: C.initialWallet,
      startLedger: 0,
      ownerFuel: 0,
      fleetFuel: 0,
      ended: false,
    },
    serial: 0,
    sound: 0.25,
    music: 0,
    lastImpact: -100,
    traffic: createTraffic(),
    archivedFleetFuelCost: 0,
  };
}
export function random(s: State, fleet = false) {
  const k: "fleetRng" | "rng" = fleet ? "fleetRng" : "rng";
  s[k] = (Math.imul(s[k], 1664525) + 1013904223) >>> 0;
  return s[k] / 4294967296;
}
export function quote(
  pickupKm: number,
  km: number,
  minutes: number,
  demand = 1,
  idle = 4,
): Quote {
  const gross =
      Math.round(
        Math.max(
          C.minimumFare,
          (C.baseFare + C.distanceRate * km + C.minuteRate * minutes) * demand,
        ) / C.fareRounding,
      ) * C.fareRounding,
    commission = Math.round(gross * C.commission),
    fuel = C.burn * (pickupKm + km) + C.idleBurn * idle;
  return {
    pickupKm,
    km,
    minutes,
    pickupMinutes: pickupKm * C.predictedMinutesPerKm + 1,
    gross,
    commission,
    fuel,
    net: Math.round(gross - commission - fuel * C.fuelPrice),
  };
}
export function entry(
  s: State,
  actor: string,
  category: string,
  amount: number,
  tripId?: string,
) {
  amount = Math.round(amount);
  s.ledger.push({
    id: "l" + ++s.serial,
    time: s.clock + (s.day - 1) * 86400,
    actor,
    category,
    amount,
    tripId,
  });
  s.wallet += amount;
}
export const rating = (d: Driver) =>
  (C.priorRating * C.priorRides + d.stars) / (C.priorRides + d.reviews);
export const cancellationRate = (d: Driver) =>
  d.resolved >= 5 ? d.cancelled / d.resolved : null;
export function offer(s: State, actor: "owner" | "fleet" = "owner") {
  const fleet = actor === "fleet",
    car = fleet ? s.fleet!.car : s.owner;
  let p = endpoints[Math.floor(random(s, fleet) * endpoints.length)].id,
    b = endpoints[Math.floor(random(s, fleet) * endpoints.length)].id;
  if (p === b)
    b =
      endpoints[(endpoints.findIndex((n) => n.id === p) + 7) % endpoints.length]
        .id;
  const rush =
      s.clock / 3600 < 10 || (s.clock / 3600 >= 16 && s.clock / 3600 < 19),
    congestion = (rush ? C.rushDemand : 1) * (s.rain ? 1.2 : 1),
    pickupKm =
      (distance(car, nodes[nearest(car)]) +
        pathLength(route(nearest(car), p))) /
      C.scale,
    km = pathLength(route(p, b)) / C.scale,
    q = quote(
      pickupKm,
      km,
      km * C.predictedMinutesPerKm * congestion + 1,
      rush ? C.rushDemand : 1,
    );
  q.pickupMinutes = pickupKm * C.predictedMinutesPerKm * congestion + 1;
  return {
    id: "t" + ++s.serial,
    day: s.day,
    actor,
    name: ["Tobi", "Ada", "Seyi", "Amaka", "Bola", "Chidi", "Zainab", "Emeka"][
      Math.floor(random(s, fleet) * 8)
    ],
    pickup: p,
    destination: b,
    quote: q,
    state: "offered",
    created: s.clock,
    accepted: 0,
    elapsed: 0,
    expires: C.offerSeconds,
    noShow: false,
    patienceChecked: false,
    gate: 0,
    boarding: 0,
    collision: false,
    harsh: 0,
    fatigued: false,
    lastCollision: -100,
    lastBrake: -100,
    settled: false,
    route: route(nearest(car), p),
    reasons: [],
    fuelStart: car.consumed,
    expenseStart: car.fuelExpense,
  } satisfies Trip;
}
export function transition(t: Trip, next: Trip["state"]) {
  const allowed: Record<Trip["state"], Trip["state"][]> = {
    offered: ["pickup"],
    pickup: ["at-pickup", "cancelled"],
    "at-pickup": ["boarding", "no-show", "cancelled"],
    boarding: ["onboard", "cancelled"],
    onboard: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    "no-show": [],
  };
  if (!allowed[t.state].includes(next)) return false;
  t.state = next;
  return true;
}
export function accept(s: State, t = s.offer) {
  if (!t || t.state !== "offered" || (t.actor === "owner" && s.trip)) return;
  transition(t, "pickup");
  t.accepted = s.clock;
  t.noShow = random(s, t.actor === "fleet") < C.noShowChance;
  if (t.actor === "owner") {
    s.trip = t;
    s.offer = null;
  } else s.fleet!.trip = t;
  s.notice = `${t.name} is waiting. Follow the mint route to pickup.`;
}
export function settle(
  s: State,
  t: Trip,
  kind: "completed" | "cancelled" | "no-show",
  reason = "",
) {
  if (t.settled) return;
  const previousState = t.state;
  if (!transition(t, kind)) return;
  const d = t.actor === "owner" ? s.driver : s.fleet!.driver,
    car = t.actor === "owner" ? s.owner : s.fleet!.car,
    wasOnboard = previousState === "onboard";
  t.settled = true;
  d.resolved++;
  let gross =
      kind === "completed"
        ? t.quote.gross
        : kind === "no-show"
          ? C.noShowFee
          : 0,
    commission = Math.round(gross * C.commission);
  if (gross) {
    entry(s, t.actor, kind === "no-show" ? "no show fee" : "fare", gross, t.id);
    entry(s, t.actor, "commission", -commission, t.id);
  }
  if (kind === "completed") {
    d.completed++;
    t.reasons = [
      ...(s.clock - t.accepted >
      (t.quote.pickupMinutes + t.quote.minutes + C.patienceBufferMinutes) * 60
        ? ["Arrival more than five minutes late"]
        : []),
      ...(t.collision ? ["Significant collision"] : []),
      ...(t.harsh >= 3 ? ["Three or more harsh brakes"] : []),
      ...(t.fatigued ? ["Fatigue exceeded 80"] : []),
    ];
    t.stars = Math.max(1, 5 - t.reasons.length);
  } else if (kind === "cancelled" && reason.startsWith("Driver")) {
    d.cancelled++;
    if (wasOnboard) {
      t.stars = 1;
      t.reasons = ["Driver cancelled after boarding"];
    }
  }
  if (t.stars) {
    d.stars += t.stars;
    d.reviews++;
  }
  s.history.push(structuredClone(t));
  if (t.actor === "owner") {
    s.trip = null;
    s.receipt = {
      trip: structuredClone(t),
      net: gross - commission,
      fuel: car.consumed - t.fuelStart,
      fuelCost: car.fuelExpense - t.expenseStart,
      message:
        reason ||
        (kind === "completed"
          ? "Passenger delivered. Good work."
          : kind === "no-show"
            ? "No-show fee settled."
            : "Trip closed with no fare."),
    };
    s.offerDelay = C.offerDelayMin + random(s) * C.offerDelayRange;
  } else {
    settleWages(s);
    s.fleet!.trip = null;
    s.fleet!.delay = C.offerDelayMin + random(s, true) * C.offerDelayRange;
  }
}
export function settleWages(s: State) {
  if (!s.fleet) return;
  const d = s.fleet.driver,
    n = Math.min(s.wallet, Math.max(0, Math.round(d.accrued)));
  if (Math.round(d.accrued) > s.wallet) {
    s.fleet.pauseRequested = true;
    s.fleet.reason = "Accrued wages await cash settlement";
  }
  if (n) entry(s, "fleet", "wage", -n);
  d.wages += n;
  d.accrued -= n;
}
export function availableCash(s: State) {
  const f = s.fleet;
  if (!f) return s.wallet;
  const remaining = f.trip
    ? Math.max(
        0,
        (f.trip.quote.pickupMinutes + f.trip.quote.minutes) * 60 -
          f.trip.elapsed,
      )
    : 0;
  return Math.max(
    0,
    s.wallet -
      Math.ceil(Math.max(0, f.driver.accrued) + (remaining * C.wage) / 3600),
  );
}
export function advanceTime(s: State, minutes: number) {
  const wasOnline = s.online;
  s.online = false;
  s.offer = null;
  s.owner.speed = 0;
  for (let i = 0; i < (minutes * 60) / C.clock / C.tick; i++) {
    if (s.shift.ended) break;
    tick(s, {});
  }
  s.online = wasOnline && !s.shift.ended;
}
export function purchaseFuel(s: State, litres: number, fleet = false) {
  const car = fleet ? s.fleet?.car : s.owner;
  if (!car || !Number.isFinite(litres) || litres <= 0) return false;
  if (
    fleet
      ? s.fleet!.trip !== null
      : distance(car, nodes[services.fuel]) > 12 ||
        speedKmh(car.speed) >= C.stopSpeedKmh
  )
    return false;
  litres = Math.min(litres, C.tank - car.fuel);
  const cost = Math.round(litres * C.fuelPrice);
  if (cost > availableCash(s) || litres <= 0) return false;
  car.basis = (car.fuel * car.basis + cost) / (car.fuel + litres);
  car.fuel += litres;
  entry(s, fleet ? "fleet" : "owner", "fuel purchase", -cost);
  s.notice = `Added ${litres.toFixed(1)} L of fuel.`;
  return true;
}
export function repair(s: State, target: number, fleet = false) {
  const car = fleet ? s.fleet?.car : s.owner;
  if (!car || !Number.isFinite(target)) return false;
  if (
    fleet
      ? s.fleet!.trip !== null
      : distance(car, nodes[services.repair]) > 12 ||
        speedKmh(car.speed) >= C.stopSpeedKmh
  )
    return false;
  target = Math.min(100, Math.max(car.condition, target));
  const cost = Math.ceil((target - car.condition) * C.repairPrice);
  if (cost > availableCash(s)) return false;
  entry(s, fleet ? "fleet" : "owner", "repair", -cost);
  car.condition = target;
  advanceTime(s, 5);
  return true;
}
export function tow(s: State) {
  if (s.trip) settle(s, s.trip, "cancelled", "Driver requested recovery");
  if (availableCash(s) < C.towPrice)
    entry(s, "owner", "recovery grant", C.towPrice - availableCash(s));
  entry(s, "owner", "tow", -C.towPrice);
  s.owner.x = nodes[30].x;
  s.owner.y = nodes[30].y;
  s.owner.speed = 0;
  s.online = false;
  advanceTime(s, 20);
  if (s.owner.fuel < 1) {
    if (availableCash(s) < 950)
      entry(s, "owner", "recovery grant", 950 - availableCash(s));
    s.owner.basis = (s.owner.fuel * s.owner.basis + 950) / (s.owner.fuel + 1);
    s.owner.fuel += 1;
    entry(s, "owner", "fuel purchase", -950);
  }
  if (s.owner.condition < C.minCondition) {
    const cost = Math.ceil(
      (C.minCondition - s.owner.condition) * C.repairPrice,
    );
    if (availableCash(s) < cost)
      entry(s, "owner", "recovery grant", cost - availableCash(s));
    entry(s, "owner", "repair", -cost);
    s.owner.condition = C.minCondition;
  }
  s.notice =
    "Recovered to depot. Emergency fuel inventory is recorded separately.";
}
export function hire(s: State) {
  if (s.fleet || s.driver.completed < C.fleetUnlock || s.wallet < C.deposit)
    return false;
  entry(s, "fleet", "deposit", -C.deposit);
  s.fleet = {
    car: newCar(30, 10),
    driver: newDriver(),
    active: false,
    pauseRequested: false,
    trip: null,
    delay: 2,
    reason: "Ready for assignment",
    assigned: false,
  };
  return true;
}
export function dismiss(s: State) {
  if (!s.fleet || s.fleet.trip || s.fleet.active) return false;
  s.archivedFleetFuelCost += s.fleet.car.fuelExpense;
  settleWages(s);
  entry(s, "fleet", "deposit refund", C.deposit);
  s.fleet = null;
  return true;
}
export function consume(car: Vehicle, km: number, dt: number) {
  const litres = Math.min(
    car.fuel,
    km * C.burn +
      (Math.abs(car.speed) < 1 ? (C.idleBurn * dt * C.clock) / 60 : 0),
  );
  car.fuel -= litres;
  car.consumed += litres;
  car.fuelExpense += litres * car.basis;
  car.km += km;
  car.condition = Math.max(0, car.condition - km * 0.1);
}
export function collision(s: State, impact: number) {
  const t = s.trip;
  if (
    impact < C.collisionThreshold ||
    s.real - s.lastImpact < C.collisionCooldown
  )
    return;
  s.lastImpact = s.real;
  if (t) {
    t.lastCollision = s.real;
    t.collision = true;
  }
  s.owner.condition = Math.max(
    0,
    s.owner.condition - Math.min(10, impact * 0.35),
  );
  s.notice = "Impact recorded. Slow down before turning.";
}
export type Input = {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  brake?: boolean;
};
function tripTick(s: State, t: Trip, car: Vehicle, dt: number, ai = false) {
  t.elapsed += dt * C.clock;
  const target = nodes[t.state === "onboard" ? t.destination : t.pickup];
  if (t.state === "boarding") {
    t.boarding += dt * C.clock;
    if (t.boarding >= C.boardingSeconds) {
      transition(t, "onboard");
      t.gate = 0;
      t.route = route(t.pickup, t.destination);
      if (ai && random(s, true) < C.harshChance) t.harsh++;
    }
    return;
  }
  if (
    t.state === "pickup" &&
    !t.patienceChecked &&
    t.elapsed > (t.quote.pickupMinutes + C.patienceBufferMinutes) * 60
  ) {
    t.patienceChecked = true;
    if (random(s, ai) < C.patienceChance) {
      settle(s, t, "cancelled", "Passenger patience expired");
      return;
    }
  }
  if (t.state === "onboard")
    t.fatigued ||= (ai ? s.fleet!.driver : s.driver).fatigue > C.fatigueWarning;
  if (
    distance(car, target) < C.pickupRadius &&
    speedKmh(car.speed) < C.stopSpeedKmh
  ) {
    t.gate += dt;
    if (t.gate >= C.gateSeconds && t.state === "pickup") {
      transition(t, "at-pickup");
      t.boarding = s.clock;
    }
    if (ai && t.state === "at-pickup") {
      if (t.noShow) {
        if (s.clock - t.boarding >= C.noShowWaitMinutes * 60)
          settle(s, t, "no-show");
      } else {
        transition(t, "boarding");
        t.boarding = 0;
      }
    }
    if (ai && t.state === "onboard" && t.gate >= C.gateSeconds)
      settle(s, t, "completed");
  } else t.gate = 0;
}
export function interact(s: State) {
  const t = s.trip;
  if (!t) return false;
  if (t.state === "at-pickup" && t.gate >= C.gateSeconds) {
    if (t.noShow) {
      if (s.clock - t.boarding >= C.noShowWaitMinutes * 60) {
        settle(s, t, "no-show");
        return true;
      }
      s.notice =
        "Passenger has not arrived. Wait two game minutes before closing.";
      return false;
    }
    transition(t, "boarding");
    t.boarding = 0;
    return true;
  }
  if (t.state === "onboard" && t.gate >= C.gateSeconds) {
    settle(s, t, "completed");
    return true;
  }
  return false;
}
// Junction waypoints use the outgoing right lane; final passenger pins use the stop point.
function fleetWaypoint(t: Trip) {
  const n = nodes[t.route[0]],
    next = t.route.length > 1 ? nodes[t.route[1]] : null;
  if (!next) return n;
  const h = Math.atan2(next.y - n.y, next.x - n.x);
  return { ...n, x: n.x - Math.sin(h) * 6, y: n.y + Math.cos(h) * 6 };
}
export function tick(s: State, input: Input, dt = C.tick) {
  if (s.paused || s.shift.ended) return;
  s.real += dt;
  s.clock += dt * C.clock;
  updateTraffic(
    s.traffic,
    dt,
    s.rain,
    s.clock < 36000 || (s.clock >= 57600 && s.clock < 68400),
  );
  const v = s.owner,
    d = s.driver,
    oldSpeed = v.speed;
  const rain = s.clock >= s.rainAt && s.clock < s.rainAt + 3600;
  if (rain !== s.rain) {
    s.rain = rain;
    s.notice = rain
      ? "Rain is here. Reduced grip: brake early."
      : "The rain has cleared.";
  }
  if (s.clock >= s.rainAt - 300 && s.clock < s.rainAt - 290)
    s.notice = "Rain expected in five game minutes.";
  if (input.brake) {
    v.speed *= Math.pow(0.03, dt);
  } else if (input.down) {
    v.speed = Math.max(-7, v.speed - 12 * dt);
  } else if (input.up && v.fuel > 0 && v.condition > 0) {
    v.speed = Math.min(C.maxSpeed, v.speed + 7 * dt);
  } else v.speed *= Math.pow(0.65, dt);
  if (v.fuel <= 0) v.speed *= Math.pow(0.1, dt);
  if (Math.abs(v.speed) < 0.04) v.speed = 0;
  const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  v.heading +=
    steering *
    2 *
    dt *
    Math.min(1, Math.abs(v.speed) / 6) *
    Math.sign(v.speed) *
    (s.rain ? C.rainGrip : 1);
  let moved = 0;
  for (let i = 0; i < 4; i++) {
    const next = {
      x: v.x + (Math.cos(v.heading) * v.speed * dt) / 4,
      y: v.y + (Math.sin(v.heading) * v.speed * dt) / 4,
    };
    if (road(next)) {
      moved += distance(v, next);
      v.x = next.x;
      v.y = next.y;
    } else {
      collision(s, Math.abs(v.speed));
      v.speed *= -0.15;
      break;
    }
  }
  for (const traffic of s.traffic) {
    if (distance(v, traffic) < 7 && Math.abs(v.speed) > 4) {
      collision(s, Math.abs(v.speed));
      v.speed *= 0.3;
      break;
    }
  }
  if (s.online || s.trip || Math.abs(v.speed) > 0.1) {
    consume(v, moved / C.scale, dt);
    d.fatigue = Math.min(100, d.fatigue + (dt * C.clock) / 60);
  }
  if (s.trip) {
    if (
      speedKmh(oldSpeed) > 20 &&
      gameDeceleration((oldSpeed - v.speed) / dt) > C.harshDeceleration &&
      s.real - s.trip.lastBrake > C.collisionCooldown
    ) {
      s.trip.harsh++;
      s.trip.lastBrake = s.real;
    }
    tripTick(s, s.trip, v, dt);
    if (s.trip && Math.floor(s.real * 2) !== Math.floor((s.real - dt) * 2))
      s.trip.route = route(
        nearest(v),
        s.trip.state === "onboard" ? s.trip.destination : s.trip.pickup,
        1.3,
        s.rain,
      );
  }
  if (s.clock >= C.shiftEndHour * 3600) {
    s.online = false;
    s.offer = null;
    if (s.fleet) s.fleet.pauseRequested = true;
  }
  if (s.online && !s.trip && s.clock < C.shiftEndHour * 3600) {
    if (s.offer) {
      s.offer.expires -= dt;
      if (s.offer.expires <= 0) {
        s.offer = null;
        s.offerDelay = C.offerDelayMin + random(s) * C.offerDelayRange;
        s.notice = "Offer expired. No penalty.";
      }
    } else {
      s.offerDelay -= dt;
      if (s.offerDelay <= 0) s.offer = offer(s);
    }
  }
  const f = s.fleet;
  if (f && f.active) {
    f.driver.fatigue = Math.min(100, f.driver.fatigue + (dt * C.clock) / 60);
    f.driver.accrued += (C.wage * dt * C.clock) / 3600;
    if (f.trip && f.car.fuel <= 0) {
      settle(s, f.trip, "cancelled", "Vehicle ran out of fuel");
      f.active = false;
      f.car.speed = 0;
      f.reason = "Out of fuel: refuel while idle";
    }
    if (f.trip) {
      let t = f.trip;
      if (t.state === "pickup" || t.state === "onboard") {
        const dest = t.state === "onboard" ? t.destination : t.pickup;
        if (!t.route.length) t.route = route(nearest(f.car), dest);
        let n = fleetWaypoint(t),
          dist = distance(f.car, n);
        if (dist < 0.5 && t.route.length > 1) {
          t.route.shift();
          n = fleetWaypoint(t);
          dist = distance(f.car, n);
        }
        const speed =
            ((s.rain ? 10 : 14) * C.competence) /
            (s.clock / 3600 < 10 || s.clock / 3600 >= 16 ? 1.3 : 1),
          blocked = trafficBlocks(
            s.traffic,
            f.car,
            Math.atan2(n.y - f.car.y, n.x - f.car.x),
          ),
          step = blocked ? 0 : Math.min(dist, speed * dt);
        f.car.speed = dist > 0.3 && !blocked ? speed : 0;
        if (dist > 0.3) {
          f.car.heading = Math.atan2(n.y - f.car.y, n.x - f.car.x);
          f.car.x += ((n.x - f.car.x) / dist) * step;
          f.car.y += ((n.y - f.car.y) / dist) * step;
          consume(f.car, step / C.scale, dt);
        } else consume(f.car, 0, dt);
        if (distance(f.car, nodes[dest]) < 0.5) f.car.speed = 0;
      } else {
        f.car.speed = 0;
        consume(f.car, 0, dt);
      }
      tripTick(s, t, f.car, dt, true);
    } else {
      let why = f.pauseRequested
        ? "Paused after current trip"
        : f.car.fuel < C.reserve
          ? "Fuel below 2 L reserve"
          : f.car.condition < C.minCondition
            ? "Repair needed"
            : f.driver.fatigue > C.fatigueWarning
              ? "Rest needed"
              : s.clock >= C.shiftEndHour * 3600
                ? "Shift finished"
                : s.wallet <= Math.ceil(Math.max(0, f.driver.accrued))
                  ? "Cash needed for accrued wages"
                  : "";
      if (why) {
        f.active = false;
        f.car.speed = 0;
        f.reason = why;
        settleWages(s);
      } else {
        f.delay -= dt;
        if (f.delay <= 0) {
          const t = offer(s, "fleet"),
            w = (C.wage * (t.quote.pickupMinutes + t.quote.minutes)) / 60;
          if (t.quote.net <= 0) f.reason = "No profitable offer";
          else if (f.car.fuel < t.quote.fuel + C.reserve)
            f.reason = "Insufficient fuel for route + reserve";
          else if (availableCash(s) < w)
            f.reason = "Insufficient cash to reserve wages";
          else {
            accept(s, t);
            f.reason = "Driving passenger route";
          }
          f.delay = 10;
        }
      }
    }
  }
  if (s.clock >= C.shiftEndHour * 3600 && !s.trip && !s.fleet?.trip) {
    if (s.fleet) settleWages(s);
    s.shift.ended = true;
    s.paused = true;
    s.notice = "Shift complete. Review the business summary.";
  }
}
export function nextShift(s: State) {
  s.day++;
  s.clock = C.shiftStartHour * 3600;
  s.driver.fatigue = Math.max(0, s.driver.fatigue - C.restRecovery);
  if (s.fleet) {
    s.fleet.driver.fatigue = Math.max(
      0,
      s.fleet.driver.fatigue - C.restRecovery,
    );
    s.fleet.active = false;
    s.fleet.pauseRequested = false;
  }
  s.shift = {
    startWallet: s.wallet,
    startLedger: s.ledger.length,
    ownerFuel: s.owner.fuelExpense,
    fleetFuel: (s.fleet?.car.fuelExpense || 0) + s.archivedFleetFuelCost,
    ended: false,
  };
  s.rainAt = 12 * 3600 + random(s) * 7200;
  s.paused = false;
  s.online = false;
  s.notice = "A new day in Lagos. Make it count.";
}
export function summary(s: State) {
  const l = s.ledger.slice(s.shift.startLedger),
    sum = (cat: string) =>
      l.filter((e) => e.category === cat).reduce((a, e) => a + e.amount, 0),
    fuel =
      s.owner.fuelExpense -
      s.shift.ownerFuel +
      (s.fleet?.car.fuelExpense || 0) +
      s.archivedFleetFuelCost -
      s.shift.fleetFuel;
  return {
    gross: sum("fare") + sum("no show fee"),
    commission: -sum("commission"),
    fuel,
    wages: -sum("wage"),
    repairs: -sum("repair"),
    cash: s.wallet - s.shift.startWallet,
    profit:
      sum("fare") +
      sum("no show fee") +
      sum("commission") +
      sum("wage") +
      sum("repair") +
      sum("tow") -
      fuel,
  };
}
