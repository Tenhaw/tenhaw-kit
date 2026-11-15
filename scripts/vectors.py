"""Verify Python domain outputs against the same golden JSON as TypeScript."""

from __future__ import annotations

import argparse
import json
import math
from decimal import Decimal
from pathlib import Path
from typing import Any

from tenhaw_ai_readiness import score_readiness
from tenhaw_ai_roi import calculate_roi, estimate_project_cost
from tenhaw_delivery_metrics import compute_metrics


def canonical(value: Any) -> str:
    def normalise(item: Any) -> Any:
        if isinstance(item, float):
            if not math.isfinite(item):
                raise ValueError("Canonical JSON cannot contain non-finite numbers")
            rounded = math.floor(item * 1_000_000 + 0.5) / 1_000_000
            return int(rounded) if rounded.is_integer() else rounded
        if isinstance(item, dict):
            return {key: normalise(child) for key, child in sorted(item.items())}
        if isinstance(item, list):
            return [normalise(child) for child in item]
        return item

    def encode(item: Any) -> str:
        if item is None:
            return "null"
        if isinstance(item, bool):
            return "true" if item else "false"
        if isinstance(item, (int, float)):
            number = float(item)
            if number == 0:
                return "0"
            if abs(number) >= 1e21:
                mantissa, exponent = repr(number).lower().split("e")
                mantissa = mantissa.removesuffix(".0")
                return mantissa + "e" + ("+" if int(exponent) >= 0 else "-") + str(abs(int(exponent)))
            return format(Decimal(str(item)), "f")
        if isinstance(item, str):
            return json.dumps(item, ensure_ascii=False)
        if isinstance(item, list):
            return "[" + ",".join(encode(child) for child in item) + "]"
        if isinstance(item, dict):
            return (
                "{" + ",".join(encode(key) + ":" + encode(child) for key, child in sorted(item.items())) + "}"
            )
        raise ValueError("Canonical JSON supports only JSON values")

    return encode(normalise(value))


def run() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--emit", "--json", action="store_true", help="Emit canonical outputs for cross-language parity"
    )
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / "spec" / "vectors"
    outputs: dict[str, Any] = {}
    counts: dict[str, int] = {}
    failures = []
    for path in sorted(root.glob("*/*.json")):
        vector = json.loads(path.read_text(encoding="utf-8"))
        tool = vector.get("tool", path.parent.name)
        if tool == "readiness":
            actual = score_readiness(vector["input"], weights=vector.get("config", {}).get("weights"))
        elif tool == "roi":
            actual = calculate_roi(vector["input"])
        elif tool == "delivery":
            actual = compute_metrics(vector["input"], vector["config"])
        elif tool == "cost":
            actual = estimate_project_cost(vector["input"])
        else:
            continue
        name = str(path.relative_to(root))
        outputs[name] = actual
        counts[tool] = counts.get(tool, 0) + 1
        if canonical(actual) != canonical(vector["expected"]):
            failures.append(name)
    if not counts:
        raise RuntimeError("No shared vectors were found")
    if failures:
        raise AssertionError("Python golden-vector mismatch: " + ", ".join(failures))
    if arguments.emit:
        print(canonical(outputs))
    else:
        print(f"Python shared vectors passed: {sum(counts.values())} " + canonical(counts))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
