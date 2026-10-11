import { nodes, distance, type Point } from "./world";
export type TrafficCar = Point & {
  id: number;
  loop: number[];
  index: number;
  heading: number;
  speed: number;
  waiting: boolean;
  color: number;
};
export function createTraffic(): TrafficCar[] {
  return Array.from({ length: 25 }, (_, i) => {
    const r = (i * 2) % 5,
      c = Math.floor(i / 5) % 5,
      loop =
        i % 2 === 0
          ? [
              r * 6,
              ...Array.from({ length: 5 }, (_, j) => r * 6 + j + 1),
              (r + 1) * 6 + 5,
              ...Array.from({ length: 5 }, (_, j) => (r + 1) * 6 + 4 - j),
            ]
          : [
              c,
              ...Array.from({ length: 5 }, (_, j) => (j + 1) * 6 + c),
              30 + c + 1,
              ...Array.from({ length: 5 }, (_, j) => (4 - j) * 6 + c + 1),
            ];
    const index = i % loop.length,
      a = nodes[loop[index]],
      b = nodes[loop[(index + 1) % loop.length]],
      heading = Math.atan2(b.y - a.y, b.x - a.x);
    return {
      id: i,
      loop,
      index: (index + 1) % loop.length,
      x: a.x - Math.sin(heading) * 6,
      y: a.y + Math.cos(heading) * 6,
      heading,
      speed: 0,
      waiting: false,
      color: i % 3 === 0 ? 0xe5b64d : 0x84958d,
    };
  });
}
export function updateTraffic(
  cars: TrafficCar[],
  dt: number,
  rain: boolean,
  rush: boolean,
  real = 0,
  player?: Point,
) {
  const claimed = new Map<number, number>();
  for (const car of cars) {
    const target = car.loop[car.index];
    if (distance(car, nodes[target]) < 17 && !claimed.has(target))
      claimed.set(target, car.id);
  }
  for (const car of cars) {
    const target = car.loop[car.index],
      n = nodes[target],
      h = car.heading,
      to = { x: n.x - Math.sin(h) * 6, y: n.y + Math.cos(h) * 6 };
    const d = distance(car, to);
    const ahead = cars.some(
      (o) =>
        o.id !== car.id &&
        distance(car, o) < 15 &&
        (o.x - car.x) * Math.cos(h) + (o.y - car.y) * Math.sin(h) > 0 &&
        Math.cos(o.heading - h) > 0.7,
    );
    const playerAhead =
      player &&
      distance(car, player) < 15 &&
      (player.x - car.x) * Math.cos(h) + (player.y - car.y) * Math.sin(h) > 0 &&
      Math.abs(
        (player.x - car.x) * Math.sin(h) - (player.y - car.y) * Math.cos(h),
      ) < 7;
    const vertical = Math.abs(Math.sin(h)) > 0.7;
    const red =
      target % 3 === 1 &&
      (Math.floor(real / 12) + target) % 2 !== (vertical ? 0 : 1);
    car.waiting =
      ahead ||
      !!playerAhead ||
      (red && d > 13 && d < 27) ||
      (d < 22 && claimed.has(target) && claimed.get(target) !== car.id);
    const desired = car.waiting ? 0 : (rain ? 6 : 10) / (rush ? 1.2 : 1);
    car.speed +=
      Math.sign(desired - car.speed) *
      Math.min(Math.abs(desired - car.speed), dt * (car.waiting ? 18 : 4));
    const step = Math.min(d, car.speed * dt);
    if (d > 0.2) {
      car.x += ((to.x - car.x) / d) * step;
      car.y += ((to.y - car.y) / d) * step;
    } else {
      car.index = (car.index + 1) % car.loop.length;
      const next = nodes[car.loop[car.index]];
      car.heading = Math.atan2(next.y - car.y, next.x - car.x);
    }
  }
}
export function trafficBlocks(cars: TrafficCar[], p: Point, heading: number) {
  return cars.some(
    (o) =>
      distance(p, o) < 13 &&
      (o.x - p.x) * Math.cos(heading) + (o.y - p.y) * Math.sin(heading) > 0 &&
      Math.cos(o.heading - heading) > 0.7,
  );
}

// Oriented vehicle footprints: adjacent lanes do not collide simply because centers are close.
export function vehiclesOverlap(
  a: Point & { heading: number },
  b: Point & { heading: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const axis of [
    a.heading,
    a.heading + Math.PI / 2,
    b.heading,
    b.heading + Math.PI / 2,
  ]) {
    const radius = (h: number) =>
      4 * Math.abs(Math.cos(h - axis)) + 2 * Math.abs(Math.sin(h - axis));
    if (
      Math.abs(dx * Math.cos(axis) + dy * Math.sin(axis)) >=
      radius(a.heading) + radius(b.heading)
    )
      return false;
  }
  return true;
}
