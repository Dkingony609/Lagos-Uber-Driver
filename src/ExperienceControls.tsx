import { useEffect, useRef, useState, type RefObject } from "react";
import {
  cameras,
  lines,
  adSlots,
  persistExperience,
  validCampaign,
  type Experience,
} from "./experience";
import { CarAudio, mediaStore } from "./media";
import { nodes, fuelPump, distance } from "./world";
import type { State } from "./simulation";
type Props = {
  state: RefObject<State>;
  experience: RefObject<Experience>;
  update: () => void;
};
export function ExperienceControls({ state, experience, update }: Props) {
  const audio = useRef<CarAudio | null>(null),
    [status, setStatus] = useState(""),
    [clips, setClips] = useState<string[]>([]),
    [expanded, setExpanded] = useState(false),
    [recording, setRecording] = useState(false),
    [selected, setSelected] = useState(lines[0].id);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    current = useRef({ state, experience, update });
  current.current = { state, experience, update };
  const e = experience.current,
    s = state.current;
  const refresh = () =>
    Promise.all(
      [...lines.map((l) => l.id), "radio-bulletin"].map(async (id) =>
        (await mediaStore(id)) ? id : "",
      ),
    )
      .then((ids) => setClips(ids.filter(Boolean)))
      .catch(() =>
        setStatus("Recording storage is unavailable in this browser."),
      );
  useEffect(() => {
    audio.current = new CarAudio();
    void refresh();
    if (experience.current.station === "My music")
      void audio.current
        .music()
        .catch(() => setStatus("Your stored music could not be loaded."));
    let beat = 0,
      radioTime = 0;
    const horn = () => {
      if (!state.current.paused) audio.current?.horn(state.current.sound);
    };
    const hidden = () => {
      if (document.hidden && recorder.current?.state === "recording")
        recorder.current.stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("lagos-horn", horn);
    const timer = window.setInterval(() => {
      const a = audio.current,
        st = state.current,
        ex = experience.current;
      if (!a) return;
      if (st.paused || document.hidden) {
        a.silence();
        return;
      }
      if (a.context?.state === "suspended") void a.context.resume();
      a.player.volume = st.music;
      if (ex.station === "My music" && a.player.src) {
        if (a.player.paused) void a.player.play().catch(() => {});
      } else a.player.pause();
      a.groove(ex.station, st.music);
      if (ex.station === "Lagos radio" && ++radioTime % 100 === 0) {
        ex.speaker = "Lagos radio";
        ex.captionLanguage = "Pidgin";
        ex.caption =
          "Good morning, Lagos! Traffic dey build for junction. Give people space, and no rush.";
        ex.translation =
          "Traffic is building at the junction. Leave space and drive safely.";
        ex.captionUntil = st.real + 12;
        void a.speak("radio-bulletin", ex.voiceVolume).catch(() => {});
        current.current.update();
      }
      // Subtle sound of traffic from the scene rather than a continuous full-volume horn.
      if (
        st.sound &&
        st.traffic.some((c) => c.waiting && distance(c, st.owner) < 32) &&
        ++beat % 32 === 0
      )
        a.tone(330, st.sound * 0.015, 0.12, "sawtooth");
    }, 200);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("lagos-horn", horn);
      audio.current?.dispose();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const change = (fn: () => void) => {
    fn();
    if (!persistExperience(e)) setStatus("Preferences could not be saved.");
    update();
  };
  const say = async (topic: string, speaker = s.trip?.name ?? "Passenger") => {
    if (s.paused) return;
    const line = lines.find(
      (l) => l.language === e.language && l.topic === topic,
    )!;
    e.caption = line.text;
    e.captionLanguage = line.language;
    e.translation = line.translation;
    e.speaker = speaker;
    e.captionUntil = s.real + 12;
    update();
    try {
      await audio.current?.unlock();
      if (!(await audio.current?.speak(line.id, e.voiceVolume)))
        setStatus(
          "Subtitle shown. Add a Nigerian speaker’s recording below to hear this line.",
        );
      else setStatus("Playing recorded voice.");
    } catch {
      setStatus("The recording could not play. Choose a supported audio file.");
    }
  };
  const latestSay = useRef(say);
  latestSay.current = say;
  useEffect(() => {
    if (s.paused || s.trip?.state !== "onboard") return;
    if (e.lastTrip !== s.trip.id) {
      e.lastTrip = s.trip.id;
      e.lastEvent = "";
      void latestSay.current("Greeting");
    }
    const event = s.trip.collision
      ? "Safety"
      : s.owner.fuel < 5
        ? "Fuel"
        : s.traffic.some((c) => c.waiting && distance(c, s.owner) < 25)
          ? "Traffic"
          : "";
    if (event && e.lastEvent !== event) {
      e.lastEvent = event;
      void latestSay.current(event);
    }
  }, [
    s.trip?.id,
    s.trip?.state,
    s.trip?.collision,
    s.owner.fuel < 5,
    s.paused,
  ]);
  const importAudio = async (file: File | undefined, key: string) => {
    if (!file) return;
    if (!file.type.startsWith("audio/") || file.size > 25 * 1024 * 1024) {
      setStatus("Choose an audio file under 25 MB.");
      return;
    }
    try {
      await mediaStore(key, file);
      if (key === "music") {
        await audio.current?.music();
        change(() => {
          e.station = "My music";
          s.music = Math.max(0.4, s.music);
        });
        await audio.current?.unlock();
      } else await refresh();
      setStatus(`Saved ${file.name} locally. It stays in this browser.`);
    } catch {
      setStatus("Audio could not be saved. Browser storage may be full.");
    }
  };
  const record = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus(
        "Recording needs a secure HTTPS or localhost page. You can import a voice clip instead.",
      );
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const r = new MediaRecorder(stream.current),
        chunks: BlobPart[] = [],
        key = selected;
      recorder.current = r;
      r.ondataavailable = (v) => {
        if (v.data.size) chunks.push(v.data);
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        recorder.current = null;
        void mediaStore(key, new Blob(chunks, { type: r.mimeType }))
          .then(refresh)
          .then(() => setStatus("Voice recording saved locally."))
          .catch(() => setStatus("Recording could not be saved."));
      };
      r.start();
      setRecording(true);
      setStatus("Recording… read the selected line, then stop.");
    } catch {
      setStatus(
        "Microphone access was not granted. Import a recording instead.",
      );
    }
  };
  return (
    <section className="in-car" aria-label="In-car controls">
      <div className="camera-row">
        <span>CAMERA</span>
        {cameras.map((mode) => (
          <button
            key={mode}
            aria-pressed={e.camera === mode}
            onClick={() =>
              change(() => {
                e.camera = mode;
                e.orbit = 0;
                e.tilt = 0.35;
              })
            }
          >
            {mode}
          </button>
        ))}
        <button
          aria-label="Sound horn"
          disabled={s.paused}
          onClick={() => audio.current?.horn(s.sound)}
        >
          Horn · H
        </button>
      </div>
      <label className="quality-select">
        Graphics
        <select
          aria-label="Graphics quality"
          value={e.quality}
          onChange={(ev) =>
            change(() => {
              e.quality = ev.target.value as Experience["quality"];
            })
          }
        >
          {["Auto", "Low", "High"].map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
      </label>
      <p className="camera-tip">
        C changes camera · drag the view to look around · scroll to zoom ·
        driver visible in chase and cockpit
      </p>
      <div className="car-grid">
        <div>
          <label>
            In-car radio
            <select
              aria-label="Radio station"
              value={e.station}
              onChange={async (ev) => {
                const station = ev.target.value as Experience["station"];
                change(() => {
                  e.station = station;
                  if (station !== "Off") s.music = Math.max(s.music, 0.35);
                });
                await audio.current?.unlock();
                if (station === "My music" && !(await audio.current?.music()))
                  setStatus("Import your music below.");
              }}
            >
              {[
                "Off",
                "Afro groove",
                "Highlife guitar",
                "Lagos radio",
                "My music",
              ].map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </label>
          <label>
            Radio volume
            <input
              aria-label="Radio volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={s.music}
              onChange={(ev) => {
                s.music = +ev.target.value;
                update();
              }}
            />
          </label>
        </div>
        <div>
          <label>
            Passenger language
            <select
              aria-label="Passenger language"
              value={e.language}
              onChange={(ev) =>
                change(() => {
                  e.language = ev.target.value as Experience["language"];
                })
              }
            >
              {["Pidgin", "Yoruba", "Igbo"].map((lang) => (
                <option key={lang}>{lang}</option>
              ))}
            </select>
          </label>
          <div className="conversation">
            <button
              disabled={s.paused || s.trip?.state !== "onboard"}
              onClick={() => void say("Greeting")}
            >
              Greet passenger
            </button>
            <button
              disabled={s.paused || s.trip?.state !== "onboard"}
              onClick={() => void say("Traffic")}
            >
              Discuss traffic
            </button>
            <button
              disabled={s.paused || s.trip?.state !== "onboard"}
              onClick={() => void say("Music")}
            >
              Ask about music
            </button>
          </div>
        </div>
      </div>
      {e.caption && s.real < e.captionUntil && (
        <div className="dialogue" aria-live="polite">
          <b>
            {e.speaker} · {e.captionLanguage}
          </b>
          <p>{e.caption}</p>
          <small>{e.translation}</small>
        </div>
      )}
      {s.owner.fuel < 5 && (
        <p className="fuel-guidance">
          Fuel low. Follow the gold pin to the station east of Yaba. Drive into
          the forecourt, stop beside the pumps and press E.
        </p>
      )}
      <button
        className="subtle"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Recordings & your music {expanded ? "−" : "+"}
      </button>
      {expanded && (
        <div className="recording-controls">
          <p>
            Authentic voices use recordings from Nigerian speakers. No synthetic
            accent is substituted. Choose a line, import a clip or record it
            yourself. Record only with the speaker’s consent. Clips and music
            stay in this browser.
          </p>
          <label>
            Voice line
            <select
              aria-label="Voice line"
              disabled={recording}
              value={selected}
              onChange={(ev) => setSelected(ev.target.value)}
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.language} · {l.topic}
                  {clips.includes(l.id) ? " ✓" : ""}
                </option>
              ))}
              <option value="radio-bulletin">Lagos radio bulletin</option>
            </select>
          </label>
          <p>
            {lines.find((l) => l.id === selected)?.text ??
              "Good morning, Lagos! Traffic dey build for junction. Give people space, and no rush."}
          </p>
          <label>
            Import voice recording
            <input
              type="file"
              aria-label="Import voice recording"
              accept="audio/*"
              disabled={recording}
              onChange={(ev) =>
                void importAudio(ev.target.files?.[0], selected)
              }
            />
          </label>
          <div className="button-row">
            <button onClick={() => void record()}>
              {recording ? "Stop recording" : "Record this line"}
            </button>
            <button
              disabled={recording || s.paused}
              onClick={() =>
                void audio.current
                  ?.speak(selected, e.voiceVolume)
                  .then((ok) => {
                    if (!ok)
                      setStatus("No recording has been added for this line.");
                  })
                  .catch(() => setStatus("This audio format could not play."))
              }
            >
              Preview recording
            </button>
          </div>
          <label>
            Recorded voice volume
            <input
              type="range"
              aria-label="Recorded voice volume"
              min="0"
              max="1"
              step=".05"
              value={e.voiceVolume}
              onChange={(ev) =>
                change(() => {
                  e.voiceVolume = +ev.target.value;
                })
              }
            />
          </label>
          <label>
            Import your music
            <input
              aria-label="Import your music"
              type="file"
              accept="audio/*"
              onChange={(ev) => void importAudio(ev.target.files?.[0], "music")}
            />
          </label>
          <p>
            Afro groove and Highlife guitar are original synthesized loops.
            Lagos radio uses captions until a bulletin recording is added.
          </p>
        </div>
      )}
      {status && (
        <p className="media-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
export function StreetAds({
  experience,
  update,
}: Pick<Props, "experience" | "update">) {
  const [slot, setSlot] = useState<string>(adSlots[0].id),
    [draft, setDraft] = useState({ ...experience.current.ads[slot] }),
    [message, setMessage] = useState("");
  const ad = experience.current.ads[slot];
  const publish = () => {
    if (!draft.brand.trim() || !draft.headline.trim()) {
      setMessage("Add a business name and headline.");
      return;
    }
    experience.current.ads[slot] = {
      ...draft,
      brand: draft.brand.trim(),
      headline: draft.headline.trim(),
      active: true,
      impressions:
        ad.brand === draft.brand.trim() && ad.headline === draft.headline.trim()
          ? ad.impressions
          : 0,
    };
    if (!persistExperience(experience.current))
      setMessage("Campaign is live for this session; browser storage is full.");
    else setMessage("Campaign is live on the street billboard.");
    update();
  };
  return (
    <>
      <h2>Your business. On the street.</h2>
      <p>
        Create a campaign and see it on a 3D roadside billboard. Campaigns and
        view counts are local to this browser. There is no payment or shared
        advertiser account.
      </p>
      <label>
        Billboard location
        <select
          aria-label="Billboard location"
          value={slot}
          onChange={(ev) => {
            setSlot(ev.target.value);
            setDraft({ ...experience.current.ads[ev.target.value] });
            setMessage("");
          }}
        >
          {adSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Business name
        <input
          aria-label="Business name"
          maxLength={35}
          value={draft.brand}
          onChange={(ev) => setDraft({ ...draft, brand: ev.target.value })}
        />
      </label>
      <label>
        Ad headline
        <input
          aria-label="Ad headline"
          maxLength={55}
          value={draft.headline}
          onChange={(ev) => setDraft({ ...draft, headline: ev.target.value })}
        />
      </label>
      <label>
        Contact or message
        <input
          aria-label="Ad contact"
          maxLength={70}
          value={draft.detail}
          onChange={(ev) => setDraft({ ...draft, detail: ev.target.value })}
        />
      </label>
      <label>
        Billboard color
        <input
          aria-label="Billboard color"
          type="color"
          value={draft.color}
          onChange={(ev) => setDraft({ ...draft, color: ev.target.value })}
        />
      </label>
      <div className="ad-preview" style={{ background: draft.color }}>
        <small>{draft.brand}</small>
        <strong>{draft.headline}</strong>
        <span>{draft.detail}</span>
      </div>
      <p>
        {ad.active ? "Running" : "Paused"} · {ad.impressions} local views. A
        view counts when a nearby billboard enters a street camera. Repeated
        frames do not count; returning after leaving the area does.
      </p>
      <div className="button-row">
        <button className="primary" onClick={publish}>
          Run campaign
        </button>
        <button
          disabled={!ad.active}
          onClick={() => {
            ad.active = false;
            persistExperience(experience.current);
            update();
            setMessage("Campaign paused.");
          }}
        >
          Pause campaign
        </button>
        <button
          onClick={() => {
            const blob = new Blob(
                [JSON.stringify({ slot, campaign: ad }, null, 2)],
                { type: "application/json" },
              ),
              url = URL.createObjectURL(blob),
              link = document.createElement("a");
            link.href = url;
            link.download = `lagos-ad-${slot}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export campaign
        </button>
      </div>
      <label>
        Import campaign
        <input
          aria-label="Import campaign"
          type="file"
          accept="application/json"
          onChange={async (ev) => {
            const file = ev.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 10000) throw Error();
              const data = JSON.parse(await file.text());
              if (!validCampaign(data.campaign)) throw Error();
              setDraft({ ...data.campaign, impressions: ad.impressions });
              setMessage("Imported for review. Select Run campaign to apply.");
            } catch {
              setMessage("Choose a valid campaign JSON export.");
            }
          }}
        />
      </label>
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function DrivingMiniMap({ s }: { s: State }) {
  const path = s.trip?.route
    .map((id) => `${nodes[id].x},${nodes[id].y}`)
    .join(" ");
  return (
    <svg
      className="driving-minimap"
      viewBox="35 35 550 550"
      aria-label="Lagos road mini-map"
    >
      <rect x="35" y="35" width="550" height="550" fill="#102922" />
      {nodes.slice(0, 6).map((n) => (
        <path
          key={n.id}
          d={`M${n.x} 49 V531 M49 ${n.x} H531`}
          stroke="#45675a"
          strokeWidth="16"
        />
      ))}
      {path && (
        <polyline points={path} stroke="#acf1d1" fill="none" strokeWidth="6" />
      )}
      <path d="M515 245H550" stroke="#e6bc65" strokeWidth="9" />
      <circle cx={fuelPump.x} cy={fuelPump.y} r="12" fill="#e6bc65" />
      <path
        d="M-9 -7L13 0L-9 7Z"
        fill="#acf1d1"
        transform={`translate(${s.owner.x} ${s.owner.y}) rotate(${(s.owner.heading * 180) / Math.PI})`}
      />
      <text x="280" y="573" fill="#d0decd" fontSize="26" textAnchor="middle">
        N ↑ · compressed Lagos layout
      </text>
    </svg>
  );
}
