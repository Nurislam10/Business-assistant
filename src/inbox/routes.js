const { readBody, sendJson } = require("../http");
const repository = require("../db/whatsapp-repository");
const { WhatsAppClient } = require("../whatsapp/client");

async function jsonBody(req) {
  const raw = await readBody(req, 256 * 1024);
  return JSON.parse(raw.toString("utf8") || "{}");
}

function createInboxHandler(deps = {}) {
  const repo = deps.repository || repository;
  const client = deps.client || new WhatsAppClient();
  return async function handleInbox(req, res, url) {
    try {
      if (req.method === "GET" && url.pathname === "/api/inbox/threads") {
        return sendJson(res, 200, { threads: await repo.listThreads() });
      }
      const match = url.pathname.match(/^\/api\/inbox\/threads\/([0-9a-f-]+)\/messages$/i);
      if (!match) return false;
      const threadId = match[1];
      if (req.method === "GET") {
        const thread = await repo.getThread(threadId);
        if (!thread) return sendJson(res, 404, { ok: false, error: "thread_not_found" });
        return sendJson(res, 200, { messages: await repo.listMessages(threadId) });
      }
      if (req.method === "POST") {
        const thread = await repo.getThread(threadId);
        if (!thread) return sendJson(res, 404, { ok: false, error: "thread_not_found" });
        const body = await jsonBody(req);
        let request;
        let response;
        if (body.template) {
          if (typeof body.template.name !== "string" || !body.template.name.trim() ||
              typeof body.template.languageCode !== "string" || !body.template.languageCode.trim() ||
              (body.template.components && !Array.isArray(body.template.components))) {
            return sendJson(res, 400, { ok: false, error: "invalid_template" });
          }
          request = {
            type: "template",
            template: {
              name: body.template.name,
              language: { code: body.template.languageCode },
              ...(body.template.components ? { components: body.template.components } : {})
            }
          };
          response = await client.sendTemplate(
            thread.external_thread_id,
            body.template.name,
            body.template.languageCode,
            body.template.components || []
          );
        } else {
          if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 4096) {
            return sendJson(res, 400, { ok: false, error: "invalid_text" });
          }
          request = {
            type: "text",
            text: { preview_url: false, body: body.text.trim() },
            ...(body.replyTo ? { context: { message_id: body.replyTo } } : {})
          };
          response = await client.sendText(thread.external_thread_id, body.text.trim(), body.replyTo);
        }
        const message = await repo.saveOutbound(threadId, response, request);
        return sendJson(res, 201, { ok: true, message });
      }
      res.setHeader("allow", "GET, POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    } catch (error) {
      const status = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
      return sendJson(res, status, { ok: false, error: error.code === "DATABASE_NOT_CONFIGURED" ? "database_not_configured" : error.message });
    }
  };
}

module.exports = { createInboxHandler };
