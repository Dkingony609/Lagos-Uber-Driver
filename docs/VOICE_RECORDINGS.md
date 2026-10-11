# Nigerian voice recordings

This version prioritizes **recorded Nigerian speakers** and does not impersonate an accent with synthetic speech. No authentic voice recordings were supplied with the brief, and none are bundled yet. Passenger captions are functional in Pidgin, Yoruba and Igbo; English translations are shown. Native speakers should review the written lines before recording for release.

## Record or import in the game

Open **Recordings & your music** beneath the driving view. Select the language and response, then either import an audio file (MP3, WAV, Ogg, WebM, M4A where supported by the browser) or select **Record this line**. Microphone access is requested only when that button is pressed; HTTPS or localhost is required. Stop to save the recording. Preview it and board a passenger to hear the recorded response during conversation. The radio bulletin has its own recording slot.

Clips and uploaded music remain in that browser’s IndexedDB, separate from the economic save. They are not uploaded, included in the game-save JSON or shared between players. Browser storage clearing removes them. Uploads are limited to 25 MB per file. Use recordings you have permission to use.

## Ship a shared voice pack

Place consented recordings in `public/voices/`. Add an entry per recorded line in `public/voices/manifest.json`:

```json
{
  "pidgin-greet": {
    "file": "pidgin-greet.mp3",
    "speaker": "Speaker’s credited name",
    "license": "Permission or license reference"
  }
}
```

Use the IDs and texts in `src/experience.ts`: `pidgin`, `yoruba`, `igbo` with suffixes `greet`, `traffic`, `music`, `safe`, `fuel`. The bulletin uses `radio-bulletin`. File names must contain only letters, numbers, `_`, `-`, and a supported extension. Add speaker attribution, language review and consent/license details here before distribution. Local imports override bundled clips for the same line. Missing recordings keep the translated captions and display a notice; they are never replaced by a generic voice.

Suggested recording direction: conversational, relaxed, ordinary passenger volume; short natural pauses; no caricature. Use several consenting speakers for future character variation. The driving map is a fictional compressed Lagos layout, so avoid recording claims about actual live traffic conditions.
