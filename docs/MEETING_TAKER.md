# Meeting Taker Architecture

## Priority
The product is being built around three core layers:

1. **Capture**
   - Microphone capture.
   - Browser-supported tab/device audio capture through `getDisplayMedia()`.
   - Audio recording with `MediaRecorder`.

2. **Transcription**
   - Current prototype: browser Speech Recognition for live transcription.
   - Arabic locale presets: Egypt, Saudi Arabia, UAE, Lebanon, Morocco.
   - English locale presets: US, UK, Australia, India.
   - Production target: server-side speech-to-text with automatic language detection, timestamps and speaker diarization.

3. **Sales Summary**
   - Meeting identity and attendees.
   - Company and industry.
   - Customer needs and pain points.
   - Requirements and desired outcome.
   - Objections and concerns.
   - Budget / pricing discussion.
   - Competitors and alternatives mentioned.
   - Decision maker / stakeholders.
   - Timeline and next step.
   - Commitment level.
   - Risks / blockers.
   - Recommended follow-up.
   - Full CRM-ready narrative.

## Bilingual requirement
The final transcription engine should support mixed Arabic/English in the same meeting, not just one language per meeting. Dialect selection is a hint, while the production engine should use language detection to avoid forcing all speech into one locale.

## Speaker identification
The production version should use speaker diarization so the transcript can become:

Speaker 1: ...
Speaker 2: ...

When names are known from the CRM context, the summary layer can map speaker labels to attendee names with explicit confidence rather than guessing.

## Security
API keys must never be placed in browser JavaScript. Production transcription and AI summary calls should go through a server-side API.
