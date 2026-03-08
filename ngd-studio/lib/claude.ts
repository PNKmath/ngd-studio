// Claude CLI 연동 유틸리티
// Phase 2에서 구현 예정 — 03-api-architecture.md 참조

export interface ClaudeEvent {
  type: "system" | "assistant" | "result";
  subtype?: string;
  message?: {
    role: string;
    content: ContentBlock[];
  };
  result?: string;
  session_id?: string;
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: unknown;
}
