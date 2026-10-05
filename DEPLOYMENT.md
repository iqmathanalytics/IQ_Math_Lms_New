# Deploy IQMath LMS at `https://www.iqmath.in/lms`

This guide ships the React app under **`/lms`** on your existing Cloudflare zone, and the FastAPI API on **Render**.

```text
Browser → www.iqmath.in          (marketing site, unchanged)
       → www.iqmath.in/lms/*     (Cloudflare Worker → Cloudflare Pages)
       → api.iqmath.in/api/v1/*  (DNS → Render FastAPI)
```

Repo pieces prepared for this flow:

| Path | Role |
|------|------|
| [`frontend/vite.config.ts`](frontend/vite.config.ts) | Production `base: '/lms/'` |
| [`frontend/src/App.tsx`](frontend/src/App.tsx) | React Router `basename` from Vite `BASE_URL` |
| [`frontend/public/_redirects`](frontend/public/_redirects) | SPA fallback on Pages |
| [`cloudflare/lms-path-worker.js`](cloudflare/lms-path-worker.js) | Mount Pages at `/lms` |
| [`render.yaml`](render.yaml) | Render Blueprint (`/health`) |
| [`frontend/.env.production.example`](frontend/.env.production.example) | Pages env template |
| [`backend/.env.example`](backend/.env.example) | Includes `CORS_ORIGINS` |

---

## 0. Prerequisites

