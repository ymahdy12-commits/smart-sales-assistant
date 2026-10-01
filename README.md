# Smart Sales Assistant

Free bilingual Meeting Taker + sales CRM summary.

## Current free-mode features
- Microphone recording and live browser transcription.
- Arabic/English locale and dialect/region hints.
- Device/Tab capture when the browser exposes an audio track.
- Speaker mapping without guessing identities.
- Local persistence of up to 50 saved meetings in the browser.
- JSON and Markdown export.
- Copy transcript and CRM summary.
- Zero-cost deterministic Sales Summary fallback.
- Optional remote provider endpoints for future integrations.
- GitHub Pages deployment through GitHub Actions.

## Important limitation
Browser Speech Recognition is not guaranteed to be offline; behavior depends on the browser. The app requires no paid API key, but this is not the same as fully local Whisper inference. Official whisper.cpp WASM can run Whisper in the browser locally, but model downloads and CPU/WASM-SIMD requirements apply.

## Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000`.

## GitHub Pages
In **Settings → Pages**, set **Source** to **GitHub Actions**. Pushes to `main` then deploy the static site automatically.

## Privacy
Meeting data saved by the app is kept in browser localStorage. Browser speech recognition may process audio through the browser's speech service, so do not use it for sensitive recordings when your organization's policy forbids external speech processing.
