import uvicorn
import os

if __name__ == "__main__":
    bind_network = os.getenv("BIND_NETWORK", "0.0.0.0")
    uvicorn.run("app.fastapi_server:app", host=bind_network, port=8000, reload=True)
