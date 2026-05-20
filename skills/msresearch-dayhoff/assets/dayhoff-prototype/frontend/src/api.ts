import type { GenerationParams, GenerationResponse, ExportParams, StructurePredictionResponse, ScoreVariantsResponse } from './types';

// API base is sub-path-aware. Vite bakes import.meta.env.BASE_URL at build
// time (always trailing slash; '/' for root deploys, '/some/prefix/' for
// sub-path deployments). Strip the trailing slash and append '/api' so the
// request hits Flask at the correct reverse-proxy-routed location.
const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

export async function generateSequences(params: GenerationParams, signal?: AbortSignal, requestId?: string): Promise<GenerationResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requestId) headers['X-Request-Id'] = requestId;
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
    }

    return response.json();
}

export interface GenerationProgressPhase {
    phase: 'received' | 'calling_aml' | 'validating_output' | 'screening' | 'done' | 'error' | 'unknown';
    t?: number;
    model?: string;
    latency_ms?: number;
    valid?: number;
}

export async function fetchGenerationProgress(requestId: string, signal?: AbortSignal): Promise<GenerationProgressPhase | null> {
    try {
        const r = await fetch(`${API_BASE}/generate/progress/${encodeURIComponent(requestId)}`, { signal });
        if (r.status === 404) return { phase: 'unknown' };
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

export async function scoreVariants(
    sequences: string,
    model: string,
    signal?: AbortSignal,
): Promise<ScoreVariantsResponse> {
    const response = await fetch(`${API_BASE}/score-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequences, model }),
        signal,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Variant scoring failed');
    }
    return data;
}

export async function exportSequences(format: string, data: ExportParams): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Export failed');
    }

    return response.blob();
}

export async function predictStructure(sequence: string, signal?: AbortSignal): Promise<StructurePredictionResponse> {
    const response = await fetch(`${API_BASE}/predict-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence }),
        signal,
    });

    const data = await response.json();
    if (!response.ok) {
        return data;
    }

    return data;
}

export async function checkHealth(): Promise<{ model_loaded: boolean; esmfold_max_length?: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout (Easy Auth adds latency)

    try {
        const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return response.json();
    } catch {
        clearTimeout(timeout);
        throw new Error('Backend not reachable');
    }
}
