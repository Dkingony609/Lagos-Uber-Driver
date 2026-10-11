# Lagos Driver

A playable desktop browser owner-driver and fleet-management game based on **Lagos_Uber_Driver_Foundation.docx, version 1.0**. This is a fictional compressed city and an original dispatch brand, Ònà. All naira amounts are virtual balancing values. No Uber affiliation, live map, accounts, payments, API keys or remote assets.

## Run

Requires Node.js 22.12+ (verified with 24.19.0) and npm.

```sh
npm ci
npm run dev
```

Vite serves the game on port 5173. On your own computer, open **http://localhost:5173** in Chrome or Edge. In a cloud environment, use its port viewer if available; localhost on your computer cannot reach a cloud server. For a production build, run `npm run build`, then `npm run preview` (port 4173). Progress is stored in the browser for that origin; changing ports uses a different save.

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
5. Drive into the eastern Yaba fuel forecourt, stop beside the pumps, or stop at the northeast Ikeja repair bay or southwest Surulere depot and press **E** to service/rest. Explicit quantities, prices and affordability are enforced. **Fuel, repairs & rest → Call recovery** handles a stranded car.
6. After five completed owner trips, open **Fleet**, hire Nneka for an ₦18,000 refundable vehicle deposit, assign the sedan, and start her driver shift. Observe the purple car moving. Pause after her current trip, service the idle vehicle, then restart. Wages are settled proportionately; fleet earnings use the shared wallet.
7. **Escape** pauses everything. Fleet and business panels normally leave the simulation running. Reloads and hidden tabs pause the game; there are no offline earnings. At 20:00, outstanding trips finish before the shift report opens. Starting the next day preserves assets and restores 40 fatigue.

## Driving, radio and advertising

- **Graphics → Auto** adjusts render resolution for slower devices; choose Low or High manually.
- **C** or the camera buttons select **Chase**, **Cockpit**, **Orbit**, or **Overview**. Drag inside the view to look around; scroll to adjust the street cameras. **H** sounds the horn. A permanent mini-map shows your car, the route and the fuel-station approach.
- The driver and steering wheel are visible; a passenger appears in the rear seat after boarding. Select Pidgin, Yoruba or Igbo in **Passenger language**, then greet them, discuss traffic or ask about music. Contextual responses also react to boarding, collisions and low fuel.
- **In-car radio** selects original Afro groove/Highlife guitar synth loops, a Lagos bulletin, or your own imported music. Adjust music, effects and recorded-voice volumes separately. Audio and simulation pause when the tab is hidden.
- **Recordings & your music** imports or records Nigerian speakers’ dialogue. Authentic recorded voices are prioritized: **no recordings are bundled yet**, and missing clips use translated captions, without synthetic accents. See [voice recording instructions](docs/VOICE_RECORDINGS.md) for adding a shared voice pack and attribution.
- **Street ads** edits three 3D billboards in Ikeja, Yaba and Surulere. Enter a business name, headline, contact/message and color; run or pause the campaign, export/import its JSON and inspect local view counts. A view requires a nearby billboard in a street camera; repeated frames are deduplicated. These are browser-local campaigns, without payments, shared inventory or an advertiser backend.
- Fuel service now requires stopping within eight world units of the pump in the drive-in forecourt, rather than at the road junction. Low fuel displays a gold destination marker and a reminder to stop for petrol.

Existing economic saves remain compatible. Camera/radio/language preferences and ads use a separate local-storage key; recordings and music use IndexedDB. Game-save exports contain the economic save only. Browser storage is tied to the page origin; downloaded recordings are not automatically shared with other players.

## Implemented foundation

- Pure TypeScript deterministic simulation and 60 Hz fixed ticks, separate seeded owner/fleet offer streams.
- Three.js 3D world with 36 connected junctions, 33 reachable passenger endpoints, three zones, storefront signs, roadside people, power lines, danfo buses, visible driver/passenger models, 25 lane-following vehicles, timed signals, queues, oriented collision footprints and scheduled rain.
- Complete offers, continuous pickup/drop-off gates, boarding, no-shows, one-time pickup patience check, reasoned cancellations and idempotent terminal settlements.
- Fixed quotes; integer-naira ledger; weighted-average fuel inventory; consumption, repairs, fatigue, disclosed reviews, cancellation denominators and shift accounting.
- One supplied fleet sedan, assignment, actual route movement, profit/fuel/wage reserves, pause/service/resume and idle dismissal with one deposit refund.
- Versioned local economic saves, validated bounds/references/ledger, previous valid backup, corruption recovery, confirmed reset and save export. Audio starts after interaction, with independent music/effects controls.
- Keyboard-accessible menus, focus trapping, visible focus and responsive desktop layouts.

## Source and balancing

`src/config.ts` owns the principal tuning parameters. `src/world.ts` defines roads and pathfinding; `src/traffic.ts` handles lane traffic and junction reservations; `src/simulation.ts` owns driving, trips, economy and fleet rules independently of React/Three.js. `src/persistence.ts` validates and stores saves. `src/WorldView.tsx` renders the city; `src/main.tsx` and `src/style.css` provide the UI.

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
