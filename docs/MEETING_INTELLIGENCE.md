# Meeting Intelligence

The Meeting Taker is designed to turn a raw bilingual conversation into CRM-ready sales intelligence.

## Pipeline

1. Capture audio
2. Transcribe Arabic, English, and mixed speech
3. Preserve timestamps and speaker IDs
4. Allow the salesperson to map Speaker 1/2/etc. to names
5. Analyze the complete transcript
6. Extract explicit facts first
7. Mark missing information as `Not mentioned`
8. Separate customer statements from salesperson statements
9. Extract:
   - customer context
   - needs
   - pain points
   - requirements
   - objections
   - budget/pricing
   - competitors
   - decision maker
   - authority
   - urgency
   - timeline
   - agreements
   - disagreements
   - buying signals
   - risk signals
   - open questions
   - next steps
10. Generate a CRM-ready narrative and follow-up message

## Speaker identity rule

The transcription service must never guess a person's real name.

Example:

- Speaker 1 -> Ahmad (manually mapped by user)
- Speaker 2 -> Youssef (manually mapped by user)

If no mapping exists, retain the speaker label.

## Evidence rule

Every extracted sales fact should be traceable to transcript content. The AI must not turn assumptions into facts.

Examples:

- "Client said the budget is 7,000 SAR" -> explicit fact.
- "Client sounds price sensitive" -> observation, only when supported by repeated price discussion.
- "Decision maker is the owner" -> only if stated or clearly established.
- Missing budget -> `Not mentioned`.

## Follow-up quality

The generated follow-up should:
- reference the actual meeting
- reflect the customer's stated priorities
- mention agreed next steps
- avoid inventing promises
- avoid aggressive pressure
- be usable as WhatsApp or email copy
