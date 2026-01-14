import { useState } from 'react';
import type { GenerationParams, GenerationMode, Direction } from '../types';

interface Props {
    onSubmit: (params: GenerationParams) => void;
    isLoading: boolean;
    modelLoaded: boolean;
}

const MODE_DESCRIPTIONS: Record<GenerationMode, string> = {
    unconditional: 'Generate completely novel protein sequences de novo',
    family_guided: 'Generate sequences similar to existing protein families',
    motif_scaffolding: 'Design proteins around specific functional motifs',
};

export function SequenceInput({ onSubmit, isLoading, modelLoaded }: Props) {
    const [prompt, setPrompt] = useState('M');
    const [numSequences, setNumSequences] = useState(3);
    const [maxLength, setMaxLength] = useState(80);
    const [temperature, setTemperature] = useState(1.0);
    const [generationMode, setGenerationMode] = useState<GenerationMode>('unconditional');
    const [direction, setDirection] = useState<Direction>('n_to_c');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            prompt,
            num_sequences: numSequences,
            max_length: maxLength,
            temperature,
            generation_mode: generationMode,
            direction,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="form-container">
            <div className="form-section">
                <div className="form-group">
                    <label htmlFor="prompt">Starting Sequence</label>
                    <input
                        type="text"
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter amino acid sequence (e.g., M, MK, GAVL) or leave empty"
                    />
                    <small>Leave empty for random generation</small>
                </div>
            </div>

            <div className="form-section">
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="numSequences">Number of Sequences</label>
                        <input
                            type="number"
                            id="numSequences"
                            min={1}
                            max={500}
                            value={numSequences}
                            onChange={(e) => setNumSequences(parseInt(e.target.value))}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="maxLength">Maximum Length</label>
                        <input
                            type="number"
                            id="maxLength"
                            min={20}
                            max={600}
                            value={maxLength}
                            onChange={(e) => setMaxLength(parseInt(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className="form-section">
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="generation_mode">Generation Mode</label>
                        <select
                            id="generation_mode"
                            value={generationMode}
                            onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                        >
                            <option value="unconditional">Unconditional Design</option>
                            <option value="family_guided">Family-Guided Design</option>
                            <option value="motif_scaffolding">Motif Scaffolding</option>
                        </select>
                        <small>{MODE_DESCRIPTIONS[generationMode]}</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="direction">Generation Direction</label>
                        <select
                            id="direction"
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as Direction)}
                        >
                            <option value="n_to_c">N-terminus to C-terminus</option>
                            <option value="c_to_n">C-terminus to N-terminus</option>
                        </select>
                        <small>Bidirectional sequence generation</small>
                    </div>
                </div>
            </div>

            <div className="form-section">
                <div className="form-group">
                    <label htmlFor="sampling_temp">
                        Sampling Temperature <span className="temperature-value">{temperature.toFixed(1)}</span>
                    </label>
                    <div className="temperature-container">
                        <input
                            type="range"
                            id="sampling_temp"
                            min={0.1}
                            max={1.9}
                            step={0.1}
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        />
                        <div className="temperature-labels">
                            <span>Focused</span>
                            <span>Balanced</span>
                            <span>Diverse</span>
                        </div>
                    </div>
                    <small>Controls diversity vs quality trade-off in sequence generation</small>
                </div>
            </div>

            <div className="form-section">
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!modelLoaded || isLoading}
                >
                    {isLoading ? 'Generating...' : 'Generate Sequences'}
                </button>
            </div>
        </form>
    );
}
