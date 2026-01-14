#!/usr/bin/env python
"""
Command-line interface for Dayhoff protein sequence generation.
"""

import argparse

from constants import GenerationMode, Direction
from generator import DayhoffGenerator


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Generate protein sequences with Dayhoff"
    )
    parser.add_argument(
        "--prompt", "-p", default="M", help="Starting sequence (default: M)"
    )
    parser.add_argument(
        "--num", "-n", type=int, default=5, help="Number of sequences (default: 5)"
    )
    parser.add_argument(
        "--length", "-l", type=int, default=80, help="Max length (default: 80)"
    )
    parser.add_argument(
        "--temp", "-t", type=float, default=0.8, help="Temperature (default: 0.8)"
    )
    parser.add_argument(
        "--mode",
        "-m",
        choices=GenerationMode.all(),
        default=GenerationMode.UNCONDITIONAL,
        help="Generation mode (default: unconditional)",
    )
    parser.add_argument(
        "--direction",
        "-d",
        choices=Direction.all(),
        default=Direction.N_TO_C,
        help="Generation direction (default: n_to_c)",
    )
    parser.add_argument(
        "--save", "-s", action="store_true", help="Save sequences to file"
    )
    parser.add_argument(
        "--fitness", "-f", action="store_true", help="Calculate fitness scores"
    )

    args = parser.parse_args()

    print("Dayhoff Protein Sequence Generator")
    print("=" * 50)

    # Initialize generator
    generator = DayhoffGenerator()

    # Generate sequences
    sequences = generator.generate_sequences(
        prompt=args.prompt,
        num_sequences=args.num,
        max_length=args.length,
        temperature=args.temp,
        generation_mode=args.mode,
        direction=args.direction,
    )

    print("\n" + "=" * 50)
    print("VALIDATION RESULTS")
    print("=" * 50)

    # Validate sequences
    validation = generator.validate_sequences(sequences)
    print(f"[OK] Valid sequences: {validation['valid_count']}")
    print(f"[FAIL] Invalid sequences: {validation['invalid_count']}")
    print(f"Success rate: {validation['success_rate']:.1f}%")

    if validation["invalid_sequences"]:
        print("\nInvalid sequences:")
        for seq, reason in validation["invalid_sequences"]:
            print(f"  - {seq[:20]}... ({reason})")

    print("\n" + "=" * 50)
    print("Valid Sequences:")
    print("=" * 50)

    for i, seq in enumerate(validation["valid_sequences"], 1):
        print(f"\nSequence {i}: {seq}")
        print(f"Length: {len(seq)} amino acids")

        if args.fitness:
            fitness = generator.calculate_fitness_score(seq)
            print(f"Fitness: {fitness:.1f}/100")

    # Save if requested
    if args.save:
        generator.save_sequences(validation["valid_sequences"])

    print("\nGenerated sequences are ready for structure prediction and analysis.")


if __name__ == "__main__":
    main()
