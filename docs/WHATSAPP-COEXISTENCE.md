# WhatsApp Coexistence: production setup

Бұл жоба бір нөмірді WhatsApp Business App ішінде сақтап, сол нөмірді Meta WhatsApp Business Platform (Cloud API) арқылы Business Assistant-ке қосуды көздейді. amoCRM, Wazzup, RadistOnline және n8n қолданылмайды.

## Ең маңызды қауіпсіздік ережесі

Қазіргі WhatsApp Business App нөмірін жоймаңыз, deregister жасамаңыз және кәдімгі Cloud API migration/registration flow арқылы қайта тіркемеңіз. Dashboard/Embedded Signup ішінде **Connect your existing WhatsApp Business App** немесе **Coexistence** таңдауы көрінгенде ғана жалғастырыңыз. Бұл таңдау жоқ болса, onboarding-ті тоқтатыңыз: business/region/app eligibility Meta жағынан әлі ашылмаған болуы мүмкін.

Coexistence іске қосылғанда Business App қолданыста қалады, бірақ Meta көрсеткен history sync, supported message types, linked devices және ел/бизнес eligibility шектеулерін onboarding экранынан қайта тексеріңіз. Бұл шарттар Meta жағынан өзгеруі мүмкін.

## Дайын backend

- Callback URL: `https://business-assistant-www5.onrender.com/api/whatsapp/webhook`
- Health: `https://business-assistant-www5.onrender.com/api/health`
- Safe status: `https://business-assistant-www5.onrender.com/api/whatsapp/status`
- GET verification және POST webhook бір endpoint-та.
- POST міндетті түрде `x-hub-signature-256` + `META_APP_SECRET` арқылы тексеріледі.
- Message ID және webhook payload hash қайталануды тоқтатады.
- Text, audio/voice, image, document, reaction, location, contacts және sent/delivered/read/failed status сақталады.

## Meta Dashboard ішінде орындалатын нақты қадамдар

### 1. Business Portfolio және Meta App

1. `business.facebook.com/settings` ішінде өз Business Portfolio-ңызды таңдаңыз. Business verification сұралса, аяқтаңыз.
2. `developers.facebook.com/apps` → **Create App**. Business use case/app type таңдаңыз және app-ты дұрыс Business Portfolio-ға байлаңыз.
3. App Dashboard → **Add products** → **WhatsApp** → **Set up**.
4. App Settings → Basic ішінен **App Secret** алыңыз. Оны тек Render-дегі `META_APP_SECRET` environment variable-ға салыңыз.

### 2. Existing WhatsApp Business App нөмірін Coexistence арқылы қосу

1. WhatsApp → Getting Started/Configuration немесе Meta ұсынған Embedded Signup flow-ды ашыңыз.
2. **Connect your existing WhatsApp Business App** / **Coexistence** нұсқасын таңдаңыз.
3. Қазіргі WhatsApp Business App қолданылатын нөмірді таңдаңыз. OTP/QR verification-ды тек ресми Meta терезесінде орындаңыз.
4. History sync ұсынылса, бизнеске керекті нұсқаны таңдаңыз. Sync көлемі/мерзімі Meta UI-де көрсетіледі.
5. Flow аяқталғаннан кейін WABA ID-ді `WHATSAPP_BUSINESS_ACCOUNT_ID`, Phone Number ID-ді `WHATSAPP_PHONE_NUMBER_ID` ретінде сақтаңыз.
6. WhatsApp Business App-та бұрынғы чаттар мен жіберу мүмкіндігі сақталғанын бірден тексеріңіз.

### 3. Webhook қосу

1. Render Environment ішінде кездейсоқ ұзын `WHATSAPP_VERIFY_TOKEN` жасаңыз. Бұл access token емес.
2. Meta App → WhatsApp → Configuration → Webhook → **Edit**:
   - Callback URL: `https://business-assistant-www5.onrender.com/api/whatsapp/webhook`
   - Verify token: Render-дегі `WHATSAPP_VERIFY_TOKEN` мәнімен дәл бірдей.
3. Verify and save басыңыз.
4. WhatsApp webhook fields ішінен кемінде **messages** field-ына subscribe жасаңыз. Message status events те осы field арқылы келеді.
5. App-ты WABA-ға subscribe етіңіз. Ресми API: `POST /{WABA-ID}/subscribed_apps`.

### 4. Production access token

1. Алғашқы smoke test үшін Dashboard temporary token қолдануға болады; ол production үшін жарамсыз.
2. Business Settings → Users → System users ішінде system user жасаңыз, app пен WABA asset-теріне рұқсат беріңіз.
3. Token жасағанда кемінде `whatsapp_business_messaging` және `whatsapp_business_management` permissions беріңіз. Business asset API қажет болса ғана `business_management` қосыңыз.
4. Token-ді Render-дегі `WHATSAPP_ACCESS_TOKEN` ретінде сақтаңыз. Оны frontend, GitHub, screenshot немесе docs ішіне салмаңыз.

### 5. Render және PostgreSQL

Render service Environment ішінде:

```text
WHATSAPP_VERIFY_TOKEN
META_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
DATABASE_URL
```

Optional `META_GRAPH_API_VERSION` defaults to the current `v26.0`; pin it explicitly if your Meta app uses another supported version and review it during Meta version upgrades.

Render PostgreSQL ішкі connection URL-ын `DATABASE_URL` ретінде қойыңыз. Бір рет schema қолданыңыз:

```bash
npm run db:schema
```

`/api/whatsapp/status` тек boolean қайтарады, secret/ID/token мәндерін қайтармайды.

### 6. End-to-end тест

1. Басқа телефоннан business нөміріне мәтін жіберіңіз.
2. Render logs-та `whatsapp_webhook_processed` және `messages: 1` барын тексеріңіз.
3. Business Assistant → Inbox ішінде thread, contact және хабарлама көрінуі тиіс.
4. Сол thread-тан жауап жіберіңіз; жауап WhatsApp-та келуі тиіс.
5. Meta 24-hour customer service window сыртында еркін text емес, approved template жіберіңіз.
6. Delivered/read status-ты Inbox және database арқылы тексеріңіз.
7. Бір signed payload-ты қайта жібергенде `duplicate: true` болып, екінші message row жасалмайтынын тексеріңіз.

## API және media

- `GET /api/inbox/threads`
- `GET /api/inbox/threads/:id/messages`
- `POST /api/inbox/threads/:id/messages` — `{ "text": "...", "replyTo": "wamid..." }`
- Template: `{ "template": { "name": "...", "languageCode": "en_US", "components": [] } }`
- `GET /api/whatsapp/status`

Media server-side орындалады: алдымен `GET /{MEDIA_ID}` арқылы уақытша URL алынады, кейін сол URL Bearer token-мен жүктеледі. Token браузерге берілмейді.

## Ресми Meta дереккөздері (2026-10-29 күні тексерілді)

- [Meta WhatsApp Business Platform official workspace](https://www.postman.com/meta/whatsapp-business-platform/overview)
- [Official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Official Messages collection](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages)
- [Official Retrieve Media URL](https://www.postman.com/meta/whatsapp-business-platform/request/ptjyi84/retrieve-media-url)
- [Official Download Media](https://www.postman.com/meta/whatsapp-business-platform/request/zsq66eh/download-media)
- [Meta Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
- [Meta onboarding for existing WhatsApp Business App users](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/)
- [Meta Cloud API webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)

Meta developer pages automated readers-ді rate-limit етуі мүмкін; account-specific Coexistence eligibility және exact labels үшін Dashboard UI — final source of truth.
