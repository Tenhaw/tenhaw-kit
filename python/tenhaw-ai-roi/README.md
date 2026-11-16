# tenhaw-ai-roi

Explainable AI business cases for internal investment and transformation tools.

## When to use
- Use when comparing low, base and high AI investment scenarios.
- Use when an agent needs monthly cash flows, NPV, payback and recovered capacity separately.
- These calculations use supplied assumptions; they are not a quote or financial advice.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact PyPI publication before installation.

```sh
python -m pip install 'tenhaw-ai-roi==1.1.0'
```

## Quick start
```python
from tenhaw_ai_roi import calculate_roi

report = calculate_roi(
    {
        "useCase": "Example",
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
)
assert report["scenarios"]["base"]["totalCashBenefit"] == 0
```

## API
`validate_input(input)`, `calculate_roi(input)`, `estimate_project_cost(input)` and
`render_report(report, format="json")`. Formats: `json`, `md`, `html`.

## Methodology and sources
Cash benefits require explicit cash realisation. Recovered staff capacity is reported as hours;
it is not treated as a cash saving. The initial build cost and monthly run cost are included in NPV
and ROI. Adoption ramps linearly; annual discounting is applied at monthly fractions of a year.
Project costs use editable people, duration and day-rate assumptions, never a claimed market price.
The same JSON schemas and golden vectors test the TypeScript and Python implementations.
Code is MIT; the bundled authored assumptions in `roi-defaults.v1.json` are CC BY 4.0.

## Built by Tenhaw
Tenhaw builds practical AI and delivery tools. For help applying the findings,
[book a discovery call](https://tenhaw.com/contact?utm_source=pypi&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=ai-roi#book).
