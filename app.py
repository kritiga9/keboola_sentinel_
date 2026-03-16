# Local development entrypoint.
# In production, supervisord starts the server via keboola-config/supervisord/services/app.conf.
# To run locally: uv run python app.py
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8050, reload=True)
