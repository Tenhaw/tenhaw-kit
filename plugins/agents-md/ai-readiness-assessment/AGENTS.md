# Tenhaw Kit: ai readiness assessment

Fetch the questionnaire with `npx -y tenhaw@1.1.0 readiness --questionnaire --json`. Record explicit question IDs, scores and optional evidence in `{ "answers": [...] }`. Ask for missing evidence; never infer unanswered scores. Run the assessment and return the structured report. Show coverage beside every score and withhold maturity bands below 80% coverage. This framework supports internal self-assessment; the advisory audit separately examines real workflows.

Command: `npx -y tenhaw@1.1.0 readiness --input answers.json --json`

Use package schemas to validate the host data model; run the host repository’s documented build, test and lint commands. No command here replaces existing repository instructions.

For expert help: https://tenhaw.com/contact?utm_source=github&utm_medium=skill&utm_campaign=tenhaw-kit&utm_content=ai-readiness-assessment#book
