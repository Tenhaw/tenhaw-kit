"""A deterministic self-assessment with explicit evidence coverage."""

from __future__ import annotations

import html
import json
import math
from pathlib import Path
from typing import Any, Literal, cast

from jsonschema import Draft202012Validator

__version__ = "1.1.0"
Json = dict[str, Any]


def _asset(name: str, directory: str) -> Json:
    bundled = Path(__file__).parent / "data" / name
    if bundled.is_file():
        return cast(Json, json.loads(bundled.read_text(encoding="utf-8")))
    for parent in Path(__file__).resolve().parents:
        source = parent / "spec" / directory / name
        if source.is_file():
            return cast(Json, json.loads(source.read_text(encoding="utf-8")))
    raise FileNotFoundError(f"Missing packaged framework asset: {name}")


def _number(value: float) -> int | float:
    if not math.isfinite(value) or not math.isfinite(value * 1_000_000):
        raise ValueError("$.result: calculation exceeds the supported finite numeric range")
    result = math.floor(value * 1_000_000 + 0.5) / 1_000_000
    return int(result) if result.is_integer() else result


def load_framework(version: str = "v1") -> Json:
    """Return a fresh copy of the versioned, CC BY 4.0 framework."""
    if version != "v1":
        raise ValueError("$.version: unsupported framework version")
    return _asset("readiness-framework.v1.json", "content")


def validate_responses(value: object) -> Json:
    """Validate the shared JSON Schema and reject repeated question answers."""
    try:
        json.dumps(value, allow_nan=False)
    except (TypeError, ValueError):
        raise ValueError("$: input must contain only finite JSON values") from None
    schema = _asset("readiness-response.schema.json", "schemas")
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: str(error.path))
    if errors:
        error = errors[0]
        location = "$" + "".join(f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.path)
        raise ValueError(f"{location}: {error.message}")
    result = cast(Json, value)
    identifiers = [answer["questionId"] for answer in result["answers"]]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("$.answers: each question may be answered only once")
    return result


def score_readiness(responses: object, weights: dict[str, float] | None = None) -> Json:
    """Score answered dimensions, reporting bands only at 80% total coverage."""
    data = validate_responses(responses)
    framework = load_framework()
    dimensions = framework["dimensions"]
    defaults = {dimension["id"]: float(dimension["weight"]) for dimension in dimensions}
    if weights is not None:
        for key, value in weights.items():
            if (
                key not in defaults
                or isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or value < 0
            ):
                raise ValueError(
                    f"$.weights.{key}: expected a known dimension and a nonnegative finite weight"
                )
            defaults[key] = value
    total_weight = sum(defaults.values())
    if total_weight <= 0 or not math.isfinite(total_weight):
        raise ValueError("$.weights: total must be positive and finite")
    normalised = {key: value / total_weight for key, value in defaults.items()}
    answers = {answer["questionId"]: answer for answer in data["answers"]}
    result_dimensions: list[Json] = []
    gaps: list[Json] = []
    total_questions = 0
    weighted_score = 0.0
    answered_weight = 0.0
    for dimension in dimensions:
        identifier = dimension["id"]
        questions = dimension["questions"]
        total_questions += len(questions)
        answered = [answers[question["id"]] for question in questions if question["id"] in answers]
        score = sum(answer["score"] for answer in answered) / len(answered) if answered else None
        weight = normalised[identifier]
        if score is not None:
            weighted_score += _number(score) * weight
            answered_weight += weight
        result_dimensions.append(
            {
                "id": identifier,
                "label": dimension["label"],
                "weight": _number(weight),
                "score": _number(score) if score is not None else None,
                "answered": len(answered),
                "total": len(questions),
                "coverage": _number(len(answered) / len(questions)),
            }
        )
        for question in questions:
            answer = answers.get(question["id"])
            if answer is not None and answer["score"] <= 2:
                gaps.append(
                    {
                        "questionId": question["id"],
                        "dimensionId": identifier,
                        "score": answer["score"],
                        "priority": _number(weight * (5 - answer["score"])),
                        "recommendation": question["recommendations"]["low"],
                    }
                )
    gaps.sort(key=lambda gap: (-gap["priority"], gap["questionId"]))
    overall = _number(weighted_score / answered_weight) if answered_weight > 0 else None
    coverage = len(answers) / total_questions
    band = None
    if overall is not None and coverage >= 0.8:
        band = next(
            label
            for upper, label in [
                (1.8, "Exploring"),
                (2.6, "Experimenting"),
                (3.4, "Scaling"),
                (4.2, "Embedded"),
                (float("inf"), "Leading"),
            ]
            if overall < upper
        )
    return {
        "frameworkVersion": "v1",
        "contentCredit": framework["contentCredit"],
        "overall": _number(overall) if overall is not None else None,
        "band": band,
        "coverage": _number(coverage),
        "dimensions": result_dimensions,
        "gaps": gaps,
        "recommendations": [
            {"questionId": gap["questionId"], "action": gap["recommendation"]} for gap in gaps
        ],
        "limitations": [
            "Self-assessment, not a certification or legal advice.",
            "Maturity bands require at least 80% response coverage.",
        ],
    }


def render_report(report: Json, format: Literal["md", "html", "json"] = "json") -> str:
    """Render portable reports without hidden network calls or attribution."""
    credit = load_framework()["contentCredit"]
    if format == "json":
        return json.dumps(
            {**report, "contentCredit": credit},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
    lines = [
        "# AI readiness self-assessment",
        "",
        f"Overall: {report['overall']}",
        f"Coverage: {report['coverage'] * 100:.1f}%",
        f"Band: {report['band'] or 'insufficient evidence'}",
        "",
        "Method: mean answered questions per dimension, weighted over answered dimensions.",
        "Bands require at least 80% response coverage.",
        "",
        "## Dimensions",
        "",
    ]
    for dimension in report["dimensions"]:
        lines.append(
            f"- {dimension['label']}: {dimension['score']} (weight {dimension['weight']}; "
            f"{dimension['answered']}/{dimension['total']} answered)"
        )
    lines.extend(["", "## Recommendations", ""])
    lines.extend(f"- {item['action']}" for item in report["recommendations"])
    lines.extend(["", *report["limitations"], "", credit])
    markdown = "\n".join(lines)
    if format == "md":
        return markdown
    if format == "html":
        return (
            '<!doctype html><html lang="en-GB"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width"><title>AI readiness self-assessment</title>'
            f"<main><h1>AI readiness self-assessment</h1><pre>{html.escape(markdown)}</pre></main></html>"
        )
    raise ValueError("$.format: expected md, html or json")


__all__ = ["load_framework", "validate_responses", "score_readiness", "render_report"]
