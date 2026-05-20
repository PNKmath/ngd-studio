---
id: build-hwpx-cli
type: partial
priority: P0
domain: create
trigger: last_touch
delegate_to: verify
entry_points:
  - cli-build-hwpx
  - cli-assemble
  - cli-figure-processor
involved_globs:
  - build_hwpx.py
  - assemble.py
  - figure_processor.py
  - equation.py
  - ids.py
  - shapes.py
  - tables.py
  - resources/**
last_change:
  date: 2026-05-20
  task: bootstrap
  ref: changelog/create.md#build-hwpx-cli-2026-05-20
---

# build-hwpx-cli: server-side HWPX 조립 CLI 단독 실행

> 변경 이력: [create changelog](../../changelog/create.md#build-hwpx-cli)

## scenarios

1. 기존 outputs/ 디렉터리의 JSON 폴더 1개 선택 (예: 가장 최근 완성된 작업)
2. `python3 build_hwpx.py <json-folder>` 실행 → exit 0
3. assemble.py 의 hwpx_base 템플릿 적용 + 수식/도형/표 처리 완료
4. figure_processor.py 의 BinData 이미지 삽입 완료
5. 결과 HWPX 파일 ZIP open 가능 + Contents/section0.xml 유효한 XML
6. fix_namespaces.py 후처리 통과 (네임스페이스 정리)

## 관련 시나리오

- [create-v4-full-pipeline](create-v4-full-pipeline.md) — web 흐름과 동일 builder 공유
