# LLM Evaluation Dashboard

A separate React + Vite frontend for an existing FastAPI backend running at:

```bash
http://127.0.0.1:8000
```

The app includes:

- Single evaluation form
- Batch evaluation form
- Evaluation history view
- Basic analytics for average score, pass rate, and common error types

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Backend Configuration

By default, API requests are sent through the Vite proxy at `/api`.

The proxy forwards requests to `http://127.0.0.1:8000` and removes the `/api` prefix:

- `/api/evaluate` -> `/evaluate`
- `/api/batch-evaluate` -> `/batch-evaluate`
- `/api/evaluations` -> `/evaluations`
- `/api/health` -> `/health`

## Expected Backend Routes

The frontend API client currently calls:

- `POST /evaluate`
- `POST /batch-evaluate`
- `GET /evaluations`

If the FastAPI backend uses different paths, update `src/api.js`.
