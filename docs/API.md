# API quick reference

All routes are under `/api`. The Vercel frontend points to the backend using
`VITE_API_URL`, for example `https://your-service.onrender.com/api`.

## Health

`GET /api/health` reports the API, AI configuration, model, and MongoDB connection state.

## Authentication and patient data

- `POST /api/auth/register` accepts `{ "name", "email", "password" }` and returns a user and bearer token.
- `POST /api/auth/login` accepts `{ "email", "password" }` and returns a user and bearer token.
- `GET /api/auth/me` returns the authenticated user.
- `GET /api/patient-data` returns the signed-in user's care plan, history, and reminders.
- `PUT /api/patient-data` replaces patient data; `PATCH /api/patient-data` updates supplied fields.

Authenticated routes require `Authorization: Bearer <token>`.

## Document extraction

`POST /api/extract` uses `multipart/form-data` with file field `document`.
The backend currently extracts PDF, DOCX, and TXT. Images are accepted by the
upload filter but image text extraction is not enabled yet.

## Care-plan generation

`POST /api/careplan/generate` accepts JSON:

```json
{
  "text": "Discharge summary text",
  "language": "English",
  "patientName": "Patient"
}
```

The response includes `plan`, `language`, and `mode` (`AI` or `DEMO`).
