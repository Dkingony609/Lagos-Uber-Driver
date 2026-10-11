import { useRef } from "react";
export const cameras = ["Chase", "Cockpit", "Orbit", "Overview"] as const;
export type CameraMode = (typeof cameras)[number];
export const adSlots = [
  { id: "ikeja", name: "Ikeja junction", x: 110, y: 79.5, heading: 0 },
  { id: "yaba", name: "Yaba market", x: 290, y: 259.5, heading: 0 },
  {
    id: "surulere",
    name: "Surulere approach",
    x: 110,
    y: 500.5,
    heading: Math.PI,
  },
] as const;
export type Campaign = {
  brand: string;
  headline: string;
  detail: string;
  color: string;
  active: boolean;
  impressions: number;
};
export type Experience = {
  camera: CameraMode;
  quality: "Auto" | "Low" | "High";
  zoom: number;
  orbit: number;
  tilt: number;
  language: "Pidgin" | "Yoruba" | "Igbo";
  station:
    | "Off"
    | "Afro groove"
    | "Highlife guitar"
    | "Lagos radio"
    | "My music";
  voiceVolume: number;
  caption: string;
  captionLanguage: string;
  translation: string;
  speaker: string;
  captionUntil: number;
  lastTrip: string;
  lastEvent: string;
  ads: Record<string, Campaign>;
};
export const EXPERIENCE_KEY = "lagos-driver-experience-v1";
export function defaultExperience(): Experience {
  return {
    camera: "Chase",
    quality: "Auto",
    zoom: 23,
    orbit: 0,
    tilt: 0.35,
    language: "Pidgin",
    station: "Off",
    voiceVolume: 0.8,
    caption: "",
    captionLanguage: "Pidgin",
    translation: "",
    speaker: "",
    captionUntil: 0,
    lastTrip: "",
    lastEvent: "",
    ads: Object.fromEntries(
      adSlots.map((s) => [
        s.id,
        {
          brand: "Your business here",
          headline: "Seen on the streets.",
          detail: "Open Street ads to run a campaign",
          color: "#1d695a",
          active: false,
          impressions: 0,
        },
      ]),
    ),
  };
}
export function validCampaign(c: unknown): c is Campaign {
  const a = c as Campaign;
  return (
    !!a &&
    ["brand", "headline", "detail"].every(
      (k) =>
        typeof a[k as keyof Campaign] === "string" &&
        a[k as "brand"].length <= 100,
    ) &&
    /^#[0-9a-f]{6}$/i.test(a.color) &&
    typeof a.active === "boolean" &&
    Number.isSafeInteger(a.impressions) &&
    a.impressions >= 0
  );
}
export function loadExperience(): Experience {
  const e = defaultExperience();
  try {
    const v = JSON.parse(localStorage.getItem(EXPERIENCE_KEY) || "null");
    if (!v) return e;
    if (cameras.includes(v.camera)) e.camera = v.camera;
    if (["Auto", "Low", "High"].includes(v.quality)) e.quality = v.quality;
    if (typeof v.zoom === "number" && v.zoom >= 12 && v.zoom <= 60)
      e.zoom = v.zoom;
    if (["Pidgin", "Yoruba", "Igbo"].includes(v.language))
      e.language = v.language;
    if (
      [
        "Off",
        "Afro groove",
        "Highlife guitar",
        "Lagos radio",
        "My music",
      ].includes(v.station)
    )
      e.station = v.station;
    if (
      Number.isFinite(v.voiceVolume) &&
      v.voiceVolume >= 0 &&
      v.voiceVolume <= 1
    )
      e.voiceVolume = v.voiceVolume;
    for (const slot of adSlots)
      if (validCampaign(v.ads?.[slot.id])) e.ads[slot.id] = v.ads[slot.id];
  } catch {
    /* preferences do not replace the economic save */
  }
  return e;
}
export function persistExperience(e: Experience) {
  try {
    localStorage.setItem(EXPERIENCE_KEY, JSON.stringify(e));
    return true;
  } catch {
    return false;
  }
}
export function useExperience() {
  const ref = useRef<Experience | null>(null);
  if (!ref.current) ref.current = loadExperience();
  return ref as { current: Experience };
}
export type Line = {
  id: string;
  topic: string;
  language: Experience["language"];
  text: string;
  translation: string;
};
export const lines: Line[] = [
  {
    id: "pidgin-greet",
    topic: "Greeting",
    language: "Pidgin",
    text: "How far? Abeg, make we go.",
    translation: "Hello! Please, let’s get going.",
  },
  {
    id: "pidgin-traffic",
    topic: "Traffic",
    language: "Pidgin",
    text: "This go-slow no be small. Abeg, take am easy.",
    translation: "This traffic is heavy. Please take it easy.",
  },
  {
    id: "pidgin-music",
    topic: "Music",
    language: "Pidgin",
    text: "This your music sweet. You fit increase am small?",
    translation: "I like your music. Could you turn it up a little?",
  },
  {
    id: "pidgin-safe",
    topic: "Safety",
    language: "Pidgin",
    text: "Oga, abeg slow down. No rush, we go reach.",
    translation: "Driver, please slow down. We’ll get there.",
  },
  {
    id: "pidgin-fuel",
    topic: "Fuel",
    language: "Pidgin",
    text: "Petrol don low. Make we enter filling station.",
    translation: "Fuel is low. Let’s stop at a filling station.",
  },
  {
    id: "yoruba-greet",
    topic: "Greeting",
    language: "Yoruba",
    text: "Ẹ káàárọ̀. Ẹ ṣé.",
    translation: "Good morning. Thank you.",
  },
  {
    id: "yoruba-traffic",
    topic: "Traffic",
    language: "Yoruba",
    text: "Ọ̀pọ̀ ọkọ̀ ló wà lójú ọ̀nà. Ẹ ní sùúrù.",
    translation: "There are many vehicles on the road. Please be patient.",
  },
  {
    id: "yoruba-music",
    topic: "Music",
    language: "Yoruba",
    text: "Mo fẹ́ràn orin yìí.",
    translation: "I like this music.",
  },
  {
    id: "yoruba-safe",
    topic: "Safety",
    language: "Yoruba",
    text: "Ẹ jọ̀ọ́, ẹ má ṣe yára.",
    translation: "Please do not rush.",
  },
  {
    id: "yoruba-fuel",
    topic: "Fuel",
    language: "Yoruba",
    text: "Ẹ jọ̀ọ́, ẹ jẹ́ ká ra epo.",
    translation: "Please, let’s buy fuel.",
  },
  {
    id: "igbo-greet",
    topic: "Greeting",
    language: "Igbo",
    text: "Ụtụtụ ọma. Daalụ.",
    translation: "Good morning. Thank you.",
  },
  {
    id: "igbo-traffic",
    topic: "Traffic",
    language: "Igbo",
    text: "Ụgbọala dị ọtụtụ n’ụzọ. Biko, nwee ndidi.",
    translation: "There are many cars on the road. Please be patient.",
  },
  {
    id: "igbo-music",
    topic: "Music",
    language: "Igbo",
    text: "Abụ a na-amasị m.",
    translation: "I like this song.",
  },
  {
    id: "igbo-safe",
    topic: "Safety",
    language: "Igbo",
    text: "Biko, kwọọ nwayọọ.",
    translation: "Please drive slowly.",
  },
  {
    id: "igbo-fuel",
    topic: "Fuel",
    language: "Igbo",
    text: "Biko, ka anyị zụta mmanụ ụgbọala.",
    translation: "Please, let’s buy petrol.",
  },
];
