import type { SequenceWithFitness, GenerationParams } from '../types';
import { exportSequences } from '../api';

interface Props {
    sequences: SequenceWithFitness[];
    params: GenerationParams | null;
}

export function ExportButtons({ sequences, params }: Props) {
    const handleExport = async (format: string) => {
        if (sequences.length === 0 || !params) {
            alert('No sequences to export');
            return;
        }

        try {
            const blob = await exportSequences(format, { sequences, parameters: params });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dayhoff_sequences.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('Export failed: ' + (error as Error).message);
        }
    };

    if (sequences.length === 0) return null;

    return (
        <div className="export-buttons">
            <button onClick={() => handleExport('fasta')} className="btn-secondary">
                Download FASTA
            </button>
            <button onClick={() => handleExport('csv')} className="btn-secondary">
                Download CSV
            </button>
            <button onClick={() => handleExport('json')} className="btn-secondary">
                Download JSON
            </button>
            <button onClick={() => handleExport('txt')} className="btn-secondary">
                Download TXT
            </button>
        </div>
    );
}
