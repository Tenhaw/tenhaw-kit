from __future__ import annotations

import json

import httpx
import pytest
import respx
from tenhaw_delivery_metrics.collectors import (
    CollectorError,
    MissingCredentialsError,
    _get,
    _github_pages,
    collect_github,
    collect_jira,
)

GITHUB = "https://api.github.com/repos/example/app"


@respx.mock
@pytest.mark.parametrize("payload,count", [({}, 0), ({"tenhaw": {"changeFailure": True}}, 1)])
def test_failed_job_is_not_a_production_failure_without_explicit_evidence(monkeypatch, payload, count):
    monkeypatch.setenv("GITHUB_TOKEN", "example-read-only-token")
    respx.get(GITHUB + "/deployments").respond(
        200,
        json=[
            {
                "id": 1,
                "created_at": "2026-01-02T00:00:00Z",
                "environment": "production",
                "payload": payload,
            }
        ],
    )
    respx.get(GITHUB + "/deployments/1/statuses").respond(
        200,
        json=[
            {
                "state": "failure",
                "created_at": "2026-01-02T00:10:00Z",
            }
        ],
    )
    respx.get(GITHUB + "/pulls").respond(200, json=[])
    respx.get(GITHUB + "/issues").respond(200, json=[])
    events = collect_github(["example/app"], "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", cache=False)
    assert len(events) == count
    if events:
        assert events[0]["status"] == "failed"


@respx.mock
def test_github_uses_namespaced_ids_and_does_not_infer_restoration(monkeypatch, tmp_path):
    monkeypatch.setenv("GITHUB_TOKEN", "example-read-only-token")
    respx.get(GITHUB + "/deployments").respond(
        200,
        json=[
            {
                "id": 1,
                "created_at": "2026-01-02T00:00:00Z",
                "sha": "abc",
                "environment": "production",
            }
        ],
    )
    respx.get(GITHUB + "/deployments/1/statuses").respond(
        200,
        json=[
            {
                "state": "success",
                "created_at": "2026-01-02T00:10:00Z",
            }
        ],
    )
    respx.get(GITHUB + "/commits/abc").respond(
        200,
        json={
            "commit": {"committer": {"date": "2026-01-01T00:00:00Z"}},
        },
    )
    respx.get(GITHUB + "/pulls").respond(200, json=[])
    respx.get(GITHUB + "/issues").respond(
        200,
        json=[
            {
                "number": 9,
                "created_at": "2026-01-03T00:00:00Z",
                "closed_at": "2026-01-04T00:00:00Z",
                "body": "tenhaw-deployment: 1\ntenhaw-started: 2026-01-03T00:00:00Z\nexample-read-only-token",
            }
        ],
    )
    events = collect_github(
        ["example/app"], "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", cache_dir=tmp_path
    )
    deployment, incident, commit = events
    assert deployment["id"] == "example/app:deployment:1"
    assert deployment["commitIds"] == [commit["id"]]
    assert incident["deploymentId"] == deployment["id"]
    assert "restoredAt" not in incident
    assert "example-read-only-token" not in json.dumps(events)
    assert "example-read-only-token" not in next(tmp_path.glob("*.json")).read_text()


