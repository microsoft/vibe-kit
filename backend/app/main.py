from fastapi import FastAPI


app = FastAPI(title="Vibe Kit Backend")


@app.get("/helloworld")
async def helloworld():
    return {"data": "hello, world"}
