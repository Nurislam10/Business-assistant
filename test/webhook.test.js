const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { createWebhookHandler } = require("../src/whatsapp/webhook");
const { createSignature } = require("../src/whatsapp/verify-signature");
const { textPayload } = require("./fixtures");

async function withWebhook(persist, run) {
  const handler = createWebhookHandler({
    persist,
    configProvider: () => ({ verifyToken: "verify-me", appSecret: "app-secret" })
  });
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, "http://localhost")));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("webhook verification succeeds and fails", async () => {
  await withWebhook(async () => ({}), async (base) => {
    const ok = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "12345");
    const fail = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`);
    assert.equal(fail.status, 403);
  });
});

test("invalid signature is rejected", async () => {
  await withWebhook(async () => assert.fail("must not persist"), async (base) => {
    const response = await fetch(base, { method: "POST", headers: { "x-hub-signature-256": "sha256=bad", "content-type": "application/json" }, body: JSON.stringify(textPayload) });
    assert.equal(response.status, 401);
  });
});

test("valid signature is accepted", async () => {
  let persisted = 0;
  await withWebhook(async (_raw, _payload, parsed) => { persisted++; assert.equal(parsed.messages.length, 1); return { duplicate: false, messages: 1, statuses: 0 }; }, async (base) => {
    const body = Buffer.from(JSON.stringify(textPayload));
    const response = await fetch(base, { method: "POST", headers: { "x-hub-signature-256": createSignature(body, "app-secret"), "content-type": "application/json" }, body });
    assert.equal(response.status, 200);
    assert.equal(persisted, 1);
  });
});

test("duplicate webhook is acknowledged without duplicate insert", async () => {
  const seen = new Set();
  let inserts = 0;
  await withWebhook(async (raw) => { const key = raw.toString("hex"); if (seen.has(key)) return { duplicate: true, messages: 0, statuses: 0 }; seen.add(key); inserts++; return { duplicate: false, messages: 1, statuses: 0 }; }, async (base) => {
    const body = Buffer.from(JSON.stringify(textPayload));
    const headers = { "x-hub-signature-256": createSignature(body, "app-secret"), "content-type": "application/json" };
    assert.equal((await fetch(base, { method: "POST", headers, body })).status, 200);
    const second = await fetch(base, { method: "POST", headers, body });
    assert.equal((await second.json()).duplicate, true);
    assert.equal(inserts, 1);
  });
});
