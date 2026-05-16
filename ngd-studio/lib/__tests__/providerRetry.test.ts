import { describe, expect, it } from "vitest";
import {
  MAX_PROVIDER_ATTEMPTS,
  createProviderAttemptLog,
  createProviderRetryLog,
  runProviderWithRetry,
  shouldRetryProviderAttempt,
} from "../ai/retry";

describe("provider retry policy", () => {
  it("retries after one failure and returns the second successful result", async () => {
    const attempts: number[] = [];
    const result = await runProviderWithRetry(async (attempt) => {
      attempts.push(attempt);
      return attempt === 1
        ? { ok: false, error: new Error("exit 1") }
        : { ok: true, value: "done" };
    });

    expect(result).toEqual({ ok: true, attempts: 2, value: "done" });
    expect(attempts).toEqual([1, 2]);
  });

  it("stops after three failed attempts", async () => {
    const attempts: number[] = [];
    const result = await runProviderWithRetry(async (attempt) => {
      attempts.push(attempt);
      return { ok: false, error: `failed ${attempt}` };
    });

    expect(result).toEqual({ ok: false, attempts: MAX_PROVIDER_ATTEMPTS, error: "failed 3" });
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("does not retry aborted attempts", async () => {
    const attempts: number[] = [];
    const result = await runProviderWithRetry(async (attempt) => {
      attempts.push(attempt);
      return { ok: false, aborted: true, error: "client disconnected" };
    });

    expect(result).toEqual({ ok: false, attempts: 1, error: "client disconnected", aborted: true });
    expect(attempts).toEqual([1]);
  });

  it("retries only provider process failures and spawn errors before max attempts", () => {
    expect(shouldRetryProviderAttempt({ attempt: 1, exitCode: 1 })).toBe(true);
    expect(shouldRetryProviderAttempt({ attempt: 1, providerFailed: true })).toBe(true);
    expect(shouldRetryProviderAttempt({ attempt: 1, spawnError: true })).toBe(true);
    expect(shouldRetryProviderAttempt({ attempt: 1, exitCode: 0, providerFailed: false })).toBe(false);
    expect(shouldRetryProviderAttempt({ attempt: 1, exitCode: 1, aborted: true })).toBe(false);
    expect(shouldRetryProviderAttempt({ attempt: 3, exitCode: 1 })).toBe(false);
  });

  it("formats attempt SSE log messages", () => {
    expect(createProviderAttemptLog("codex", 1)).toBe("AI provider attempt 1/3 시작 (codex)");
    expect(createProviderRetryLog("claude", 2)).toBe("AI provider attempt 2/3 실패, 같은 provider(claude)로 재시도합니다.");
  });
});
