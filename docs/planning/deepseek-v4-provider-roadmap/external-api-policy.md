# External API transfer policy

Created: 2026-05-16

## Decision

DeepSeek V4 and other external API providers may receive every input type used by NGD Studio when the user has opted in to that provider for the job or stage.

Allowed transfer types:

- Original PDF files
- Original and generated HWPX files
- Problem image files such as PNG and JPG
- Extracted JSON, solution JSON, review JSON, and intermediate text
- School name, grade, subject, semester, exam type, range, question count, and other exam metadata
- Stage prompts and local checker summaries needed to complete the selected workflow

No file type is categorically blocked by policy. This is an explicit product decision for this roadmap.

## Sensitive Data Treatment

Problem images, school names, exam metadata, source PDFs, and HWPX documents are treated as sensitive exam material even though transfer is allowed. The UI and execution layer must not send them to an external provider unless the user has selected that provider through an opt-in control.

## Opt-In And Overrides

External API providers are opt-in only.

- `deepseek-v4` must not be selected by `auto` fallback.
- A global default provider may include external providers only after the settings UI exposes that choice intentionally.
- Stage overrides may select `deepseek-v4` for any supported stage.
- Job-level or stage-level explicit selection takes precedence over recommendations.

The initial supported stage keys are:

- `create.extractor`
- `create.solver`
- `create.verifier`
- `review.reviewer`

## Logging

Request and response bodies must not be written to job metadata by default. Job records may store operational metadata:

- requested provider
- resolved provider
- stage key
- attempt number
- status
- elapsed milliseconds
- retry flag
- short error summary
- optional external API cost fields when a provider exposes them

Retention follows the existing local job metadata retention behavior. No separate long-term external request archive is introduced in this roadmap.

## Retry Policy

External provider failures may be retried with the same provider using the existing provider retry limit. Retries must stop when the user cancels the job.

## Local Reverification

External provider output must remain compatible with local verification. When a stage has a Claude/Codex checker or deterministic local validation path, the external result should be rechecked locally before being treated as final.

## Implementation Gate

Phase 2 and later may implement DeepSeek V4 against this policy. Implementations must preserve these constraints:

- No automatic external API fallback from `auto`.
- No request/response body persistence in job metadata.
- Explicit user selection or stage override is required before external transfer.
- Provider telemetry records metadata only, not full exam payloads.
