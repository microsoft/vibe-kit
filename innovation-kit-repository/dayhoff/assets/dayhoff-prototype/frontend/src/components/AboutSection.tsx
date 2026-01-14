import { useState } from 'react';

export function AboutSection() {
    const [expanded, setExpanded] = useState(false);

    return (
        <section className="about-section">
            <button
                type="button"
                className="about-toggle"
                onClick={() => setExpanded(!expanded)}
            >
                <span>About Dayhoff</span>
                <svg
                    className={`chevron-icon ${expanded ? 'expanded' : ''}`}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                >
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                </svg>
            </button>
            <div className={`about-content ${expanded ? 'expanded' : ''}`}>
                <p>
                    Dayhoff is a hybrid state-space-model transformer architecture developed by Microsoft Research,
                    trained on 3.34 billion protein sequences from the Dayhoff Atlas. It combines Mamba layers and
                    Transformer self-attention with Mixture-of-Experts modules for efficient large-scale protein
                    generation with bidirectional capabilities.
                </p>

                <h3>Core Capabilities</h3>
                <ul>
                    <li><strong>Unconditional Design:</strong> Generate completely novel protein sequences de novo</li>
                    <li><strong>Zero-shot Mutation Effects:</strong> Predict fitness impacts without experimental data</li>
                    <li><strong>Motif Scaffolding:</strong> Design proteins around functional structural motifs</li>
                    <li><strong>Bidirectional Generation:</strong> Support for both N→C and C→N sequence generation</li>
                    <li><strong>Homolog Conditioning:</strong> Generate sequences within specific protein families</li>
                    <li><strong>Long Context Modeling:</strong> Handle extended sequences and multiple sequence alignments</li>
                </ul>

                <h3>Research Applications</h3>
                <ul>
                    <li>Protein engineering for enhanced cellular expression</li>
                    <li>Structural motif preservation in designed proteins</li>
                    <li>Evolutionary analysis and family-specific design</li>
                    <li>Integration with structure prediction tools (AlphaFold, ESMFold)</li>
                    <li><strong>Zero-shot fitness prediction</strong> - sequences are scored using Dayhoff's internal likelihood calculations</li>
                </ul>

                <h3>References</h3>
                <p>
                    <strong>Model:</strong>{' '}
                    <a href="https://huggingface.co/microsoft/Dayhoff-170m-GR" target="_blank" rel="noopener noreferrer">
                        microsoft/Dayhoff-170m-GR on Hugging Face
                    </a>
                    <br />
                    <strong>Research:</strong>{' '}
                    <a href="https://www.microsoft.com/en-us/research/project/protein-language-models/" target="_blank" rel="noopener noreferrer">
                        Microsoft Research - Protein Language Models
                    </a>
                    <br />
                    <strong>GitHub:</strong>{' '}
                    <a href="https://github.com/microsoft/protein-sequence-models" target="_blank" rel="noopener noreferrer">
                        Microsoft Protein Sequence Models
                    </a>
                </p>
            </div>
        </section>
    );
}
