# Architecture direction

## Prototype
Pure HTML/CSS/JS with localStorage. No external services and no secrets.

## Production target
Frontend: Next.js + TypeScript
Backend: Node/TypeScript service (can start inside Next.js route handlers, split later)
Database: PostgreSQL
Auth: managed auth provider or self-hosted session auth
AI: OpenAI Responses/Agents layer with tool permissions
Queue: background jobs only when integrations require retries
Storage: object storage for files/audio

## Core entities
- User
- TeamMember
- Project
- Task
- Decision
- InboxThread
- Message
- Comment
- ActivityLog
- Integration

## Important boundaries
- `external_messages`: customer/partner WhatsApp content.
- `internal_comments`: team-only notes.
Never mix these two channels in storage or UI.

## WhatsApp Coexistence boundary
A future integration service will:
1. Receive Meta webhook events.
2. Verify signatures.
3. Persist messages idempotently.
4. Link contacts/threads.
5. Publish normalized inbox events.
6. Send outbound messages only through approved API actions.

No amoCRM, RadistOnline, Wazzup or n8n in the target design.
