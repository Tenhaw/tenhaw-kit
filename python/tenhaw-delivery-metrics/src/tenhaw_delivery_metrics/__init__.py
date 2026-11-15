"""DORA and flow metrics for one service, with explicit missing evidence."""

from __future__ import annotations

import html
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, cast

from jsonschema import Draft202012Validator, FormatChecker

from .collectors import collect_github, collect_jira

__version__ = "1.0.0"
Json = dict[str, Any]


def _asset(name: str) -> Json:
    bundled = Path(__file__).parent / "data" / name
    if bundled.is_file():
        return cast(Json, json.loads(bundled.read_text(encoding="utf-8")))
    for parent in Path(__file__).resolve().parents:
        source = parent / "spec" / "schemas" / name
        if source.is_file():
            return cast(Json, json.loads(source.read_text(encoding="utf-8")))
    raise FileNotFoundError(f"Missing packaged event schema: {name}")


def _date(value: str) -> float:
    if not isinstance(value, str) or not re.fullmatch(
        r"(?!0000)\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})", value
    ):
        raise ValueError("$.period: expected an RFC 3339 timestamp with timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00").replace("z", "+00:00"))
    except (TypeError, ValueError, OverflowError):
        raise ValueError("$.period: expected ISO 8601 dates with explicit timezones") from None
    if parsed.tzinfo is None:
        raise ValueError("$.period: dates require an explicit timezone")
    # JavaScript Date, used by the TypeScript implementation, has millisecond precision.
    parsed = parsed.replace(microsecond=(parsed.microsecond // 1000) * 1000)
    return parsed.astimezone(timezone.utc).timestamp()


def _number(value: float) -> int | float:
    if not math.isfinite(value) or not math.isfinite(value * 1_000_000):
        raise ValueError("$.result: non-finite calculation")
    result = math.floor(value * 1_000_000 + 0.5) / 1_000_000
    return int(result) if result.is_integer() else result


def validate_events(value: object) -> list[Json]:
    try:
        json.dumps(value, allow_nan=False)
    except (TypeError, ValueError):
        raise ValueError("$: input must contain only finite JSON values") from None
    errors = list(
        Draft202012Validator(
            _asset("delivery-events.schema.json"), format_checker=FormatChecker()
        ).iter_errors(value)
    )
    if errors:
        error = errors[0]
        location = "$" + "".join(f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.path)
        raise ValueError(f"{location}: event does not match the delivery event schema")
    events = cast(list[Json], value)
    for event in events:
        for field in (
            "timestamp",
            "startedAt",
            "restoredAt",
            "completedAt",
            "createdAt",
            "firstReviewAt",
            "mergedAt",
        ):
            if field in event:
                _date(event[field])
    return events


def compute_metrics(value: object, config: Json) -> Json:
    """Calculate deterministic metrics over the half-open [since, until) window."""
    supplied = validate_events(value)
    start, end = _date(config.get("since", "")), _date(config.get("until", ""))
    if end <= start:
        raise ValueError("$.period: until must be after since")
    seen: dict[str, Json] = {}
    for event in supplied:
        if event["id"] in seen and seen[event["id"]] != event:
            raise ValueError(f"$.events.{event['id']}: conflicting duplicate event ID")
        seen[event["id"]] = event
    events = [
        event for event in seen.values() if not config.get("service") or event["service"] == config["service"]
    ]
    if len({event["service"] for event in events}) > 1:
        raise ValueError("$.service: compute each service separately, or select config.service")
    for event in events:
        for earlier, later in (
            ("startedAt", "restoredAt"),
            ("startedAt", "completedAt"),
            ("createdAt", "firstReviewAt"),
            ("createdAt", "mergedAt"),
        ):
            if earlier in event and later in event and _date(event[later]) < _date(event[earlier]):
                raise ValueError(f"$.events.{event['id']}.{later}: timestamp precedes {earlier}")
    period = {"since": config["since"], "until": config["until"]}

    def inside(timestamp: str) -> bool:
        return start <= _date(timestamp) < end

    def metric(number: float | None, unit: str, count: int, caveats: list[str] | None = None) -> Json:
        return {
            "value": _number(number) if number is not None else None,
            "unit": unit,
            "sampleSize": count,
            "period": period,
            "dataSource": "supplied events",
            "caveats": caveats or [],
        }

    def mean(numbers: list[float]) -> float | None:
        return sum(numbers) / len(numbers) if numbers else None

    def missing(count: int, caveat: str) -> list[str]:
        return [] if count else [caveat]

    observed_deployments = [
        event
        for event in events
        if event["type"] == "deployment"
        and event["environment"] == config.get("productionEnvironment", "production")
        and not event.get("proxy")
    ]
    deployments = [event for event in observed_deployments if inside(event["timestamp"])]
    commits = {event["id"]: event for event in events if event["type"] == "commit"}
    incidents = [
        event
        for event in events
        if event["type"] == "incident"
        and _date(event["startedAt"]) < end
        and any(
            deployment["id"] == event["deploymentId"]
            and _date(event["startedAt"]) >= _date(deployment["timestamp"])
            for deployment in deployments
        )
    ]
    first_delivery: dict[str, float] = {}
    delivered: set[str] = set()
    for deployment in sorted(observed_deployments, key=lambda event: _date(event["timestamp"])):
        if deployment["status"] != "success":
            continue
        for identifier in deployment["commitIds"]:
            commit = commits.get(identifier)
            if (
                commit is not None
                and identifier not in delivered
                and _date(commit["timestamp"]) <= _date(deployment["timestamp"])
            ):
                delivered.add(identifier)
                if inside(deployment["timestamp"]):
                    first_delivery[identifier] = (
                        _date(deployment["timestamp"]) - _date(commit["timestamp"])
                    ) / 3600
    failed = {event["id"] for event in deployments if event["status"] == "failed"}
    failed.update(incident["deploymentId"] for incident in incidents)
    recovery = [
        (_date(incident["restoredAt"]) - _date(incident["startedAt"])) / 3600
        for incident in incidents
        if incident.get("restoredAt") and _date(incident["restoredAt"]) <= end
    ]
    classified = [event for event in deployments if isinstance(event.get("rework"), bool)]
    work = [event for event in events if event["type"] == "work-item" and _date(event["startedAt"]) < end]
    completed = [event for event in work if event.get("completedAt") and inside(event["completedAt"])]
    cycles = [(_date(event["completedAt"]) - _date(event["startedAt"])) / 3600 for event in completed]
    efficiencies: list[float] = []
    for event in completed:
        elapsed = (_date(event["completedAt"]) - _date(event["startedAt"])) / 60
        if event.get("activeMinutes") is not None and elapsed > 0:
            if event["activeMinutes"] > elapsed:
                raise ValueError(
                    f"$.events.{event['id']}.activeMinutes: active time exceeds elapsed cycle time"
                )
            efficiencies.append(event["activeMinutes"] / elapsed * 100)
    pulls = [
        event
        for event in events
        if event["type"] == "pull-request" and event.get("mergedAt") and inside(event["mergedAt"])
    ]
    reviews = [
        (_date(event["firstReviewAt"]) - _date(event["createdAt"])) / 3600
        for event in pulls
        if event.get("firstReviewAt")
    ]
    sizes = [
        float(event["additions"] + event["deletions"])
        for event in pulls
        if event.get("additions") is not None and event.get("deletions") is not None
    ]
    no_deploy = ["No observed production deployments in the requested period."]
    duration_days = (end - start) / 86400
    classified_all = len(classified) == len(deployments) and bool(deployments)
    return {
        "period": period,
        "metrics": {
            "deploymentFrequency": metric(
                len(deployments) / duration_days if deployments else None,
                "deployments/day",
                len(deployments),
                [] if deployments else no_deploy,
            ),
            "changeLeadTime": metric(
                mean(list(first_delivery.values())),
                "hours",
                len(first_delivery),
                missing(len(first_delivery), "No linked commit-to-production observations."),
            ),
            "changeFailRate": metric(
                len(failed) / len(deployments) * 100 if deployments else None,
                "percent",
                len(deployments),
                ["Assumes supplied deployment statuses and incident links are complete."]
                if deployments
                else no_deploy,
            ),
            "failedDeploymentRecoveryTime": metric(
                mean(recovery),
                "hours",
                len(recovery),
                missing(len(recovery), "No linked incidents with observed restoration."),
            ),
            "deploymentReworkRate": metric(
                sum(bool(event["rework"]) for event in classified) / len(deployments) * 100
                if classified_all
                else None,
                "percent",
                len(classified),
                [] if classified_all else ["Every deployment needs explicit rework classification."],
            ),
            "cycleTime": metric(
                mean(cycles),
                "hours",
                len(cycles),
                missing(len(cycles), "No completed work items in the period."),
            ),
            "throughput": metric(
                len(completed) / (duration_days / 7) if work else None,
                "items/week",
                len(completed),
                [] if work else ["No work-item observations."],
            ),
            "wip": metric(
                float(
                    sum(not event.get("completedAt") or _date(event["completedAt"]) >= end for event in work)
                )
                if work
                else None,
                "items at period end",
                len(work),
                [] if work else ["No work-item observations."],
            ),
            "flowEfficiency": metric(
                mean(efficiencies),
                "percent",
                len(efficiencies),
                missing(len(efficiencies), "No completed work items with active time."),
            ),
            "prReviewTime": metric(
                mean(reviews),
                "hours",
                len(reviews),
                missing(len(reviews), "No merged pull requests with a first review timestamp."),
            ),
            "prSize": metric(
                mean(sizes),
                "changed lines",
                len(sizes),
                missing(len(sizes), "No merged pull requests with additions and deletions."),
            ),
        },
        "caveats": [
            "Metrics describe one service and the supplied event window; missing links remain unavailable.",
            *(
                ["Proxy deployment events are excluded from DORA metrics."]
                if any(event["type"] == "deployment" and event.get("proxy") for event in events)
                else []
            ),
        ],
    }


def score_delivery_health(report: Json) -> Json:
    """Return data-improvement actions rather than an invented composite grade."""
    try:
        json.dumps(report, allow_nan=False)
    except (TypeError, ValueError):
        raise ValueError("$.report: input must contain only finite JSON values") from None
    errors = list(
        Draft202012Validator(
            _asset("delivery-report.schema.json"), format_checker=FormatChecker()
        ).iter_errors(report)
    )
    if errors:
        raise ValueError("$.report: invalid delivery report")
    metrics = report["metrics"]
    period = report["period"]
    if _date(period["until"]) <= _date(period["since"]):
        raise ValueError("$.period: until must be after since")
    for name, metric in metrics.items():
        if metric["period"] != period:
            raise ValueError(f"$.metrics.{name}.period: all metrics must use the report period")
    actions = []
    if metrics["changeLeadTime"]["value"] is None:
        actions.append("Link commits to observed production deployments.")
    if metrics["failedDeploymentRecoveryTime"]["value"] is None:
        actions.append("Record incident-to-deployment links and restoration timestamps.")
    if metrics["deploymentReworkRate"]["value"] is None:
        actions.append("Classify planned and incident-driven deployments.")
    if not actions:
        actions.append("Review trends for this service with the team before choosing an improvement.")
    return {
        "status": "informational",
        "metrics": metrics,
        "actions": actions[:3],
        "limitations": [
            "No composite score or cross-team ranking is inferred.",
            "DORA defines five delivery performance metrics; context and data completeness matter.",
        ],
        "sources": ["https://dora.dev/guides/dora-metrics/"],
    }


def render_report(report: Json, format: Literal["json", "md", "html"] = "json") -> str:
    text = json.dumps(
        report,
        sort_keys=True,
        ensure_ascii=False,
        indent=None if format == "json" else 2,
        allow_nan=False,
        separators=(",", ":") if format == "json" else None,
    )
    if format == "json":
        return text
    if format == "md":
        return f"# Delivery metrics\n\n```json\n{text}\n```\n"
    if format == "html":
        return (
            '<!doctype html><html lang="en-GB"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width"><title>Delivery metrics</title>'
            f"<main><h1>Delivery metrics</h1><pre>{html.escape(text)}</pre></main></html>"
        )
    raise ValueError("$.format: expected md, html or json")


__all__ = [
    "compute_metrics",
    "score_delivery_health",
    "validate_events",
    "render_report",
    "collect_github",
    "collect_jira",
]
