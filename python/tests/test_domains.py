from __future__ import annotations

import copy
import json
import math

import pytest
from tenhaw_ai_readiness import load_framework, render_report, score_readiness
from tenhaw_ai_roi import calculate_roi, estimate_project_cost
from tenhaw_delivery_metrics import compute_metrics, score_delivery_health


def roi_input() -> dict:
    return {
        "useCase": "Example workflow",
        "users": 10,
        "minutesPerTask": 20,
        "tasksPerUserPerMonth": 20,
        "savings": {"low": 0.1, "base": 0.2, "high": 0.3},
        "hourlyCost": 50,
        "buildCost": 1000,
        "monthlyRunCost": 100,
        "adoptionMonths": 3,
        "horizonMonths": 12,
        "annualDiscountRate": 0.1,
        "cashRealisation": 0,
        "currency": "GBP",
    }


PERIOD = {"since": "2026-01-01T00:00:00Z", "until": "2026-02-01T00:00:00Z"}


def test_readiness_empty_is_unknown_not_a_low_score():
    report = score_readiness({"answers": []})
    assert report["overall"] is None
    assert report["band"] is None
    assert len(report["dimensions"]) == 6


def test_readiness_band_requires_evidence_coverage_and_framework_is_fresh():
    framework = load_framework()
    answers = [
        {"questionId": question["id"], "score": 5}
        for dimension in framework["dimensions"]
        for question in dimension["questions"]
    ]
    assert score_readiness({"answers": answers[:23]})["band"] is None
    assert score_readiness({"answers": answers[:24]})["band"] == "Leading"
    framework["dimensions"].clear()
    assert len(load_framework()["dimensions"]) == 6


@pytest.mark.parametrize(
    "answers",
    [
        [{"questionId": "strategy-1", "score": 1}] * 2,
        [{"questionId": "unknown-1", "score": 1}],
        [{"questionId": "strategy-1", "score": True}],
        [{"questionId": "strategy-1", "score": math.nan}],
    ],
)
def test_readiness_rejects_bad_answers(answers):
    with pytest.raises(ValueError):
        score_readiness({"answers": answers})


def test_readiness_zero_weight_answer_does_not_create_score():
    report = score_readiness({"answers": [{"questionId": "strategy-1", "score": 4}]}, {"strategy": 0})
    assert report["overall"] is None


def test_readiness_renderer_escapes_html_and_retains_content_credit():
    report = score_readiness({"answers": []})
    report["limitations"].append("<script>alert(1)</script>")
    rendered = render_report(report, "html")
    assert "<script>" not in rendered
    assert "&lt;script&gt;" in rendered
    assert "CC BY 4.0" in rendered
    assert "contentCredit" in json.loads(render_report(report))


def test_roi_never_treats_capacity_as_cash_without_realisation():
    report = calculate_roi(roi_input())["scenarios"]["base"]
    assert report["totalCashBenefit"] == 0
    assert report["recoveredCapacityHours"] == report["totalHoursSaved"]
    assert report["paybackMonth"] is None
    assert report["npv"] < 0


def test_roi_npv_is_monotonic_in_savings_and_cost():
    data = roi_input()
    data["cashRealisation"] = 0.5
    first = calculate_roi(data)
    assert first["scenarios"]["low"]["npv"] <= first["scenarios"]["base"]["npv"]
    assert first["scenarios"]["base"]["npv"] <= first["scenarios"]["high"]["npv"]
    increased_cost = copy.deepcopy(data)
    increased_cost["buildCost"] *= 2
    assert calculate_roi(increased_cost)["scenarios"]["base"]["npv"] < first["scenarios"]["base"]["npv"]


@pytest.mark.parametrize("field", ["users", "buildCost", "minutesPerTask"])
def test_roi_rejects_non_finite_json(field):
    data = roi_input()
    data[field] = float("inf")
    with pytest.raises(ValueError):
        calculate_roi(data)


def test_cost_default_uses_real_stage_range_and_zero_is_invalid():
    result = estimate_project_cost({"stage": "poc"})
    assert (result["low"], result["high"]) == (16000, 32000)
    with pytest.raises(ValueError):
        estimate_project_cost({"stage": "poc", "people": 0})


def test_no_deployments_returns_unknown_failure_rate_and_actions():
    report = compute_metrics([], PERIOD)
    assert report["metrics"]["changeFailRate"]["value"] is None
    assert report["metrics"]["deploymentFrequency"]["value"] is None
    assert len(score_delivery_health(report)["actions"]) == 3


