# Verification results

Verified on 11 October 2026 in the cloud workspace with Node.js 24.19.0, npm 11.9.0 and Chromium 154.0.8037.57 on Linux x86_64.

| Check | Outcome |
|---|---|
| Frozen installation (`npm ci --cache /tmp/lagos-npm-cache --no-audit --no-fund`) | Passed with the committed lockfile |
| TypeScript (`npm run typecheck`) | Passed |
| Vitest (`npm test`) | 22 tests passed |
| Production (`npm run build`) | Passed, including TypeScript checks |
| Playwright (`npm run test:browser`) | 6 browser tests passed |
| Production development hooks | Absent (`window.__game` undefined) |
| Production page errors | None observed during the render checks |

Domain coverage includes fare calculations, commission rounding, actual fuel cost, atomic affordability, state transitions, idempotent settlement, pickup/drop-off gates, boarding, no-shows, cancellations, rating reasons, collision cooldown, real fleet route progress, wages, deposits, connectivity, seeded replay, separate offer streams, ledger/reference rejection, backup/reload, repair gates, one-time patience and shift reconciliation. New checks cover the drive-in pump requirement, stopping before refuelling, no reverse propulsion on an empty tank, signal/player queues and oriented vehicle footprints.

Browser coverage:

1. Select cockpit/orbit/chase cameras, edit/run/exportable local billboard data, select Igbo passenger dialogue, import and play a WAV recording, change radio stations and preserve campaign/preferences across reload. The WAV is a generated test fixture, not a claim of authentic Nigerian speech.
2. Drive from the eastern Yaba road into the fuel forecourt using the keyboard, brake, interact and buy fuel.
3. Start, drive, accept and complete a gated trip, refuel, hire/assign/start a fleet driver, observe movement, pause and reload.
4. Preserve an active trip and unsettled ledger across reload.
5. Drive both legs of a short trip entirely by keyboard after fixture setup, without teleporting; movement exceeds 1.6 km.
6. Exercise hidden-tab handling and assert that clock, vehicles, fuel, traffic, offers and wages remain frozen until resume.

Fixtures shorten offer/fleet setup; normal progression still requires five owner trips. A separate Chromium check recorded, stopped and previewed a clip using a fake microphone device with no page errors. A live billboard screenshot confirmed campaign text in the 3D scene and one counted exposure. These checks do not validate authentic voice content or physical microphone hardware. Written Yoruba/Igbo dialogue still needs native-speaker review before release.

## 3D performance and visuals

The new Three.js world has 25 traffic vehicles, original storefronts, roadside people, visible driver/passenger models, signals, billboards and a fuel canopy with pumps. Geometry is batched by material; lighter Lambert shading and automatic render-resolution scaling reduce rendering cost. High/Low can be selected manually. Existing economic saves remain compatible; experience preferences/ads and local media are stored separately.

In headless software WebGL, the initial full-resolution scene measured approximately **17.6 FPS at 1366×768** and **8.4 FPS at 1920×1080**. After shading/resolution changes, Auto measured **23.2 FPS** and **25.3 FPS**, respectively. These are three-second browser animation-frame cadence samples at reduced internal resolution, not physical-GPU benchmarks or a guaranteed frame rate. The older Phaser measurements no longer describe this renderer.

[performance.json](performance.json) records actual viewports, internal render sizes, page heights, p95 intervals and page errors. The production page intentionally scrolls to show in-car radio/recording controls beneath the driving view. Screenshots were inspected at both desktop widths:

- [Chase 1366](screenshots/game-1366.png), [chase 1920](screenshots/game-1920.png)
- [Cockpit 1366](screenshots/cockpit-1366.png), [cockpit 1920](screenshots/cockpit-1920.png)
- [Live campaign in the street](screenshots/live-billboard.png)

## Limits

This is a stylized 3D prototype on a fictional compressed Lagos grid. It does not model real geographic street coverage, full tyre/suspension physics, online advertiser accounts, payments, shared ad analytics or live radio. Authentic recorded voice files are supported but not bundled yet. Imported media stay in that browser; game-save JSON exports do not include media or ad preferences.

These checks do not establish public deployment, physical GPU performance, controller/mobile driving, or a published/restored cloud environment snapshot. Servers need restarting in future tasks. Browser saves are tied to their origin/profile, independently of GitHub.
