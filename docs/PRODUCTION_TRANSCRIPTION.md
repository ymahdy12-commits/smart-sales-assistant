# Production Transcription Plan

## Goal
Accurately transcribe real sales meetings where Arabic, English and regional accents may be mixed in the same conversation.

## Required pipeline
Browser:
1. User chooses microphone, tab audio, or both when supported.
2. Browser captures audio.
3. Audio is streamed/chunked to the backend.
4. UI shows connection, recording and transcription status.

Backend:
1. Receive short audio chunks.
2. Normalize audio format/sample rate.
3. Send audio to a speech-to-text engine.
4. Enable automatic language detection.
5. Preserve timestamps.
6. Run speaker diarization.
7. Merge segments into a stable chronological transcript.
8. Return partial and final segments to the browser.

Transcript model:
- segment_id
- speaker_id
- start_ms
- end_ms
- language
- text
- confidence
- is_final

## Arabic / English
Do not force a single language on the entire meeting. The engine must be able to recognize code-switching such as:
"إحنا محتاجين improve the ROAS قبل ما نبدأ."

## Dialects
Dialect selection should be used as an optional recognition hint. It must not rewrite the transcript into a different dialect. Preserve what was actually said.

## Speaker names
Diarization should initially return Speaker 1, Speaker 2, etc. The user can map speakers to attendee names. The system should not invent identities.

## Browser reality
System/tab audio capture depends on browser support and what the user selects in the screen-share dialog. Microphone capture is broadly supported on modern browsers.

## Security
No transcription or AI provider secret may be shipped to the browser. All provider requests must go through a backend endpoint.

## Next implementation
Create a backend API with:
- POST /api/transcribe
- POST /api/sales-summary
- GET /api/health

Then replace the browser-only Speech Recognition path with backend transcription while retaining it as a local fallback.
