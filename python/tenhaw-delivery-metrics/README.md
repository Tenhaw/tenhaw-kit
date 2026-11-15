# tenhaw-delivery-metrics

DORA and flow metrics for engineers building internal delivery dashboards.

## When to use
- Use for deterministic metrics from supplied deployment, incident, commit and work-item events.
- Use for local GitHub and Jira Cloud collection with the user's own environment credentials.
- Do not use merge proxies as evidence of real production deployments or to rank individuals.

## Install
```sh
pip install tenhaw-delivery-metrics
```

## Quick start
```python
from tenhaw_delivery_metrics import compute_metrics

report = compute_metrics([], {"since": "2026-01-01T00:00:00Z", "until": "2026-02-01T00:00:00Z"})
assert report["metrics"]["changeFailRate"]["value"] is None
```

## API
`compute_metrics(events, config)`, `score_delivery_health(report)`, `collect_github(repos, since,
until=None, cache=True)` and `collect_jira(jql, since, status_to_stage=...)`.

Collectors run locally. Set `GITHUB_TOKEN`, or `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN`.
GitHub tokens need read-only metadata, contents, deployments, pull requests and issues access.
Jira status names must be mapped to `todo`, `active`, `waiting` or `done`. GitHub incident issues
need `tenhaw-deployment: <id>`, `tenhaw-started: <ISO timestamp>` and optional
`tenhaw-restored: <ISO timestamp>` markers. Closing an issue does not prove service restoration.
A failed deployment job does not prove a production change failure: `failure`/`error` statuses
are excluded unless the deployment payload explicitly sets `tenhaw.changeFailure: true`.
Successes and explicitly linked production incidents support change-failure measurement;
collectors cannot prove that the supplied incident dataset is complete. Collector caches
contain normalised events, never raw API responses or tokens. Use `cache=False` to disable them.

## Methodology and sources
[DORA's current five metrics](https://dora.dev/guides/dora-metrics-four-keys/) are reported with
sample sizes, explicit deployment/incident linkage and caveats. Missing evidence returns null
where appropriate. Merges used as deployment proxies are flagged. No composite health grade or
unsourced performance bands are generated. Periods are half-open UTC intervals `[since, until)`.

## Built by Tenhaw
Tenhaw builds practical AI and delivery tools. For help applying the findings,
[book a discovery call](https://tenhaw.com/contact?utm_source=pypi&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=delivery-metrics#book).
