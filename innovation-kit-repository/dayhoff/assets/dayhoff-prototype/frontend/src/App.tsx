import { useState, useEffect } from 'react';
import { AboutSection, SequenceInput, SequenceResults, ExportButtons } from './components';
import { generateSequences, checkHealth } from './api';
import type { GenerationParams, GenerationResponse } from './types';
import './styles.css';

function App() {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GenerationResponse | null>(null);
  const [params, setParams] = useState<GenerationParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then((data) => setModelLoaded(data.model_loaded))
      .catch(() => setModelLoaded(false));
  }, []);

  const handleGenerate = async (newParams: GenerationParams) => {
    setIsLoading(true);
    setError(null);
    setParams(newParams);

    try {
      const data = await generateSequences(newParams);
      if (data.success) {
        setResults(data);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Dayhoff Protein Generator</h1>
        <p className="app-subtitle">Research Prototype | Microsoft Research Dayhoff-170m-GR</p>
      </header>

      <main className="app-content">
        <AboutSection />

        <div className="warning-box">
          <strong>WARNING: Research Prototype:</strong> This tool generates computational predictions only.
          Generated sequences and fitness scores require experimental validation before use in protein engineering
          applications.
        </div>

        <div className="privacy-box">
          <strong>PRIVACY NOTICE:</strong> DO NOT enter sensitive, proprietary, confidential, or personal
          information. This includes unpublished research, trade secrets, or patient data.
        </div>

        <div className={`status-indicator ${modelLoaded ? 'status-success' : 'status-error'}`}>
          {modelLoaded
            ? '✓ Model Status: Dayhoff-170m-GR loaded and ready'
            : '✗ Model Status: Dayhoff model not loaded. Please check the console for errors.'}
        </div>

        <SequenceInput
          onSubmit={handleGenerate}
          isLoading={isLoading}
          modelLoaded={modelLoaded}
        />

        {isLoading && (
          <div className="loading">
            <span className="spinner"></span>
            Generating protein sequences with Dayhoff-170m-GR...
          </div>
        )}

        {error && (
          <div className="status-indicator status-error">
            Error: {error}
          </div>
        )}

        {results && !isLoading && (
          <>
            <ExportButtons
              sequences={results.sequences_with_fitness}
              params={params}
            />
            <SequenceResults
              stats={results.stats}
              sequences={results.sequences_with_fitness}
              invalidSequences={results.invalid_sequences}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
