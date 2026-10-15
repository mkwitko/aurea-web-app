# AUREA Web — Run & Deploy

Vite + React + TypeScript SPA. Talks to the `aurea-api` API. Deployed on
**Cloudflare Pages**.

---

## 1. Run locally

```bash
pnpm install
cp .env.example .env                 # VITE_API_URL=http://localhost:3337
pnpm dev                             # http://localhost:5173
```

The API (`aurea-api`) must be running for auth to work.

---

## 2. Deploy to Cloudflare Pages

The app is a static build; Cloudflare serves it globally over its CDN with
free TLS. SPA routing is handled by `public/_redirects`.

### Option A — Git integration (recommended)

1. Push this repo to GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo. Build settings:
   - **Framework preset:** None (or Vite)
   - **Build command:** `pnpm install && pnpm build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
4. **Environment variables** → add:
   - `VITE_API_URL = https://api.yourdomain.com`
   - `NODE_VERSION = 22`
5. Deploy. Every push to the production branch redeploys automatically.

### Option B — Wrangler CLI (manual)

```bash
pnpm build
npx wrangler pages deploy dist --project-name aurea-web-app
```

Set `VITE_API_URL` at build time (it is inlined into the bundle):

```bash
VITE_API_URL=https://api.yourdomain.com pnpm build
npx wrangler pages deploy dist --project-name aurea-web-app
```

---

## 3. Custom domain

Cloudflare Pages → the project → **Custom domains** → add
`app.yourdomain.com`. Because DNS is on Cloudflare, TLS + routing are automatic.

---

## 4. Wire to the API (important)

- `VITE_API_URL` must point at the deployed API (`https://api.yourdomain.com`).
- On the API side, set `CORS_ORIGIN` to this app's URL
  (e.g. `https://app.yourdomain.com`) or the browser will block requests.
- `VITE_*` vars are **build-time** and end up in the public bundle — never put
  secrets there.

---

## 5. SPA routing

`public/_redirects` contains `/* /index.html 200` so client-side routes
(`/goals`, `/experiments`, …) resolve on refresh. Vite copies it into `dist`.
