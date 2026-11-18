# SmartBuy AI

An AI shopping assistant for India. Tell it what you need and your budget; it
picks products from **live Google Shopping listings** and compares prices
across stores (Amazon, Flipkart, Croma, Reliance Digital, and more), with a
direct link to each store.

## Features

- **AI Assistant** – chat in plain words ("gaming laptop under ₹80,000"); the AI
  picks the best matches and explains each pick. Signed-in users only; every
  chat is saved to history (sidebar grouped by date).
- **Live price comparison** – each product shows prices from several stores,
  cheapest first, with the lowest marked.
- **Products** – 8 main categories (Electronics, Home Appliances, Furniture,
  Home Essentials, Kitchen & Dining, Fashion, Beauty & Personal Care,
  Sports & Fitness) with 68 product types.
- **Accounts** – email + password sign-up (bcrypt + JWT).
- **Admin dashboard** – searches per day, categories, most recommended
  products, searches with no results, users, chats and Serper credits.
- Light/dark theme, responsive layout.

## Tech stack

| Part | Stack |
|---|---|
| Frontend (`frontend/`) | React 19, Vite, React Router, lucide-react |
| Backend (`backend/`) | Node.js, Express 5 |
| AI | Google Gemini (`gemini-3.5-flash-lite`, free tier) |
| Live prices | [Serper](https://serper.dev) (Google Shopping + web search) |
| Database | MongoDB Atlas (Mongoose) |
| Cache | Upstash Redis (falls back to memory) |

## Run locally

Requires Node.js 20+.

```bash
# Backend
cd backend
cp .env.example .env      # then fill in the keys (see below)
npm install
npm start                 # http://localhost:5000

# Frontend (second terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

The frontend reads the API address from `VITE_API_URL`
(`frontend/.env.development` points it at `http://localhost:5000`).

### Backend environment variables

See [`backend/.env.example`](backend/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `SERPER_API_KEY` | yes | Live Google Shopping prices |
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | Random secret of at least 32 bytes for HS256 login tokens |
| `CORS_ORIGINS` | yes in production | Frontend URL(s), comma-separated |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | Shared cache that survives restarts |

### Backend security baseline

- Keep `JWT_SECRET` private and at least 32 random bytes. Generate it with the
  command in `backend/.env.example`; changing it invalidates existing login
  tokens.
- Passwords must be 8–128 characters. The backend SHA-256-prehashes them
  before bcrypt so passwords are not silently truncated at bcrypt's 72-byte limit;
  legacy bcrypt hashes are upgraded at the next successful login.
- JSON request bodies are capped at 20 KB; Helmet security headers and an
  explicit frontend-origin CORS allowlist are enabled.
- Authentication, search and API requests have IP/user rate limits. The
  built-in rate-limit counters are per backend process; use a shared rate-limit
  store before running multiple API replicas.

### Admin access

Admin is a role on a normal account. Sign up on the website, then from `backend/`:

```bash
npm run make-admin -- someone@example.com            # grant
npm run make-admin -- someone@example.com --remove   # revoke
npm run make-admin -- --list                         # list admins
```

Sign in at `/admin-login`.

## Deploy (Render)

The repository includes a Render Blueprint in `render.yaml`.

**Backend – Web Service**
- Root directory: `backend`
- Runtime: Node.js 20
- Build command: `npm ci --omit=dev`
- Start command: `npm start`
- Health check: `/api/health/ready`
- Configure `GEMINI_API_KEY`, `SERPER_API_KEY`, optional `SERPER_API_KEY_2`
  and `SERPER_API_KEY_3`, `MONGODB_URI`, `JWT_SECRET`, and `CORS_ORIGINS`.
- Serper keys are tried in order; an exhausted or unauthorized key is skipped
  and the next configured key is used automatically.
- `MONGODB_DB` is optional; it defaults to `smartbuy`.
- Configure the optional Upstash REST URL and token together to use the shared cache.

**Frontend – Static Site**
- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` to the public backend URL, for example
  `https://your-backend-service.onrender.com`.
- Rewrite `/*` to `/index.html` so React Router routes work on refresh.

**MongoDB Atlas network and database access**
- In the Render backend service, open **Connect → Outbound** and copy every
  IPv4 CIDR range displayed for the service's region.
- Add those CIDR ranges to the Atlas project's **Security → Network Access**
  IP Access List. Keep the ranges in sync if Render changes the service region
  or its published outbound ranges.
- Do **not** use `0.0.0.0/0` for production database access.
- Use a dedicated application database user with the `readWrite` role on
  `smartbuy` only. Do not put an `atlasAdmin` database user's credentials
  in the backend's `MONGODB_URI`; reserve administrative access for operators.
- Keep a separate backup and restore plan. Backup availability depends on the
  Atlas cluster tier and the backup options enabled for the project.

## Limits to know

- Gemini free tier: 15 requests/minute. The backend queues calls to stay
  under it; a search or products page uses about 3 calls.
- Serper usage varies with the number of product categories, products
  compared and cache hits. Volatile shopping listings, merchant pages, offers
  and final search answers are cached for 15 minutes; product specifications
  are cached for 6 hours and gallery images for 24 hours.
- Prices in the comparison are retrieved from search-result data, not a
  guaranteed live merchant feed. They can lag the store; users should confirm
  the final price and product variant on the merchant site.
