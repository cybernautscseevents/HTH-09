# API quick reference

GET /api/health
- Health check.

POST /api/extract
- multipart/form-data
- field: document
- supports PDF, DOCX, TXT and images.

POST /api/careplan/generate
JSON:
{
  "text": "...",
  "language": "English",
  "patientName": "Rahul Kumar"
}

POST /api/reminders
JSON:
{
  "patientName": "Rahul Kumar",
  "medicine": "Amoxicillin 500 mg",
  "date": "2026-10-08",
  "time": "08:00",
  "frequency": "Three times daily"
}

GET /api/reminders
- Returns saved reminders.
