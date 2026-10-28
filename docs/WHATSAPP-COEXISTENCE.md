# WhatsApp Coexistence integration

## Goal
Keep the existing WhatsApp Business app in daily use while connecting the same business messaging operation to the Business Assistant backend.

## Current implementation
- `GET /api/whatsapp/webhook` — Meta webhook verification
- `POST /api/whatsapp/webhook` — receives WhatsApp webhook events
- `POST` validates `x-hub-signature-256` when `META_APP_SECRET` is configured
- `GET /api/health` — backend health check

## Required Vercel environment variables
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- later:
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_BUSINESS_ACCOUNT_ID`

## Meta webhook URL
After Vercel deployment:

`https://<vercel-domain>/api/whatsapp/webhook`

Use the same `WHATSAPP_VERIFY_TOKEN` value in Meta when verifying the callback URL.

## What happens next
1. Deploy this repository to Vercel.
2. Add environment variables.
3. Create/configure the Meta app and WhatsApp product.
4. Complete Coexistence onboarding for the existing WhatsApp Business number.
5. Set callback URL + verify token.
6. Subscribe to message events.
7. Send a real test message and confirm webhook delivery.
8. Add PostgreSQL persistence and connect the Inbox UI.

## Security
Never commit access tokens, app secrets, OTP codes, or private keys to GitHub.
