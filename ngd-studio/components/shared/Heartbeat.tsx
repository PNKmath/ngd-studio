"use client";

import { useEffect } from "react";

const SSE_BASE = process.env.NEXT_PUBLIC_SSE_URL ?? "http://localhost:3021";
const INTERVAL = 10_000; // 10초

/**
 * SSE 서버에 주기적으로 heartbeat를 전송.
 * 브라우저가 닫히면 heartbeat가 중단되고, SSE 서버가 자동 종료됨.
 */
export function Heartbeat() {
  useEffect(() => {
    const ping = () => {
      fetch(`${SSE_BASE}/api/heartbeat`).catch(() => {});
    };

    // 즉시 1회 + 이후 주기적
    ping();
    const id = setInterval(ping, INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}
