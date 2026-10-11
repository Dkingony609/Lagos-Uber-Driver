# Balancing and unit conventions

The document’s prices are virtual prototype values, not current Lagos market data.

| Parameter | Default | Location |
|---|---:|---|
| World scale | 100 world units/km | `C.scale` |
| Clock | 10 game seconds/real second | `C.clock` |
| Fixed simulation step | 1/60 real second | `C.tick` |
| Maximum forward speed | 22 world units/real second (79.2 game km/h) | `C.maxSpeed` |
| Tank / fuel price | 45 L / ₦950 per L | `C.tank`, `C.fuelPrice` |
| Driving / idle burn | 0.09 L/km / 0.015 L/game minute | `C.burn`, `C.idleBurn` |
| Commission | 15% | `C.commission` |
| Fleet wage / deposit | ₦800 active game hour / ₦18,000 refundable | `C.wage`, `C.deposit` |
| Fleet competence / harsh-event chance | 0.8 / 20% once per occupied leg | `C.competence`, `C.harshChance` |
| Rain grip | 0.72 steering multiplier | `C.rainGrip` |
| Significant collision / cooldown | 5 world units per real second / 2 real seconds | configuration and `collision` |
| Harsh deceleration | 4 game m/s², starting above 20 km/h | `C.harshDeceleration` |

Fare: round to nearest ₦50 of `max(1200, (700 + 180 × plannedKm + 25 × plannedMinutes) × demand)`. Commission rounds to integer naira. The document’s 2 km pickup / 6 km occupied / 18 minutes / 4 idle minutes example produces a ₦2,250 fare, ₦338 commission, 0.78 L estimate, ₦1,171 estimated contribution and ₦1,912 cash credit.

Roads form a six-by-six graph at 90-unit intervals. To change scale, edit `C.scale`; route distances, fuel and the unit conversion helpers use it. To change clock speed, edit `C.clock`; movement displayed in game km/h, fatigue, wages, idle fuel, gates and game deceleration use the appropriate game/real-time conversion. `speedKmh` is `abs(worldSpeed) × 3600 / (scale × clock)`; game deceleration is `worldAcceleration × 1000 / (scale × clock²)`. Retune maximum world speed and predicted ETA together when changing either scale or clock.

Predicted city pace is three game minutes/km plus one minute per leg, multiplied by rush-hour/rain congestion. The offered quote is frozen. Rush demand is 1.3 from 07:00–10:00 and 16:00–19:00. Offers expire after 20 **active real** seconds; pause and hidden-tab handling freeze both time bases. The RNG is a persisted 32-bit LCG. Player offers/weather and fleet offers have separate streams.

Pickup/drop-off radius is 12 units, with speed below 3 km/h for two continuous real seconds. Normal boarding is three game seconds. Pickup patience is quoted pickup ETA plus five game minutes, followed by one seeded 25% check. No-show probability is 5%, decided on acceptance. No-shows close only after a two-game-minute wait and credit a ₦300 fee less commission.

Financial reporting distinguishes purchased fuel from consumption. Cash reflects purchases and refundable deposits; operating profit reflects fares less commission, consumed fuel at weighted cost basis, wages, repairs and tow charges. Deposits, refunds and emergency grants are excluded from operating profit. Starting fuel is valued at ₦950/L. The fleet’s included 10 L is disclosed before hiring.

Recovery at the depot includes a paid emergency litre if inventory is below 1 L and minimum repairs to condition 20 if needed. Grants cover only the shortfall in available cash after reserved wages. Accrued wages never create a negative wallet or an invented wage grant: insufficient cash retains the unpaid accrual and requests a pause. This is a rare recovery case, visible in the fleet’s wage balances.

Re-run domain and browser tests after retuning prices, timer ratios, geometry or physics. Do not use the development scenario grant to assess normal progression speed.

## 3D driving additions

The 3D geometry uses the same compressed X/Z coordinates as the graph’s X/Y simulation; it does not change fares, distance scale, timers or saved progress. Steering response falls at higher speed, rain reduces grip, braking/reverse needs fuel for propulsion, and contact checks use oriented 8-by-4-unit vehicle footprints. Collisions use relative contact speed while the player is moving. Traffic uses right lanes, acceleration/braking, junction reservations, 12-second alternating signals at selected junctions, and checks the player as an obstacle.

Fuel purchases require a stopped car within 8 units of the pump at `(550, 245)`. A traversable apron connects it to the eastern Yaba junction at `(515, 245)`. Pricing, tank capacity, inventory valuation and fleet service rules are unchanged.

Advertiser campaigns are local overlays and never charge, credit or change the economic ledger. View counts require an active campaign, a street camera (not Overview), distance under 65 units and billboard intersection with the camera frustum. Counts are approximate camera exposures, without occlusion testing or verified advertising analytics. A campaign is deduplicated during an approach; leaving beyond 100 units allows another view. A changed business/headline starts a fresh count.

Auto graphics use lighter Lambert shading and adapt render resolution downward when frame cadence is slow. Software WebGL starts at reduced resolution. Low and High provide manual choices; this does not change the fixed simulation step. Performance on software rendering is documented separately from physical GPU performance.
