import React, { useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ExperienceControls,
  StreetAds,
  DrivingMiniMap,
} from "./ExperienceControls";
import { useExperience } from "./experience";
import { WorldView } from "./WorldView";
import { C, money, speedKmh } from "./config";
import { nodes, services, fuelPump, distance, route } from "./world";
import {
  initial,
  accept,
  interact,
  settle,
  purchaseFuel,
  repair,
  tow,
  hire,
  dismiss,
  rating,
  cancellationRate,
  summary,
  nextShift,
  offer,
  tick,
  advanceTime,
  quote,
  type State,
} from "./simulation";
import { load, save, restore, KEY, BACKUP } from "./persistence";
import "./style.css";
declare global {
  interface Window {
    __game?: {
      get: () => State;
      scenario: (name: string) => void;
      at: (id: number) => void;
      advance: (seconds: number) => void;
      interact: () => void;
    };
  }
}
const clock = (s: State) =>
  `${String(Math.floor(s.clock / 3600) % 24).padStart(2, "0")}:${String(Math.floor(s.clock / 60) % 60).padStart(2, "0")}`;
function App() {
  const loaded = useRef(load()),
    state = useRef(loaded.current.state),
    [, render] = useReducer((n) => n + 1, 0),
    [panel, setPanel] = useState<string | null>(
      loaded.current.corrupt
        ? "corrupt"
        : loaded.current.state.paused
          ? "pause"
          : null,
    ),
    [quantity, setQuantity] = useState(10),
    [saveError, setSaveError] = useState(""),
    [confirm, setConfirm] = useState<string | null>(null);
  const experience = useExperience();
  const s = state.current,
    t = s.trip,
    q = s.offer?.quote;
  const engine = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null),
    audio = useRef<AudioContext | null>(null);
  const persist = () => {
    if (panel === "corrupt") return;
    try {
      save(state.current);
      setSaveError("");
    } catch {
      setSaveError(
        "Save unavailable. Keep this tab open; export your save from the pause menu.",
      );
    }
  };
  const beep = (freq = 440) => {
    if (!audio.current) {
      audio.current = new AudioContext();
      const osc = audio.current.createOscillator(),
        gain = audio.current.createGain();
      osc.type = "triangle";
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(audio.current.destination);
      osc.start();
      engine.current = { osc, gain };
    }
    void audio.current.resume();
    if (!s.sound) return;
    const o = audio.current.createOscillator(),
      g = audio.current.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(s.sound * 0.08, audio.current.currentTime);
    g.gain.exponentialRampToValueAtTime(
      0.001,
      audio.current.currentTime + 0.15,
    );
    o.connect(g);
    g.connect(audio.current.destination);
    o.start();
    o.stop(audio.current.currentTime + 0.15);
  };
  const act = (fn: () => void) => {
    beep();
    fn();
    persist();
    render();
  };
  const pause = () => {
    state.current.paused = !state.current.paused;
    setPanel(state.current.paused ? "pause" : null);
    persist();
    render();
  };
  const interaction = () =>
    act(() => {
      if (s.paused) return;
      if (interact(s)) return;
      const v = s.owner;
      if (speedKmh(v.speed) >= 3) {
        s.notice = "Stop the car before interacting.";
        return;
      }
      if (distance(v, fuelPump) < 8) setPanel("fuel");
      else if (distance(v, nodes[services.repair]) < 12) setPanel("repair");
      else if (distance(v, nodes[services.depot]) < 12) setPanel("depot");
      else
        s.notice =
          "Reach the highlighted pin and stop for two seconds, then press E.";
    });
  useEffect(() => {
    const engineTimer = window.setInterval(() => {
      if (!engine.current || !audio.current) return;
      const current = state.current;
      engine.current.osc.frequency.setTargetAtTime(
        45 + Math.abs(current.owner.speed) * 4,
        audio.current.currentTime,
        0.08,
      );
      engine.current.gain.gain.setTargetAtTime(
        current.paused || (!current.online && Math.abs(current.owner.speed) < 1)
          ? 0
          : current.sound * 0.04,
        audio.current.currentTime,
        0.1,
      );
    }, 100);
    const timer = window.setInterval(() => {
      if (!loaded.current.corrupt) {
        try {
          save(state.current);
        } catch {
          setSaveError("Local save failed. Export from the pause menu.");
        }
      }
    }, 5000);
    const hidden = () => {
      if (document.hidden) {
        state.current.paused = true;
        setPanel("pause");
        render();
        try {
          save(state.current);
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      clearInterval(engineTimer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (loaded.current.corrupt) return;
    try {
      save(s);
    } catch {
      setSaveError("Local save failed. Export from the pause menu.");
    }
  }, [s.ledger.length, s.history.length]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__game = {
      get: () => state.current,
      at: (id) => {
        const n = id === services.fuel ? fuelPump : nodes[id];
        state.current.owner.x = n.x;
        state.current.owner.y = n.y;
        state.current.owner.speed = 0;
        render();
      },
      advance: (seconds) => {
        for (let i = 0; i < seconds * 60; i++) tick(state.current, {});
        render();
      },
      interact: () => {
        interact(state.current);
        render();
      },
      scenario: (name) => {
        const n = initial(609);
        n.online = true;
        n.offer = offer(n);
        if (name === "drive") {
          n.offer!.pickup = 24;
          n.offer!.destination = 18;
          n.offer!.quote = quote(0.9, 0.9, 3.7, 1.3);
          n.offer!.route = route(30, 24);
          n.offer!.noShow = false;
        }
        if (name === "fleet") {
          n.driver.completed = 5;
          n.wallet = 55000;
          n.ledger.push({
            id: "scenario-grant",
            time: n.clock,
            actor: "owner",
            category: "recovery grant",
            amount: 30000,
          });
        }
        if (name === "zero-fuel") {
          n.owner.fuel = 0;
          n.wallet = 0;
          n.ledger.push({
            id: "scenario-cost",
            time: n.clock,
            actor: "owner",
            category: "scenario cost",
            amount: -25000,
          });
        }
        if (name === "no-show" || name === "timeout") {
          accept(n);
          if (n.trip) n.trip.noShow = name === "no-show";
        }
        state.current = n;
        setPanel(null);
        render();
      },
    };
    return () => {
      delete window.__game;
    };
  }, []);
  useEffect(() => {
    if (!panel && !confirm && !s.shift.ended) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const get = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      );
    get()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = get(),
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [panel, confirm, s.shift.ended]);
  const start = () =>
    act(() => {
      if (s.paused || s.shift.ended) return;
      if (s.online) {
        s.online = false;
        s.offer = null;
        s.notice = "You are offline. Your active trip can still be completed.";
      } else if (s.owner.condition < 20)
        s.notice = "Condition is below 20. Repair before going online.";
      else if (s.owner.fuel <= 0)
        s.notice = "No fuel. Refuel or call recovery.";
      else {
        s.online = true;
        s.offerDelay = 10;
        s.notice =
          "You’re online. Dispatch is looking for your next passenger.";
      }
    });
  const fleetProfit =
    s.ledger
      .filter(
        (e) =>
          e.actor === "fleet" &&
          ["fare", "no show fee", "commission", "wage", "repair"].includes(
            e.category,
          ),
      )
      .reduce((a, e) => a + e.amount, 0) -
    (s.fleet?.car.fuelExpense || 0) -
    s.archivedFleetFuelCost -
    Math.max(0, s.fleet?.driver.accrued || 0);
  const fleet = s.fleet,
    totals = summary(s),
    cancel = cancellationRate(s.driver);
  const interactReady =
    t && (t.state === "at-pickup" || (t.state === "onboard" && t.gate >= 2));
  const close = () => setPanel(null);
  return (
    <div className="app-shell">
      <header>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <Arrow />
          </span>
          <span>
            LAGOS<span className="brand-light"> DRIVER</span>
            <small>THE OWNER–DRIVER SIMULATOR</small>
          </span>
        </a>
        <div className="header-center">
          <span className="live-dot" /> FICTIONAL CITY. REAL DECISIONS.
        </div>
        <nav>
          <button onClick={() => setPanel("ads")}>Street ads</button>
          <button onClick={() => setPanel("ledger")}>
            <Arrow /> Business
          </button>
          <button onClick={() => setPanel("fleet")}>
            <FleetIcon /> Fleet{" "}
            <span className="badge">{fleet ? "1" : "0"}</span>
          </button>
          <button
            className="icon-button"
            aria-label="Pause game"
            onClick={pause}
          >
            <PauseIcon />
          </button>
        </nav>
      </header>
      <div className="shift-line">
        <span>
          YOUR SHIFT <b>Day {s.day}</b>
          <span className="divider">/</span>
          <b>{clock(s)}</b> <span className="muted">— 20:00</span>
        </span>
        <span>
          {s.paused
            ? "SIMULATION PAUSED"
            : s.rain
              ? "☂ LIGHT RAIN • LOWER GRIP"
              : "☀ CLEAR SKIES"}{" "}
          <span className="divider">/</span>{" "}
          {s.clock < 36000 || (s.clock >= 57600 && s.clock < 68400)
            ? "RUSH HOUR ×1.3"
            : "NORMAL DEMAND"}
        </span>
      </div>
      <section className="stats">
        <Stat
          label="SHARED WALLET"
          value={money(s.wallet)}
          detail="Virtual naira"
        />
        <Stat
          label="FUEL"
          value={`${s.owner.fuel.toFixed(1)} L`}
          detail={`of ${C.tank} L`}
          percent={(s.owner.fuel / C.tank) * 100}
          warn={s.owner.fuel < 5}
        />
        <Stat
          label="CONDITION"
          value={`${Math.round(s.owner.condition)}%`}
          detail={s.owner.condition < 20 ? "Repair required" : "Compact sedan"}
          percent={s.owner.condition}
          warn={s.owner.condition < 20}
        />
        <Stat
          label="FATIGUE"
          value={`${Math.round(s.driver.fatigue)}%`}
          detail={
            s.driver.fatigue > 80 ? "Time to rest" : "Stay sharp out there"
          }
          percent={s.driver.fatigue}
          warn={s.driver.fatigue > 80}
        />
        <Stat
          label="DRIVER RATING"
          value={`★ ${rating(s.driver).toFixed(2)}`}
          detail={`${s.driver.reviews} reviews · 20 prior rides`}
        />
      </section>
      <main>
        <section className="map-section">
          <div className="section-bar">
            <div>
              <span className="eyebrow">THE STREETS ARE YOURS</span>
              <h1>A day behind the wheel.</h1>
            </div>
            <span className="map-status">
              <span className={s.online ? "live-dot" : "offline-dot"} />
              {s.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="map-frame">
            <WorldView
              state={state}
              experience={experience}
              onChange={render}
              onInteract={interaction}
              onPause={pause}
            />
            <div className="map-chips">
              <span>
                <i className="mint" /> YOU
              </span>
              <span>
                <i className="yellow" /> DANFO & TRAFFIC
              </span>
              {fleet && (
                <span>
                  <i className="purple" /> YOUR FLEET
                </span>
              )}
            </div>
            <div className="speed">
              <strong>{Math.round(speedKmh(s.owner.speed))}</strong>
              <span>KM/H</span>
            </div>
            <DrivingMiniMap s={s} />
          </div>
          <div className="controls">
            <span>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> Drive <span className="muted">or arrow keys</span>
            </span>
            <span>
              <kbd>SPACE</kbd> Handbrake
            </span>
            <span>
              <kbd>E</kbd> Interact
            </span>
            <span>
              <kbd>ESC</kbd> Pause
            </span>
          </div>
          <ExperienceControls
            state={state}
            experience={experience}
            update={() => {
              persist();
              render();
            }}
          />
        </section>
        <aside>
          <div className="dispatch-heading">
            <span className="eyebrow">ÒNÀ DISPATCH</span>
            <span className="pill">FICTIONAL SERVICE</span>
          </div>
          {s.offer && q ? (
            <section className="card offer-card live-offer">
              <div className="card-title">
                <span>NEW TRIP REQUEST</span>
                <span className="countdown">{Math.ceil(s.offer.expires)}s</span>
              </div>
              <div className="offer-body">
                <div className="passenger">
                  <div className="avatar">{s.offer.name[0]}</div>
                  <div>
                    <h2>{s.offer.name}</h2>
                    <span>Ready for a ride</span>
                  </div>
                  <span className="tag">
                    ×
                    {s.clock < 36000 || (s.clock >= 57600 && s.clock < 68400)
                      ? "1.3"
                      : "1.0"}{" "}
                    demand
                  </span>
                </div>
                <RouteInfo
                  pickup={s.offer.pickup}
                  destination={s.offer.destination}
                />
                <div className="trip-metrics">
                  <div>
                    <strong>{q.pickupKm.toFixed(1)} km</strong>
                    <span>pickup · {q.pickupMinutes.toFixed(0)} min</span>
                  </div>
                  <div>
                    <strong>{q.km.toFixed(1)} km</strong>
                    <span>trip · {q.minutes.toFixed(0)} min</span>
                  </div>
                </div>
                <div className="fare">
                  <span>FIXED QUOTED FARE</span>
                  <strong>{money(q.gross)}</strong>
                </div>
                <dl className="costs">
                  <Row
                    label="Platform commission · 15%"
                    value={"−" + money(q.commission)}
                  />
                  <Row
                    label="Estimated fuel value"
                    value={"−" + money(q.fuel * C.fuelPrice)}
                  />
                  <Row
                    label="Estimated contribution"
                    value={money(q.net)}
                    highlight
                  />
                </dl>
                <p className="fine">
                  Before repair costs, wages and wasted time. Pickup distance is
                  unpaid.
                </p>
              </div>
              <div className="offer-actions">
                <div className="offer-bottom-quote">
                  <span>
                    Fare <b>{money(q.gross)}</b>
                  </span>
                  <span>
                    Est. contribution <b>{money(q.net)}</b>
                  </span>
                </div>
                <button
                  className="primary full"
                  disabled={s.paused}
                  onClick={() => act(() => accept(s))}
                >
                  Accept trip{" "}
                  <span>
                    <Arrow />
                  </span>
                </button>
                <button
                  className="subtle full"
                  disabled={s.paused}
                  onClick={() =>
                    act(() => {
                      s.offer = null;
                      s.offerDelay = 10;
                      s.notice = "Offer declined. No cash or rating penalty.";
                    })
                  }
                >
                  Decline · no penalty
                </button>
              </div>
            </section>
          ) : t ? (
            <section className="card offer-card">
              <div className="card-title">
                <span>TRIP IN PROGRESS</span>
                <span className="pill">
                  {t.state === "onboard" ? "ON BOARD" : "PICKUP"}
                </span>
              </div>
              <div className="passenger">
                <div className="avatar">{t.name[0]}</div>
                <div>
                  <h2>{t.name}</h2>
                  <span>
                    {t.state === "boarding"
                      ? "Passenger is boarding…"
                      : t.state === "at-pickup"
                        ? "Stopped at pickup"
                        : t.state === "onboard"
                          ? "Drive to destination"
                          : "Drive to the pickup pin"}
                  </span>
                </div>
              </div>
              <RouteInfo pickup={t.pickup} destination={t.destination} />
              <MiniMap s={s} />
              <p className="trip-guidance">
                {t.state === "onboard"
                  ? "Follow the mint route. Stop at destination for two seconds, then press E."
                  : t.state === "at-pickup"
                    ? "Press E to board. A missing passenger can be closed after two game minutes."
                    : "Stop within the pickup circle for two seconds, then press E."}
              </p>
              <div className="fare">
                <span>FARE AT COMPLETION</span>
                <strong>{money(t.quote.gross)}</strong>
              </div>
              <button
                className="primary full"
                disabled={!interactReady || s.paused}
                onClick={interaction}
              >
                {t.state === "onboard"
                  ? "Complete drop-off"
                  : "Board / close no-show"}{" "}
                <kbd>E</kbd>
              </button>
              <button
                className="subtle full"
                onClick={() => setPanel("cancel")}
              >
                Cancel trip with reason
              </button>
            </section>
          ) : (
            <section className="card waiting">
              <div className="road-icon">
                <Arrow />
              </div>
              <span className="eyebrow">
                {s.online
                  ? "LISTENING FOR REQUESTS"
                  : "YOUR BUSINESS STARTS HERE"}
              </span>
              <h2>
                {s.online
                  ? "Your next fare is on its way."
                  : "Make your own way."}
              </h2>
              <p>
                {s.online
                  ? "Stay on the road. Dispatch sends an offer every 10–20 active seconds."
                  : "Go online, pick a worthwhile trip and get your passenger there safely. Every naira counts."}
              </p>
              <button
                className="primary full"
                disabled={s.paused || s.shift.ended}
                onClick={start}
              >
                {s.online ? "Go offline" : "Go online"}{" "}
                <span>
                  <Arrow />
                </span>
              </button>
              <div className="depot-note">Starting point: Surulere depot</div>
            </section>
          )}
          <section className="card quick-services">
            <div className="card-title">
              <span>KEEP YOUR BUSINESS MOVING</span>
            </div>
            <button onClick={() => setPanel("services")}>
              <span className="service-icon">⛽</span>
              <span>
                <b>Fuel, repairs & rest</b>
                <small>Find services on the map</small>
              </span>
              <span>
                <Arrow />
              </span>
            </button>
            <button onClick={() => setPanel("fleet")}>
              <span className="service-icon">
                <FleetIcon />
              </span>
              <span>
                <b>Build your fleet</b>
                <small>
                  {fleet
                    ? "1 driver · " + fleet.reason
                    : `${s.driver.completed}/5 trips to unlock`}
                </small>
              </span>
              <span>
                <Arrow />
              </span>
            </button>
          </section>
        </aside>
      </main>
      <footer>
        <div className="notice" role="status">
          <span className="live-dot" />
          {saveError || s.notice}
        </div>
        <span>
          LOCAL SAVE <span className="saved-dot">●</span>{" "}
          <button onClick={() => act(() => setPanel("help"))}>
            How to play
          </button>
        </span>
      </footer>
      {s.receipt && !panel && (
        <div className="receipt-toast">
          <button
            className="close"
            aria-label="Close receipt"
            onClick={() =>
              act(() => {
                s.receipt = null;
              })
            }
          >
            ×
          </button>
          <span className="eyebrow">
            TRIP RECEIPT · {s.receipt.trip.state.toUpperCase()}
          </span>
          <h3>{s.receipt.message}</h3>
          <div className="receipt-numbers">
            <b>
              {money(s.receipt.net)} <small>cash credited</small>
            </b>
            <b>
              {s.receipt.trip.stars ? "★ " + s.receipt.trip.stars : "No review"}
              <small>
                {s.receipt.trip.reasons.join(" · ") || "No rating deductions"}
              </small>
            </b>
          </div>
          <p>
            Gross{" "}
            {money(
              s.receipt.trip.state === "no-show"
                ? 300
                : s.receipt.trip.state === "completed"
                  ? s.receipt.trip.quote.gross
                  : 0,
            )}{" "}
            · commission settled once. Fuel inventory is expensed when consumed.
            Actual trip fuel: {s.receipt.fuel.toFixed(3)} L (
            {money(s.receipt.fuelCost)}).
          </p>
        </div>
      )}
      {(panel || s.shift.ended) && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel || "Shift summary"}
          >
            <button
              className="close"
              aria-label="Close panel"
              onClick={() => {
                if (panel === "pause")
                  act(() => {
                    s.paused = false;
                    close();
                  });
                else if (panel !== "corrupt") close();
              }}
            >
              ×
            </button>
            <span className="eyebrow">
              LAGOS DRIVER / {panel?.toUpperCase() || "SHIFT COMPLETE"}
            </span>
            {panel === "ads" ? (
              <StreetAds
                experience={experience}
                update={() => {
                  persist();
                  render();
                }}
              />
            ) : panel === "pause" ? (
              <>
                <h2>Take a breather.</h2>
                <p>
                  Clock, offers, vehicles, fuel and wages are frozen. Reloading
                  always starts paused.
                </p>
                <button
                  className="primary full"
                  onClick={() =>
                    act(() => {
                      s.paused = false;
                      close();
                    })
                  }
                >
                  Resume driving
                </button>
                <div className="button-row">
                  <button onClick={() => setPanel("summary")}>
                    Shift report
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([JSON.stringify(s, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      a.download = "lagos-driver-save.json";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    Export save
                  </button>
                  <button onClick={() => setConfirm("reset")}>New game</button>
                </div>
                <AudioControls s={s} update={render} />
              </>
            ) : panel === "corrupt" ? (
              <>
                <h2>Your save needs attention.</h2>
                <p>
                  The current save failed validation. It has not been
                  overwritten. Restore the previous valid backup or confirm a
                  new game.
                </p>
                <button
                  className="primary full"
                  disabled={!loaded.current.hasBackup}
                  onClick={() => {
                    state.current = restore();
                    loaded.current.corrupt = false;
                    setPanel("pause");
                    render();
                  }}
                >
                  Restore backup
                </button>
                <button className="full" onClick={() => setConfirm("reset")}>
                  Start a new game
                </button>
              </>
            ) : panel === "cancel" ? (
              <>
                <h2>Cancel this trip?</h2>
                <p>
                  No fare is paid. Fuel and damage remain.{" "}
                  {t?.state === "onboard"
                    ? "After boarding, this records a one-star review."
                    : "Before boarding, this records a service cancellation without a review."}
                </p>
                <label>
                  Reason
                  <select id="cancel-reason">
                    <option>Vehicle issue</option>
                    <option>Need a break</option>
                    <option>Wrong route</option>
                  </select>
                </label>
                <button
                  className="danger full"
                  disabled={s.paused}
                  onClick={() =>
                    act(() => {
                      if (s.trip)
                        settle(
                          s,
                          s.trip,
                          "cancelled",
                          "Driver: " +
                            (
                              document.getElementById(
                                "cancel-reason",
                              ) as HTMLSelectElement
                            ).value,
                        );
                      close();
                    })
                  }
                >
                  Confirm cancellation
                </button>
              </>
            ) : panel === "fuel" || panel === "repair" || panel === "depot" ? (
              <>
                <h2>
                  {panel === "fuel"
                    ? "Fill up. Keep moving."
                    : panel === "repair"
                      ? "Look after your sedan."
                      : "Back at the depot."}
                </h2>
                <p>
                  Transactions require a stopped car at the service marker.
                  Fleet service is available while its driver is idle.
                </p>
                {panel === "fuel" ? (
                  <>
                    <label>
                      Litres to purchase
                      <input
                        type="number"
                        min="1"
                        max="45"
                        value={quantity}
                        onChange={(e) => setQuantity(+e.target.value)}
                      />
                    </label>
                    <p>
                      Quote:{" "}
                      {money(
                        Math.max(0, Math.min(quantity, 45 - s.owner.fuel)) *
                          950,
                      )}{" "}
                      · Current inventory {s.owner.fuel.toFixed(2)} L
                    </p>
                    <button
                      className="primary full"
                      disabled={s.paused}
                      onClick={() =>
                        act(() => {
                          if (!purchaseFuel(s, quantity))
                            s.notice =
                              "Fuel purchase failed: check location, speed, quantity and cash.";
                          else close();
                        })
                      }
                    >
                      Buy fuel
                    </button>
                  </>
                ) : panel === "repair" ? (
                  <>
                    <p>
                      Restore to 100% for{" "}
                      {money(Math.ceil((100 - s.owner.condition) * 100))}.
                      Advances five game minutes.
                    </p>
                    <button
                      className="primary full"
                      disabled={s.paused}
                      onClick={() =>
                        act(() => {
                          if (repair(s, 100)) close();
                          else
                            s.notice =
                              "Repair requires a stopped car at the repair bay and sufficient cash.";
                        })
                      }
                    >
                      Repair to 100%
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Rest 30 game minutes to remove 40 fatigue. No automatic
                      offline recovery.
                    </p>
                    <button
                      className="primary full"
                      disabled={s.paused || !!s.trip}
                      onClick={() =>
                        act(() => {
                          if (
                            distance(s.owner, nodes[30]) < 12 &&
                            speedKmh(s.owner.speed) < 3
                          ) {
                            s.online = false;
                            advanceTime(s, 30);
                            s.driver.fatigue = Math.max(
                              0,
                              s.driver.fatigue - 40,
                            );
                            s.offer = null;
                            s.notice = "Rested for 30 game minutes.";
                            close();
                          } else s.notice = "Stop at the depot to rest.";
                        })
                      }
                    >
                      Rest at depot
                    </button>
                  </>
                )}
              </>
            ) : panel === "fleet" ? (
              <>
                <h2>A driver. A second income.</h2>
                {!fleet ? (
                  <>
                    <p>
                      Complete five owner trips to unlock your first driver. The
                      supplied sedan package includes 10 L of fuel and an{" "}
                      {money(C.deposit)} refundable deposit. Active wages are
                      ₦800 per game hour.
                    </p>
                    <div className="progress">
                      <i
                        style={{
                          width:
                            Math.min(100, (s.driver.completed / 5) * 100) + "%",
                        }}
                      />
                    </div>
                    <p>
                      {s.driver.completed}/5 trips completed · Wallet{" "}
                      {money(s.wallet)}
                    </p>
                    <button
                      className="primary full"
                      disabled={
                        s.paused ||
                        s.driver.completed < 5 ||
                        s.wallet < C.deposit
                      }
                      onClick={() =>
                        act(() => {
                          hire(s);
                        })
                      }
                    >
                      Hire Nneka · {money(C.deposit)} deposit
                    </button>
                  </>
                ) : (
                  <>
                    <div className="passenger">
                      <div className="avatar purple-avatar">N</div>
                      <div>
                        <h3>Nneka Okafor</h3>
                        <span>
                          Competence 0.8 ·{" "}
                          {fleet.assigned
                            ? "Sedan assigned"
                            : "Awaiting assignment"}
                        </span>
                      </div>
                    </div>
                    <p className="callout">
                      {fleet.active
                        ? fleet.trip
                          ? `${fleet.trip.state} · ${nodes[fleet.trip.pickup].zone} → ${nodes[fleet.trip.destination].zone}`
                          : "Looking for profitable requests"
                        : fleet.reason}
                    </p>
                    <div className="fleet-stats">
                      <Stat
                        label="FUEL"
                        value={fleet.car.fuel.toFixed(1) + " L"}
                        detail="Includes starting 10 L"
                      />
                      <Stat
                        label="CONDITION"
                        value={Math.round(fleet.car.condition) + "%"}
                        detail={
                          "Fatigue " + Math.round(fleet.driver.fatigue) + "%"
                        }
                      />
                      <Stat
                        label="TRIPS / RATING"
                        value={
                          fleet.driver.completed +
                          " / " +
                          rating(fleet.driver).toFixed(2)
                        }
                        detail={fleet.driver.reviews + " real reviews"}
                      />
                      <Stat
                        label="WAGES"
                        value={money(fleet.driver.wages)}
                        detail={money(fleet.driver.accrued) + " accrued"}
                      />
                    </div>
                    <p>
                      Revenue{" "}
                      {money(
                        s.ledger
                          .filter(
                            (e) =>
                              e.actor === "fleet" &&
                              ["fare", "no show fee"].includes(e.category),
                          )
                          .reduce((a, e) => a + e.amount, 0),
                      )}{" "}
                      · Fuel consumed {fleet.car.consumed.toFixed(2)} L
                    </p>
                    <p>
                      Fleet operating profit:{" "}
                      <b className="positive">{money(fleetProfit)}</b> ·
                      Includes fleet fares, commission, fuel consumed, repairs
                      and accrued wages. Deposits excluded.
                    </p>
                    <div className="button-row">
                      <button
                        disabled={s.paused || fleet.active || !!fleet.trip}
                        onClick={() =>
                          act(() => {
                            fleet.assigned = !fleet.assigned;
                          })
                        }
                      >
                        {fleet.assigned ? "Unassign" : "Assign sedan"}
                      </button>
                      <button
                        className="primary"
                        disabled={s.paused || !fleet.assigned}
                        onClick={() =>
                          act(() => {
                            if (fleet.active) {
                              fleet.pauseRequested = true;
                              fleet.reason = "Will pause after current trip";
                            } else {
                              fleet.active = true;
                              fleet.pauseRequested = false;
                              fleet.reason = "Looking for profitable requests";
                            }
                          })
                        }
                      >
                        {fleet.active ? "Pause after trip" : "Start driver"}
                      </button>
                    </div>
                    <div className="button-row">
                      <button
                        disabled={s.paused || !!fleet.trip}
                        onClick={() =>
                          act(() => {
                            if (!purchaseFuel(s, 10, true))
                              s.notice =
                                "Fleet fuel purchase needs an idle car and sufficient cash.";
                          })
                        }
                      >
                        Buy 10 L · ₦9,500
                      </button>
                      <button
                        disabled={s.paused || !!fleet.trip}
                        onClick={() =>
                          act(() => {
                            repair(s, 100, true);
                          })
                        }
                      >
                        Repair ·{" "}
                        {money(Math.ceil((100 - fleet.car.condition) * 100))}
                      </button>
                      <button
                        disabled={s.paused || fleet.active || !!fleet.trip}
                        onClick={() =>
                          act(() => {
                            advanceTime(s, 30);
                            fleet.driver.fatigue = Math.max(
                              0,
                              fleet.driver.fatigue - 40,
                            );
                          })
                        }
                      >
                        Rest 30 min
                      </button>
                    </div>
                    <button
                      className="subtle full"
                      disabled={s.paused || fleet.active || !!fleet.trip}
                      onClick={() => setConfirm("dismiss")}
                    >
                      Dismiss & return car · refund {money(C.deposit)}
                    </button>
                    <p className="fine">
                      This panel leaves the simulation running. Use Escape for a
                      paused review.
                    </p>
                  </>
                )}
              </>
            ) : panel === "services" ? (
              <>
                <h2>Your stops around the city.</h2>
                <div className="service-list">
                  {[
                    [
                      "fuel",
                      "⛽ Fuel station",
                      "Yaba / eastern avenue",
                      "₦950 per litre",
                    ],
                    [
                      "repair",
                      "Repair bay",
                      "Ikeja / northeast corner",
                      "₦100 per condition point",
                    ],
                    [
                      "depot",
                      "Home depot",
                      "Surulere / southwest corner",
                      "Rest 30 min / remove 40 fatigue",
                    ],
                  ].map(([id, title, where, cost]) => (
                    <button key={id} onClick={() => setPanel(id)}>
                      <b>{title}</b>
                      <span>{where}</span>
                      <small>{cost}</small>
                    </button>
                  ))}
                </div>
                <p>
                  Drive to the service marker, stop, and press E. The car always
                  stays under your control.
                </p>
                <button
                  className="danger full"
                  disabled={s.paused}
                  onClick={() => setConfirm("tow")}
                >
                  Call recovery · ₦1,500
                </button>
                <p className="fine">
                  Tow to depot takes 20 game minutes and cancels an active trip
                  without a fare. If cash is insufficient, a separately recorded
                  emergency grant covers the shortfall.
                </p>
              </>
            ) : panel === "ledger" ? (
              <>
                <h2>Every naira has a story.</h2>
                <p>
                  Wallet {money(s.wallet)} · Owner trips {s.driver.completed} ·
                  Cancellation rate{" "}
                  {cancel === null
                    ? "available after 5 resolved accepted trips"
                    : (cancel * 100).toFixed(1) + "%"}
                </p>
                <button onClick={() => setPanel("summary")}>
                  Review shift profit <Arrow />
                </button>
                <div className="ledger">
                  <div className="ledger-row ledger-header">
                    <span>TIME / ACTOR</span>
                    <span>TRANSACTION</span>
                    <span>AMOUNT</span>
                  </div>
                  {s.ledger.length ? (
                    s.ledger
                      .slice()
                      .reverse()
                      .map((e) => (
                        <div className="ledger-row" key={e.id}>
                          <span>
                            {Math.floor(e.time / 3600) % 24}:
                            {String(Math.floor(e.time / 60) % 60).padStart(
                              2,
                              "0",
                            )}
                            <small>{e.actor}</small>
                          </span>
                          <span>{e.category}</span>
                          <b
                            className={e.amount >= 0 ? "positive" : "negative"}
                          >
                            {e.amount >= 0 ? "+" : "−"}
                            {money(Math.abs(e.amount))}
                          </b>
                        </div>
                      ))
                  ) : (
                    <p>No transactions yet. Starting wallet: ₦25,000.</p>
                  )}
                </div>
              </>
            ) : panel === "help" ? (
              <>
                <h2>Small starts. Bigger ambitions.</h2>
                <ol>
                  <li>
                    Go online. Accept a request after checking the contribution
                    estimate.
                  </li>
                  <li>
                    Follow the mint route. W accelerates; S brakes and then
                    reverses; A/D steer. Space is the handbrake.
                  </li>
                  <li>
                    Stop inside the pickup pin for two seconds. Press E to
                    board. Drive and stop at the destination, then press E
                    again.
                  </li>
                  <li>
                    Refuel at the eastern fuel station, repair in the northeast,
                    and rest at the southwest depot.
                  </li>
                  <li>
                    After five completed trips, hire Nneka, assign her sedan and
                    start her shift.
                  </li>
                </ol>
                <p>
                  All money is virtual. Roads are fictional and compressed. Your
                  progress saves locally; no accounts, payments or external
                  services.
                </p>
                <AudioControls s={s} update={render} />
              </>
            ) : (
              <>
                <h2>
                  {s.shift.ended
                    ? "That’s a shift."
                    : "Your business, by the numbers."}
                </h2>
                <p>
                  Day {s.day} · 08:00–{clock(s)} · deposits and grants excluded
                  from profit.
                </p>
                <dl className="summary">
                  <Row
                    label="Gross fares & no-show fees"
                    value={money(totals.gross)}
                  />
                  <Row
                    label="Commission"
                    value={"−" + money(totals.commission)}
                  />
                  <Row
                    label="Fuel consumed at cost basis"
                    value={"−" + money(totals.fuel)}
                  />
                  <Row
                    label="Fleet wages settled"
                    value={"−" + money(totals.wages)}
                  />
                  <Row label="Repairs" value={"−" + money(totals.repairs)} />
                  <Row
                    label="Operating profit (includes tow costs)"
                    value={money(totals.profit)}
                    highlight
                  />
                  <Row
                    label="Wallet movement (includes deposits & purchases)"
                    value={money(totals.cash)}
                  />
                </dl>
                <p>
                  Ending fuel inventory: owner {s.owner.fuel.toFixed(2)} L
                  {fleet ? ` · fleet ${fleet.car.fuel.toFixed(2)} L` : ""}. Fuel
                  purchases are cash flow; only consumed inventory is an
                  operating cost.
                </p>
                <p>
                  Owner: {s.driver.completed} completed trips,{" "}
                  {rating(s.driver).toFixed(2)} rating · Fleet:{" "}
                  {fleet?.driver.completed || 0} trips.
                </p>
                {s.shift.ended ? (
                  <button
                    className="primary full"
                    onClick={() =>
                      act(() => {
                        nextShift(s);
                        close();
                      })
                    }
                  >
                    Start next shift · 08:00
                  </button>
                ) : (
                  <button
                    className="full"
                    disabled={!!s.trip || !!fleet?.trip || s.paused}
                    onClick={() =>
                      act(() => {
                        s.clock = 20 * 3600;
                        tick(s, {});
                        close();
                      })
                    }
                  >
                    End shift now
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop confirm-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm action"
          >
            <h2>
              {confirm === "reset"
                ? "Start over?"
                : confirm === "tow"
                  ? "Call recovery?"
                  : "Return the fleet sedan?"}
            </h2>
            <p>
              {confirm === "reset"
                ? "This clears only this game’s save and backup. All current game progress will be lost."
                : confirm === "tow"
                  ? "₦1,500 tow, 20 game minutes, active trip cancelled. Recovery also adds 1 L for ₦950 if fuel is below 1 L, and restores condition to 20 at ₦100/point if needed. Cash shortfalls are covered by separately recorded emergency grants."
                  : `Settle ${money(fleet?.driver.accrued || 0)} accrued wages and refund the ₦18,000 deposit once.`}
            </p>
            <div className="button-row">
              <button onClick={() => setConfirm(null)}>Keep playing</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm === "reset") {
                    localStorage.removeItem(KEY);
                    localStorage.removeItem(BACKUP);
                    state.current = initial();
                    loaded.current.corrupt = false;
                    setPanel(null);
                    save(state.current);
                  } else if (confirm === "tow") {
                    act(() => tow(s));
                    close();
                  } else
                    act(() => {
                      dismiss(s);
                    });
                  setConfirm(null);
                  render();
                }}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Arrow() {
  return (
    <svg
      aria-hidden="true"
      className="glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 19L19 5M5 5h14v14" />
    </svg>
  );
}
function FleetIcon() {
  return (
    <svg
      aria-hidden="true"
      className="glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 8h18v12H3zM5 8l2-5h10l2 5M3 15h18M6 20v2M18 20v2" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="17" cy="12" r="1" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="glyph"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}
function Stat({
  label,
  value,
  detail,
  percent,
  warn,
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number;
  warn?: boolean;
}) {
  return (
    <div className={"stat " + (warn ? "warn" : "")}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {percent !== undefined && (
        <div className="stat-bar">
          <i style={{ width: Math.min(100, Math.max(0, percent)) + "%" }} />
        </div>
      )}
    </div>
  );
}
function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "highlight" : ""}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function RouteInfo({
  pickup,
  destination,
}: {
  pickup: number;
  destination: number;
}) {
  return (
    <div className="route-info">
      <div>
        <i />
        <span>
          <small>PICKUP · PIN {pickup + 1}</small>
          <b>
            {nodes[pickup].zone}{" "}
            <em>
              / {["Market Road", "Palm Avenue", "Station Street"][pickup % 3]}
            </em>
          </b>
        </span>
      </div>
      <div>
        <i />
        <span>
          <small>DROP-OFF · PIN {destination + 1}</small>
          <b>
            {nodes[destination].zone}{" "}
            <em>
              /{" "}
              {
                ["Market Road", "Palm Avenue", "Station Street"][
                  destination % 3
                ]
              }
            </em>
          </b>
        </span>
      </div>
    </div>
  );
}
function MiniMap({ s }: { s: State }) {
  return (
    <svg
      className="minimap"
      viewBox="40 40 500 500"
      role="img"
      aria-label="Route minimap"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <path
            d={`M65 ${65 + i * 90} H515 M${65 + i * 90} 65 V515`}
            stroke="#40544e"
            strokeWidth="8"
          />
        </g>
      ))}
      <polyline
        points={[s.owner, ...(s.trip?.route || []).map((i) => nodes[i])]
          .map((n) => `${n.x},${n.y}`)
          .join(" ")}
        fill="none"
        stroke="#99eccb"
        strokeWidth="10"
      />
      <circle cx={s.owner.x} cy={s.owner.y} r="12" fill="#e4ffed" />
      {s.trip && (
        <circle
          cx={
            nodes[
              s.trip.state === "onboard" ? s.trip.destination : s.trip.pickup
            ].x
          }
          cy={
            nodes[
              s.trip.state === "onboard" ? s.trip.destination : s.trip.pickup
            ].y
          }
          r="15"
          fill="#e6bc70"
        />
      )}
    </svg>
  );
}
function AudioControls({ s, update }: { s: State; update: () => void }) {
  return (
    <div className="audio-controls">
      <label>
        Sound effects
        <input
          aria-label="Sound effects volume"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={s.sound}
          onChange={(e) => {
            s.sound = +e.target.value;
            update();
          }}
        />
      </label>
      <label>
        Music
        <input
          aria-label="Music volume"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={s.music}
          onChange={(e) => {
            s.music = +e.target.value;
            update();
          }}
        />
      </label>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
