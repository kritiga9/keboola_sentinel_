import json
import threading
from datetime import datetime
from typing import Optional

import pandas as pd
from cachetools import TTLCache

from backend.query import query_data

# ── TTL cache (5 min, matching original Streamlit ttl=300) ────────────────────
_cache: TTLCache = TTLCache(maxsize=64, ttl=300)
_lock = threading.Lock()


def _cached(key: str, fn, *args, **kwargs):
    with _lock:
        if key in _cache:
            return _cache[key]
    result = fn(*args, **kwargs)
    with _lock:
        _cache[key] = result
    return result


# ── Table FQNs ────────────────────────────────────────────────────────────────
TABLES_FQN = '"KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_table"'
PROJECTS_FQN = '"KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_project"'
ORGANIZATIONS_FQN = '"KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_organization"'
CONFIGS_FQN = '"KBC_USE4_37"."out.c-kbc_billing"."kbc_component_configuration"'
JOBS_FQN = '"KBC_USE4_37"."out.c-kbc_billing"."kbc_job"'


COMPONENT_FRIENDLY_NAMES = {
    "ex-salesforce": "Salesforce CRM",
    "ex-hubspot": "HubSpot",
    "ex-google-analytics": "Google Analytics",
    "ex-facebook": "Facebook Ads",
    "ex-google-ads": "Google Ads",
    "ex-db-mysql": "MySQL database",
    "ex-db-postgres": "PostgreSQL database",
    "ex-db-mssql": "SQL Server",
    "ex-db-snowflake": "Snowflake",
    "ex-db-bigquery": "BigQuery",
    "ex-aws-s3": "AWS S3",
    "ex-google-drive": "Google Drive",
    "ex-dropbox": "Dropbox",
    "ex-shopify": "Shopify",
    "ex-stripe": "Stripe payments",
    "ex-zendesk": "Zendesk",
    "ex-jira": "Jira",
    "ex-slack": "Slack",
    "ex-linkedin": "LinkedIn",
    "ex-twitter": "Twitter/X",
    "ex-instagram": "Instagram",
    "ex-mailchimp": "Mailchimp",
    "ex-intercom": "Intercom",
    "ex-pipedrive": "Pipedrive",
    "ex-asana": "Asana",
    "ex-airtable": "Airtable",
    "ex-notion": "Notion",
    "ex-quickbooks": "QuickBooks",
    "ex-xero": "Xero accounting",
    "ex-netsuite": "NetSuite",
    "ex-sap": "SAP",
    "ex-dynamics": "Microsoft Dynamics",
    "ex-http": "REST API",
    "ex-generic": "external API",
    "wr-google-sheets": "Google Sheets",
    "wr-google-drive": "Google Drive",
    "wr-google-bigquery": "BigQuery",
    "wr-snowflake": "Snowflake",
    "wr-redshift": "Redshift",
    "wr-db-mysql": "MySQL",
    "wr-db-postgres": "PostgreSQL",
    "wr-db-mssql": "SQL Server",
    "wr-tableau": "Tableau",
    "wr-looker": "Looker",
    "wr-powerbi": "Power BI",
    "wr-slack": "Slack",
    "wr-email": "email",
    "wr-aws-s3": "AWS S3",
    "wr-dropbox": "Dropbox",
    "wr-salesforce": "Salesforce",
    "wr-hubspot": "HubSpot",
    "snowflake-transformation": "data transformation",
    "python-transformation": "Python processing",
    "r-transformation": "R analysis",
    "dbt-transformation": "dbt models",
    "app-": "data application",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def escape_sql_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    return str(value).replace("'", "''")


def safe_datetime_convert(series: pd.Series) -> pd.Series:
    try:
        result = pd.to_datetime(series, errors="coerce", utc=True)
        return result.dt.tz_convert(None)
    except Exception:
        return pd.Series([pd.NaT] * len(series))


def get_friendly_component_name(component_id: str) -> Optional[str]:
    if not component_id:
        return None
    cid = component_id.lower()
    for key, name in COMPONENT_FRIENDLY_NAMES.items():
        if key in cid:
            return name
    return None


def generate_use_case_summary(config_json_str: Optional[str]) -> str:
    if not config_json_str:
        return "Data pipeline"
    try:
        config = json.loads(config_json_str)
        tasks = config.get("tasks", [])
        if not tasks:
            return "Data pipeline"
        extractors, transformations, writers, apps = [], [], [], []
        for task in tasks:
            cid = task.get("task", {}).get("componentId", "")
            friendly = get_friendly_component_name(cid)
            if not friendly:
                continue
            if "ex-" in cid or "extractor" in cid:
                if friendly not in extractors:
                    extractors.append(friendly)
            elif "wr-" in cid or "writer" in cid:
                if friendly not in writers:
                    writers.append(friendly)
            elif "transformation" in cid:
                if friendly not in transformations:
                    transformations.append(friendly)
            elif "app-" in cid:
                if friendly not in apps:
                    apps.append(friendly)
        if extractors and writers:
            src = extractors[0] if len(extractors) == 1 else f"{len(extractors)} sources"
            dst = writers[0] if len(writers) == 1 else f"{len(writers)} destinations"
            return f"Sync {src} to {dst}" + (" with processing" if transformations else "")
        if extractors:
            if len(extractors) == 1:
                return f"Import data from {extractors[0]}"
            return f"Import from {', '.join(extractors[:2])}" + (f" +{len(extractors)-2} more" if len(extractors) > 2 else "")
        if writers:
            if len(writers) == 1:
                return f"Export data to {writers[0]}"
            return f"Export to {', '.join(writers[:2])}" + (f" +{len(writers)-2} more" if len(writers) > 2 else "")
        if transformations:
            return "Data transformation & processing"
        if apps:
            return "Run data applications"
        return f"Automated workflow ({len(tasks)} tasks)"
    except (json.JSONDecodeError, TypeError, KeyError):
        return "Data pipeline"


def _build_org_join_where(org_filter: Optional[str], table_alias: str = "t") -> tuple[str, str]:
    if not org_filter or org_filter == "All Organizations":
        return "", ""
    escaped = escape_sql_string(org_filter)
    join = f"""
        INNER JOIN {PROJECTS_FQN} p ON {table_alias}."kbc_project_id" = p."kbc_project_id"
        INNER JOIN {ORGANIZATIONS_FQN} o ON p."kbc_organization_id" = o."kbc_organization_id"
    """
    where = f"""AND o."kbc_organization" = '{escaped}'"""
    return join, where


# ── Data loaders ──────────────────────────────────────────────────────────────

def get_stacks() -> list:
    def _load():
        try:
            df = query_data(f"""
                SELECT SPLIT_PART("kbc_organization_url", '/', 3) AS "connection_url",
                       COUNT(*) AS "org_count"
                FROM {ORGANIZATIONS_FQN}
                WHERE "kbc_organization_url" IS NOT NULL AND "kbc_organization_url" != ''
                GROUP BY 1
                ORDER BY 2 DESC
            """)
            if df.empty:
                return []
            return df["connection_url"].dropna().tolist()
        except Exception:
            return []
    return _cached("stacks", _load)


def get_organizations_data(stack: Optional[str] = None) -> pd.DataFrame:
    def _load():
        empty = pd.DataFrame(columns=["kbc_organization_id", "kbc_organization"])
        try:
            if not stack:
                return query_data(f"""
                    SELECT "kbc_organization_id", "kbc_organization"
                    FROM {ORGANIZATIONS_FQN}
                    ORDER BY "kbc_organization"
                """)
            escaped_stack = escape_sql_string(stack)
            return query_data(f"""
                SELECT "kbc_organization_id", "kbc_organization"
                FROM {ORGANIZATIONS_FQN}
                WHERE SPLIT_PART("kbc_organization_url", '/', 3) = '{escaped_stack}'
                ORDER BY "kbc_organization"
            """)
        except Exception:
            return empty

    return _cached(f"orgs:{stack}", _load)


def get_governance_data(org_filter: Optional[str] = None) -> pd.DataFrame:
    def _load():
        join, where_and = _build_org_join_where(org_filter)
        where = f"WHERE 1=1 {where_and}"
        df = query_data(f"""
            SELECT t."table_id" as "id", t."kbc_project_id" as "project_id", t."table_name",
                   t."last_import" as "last_import_date", t."source_table_id" as "sharing",
                   t."rows", t."bytes"
            FROM {TABLES_FQN} t {join} {where} LIMIT 5000
        """)
        if df.empty:
            return df
        df["last_import_date"] = safe_datetime_convert(df["last_import_date"])
        now = datetime.utcnow()
        df["hours_stale"] = df["last_import_date"].apply(
            lambda x: int((now - x).total_seconds() / 3600) if pd.notna(x) else 99999
        )
        df["health"] = df["hours_stale"].apply(
            lambda x: "healthy" if x < 24 else "warning" if x < 72 else "stale"
        )
        df["is_shared"] = df["sharing"].apply(lambda x: x is not None and str(x).strip() != "")
        df["rows"] = pd.to_numeric(df["rows"], errors="coerce").fillna(0).astype(int)
        df["bytes"] = pd.to_numeric(df["bytes"], errors="coerce").fillna(0)
        return df

    return _cached(f"gov:{org_filter}", _load)


def get_project_names(org_filter: Optional[str] = None) -> dict:
    def _load():
        join, where_and = _build_org_join_where(org_filter, "p")
        where = f"WHERE 1=1 {where_and}" if where_and else ""
        df = query_data(f"""
            SELECT p."kbc_project_id", p."kbc_project" as "project_name"
            FROM {PROJECTS_FQN} p {join} {where}
        """)
        if df.empty:
            return {}
        df["project_id"] = df["kbc_project_id"].apply(
            lambda x: str(x).split("_")[0] if pd.notna(x) else None
        )
        return dict(zip(df["project_id"], df["project_name"]))

    return _cached(f"proj_names:{org_filter}", _load)


def get_project_id_mapping() -> dict:
    def _load():
        df = query_data(f"""SELECT "kbc_project_id" FROM {PROJECTS_FQN}""")
        if df.empty:
            return {}
        mapping = {}
        for _, row in df.iterrows():
            full_id = row["kbc_project_id"]
            simple_id = str(full_id).split("_")[0]
            mapping[simple_id] = full_id
        return mapping

    return _cached("proj_id_map", _load)


def get_all_tables(org_filter: Optional[str] = None) -> pd.DataFrame:
    def _load():
        join, where_and = _build_org_join_where(org_filter)
        where = f"WHERE 1=1 {where_and}"
        df = query_data(f"""
            SELECT t."table_id" as "id", t."table_name" as "name", t."kbc_project_id" as "project_id"
            FROM {TABLES_FQN} t {join} {where} LIMIT 5000
        """)
        if not df.empty:
            return df
        # Fallback: derive table names from configuration JSON (uses billing data)
        configs_df = get_configurations_with_mappings(org_filter)
        if configs_df.empty:
            return pd.DataFrame(columns=["id", "name", "project_id"])
        tables: set = set()
        for _, row in configs_df.iterrows():
            config_json = row.get("configuration_json", "")
            if not config_json or pd.isna(config_json):
                continue
            try:
                storage = json.loads(config_json).get("storage", {})
                for t in storage.get("input", {}).get("tables", []):
                    src = t.get("source", "")
                    if src:
                        tables.add(src)
                for t in storage.get("output", {}).get("tables", []):
                    dst = t.get("destination", "")
                    if dst:
                        tables.add(dst)
            except (json.JSONDecodeError, TypeError, AttributeError):
                continue
        if not tables:
            return pd.DataFrame(columns=["id", "name", "project_id"])
        rows = [
            {"id": t, "name": t.split(".")[-1] if "." in t else t, "project_id": ""}
            for t in sorted(tables)
        ]
        return pd.DataFrame(rows)

    return _cached(f"tables:{org_filter}", _load)


def get_configurations_with_mappings(org_filter: Optional[str] = None) -> pd.DataFrame:
    def _load():
        join, where_and = _build_org_join_where(org_filter, "c")
        df = query_data(f"""
            SELECT c."kbc_component_configuration_id", c."kbc_component_configuration" as "config_name",
                   c."kbc_component_id", c."kbc_component" as "component_name", c."kbc_component_type",
                   c."kbc_project_id", c."configuration_json"
            FROM {CONFIGS_FQN} c {join}
            WHERE c."configuration_json" IS NOT NULL AND c."configuration_json" != ''
              AND c."kbc_configuration_is_deleted" = 'false' {where_and}
            LIMIT 5000
        """)
        return df

    return _cached(f"configs:{org_filter}", _load)


def get_cost_per_flow_data(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    org_filter: Optional[str] = None,
) -> pd.DataFrame:
    def _load():
        date_filter = ""
        if start_date and end_date:
            date_filter = f"""AND j."job_start_at" >= '{start_date}' AND j."job_start_at" <= '{end_date}'"""
        join, where_and = _build_org_join_where(org_filter, "fj")
        df = query_data(f"""
            WITH flow_jobs AS (
                SELECT "kbc_job_id", "kbc_component_configuration_id", "kbc_project_id", "job_run_id", "job_start_at"
                FROM {JOBS_FQN}
                WHERE ("kbc_component_id" LIKE '%orchestrator%' OR "kbc_component_id" LIKE '%flow%')
            ),
            child_jobs AS (
                SELECT SPLIT_PART(j."job_run_id", '.', 1) as "parent_job_id",
                    SUM(TRY_TO_DOUBLE(j."job_billed_credits_used")) as "credits",
                    SUM(TRY_TO_DOUBLE(j."job_network_mb")) as "data_transferred_mb",
                    COUNT(*) as "task_count",
                    SUM(CASE WHEN j."job_status" = 'success' THEN 1 ELSE 0 END) as "success_count",
                    SUM(CASE WHEN j."job_status" = 'error' THEN 1 ELSE 0 END) as "error_count"
                FROM {JOBS_FQN} j
                WHERE j."job_run_id" LIKE '%.%' AND j."job_billed_credits_used" IS NOT NULL {date_filter}
                GROUP BY 1
            ),
            flow_configs AS (
                SELECT "kbc_component_configuration_id", "kbc_component_configuration" as "flow_name", "configuration_json"
                FROM {CONFIGS_FQN}
                WHERE "kbc_component_id" LIKE '%orchestrator%' OR "kbc_component_id" LIKE '%flow%'
            )
            SELECT fc."flow_name", fc."configuration_json",
                SUM(cj."credits") as "total_credits", COUNT(DISTINCT cj."parent_job_id") as "run_count",
                SUM(cj."data_transferred_mb") as "total_data_mb", SUM(cj."task_count") as "total_tasks",
                SUM(cj."success_count") as "successful_tasks", SUM(cj."error_count") as "failed_tasks",
                SUM(CASE WHEN cj."data_transferred_mb" > 0 THEN 1 ELSE 0 END) as "runs_with_data_change"
            FROM child_jobs cj
            JOIN flow_jobs fj ON cj."parent_job_id" = SPLIT_PART(fj."kbc_job_id", '_', 1)
            {join}
            JOIN flow_configs fc ON fj."kbc_component_configuration_id" = fc."kbc_component_configuration_id"
            WHERE 1=1 {where_and}
            GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30
        """)
        if not df.empty:
            for col in ["total_credits", "total_data_mb"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            for col in ["run_count", "total_tasks", "successful_tasks", "failed_tasks", "runs_with_data_change"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
            df["avg_credits_per_run"] = (df["total_credits"] / df["run_count"].replace(0, 1)).round(4)
            df["avg_data_per_run_mb"] = (df["total_data_mb"] / df["run_count"].replace(0, 1)).round(2)
            df["data_change_rate"] = ((df["runs_with_data_change"] / df["run_count"].replace(0, 1)) * 100).round(1)
            df["use_case"] = df["configuration_json"].apply(generate_use_case_summary)
        return df

    return _cached(f"flow:{org_filter}:{start_date}:{end_date}", _load)


def build_lineage_index(org_filter: Optional[str] = None) -> dict:
    def _load():
        configs_df = get_configurations_with_mappings(org_filter)
        table_to_configs: dict = {}
        for _, row in configs_df.iterrows():
            config_json = row.get("configuration_json", "")
            if not config_json or pd.isna(config_json):
                continue
            try:
                config = json.loads(config_json)
                storage = config.get("storage", {})
                input_tables = [t.get("source", "") for t in storage.get("input", {}).get("tables", []) if t.get("source")]
                output_tables = [t.get("destination", "") for t in storage.get("output", {}).get("tables", []) if t.get("destination")]
                info = {
                    "config_id": row.get("kbc_component_configuration_id", ""),
                    "config_name": row.get("config_name", "Unknown"),
                    "component_id": row.get("kbc_component_id", ""),
                    "component_name": row.get("component_name", "Unknown"),
                    "component_type": row.get("kbc_component_type", "other"),
                    "project_id": row.get("kbc_project_id", ""),
                    "input_tables": input_tables,
                    "output_tables": output_tables,
                }
                for src in input_tables:
                    table_to_configs.setdefault(src, []).append({**info, "direction": "input"})
                for dst in output_tables:
                    table_to_configs.setdefault(dst, []).append({**info, "direction": "output"})
            except (json.JSONDecodeError, TypeError, AttributeError):
                continue
        return table_to_configs

    return _cached(f"lineage:{org_filter}", _load)


def get_table_url(table_id: str, kbc_project_id: str) -> Optional[str]:
    if not kbc_project_id or not table_id:
        return None
    parts = str(kbc_project_id).split("_")
    proj_num = parts[0] if parts else ""
    if len(parts) > 1:
        stack = "_".join(parts[1:])
        if "azure-north-europe" in stack:
            base_url = "https://connection.north-europe.azure.keboola.com"
        elif "eu-central-1" in stack:
            base_url = "https://connection.eu-central-1.keboola.com"
        elif "europe-west3" in stack or "gcp" in stack:
            base_url = "https://connection.europe-west3.gcp.keboola.com"
        else:
            base_url = "https://connection.keboola.com"
    else:
        base_url = "https://connection.keboola.com"
    table_parts = table_id.split(".")
    if len(table_parts) >= 3:
        bucket_id = f"{table_parts[0]}.{table_parts[1]}"
        table_name = table_parts[2]
        return f"{base_url}/admin/projects/{proj_num}/storage/{bucket_id}/table/{table_name}"
    return None
