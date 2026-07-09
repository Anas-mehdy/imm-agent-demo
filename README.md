# GlobalPath Agent Demo Dashboard

Simple local dashboard for testing the GlobalPath n8n AI agent before connecting it to WhatsApp.

## Run

```powershell
cd "C:\Users\anasm\OneDrive\Desktop\claude\immegration agent demo dashcorad"
$env:N8N_WEBHOOK_URL="YOUR_N8N_WEBHOOK_URL"
npm start
```

Open:

```text
http://localhost:4177
```

## Configuration

The dashboard does not store the n8n webhook URL in the public repo.
Set it through an environment variable:

```text
N8N_WEBHOOK_URL
```

For local development:

```powershell
$env:N8N_WEBHOOK_URL="YOUR_N8N_WEBHOOK_URL"
npm start
```

For Vercel, add `N8N_WEBHOOK_URL` in Project Settings -> Environment Variables.

## What It Shows

- Live chat with the GlobalPath agent.
- Intent and service classification.
- Destination.
- Recommended package.
- Lead score.
- Human handoff status.
- Consultant summary.
- Risk flags and missing fields when returned by the agent.
