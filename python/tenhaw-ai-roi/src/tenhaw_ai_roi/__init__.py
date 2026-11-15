"""Transparent AI economics: cash realisation is explicit, never assumed."""

from __future__ import annotations

import html
import json
import math
from pathlib import Path
from typing import Any, Literal, cast

from jsonschema import Draft202012Validator

__version__ = "1.0.0"
Json = dict[str, Any]


def _asset(name: str, directory: str) -> Json:
    bundled = Path(__file__).parent / "data" / name
    if bundled.is_file():
        return cast(Json, json.loads(bundled.read_text(encoding="utf-8")))
    for parent in Path(__file__).resolve().parents:
        source = parent / "spec" / directory / name
        if source.is_file():
            return cast(Json, json.loads(source.read_text(encoding="utf-8")))
    raise FileNotFoundError(f"Missing packaged model asset: {name}")


def _rounded(value: Any) -> Any:
    if isinstance(value, float):
        if not math.isfinite(value) or not math.isfinite(value * 1_000_000):
            raise ValueError("$.result: non-finite calculation")
        number = math.floor(value * 1_000_000 + 0.5) / 1_000_000
        return int(number) if number.is_integer() else number
    if isinstance(value, dict):
        return {key: _rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_rounded(item) for item in value]
    return value


def validate_input(value: object) -> Json:
    try:
        json.dumps(value, allow_nan=False)
    except (TypeError, ValueError):
        raise ValueError("$: input must contain only finite JSON values") from None
    schema = _asset("roi-input.schema.json", "schemas")
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: str(error.path))
    if errors:
        error = errors[0]
        location = "$" + "".join(f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.path)
        raise ValueError(f"{location}: {error.message}")
    result = cast(Json, value)
    if not result["savings"]["low"] <= result["savings"]["base"] <= result["savings"]["high"]:
        raise ValueError("$.savings: expected low <= base <= high")
    return result


def calculate_roi(value: object) -> Json:
    """Calculate all three scenarios from supplied assumptions in one currency."""
    data = validate_input(value)
    volume = data["users"] * data["tasksPerUserPerMonth"]
    cash_realisation = data.get("cashRealisation", 0)
    scenarios: Json = {}
    for name in ("low", "base", "high"):
        fraction = data["savings"][name]
        full_hours = volume * data["minutesPerTask"] * fraction / 60
        full_value = full_hours * data["hourlyCost"]
        cash_flow: list[Json] = []
        cumulative = -float(data["buildCost"])
        npv = cumulative
        total_benefit = 0.0
        total_run = 0.0
        total_hours = 0.0
        payback: int | None = None
        for month in range(1, data["horizonMonths"] + 1):
            adoption = min(1.0, month / data["adoptionMonths"]) if data["adoptionMonths"] else 1.0
            hours = full_hours * adoption
            potential = hours * data["hourlyCost"]
            benefit = potential * cash_realisation
            run_cost = data["monthlyRunCost"]
            net = benefit - run_cost
            if month == 1 and data["buildCost"] == 0 and net >= 0:
                payback = 0
            cumulative += net
            npv += net / ((1 + data["annualDiscountRate"]) ** (month / 12))
            total_benefit += benefit
            total_run += run_cost
            total_hours += hours
            if payback is None and cumulative >= 0:
                payback = month
            cash_flow.append(
                {
                    "month": month,
                    "adoption": adoption,
                    "hoursSaved": hours,
                    "potentialValue": potential,
                    "cashBenefit": benefit,
                    "runCost": run_cost,
                    "netCashFlow": net,
                    "cumulativeCashFlow": cumulative,
                }
            )
        total_cost = data["buildCost"] + total_run
        scenarios[name] = {
            "monthlyCashFlow": cash_flow,
            "totalCashBenefit": total_benefit,
            "totalRunCost": total_run,
            "totalHoursSaved": total_hours,
            "recoveredCapacityHours": total_hours * (1 - cash_realisation),
            "npv": npv,
            "paybackMonth": payback,
            "roiPercent": (total_benefit - total_cost) / total_cost * 100 if total_cost else None,
            "costPerTask": total_cost / (volume * data["horizonMonths"]) if volume else None,
            "breakEvenAdoption": data["monthlyRunCost"] / (full_value * cash_realisation)
            if full_value * cash_realisation
            else None,
        }
    return cast(
        Json,
        _rounded(
            {
                "currency": data.get("currency", "GBP"),
                "assumptions": {"cashRealisation": cash_realisation, "capacityIsCash": False},
                "scenarios": scenarios,
                "topDrivers": [
                    {"name": "time-saving fraction", "value": data["savings"]["base"]},
                    {"name": "cash-realisation fraction", "value": cash_realisation},
                    {"name": "monthly task volume", "value": volume},
                ],
                "limitations": [
                    "Cash benefits require explicit cost-line removal "
                    "or a justified cash-realisation assumption.",
                    "Recovered capacity is reported separately and is not treated as cash.",
                    "Editable assumptions, not a quote or financial advice.",
                ],
            }
        ),
    )


