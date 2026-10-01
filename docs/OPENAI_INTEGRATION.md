# AI provider integration

The project is prepared for a server-side AI provider.

For OpenAI, the intended production flow is:

1. Browser captures microphone or meeting/tab audio.
2. The backend receives the audio; credentials never enter browser JavaScript.
3. A speech-to-text model produces the transcript and, where supported, speaker/timestamp segments.
4. The transcript and meeting context are sent to a text model.
5. The text model returns the structured CRM schema in docs/SALES_SUMMARY_SCHEMA.md.

OpenAI's current API documentation exposes a transcription endpoint at `/v1/audio/transcriptions`, including diarized transcription support, and its Responses API supports structured JSON schema output. See the official documentation before wiring a production credential.

The repository intentionally keeps provider credentials out of source control. Configure them only through the deployment environment.

Current repository mode remains `mock` until a provider credential is configured.
