# Business Assistant OS

Business Assistant with a production-ready Meta WhatsApp Business Platform / Cloud API backend prepared for WhatsApp Coexistence. The existing WhatsApp Business App number must be onboarded through Meta's Coexistence flow. No amoCRM, Wazzup, RadistOnline or n8n.

## Run

```bash
npm install
npm start
```

The server uses `process.env.PORT` (default `10000`) and serves the static app from `web/`. GitHub Pages can still publish `web/` without backend secrets.

## Environment

```text
WHATSAPP_VERIFY_TOKEN
META_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
DATABASE_URL
```

No environment value is exposed by the status endpoint or frontend. With no database, the server and `/api/health` keep running; inbox endpoints return `503 database_not_configured`.

Apply PostgreSQL schema once:

```bash
npm run db:schema
```

## Endpoints

- `GET /api/health`
- `GET|POST /api/whatsapp/webhook`
- `GET /api/whatsapp/status`
- `GET /api/inbox/threads`
- `GET /api/inbox/threads/:id/messages`
- `POST /api/inbox/threads/:id/messages`

Outbound supports text, replies (`replyTo`) and templates. Media metadata/download stays server-side in `src/whatsapp/media.js`.

## Security and data boundaries

Webhook POST requires valid `x-hub-signature-256`; missing `META_APP_SECRET` fails closed. `webhook_events.event_key` and `whatsapp_messages.whatsapp_message_id` enforce idempotency. `internal_comments` is for team-only notes and is never used for WhatsApp messages.

Run tests with `npm test`. See [docs/WHATSAPP-COEXISTENCE.md](docs/WHATSAPP-COEXISTENCE.md) for the verified Meta/Render onboarding checklist.
