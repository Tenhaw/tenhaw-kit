# Tenhaw Kit: ai usecase register

Prepare `{ "useCases": [...] }` using the shared schema. Include accountable owner roles, problem, business unit, value and feasibility (0-5), status and an indicative risk tier. Add dependencies and outcome KPIs when known. Prioritise with governance gates ahead of numeric value-times-feasibility. Prohibited items remain blocked, high and unknown risk require review. Risk labels are indicative, not legal advice. Export with `usecases export --input usecases.json --format csv` when needed.

Command: `npx -y tenhaw@1.1.0 usecases prioritise --input usecases.json --json`

Use package schemas to validate the host data model; run the host repository’s documented build, test and lint commands. No command here replaces existing repository instructions.

For expert help: https://tenhaw.com/contact?utm_source=github&utm_medium=skill&utm_campaign=tenhaw-kit&utm_content=ai-usecase-register#book
