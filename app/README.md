# STEP lab platform — frontend

React single-page app for the STEP Laboratory's internal platform: chemical inventory, experiments and templates, datasets, and the group's publication records. It talks to the Express API in [`../api`](../api).

Served from `/app/*`. The public Jekyll site links to it through `site.app_url` in `_config.yml`.

## Stack

React 18 · Vite 5 · React Router 6 (`BrowserRouter`) · CSS Modules · `lucide-react` icons · `marked` for Markdown rendering · `xlsx` for spreadsheet import and export.

Authentication is a JWT held in `localStorage` and attached as a `Bearer` header by `src/api/client.js`. `AuthContext` exposes the current user to the tree.

## Running locally

The API must be running first — see [`../api/README.md`](../api/README.md).

```bash
cd app
npm install
npm run dev
```

Vite serves at `http://localhost:5173` and proxies `/api` to `http://localhost:3001`, so no environment variable is needed in development.

| Script | Does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the built output locally |

### Environment

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `/api` | Absolute API URL for production, where frontend and backend are on different hosts |

## Layout

```
src/
  App.jsx              route table
  api/client.js        fetch wrapper — base URL, JWT header, error unwrapping
  context/AuthContext  current user, login and logout
  layouts/             AppLayout (shell and nav), InventoryLayout
  components/          ConfirmModal, DatasetSection, MarkdownBody
  pages/
    Login, Register, Dashboard, Profile, UserActivity, AdminUsers
    experiments/       list, form, detail
    templates/         list, form
    resources/         list, form, container detail, bulk import
    publications/      list, form, detail, Web of Science import
  utils/
    pubchem.js         compound lookup by name or CAS
    thermoml.js        ThermoML export for datasets
```

Routes are `/app/login`, `/app/register`, `/app/dashboard`, `/app/experiments`, `/app/templates`, `/app/resources`, `/app/publications`, `/app/profile`, and `/app/admin/users`.

## Deployment

Netlify, configured in [`../netlify.toml`](../netlify.toml): base directory `app`, build `npm ci && npm run build`, publish `dist`, Node 20. A catch-all redirect returns `index.html` so client-side routing works on refresh and deep links.

Set `VITE_API_URL` in the Netlify environment to the deployed API URL.
