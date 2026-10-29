const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { getConfig, publicStatus } = require("./src/config");
const db = require("./src/db");
const { sendJson } = require("./src/http");
const logger = require("./src/logger");
const { createInboxHandler } = require("./src/inbox/routes");
const { createWebhookHandler } = require("./src/whatsapp/webhook");

const WEB_ROOT = path.join(__dirname, "web");
const webhook = createWebhookHandler();
const inbox = createInboxHandler();

function serveStatic(reqPath, res) {
  const relative = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const filePath = path.resolve(WEB_ROOT, relative);
  if (filePath !== WEB_ROOT && !filePath.startsWith(`${WEB_ROOT}${path.sep}`)) return res.writeHead(403).end("Forbidden");
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end("Not found");
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };
    res.writeHead(200, { "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream", "x-content-type-options": "nosniff" });
    fs.createReadStream(filePath).pipe(res);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname === "/api/health" && req.method === "GET") {
        const database = await db.health();
        return sendJson(res, 200, { ok: true, service: "business-assistant-whatsapp", database: database.reachable ? "connected" : (database.configured ? "unavailable" : "not_configured"), timestamp: new Date().toISOString() });
      }
      if (url.pathname === "/api/whatsapp/status" && req.method === "GET") return sendJson(res, 200, publicStatus());
      if (url.pathname === "/api/whatsapp/webhook") return webhook(req, res, url);
      if (url.pathname.startsWith("/api/inbox/")) {
        const handled = await inbox(req, res, url);
        if (handled !== false) return handled;
      }
      if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { ok: false, error: "not_found" });
      serveStatic(url.pathname, res);
    } catch (error) {
      logger.error("request_error", { path: url.pathname, message: error.message });
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "internal_error" });
    }
  });
}

if (require.main === module) {
  const config = getConfig();
  createServer().listen(config.port, "0.0.0.0", () => logger.info("server_started", { port: config.port }));
}

module.exports = { createServer };
