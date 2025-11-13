# Backend

Minimal FastAPI backend exposing a single endpoint `/helloworld` that returns `{ "data": "hello, world" }`.

## Run locally

Use uvicorn to run the server:

```
uvicorn app.main:app --reload --port 8010
```

Then open:
- http://localhost:8010/helloworld
- http://localhost:8010/docs

## Test

```
pytest -q
```
