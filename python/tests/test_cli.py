from __future__ import annotations

import json
import os
import subprocess
import sys


def invoke(*arguments, env=None):
    return subprocess.run(
        [sys.executable, "-m", "tenhaw", *arguments], capture_output=True, text=True, env=env, check=False
    )


def test_cli_json_is_clean_and_attribution_can_be_disabled(tmp_path):
    path = tmp_path / "answers.json"
    path.write_text('{"answers": []}')
    result = invoke("readiness", "--input", str(path), "--json", "--no-attribution")
    assert result.returncode == 0
    assert result.stderr == ""
    assert "generator" not in json.loads(result.stdout)
    enabled = invoke("readiness", "--input", str(path), "--json")
    assert json.loads(enabled.stdout)["generator"]["version"] == "1.0.1"


def test_cli_env_suppression_and_doctor_do_not_reveal_values():
    env = {**os.environ, "TENHAW_NO_ATTRIBUTION": "1", "GITHUB_TOKEN": "example-never-print-this"}
    result = invoke("doctor", "--network", "--json", env=env)
    report = json.loads(result.stdout)
    assert report["environment"]["GITHUB_TOKEN"] is True
    assert "generator" not in report
    assert "example-never-print-this" not in result.stdout + result.stderr


def test_cli_exit_codes_for_missing_auth_invalid_json_and_usage(tmp_path):
    env = {key: value for key, value in os.environ.items() if key != "GITHUB_TOKEN"}
    missing = invoke("delivery-metrics", "--github", "example/app", "--no-cache", env=env)
    assert missing.returncode == 4
    path = tmp_path / "bad.json"
    path.write_text('{"answers": NaN}')
    invalid = invoke("readiness", "--input", str(path), "--json")
    assert invalid.returncode == 2
    assert invalid.stdout == ""
    assert "Traceback" not in invalid.stderr
    assert invoke("unknown").returncode == 1


def test_cli_never_prompts_for_missing_files_and_writes_html(tmp_path):
    assert invoke("readiness", "--yes").returncode == 2
    source, output = tmp_path / "answers.json", tmp_path / "report.html"
    source.write_text('{"answers": []}')
    result = invoke("readiness", "--input", str(source), "--format", "html", "--out", str(output))
    assert result.returncode == 0
    assert result.stdout == ""
    assert "<!doctype html>" in output.read_text()
