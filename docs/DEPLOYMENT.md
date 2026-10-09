# Deploy CareBridge to Netlify

The existing Vite frontend and Express API deploy as one Netlify site. The API
continues to use its existing `/api/...` routes through a Netlify Function.

## Before deploying

Create or select a Netlify site connected to this GitHub repository and branch
`main`. Add the site's environment variables in Netlify before production
deploy.

## Build settings

The root `netlify.toml` contains these settings:

- Build command: `npm ci --prefix backend && npm ci --prefix frontend && npm run build --prefix frontend`
- Publish directory: `frontend/dist`
- Functions directory: `backend/netlify/functions`
- Node.js: 22
- API rewrite: `/api/*` to the Express function, preserving the current API routes

## Netlify environment variables

In **Project configuration > Environment variables**, configure these for
Functions/Production:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | A currently valid Gemini API key; set as a secret |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `MONGODB_URI` | MongoDB Atlas driver URI; set as a secret |
| `MONGODB_DB` | `dischara` |
| `AUTH_SECRET` | A unique random secret at least 32 characters; set as a secret |
| `CLIENT_URL` | The production Netlify site origin, such as `https://your-site.netlify.app` |

`VITE_API_URL=/api` is configured in `netlify.toml` for the Vite production
build. Do not set backend secrets as `VITE_` variables; those are included in
browser code. The function uses Netlify's temporary directory for uploaded
files and requires MongoDB Atlas to be reachable from Netlify Functions.

## Deploy and verify

After environment variables are configured, run a production deploy. Check
`https://<your-site>.netlify.app/api/health`; it should report MongoDB and AI
configuration. Then verify login, `POST /api/careplan/generate`, document
extraction, reminders, and care-plan history.

## Netlify Function constraints

Netlify synchronous functions have a 60-second execution limit and a 6 MB
buffered request/response limit. Binary uploads are base64 encoded, so their
effective request limit is about 4.5 MB. The existing backend accepts files up
to 15 MB, so uploads above Netlify's request limit cannot reach Express without
a separate direct-to-object-storage upload flow. Keep this in mind when using
large discharge files.
