# CareBridge Architecture

```text
                    ┌──────────────────────────┐
                    │        PATIENT            │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ React + Vite Frontend    │
                    │ Upload / Paste / UI       │
                    └────────────┬─────────────┘
                                 │ HTTPS / REST
                                 ▼
                    ┌──────────────────────────┐
                    │ Node.js + Express API     │
                    │ Validation + extraction   │
                    └──────┬─────────┬─────────┘
                           │         │
                  document │         │ structured prompt
                           ▼         ▼
                 ┌─────────────┐  ┌───────────────┐
                 │ PDF/DOCX    │  │ Gemini Flash  │
                 │ extraction  │  │ optional AI   │
                 └──────┬──────┘  └───────┬───────┘
                        │                  │
                        └────────┬─────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │ Structured Care Plan     │
                    │ medicines / warnings /   │
                    │ follow-up / lifestyle    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Patient-friendly UI       │
                    │ + reminder creation      │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ MongoDB Atlas (optional)  │
                    └──────────────────────────┘
```

## Key safety boundary

The system simplifies and structures supplied instructions. It should not:
- invent a medication
- change a dose
- diagnose a condition
- replace a clinician
- silently override the source document

All generated output should be shown as a draft requiring verification.
