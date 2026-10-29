const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 10000);
const WEB_ROOT = path.join(__dirname, "web");

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(contentType.startsWith("application/json") ? JSON.stringify(body) : body);
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(a || "");
  const bBuf = Buffer.from(b || "");
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function serveStatic(reqPath, res) {
  const relative = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(WEB_ROOT, relative));
  if (!filePath.startsWith(WEB_ROOT)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html":"text/html; charset=utf-8",
      ".css":"text/css; charset=utf-8",
      ".js":"application/javascript; charset=utf-8",
      ".json":"application/json; charset=utf-8",
      ".png":"image/png",
      ".jpg":"image/jpeg",
      ".jpeg":"image/jpeg",
      ".svg":"image/svg+xml"
    };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && req.method === "GET") {
    return send(res, 200, {
      ok: true,
      service: "business-assistant-whatsapp",
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === "/api/whatsapp/webhook" && req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return send(res, 200, challenge || "", "text/plain; charset=utf-8");
    }
    return send(res, 403, { ok:false, error:"verification_failed" });
  }

  if (url.pathname === "/api/whatsapp/webhook" && req.method === "POST") {
    try {
      const rawBody = await readBody(req);
      if (!verifySignature(rawBody, req.headers["x-hub-signature-256"])) {
        return send(res, 401, { ok:false, error:"invalid_signature" });
      }

      const payload = JSON.parse(rawBody.toString("utf8") || "{}");
      const events = summarizeWebhook(payload);
      console.log(JSON.stringify({
        source:"whatsapp",
        received_at:new Date().toISOString(),
        events
      }));
      return send(res, 200, { ok:true, received:events.length });
    } catch (error) {
      console.error("webhook_error", error);
      return send(res, 400, { ok:false, error:"invalid_payload" });
    }
  }

  if (url.pathname.startsWith("/api/")) {
    return send(res, 404, { ok:false, error:"not_found" });
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Business Assistant listening on port ${PORT}`);
});
