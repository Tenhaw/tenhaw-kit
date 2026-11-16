# tenhaw-ai-readiness

Deterministic AI readiness self-assessment for engineers building internal assessment tools.

## When to use
- Use when building an evidence-aware, scored organisational AI readiness assessment.
- Use when an agent needs the questionnaire, weights, coverage and repeatable recommendations.
- This self-assessment supports discussion; it is not certification or legal advice.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact PyPI publication before installation.

```sh
python -m pip install 'tenhaw-ai-readiness==1.1.0'
```

## Quick start
```python
from tenhaw_ai_readiness import score_readiness

report = score_readiness({"answers": [{"questionId": "strategy-1", "score": 3}]})
assert report["overall"] == 3
assert report["band"] is None  # Coverage is below 80%.
```

## API
`load_framework(version="v1")`, `validate_responses(input)`, `score_readiness(input, weights=None)`
and `render_report(report, format="json")` are local functions. Formats: `json`, `md`, `html`.
Validation errors identify JSON paths. All domain outputs omit marketing attribution.

## Methodology and sources
The shared versioned framework averages answered questions within dimensions and weights the
answered dimensions. Coverage is a completeness measure, not statistical confidence. At least
80% overall response coverage is required to show a maturity band. An empty assessment returns
`overall: null`. This scored organisational self-assessment is distinct from Tenhaw's nine-question,
workflow-specific advisory assessment. Framework content is CC BY 4.0; code is MIT.

## Built by Tenhaw
Tenhaw builds practical AI and delivery tools. For help applying the findings,
[book a discovery call](https://tenhaw.com/contact?utm_source=pypi&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=ai-readiness#book).
