# .claude/tests — NGD 무결성 점검 스크립트

## 목적

Phase 3 (V3 SKILL.md 승격)와 Phase 5 (V1/V2 잔재 삭제) 작업 전후에 `.claude/` 내부
참조가 깨지지 않았는지 자동으로 검증한다.

## 실행 방법

```bash
cd /mnt/c/NGD
bash .claude/tests/check_integrity.sh
```

모든 점검 통과 시 `ALL PASS`로 종료 (exit 0).
실패 항목이 있으면 `FAIL: <이유>` 출력 후 즉시 exit 1.

## 검증 항목

| # | 항목 | 설명 |
|---|------|------|
| 1 | **agent 6종 실존** | `ngd-exam-{extractor,solver,verifier,figure,builder,checker}.md` 존재 여부 |
| 2 | **scripts 2종 실존** | `ngd-exam-create/scripts/fix_namespaces.py`, `validate.py` 존재 여부 |
| 3 | **base_hwpx 핵심 템플릿** | `bogi_table_3items.xml`, `choice_table_5x5.xml`, `header_area_template.xml` 존재 여부 |
| 4 | **agent frontmatter** | 모든 `agents/*.md`에 `name:`, `description:` 필드 존재 여부 |
| 5 | **SKILL.md 절대경로 참조** | 활성 SKILL.md 본문의 `/mnt/c/NGD/.claude/...` 경로 실존 여부 |

## 언제 실행해야 하나

- Phase 3 시작 전 (기준선 확인)
- Phase 3 완료 직후 (SKILL.md 이동 후 참조 점검)
- Phase 5 완료 직후 (V1/V2 파일 삭제 후 참조 점검)
