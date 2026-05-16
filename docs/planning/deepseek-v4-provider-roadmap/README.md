# DeepSeek V4 provider roadmap

이 task는 `docs/planning/ai-provider-adapters/roadmap.md`의 후속 구현 순서를 `/phase-run`이 실행 가능한 phase 계획으로 분해한다.

현재 상태:
- `ngd-studio/lib/ai/types.ts`는 `deepseek-v4` provider id를 타입에 포함한다.
- `ngd-studio/lib/ai/registry.ts`는 `deepseek-v4` 값을 정규화할 수 있지만 adapter는 등록하지 않는다.
- `ngd-studio/lib/ai/settings.ts`와 `ngd-studio/app/settings/page.tsx`는 `auto`, `claude`, `codex`만 선택 가능하게 둔다.
- `ngd-studio/.env.example`에는 DeepSeek placeholder가 있지만 실행 provider는 아니다.

핵심 제약:
- 외부 API 전송 정책은 2026-05-16에 "workflow에 필요한 입력 전체 전송 가능"으로 확정되었다.
- 전송 가능 범위에는 PDF, HWPX, 문제 이미지, 추출 JSON, 해설 JSON, 학교/시험 메타데이터가 포함된다.
- 단, DeepSeek V4는 파일 수정 agent가 아니며, 서버가 schema validation과 deterministic validation을 수행하는 typed stage 안에서만 사용한다.
- 우선 적용 stage는 `create.verifier`, `create.solver`, `review.reviewer` report draft처럼 입력/출력이 검증 가능한 단계로 제한한다.

2026-05-16 재평가:
- 이 roadmap에서 구현한 내용은 DeepSeek V4 API 호출 배관 prototype으로 본다.
- DeepSeek V4는 Claude/Codex CLI처럼 파일을 직접 수정하는 agent harness가 아니다.
- 실제 활용 전 `strategy-and-harness-decision.md`에 따라 workflow를 typed stage runner로 재분해해야 한다.
- 다음 작업은 DeepSeek용 repo edit harness가 아니라 deterministic code extraction + bounded stage model harness 설계다.

관련 결정 문서:
- [DeepSeek V4 사용 전략 및 하네스 결정](./strategy-and-harness-decision.md)
- [Agent Provider Operating Model](../agent-provider-operating-model/README.md)
- [구현 Roadmap](../agent-provider-operating-model/implementation-roadmap.md)
