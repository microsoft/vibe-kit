"""
Sequence exporters for various file formats.

Uses factory pattern for Open/Closed principle - add new formats by creating
new Exporter classes without modifying existing code.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any
import csv
import json
from io import StringIO


class SequenceExporter(ABC):
    """Abstract base class for sequence exporters."""

    mimetype: str
    extension: str

    @abstractmethod
    def export(self, sequences: list[dict], params: dict[str, Any]) -> str:
        """Export sequences to string format."""
        pass

    def get_filename(self, base_name: str = "dayhoff_sequences") -> str:
        """Generate filename with proper extension."""
        return f"{base_name}.{self.extension}"

    def _get_metadata_dict(self, params: dict[str, Any]) -> dict[str, Any]:
        """Build common metadata dictionary."""
        return {
            "model": "microsoft/Dayhoff-170m-GR",
            "timestamp": datetime.now().isoformat(),
            "prompt": params.get("prompt", "N/A"),
            "temperature": params.get("temperature", "N/A"),
            "max_length": params.get("max_length", "N/A"),
            "generation_mode": params.get("generation_mode", "N/A"),
            "direction": params.get("direction", "N/A"),
        }


class FastaExporter(SequenceExporter):
    """Export sequences in FASTA format."""

    mimetype = "text/plain"
    extension = "fasta"

    def export(self, sequences: list[dict], params: dict[str, Any]) -> str:
        metadata = self._get_metadata_dict(params)
        lines = [
            "# Dayhoff Protein Sequence Generator",
            f"# Model: {metadata['model']}",
            f"# Generated: {metadata['timestamp']}",
            f"# Prompt: {metadata['prompt']}",
            f"# Temperature: {metadata['temperature']}",
            f"# Max Length: {metadata['max_length']}",
            f"# Generation Mode: {metadata['generation_mode']}",
            f"# Direction: {metadata['direction']}",
            "#",
        ]

        for i, seq_data in enumerate(sequences):
            seq = seq_data.get("sequence", "")
            fitness = seq_data.get("fitness_score", 0)
            lines.append(f">sequence_{i + 1}|fitness_{fitness:.1f}|length_{len(seq)}")
            lines.append(seq)

        return "\n".join(lines)


class CsvExporter(SequenceExporter):
    """Export sequences in CSV format."""

    mimetype = "text/csv"
    extension = "csv"

    def export(self, sequences: list[dict], params: dict[str, Any]) -> str:
        metadata = self._get_metadata_dict(params)
        output = StringIO()
        writer = csv.writer(output)

        # Header row
        writer.writerow(
            [
                "Sequence_ID",
                "Sequence",
                "Length",
                "Fitness_Score",
                "Model",
                "Generated",
                "Prompt",
                "Temperature",
                "Max_Length",
                "Generation_Mode",
                "Direction",
            ]
        )

        # Data rows
        for i, seq_data in enumerate(sequences):
            seq = seq_data.get("sequence", "")
            fitness = seq_data.get("fitness_score", 0)
            writer.writerow(
                [
                    f"seq_{i + 1}",
                    seq,
                    len(seq),
                    f"{fitness:.1f}",
                    metadata["model"],
                    metadata["timestamp"],
                    metadata["prompt"],
                    metadata["temperature"],
                    metadata["max_length"],
                    metadata["generation_mode"],
                    metadata["direction"],
                ]
            )

        return output.getvalue()


class JsonExporter(SequenceExporter):
    """Export sequences in JSON format with full metadata."""

    mimetype = "application/json"
    extension = "json"

    def export(self, sequences: list[dict], params: dict[str, Any]) -> str:
        export_data = {
            "metadata": {
                **self._get_metadata_dict(params),
                "count": len(sequences),
                "parameters": params,
            },
            "sequences": sequences,
        }
        return json.dumps(export_data, indent=2)


class TxtExporter(SequenceExporter):
    """Export sequences in human-readable text format."""

    mimetype = "text/plain"
    extension = "txt"

    def export(self, sequences: list[dict], params: dict[str, Any]) -> str:
        metadata = self._get_metadata_dict(params)
        lines = [
            "Dayhoff Protein Sequence Generator",
            f"Model: {metadata['model']}",
            f"Generated: {metadata['timestamp']}",
            f"Prompt: {metadata['prompt']}",
            f"Temperature: {metadata['temperature']}",
            f"Max Length: {metadata['max_length']}",
            f"Generation Mode: {metadata['generation_mode']}",
            f"Direction: {metadata['direction']}",
            "",
            "=" * 80,
            "",
        ]

        for i, seq_data in enumerate(sequences):
            seq = seq_data.get("sequence", "")
            fitness = seq_data.get("fitness_score", 0)
            lines.append(
                f"Sequence {i + 1} | Length: {len(seq)} | Fitness: {fitness:.1f}"
            )
            lines.append(seq)
            lines.append("")

        return "\n".join(lines)


# Exporter registry - Open/Closed: add new exporters here
_EXPORTERS: dict[str, type[SequenceExporter]] = {
    "fasta": FastaExporter,
    "csv": CsvExporter,
    "json": JsonExporter,
    "txt": TxtExporter,
}


def get_exporter(format_name: str) -> SequenceExporter:
    """
    Factory function to get appropriate exporter.

    Args:
        format_name: Export format (fasta, csv, json, txt)

    Returns:
        SequenceExporter instance

    Raises:
        ValueError: If format is not supported
    """
    exporter_class = _EXPORTERS.get(format_name.lower())
    if not exporter_class:
        supported = ", ".join(_EXPORTERS.keys())
        raise ValueError(f"Unsupported format '{format_name}'. Supported: {supported}")
    return exporter_class()


def get_supported_formats() -> list[str]:
    """Return list of supported export formats."""
    return list(_EXPORTERS.keys())
