// API types for Dayhoff protein generator

export interface GenerationParams {
    prompt: string;
    num_sequences: number;
    max_length: number;
    temperature: number;
    generation_mode: GenerationMode;
    direction: Direction;
}

export type GenerationMode = 'unconditional' | 'family_guided' | 'motif_scaffolding';
export type Direction = 'n_to_c' | 'c_to_n';

export interface SequenceWithFitness {
    sequence: string;
    fitness_score: number;
    length: number;
}

export interface GenerationStats {
    total_generated: number;
    valid_count: number;
    invalid_count: number;
    success_rate: number;
    generation_mode: GenerationMode;
    direction: Direction;
    avg_fitness: number;
}

export interface GenerationResponse {
    success: boolean;
    sequences: string[];
    sequences_with_fitness: SequenceWithFitness[];
    invalid_sequences: [string, string][];
    stats: GenerationStats;
    error?: string;
}

export interface ExportParams {
    sequences: SequenceWithFitness[];
    parameters: GenerationParams;
}
