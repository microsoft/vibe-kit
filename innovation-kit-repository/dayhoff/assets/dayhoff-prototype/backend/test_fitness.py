"""
"""Test script for Dayhoff fitness scoring.

Quick test to validate the zero-shot fitness prediction is working.
"""


def test_fitness_scoring():
    """Test the fitness scoring feature."""
    try:
        from generator import DayhoffGenerator

        print("Testing Dayhoff fitness scoring...")
        generator = DayhoffGenerator()
        
        # Test sequences
        test_sequences = [
            "MKLLVVVAGLAVALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV",  # Generated sequence
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",  # Low complexity
            "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPD"   # Another generated
        ]
        
        print("\nTesting fitness scores:")
        for i, seq in enumerate(test_sequences, 1):
            fitness = generator.calculate_fitness_score(seq)
            print(f"Sequence {i}: {fitness:.1f}/100")
            print(f"  Length: {len(seq)}")
            print(f"  Preview: {seq[:20]}...")
            
            if fitness >= 70:
                quality = "High"
            elif fitness >= 40:
                quality = "Medium"
            else:
                quality = "Low"
            print(f"  Quality: {quality}")
            print()
        
        print("[OK] Fitness scoring test completed!")
        return True

    except Exception as e:
        print(f"[FAIL] Fitness scoring test failed: {e}")
        return False

if __name__ == "__main__":
    test_fitness_scoring()