def test_proxies_are_excluded_and_service_aggregation_is_rejected():
    deployment = {
        "id": "d1",
        "type": "deployment",
        "timestamp": "2026-01-10T00:00:00Z",
        "service": "app",
        "environment": "production",
        "status": "success",
        "commitIds": [],
    }
    report = compute_metrics([{**deployment, "proxy": True}], PERIOD)
    assert report["metrics"]["deploymentFrequency"]["value"] is None
    with pytest.raises(ValueError, match="service"):
        compute_metrics([deployment, {**deployment, "id": "d2", "service": "other"}], PERIOD)
    selected = compute_metrics(
        [deployment, {**deployment, "id": "d2", "service": "other"}], {**PERIOD, "service": "app"}
    )
    assert selected["metrics"]["deploymentFrequency"]["sampleSize"] == 1


def test_half_open_window_uses_first_successful_production_delivery():
    events = [
        {"id": "c1", "type": "commit", "timestamp": "2025-12-31T12:00:00Z", "service": "app"},
        {
            "id": "d1",
            "type": "deployment",
            "timestamp": PERIOD["since"],
            "service": "app",
            "environment": "production",
            "status": "success",
            "commitIds": ["c1"],
            "rework": False,
        },
        {
            "id": "d2",
            "type": "deployment",
            "timestamp": PERIOD["until"],
            "service": "app",
            "environment": "production",
            "status": "success",
            "commitIds": ["c1"],
            "rework": False,
        },
    ]
    report = compute_metrics(events, PERIOD)
    assert report["metrics"]["deploymentFrequency"]["sampleSize"] == 1
    assert report["metrics"]["changeLeadTime"]["value"] == 12


def test_failure_links_deduplicate_and_restoration_is_required():
    events = [
        {
            "id": "d1",
            "type": "deployment",
            "timestamp": "2026-01-02T00:00:00Z",
            "service": "app",
            "environment": "production",
            "status": "failed",
            "commitIds": [],
        },
        {
            "id": "i1",
            "type": "incident",
            "startedAt": "2026-01-02T00:30:00Z",
            "service": "app",
            "deploymentId": "d1",
        },
        {
            "id": "i2",
            "type": "incident",
            "startedAt": "2026-01-02T00:30:00Z",
            "service": "app",
            "deploymentId": "d1",
            "restoredAt": "2026-01-02T02:00:00Z",
        },
    ]
    report = compute_metrics(events, PERIOD)
    assert report["metrics"]["changeFailRate"]["value"] == 100
    assert report["metrics"]["failedDeploymentRecoveryTime"]["value"] == 1.5


def test_flow_efficiency_rejects_impossible_active_duration():
    event = {
        "id": "w1",
        "type": "work-item",
        "service": "app",
        "startedAt": "2026-01-02T00:00:00Z",
        "completedAt": "2026-01-02T01:00:00Z",
        "activeMinutes": 61,
    }
    with pytest.raises(ValueError, match="active"):
        compute_metrics([event], PERIOD)


def test_delivery_health_rejects_nonfinite_and_mismatched_periods():
    report = compute_metrics([], PERIOD)
    report["metrics"]["wip"]["value"] = float("inf")
    with pytest.raises(ValueError, match="finite"):
        score_delivery_health(report)
    report = compute_metrics([], PERIOD)
    report["metrics"]["wip"]["period"] = {**PERIOD, "until": "2026-03-01T00:00:00Z"}
    with pytest.raises(ValueError, match="report period"):
        score_delivery_health(report)


@pytest.mark.parametrize(
    "since", ["2026-02-30T00:00:00Z", "2026-02-29T00:00:00Z", "2026-01-01T25:00:00Z", "2026-01-01T00:00:00"]
)
def test_delivery_rejects_invalid_calendar_or_timezone_input(since):
    with pytest.raises(ValueError):
        compute_metrics([], {"since": since, "until": "2026-03-05T00:00:00Z"})


def test_delivery_accepts_lowercase_timezone_markers():
    report = compute_metrics([], {"since": "2026-01-01T00:00:00z", "until": "2026-02-01T00:00:00z"})
    assert report["metrics"]["wip"]["value"] is None


def test_zero_build_payback_requires_cash_recovery_after_adoption_losses():
    data = {
        **roi_input(),
        "users": 1,
        "minutesPerTask": 60,
        "tasksPerUserPerMonth": 10,
        "savings": {"low": 0.3, "base": 0.5, "high": 0.8},
        "hourlyCost": 10,
        "buildCost": 0,
        "monthlyRunCost": 20,
        "horizonMonths": 6,
        "annualDiscountRate": 0,
        "cashRealisation": 1,
    }
    scenarios = calculate_roi(data)["scenarios"]
    assert [scenarios[name]["paybackMonth"] for name in ("low", "base", "high")] == [3, 2, 0]
    for scenario in calculate_roi({**data, "cashRealisation": 0})["scenarios"].values():
        assert scenario["paybackMonth"] is None
        assert scenario["npv"] == -120
    with pytest.raises(ValueError, match="non-finite"):
        calculate_roi({**data, "users": 1e308})
