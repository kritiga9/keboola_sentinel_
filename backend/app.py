import math
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.data import (
    build_lineage_index,
    get_all_tables,
    get_cost_per_flow_data,
    get_governance_data,
    get_organizations_data,
    get_project_id_mapping,
    get_project_names,
    get_stacks,
    get_table_url,
)

app = FastAPI(title="Sentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Stacks ────────────────────────────────────────────────────────────────────

@app.get("/api/stacks")
def stacks():
    return get_stacks()


# ── Organizations ─────────────────────────────────────────────────────────────

@app.get("/api/organizations")
def organizations(stack: Optional[str] = None):
    df = get_organizations_data(stack)
    if df.empty:
        return []
    return sorted(df["kbc_organization"].dropna().unique().tolist())


# ── ROI ───────────────────────────────────────────────────────────────────────

@app.get("/api/roi")
def roi(
    org: str = "All Organizations",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    df = get_cost_per_flow_data(start_date, end_date, org)
    if df.empty or df["total_credits"].sum() == 0:
        return {"flows": []}

    flows = []
    for _, row in df.iterrows():
        flows.append({
            "flow_name": str(row.get("flow_name", "")),
            "use_case": str(row.get("use_case", "")),
            "total_credits": _safe_float(row.get("total_credits", 0)),
            "run_count": int(row.get("run_count", 0)),
            "avg_credits_per_run": _safe_float(row.get("avg_credits_per_run", 0)),
            "total_data_mb": _safe_float(row.get("total_data_mb", 0)),
            "avg_data_per_run_mb": _safe_float(row.get("avg_data_per_run_mb", 0)),
            "total_tasks": int(row.get("total_tasks", 0)),
            "successful_tasks": int(row.get("successful_tasks", 0)),
            "failed_tasks": int(row.get("failed_tasks", 0)),
            "data_change_rate": _safe_float(row.get("data_change_rate", 0)),
            "runs_with_data_change": int(row.get("runs_with_data_change", 0)),
        })
    return {"flows": flows}


# ── Asset Inventory ───────────────────────────────────────────────────────────

@app.get("/api/inventory")
def inventory(org: str = "All Organizations"):
    try:
        df = get_governance_data(org)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if df.empty:
        return {"tables": []}

    project_names = get_project_names(org)
    project_id_mapping = get_project_id_mapping()

    tables = []
    for _, row in df.iterrows():
        project_id_str = str(row.get("project_id", ""))
        kbc_pid = project_id_mapping.get(project_id_str, "")
        tables.append({
            "id": str(row.get("id", "")),
            "table_name": str(row.get("table_name", "")),
            "project_id": project_id_str,
            "project_name": project_names.get(project_id_str, project_id_str),
            "health": str(row.get("health", "")),
            "hours_stale": int(row.get("hours_stale", 99999)),
            "is_shared": bool(row.get("is_shared", False)),
            "rows": int(row.get("rows", 0)),
            "bytes": _safe_float(row.get("bytes", 0)),
            "table_url": get_table_url(str(row.get("id", "")), str(kbc_pid)) or "",
        })
    return {"tables": tables}


# ── Impact Analysis ───────────────────────────────────────────────────────────

@app.get("/api/impact/tables")
def impact_tables(org: str = "All Organizations"):
    try:
        df = get_all_tables(org)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if df.empty:
        return []
    return sorted(df["name"].dropna().unique().tolist())


@app.get("/api/impact/analysis")
def impact_analysis(table: str, org: str = "All Organizations"):
    lineage = build_lineage_index(org)
    matching = []
    for key, configs in lineage.items():
        if table in key or key.endswith(f".{table}"):
            matching.extend(configs)

    seen: set = set()
    unique = []
    for c in matching:
        k = (c["config_id"], c["direction"])
        if k not in seen:
            seen.add(k)
            unique.append(c)

    readers = [c for c in unique if c["direction"] == "input"]
    writers = [c for c in unique if c["direction"] == "output"]
    affected = set()
    for r in readers:
        for t in r.get("output_tables", []):
            if t and t != table:
                affected.add(t)

    return {
        "readers": readers[:8],
        "writers": writers[:8],
        "affected_tables": list(affected),
        "total_dependencies": len(unique),
    }


# ── Util ──────────────────────────────────────────────────────────────────────

def _safe_float(v) -> float:
    try:
        f = float(v)
        return 0.0 if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return 0.0
