function normalizeAgentResponse(data) {
  const notification = data.notification || {};
  return {
    ok: true,
    reply:
      data.reply ||
      notification.reply ||
      "Thank you. A GlobalPath consultant can follow up with the next step.",
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
    profile: data.profile || {}
  };
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed." }, 405);
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return json({ ok: false, error: "N8N_WEBHOOK_URL is not configured." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const message = String(body.message || "").trim();
    const name = String(body.name || "Demo Client").trim();
    const phone = String(body.phone || "+10000000000").trim();
    const sessionId = String(body.sessionId || phone).trim();

    if (!message) {
      return json({ ok: false, error: "Message is required." }, 400);
    }

    try {
      const upstreamResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, sessionId, message, channel: "demo-dashboard" })
      });

      const text = await upstreamResponse.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!upstreamResponse.ok) {
        return json(
          { ok: false, error: "The n8n workflow returned an error.", details: data },
          upstreamResponse.status
        );
      }

      return json(normalizeAgentResponse(data));
    } catch (error) {
      return json(
        { ok: false, error: "Unable to reach the GlobalPath agent.", details: error.message },
        500
      );
    }
  }
};
