# Aurora Finetune Demo — Frontend

Interactive React app for exploring how training data size affects Aurora weather model predictions. Visualizes loss curves, prediction heatmaps, and comparisons against ground truth and persistence baselines.

## What It Shows

**Input Controls** — Select training dataset size (1 week / 2 months / 6 months), weather variable, training epoch (0–8), and validation sample index.

**Loss Curves Panel** — Side-by-side training and validation MAE over epochs, with a persistence baseline reference line.

**Heatmap Panel** — Three geographic heatmaps comparing the finetuned model's prediction, the persistence baseline, and ground truth observations. All share a synchronized color scale.

## Tech Stack

- **React 19** + TypeScript
- **Vite** for builds
- **Plotly.js** via react-plotly.js for charts and heatmaps
- **Tailwind CSS** for styling
- **Nginx** for production serving and API proxying

## Running Locally

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. API requests go to relative paths (`/api/...`), so you'll need the backend running on port 8000. Add a proxy to `vite.config.ts` for local development:

```ts
server: {
  proxy: { '/api': 'http://localhost:8000' }
}
```

## Production Architecture

In production, Nginx serves the built static files and proxies `/api/` requests to the backend:

```
Browser → Nginx (:80)
             ├── /          → static files (React SPA)
             └── /api/*     → proxy to backend (:8000)
```

The backend host is injected at container startup via the `BACKEND_SERVICE` environment variable, which gets substituted into `nginx.conf.template` using `envsubst`.

## Docker

```bash
# Build
docker build -t aurora-finetune-frontend .

# Run (BACKEND_SERVICE is required)
docker run -p 80:80 -e BACKEND_SERVICE=aurora-backend aurora-finetune-frontend
```

`BACKEND_SERVICE` should be the hostname (or hostname:port) of the backend container. Nginx proxies `/api/` requests to `http://${BACKEND_SERVICE}:8000`.

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx       # Main component — controls, loss curves, heatmaps
│   ├── api.ts        # Typed API client functions
│   ├── config.ts     # API base URL config
│   ├── main.tsx      # React DOM entry point
│   └── index.css     # Tailwind imports
├── nginx.conf.template   # Nginx config with backend proxy
├── Dockerfile            # Multi-stage build (node → nginx)
├── package.json
└── vite.config.ts
```
