// Local recordings and music never leave the browser.
export async function mediaStore(
  key: string,
  blob?: Blob,
): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("lagos-driver-recordings", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("clips");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result,
        tx = db.transaction("clips", blob ? "readwrite" : "readonly");
      const r = blob
        ? tx.objectStore("clips").put(blob, key)
        : tx.objectStore("clips").get(key);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => {
        resolve(blob ?? r.result);
        db.close();
      };
      tx.onerror = () => {
        reject(tx.error);
        db.close();
      };
    };
  });
}
let bundled:
  | Promise<Record<string, { file: string; speaker: string; license: string }>>
  | undefined;
async function voiceClip(id: string) {
  const local = await mediaStore(id);
  if (local) return local;
  bundled ??= fetch("/voices/manifest.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  const entry = (await bundled)[id];
  if (
    !entry ||
    !/^[a-zA-Z0-9_-]+\.(mp3|wav|ogg|webm|m4a)$/.test(entry.file) ||
    !entry.speaker ||
    !entry.license
  )
    return undefined;
  const response = await fetch("/voices/" + entry.file);
  return response.ok ? response.blob() : undefined;
}
export class CarAudio {
  context: AudioContext | null = null;
  beat = 0;
  player = new Audio();
  voice = new Audio();
  musicURL = "";
  voiceURL = "";
  voiceRequest = 0;
  tone(
    freq: number,
    volume: number,
    seconds: number,
    type: OscillatorType = "sine",
  ) {
    if (!this.context || volume <= 0) return;
    const t = this.context.currentTime,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g);
    g.connect(this.context.destination);
    o.start(t);
    o.stop(t + seconds);
  }
  async unlock() {
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  horn(volume: number) {
    void this.unlock().then(() => {
      this.tone(392, volume * 0.07, 0.3, "sawtooth");
      this.tone(494, volume * 0.04, 0.3, "sawtooth");
    });
  }
  groove(station: string, volume: number) {
    const b = this.beat++ % 16;
    if (station === "Afro groove" || station === "Highlife guitar") {
      this.tone(
        [98, 98, 130.81, 146.83][Math.floor(b / 4)],
        volume * 0.08,
        0.2,
        "triangle",
      );
      if (b % 4 === 0) this.tone(55, volume * 0.16, 0.16);
      if (b % 4 === 2) this.tone(190, volume * 0.055, 0.045, "square");
      this.tone(b % 2 ? 6000 : 4200, volume * 0.009, 0.025, "square");
      if (station === "Highlife guitar" || b % 3 === 0)
        this.tone(
          [392, 493.88, 587.33, 659.25, 587.33, 493.88, 440, 392][b % 8],
          volume * 0.028,
          0.18,
          "triangle",
        );
    }
  }
  async music() {
    const clip = await mediaStore("music");
    if (!clip) return false;
    if (this.musicURL) URL.revokeObjectURL(this.musicURL);
    this.musicURL = URL.createObjectURL(clip);
    this.player.src = this.musicURL;
    this.player.loop = true;
    return true;
  }
  async speak(id: string, volume: number) {
    const request = ++this.voiceRequest;
    const clip = await voiceClip(id);
    if (!clip || request !== this.voiceRequest) return false;
    this.voice.pause();
    if (this.voiceURL) URL.revokeObjectURL(this.voiceURL);
    this.voiceURL = URL.createObjectURL(clip);
    this.voice.src = this.voiceURL;
    this.voice.volume = volume;
    await this.voice.play();
    return true;
  }
  silence() {
    this.voiceRequest++;
    this.player.pause();
    this.voice.pause();
    void this.context?.suspend();
  }
  dispose() {
    this.silence();
    void this.context?.close();
    if (this.musicURL) URL.revokeObjectURL(this.musicURL);
    if (this.voiceURL) URL.revokeObjectURL(this.voiceURL);
  }
}
