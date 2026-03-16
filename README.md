# Sentinel | Data Governance Suite

A FastAPI + React data governance application for Keboola telemetry analytics.

## Pages

| Page | Description |
|------|-------------|
| **ROI Analysis** | Flow cost attribution, credits, success rates, data change insights |
| **Asset Inventory** | Table health monitoring, staleness tracking, shared table registry |
| **Impact Analysis** | Schema change dependency graph — upstream/downstream lineage |

## Stack

- **Backend** — FastAPI + uvicorn, `httpx` for Keboola Query Service, `cachetools` TTL cache (5 min)
- **Frontend** — React 18 + Vite, Tailwind CSS, Recharts, Lucide icons
- **Deployment** — Keboola Python/JS Data App (`keboola-config/` structure)

## Environment variables

| Variable | Description |
|----------|-------------|
| `KBC_TOKEN` | Keboola Storage API token (or `Bearer …`) |
| `KBC_URL` | e.g. `https://connection.us-east4.gcp.keboola.com` |
| `BRANCH_ID` | Keboola branch ID |
| `WORKSPACE_ID` | Snowflake workspace ID |

## Keboola Data App deployment

This app follows the Keboola Python/JS data app structure:

```
keboola-config/
├── setup.sh                        ← runs on deploy: npm build + uv sync
├── nginx/sites/default.conf        ← proxies port 8888 → 5000
└── supervisord/services/app.conf   ← starts uvicorn on port 5000
```

**Steps:**
1. Push this repository to GitHub
2. In Keboola → **Data Apps** → select the app → set source to this GitHub repo
3. Add environment variables: `KBC_TOKEN`, `KBC_URL`, `BRANCH_ID`, `WORKSPACE_ID`
4. Deploy — Keboola runs `setup.sh` then starts the app via supervisord

## Local development

```bash
# Backend
pip install uv
uv sync
uv run uvicorn app.main:app --reload --port 5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # Vite dev server on :5173, proxies /api → :5000
```

Open http://localhost:5173

## Local Docker (optional, not used by Keboola)

```bash
docker build -t sentinel .
docker run -p 5000:5000 \
  -e KBC_TOKEN=... \
  -e KBC_URL=... \
  -e BRANCH_ID=... \
  -e WORKSPACE_ID=... \
  sentinel
```
