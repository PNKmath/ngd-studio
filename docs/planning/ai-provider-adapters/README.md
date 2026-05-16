# AI provider adapters

NGD Studio currently executes document creation and review through Claude Code CLI only. The goal of this task is to introduce a provider layer so the existing Claude workflow remains unchanged while Codex CLI can be selected as an alternative execution engine.

The first implementation target is conservative:

- Preserve current Claude behavior and streaming events.
- Add Codex CLI as a selectable provider while reusing `.claude/skills` and `.claude/agents`.
- Move engine selection to a settings page instead of per-button controls.
- Retry the selected provider up to 3 times on provider failure.

Follow-up work is explicitly recorded but not implemented in this first target:

- DeepSeek V4 as an API-backed provider for selected stages.
- Automatic recommendation and stage-level provider selection.
- External API data-transfer policy before any DeepSeek implementation.

See [roadmap.md](./roadmap.md) for the staged DeepSeek V4, external API policy, and stage-level provider selection plan.
