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
    car.waiting =
      ahead ||
      (d < 22 && claimed.has(target) && claimed.get(target) !== car.id);
    car.speed = car.waiting ? 0 : (rain ? 6 : 10) / (rush ? 1.2 : 1);
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