def estimate_project_cost(value: Json) -> Json:
    """Return an editable team-days estimate, without presenting it as a quote."""
    defaults = _asset("roi-defaults.v1.json", "content")
    stage = value.get("stage")
    stages = defaults["stages"]
    if stage not in stages:
        raise ValueError("$.stage: expected poc, pilot or production")
    assumption = stages[stage]
    people = value.get("people", assumption["people"])
    weeks_low = value.get("durationWeeks", assumption["weeksLow"])
    weeks_high = value.get("durationWeeks", assumption["weeksHigh"])
    day_rate = value.get("dayRate", defaults["dayRate"])
    for field, number in (("people", people), ("durationWeeks", weeks_low), ("dayRate", day_rate)):
        if (
            isinstance(number, bool)
            or not isinstance(number, (int, float))
            or not math.isfinite(number)
            or number <= 0
        ):
            raise ValueError(f"$.{field}: expected a positive finite number")
    return cast(
        Json,
        _rounded(
            {
                "stage": stage,
                "currency": value.get("currency", "GBP"),
                "low": people * weeks_low * 5 * day_rate,
                "high": people * weeks_high * 5 * day_rate,
                "assumptions": {
                    "people": people,
                    "dayRate": day_rate,
                    "workingDaysPerWeek": 5,
                    "weeksLow": weeks_low,
                    "weeksHigh": weeks_high,
                },
                "limitations": [
                    "Editable assumptions, not a quote.",
                    "Excludes model, infrastructure and ongoing support costs.",
                ],
            }
        ),
    )


def render_report(report: Json, format: Literal["md", "html", "json"] = "json") -> str:
    if format == "json":
        return json.dumps(report, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    lines = [
        "# AI ROI estimate",
        "",
        f"Currency: {report['currency']}",
        f"Cash realisation: {report['assumptions']['cashRealisation'] * 100:.1f}%",
        "",
        "| Scenario | NPV | ROI % | Payback month | Recovered capacity hours |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for name, scenario in report["scenarios"].items():
        lines.append(
            f"| {name} | {scenario['npv']:,.2f} | {scenario['roiPercent']} | "
            f"{scenario['paybackMonth']} | {scenario['recoveredCapacityHours']:,.2f} |"
        )
    lines.extend(
        [
            "",
            "Method: discounted monthly cash flows after run costs and initial build cost.",
            *report["limitations"],
        ]
    )
    markdown = "\n".join(lines)
    if format == "md":
        return markdown
    if format == "html":
        return (
            '<!doctype html><html lang="en-GB"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width"><title>AI ROI estimate</title>'
            f"<main><h1>AI ROI estimate</h1><pre>{html.escape(markdown)}</pre></main></html>"
        )
    raise ValueError("$.format: expected md, html or json")


__all__ = ["calculate_roi", "estimate_project_cost", "validate_input", "render_report"]