@respx.mock
def test_cache_is_scoped_to_credential_principal(monkeypatch, tmp_path):
    route = respx.get(GITHUB + "/deployments").respond(200, json=[])
    respx.get(GITHUB).respond(200, json={"default_branch": "main"})
    respx.get(GITHUB + "/pulls").respond(200, json=[])
    respx.get(GITHUB + "/issues").respond(200, json=[])
    arguments = (["example/app"], "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
    monkeypatch.setenv("GITHUB_TOKEN", "example-principal-one")
    collect_github(*arguments, cache_dir=tmp_path)
    collect_github(*arguments, cache_dir=tmp_path)
    assert route.call_count == 1
    monkeypatch.setenv("GITHUB_TOKEN", "example-principal-two")
    collect_github(*arguments, cache_dir=tmp_path)
    assert route.call_count == 2
    assert len(list(tmp_path.glob("*.json"))) == 2


@respx.mock
def test_github_pagination_consumes_all_pages():
    route = respx.get("https://api.github.com/example").mock(
        side_effect=[
            httpx.Response(200, json=[{"number": index} for index in range(100)]),
            httpx.Response(200, json=[{"number": 100}]),
        ]
    )
    with httpx.Client(base_url="https://api.github.com") as client:
        assert len(_github_pages(client, "/example")) == 101
    assert route.call_count == 2
    assert route.calls[1].request.url.params["page"] == "2"


@respx.mock
def test_retry_after_is_honoured_and_tokens_never_appear_in_errors(monkeypatch):
    delays = []
    monkeypatch.setattr("tenhaw_delivery_metrics.collectors.time.sleep", delays.append)
    respx.get("https://api.github.com/example").mock(
        side_effect=[
            httpx.Response(429, headers={"Retry-After": "1"}, text="sensitive body"),
            httpx.Response(503, text="sensitive body"),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    with httpx.Client(base_url="https://api.github.com") as client:
        assert _get(client, "/example") == {"ok": True}
    assert delays == [1, 2]


@respx.mock
def test_jira_paginates_search_and_full_changelog(monkeypatch):
    monkeypatch.setenv("JIRA_BASE_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "example@example.test")
    monkeypatch.setenv("JIRA_API_TOKEN", "example-jira-token")
    search = respx.get("https://example.atlassian.net/rest/api/3/search/jql").mock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "issues": [
                        {
                            "id": "1",
                            "key": "APP-1",
                            "fields": {
                                "project": {"key": "APP"},
                            },
                        }
                    ],
                    "nextPageToken": "next",
                    "isLast": False,
                },
            ),
            httpx.Response(200, json={"issues": [], "isLast": True}),
        ]
    )
    changelog = respx.get("https://example.atlassian.net/rest/api/3/issue/1/changelog").mock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "values": [
                        {
                            "created": "2026-01-01T00:00:00Z",
                            "items": [
                                {"field": "status", "toString": "Working"},
                            ],
                        }
                    ],
                    "isLast": False,
                    "total": 2,
                },
            ),
            httpx.Response(
                200,
                json={
                    "values": [
                        {
                            "created": "2026-01-01T02:00:00Z",
                            "items": [
                                {"field": "status", "toString": "Complete"},
                            ],
                        }
                    ],
                    "isLast": True,
                    "total": 2,
                },
            ),
        ]
    )
    events = collect_jira(
        "project = APP",
        "2026-01-01T00:00:00Z",
        cache=False,
        status_to_stage={"Working": "active", "Complete": "done"},
    )
    assert events[0]["activeMinutes"] == 120
    assert events[0]["completedAt"] == "2026-01-01T02:00:00Z"
    assert search.call_count == 2
    assert search.calls[1].request.url.params["nextPageToken"] == "next"
    assert changelog.calls[1].request.url.params["startAt"] == "1"


def test_missing_credentials_and_untrusted_jira_urls_fail_before_network(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    with pytest.raises(MissingCredentialsError):
        collect_github(["example/app"], "2026-01-01T00:00:00Z")
    monkeypatch.setenv("JIRA_BASE_URL", "https://example.atlassian.net.attacker.test")
    monkeypatch.setenv("JIRA_EMAIL", "example@example.test")
    monkeypatch.setenv("JIRA_API_TOKEN", "example-jira-token")
    with pytest.raises(ValueError, match="origin"):
        collect_jira("project = APP", "2026-01-01T00:00:00Z", status_to_stage={"Working": "active"})


@respx.mock
def test_long_rate_limit_fails_without_retrying_early():
    route = respx.get("https://api.github.com/example").respond(429, headers={"Retry-After": "600"})
    with httpx.Client(base_url="https://api.github.com") as client:
        with pytest.raises(CollectorError, match="longer than 60"):
            _get(client, "/example")
    assert route.call_count == 1
