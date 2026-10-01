# Backend

The MVP backend is provider-agnostic.

## Endpoints
- GET /api/health
- POST /api/transcribe
- POST /api/sales-summary

## Production flow
Browser capture -> /api/transcribe -> speech-to-text provider -> timestamped speaker segments -> /api/sales-summary -> structured CRM intelligence.

Provider secrets stay on the server.

Set STT_PROVIDER=remote with STT_ENDPOINT/STT_API_KEY to connect a speech-to-text adapter.
Set SUMMARY_PROVIDER=remote with SUMMARY_ENDPOINT/SUMMARY_API_KEY to connect an AI summary adapter.

The default mock mode is deliberate so the repository can be developed without inventing or exposing provider credentials.
