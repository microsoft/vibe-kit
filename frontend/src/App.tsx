import { useQuery } from '@tanstack/react-query'

type HelloWorldResponse = {
  data: string
}

async function fetchHello(): Promise<HelloWorldResponse> {
  const res = await fetch('/api/helloworld')
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

export default function App() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['helloworld'],
    queryFn: fetchHello,
  })

  return (
    <div className="landing-root">
      <header className="hero">
        <div className="hero-content">
          <h1>Microsoft Research Vibe Kit</h1>
          <p className="tagline">Build fast prototypes with Microsoft Research innovations. Replace this boilerplate page with your own prototype.</p>
        </div>
      </header>

      <main className="content">
        <section id="get-started" className="card">
          <h2>What's here</h2>
          <ul>
            <li>Minimal React + Vite frontend (You're looking at it!)</li>
            <li><a href="https://tanstack.com/query/v4/docs/framework/react/overview">Tanstack Query</a> connection to a Python/<a href="https://fastapi.tiangolo.com/">FastAPI</a> backend (see /api/helloworld)</li>
          </ul>
          <p className="muted">Tip: open <code>frontend/src/App.tsx</code> and replace this component with your own prototype UI.</p>
        </section>

        <section className="card">
          <h2>Backend status</h2>
          <div aria-live="polite" aria-busy={isLoading || isFetching}>
            {isLoading ? (
              <p>Checking backend…</p>
            ) : isError ? (
              <div role="alert">
                <p>Unable to reach backend. {error instanceof Error ? error.message : String(error)}</p>
                <button className="btn" onClick={() => refetch()}>Retry</button>
              </div>
            ) : (
              <p>Backend says: <strong>{data?.data}</strong></p>
            )}
          </div>
        </section>
      </main>
      <footer className="footer">
        <small>Made with ♥ — Replace this page with your prototype.</small>
      </footer>
    </div>
  )
}
