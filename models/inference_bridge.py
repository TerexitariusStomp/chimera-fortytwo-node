#!/usr/bin/env python3
"""
Python Inference Bridge for Chimera-Fortytwo Node.

Runs a lightweight Flask/FastAPI server that loads ONNX or GGUF models
and exposes an /infer endpoint for the TypeScript node to call.

Usage:
    python models/inference_bridge.py --model-id phi-3-mini-4k-instruct --port 5000
"""

import argparse
import json
import time
import sys
import os
from typing import Optional

# Optional dependencies
try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

try:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

try:
    from flask import Flask, request, jsonify
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False

app = Flask(__name__) if HAS_FLASK else None

# Global model cache
_model = None
_tokenizer = None
_model_id: Optional[str] = None
_backend: Optional[str] = None


def load_model(model_id: str, cache_dir: str = "./models/cache") -> str:
    """Load a model into memory. Returns backend type."""
    global _model, _tokenizer, _model_id, _backend

    os.makedirs(cache_dir, exist_ok=True)
    _model_id = model_id

    # Try ONNX first
    onnx_path = os.path.join(cache_dir, f"{model_id}.onnx")
    if HAS_ONNX and os.path.exists(onnx_path):
        _model = ort.InferenceSession(onnx_path)
        _backend = "onnx"
        print(f"[INFO] Loaded ONNX model: {onnx_path}", file=sys.stderr)
        return _backend

    # Try transformers
    if HAS_TRANSFORMERS:
        try:
            _tokenizer = AutoTokenizer.from_pretrained(model_id, cache_dir=cache_dir)
            _model = AutoModelForCausalLM.from_pretrained(model_id, cache_dir=cache_dir)
            _backend = "transformers"
            print(f"[INFO] Loaded transformers model: {model_id}", file=sys.stderr)
            return _backend
        except Exception as e:
            print(f"[WARN] Failed to load transformers model: {e}", file=sys.stderr)

    # Fallback: mock
    _backend = "mock"
    print(f"[WARN] Using mock backend for {model_id}", file=sys.stderr)
    return _backend


def mock_infer(prompt: str, params: dict) -> dict:
    """Deterministic mock inference for testing."""
    time.sleep(0.1)
    output = f"[MOCK] Response to: {prompt[:50]}..."
    return {
        "output": output,
        "usage": {
            "prompt_tokens": len(prompt) // 4,
            "completion_tokens": len(output) // 4,
            "total_tokens": (len(prompt) + len(output)) // 4,
            "memory_peak_mb": 256,
        },
    }


def transformers_infer(prompt: str, params: dict) -> dict:
    """Run inference with transformers."""
    start = time.time()
    inputs = _tokenizer(prompt, return_tensors="pt")

    max_new_tokens = params.get("max_tokens", 128)
    temperature = params.get("temperature", 0.7)

    with torch.no_grad() if "torch" in globals() else contextlib.nullcontext():
        outputs = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=temperature if temperature > 0 else None,
        )

    output_text = _tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Strip the original prompt from output
    if output_text.startswith(prompt):
        output_text = output_text[len(prompt):].strip()

    compute_ms = int((time.time() - start) * 1000)
    return {
        "output": output_text,
        "usage": {
            "prompt_tokens": len(inputs["input_ids"][0]),
            "completion_tokens": len(outputs[0]) - len(inputs["input_ids"][0]),
            "total_tokens": len(outputs[0]),
            "memory_peak_mb": 512,  # rough estimate
        },
    }


def infer(job_id: str, model_id: str, prompt: str, params: dict) -> dict:
    """Route inference to the correct backend."""
    if _model_id != model_id:
        load_model(model_id)

    if _backend == "mock":
        return mock_infer(prompt, params)
    elif _backend == "transformers":
        return transformers_infer(prompt, params)
    elif _backend == "onnx":
        return mock_infer(prompt, params)  # TODO: implement ONNX inference
    else:
        return mock_infer(prompt, params)


if HAS_FLASK and app:
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "backend": _backend, "model_id": _model_id})

    @app.route("/infer", methods=["POST"])
    def infer_endpoint():
        data = request.get_json(force=True)
        job_id = data.get("job_id", "unknown")
        model_id = data.get("model_id", _model_id or "unknown")
        prompt = data.get("prompt", "")
        params = data.get("params", {})

        if not prompt:
            return jsonify({"error": "missing prompt"}), 400

        result = infer(job_id, model_id, prompt, params)
        return jsonify(result)


def main():
    parser = argparse.ArgumentParser(description="Chimera-Fortytwo Python Inference Bridge")
    parser.add_argument("--model-id", default="phi-3-mini-4k-instruct", help="Model identifier")
    parser.add_argument("--port", type=int, default=5000, help="Server port")
    parser.add_argument("--cache-dir", default="./models/cache", help="Model cache directory")
    args = parser.parse_args()

    if not HAS_FLASK:
        print("[ERROR] Flask is required. Install with: pip install flask", file=sys.stderr)
        sys.exit(1)

    load_model(args.model_id, args.cache_dir)
    print(f"[INFO] Inference bridge listening on port {args.port}", file=sys.stderr)
    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
