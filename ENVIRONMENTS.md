# MenyAI – Environment variables by app

Use this as a checklist for **local development** and **deployed** environments.

---

## Deployed URLs

| App | URL | Backend |
|-----|-----|---------|
| **Admin panel** | https://admin-menyai.netlify.app/ | Uses `VITE_API_URL` (set in Netlify to backend URL). Log in with password = `ADMIN_SECRET` on Render. |
| **Backend API** | https://menyai-nslw.onrender.com | Health: `GET /health`. Admin: `X-Admin-Key` header = `ADMIN_SECRET`. |
| **Mobile (web)** | `http://localhost:8081` (dev) | Set `EXPO_PUBLIC_API_URL` to backend URL for production builds. |

**How admin and mobile get real data:** The admin panel does **not** talk to the mobile app. Both talk to the **same backend API**, which uses **Firebase** (Firestore + Auth) as the single source of truth. When learners use the mobile app (lessons, progress, auth), the backend writes to Firebase. When admins use the panel (Dashboard, Lessons, Users, Progress, Reports, AI Monitoring), the backend reads the same Firebase data. So the admin always sees real, live data — as long as both admin and mobile use the same backend URL (e.g. `https://menyai-nslw.onrender.com` in production).

---

## Root (project root)

| Variable | Local | Deployed | Notes |
|----------|--------|----------|--------|
| *(optional)* | — | — | Use only if you need shared vars (e.g. Firebase for tooling). Most config lives in `backend/` and `mobile/`. |

---

## Backend (`backend/`)

Create `backend/.env` from `backend/.env.example`. **Do not commit `backend/.env`.**

| Variable | Local | Render (deployed) | Notes |
|----------|--------|-------------------|--------|
| `PORT` | `4000` | Set by Render (or `4000`) | Server port. |
| `DEPLOYED_BACKEND_URL` | `https://menyai-nslw.onrender.com` | Same URL | Used by scripts when `BASE_URL` is not set. |
| **Firebase (use one of)** | | | Required for lessons, progress, auth. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to JSON key file | *(not used on Render)* | e.g. `C:/Users/.../menyai-27cfc-firebase-adminsdk-....json` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | *(optional)* | **Required** | One-line JSON of service account. In Render: Environment → add variable, paste JSON. |
| **OpenAI (optional)** | | | For AI tutor (MenyAI Umufasha). |
| `OPENAI_API_KEY` | `sk-...` | Same | From OpenAI dashboard. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Same | Model name. |
| **Admin** | | | For admin panel and X-Admin-Key. |
| `ADMIN_SECRET` | e.g. `123` (dev) | Strong random secret | Use a strong secret in production. |

**Local:** Use `GOOGLE_APPLICATION_CREDENTIALS` pointing to your downloaded Firebase service account JSON.  
**Render:** Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the full one-line JSON (no file path).

---

## Mobile (`mobile/`)

Create `mobile/.env` from `mobile/.env.example`. Rebuild after changes (`npx expo start -c` or new APK/IPA build).

| Variable | Local (emulator) | Production build / device | Notes |
|----------|------------------|---------------------------|--------|
| `EXPO_PUBLIC_API_URL` | Unset or `http://10.0.2.2:4000` (Android emulator) | `https://menyai-nslw.onrender.com` | Backend API base URL. If unset, app uses `localhost:4000` or `10.0.2.2:4000` (Android emulator). |

**Local:** Omit or set to your local backend URL if not using default.  
**Production/APK:** Set to your deployed backend URL (e.g. Render).

---

## Admin panel (`admin-panel/`)

Create `admin-panel/.env` from `admin-panel/.env.example`. For Netlify, set in Site → Environment variables.

| Variable | Local | Netlify (deployed) | Notes |
|----------|--------|--------------------|--------|
| `VITE_API_URL` | `https://menyai-nslw.onrender.com` or `http://localhost:4000` | `https://menyai-nslw.onrender.com` | Backend API URL. |
| `VITE_BASE_PATH` | *(optional)* | *(optional)* | Only if app is served under a subpath (e.g. `/admin/`). |

---

## Script-only variables (no .env by default)

Used when running backend scripts (e.g. test submit, progress):

| Variable | When to set | Example |
|----------|-------------|---------|
| `BASE_URL` | Override API URL for scripts | `https://menyai-nslw.onrender.com` |
| `SUBMIT_TEST_TOKEN` or `PROGRESS_TEST_TOKEN` | Testing lesson submit / progress | Firebase ID token from app |
| `LESSON_ID` | Test a specific lesson | `CUETtYGNZuPOb7vIh5Vk` |

Example:

```bash
cd backend
SUBMIT_TEST_TOKEN="<id-token>" BASE_URL=https://menyai-nslw.onrender.com node scripts/test-ai-and-one-course.js
```

---

## Quick checklist

- **Backend local:** `PORT`, `GOOGLE_APPLICATION_CREDENTIALS` (or `FIREBASE_SERVICE_ACCOUNT_JSON`), optional `OPENAI_API_KEY`, `ADMIN_SECRET`
- **Backend (Render):** `FIREBASE_SERVICE_ACCOUNT_JSON`, optional `OPENAI_API_KEY`, `ADMIN_SECRET`
- **Mobile local:** Leave `EXPO_PUBLIC_API_URL` unset or set to local backend
- **Mobile production:** `EXPO_PUBLIC_API_URL=https://menyai-nslw.onrender.com`
- **Admin panel:** `VITE_API_URL` pointing to your backend
