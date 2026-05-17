/**
 * Branch-decision helpers for SSE request routing.
 *
 * Kept in a separate module (no server side-effects) so unit tests can import
 * these helpers without triggering the HTTP server startup in sse.ts.
 */
import type { AIStageKey } from "../../lib/ai/types";
import type { StageOverrideMap } from "../../lib/ai/settings";

/**
 * Determines whether the new code orchestrator should be used for this request.
 *
 * The code orchestrator handles create/resume flows when the user has explicitly
 * overridden at least one create.* stage provider in settings. The `auto` default
 * (empty stageOverrides) continues to use the legacy path so existing users are
 * unaffected.
 *
 * `mode=review` always returns false — review flows use the legacy path.
 */
export function shouldUseCodeOrchestrator(
  mode: string,
  stageOverrides: StageOverrideMap
): boolean {
  if (mode !== "create" && mode !== "resume") return false;
  const createStageKeys: AIStageKey[] = ["create.extractor", "create.solver", "create.verifier"];
  return createStageKeys.some((k) => stageOverrides[k] !== undefined);
}
