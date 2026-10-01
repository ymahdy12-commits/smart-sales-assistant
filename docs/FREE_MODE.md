# Free Architecture

The production target for this MVP is $0 recurring API cost.

## What runs locally

- microphone capture
- browser speech recognition when supported
- transcript editing
- speaker naming
- deterministic sales-signal extraction
- meeting persistence in localStorage
- JSON/Markdown export

No API key is required.

## Local Whisper path

The project can later bundle whisper.cpp WebAssembly for fully local speech recognition. The official whisper.cpp browser examples process audio locally in the browser and provide a real-time WASM example. Model size and CPU requirements are significant, so the browser-native recognizer remains the lightweight default for this MVP.

## Important limitation

A browser-only app cannot provide the same quality of semantic reasoning as a paid cloud LLM without shipping a local language model. The current free summary engine therefore extracts explicit keyword/sentence signals and never claims facts that are not present.

## Privacy

Audio is not intentionally uploaded by the free browser path. Device/tab capture remains subject to browser permissions and browser support.

## Deployment

The included GitHub Actions workflow deploys the static app to GitHub Pages. Public repositories can use GitHub Pages without paying for a separate hosting server.

## Optional future upgrade

A self-hosted local LLM can be added later through Ollama or another local runtime while preserving the same API contract. This can remain free after the model is downloaded, but requires a capable local machine.
