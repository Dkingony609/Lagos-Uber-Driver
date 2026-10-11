import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { nodes, services } from "./world";
import { C } from "./config";
import { tick, type State, type Input } from "./simulation";
export function WorldView({
  state,
  onChange,
  onInteract,
  onPause,
}: {
  state: { current: State };
  onChange: () => void;
  onInteract: () => void;
  onPause: () => void;
}) {
  const keyState = useRef<Input>({}),
    host = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onChange, onInteract, onPause });
  callbacks.current = { onChange, onInteract, onPause };
  useEffect(() => {
    const keys = keyState.current;
    const handler = (e: KeyboardEvent, down: boolean) => {
      let key = e.key.toLowerCase();
      if (down && !e.repeat && key === "escape") {
        e.preventDefault();
        callbacks.current.onPause();
        return;
      }
      const active = document.activeElement;
      if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName))
        return;
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      )
        e.preventDefault();
      if (key === "w" || key === "arrowup") keys.up = down;
      if (key === "s" || key === "arrowdown") keys.down = down;
      if (key === "a" || key === "arrowleft") keys.left = down;
      if (key === "d" || key === "arrowright") keys.right = down;
      if (key === " ") keys.brake = down;
      if (down && !e.repeat && key === "e") callbacks.current.onInteract();
    };
    const kd = (e: KeyboardEvent) => handler(e, true),
      ku = (e: KeyboardEvent) => handler(e, false),
      blur = () => {
        Object.keys(keys).forEach((k) => (keys[k as keyof Input] = false));
      };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    let accumulator = 0,
      lastPaint = 0;
    const keys = keyState.current;
    let previousOwner = { ...state.current.owner },
      previousFleet = state.current.fleet
        ? { ...state.current.fleet.car }
        : null;
    class World extends Phaser.Scene {
      g!: Phaser.GameObjects.Graphics;
      labels: Phaser.GameObjects.Text[] = [];
      create() {
        this.g = this.add.graphics();
        this.drawCity();
        this.g.generateTexture("lagos-city", 590, 600);
        this.add.image(0, 0, "lagos-city").setOrigin(0).setDepth(-1);
        this.g.clear();
        const text = (
          x: number,
          y: number,
          t: string,
          size = 10,
          color = "#8ca89d",
        ) =>
          this.add
            .text(x, y, t, {
              fontFamily: "Arial, sans-serif",
              fontSize: size,
              color,
              fontStyle: "bold",
            })
            .setOrigin(0.5);
        text(293, 27, "IKEJA", 14);
        text(293, 244, "YABA", 14);
        text(293, 552, "SURULERE", 14);
        text(66, 547, "DEPOT", 8, "#e5bf6a");
        text(516, 252, "FUEL", 8, "#e5bf6a");
        text(516, 39, "REPAIR", 8, "#e5bf6a");
        text(
          291,
          583,
          "COMPRESSED FICTIONAL LAYOUT • NOT A NAVIGATION MAP",
          7,
          "#6c8a80",
        );
      }
      update(_time: number, delta: number) {
        const s = state.current;
        accumulator += Math.min(delta / 1000, 0.1);
        while (accumulator >= C.tick) {
          previousOwner = { ...s.owner };
          previousFleet = s.fleet ? { ...s.fleet.car } : null;
          tick(s, keys);
          accumulator -= C.tick;
        }
        if (s.real - lastPaint > 0.1) {
          callbacks.current.onChange();
          lastPaint = s.real;
        }
        this.paint(s, accumulator / C.tick);
      }
      drawCity() {
        const g = this.g;
        g.fillStyle(0x182e28);
        g.fillRoundedRect(10, 10, 570, 570, 18);
        // Original geometric city blocks: shade, courtyards, shop roofs, roadside trees.
        for (let y = 0; y < 5; y++)
          for (let x = 0; x < 5; x++) {
            const bx = 65 + x * 90 + 17,
              by = 65 + y * 90 + 17;
            g.fillStyle((x + y) % 3 === 0 ? 0x234236 : 0x203b32);
            g.fillRoundedRect(bx, by, 56, 56, 6);
            for (let k = 0; k < 4; k++) {
              const xx = bx + 5 + (k % 2) * 26,
                yy = by + 6 + Math.floor(k / 2) * 26;
              g.fillStyle(
                [0x62735e, 0x756956, 0x566d65, 0x5a675c][(x + y + k) % 4],
              );
              g.fillRect(xx, yy, 20, 17);
              g.fillStyle(0xffffff, 0.08);
              g.fillRect(xx + 2, yy + 2, 16, 2);
            }
            g.fillStyle(0x356c4a);
            g.fillCircle(bx + 53, by + 9, 5);
            g.fillCircle(bx + 4, by + 50, 4);
          }
        g.lineStyle(30, 0x101f22);
        for (let i = 0; i < 6; i++) {
          g.lineBetween(50, 65 + i * 90, 530, 65 + i * 90);
          g.lineBetween(65 + i * 90, 50, 65 + i * 90, 530);
        }
        g.lineStyle(25, 0x344347);
        for (let i = 0; i < 6; i++) {
          g.lineBetween(50, 65 + i * 90, 530, 65 + i * 90);
          g.lineBetween(65 + i * 90, 50, 65 + i * 90, 530);
        }
        g.lineStyle(1, 0xc2b899, 0.35);
        for (let i = 0; i < 6; i++)
          for (let j = 51; j < 530; j += 18) {
            if (Math.abs((((j - 65) % 90) + 90) % 90) > 16) {
              g.lineBetween(j, 65 + i * 90, j + 7, 65 + i * 90);
              g.lineBetween(65 + i * 90, j, 65 + i * 90, j + 7);
            }
          }
        for (const n of nodes) {
          g.fillStyle(0x344347);
          g.fillRect(n.x - 12, n.y - 12, 24, 24);
          g.fillStyle(0xd6d4b3, 0.35);
          for (let z = 0; z < 4; z++)
            g.fillRect(n.x - 9 + z * 5, n.y - 18, 2, 5);
        }
        for (const [name, id] of Object.entries(services)) {
          const n = nodes[id];
          g.fillStyle(name === "depot" ? 0xe1b76b : 0x98c9ac);
          g.fillRoundedRect(n.x - 10, n.y - 10, 20, 20, 4);
          g.lineStyle(2, 0x172b29);
          g.strokeRoundedRect(n.x - 6, n.y - 6, 12, 12, 2);
        }
      }
      paint(s: State, alpha: number) {
        const mix = (a: number, b: number) => a + (b - a) * alpha;
        const owner = {
          ...s.owner,
          x: mix(previousOwner.x, s.owner.x),
          y: mix(previousOwner.y, s.owner.y),
          heading: mix(previousOwner.heading, s.owner.heading),
        };
        const fleetCar =
          s.fleet && previousFleet
            ? {
                ...s.fleet.car,
                x: mix(previousFleet.x, s.fleet.car.x),
                y: mix(previousFleet.y, s.fleet.car.y),
              }
            : s.fleet?.car;
        const g = this.g;
        g.clear();
        const t = s.trip;
        if (t && !t.settled) {
          g.lineStyle(4, 0x82e3c5, 0.65);
          const target = t.state === "onboard" ? t.destination : t.pickup;
          const points = [owner, ...t.route.map((id) => nodes[id])];
          g.beginPath();
          g.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((p) => g.lineTo(p.x, p.y));
          g.strokePath();
          const n = nodes[target];
          g.lineStyle(2, 0xa5ffdc);
          g.strokeCircle(n.x, n.y, 12 + Math.sin(s.real * 3) * 2);
          g.fillStyle(0xa5ffdc);
          g.fillCircle(n.x, n.y, 4);
        }
        if (s.offer) {
          const n = nodes[s.offer.pickup];
          g.lineStyle(2, 0xe7c275);
          g.strokeCircle(n.x, n.y, 11);
        }
        for (const car of s.traffic) {
          this.car(car.x, car.y, car.heading, car.color, 6, 11);
          if (car.waiting) {
            g.fillStyle(0xf59a6d);
            g.fillCircle(
              car.x - Math.cos(car.heading) * 5,
              car.y - Math.sin(car.heading) * 5,
              1.5,
            );
          }
        }
        if (fleetCar)
          this.car(fleetCar.x, fleetCar.y, fleetCar.heading, 0xa18be1, 7, 13);
        this.car(s.owner.x, s.owner.y, s.owner.heading, 0xb2f5d0, 8, 14);
        g.lineStyle(1, 0xa5ffdc, 0.45);
        g.strokeCircle(owner.x, owner.y, 12);
        if (s.rain) {
          g.lineStyle(1, 0xb0d8ec, 0.25);
          for (let i = 0; i < 70; i++) {
            const x = (i * 71 + s.real * 33) % 580,
              y = (i * 113 + s.real * 160) % 580;
            g.lineBetween(x, y, x - 3, y + 8);
          }
        }
      }
      car(
        x: number,
        y: number,
        h: number,
        color: number,
        w: number,
        l: number,
      ) {
        const g = this.g;
        const pts = [
          [-l / 2, -w / 2],
          [l / 2, -w / 2],
          [l / 2, w / 2],
          [-l / 2, w / 2],
        ].map(
          ([a, b]) =>
            new Phaser.Geom.Point(
              x + a * Math.cos(h) - b * Math.sin(h),
              y + a * Math.sin(h) + b * Math.cos(h),
            ),
        );
        g.fillStyle(0x071413, 0.5);
        g.fillCircle(x + 2, y + 2, l / 2);
        g.fillStyle(color);
        g.fillPoints(pts, true);
        g.lineStyle(2, 0x203c3b);
        g.lineBetween(
          x + Math.cos(h) * 2 - (Math.sin(h) * w) / 3,
          y + Math.sin(h) * 2 + (Math.cos(h) * w) / 3,
          x + Math.cos(h) * 2 + (Math.sin(h) * w) / 3,
          y + Math.sin(h) * 2 - (Math.cos(h) * w) / 3,
        );
        g.fillStyle(0xffefad);
        g.fillCircle(x + (Math.cos(h) * l) / 2, y + (Math.sin(h) * l) / 2, 1.2);
      }
    }
    const targetFPS =
      import.meta.env.DEV &&
      new URLSearchParams(location.search).get("fps") === "30"
        ? 30
        : 60;
    const game = new Phaser.Game({
      fps: { target: targetFPS, forceSetTimeOut: targetFPS === 30 },
      type: Phaser.AUTO,
      parent: host.current!,
      width: 590,
      height: 600,
      backgroundColor: "#142723",
      scene: World,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      audio: { noAudio: true },
    });
    return () => game.destroy(true);
  }, [state]);
  return (
    <div
      className="world-canvas"
      ref={host}
      aria-label="Playable fictional Lagos driving world"
    />
  );
}
