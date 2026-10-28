const crypto = require("crypto");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(a || "");
  const bBuf = Buffer.from(b || "");
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // allow initial setup; require it before production use
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  return safeEqual(expected, signatureHeader);
}

function summarizeWebhook(payload) {
  const out = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const metadata = value.metadata || {};

      for (const message of value.messages || []) {
        out.push({
          kind: "message",
          phone_number_id: metadata.phone_number_id || null,
          from: message.from || null,
          message_id: message.id || null,
          type: message.type || null,
          timestamp: message.timestamp || null,
          text: message.text?.body || null
        });
      }

      for (const status of value.statuses || []) {
        out.push({
          kind: "status",
          phone_number_id: metadata.phone_number_id || null,
          message_id: status.id || null,
          status: status.status || null,
          timestamp: status.timestamp || null,
          recipient_id: status.recipient_id || null
        });
      }
    }
  }

  return out;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ ok: false, error: "verification_failed" });
  }

  if (req.method === "POST") {
    try {
      const rawBody = await readRawBody(req);
      const signature = req.headers["x-hub-signature-256"];

      if (!verifySignature(rawBody, signature)) {
        return res.status(401).json({ ok: false, error: "invalid_signature" });
      }

      const payload = JSON.parse(rawBody.toString("utf8") || "{}");
      const events = summarizeWebhook(payload);

      // MVP: logs only. Next step is PostgreSQL persistence + inbox UI.
      console.log(
        JSON.stringify({
          source: "whatsapp",
          received_at: new Date().toISOString(),
          events
        })
      );

      return res.status(200).json({ ok: true, received: events.length });
    } catch (error) {
      console.error("WhatsApp webhook error", error);
      return res.status(400).json({ ok: false, error: "invalid_payload" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "method_not_allowed" });
};
