# Agent Provider Operating Model

이 task는 NGD Studio의 Claude Code, Codex, DeepSeek V4, 서버 코드 책임 경계를 다시 정의한다.

현재 `/api/run`은 stage runner가 아니라 Claude/Codex CLI에 큰 prompt를 넘겨 `.claude/skills`와 `.claude/agents`를 실행하게 하는 구조다. 이 방식은 빠르게 workflow를 구성하는 데 유용했지만, orchestration, cache 관리, HWPX 조립, XML 검수처럼 코드가 책임져야 할 작업까지 agent에 의존하게 만든다.

DeepSeek V4 검토 과정에서 확인한 핵심 전제는 다음이다.

- Claude Code/Codex는 로컬 파일과 tool 실행이 가능한 agent provider다.
- DeepSeek V4는 API model provider이며, 파일 수정이나 명령 실행 하네스가 없다.
- DeepSeek를 repo edit agent로 확장하기보다, schema가 고정된 stage model call에 제한하는 편이 맞다.
- 장기 구조는 `typed stage runner + deterministic code + bounded model call`이어야 한다.

성공 기준:

- 현행 provider/agent 의존 구조가 문서화된다.
- stage별 input/output contract 초안이 생긴다.
- 코드화할 작업과 모델에 맡길 작업이 분리된다.
- Claude Code/Codex/DeepSeek의 운영 원칙이 명확해진다.
- 다음 구현 task 후보가 phase-run 가능한 수준으로 정리된다.

관련 문서:

- [DeepSeek V4 사용 전략 및 하네스 결정](../deepseek-v4-provider-roadmap/strategy-and-harness-decision.md)
- [AI provider adapters roadmap](../ai-provider-adapters/roadmap.md)
- [NGD project overview](../../../CLAUDE.md)
