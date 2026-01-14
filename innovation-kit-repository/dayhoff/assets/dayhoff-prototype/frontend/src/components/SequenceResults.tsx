import type { GenerationStats, SequenceWithFitness } from '../types';
import { useState } from 'react';

interface Props {
    stats: GenerationStats;
    sequences: SequenceWithFitness[];
    invalidSequences: [string, string][];
}

const AMINO_TYPES: Record<string, string> = {
    A: 'hydrophobic', I: 'hydrophobic', L: 'hydrophobic', V: 'hydrophobic',
    M: 'hydrophobic', F: 'hydrophobic', Y: 'hydrophobic', W: 'hydrophobic',
    D: 'charged', E: 'charged', K: 'charged', R: 'charged',
    N: 'polar', Q: 'polar', S: 'polar', T: 'polar', H: 'polar',
    C: 'special', G: 'special', P: 'special',
};

function highlightAminoAcids(sequence: string) {
    return sequence.split('').map((aa, i) => {
        const type = AMINO_TYPES[aa] || 'special';
        return <span key={i} className={`aa-${type}`}>{aa}</span>;
    });
}

function getComposition(sequence: string) {
    const hydrophobic = (sequence.match(/[AILVMFYW]/g) || []).length;
    const charged = (sequence.match(/[DEKR]/g) || []).length;
    const total = sequence.length;
    return `${Math.round((hydrophobic / total) * 100)}% hydrophobic, ${Math.round((charged / total) * 100)}% charged`;
}

function getFitnessInfo(score: number | null): { className: string; label: string } {
    if (score === null) return { className: 'fitness-neutral', label: 'Unknown' };
    if (score >= 70) return { className: 'fitness-high', label: 'High' };
    if (score >= 40) return { className: 'fitness-medium', label: 'Medium' };
    return { className: 'fitness-low', label: 'Low' };
}

function SequenceCard({ seq, index }: { seq: SequenceWithFitness; index: number }) {
    const [copied, setCopied] = useState(false);
    const fitness = getFitnessInfo(seq.fitness_score);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(seq.sequence).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="sequence-card">
            <div className="sequence-header">
                <span className="sequence-title">Sequence {index + 1}</span>
                {seq.fitness_score !== null && (
                    <span
                        className={`fitness-badge ${fitness.className}`}
                        title={`Dayhoff fitness prediction: ${seq.fitness_score}/100`}
                    >
                        {seq.fitness_score}/100 ({fitness.label})
                    </span>
                )}
                <button onClick={copyToClipboard} className="btn-secondary">
                    {copied ? '✓ Copied!' : 'Copy'}
                </button>
            </div>
            <div className="sequence-content">
                <div className="sequence-text">{highlightAminoAcids(seq.sequence)}</div>
                <div className="sequence-meta">
                    <span>Length: {seq.length} amino acids</span>
                    <span>Composition: {getComposition(seq.sequence)}</span>
                    {seq.fitness_score !== null && (
                        <span>Fitness: {seq.fitness_score}/100 ({fitness.label})</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function SequenceResults({ stats, sequences, invalidSequences }: Props) {
    const modeDisplay = stats.generation_mode
        .replace('_', ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    const directionDisplay = stats.direction === 'c_to_n' ? 'C→N' : 'N→C';

    return (
        <div className="results-container">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.total_generated}</div>
                    <div className="stat-label">Generated</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.valid_count}</div>
                    <div className="stat-label">Valid</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.success_rate.toFixed(1)}%</div>
                    <div className="stat-label">Success Rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.avg_fitness?.toFixed(1) || 'N/A'}</div>
                    <div className="stat-label">Avg Fitness</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{modeDisplay}</div>
                    <div className="stat-label">Mode</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{directionDisplay}</div>
                    <div className="stat-label">Direction</div>
                </div>
            </div>

            <div className="sequences-container">
                <h2 className="sequences-title">Generated Protein Sequences</h2>

                <div className="aa-legend">
                    <div className="aa-legend-title">Amino Acid Color Legend</div>
                    <div className="aa-legend-grid">
                        <div className="aa-legend-item">
                            <span className="aa-legend-sample">
                                <span className="aa-hydrophobic">A I L V M F Y W</span>
                            </span>
                            <span className="aa-legend-description">Hydrophobic</span>
                        </div>
                        <div className="aa-legend-item">
                            <span className="aa-legend-sample">
                                <span className="aa-charged">D E K R</span>
                            </span>
                            <span className="aa-legend-description">Charged</span>
                        </div>
                        <div className="aa-legend-item">
                            <span className="aa-legend-sample">
                                <span className="aa-polar">N Q S T H</span>
                            </span>
                            <span className="aa-legend-description">Polar</span>
                        </div>
                        <div className="aa-legend-item">
                            <span className="aa-legend-sample">
                                <span className="aa-special">C G P</span>
                            </span>
                            <span className="aa-legend-description">Special</span>
                        </div>
                    </div>
                </div>

                {sequences.map((seq, i) => (
                    <SequenceCard key={i} seq={seq} index={i} />
                ))}

                {invalidSequences.length > 0 && (
                    <>
                        <h3>Invalid Sequences</h3>
                        {invalidSequences.map(([seq, reason], i) => (
                            <div key={i} className="sequence-card">
                                <div className="sequence-header">
                                    <span className="sequence-title">Invalid Sequence</span>
                                </div>
                                <div className="sequence-content">
                                    <div className="sequence-text">{seq.substring(0, 50)}...</div>
                                    <div className="sequence-meta">
                                        <span>Reason: {reason}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
