const { getConfig } = require("../config");
const { sendJson, sendText, readBody, requestId } = require("../http");
const logger = require("../logger");
const repository = require("../db/whatsapp-repository");
const { parseWebhook } = require("./parser");
const { verifySignature } = require("./verify-signature");

function verifyRequest(url, config = getConfig()) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (!config.verifyToken || mode !== "subscribe" || token !== config.verifyToken || challenge === null) {
    return { ok: false };
  }
  return { ok: true, challenge };
}

function createWebhookHandler(deps = {}) {
  const persist = deps.persist || repository.persistWebhook;
  const configProvider = deps.configProvider || getConfig;
  return async function webhook(req, res, url) {
    const id = requestId(req);
    if (req.method === "GET") {
      const result = verifyRequest(url, configProvider());
      logger.info("whatsapp_webhook_verification", { requestId: id, success: result.ok });
      return result.ok
        ? sendText(res, 200, result.challenge)
        : sendJson(res, 403, { ok: false, error: "verification_failed" });
    }
    if (req.method !== "POST") {
      res.setHeader("allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    let rawBody;
    try {
      rawBody = await readBody(req);
      const config = configProvider();
      if (!verifySignature(rawBody, req.headers["x-hub-signature-256"], config.appSecret)) {
        logger.warn("whatsapp_webhook_rejected", { requestId: id, reason: "invalid_signature" });
        return sendJson(res, 401, { ok: false, error: "invalid_signature" });
      }
      const payload = JSON.parse(rawBody.toString("utf8"));
      if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
        return sendJson(res, 400, { ok: false, error: "unsupported_payload" });
      }
      const parsed = parseWebhook(payload);
      const result = await persist(rawBody, payload, parsed);
      logger.info("whatsapp_webhook_processed", {
        requestId: id,
        duplicate: result.duplicate,
        messages: result.messages,
        statuses: result.statuses
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      if (rawBody) await repository.markFailed(rawBody, error);
      const status = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
      logger.error("whatsapp_webhook_error", { requestId: id, message: error.message, status });
      return sendJson(res, status, { ok: false, error: status === 400 ? "invalid_payload" : "processing_failed" });
    }
  };
}

module.exports = { createWebhookHandler, verifyRequest };
