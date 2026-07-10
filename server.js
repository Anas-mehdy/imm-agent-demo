const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4177);
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL
  ?.trim()
  .replace("/webhook-test/", "/webhook/");

const PUBLIC_DIR = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function handleChat(req, res) {
  try {
    if (!N8N_WEBHOOK_URL) {
      sendJson(res, 500, {
        ok: false,
        error: "N8N_WEBHOOK_URL is not configured."
      });
      return;
    }

    const body = safeJsonParse(await readBody(req));
    const message = String(body.message || "").trim();
    const name = String(body.name || "Demo Client").trim();
    const phone = String(body.phone || "+10000000000").trim();
    const sessionId = String(body.sessionId || phone).trim();

    if (!message) {
      sendJson(res, 400, { ok: false, error: "Message is required." });
      return;
    }

    const upstreamResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, sessionId, message, channel: "demo-dashboard" })
    });

    const text = await upstreamResponse.text();
    const data = safeJsonParse(text, { raw: text });

    if (!upstreamResponse.ok) {
      sendJson(res, upstreamResponse.status, {
        ok: false,
        error: "The n8n workflow returned an error.",
        details: data
      });
      return;
    }

    const notification = data.notification || {};
    const reply =
      data.reply ||
      notification.reply ||
      "Thank you. I have prepared your details for consultant review. A GlobalPath consultant can follow up with the next step.";

    sendJson(res, 200, {
      ok: true,
      reply,
      intent: data.intent || notification.intent || null,
      service: data.service || notification.service || null,
      destination: data.destination || notification.destination || null,
      packageRecommendation:
        data.packageRecommendation || notification.recommendedPackage || null,
      leadScore: data.leadScore ?? notification.leadScore ?? 0,
      needsHuman: Boolean(data.needsHuman || data.handoffQueued || notification.notify),
      handoffQueued: Boolean(data.handoffQueued || notification.notify),
      riskFlags: data.riskFlags || notification.riskFlags || [],
      missingFields: data.missingFields || [],
      consultantSummary:
        data.consultantSummary || notification.summary || "No consultant summary yet.",
      profile: data.profile || {},
      raw: data
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: "Unable to reach the GlobalPath agent.",
      details: error.message
    });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    handleChat(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed." });
});

server.listen(PORT, () => {
  console.log(`GlobalPath demo dashboard running at http://localhost:${PORT}`);
  console.log(
    N8N_WEBHOOK_URL
      ? "Agent webhook is configured."
      : "Missing N8N_WEBHOOK_URL. Chat requests will fail until it is set."
  );
});
