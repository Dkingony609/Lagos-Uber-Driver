import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { nodes, fuelPump } from "./world";
import { adSlots, type Experience } from "./experience";
export const material = (
  color: T.ColorRepresentation,
  extra: T.MeshStandardMaterialParameters = {},
) =>
  new T.MeshLambertMaterial({
    color,
    transparent: extra.transparent,
    opacity: extra.opacity,
    emissive: extra.emissive,
    emissiveIntensity: extra.emissiveIntensity,
  });
export function label(
  text: string,
  bg = "#163e36",
  fg = "#fff5dd",
  w = 15,
  h = 4,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 192;
  const c = canvas.getContext("2d")!;
  c.fillStyle = bg;
  c.fillRect(0, 0, 768, 192);
  c.fillStyle = fg;
  c.font = "bold 54px Arial";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, 384, 96, 730);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
  );
}
export function buildCity(scene: T.Scene, experience: Experience) {
  const batches = new Map<
    string,
    { mat: T.MeshLambertMaterial; geometries: T.BufferGeometry[] }
  >();
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    let batch = batches.get(color);
    if (!batch) {
      batch = { mat: material(color), geometries: [] };
      batches.set(color, batch);
    }
    const geo = new T.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    batch.geometries.push(geo);
  }
  box(290, -0.7, 290, 660, 1, 660, "#827b60");
  for (let i = 0; i < 6; i++) {
    const v = 65 + i * 90;
    box(v, -0.02, 290, 24, 0.3, 482, "#383e3e");
    box(290, 0, v, 482, 0.3, 24, "#383e3e");
    for (let j = 0; j < 5; j++)
      for (let k = 0; k < 10; k++) {
        const a = 84 + j * 90 + k * 6;
        box(v, 0.18, a, 0.2, 0.08, 3, "#dedabf");
        box(a, 0.18, v, 3, 0.08, 0.2, "#dedabf");
      }
  }
  const signs = [
    "Ikeja Auto Parts",
    "Yaba Market",
    "Surulere Kitchen",
    "Mama T’s provisions",
    "Tailor · Repairs",
    "Cold drinks",
    "Phone repairs",
    "Buka · Amala",
    "Barber shop",
    "Fresh bread",
  ];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++) {
      const x = 110 + col * 90,
        z = 110 + row * 90;
      box(x, 0.25, z, 62, 0.6, 62, "#b5aa8b");
      for (let b = 0; b < 4; b++) {
        const bx = x + (b % 2 ? 16 : -16),
          bz = z + (b > 1 ? 16 : -16),
          height = 8 + ((row * 5 + col + b) % 5) * 3;
        box(
          bx,
          height / 2 + 0.6,
          bz,
          26,
          height,
          23,
          ["#cead83", "#b9bba8", "#ba795c", "#9aafab", "#c4bd9f"][
            (col + row + b) % 5
          ],
        );
        box(bx, height + 0.7, bz, 28, 0.7, 25, "#686858");
        if ((col + row + b) % 3 === 0)
          box(bx + 5, height + 1.8, bz, 4, 2, 4, "#333d3f"); // water tanks
        for (let floor = 0; floor < Math.floor(height / 4); floor++)
          for (let w = 0; w < 3; w++) {
            box(
              bx - 8 + w * 8,
              3 + floor * 4,
              bz - 11.6,
              3,
              1.8,
              0.2,
              "#37525b",
            );
            box(
              bx - 8 + w * 8,
              3 + floor * 4,
              bz + 11.6,
              3,
              1.8,
              0.2,
              "#37525b",
            );
          }
        if (b < 2) {
          box(
            bx,
            1.8,
            bz - 12.5,
            27,
            0.25,
            4,
            ["#317769", "#d89b45", "#b65e4c"][col % 3],
          );
          const sign = label(
            signs[(row * 5 + col + b) % signs.length],
            "#294b43",
            "#fff3d8",
            23,
            2.3,
          );
          sign.position.set(bx, 4, bz - 11.8);
          scene.add(sign);
          box(bx, 1.5, bz - 11.65, 8, 2.8, 0.2, "#253d3c");
        }
      }
      for (let k = 0; k < 3; k++) {
        const tx = x - 29 + k * 29,
          tz = z + 30;
        box(tx, 2, tz, 0.5, 4, 0.5, "#6e5340");
        const crown = new T.Mesh(
          new T.IcosahedronGeometry(3.5, 0),
          material("#62744d"),
        );
        crown.position.set(tx, 5, tz);
        scene.add(crown);
      }
    }
  // Filling station: a drive-in apron, pump islands and open canopy.
  box(550, 0.12, 245, 58, 0.35, 56, "#b3b0a0");
  box(547, 0.15, 245, 60, 0.35, 24, "#90938a");
  box(560, 7.8, 245, 44, 1, 42, "#e2d8b9");
  box(560, 8.5, 245, 44, 0.4, 42, "#299370");
  for (const x of [541, 578])
    for (const z of [228, 263]) box(x, 3.8, z, 0.65, 7.6, 0.65, "#e5e0c7");
  for (const z of [238, 254]) {
    box(fuelPump.x, 0.55, z, 5, 1.2, 5, "#ded9c4");
    box(fuelPump.x, 2, z, 1.8, 2, 1.2, "#268565");
    box(fuelPump.x, 2.4, z - 0.65, 1.2, 0.6, 0.1, "#122d29");
    box(fuelPump.x + 1, 1.7, z, 0.15, 2, 0.15, "#303b39");
  }
  const petrol = label("PETROL · ₦950 / L", "#1e7761", "#fff3d8", 38, 4);
  petrol.position.set(560, 7.8, 223.8);
  scene.add(petrol);
  const pumpSign = label(
    "STOP HERE · E TO REFILL",
    "#315e50",
    "#fff3d8",
    20,
    2,
  );
  pumpSign.rotation.x = -Math.PI / 2;
  pumpSign.position.set(fuelPump.x, 0.4, 245);
  scene.add(pumpSign);
  const attendant = person("#edba58");
  attendant.position.set(564, 0, 251);
  scene.add(attendant);
  const depot = label("DRIVER DEPOT", "#1f564d", "#fff2d3", 25, 4);
  depot.position.set(83, 5, 533);
  depot.rotation.y = Math.PI;
  scene.add(depot);
  const workshop = label("MECHANIC · REPAIRS", "#654e32", "#fff1cd", 25, 4);
  workshop.position.set(513, 5, 43);
  scene.add(workshop);
  // Roadside people, shop counters, power poles and overhead cables.
  for (let i = 0; i < 22; i++) {
    const n = nodes[(i * 7) % 36],
      p = person(["#e5a544", "#378677", "#c38ac2"][i % 3]);
    p.position.set(n.x + 19, 0, n.y + 20);
    p.rotation.y = i;
    scene.add(p);
  }
  for (const n of nodes) {
    box(n.x + 16, 6, n.y + 17, 0.35, 12, 0.35, "#595c56");
    box(n.x + 13.5, 11.5, n.y + 17, 5, 0.2, 0.2, "#595c56");
    box(n.x + 11.5, 11.4, n.y + 17, 1.3, 0.2, 1, "#f1e1ae");
  }
  for (let row = 0; row < 6; row++) {
    const cable = new T.BufferGeometry().setFromPoints(
      Array.from(
        { length: 31 },
        (_, i) =>
          new T.Vector3(
            81 + i * 15,
            11.9 - Math.sin((i * Math.PI) / 6) * 0.5,
            82 + row * 90,
          ),
      ),
    );
    scene.add(new T.Line(cable, new T.LineBasicMaterial({ color: "#464843" })));
  }
  const boards = adSlots.map((slot) => {
    box(slot.x, 3.5, slot.y, 0.8, 7, 0.8, "#4e5953");
    const board = label("", "#163e36", "#fff", 30, 10);
    board.position.set(slot.x, 12, slot.y);
    board.rotation.y = slot.heading;
    (board.material as T.MeshBasicMaterial).side = T.FrontSide;
    const back = new T.Mesh(new T.PlaneGeometry(30, 10), board.material);
    back.rotation.y = Math.PI;
    back.position.z = -0.05;
    board.add(back);
    scene.add(board);
    return board;
  });
  for (const batch of batches.values()) {
    const geo = mergeGeometries(batch.geometries);
    if (geo) scene.add(new T.Mesh(geo, batch.mat));
    batch.geometries.forEach((g) => g.dispose());
  }
  updateBoards(boards, experience);
  return boards;
}
export function updateBoards(boards: T.Mesh[], e: Experience) {
  boards.forEach((board, i) => {
    const ad = e.ads[adSlots[i].id],
      mat = board.material as T.MeshBasicMaterial,
      canvas = mat.map!.image as HTMLCanvasElement,
      c = canvas.getContext("2d")!;
    c.fillStyle = ad.active ? ad.color : "#244d43";
    c.fillRect(0, 0, 768, 192);
    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.font = "bold 24px Arial";
    c.fillText(
      ad.active ? ad.brand : "LAGOS DRIVER · STREET ADS",
      384,
      33,
      720,
    );
    c.font = "bold 42px Arial";
    c.fillText(
      ad.active ? ad.headline : "Your business belongs here.",
      384,
      94,
      720,
    );
    c.font = "21px Arial";
    c.fillText(
      ad.active ? ad.detail : "Open Street ads to place a campaign",
      384,
      152,
      720,
    );
    mat.map!.needsUpdate = true;
  });
}
export function person(shirt = "#568eae") {
  const g = new T.Group();
  const sphere = (
    r: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) => {
    const m = new T.Mesh(new T.SphereGeometry(r, 8, 6), material(color));
    m.position.set(x, y, z);
    g.add(m);
  };
  const part = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  sphere(0.36, 0, 2.75, 0, "#71462f");
  sphere(0.36, 0, 2.89, -0.08, "#242726");
  part(0.9, 1.05, 0.48, 0, 1.95, 0, shirt);
  part(0.35, 1.1, 0.35, -0.23, 0.9, 0, "#303c45");
  part(0.35, 1.1, 0.35, 0.23, 0.9, 0, "#303c45");
  part(0.27, 0.95, 0.3, -0.65, 1.9, 0.1, "#71462f");
  part(0.27, 0.95, 0.3, 0.65, 1.9, 0.1, "#71462f");
  return g;
}
export function car(
  color: T.ColorRepresentation,
  detailed = false,
  van = false,
) {
  const g = new T.Group();
  g.name = detailed ? "player-car" : "traffic-car";
  const parts = new Map<string, { m: T.Material; gs: T.BufferGeometry[] }>();
  const body = material(color, { metalness: 0.25, roughness: 0.4 }),
    dark = material("#25353c"),
    glass = material("#83c4cf", {
      transparent: detailed,
      opacity: detailed ? 0.25 : 1,
      roughness: 0.12,
    });
  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
  ) => {
    const key = m.uuid;
    let p = parts.get(key);
    if (!p) {
      p = { m, gs: [] };
      parts.set(key, p);
    }
    const geo = new T.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    p.gs.push(geo);
  };
  add(4, 1.35, 8, 0, 1.25, 0, body);
  add(
    3.5,
    van ? 2.5 : 1.75,
    van ? 6.3 : 4.6,
    0,
    van ? 3.1 : 2.75,
    -0.35,
    glass,
  );
  add(
    3.65,
    0.2,
    van ? 6.5 : 4.8,
    0,
    van ? 4.4 : 3.7,
    -0.35,
    detailed ? glass : body,
  );
  if (van) {
    add(4.05, 0.3, 7.8, 0, 1.7, 0, dark);
    add(0.15, 1.3, 6.1, 0, 3, -0.35, dark);
  }
  add(3.5, 0.25, 0.3, 0, 0.7, 4, dark);
  add(3.5, 0.25, 0.3, 0, 0.7, -4, dark);
  const lamp = material("#ffebaa", {
    emissive: "#ffe2a2",
    emissiveIntensity: 0.5,
  });
  add(0.8, 0.35, 0.1, -1.25, 1.35, 4.04, lamp);
  add(0.8, 0.35, 0.1, 1.25, 1.35, 4.04, lamp);
  const brake = new T.MeshBasicMaterial({ color: "#762b20" });
  add(0.75, 0.3, 0.1, -1.3, 1.35, -4.04, brake);
  add(0.75, 0.3, 0.1, 1.3, 1.35, -4.04, brake);
  for (const p of parts.values()) {
    const merged = mergeGeometries(p.gs)!;
    g.add(new T.Mesh(merged, p.m));
    p.gs.forEach((v) => v.dispose());
  }
  const wheels: T.Mesh[] = [];
  for (const x of [-2, 2])
    for (const z of [-2.7, 2.7]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.72, 0.72, 0.4, 10), dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.72, z);
      g.add(w);
      wheels.push(w);
    }
  let driver: T.Group | undefined,
    passenger: T.Group | undefined,
    wheel: T.Mesh | undefined;
  if (detailed) {
    const seats = material("#344b47");
    for (const x of [-0.9, 0.9])
      for (const z of [-1.65, 0.7]) {
        const seat = new T.Mesh(new T.BoxGeometry(1.25, 1.35, 1.05), seats);
        seat.position.set(x, 1.8, z);
        g.add(seat);
      }
    driver = person("#568eae");
    driver.name = "visible-driver";
    driver.scale.set(0.7, 0.7, 0.7);
    driver.position.set(0.9, 0.95, 0.75);
    g.add(driver);
    passenger = person("#e7af56");
    passenger.name = "visible-passenger";
    passenger.scale.set(0.7, 0.7, 0.7);
    passenger.position.set(-0.9, 0.95, -1.7);
    g.add(passenger);
    const dashboard = new T.Mesh(new T.BoxGeometry(3.45, 0.35, 0.9), dark);
    dashboard.position.set(0, 2.2, 1.9);
    g.add(dashboard);
    wheel = new T.Mesh(new T.TorusGeometry(0.4, 0.055, 6, 16), dark);
    wheel.position.set(0.9, 2.45, 1.45);
    wheel.rotation.x = -0.35;
    g.add(wheel);
    const skin = material("#71462f");
    for (const x of [-0.37, 0.37]) {
      const hand = new T.Mesh(new T.SphereGeometry(0.115, 10, 8), skin);
      hand.position.set(x, 0, -0.07);
      wheel.add(hand);
      const from = new T.Vector3(0.9 + x, 2.32, 0.83),
        to = new T.Vector3(0.9 + x, 2.45, 1.38),
        delta = to.clone().sub(from);
      const arm = new T.Mesh(
        new T.CylinderGeometry(0.105, 0.115, delta.length(), 8),
        skin,
      );
      arm.position.copy(from.add(to).multiplyScalar(0.5));
      arm.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      );
      g.add(arm);
    }
    const mirror = new T.Mesh(new T.BoxGeometry(0.65, 0.3, 0.14), glass);
    mirror.position.set(0, 3.1, 1.75);
    g.add(mirror);
  }
  return { g, wheels, brake, driver, passenger, wheel };
}
export function disposeScene(scene: T.Scene) {
  const materials = new Set<T.Material>(),
    geometries = new Set<T.BufferGeometry>(),
    textures = new Set<T.Texture>();
  scene.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Line) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        const map = (m as T.MeshBasicMaterial).map;
        if (map) textures.add(map);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
