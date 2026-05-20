// API types for Dayhoff protein generator

export interface GenerationParams {
    prompt: string;
    num_sequences: number;
    max_length: number;
    temperature: number;
    generation_mode: GenerationMode;
    direction: Direction;
    model?: string;
    homologs?: string[];
    min_p?: number;
}

export type GenerationMode = 'unconditional' | 'family_guided';
export type Direction = 'n_to_c' | 'c_to_n';

export interface SequenceWithFitness {
    sequence: string;
    fitness_score: number;
    length: number;
    /** Backend-attached warning when the tail is dominated by a tandem repeat. */
    repetition_warning?: string;
}

export interface GenerationStats {
    total_generated: number;
    valid_count: number;
    invalid_count: number;
    success_rate: number;
    generation_mode: GenerationMode;
    direction: Direction;
    avg_fitness: number;
    model?: string;
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

export interface StructurePredictionResponse {
    success: boolean;
    sequence_length?: number;
    format?: 'pdb';
    pdb?: string;
    configured?: boolean;
    error?: string;
}

export interface ScoredVariant {
    rank: number;
    input_index: number;
    sequence: string;
    length: number;
    fitness_score: number;
}

export interface ScoreVariantsResponse {
    success: boolean;
    variants: ScoredVariant[];
    invalid_sequences: { index: number; sequence: string; error: string }[];
    stats: {
        total_submitted: number;
        scored_count: number;
        invalid_count: number;
        model: string;
    };
    error?: string;
}
