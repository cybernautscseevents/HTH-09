# CareBridge — AI Discharge Care Plan

Hackatopia 2026 — HC-01: Discharge Summary to Patient Care Plan

CareBridge converts a hospital discharge summary or prescription into a simple,
patient-friendly care plan with:
- condition explanation
- medicine schedule
- warning signs
- follow-up dates
- reminders
- multilingual output
- doctor-review disclaimer

## Stack

Frontend:
- React + Vite
- Axios
- Lucide React
- Custom responsive CSS

Backend:
- Node.js + Express
- Multer
- PDF parsing
- DOCX parsing
- Gemini API (optional)
- MongoDB (database-backed accounts, care plans, history and reminders)

## Run

### 1. Backend
```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from the sample only if it does not already exist. In Windows PowerShell:
```bash
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

On Linux/macOS: `test -f .env || cp .env.example .env`. If `.env` already exists, preserve it and add/update the required MongoDB settings.

Backend: http://localhost:5000

### 2. Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Environment variables

Backend `.env`:
```env
PORT=
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=dischara
AUTH_SECRET=
```

The AI care-plan generator has a deterministic demo fallback without Gemini. MongoDB is required for account sign-in and cloud persistence.

Set `MONGODB_URI`, `MONGODB_DB`, and a unique `AUTH_SECRET` (at least 32 characters) in `backend/.env`. Keep this file private; never put MongoDB credentials in frontend environment variables. The MongoDB service or Atlas cluster must be reachable from the backend.

The app can still:
- use existing device data while MongoDB is unavailable (cloud sign-in requires MongoDB)
- paste the sample discharge text
- generate a structured care plan using the deterministic fallback parser

New registrations store a salted password hash in MongoDB. Patient history, reminders and the current care plan are scoped to the authenticated account. Existing device-only data is copied to the account the first time it signs in, when that account has no saved data yet.

For the strongest hackathon demo, add a Gemini API key.

## Deployment

See [the Vercel, Render, and MongoDB Atlas deployment guide](docs/DEPLOYMENT.md).
The frontend uses `VITE_API_URL` (see `frontend/.env.example`) to reach the
backend; keep MongoDB, Gemini, and `AUTH_SECRET` values on the backend only.

## Demo flow

1. Open dashboard.
2. Click "Create care plan".
3. Upload/paste a discharge summary.
4. Choose patient language.
5. Generate.
6. Review medicine timeline, warning signs and follow-up.
7. Add a reminder.
8. Open the patient-friendly view.
9. Explain that AI output is a draft and must be clinically reviewed.

## Healthcare safety

CareBridge is a decision-support and patient-education prototype. It does not
diagnose disease, change prescriptions, or replace a clinician. Medication
instructions are extracted/simplified from the supplied document and should be
verified against the original prescription.
