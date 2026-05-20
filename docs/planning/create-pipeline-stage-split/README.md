# create-pipeline-stage-split

## 배경

`/create` 페이지의 PDF 업로드 → HWPX 빌드 파이프라인은 한 번의 "빌드" 클릭으로 6개 stage(extractor → solver → verifier → figure → builder → checker)를 끝까지 돌리는 "한 덩어리" 구조다. 이미 분리되어 있는 축은 다음 셋뿐:

- `defaultProvider` + stage별 `stageOverrides` (`create.extractor/solver/verifier`)
- `figureRegen` 토글 (Gemini 재생성 on/off)
- `resumeFrom` (백엔드는 6개 stage 모두 진입 지원, UI는 일부만 노출)

남은 결합점을 **저/중 비용** 범위에서 풀어, 사용자가 부분 실행 / 재시작 / 단계 스킵을 쉽게 제어할 수 있게 한다.

## 우선순위 저/중 4개 항목

1. **checker `maxAttempts` 파라미터화** — `server/stages/orchestrator.ts:698`의 하드코딩 `2`를 settings 노출.
2. **verifier skip 옵션** — `create.verifier`만 따로 건너뛸 수 있게 (solver 결과로 figure 진입).
3. **figure/builder/checker 독립 진입 UI 노출** — 백엔드는 이미 `resumeFrom` 지원, 프론트에서 선택만 노출.
4. **"추출 편집 → solver 재실행" 버튼** — `ExtractionEditor`의 persist(`PUT /api/extracted-json?q=N`) 이후 `resumeFrom: "solver"`로 부분 재시작.

## 핵심 파일

| 영역 | 경로 | 주요 라인 |
|------|------|----------|
| 설정 타입 | `ngd-studio/lib/ai/settings.ts` | L11-35 (AISettings) |
| 오케스트레이터 | `ngd-studio/server/stages/orchestrator.ts` | L38-44 (input), L274-277 (skipVerifier), L384-498 (verifier block), L696-699 (checker maxAttempts) |
| 재시작 분기 | `ngd-studio/server/stages/resumeState.ts` | L85-113 (determineStartStage), L184-186 (shouldRunStage) |
| SSE 진입 | `ngd-studio/server/sse.ts` | L134-138 (request body), L312-321 (orchestrator 호출) |
| 프론트 진입 | `ngd-studio/app/create/page.tsx` | L188 (resumeFrom state), L223-262 (handleResume) |
| useJobRunner | `ngd-studio/lib/useJobRunner.ts` | L49-106 (body 조립) |
| Settings UI | `ngd-studio/app/settings/page.tsx` | L469-525 (stage matrix), L528-563 (figureRegen) |
| Extraction Editor | `ngd-studio/components/results/question-result/ExtractionEditor.tsx` | L68 (PUT persist) |

## 비목표 (Out of scope)

- extractor ↔ solver 결합 해제 (output 스키마 의존성 큼, 고비용 항목)
- solver/verifier를 직렬로 분리 (현재 verifier feedback 루프 안에 retry solver가 포함되어 있어 구조 변경 큼)
- Legacy `runLegacyPromptJob` 경로 변경 (자동 분기, override 미지정 시 사용)
