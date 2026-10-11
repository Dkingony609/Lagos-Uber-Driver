# Lagos Driver

A playable desktop browser owner-driver and fleet-management game based on **Lagos_Uber_Driver_Foundation.docx, version 1.0**. This is a fictional compressed city and an original dispatch brand, Ònà. All naira amounts are virtual balancing values. No Uber affiliation, live map, accounts, payments, API keys or remote assets.

## Run

Requires Node.js 22.12+ (verified with 24.19.0) and npm.

```sh
npm ci --cache /tmp/lagos-npm-cache
npm run dev
```

Vite serves the game on port 5173. Use your development environment’s browser/port viewer. For a production build, run `npm run build`, then `npm run preview` (port 4173). Progress is stored in the browser for that origin; changing ports uses a different save.

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
```

Browser tests use `/usr/bin/chromium` by default, as supplied in this cloud environment. Set `CHROMIUM_PATH` to your installed Chromium/Chrome binary elsewhere. They launch a development server automatically unless one is already running. No browser download is necessary here. `npm run format` formats the source.

## First playable walkthrough

1. Start at the Surulere depot. Select **Go online**. A passenger offer arrives after 10–20 active seconds. Check the pickup effort, fixed fare and estimated contribution before accepting.
2. Drive with **W / ↑**, brake and then reverse with **S / ↓**, steer with **A/D / ←/→**, and handbrake with **Space**. Steering needs movement. Stay on the right side of the road; slow before turning. The mint route guides you but does not drive the car.
3. Stop within the highlighted pickup circle for two continuous real seconds. Press **E** to board. If the passenger is missing, wait two game minutes before closing the no-show. Boarding takes three game seconds.
4. Drive to the destination. Stop for two seconds and press **E**. The receipt reports cash credited, actual fuel consumed and any rating deductions. Inspect **Business** for the complete ledger and shift profit.
5. Stop at the eastern Yaba fuel station, northeast Ikeja repair bay or southwest Surulere depot and press **E** to service/rest. Explicit quantities, prices and affordability are enforced. **Fuel, repairs & rest → Call recovery** handles a stranded car.
6. After five completed owner trips, open **Fleet**, hire Nneka for an ₦18,000 refundable vehicle deposit, assign the sedan, and start her driver shift. Observe the purple car moving. Pause after her current trip, service the idle vehicle, then restart. Wages are settled proportionately; fleet earnings use the shared wallet.
7. **Escape** pauses everything. Fleet and business panels normally leave the simulation running. Reloads and hidden tabs pause the game; there are no offline earnings. At 20:00, outstanding trips finish before the shift report opens. Starting the next day preserves assets and restores 40 fatigue.

## Implemented foundation

- Pure TypeScript deterministic simulation, 60 Hz fixed ticks and interpolated player/fleet rendering, separate seeded owner/fleet offer streams.
- Phaser world with 36 connected junctions, 33 reachable passenger endpoints, three zones, original buildings/shops, trees, crosswalks, 25 lane-following vehicles, junction queues, collision boundaries and scheduled rain.
- Complete offers, continuous pickup/drop-off gates, boarding, no-shows, one-time pickup patience check, reasoned cancellations and idempotent terminal settlements.
- Fixed quotes; integer-naira ledger; weighted-average fuel inventory; consumption, repairs, fatigue, disclosed reviews, cancellation denominators and shift accounting.
- One supplied fleet sedan, assignment, actual route movement, profit/fuel/wage reserves, pause/service/resume and idle dismissal with one deposit refund.
- Versioned local saves, validated bounds/references/ledger, previous valid backup, corruption recovery, confirmed reset and save export. Audio starts after interaction, with independent music/effects controls.
- Keyboard-accessible menus, focus trapping, visible focus and responsive desktop layouts.

## Source and balancing

`src/config.ts` owns the principal tuning parameters. `src/world.ts` defines roads and pathfinding; `src/traffic.ts` handles lane traffic and junction reservations; `src/simulation.ts` owns driving, trips, economy and fleet rules independently of React/Phaser. `src/persistence.ts` validates and stores saves. `src/WorldView.tsx` renders the city; `src/main.tsx` and `src/style.css` provide the UI.

See [balancing notes](docs/BALANCING.md), [verification results](docs/VALIDATION.md) and [asset credits](docs/ASSETS.md).

## Development scenarios

Only the development build exposes `window.__game` in the browser console. Production builds omit it.

```js
__game.scenario('drive')     // short, keyboard-drivable Surulere pickup and drop-off
__game.scenario('trip')      // deterministic offer
__game.scenario('no-show')   // accepted, hidden no-show decision
__game.scenario('timeout')   // accepted pickup; leave it waiting to exercise patience
__game.scenario('zero-fuel') // empty tank and wallet, test recovery
__game.scenario('fleet')     // unlocked fleet and a reconciled scenario grant
__game.at(17)               // testing only: position at fuel station
__game.advance(20)          // testing only: tick 20 active real seconds
__game.get()                // inspect domain state
```

Scenarios are test fixtures, not necessary for normal play. The browser suite includes a completed trip driven entirely with keyboard inputs after selecting the short-route fixture.

## Prototype choices and limitations

Traffic and collisions are geometric, not advanced vehicle physics. Routes use a compact grid with fixed congestion weights; AI cars queue using simple reservations. This is one district and one fleet driver, not a realistic Lagos navigation map. Browser localStorage is the only persistence; export a backup before clearing browser data. Music and engine effects are simple original synthesized tones.

Starting fuel is valued at the prototype ₦950/L cost basis. Fleet starting inventory is disclosed as included in the supplied package. Recovery additionally offers a paid emergency litre when fuel is below 1 L, and minimum repairs to condition 20 when needed; the confirmation discloses these costs, and grants cover only cash shortfalls. These extensions prevent a zero-cash/zero-condition dead end at the depot.

Performance measurements are from headless Chromium in this cloud machine, not a desktop hardware guarantee. Mobile driving, controllers, multiplayer, accounts and online services remain outside this milestone. No public deployment or Git push was performed.
