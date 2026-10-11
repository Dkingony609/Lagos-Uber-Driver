import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { nodes, fuelPump } from "./world";
import { C } from "./config";
import { tick, type State, type Input } from "./simulation";
import {
  cameras,
  adSlots,
  persistExperience,
  type Experience,
} from "./experience";
import { buildCity, car, person, updateBoards, disposeScene } from "./city3d";
export function WorldView({
  state,
  experience,
  onChange,
  onInteract,
  onPause,
}: {
  state: { current: State };
  experience: { current: Experience };
  onChange: () => void;
  onInteract: () => void;
  onPause: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    keys = useRef<Input>({}),
    callbacks = useRef({ onChange, onInteract, onPause });
  const [error, setError] = useState("");
  callbacks.current = { onChange, onInteract, onPause };
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "This 3D view needs WebGL. Enable hardware acceleration in your browser and reload.",
      );
      return;
    }
    const gl = renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    const software =
      debug &&
      /swiftshader|llvmpipe|software/i.test(
        String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)),
      );
    const sharpRatio = Math.min(window.devicePixelRatio, 1.5);
    let quality = experience.current.quality,
      ratio =
        quality === "Low"
          ? 0.55
          : quality === "High"
            ? sharpRatio
            : software
              ? 0.6
              : sharpRatio;
    let qualitySeconds = 0,
      qualityFrames = 0;
    renderer.setPixelRatio(ratio);
    renderer.setClearColor("#c6d5d2");
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "3D Lagos driving view");
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.Fog("#c6d5d2", 90, 300);
    scene.add(new T.HemisphereLight("#dce9ff", "#655b3e", 2.3));
    const sun = new T.DirectionalLight("#fff0d1", 2.2);
    sun.position.set(-120, 170, 80);
    scene.add(sun);
    const camera = new T.PerspectiveCamera(62, 1, 0.1, 1000),
      boards = buildCity(scene, experience.current);
    const owner = car("#a4dbcb", true),
      fleet = car("#b59ade", true),
      traffic = state.current.traffic.map((c) =>
        car(c.color, false, c.id % 3 === 0),
      );
    scene.add(owner.g, fleet.g, ...traffic.map((c) => c.g));
    const pickup = person("#d98355");
    pickup.name = "waiting-passenger";
    scene.add(pickup);
    const pin = new T.Mesh(
      new T.ConeGeometry(1.8, 3.5, 12),
      new T.MeshBasicMaterial({ color: "#e6bb68" }),
    );
    pin.rotation.z = Math.PI;
    scene.add(pin);
    const routeLine = new T.Line(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({ color: "#80fad4" }),
    );
    scene.add(routeLine);
    const signals = nodes
      .filter((n) => n.id % 3 === 1)
      .map((n) => {
        const g = new T.Group(),
          pole = new T.Mesh(
            new T.BoxGeometry(0.3, 5, 0.3),
            new T.MeshStandardMaterial({ color: "#4b5652" }),
          );
        pole.position.y = 2.5;
        g.add(pole);
        const light = new T.Mesh(
          new T.SphereGeometry(0.35, 8, 6),
          new T.MeshBasicMaterial({ color: "#67b969" }),
        );
        light.position.set(0, 4.8, 0);
        g.add(light);
        g.position.set(n.x + 13, 0, n.y - 13);
        scene.add(g);
        return { n, light };
      });
    const rainDrops = new T.InstancedMesh(
      new T.BoxGeometry(0.025, 1.4, 0.025),
      new T.MeshBasicMaterial({
        color: "#d5e9ee",
        transparent: true,
        opacity: 0.45,
      }),
      160,
    );
    scene.add(rainDrops);
    const rainMatrix = new T.Matrix4();
    let stopped = false,
      raf = 0,
      last = performance.now(),
      accumulator = 0,
      uiTimer = 0,
      adTimer = 0,
      routeKey = "",
      boardKey = "",
      yaw = state.current.owner.heading;
    const seen = new Set<string>();
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w && h) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resize.observe(el);
    const clearKeys = () => {
      for (const k of Object.keys(keys.current))
        keys.current[k as keyof Input] = false;
    };
    const keyboard = (e: KeyboardEvent, down: boolean) => {
      const key = e.key.toLowerCase();
      if (down && !e.repeat && key === "escape") {
        e.preventDefault();
        callbacks.current.onPause();
        clearKeys();
        return;
      }
      if (
        down &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (document.activeElement as HTMLElement)?.tagName,
        ) &&
        key !== "escape"
      )
        return;
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      )
        e.preventDefault();
      if (["w", "arrowup"].includes(key)) keys.current.up = down;
      if (["s", "arrowdown"].includes(key)) keys.current.down = down;
      if (["a", "arrowleft"].includes(key)) keys.current.left = down;
      if (["d", "arrowright"].includes(key)) keys.current.right = down;
      if (key === " ") keys.current.brake = down;
      if (down && !e.repeat && key === "e") callbacks.current.onInteract();
      if (down && !e.repeat && key === "c") {
        const e = experience.current;
        e.camera = cameras[(cameras.indexOf(e.camera) + 1) % cameras.length];
        e.orbit = 0;
        persistExperience(e);
        callbacks.current.onChange();
      }
      if (down && !e.repeat && key === "h" && !state.current.paused)
        window.dispatchEvent(new Event("lagos-horn"));
    };
    const kd = (e: KeyboardEvent) => keyboard(e, true),
      ku = (e: KeyboardEvent) => keyboard(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", clearKeys);
    let pointer: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (!pointer) return;
      const ex = experience.current;
      ex.orbit += (e.clientX - pointer.x) * 0.009;
      ex.tilt = T.MathUtils.clamp(
        ex.tilt + (e.clientY - pointer.y) * 0.005,
        0.05,
        1.2,
      );
      pointer = { x: e.clientX, y: e.clientY };
    };
    const pu = () => {
      pointer = null;
      persistExperience(experience.current);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      experience.current.zoom = T.MathUtils.clamp(
        experience.current.zoom + event.deltaY * 0.025,
        12,
        60,
      );
      persistExperience(experience.current);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointermove", pm);
    canvas.addEventListener("pointerup", pu);
    canvas.addEventListener("pointercancel", pu);
    canvas.addEventListener("wheel", wheel, { passive: false });
    const place = (
      mesh: ReturnType<typeof car>,
      v: State["owner"] | State["traffic"][number],
      dt: number,
      braking: boolean,
    ) => {
      mesh.g.position.set(v.x, 0, v.y);
      mesh.g.rotation.y = Math.PI / 2 - v.heading;
      mesh.wheels.forEach((w) => {
        w.rotation.x += (v.speed * dt) / 0.72;
      });
      mesh.brake.color.set(braking ? "#ff3520" : "#762b20");
    };
    function frame(now: number) {
      if (stopped) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      accumulator += dt;
      while (accumulator >= C.tick) {
        tick(state.current, keys.current);
        accumulator -= C.tick;
      }
      qualitySeconds += dt;
      qualityFrames++;
      if (quality !== experience.current.quality) {
        quality = experience.current.quality;
        ratio =
          quality === "Low"
            ? 0.55
            : quality === "High"
              ? sharpRatio
              : software
                ? 0.6
                : sharpRatio;
        renderer.setPixelRatio(ratio);
        qualitySeconds = 0;
        qualityFrames = 0;
      }
      if (quality === "Auto" && qualitySeconds >= 2) {
        if (qualitySeconds / qualityFrames > 0.038 && ratio > 0.45) {
          ratio = Math.max(0.45, ratio - 0.1);
          renderer.setPixelRatio(ratio);
        }
        qualitySeconds = 0;
        qualityFrames = 0;
      }
      const s = state.current,
        e = experience.current,
        v = s.owner;
      if (s.paused) clearKeys();
      place(
        owner,
        v,
        s.paused ? 0 : dt,
        !s.paused && (!!keys.current.brake || !!keys.current.down),
      );
      fleet.g.visible = !!s.fleet;
      if (s.fleet)
        place(fleet, s.fleet.car, s.paused ? 0 : dt, s.fleet.car.speed === 0);
      traffic.forEach((mesh, i) =>
        place(mesh, s.traffic[i], s.paused ? 0 : dt, s.traffic[i].waiting),
      );
      owner.driver!.children.slice(0, 2).forEach((head) => {
        head.visible = e.camera !== "Cockpit";
      });
      owner.passenger!.visible =
        s.trip?.state === "onboard" || s.trip?.state === "boarding";
      fleet.passenger!.visible = s.fleet?.trip?.state === "onboard";
      owner.driver!.rotation.z =
        (keys.current.right ? 1 : keys.current.left ? -1 : 0) *
        Math.min(0.08, Math.abs(v.speed) * 0.008);
      owner.wheel!.rotation.z =
        -(keys.current.right ? 1 : keys.current.left ? -1 : 0) * 0.55;
      // The cockpit is inside the actual car, beside the animated steering wheel.
      const headingDelta = Math.atan2(
        Math.sin(v.heading - yaw),
        Math.cos(v.heading - yaw),
      );
      yaw += headingDelta * Math.min(1, dt * 6);
      const forward = new T.Vector3(
        Math.cos(v.heading),
        0,
        Math.sin(v.heading),
      );
      if (e.camera === "Cockpit") {
        camera.position.set(
          v.x + Math.sin(v.heading) * 0.85 + forward.x * 0.55,
          2.97,
          v.y - Math.cos(v.heading) * 0.85 + forward.z * 0.55,
        );
        const look = v.heading + e.orbit;
        camera.lookAt(
          v.x + Math.cos(look) * 30,
          2.75 + (e.tilt - 0.35) * 8,
          v.y + Math.sin(look) * 30,
        );
        camera.fov = T.MathUtils.clamp(90 - e.zoom * 0.6, 54, 83);
      } else if (e.camera === "Overview") {
        camera.position.set(290, 620, 291);
        camera.lookAt(290, 0, 290);
        camera.fov = 52;
      } else {
        const angle = (e.camera === "Chase" ? yaw : v.heading) + e.orbit;
        camera.position.set(
          v.x - Math.cos(angle) * e.zoom,
          e.zoom * Math.sin(e.tilt) + 4,
          v.y - Math.sin(angle) * e.zoom,
        );
        camera.lookAt(v.x + forward.x * 4, 2, v.y + forward.z * 4);
        camera.fov = 62;
      }
      camera.updateProjectionMatrix();
      (scene.fog as T.Fog).near = e.camera === "Overview" ? 450 : 90;
      (scene.fog as T.Fog).far = e.camera === "Overview" ? 950 : 300;
      const target = s.trip
        ? nodes[s.trip.state === "onboard" ? s.trip.destination : s.trip.pickup]
        : s.owner.fuel < 5
          ? fuelPump
          : null;
      pin.visible = !!target;
      pickup.visible =
        !!s.trip &&
        ["pickup", "at-pickup"].includes(s.trip.state) &&
        !s.trip.noShow;
      if (target) {
        pin.position.set(target.x, 7 + Math.sin(s.real * 3), target.y);
        pickup.position.set(target.x + 5, 0, target.y + 5);
      }
      const rk = s.trip?.route.join(",") ?? (s.owner.fuel < 5 ? "fuel" : "");
      if (rk !== routeKey) {
        routeKey = rk;
        const points = s.trip
          ? s.trip.route.map((i) => new T.Vector3(nodes[i].x, 0.35, nodes[i].y))
          : s.owner.fuel < 5
            ? [
                new T.Vector3(515, 0.35, 245),
                new T.Vector3(fuelPump.x, 0.35, fuelPump.y),
              ]
            : [];
        routeLine.geometry.dispose();
        routeLine.geometry = new T.BufferGeometry().setFromPoints(points);
      }
      const bk = JSON.stringify(e.ads);
      if (bk !== boardKey) {
        boardKey = bk;
        updateBoards(boards, e);
      }
      adTimer += dt;
      if (adTimer >= 1 && !s.paused) {
        adTimer = 0;
        const direction = new T.Vector3();
        camera.getWorldDirection(direction);
        const frustum = new T.Frustum().setFromProjectionMatrix(
          new T.Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
          ),
        );
        for (let i = 0; i < adSlots.length; i++) {
          const slot = adSlots[i],
            ad = e.ads[slot.id],
            dist = Math.hypot(v.x - slot.x, v.y - slot.y),
            token = `${s.day}:${s.trip?.id ?? "free"}:${slot.id}:${ad.brand}:${ad.headline}`;
          if (dist > 100) seen.delete(token);
          if (
            ad.active &&
            e.camera !== "Overview" &&
            dist < 65 &&
            frustum.intersectsObject(boards[i]) &&
            !seen.has(token)
          ) {
            seen.add(token);
            ad.impressions++;
            persistExperience(e);
          }
        }
      }
      signals.forEach(({ n, light }) =>
        (light.material as T.MeshBasicMaterial).color.set(
          (Math.floor(s.real / 12) + n.id) % 2 ? "#e4573e" : "#78be65",
        ),
      );
      renderer.setClearColor(s.rain ? "#9caeae" : "#c6d5d2");
      (scene.fog as T.Fog).color.set(s.rain ? "#9caeae" : "#c6d5d2");
      rainDrops.visible = s.rain && e.camera !== "Overview";
      if (rainDrops.visible) {
        for (let i = 0; i < 160; i++) {
          rainMatrix.makeTranslation(
            v.x + ((i * 17) % 61) - 30,
            (((i * 3 - s.real * 25) % 28) + 28) % 28,
            v.y + ((i * 23) % 61) - 30,
          );
          rainDrops.setMatrixAt(i, rainMatrix);
        }
        rainDrops.instanceMatrix.needsUpdate = true;
      }
      renderer.render(scene, camera);
      uiTimer += dt;
      if (uiTimer > 0.1) {
        uiTimer = 0;
        callbacks.current.onChange();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", clearKeys);
      canvas.removeEventListener("pointerdown", pd);
      canvas.removeEventListener("pointermove", pm);
      canvas.removeEventListener("pointerup", pu);
      canvas.removeEventListener("pointercancel", pu);
      canvas.removeEventListener("wheel", wheel);
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);
  return (
    <div className="world-canvas" ref={host}>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