- Cloudflare account that already serves `www.iqmath.in`
- GitHub repo connected (e.g. `iqmathanalytics/IQ_Math_Lms_New`)
- [Render](https://render.com) account
- Production `DATABASE_URL` (TiDB/MySQL or Postgres)
- Production keys: Razorpay, Firebase, Brevo, Gemini, `SECRET_KEY`, AWS Lambda URL

Push the latest `main` (with these deploy files) before starting the dashboards.

---

## 1. Deploy the API on Render

### 1.1 Create the service

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the GitHub repo and confirm [`render.yaml`](render.yaml).
3. Create the `iqmath-backend` web service.

Or manually:

- **Root directory:** `backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check path:** `/health`

### 1.2 Set environment variables (Render → Environment)

| Key | Value |
|-----|--------|
| `SECRET_KEY` | Long random string (not a placeholder) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` |
| `DATABASE_URL` | Production DB URL |
| `RAZORPAY_KEY_ID` | Live key |
| `RAZORPAY_KEY_SECRET` | Live secret |
| `GEMINI_API_KEY` | Production key |
| `EMAIL_SENDER` | Verified sender |
| `BREVO_API_KEY` | Production key |
| `AWS_LAMBDA_URL` | Compiler Function URL |
| `CORS_ORIGINS` | `https://www.iqmath.in,https://iqmath.in` |

### 1.3 Verify Render

1. Wait until the service is **Live**.
2. Open `https://<service>.onrender.com/health` → `{"status":"ok"}`.
3. Optionally open `/docs` once to confirm routes.

Free-tier services sleep when idle; the first request after sleep can take ~30–60s.

---

## 2. Point `api.iqmath.in` at Render

In **Cloudflare** → zone `iqmath.in` → **DNS**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `<your-service>.onrender.com` | **DNS only** (grey cloud) first |

Notes:

- Grey cloud avoids Cloudflare↔Render SSL mode mistakes during first bring-up.
- After it works, you may orange-cloud the record and use SSL mode **Full (strict)** if you want Cloudflare in front of the API.
- Confirm: `https://api.iqmath.in/health` returns `{"status":"ok"}`.

---

## 3. Deploy the frontend on Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the LMS repo.
3. Build settings:

| Setting | Value |
|---------|--------|
| Framework preset | Vite (or None) |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | `20` (Environment variable `NODE_VERSION=20` if needed) |

4. **Environment variables** (Production) — copy from [`frontend/.env.production.example`](frontend/.env.production.example):

```ini
VITE_API_URL=https://api.iqmath.in/api/v1
VITE_BASE_PATH=/lms/
VITE_RAZORPAY_KEY_ID=...
VITE_RAZORPAY_PAYLINK_URL=https://razorpay.me/iqmathtechnologies
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=iqmath-lms.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=iqmath-lms
VITE_FIREBASE_STORAGE_BUCKET=iqmath-lms.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

5. Deploy and note the URL, e.g. `https://iqmath-lms.pages.dev`.
6. Smoke-test the Pages URL: open `https://iqmath-lms.pages.dev/lms/` (assets use the `/lms/` base). Deep links work via `_redirects` after the Worker is attached to `www`.

---

## 4. Mount Pages at `www.iqmath.in/lms` (Worker)

Do **not** replace the marketing site custom domain. Attach a Worker only on `/lms*`.

1. Cloudflare → **Workers & Pages** → **Create Worker**.
2. Paste [`cloudflare/lms-path-worker.js`](cloudflare/lms-path-worker.js).
3. **Settings → Variables** → add:

| Name | Value |
|------|--------|
| `LMS_PAGES_ORIGIN` | `https://iqmath-lms.pages.dev` (no trailing slash) |

4. **Triggers → Routes** → Add:

| Route |
|-------|
| `www.iqmath.in/lms*` |
| `iqmath.in/lms*` (optional, if apex should also serve LMS) |

5. Deploy the Worker.

Optional CLI (from repo):

```bash
cd cloudflare
cp wrangler.toml.example wrangler.toml
# edit LMS_PAGES_ORIGIN / routes
npx wrangler deploy
```

### How the Worker maps paths

| Browser asks | Worker fetches from Pages |
|--------------|---------------------------|
| `/lms` or `/lms/` | `/` |
| `/lms/login` | `/login` → SPA `index.html` if 404 |
| `/lms/assets/...` | `/assets/...` |

Marketing paths (`/`, `/about`, etc.) never hit this Worker.

---

## 5. Third-party consoles

### Firebase (`iqmath-lms`)

Authentication → Settings → **Authorized domains** → add:

- `www.iqmath.in`
- `iqmath.in`
- your `*.pages.dev` host (for previews)

### Razorpay

- Use **live** keys in Render + Pages for production.
- Any success/cancel URLs should use `https://www.iqmath.in/lms/...`.

### Brevo

- Confirm `EMAIL_SENDER` is a verified sender/domain.

---

## 6. Go-live verification checklist

1. `https://www.iqmath.in` — marketing site unchanged.
2. `https://www.iqmath.in/lms` — LMS landing loads; Network shows assets under `/lms/assets/...`.
3. Hard refresh `https://www.iqmath.in/lms/login` — no blank 404.
4. Login request goes to `https://api.iqmath.in/api/v1/login`.
5. No CORS errors in the browser console.
6. Certificate PDF download works.
7. Course player + Razorpay smoke-test.
8. `https://api.iqmath.in/health` → `{"status":"ok"}`.

---

## 7. Local development (unchanged path)

Local Vite defaults to `base: '/'` so you keep using `http://127.0.0.1:5173/`.

```bash
# frontend
cd frontend
npm install
npm run dev

# backend
cd backend
# set backend/.env (CORS_ORIGINS can be empty for "*")
uvicorn main:app --reload
```

To preview the production subpath locally:

```bash
cd frontend
set VITE_BASE_PATH=/lms/
npm run build
npm run preview
# open http://127.0.0.1:4173/lms/
```

---

## 8. Common issues

| Symptom | Fix |
|---------|-----|
| Assets 404 under `/lms` | Confirm Pages build used `VITE_BASE_PATH=/lms/` and Worker `LMS_PAGES_ORIGIN` is correct |
| Deep link 404 on www | Worker route must be `www.iqmath.in/lms*` (with asterisk) |
| CORS blocked | Set `CORS_ORIGINS=https://www.iqmath.in,https://iqmath.in` on Render and redeploy |
| API SSL error on `api.` | Use DNS-only CNAME first; Render provides HTTPS on `*.onrender.com` |
| Firebase OTP fails | Add `www.iqmath.in` to Firebase authorized domains |
| Cold start timeout | Upgrade Render plan or warm the service; free tier sleeps |

---

## 9. Rollback

1. Remove or disable the Worker route `www.iqmath.in/lms*` → marketing site unaffected.
2. Suspend/delete the Render service if needed.
3. DNS: remove `api` CNAME when retiring the API hostname.
