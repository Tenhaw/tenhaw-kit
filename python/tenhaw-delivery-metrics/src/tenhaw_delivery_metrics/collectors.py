"""Local, environment-authenticated collectors. No tokens enter events or caches."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import time
from collections.abc import Callable
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlsplit

import httpx

Json = dict[str, Any]
Event = dict[str, Any]


class CollectorError(RuntimeError):
    """An upstream failure whose message never contains credentials or bodies."""


class MissingCredentialsError(CollectorError):
    """A required environment variable is not set."""


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingCredentialsError(f"Set {name} to use this local collector")
    return value


def _date(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Dates require an explicit timezone")
    return parsed.astimezone(timezone.utc)


def _safe(value: Any, secrets: tuple[str, ...]) -> Any:
    if isinstance(value, dict):
        return {
            key: _safe(item, secrets)
            for key, item in value.items()
            if key.lower() not in {"token", "authorization", "password", "api_token", "secret"}
        }
    if isinstance(value, list):
        return [_safe(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[REDACTED]")
    return value


def _cached(
    identity: str,
    fetch: Callable[[], list[Event]],
    secrets: tuple[str, ...],
    cache: bool,
    cache_dir: str | Path,
    cache_ttl: int,
) -> list[Event]:
    filename = Path(cache_dir) / (hashlib.sha256(identity.encode()).hexdigest() + ".json")
    if cache and filename.is_file() and time.time() - filename.stat().st_mtime < cache_ttl:
        try:
            data = json.loads(filename.read_text(encoding="utf-8"))
            if isinstance(data, list) and all(isinstance(event, dict) for event in data):
                return cast(list[Event], _safe(data, secrets))
        except (OSError, ValueError):
            pass
    events = cast(list[Event], _safe(fetch(), secrets))
    if cache:
        filename.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix=".events-", dir=filename.parent)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(events, stream, ensure_ascii=False, allow_nan=False)
            os.replace(temporary, filename)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return events


def _get(client: httpx.Client, path: str, params: Json | None = None) -> Any:
    for attempt in range(5):
        try:
            response = client.get(path, params=params)
        except httpx.HTTPError:
            if attempt == 4:
                raise CollectorError("Upstream network request failed after retries") from None
            time.sleep(min(2**attempt, 8))
            continue
        rate_limited = response.status_code == 429 or (
            response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0"
        )
        if rate_limited or response.status_code >= 500:
            if attempt == 4:
                raise CollectorError(f"Upstream HTTP {response.status_code} after retries")
            retry_after = response.headers.get("retry-after", "")
            try:
                delay = float(retry_after) if retry_after else float(2**attempt)
            except ValueError:
                try:
                    delay = (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds()
                except (TypeError, ValueError):
                    delay = float(2**attempt)
            # Do not retry earlier than the service permits, or block a CLI indefinitely.
            if delay > 60:
                raise CollectorError("Upstream rate limit requires a wait longer than 60 seconds")
            time.sleep(max(0, delay))
            continue
        if not 200 <= response.status_code < 300:
            raise CollectorError(f"Upstream returned HTTP {response.status_code}")
        try:
            return response.json()
        except ValueError:
            raise CollectorError("Upstream returned invalid JSON") from None
    raise CollectorError("Upstream retries exhausted")


def _github_pages(client: httpx.Client, path: str, params: Json | None = None) -> list[Json]:
    collected: list[Json] = []
    for page in range(1, 1001):
        data = _get(client, path, {**(params or {}), "per_page": 100, "page": page})
        if not isinstance(data, list):
            raise CollectorError("GitHub returned an unexpected response shape")
        collected.extend(data)
        if len(data) < 100:
            return collected
    raise CollectorError("GitHub pagination exceeded 100,000 records; narrow the period")


def collect_github(
    repos: list[str],
    since: str,
    until: str | None = None,
    *,
    cache: bool = True,
    cache_dir: str | Path = ".tenhaw/cache",
    cache_ttl: int = 300,
) -> list[Event]:
    """Collect deployment, commit and PR events using GITHUB_TOKEN locally.

    Deployments without explicit success/failure states are excluded. With no
    deployments, merged PRs are emitted as explicit deployment proxies. Incident
    issues require `tenhaw-deployment`, `tenhaw-started` and optional
    `tenhaw-restored` markers in their body. Issue closure is not restoration.
    """
    token = _required("GITHUB_TOKEN")
    start = _date(since)
    end = _date(until) if until else datetime.now(timezone.utc)
    if end <= start:
        raise ValueError("until must be later than since")
    if not repos or any(not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) for repo in repos):
        raise ValueError("repos must contain owner/repository names")

    def fetch() -> list[Event]:
        events: list[Event] = []
        with httpx.Client(
            base_url="https://api.github.com",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=20,
            follow_redirects=False,
        ) as client:
            for repo in repos:
                prefix = f"/repos/{repo}"
                deployments = _github_pages(client, prefix + "/deployments")
                default_branch = _get(client, prefix).get("default_branch", "main") if not deployments else ""
                commits: dict[str, Event] = {}
                for deployment in deployments:
                    timestamp = deployment.get("created_at")
                    if not timestamp or _date(timestamp) >= end:
                        continue
                    timestamp = str(timestamp)
                    statuses = _github_pages(client, prefix + f"/deployments/{deployment['id']}/statuses")
                    final = next(
                        (
                            status
                            for status in statuses
                            if status.get("state")
                            in {
                                "success",
                                "failure",
                                "error",
                            }
                            and _date(status.get("created_at", timestamp)) < end
                        ),
                        None,
                    )
                    if final is None:
                        continue
                    observed = final.get("created_at", timestamp)
                    if not start <= _date(observed) < end:
                        continue
                    metadata = (deployment.get("payload") or {}).get("tenhaw") or {}
                    change_failure = metadata.get("changeFailure") is True
                    if final["state"] != "success" and not change_failure:
                        continue
                    sha = deployment.get("sha", "")
                    if sha and sha not in commits:
                        commit = _get(client, prefix + "/commits/" + sha)
                        date = commit.get("commit", {}).get("committer", {}).get("date")
                        if date:
                            commits[sha] = {
                                "id": f"{repo}:commit:{sha}",
                                "type": "commit",
                                "timestamp": date,
                                "service": repo,
                            }
                    events.append(
                        {
                            "id": f"{repo}:deployment:{deployment['id']}",
                            "type": "deployment",
                            "timestamp": observed,
                            "service": repo,
                            "environment": deployment.get("environment", "production"),
                            "commitIds": [f"{repo}:commit:{sha}"] if sha in commits else [],
                            "status": "failed" if change_failure else "success",
                            **(
                                {"rework": metadata["rework"]}
                                if isinstance(metadata.get("rework"), bool)
                                else {}
                            ),
                        }
                    )
                pulls = _github_pages(
                    client,
                    prefix + "/pulls",
                    {
                        "state": "closed",
                        "sort": "updated",
                        "direction": "desc",
                    },
                )
                for pull in pulls:
                    merged = pull.get("merged_at")
                    if not merged or not start <= _date(merged) < end:
                        continue
                    detail = _get(client, prefix + f"/pulls/{pull['number']}")
                    reviews = _github_pages(client, prefix + f"/pulls/{pull['number']}/reviews")
                    reviewed = sorted(
                        review["submitted_at"]
                        for review in reviews
                        if review.get("submitted_at") and _date(review["submitted_at"]) <= _date(merged)
                    )
                    event: Event = {
                        "id": f"{repo}:pr:{pull['number']}",
                        "type": "pull-request",
                        "service": repo,
                        "createdAt": pull["created_at"],
                        "mergedAt": merged,
                        "additions": detail.get("additions", 0),
                        "deletions": detail.get("deletions", 0),
                    }
                    if reviewed:
                        event["firstReviewAt"] = reviewed[0]
                    events.append(event)
                    if not deployments and pull.get("base", {}).get("ref") == default_branch:
                        events.append(
                            {
                                "id": f"{repo}:merge-proxy:{pull['number']}",
                                "type": "deployment",
                                "timestamp": merged,
                                "service": repo,
                                "environment": "production",
                                "commitIds": [],
                                "status": "success",
                                "proxy": True,
                            }
                        )
                issues = _github_pages(
                    client,
                    prefix + "/issues",
                    {
                        "labels": "incident",
                        "state": "all",
                        "since": since,
                    },
                )
                for issue in issues:
                    if "pull_request" in issue:
                        continue
                    body = issue.get("body") or ""
                    marker = re.search(r"tenhaw-deployment:[ \t]*(\S+)", body)
                    started = re.search(r"tenhaw-started:[ \t]*(\S+)", body)
                    restored = re.search(r"tenhaw-restored:[ \t]*(\S+)", body)
                    if marker is None or started is None:
                        continue
                    _date(started[1])
                    incident: Event = {
                        "id": f"{repo}:incident:{issue['number']}",
                        "type": "incident",
                        "service": repo,
                        "deploymentId": f"{repo}:deployment:{marker[1]}",
                        "startedAt": started[1],
                    }
                    if restored:
                        _date(restored[1])
                        incident["restoredAt"] = restored[1]
                    events.append(incident)
                events.extend(commits.values())
        return events

    identity = json.dumps(["github", repos, since, until, hashlib.sha256(token.encode()).hexdigest()])
    return _cached(identity, fetch, (token,), cache, cache_dir, cache_ttl)


def collect_jira(
    jql: str,
    since: str,
    *,
    until: str | None = None,
    status_to_stage: dict[str, str] | None = None,
    cache: bool = True,
    cache_dir: str | Path = ".tenhaw/cache",
    cache_ttl: int = 300,
) -> list[Event]:
    """Collect work-item flow from Jira Cloud's complete changelog pagination.

    Configure status names as `todo`, `active`, `waiting` or `done`.
    No deployment or incident links are inferred from Jira status alone.
    """
    base = _required("JIRA_BASE_URL")
    email = _required("JIRA_EMAIL")
    token = _required("JIRA_API_TOKEN")
    url = urlsplit(base)
    if (
        url.scheme != "https"
        or not url.hostname
        or not url.hostname.endswith(".atlassian.net")
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in ("", "/")
    ):
        raise ValueError("JIRA_BASE_URL must be an HTTPS Jira Cloud site origin")
    start = _date(since)
    end = _date(until) if until else datetime.now(timezone.utc)
    if end <= start:
        raise ValueError("until must be later than since")
    mapping = {key.lower(): value for key, value in (status_to_stage or {}).items()}
    if not mapping:
        raise ValueError("Jira collection requires status_to_stage mappings for active and done statuses")
    if any(value not in {"todo", "active", "waiting", "done"} for value in mapping.values()):
        raise ValueError("status_to_stage values must be todo, active, waiting or done")

    def fetch() -> list[Event]:
        events: list[Event] = []
        with httpx.Client(
            base_url=base.rstrip("/"),
            auth=(email, token),
            timeout=20,
            follow_redirects=False,
            headers={"Accept": "application/json"},
        ) as client:
            page_token: str | None = None
            seen_tokens: set[str] = set()
            while True:
                params: Json = {"jql": jql, "maxResults": 100, "fields": "created,status,project"}
                if page_token:
                    params["nextPageToken"] = page_token
                data = _get(client, "/rest/api/3/search/jql", params)
                for issue in data.get("issues", []):
                    histories: list[Json] = []
                    offset = 0
                    while True:
                        changes = _get(
                            client,
                            f"/rest/api/3/issue/{issue['id']}/changelog",
                            {
                                "startAt": offset,
                                "maxResults": 100,
                            },
                        )
                        values = changes.get("values", [])
                        histories.extend(values)
                        offset += len(values)
                        if changes.get("isLast", False) or offset >= changes.get("total", 0) or not values:
                            break
                    transitions = sorted(
                        [
                            {"at": history["created"], "status": item.get("toString", "")}
                            for history in histories
                            for item in history.get("items", [])
                            if item.get("field") == "status"
                        ],
                        key=lambda transition: _date(transition["at"]),
                    )
                    active_at: str | None = None
                    done_at: str | None = None
                    active_seconds = 0.0
                    previous_stage = "todo"
                    previous_date: str | None = None
                    for transition in transitions:
                        if _date(transition["at"]) >= end:
                            break
                        stage = mapping.get(transition["status"].lower(), "")
                        if previous_stage == "active" and previous_date:
                            active_seconds += max(
                                0, (_date(transition["at"]) - _date(previous_date)).total_seconds()
                            )
                        if stage == "active" and active_at is None:
                            active_at = transition["at"]
                        if stage == "done":
                            done_at = transition["at"]
                        elif stage:
                            done_at = None
                        previous_stage, previous_date = stage, transition["at"]
                    if active_at is None:
                        continue
                    if done_at and _date(done_at) < start:
                        continue
                    event: Event = {
                        "id": f"jira:{url.hostname}:{issue['key']}",
                        "type": "work-item",
                        "service": issue["fields"]["project"]["key"],
                        "startedAt": active_at,
                    }
                    if done_at:
                        event["completedAt"] = done_at
                        if mapping:
                            event["activeMinutes"] = active_seconds / 60
                    events.append(event)
                page_token = data.get("nextPageToken")
                if data.get("isLast", False) or not page_token:
                    break
                if page_token in seen_tokens:
                    raise CollectorError("Jira repeated a pagination token")
                seen_tokens.add(page_token)
        return events

    identity = json.dumps(
        [
            "jira",
            base,
            jql,
            since,
            until,
            sorted(mapping.items()),
            hashlib.sha256(f"{email}:{token}".encode()).hexdigest(),
        ]
    )
    return _cached(identity, fetch, (token, email), cache, cache_dir, cache_ttl)


__all__ = ["collect_github", "collect_jira", "CollectorError", "MissingCredentialsError"]
