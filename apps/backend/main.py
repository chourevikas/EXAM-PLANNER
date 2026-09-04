import os

# Suppress false-positive multiprocessing / loky resource_tracker warnings on Python 3.14+ shutdown
existing_pw = os.environ.get("PYTHONWARNINGS", "")
tracker_filter = "ignore::UserWarning:multiprocessing.resource_tracker"
if tracker_filter not in existing_pw:
    os.environ["PYTHONWARNINGS"] = f"{existing_pw},{tracker_filter}".strip(",")

import uvicorn

if __name__ == "__main__":
    bind_network = os.getenv("BIND_NETWORK", "0.0.0.0")
    uvicorn.run("app.fastapi_server:app", host=bind_network, port=8000, reload=True)
