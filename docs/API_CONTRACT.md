# API Contract

## POST /api/transcribe

Request:
- multipart/form-data
- audio: audio chunk/file
- session_id: string
- language_mode: "auto" | "ar" | "en"
- dialect_hint: optional locale

Response:
{
  "segments": [
    {
      "id": "seg_001",
      "speaker": "speaker_1",
      "start_ms": 0,
      "end_ms": 4200,
      "language": "ar",
      "text": "...",
      "confidence": 0.0,
      "final": true
    }
  ]
}

## POST /api/sales-summary

Request:
{
  "meeting": {
    "title": "...",
    "company": "...",
    "industry": "...",
    "attendees": []
  },
  "transcript": []
}

Response should contain:
- executive_summary
- meeting_details
- participants
- customer_context
- needs
- pain_points
- requirements
- objections
- pricing_and_budget
- competitors
- buying_signals
- risk_signals
- decisions
- open_questions
- next_steps
- crm_summary
- follow_up_message

## Accuracy rule
The summary must distinguish between:
- Explicitly stated facts
- Strongly supported observations
- Unknown / not mentioned

Never fill missing CRM fields with invented information.
