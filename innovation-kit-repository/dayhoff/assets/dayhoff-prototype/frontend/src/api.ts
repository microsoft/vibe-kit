import type { GenerationParams, GenerationResponse, ExportParams } from './types';

const API_BASE = '/api';

export async function generateSequences(params: GenerationParams): Promise<GenerationResponse> {
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
    }

    return response.json();
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

export async function checkHealth(): Promise<{ model_loaded: boolean }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
        const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return response.json();
    } catch {
        clearTimeout(timeout);
        throw new Error('Backend not reachable');
    }
}
