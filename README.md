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
| `JWT_SECRET` | yes | Long random string for login tokens |
| `CORS_ORIGINS` | yes in production | Frontend URL(s), comma-separated |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | Shared cache that survives restarts |

### Admin access

Admin is a role on a normal account. Sign up on the website, then from `backend/`:

```bash
npm run make-admin -- someone@example.com            # grant
npm run make-admin -- someone@example.com --remove   # revoke
npm run make-admin -- --list                         # list admins
```

Sign in at `/admin-login`.

## Deploy (Render)

**Backend – Web Service**
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment: all backend variables above; set `CORS_ORIGINS` to the
  frontend's URL.

**Frontend – Static Site**
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_URL` = the backend's URL
- Rewrite rule: `/*` → `/index.html` (so page refreshes work with React Router)

In MongoDB Atlas, allow network access from Render (e.g. `0.0.0.0/0`).

## Limits to know

- Gemini free tier: 15 requests/minute. The backend queues calls to stay
  under it; a search or products page uses about 3 calls.
- Serper: each chat search uses about 8 credits and each products page about
  11. Results are cached for 6 hours.
- Prices in the comparison are read from search results and can lag the
  store; users are asked to confirm on the store.
