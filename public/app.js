const state = {
  messages: [],
  lastLead: null,
  isSending: false,
  sessionId: crypto.randomUUID()
};

const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chatForm");
const inputEl = document.querySelector("#messageInput");
const sendButtonEl = document.querySelector("#sendButton");
const nameEl = document.querySelector("#clientName");
const phoneEl = document.querySelector("#clientPhone");
const resetButtonEl = document.querySelector("#resetButton");

const fields = {
  leadScore: document.querySelector("#leadScore"),
  scoreRing: document.querySelector("#scoreRing"),
  leadTemperature: document.querySelector("#leadTemperature"),
  intent: document.querySelector("#intent"),
  destination: document.querySelector("#destination"),
  service: document.querySelector("#service"),
  packageRecommendation: document.querySelector("#packageRecommendation"),
  consultantSummary: document.querySelector("#consultantSummary"),
  chips: document.querySelector("#chips"),
  processSteps: document.querySelector("#processSteps")
};

const samplePrompt =
  "My name is Phylis from Kenya. I would like to travel and work in Canada. I have a diploma in early childhood education and 2 years experience.";

function addMessage(role, text) {
  state.messages.push({ role, text });
  const template = document.querySelector("#messageTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  node.querySelector(".bubble").textContent = text;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setSending(value) {
  state.isSending = value;
  sendButtonEl.disabled = value;
  sendButtonEl.querySelector("span").textContent = value ? "Sending" : "Send";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function leadTemperature(score, needsHuman) {
  if (needsHuman) return "Needs Consultant";
  if (score >= 85) return "Hot Lead";
  if (score >= 55) return "Warm Lead";
  if (score > 0) return "Early Lead";
  return "Unqualified";
}

function updateProcess(lead) {
  const steps = Array.from(fields.processSteps.querySelectorAll("li"));
  const complete = new Set(["message"]);

  if (lead.intent || lead.service) complete.add("intent");
  if ((lead.missingFields || []).length || lead.consultantSummary) {
    complete.add("qualification");
  }
  if (lead.packageRecommendation) complete.add("package");
  if (lead.needsHuman || lead.handoffQueued) complete.add("handoff");

  let activeAssigned = false;
  steps.forEach((step) => {
    const name = step.dataset.step;
    const isDone = complete.has(name);
    const isActive = !isDone && !activeAssigned;
    step.classList.toggle("done", isDone);
    step.classList.toggle("active", isActive);
    if (isActive) activeAssigned = true;
  });
}

function missingFieldLabel(field) {
  const labels = {
    age: "Age",
    originCountry: "Nationality / residence",
    destination: "Destination",
    qualification: "Qualification",
    experienceYears: "Work experience",
    languageLevel: "Language level",
    passportStatus: "Valid passport",
    cvStatus: "Updated CV",
    serviceNeed: "Support needed",
    jobOfferStatus: "Job offer"
  };
  return labels[field] || String(field).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function renderChips(lead) {
  const riskFlags = lead.riskFlags || [];
  const missingFields = lead.missingFields || [];
  fields.chips.innerHTML = "";

  if (!riskFlags.length && !missingFields.length) {
    const chip = document.createElement("span");
    chip.className = "chip neutral";
    chip.textContent = lead.ok ? "No flags returned" : "No data yet";
    fields.chips.appendChild(chip);
    return;
  }

  riskFlags.forEach((flag) => {
    const chip = document.createElement("span");
    chip.className = "chip danger";
    chip.textContent = flag;
    fields.chips.appendChild(chip);
  });

  missingFields.forEach((field) => {
    const chip = document.createElement("span");
    chip.className = "chip warning";
    chip.textContent = `Missing: ${missingFieldLabel(field)}`;
    fields.chips.appendChild(chip);
  });
}

function updateLeadPanel(lead) {
  state.lastLead = lead;
  const score = Math.max(0, Math.min(100, Number(lead.leadScore || 0)));
  const degrees = Math.round((score / 100) * 360);

  fields.leadScore.textContent = score;
  fields.scoreRing.style.background = `conic-gradient(var(--green) ${degrees}deg, #e3ece8 ${degrees}deg)`;
  fields.leadTemperature.textContent = leadTemperature(score, lead.needsHuman || lead.handoffQueued);
  fields.intent.textContent = formatValue(lead.intent);
  fields.destination.textContent = formatValue(lead.destination);
  fields.service.textContent = formatValue(lead.service);
  fields.packageRecommendation.textContent = formatValue(lead.packageRecommendation);
  fields.consultantSummary.textContent =
    lead.consultantSummary || "The agent has not produced a consultant summary yet.";
  renderChips(lead);
  updateProcess(lead);
}

async function sendMessage(message) {
  const payload = {
    name: nameEl.value.trim() || "Demo Client",
    phone: phoneEl.value.trim() || "+10000000000",
    sessionId: state.sessionId,
    message
  };

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "The agent did not respond.");
  }

  return data;
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = inputEl.value.trim();
  if (!message || state.isSending) return;

  addMessage("user", message);
  inputEl.value = "";
  setSending(true);

  try {
    const lead = await sendMessage(message);
    addMessage("agent", lead.reply);
    updateLeadPanel(lead);
  } catch (error) {
    addMessage("system", error.message);
  } finally {
    setSending(false);
    inputEl.focus();
  }
});

resetButtonEl.addEventListener("click", () => {
  state.messages = [];
  state.lastLead = null;
  state.sessionId = crypto.randomUUID();
  messagesEl.innerHTML = "";
  updateLeadPanel({
    ok: false,
    leadScore: 0,
    intent: null,
    destination: null,
    service: null,
    packageRecommendation: null,
    consultantSummary: "Waiting for the first client message.",
    missingFields: [],
    riskFlags: []
  });
  inputEl.value = samplePrompt;
  inputEl.focus();
});

addMessage(
  "agent",
  "Welcome. Use this demo to test the GlobalPath agent before connecting it to WhatsApp. Send a client-style message and the lead qualification panel will update live."
);
inputEl.value = samplePrompt;
updateLeadPanel({
  ok: false,
  leadScore: 0,
  consultantSummary: "Waiting for the first client message.",
  missingFields: [],
  riskFlags: []
});
