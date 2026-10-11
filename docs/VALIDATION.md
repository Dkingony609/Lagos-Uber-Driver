# Verification results

Verified on 11 October 2026 in the cloud workspace with Node.js 24.19.0, npm 11.9.0, Chromium 154.0.8037.57, Linux x86_64 and five logical CPU cores reported to the browser.

| Check | Actual outcome |
|---|---|
| Frozen installation (`npm ci --cache /tmp/lagos-npm-cache`) | Passed; lockfile preserved |
| TypeScript (`npm run typecheck`, also required by build) | Passed |
| Vitest (`npm test`) | 20 tests passed, none skipped |
| Production (`npm run build`) | Passed; Vite reports the expected large Phaser chunk warning |
| Playwright (`npm run test:browser`) | 4 browser tests passed, none skipped; final run 31.6 seconds |
| 1366 × 768 and 1920 × 1080 | Screenshots inspected; offer action/fare/contribution stay visible while details scroll |
| Production development hooks | Absent (`window.__game` undefined) |
| Production page errors | None observed in the functional/performance check |

Domain coverage includes the exact worked fare, commission rounding, actual fuel cost basis, atomic affordability checks, valid state transitions, idempotent settlement, continuous stop gates, boarding, no-shows, cancellation denominators, rating reasons, collision cooldown, real fleet route progress, wages, deposit refunds, all-junction connectivity, seeded replay, independent offer streams, schema/ledger/reference rejection, backup/reload, repair gates, one-time patience decisions and shift retention/reconciliation.

Browser coverage:

1. Start a new game, move by keyboard, accept and complete a gated trip, refuel, hire and assign a fleet driver, observe actual movement, freeze simulation and reload the fleet state.
2. Reload an active trip; preserve its identity and zero unsettled fare credits; resume and pause again.
3. Complete both legs of a short deterministic trip using **only keyboard driving** after choosing the fixture. No teleporting during either leg. The renderer is set to a 30 FPS target via the development-only `?fps=30` setting, while domain simulation remains 60 Hz. Actual movement exceeds 1.6 km.
4. Dispatch the hidden-tab visibility event; assert that serialized clock, offer, car, traffic, wages and fuel state remain unchanged until explicit resume.

Tests use deterministic development fixtures to shorten setup and unlock fleet checks. Normal progression still requires five completed owner trips; the fixture grant is explicitly recorded in its ledger and omitted from operating profit. The hidden-tab test exercises the event handler with a controlled browser visibility property rather than claiming an OS/background-tab timing benchmark.

## Performance and visual checks

The production world runs with 25 traffic vehicles. After caching static city graphics, the first five-second measurements were **59.6 FPS at 1366 × 768** and **58.0 FPS at 1920 × 1080**, with p95 frame intervals of 16.8 ms. These are browser animation-frame measurements in this headless cloud instance, not a guarantee for arbitrary desktop hardware. The initial uncached rendering was substantially slower under concurrent browser load; that prompted the static-texture optimization.

[performance.json](performance.json) records a repeat measurement of the final production UI, including viewport, page height, traffic count and development-hook checks. The 30 FPS functional test demonstrates the fixed-step driving loop under a lower renderer target; it is separate from the production frame-rate measurements.

Screenshots: [1366 × 768](screenshots/game-1366.png), [1920 × 1080](screenshots/game-1920.png). Playwright also writes ignored screenshots under `test-results/` for gameplay, fleet and reload.

## Limits

This validates the current cloud instance and local production build. It does not establish public deployment, a published cloud snapshot, restored state in a new cloud task, mobile/controller support, or performance on a physical desktop GPU. Live servers must restart in future tasks. Browser saves belong to their origin and browser profile, independently of the repository snapshot.

The game uses simplified grid traffic reservations, geometric collisions, a single AI fleet driver, synthesized audio and local persistence. The broad desktop/fleet vertical slice is implemented; advanced driving physics, realistic street coverage and online integrations are deliberately outside this milestone.
