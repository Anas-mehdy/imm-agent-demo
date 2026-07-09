function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeAgentResponse(data) {
  const notification = data.notification || {};
  const reply =
    data.reply ||
    notification.reply ||
    "Thank you. I have prepared your details for consultant review. A GlobalPath consultant can follow up with the next step.";

  return {
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
    raw: data
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(500).json({ ok: false, error: "N8N_WEBHOOK_URL is not configured." });
    return;
  }

  const body = typeof req.body === "string" ? safeJsonParse(req.body) : req.body || {};
  const message = String(body.message || "").trim();
  const name = String(body.name || "Demo Client").trim();
  const phone = String(body.phone || "+10000000000").trim();

  if (!message) {
    res.status(400).json({ ok: false, error: "Message is required." });
    return;
  }

  try {
    const upstreamResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, message, channel: "demo-dashboard" })
    });

    const text = await upstreamResponse.text();
    const data = safeJsonParse(text, { raw: text });

    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        ok: false,
        error: "The n8n workflow returned an error.",
        details: data
      });
      return;
    }

    res.status(200).json(normalizeAgentResponse(data));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to reach the GlobalPath agent.",
      details: error.message
    });
  }
};
