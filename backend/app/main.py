from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Vibe Kit Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/helloworld")
async def helloworld():
    return {"data": "hello, world"}


@app.get("/api/helloworld")
async def api_helloworld():
    return {"data": "hello, world"}
