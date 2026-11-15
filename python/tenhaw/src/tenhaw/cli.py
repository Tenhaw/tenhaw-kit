"""Stable JSON on stdout, bounded diagnostics on stderr, no token logging."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from tenhaw_ai_readiness import load_framework, score_readiness
from tenhaw_ai_roi import calculate_roi, estimate_project_cost
from tenhaw_delivery_metrics import compute_metrics
from tenhaw_delivery_metrics.collectors import (
    CollectorError,
    MissingCredentialsError,
    collect_github,
    collect_jira,
)

from . import __version__

Json = dict[str, Any]


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tenhaw-py", description="Deterministic tools for AI and delivery")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("command", choices=["readiness", "roi", "delivery-metrics", "doctor"])
    parser.add_argument("action", nargs="?", choices=["cost"])
    parser.add_argument("--input", type=Path)
    parser.add_argument("--from-file", type=Path)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--github", help="Comma-separated owner/repository names")
    parser.add_argument("--jira", help="Jira JQL query; credentials are read from the environment")
    parser.add_argument("--since", default="90d")
    parser.add_argument("--until")
    parser.add_argument("--stage", choices=["poc", "pilot", "production"])
    parser.add_argument("--day-rate", type=float)
    parser.add_argument("--people", type=float)
    parser.add_argument("--duration-weeks", type=float)
    parser.add_argument("--questionnaire", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--format", choices=["json", "md", "html"], default="md")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--no-attribution", action="store_true")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--network", action="store_true")
    return parser


def _read(path: Path) -> Any:
    # Reject NaN/Infinity, which Python otherwise accepts despite invalid JSON.
    def reject_constant(value: str) -> None:
        raise ValueError(f"Invalid JSON constant: {value}")

    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def _since(value: str, now: datetime) -> str:
    if value.endswith("d") and value[:-1].isdigit():
        return (now - timedelta(days=int(value[:-1]))).isoformat().replace("+00:00", "Z")
    return value


def _run(arguments: argparse.Namespace) -> Json:
    if arguments.action and arguments.command != "roi":
        raise ValueError("Only roi supports the cost action")
    if arguments.command == "doctor":
        names = ["GITHUB_TOKEN", "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]
        result: Json = {
            "version": __version__,
            "python": sys.version.split()[0],
            "environment": {name: bool(os.environ.get(name)) for name in names},
        }
        if arguments.network:
            result["networkHosts"] = ["api.github.com", "<your-site>.atlassian.net"]
        return result
    if arguments.command == "readiness":
        if arguments.questionnaire:
            return load_framework()
        if arguments.input is None:
            raise ValueError("readiness requires --input answers.json, or --questionnaire")
        weights = _read(arguments.weights) if arguments.weights else None
        return score_readiness(_read(arguments.input), weights=weights)
    if arguments.command == "roi":
        if arguments.action == "cost":
            if not arguments.stage:
                raise ValueError("roi cost requires --stage")
            options = {
                "stage": arguments.stage,
                "dayRate": arguments.day_rate,
                "people": arguments.people,
                "durationWeeks": arguments.duration_weeks,
            }
            return estimate_project_cost({key: value for key, value in options.items() if value is not None})
        if arguments.input is None:
            raise ValueError("roi requires --input roi.json")
        return calculate_roi(_read(arguments.input))
    now = datetime.now(timezone.utc)
    config = _read(arguments.config) if arguments.config else {}
    since = _since(arguments.since, now)
    until = arguments.until or now.isoformat().replace("+00:00", "Z")
    source = arguments.from_file or arguments.input
    events = _read(source) if source else []
    if source is None and not arguments.github and not arguments.jira:
        raise ValueError("delivery-metrics requires --from-file, --github or --jira")
    if arguments.github:
        events.extend(collect_github(arguments.github.split(","), since, until, cache=not arguments.no_cache))
    if arguments.jira:
        events.extend(
            collect_jira(
                arguments.jira,
                since,
                until=until,
                status_to_stage=config.get("statusToStage"),
                cache=not arguments.no_cache,
            )
        )
    return compute_metrics(
        events,
        {
            "since": since,
            "until": until,
            "service": config.get("service"),
            "productionEnvironment": config.get("productionEnvironment", "production"),
        },
    )


def _attribution(command: str) -> Json:
    query = urlencode(
        {"utm_source": "pypi", "utm_medium": "report", "utm_campaign": "tenhaw-kit", "utm_content": command}
    )
    return {"name": "Tenhaw Kit", "version": __version__, "url": f"https://tenhaw.com/contact?{query}#book"}


def _format(report: Json, format: str) -> str:
    if format == "json":
        return json.dumps(report, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    # Generic human-readable report preserves every numeric assumption and caveat.
    body = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False)
    if format == "html":
        import html

        return (
            '<!doctype html><html lang="en-GB"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width"><title>Tenhaw Kit report</title>'
            f"<main><h1>Tenhaw Kit report</h1><pre>{html.escape(body)}</pre></main></html>"
        )
    return f"# Tenhaw Kit report\n\n```json\n{body}\n```\n"


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    try:
        arguments = parser.parse_args(argv)
    except SystemExit as error:
        return 0 if error.code == 0 else 1
    try:
        report = _run(arguments)
        if not arguments.no_attribution and os.environ.get("TENHAW_NO_ATTRIBUTION") != "1":
            report = {**report, "generator": _attribution(arguments.command)}
        output = _format(report, "json" if arguments.json else arguments.format)
        if arguments.out:
            arguments.out.write_text(output + "\n", encoding="utf-8")
        elif not arguments.quiet:
            print(output)
        return 0
    except MissingCredentialsError as error:
        print(str(error), file=sys.stderr)
        return 4
    except CollectorError as error:
        print(str(error), file=sys.stderr)
        return 3
    except (ValueError, OSError) as error:
        # Validation errors can include user input; credentials are always redacted.
        message = str(error)
        for name in ("GITHUB_TOKEN", "JIRA_EMAIL", "JIRA_API_TOKEN"):
            value = os.environ.get(name)
            if value:
                message = message.replace(value, "[REDACTED]")
        print(message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
