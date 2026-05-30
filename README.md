# LLM Evaluation Dashboard

React + Vite frontend for the LLM Evaluation FastAPI backend.

## Prerequisites

- Node.js 18+
- FastAPI backend running at `http://127.0.0.1:8000`

Check the backend:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Install

```bash
npm install
```

## Run

Start the FastAPI backend first, then start the frontend:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Features

- Single evaluation form
- Batch evaluation form
- Evaluation history view
- Analytics for average score, pass rate, and common error types

## API Proxy

The frontend uses relative `/api` requests. Vite proxies those requests to the backend at `http://127.0.0.1:8000`.

Proxy rewrites:

- `/api/evaluate` -> `/evaluate`
- `/api/batch-evaluate` -> `/batch-evaluate`
- `/api/evaluations` -> `/evaluations`
- `/api/health` -> `/health`

This avoids requiring backend CORS changes during local development.

## Request Payload

Single and batch evaluations are sent using the backend request schema:

```json
{
  "task": "Explain photosynthesis",
  "model_answer": "Photosynthesis is how plants make food from sunlight.",
  "reference_answer": "Photosynthesis converts light energy into chemical energy.",
  "evaluation_mode": "general_answer",
  "criteria": [
    {
      "name": "correctness",
      "description": "Evaluate correctness.",
      "weight": 0.33
    }
  ]
}
```

When criteria are entered as comma-separated text, such as `correctness, clarity, completeness`, the frontend converts them into criterion objects and distributes weights evenly.

## API Routes Used

The frontend calls these proxied routes:

- `POST /api/evaluate`
- `POST /api/batch-evaluate`
- `GET /api/evaluations`

## Troubleshooting

If the frontend shows a fetch or proxy error, confirm the backend is running:

```bash
curl http://127.0.0.1:8000/health
```

Make sure the frontend is opened through the Vite dev server, not by opening `index.html` directly.

Restart the frontend dev server after changing `vite.config.js`.
