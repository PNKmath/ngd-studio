import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { getQueueStatus } from "@/lib/queue";

export async function GET() {
  let cliAvailable = false;
  let cliVersion = "";

  try {
    const result = execSync("claude --version 2>/dev/null", {
      timeout: 5000,
    }).toString().trim();
    cliAvailable = true;
    cliVersion = result;
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
