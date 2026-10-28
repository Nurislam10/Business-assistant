# Business Assistant OS — MVP 0.1

A lightweight, dependency-free prototype for a founder/CEO business assistant workspace.

## What works now
- My Day dashboard
- Tasks: create, prioritize, assign, complete
- Projects: create and track
- Team: add members and roles
- Decisions: capture decisions that need owner attention
- Inbox placeholder for future WhatsApp Coexistence integration
- Local persistence in the browser via `localStorage`

## Run
Open `web/index.html` in a modern browser.

For a local server:
```bash
cd web
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

## Next production phase
- Authentication and roles
- PostgreSQL
- API backend
- OpenAI assistant layer
- WhatsApp Business Platform Coexistence webhooks
- Calendar/Drive integrations
- Notifications and audit log

See `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.
