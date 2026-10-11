export type Point = { x: number; y: number };
export const nodes = Array.from({ length: 36 }, (_, id) => ({
  id,
  x: 65 + (id % 6) * 90,
  y: 65 + Math.floor(id / 6) * 90,
  zone:
    Math.floor(id / 6) < 2
      ? "Ikeja"
      : Math.floor(id / 6) < 4
        ? "Yaba"
        : "Surulere",
}));
export const services = { depot: 30, fuel: 17, repair: 5 };
export const fuelPump = { x: 550, y: 245 };
export const endpoints = nodes.filter((n) => ![30, 17, 5].includes(n.id));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function nearest(p: Point) {
  return nodes.reduce((a, b) => (distance(p, a) < distance(p, b) ? a : b)).id;
}
export function route(a: number, b: number, traffic = 1, rain = false) {
  const costs = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    open = new Set(nodes.map((n) => n.id));
  costs[a] = 0;
  while (open.size) {
    let u = [...open].reduce((a, b) => (costs[a] < costs[b] ? a : b));
    open.delete(u);
    if (u === b) break;
    for (const v of [
      u - 6,
      u + 6,
      ...(u % 6 > 0 ? [u - 1] : []),
      ...(u % 6 < 5 ? [u + 1] : []),
    ].filter((v) => v >= 0 && v < 36 && open.has(v))) {
      const weight =
        90 *
        traffic *
        (rain ? 1.2 : 1) *
        (u % 6 === 2 && v % 6 === 2 ? 1.2 : 1);
      if (costs[u] + weight < costs[v]) {
        costs[v] = costs[u] + weight;
        prev[v] = u;
      }
    }
  }
  const out = [b];
  while (out[0] !== a && prev[out[0]] >= 0) out.unshift(prev[out[0]]);
  return out;
}
export const pathLength = (path: number[]) => Math.max(0, path.length - 1) * 90;
export function road(p: Point) {
  return (
    (p.x >= 515 && p.x <= 577 && p.y >= 224 && p.y <= 270) ||
    (p.x >= 49 &&
      p.x <= 531 &&
      p.y >= 49 &&
      p.y <= 531 &&
      nodes.some((n) => Math.abs(p.x - n.x) <= 12 || Math.abs(p.y - n.y) <= 12))
  );
}
