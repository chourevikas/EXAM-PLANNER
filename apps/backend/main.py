import uvicorn
from app.fastapi_server import app
import os

if __name__ == "__main__":
    bind_network = os.getenv("BIND_NETWORK", "0.0.0.0")
    uvicorn.run(
        app, 
        host=bind_network, 
        port=8000,
        reload=True
    )
