import { NextResponse } from "next/server";
import { execSync } from "child_process";
import os from "os";
import { getQueueStatus } from "@/lib/queue";

const IS_WINDOWS = os.platform() === "win32";

export async function GET() {
  let cliAvailable = false;
  let cliVersion = "";

  try {
    // Windows: WSL 경유로 claude 확인 (login shell로 올바른 PATH 사용)
    const cmd = IS_WINDOWS
      ? 'wsl.exe -- bash -lc "claude --version 2>/dev/null"'
      : "claude --version 2>/dev/null";

    const result = execSync(cmd, { timeout: 10000 }).toString().trim();
    if (result) {
      cliAvailable = true;
      cliVersion = result;
    }
  } catch {
    cliAvailable = false;
  }

  const queueStatus = getQueueStatus();

  return NextResponse.json({
    cli: {
      available: cliAvailable,
      version: cliVersion,
    },
    queue: queueStatus,
    timestamp: new Date().toISOString(),
  });
}
