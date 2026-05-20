import sys
import os


def test_imports():
    """Test if all required libraries are available"""
    print("Testing imports...")

    try:
        import torch

        print(f"[OK] PyTorch: {torch.__version__}")
    except ImportError:
        print("[FAIL] PyTorch not found. Run: pip install torch")
        return False

    try:
        import transformers

        print(f"[OK] Transformers: {transformers.__version__}")
    except ImportError:
        print("[FAIL] Transformers not found. Run: pip install transformers")
        return False

    try:
        import requests

        print(f"[OK] Requests available")
    except ImportError:
        print("[FAIL] Requests not found. Run: pip install requests")
        return False

    return True


def test_dayhoff_model():
    """Test if Dayhoff model can be loaded"""
    print("\nTesting Dayhoff model loading...")

    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM

        model_name = "microsoft/Dayhoff-170m-GR"
        print(f"Loading {model_name}...")

        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=True,
            use_mamba_kernels=False,  # Use CPU-compatible implementation
        )

        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        print("[OK] Dayhoff model loaded successfully!")
        return True, (tokenizer, model)

    except Exception as e:
        print(f"[FAIL] Failed to load Dayhoff model: {e}")
        return False, None


def get_test_prompt():
    """Return a simple test prompt for sequence generation.

    'M' (Methionine) is the standard protein start codon.
    """
    return "M"


def test_sequence_generation(tokenizer, model):
    """Test sequence generation"""
    print("\nTesting sequence generation...")

    try:
        import torch

        prompt = get_test_prompt()
        inputs = tokenizer(prompt, return_tensors="pt")

        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=50,
                temperature=0.8,
                do_sample=True,
                num_return_sequences=2,
                pad_token_id=tokenizer.eos_token_id,
            )

        sequences = [
            tokenizer.decode(output, skip_special_tokens=True) for output in outputs
        ]

        print("[OK] Generated sequences:")
        for i, seq in enumerate(sequences, 1):
            print(f"   {i}: {seq}")

        return True

    except Exception as e:
        print(f"[FAIL] Sequence generation failed: {e}")
        return False


def main():
    """Run all tests"""
    print("Dayhoff Prototype Test Suite")
    print("=" * 50)

    if not test_imports():
        print("\n[FAIL] Import test failed. Please install required packages:")
        print("   pip install -r requirements.txt")
        return False

    success, model_data = test_dayhoff_model()
    if not success:
        print(
            "\n[FAIL] Model loading failed. Check internet connection and disk space."
        )
        return False

    tokenizer, model = model_data
    if not test_sequence_generation(tokenizer, model):
        print("\n[FAIL] Sequence generation failed.")
        return False

    print("\n" + "=" * 50)
    print("All core tests passed!")
    print("[OK] Dayhoff prototype is ready to use")
    print("\nNext steps:")
    print("  1. Run: python app.py")
    print("  2. In another terminal: cd ../frontend && npm run dev")

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
