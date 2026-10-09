# Deployment guide

Deploy the frontend to Vercel, the Express API to Render, and persist application
data in MongoDB Atlas. Gemini remains the existing care-plan provider.

## 1. Rotate exposed credentials

The Gemini API key and authentication secret were exposed during development.
Revoke the old Gemini key in Google AI Studio and create a replacement. Generate
a new random `AUTH_SECRET` (at least 32 characters). Do not paste either value
into source code, Vercel, or chat. Set the replacement key in local
`backend/.env` and in Render's environment settings. Generate a different
`AUTH_SECRET` for Render; replacing a secret invalidates existing login tokens.

## 2. Create MongoDB Atlas database

1. Create an Atlas cluster and a database user with a strong unique password.
2. Add the Render service's outbound IP addresses to the Atlas IP access list.
   If the Render plan does not provide stable outbound IPs, follow Render's
   current static-egress-IP options. Do not open the database to all IPs for a
   production deployment.
3. In Atlas, use **Connect > Drivers** to copy the Node.js connection URI. Replace
   the password placeholder and URL-encode any special characters in the
   database user's password.
4. Use database name `dischara` (or set `MONGODB_DB` consistently). Keep the URI
   private and configure it only on the backend.

The existing MongoDB driver supports Atlas `mongodb+srv://` connection strings.
The backend creates its required user and patient-data indexes at startup.

## 3. Deploy the backend to Render

Create a **Web Service** from the GitHub repository:

- Branch: `main`
- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Set these environment variables in the Render service dashboard:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Exact deployed Vercel origin, e.g. `https://your-app.vercel.app` |
| `GEMINI_API_KEY` | Newly rotated Gemini API key |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `MONGODB_URI` | Atlas driver URI |
| `MONGODB_DB` | `dischara` |
| `AUTH_SECRET` | Newly generated random secret, at least 32 characters |

Render supplies `PORT`; leave it unset in service environment variables. The
server listens on Render's port and on `0.0.0.0`. After deploy, check
`https://<render-service>/api/health` for `database: "MongoDB"` and
`geminiConnected: true`.

## 4. Deploy the frontend to Vercel

Import the repository into Vercel with:

- Root Directory: `frontend`
- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set this environment variable for Production (and Preview if needed):

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://<render-service>/api` |

Redeploy after changing Vercel environment variables. Add the final Vercel
origin to Render's `CLIENT_URL` and redeploy the backend. The backend also
allows the local Vite origins for development; other browser origins are
rejected. Do not put Gemini, MongoDB, or authentication secrets in Vercel
variables. Only `VITE_` values are exposed to browser code.

## 5. Local development

Copy `backend/.env.example` to `backend/.env`; set local MongoDB, a Gemini key,
and a random `AUTH_SECRET`. Copy `frontend/.env.example` to `frontend/.env` if
you need to override the default API URL. The `.env` files are ignored by Git.

## Deployment order

1. Revoke and replace the exposed Gemini key; create fresh authentication secrets.
2. Create Atlas and configure network access and database credentials.
3. Deploy Render with its production environment variables and verify health.
4. Deploy Vercel with `VITE_API_URL` set to the Render API base URL.
5. Set Render `CLIENT_URL` to the final Vercel origin and redeploy Render.
6. Verify registration/login, document extraction, care-plan generation,
   patient-data persistence, reminders, and care-plan history in the deployed app.
