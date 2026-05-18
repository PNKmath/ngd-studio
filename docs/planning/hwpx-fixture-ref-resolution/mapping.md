# Header 정의 매핑 — user → ours

## paraPr (사용자 12개 → 우리 30개)

| user_idx | our_idx | user_align | user_intent | user_borderFillRef→our | user_tabRef→our | 비고 |
|----------|---------|-----------|-------------|------------------------|----------------|------|
| 0 | 11 | LEFT | 0 | 3→1 | 0→0 |  |
| 1 | 1 | LEFT | 0 | 1→1 | 1→1 |  |
| 2 | 10 | CENTER | 0 | 3→1 | 0→0 |  |
| 3 | ? | LEFT | -2056 | 3→1 | 0→0 | unmapped |
| 4 | ? | LEFT | -1695 | 3→1 | 0→0 | unmapped |
| 5 | 11 | LEFT | 0 | 1→1 | 0→0 |  |
| 6 | 11 | LEFT | 0 | 3→1 | 0→0 |  |
| 7 | 10 | CENTER | 0 | 1→1 | 0→0 |  |
| 8 | ? | LEFT | -1656 | 3→1 | 0→0 | unmapped |
| 9 | ? | CENTER | -1695 | 3→1 | 0→0 | unmapped |
| 10 | 11 | LEFT | 0 | 3→1 | 0→0 |  |
| 11 | 29 | CENTER | 0 | 2→2 | 0→0 |  |

**Unmapped paraPr (user idx)**: [3, 4, 8, 9]


## charPr (사용자 21개 → 우리 42개)

| user_idx | our_idx | height | textColor | bold | borderFillRef→our | 비고 |
|----------|---------|--------|-----------|------|-------------------|------|
| 0 | 0 | 1000 | #000000 | Y | 1→1 |  |
| 1 | 3 | 1000 | #000000 | N | 3→1 |  |
| 2 | 3 | 1000 | #000000 | N | 1→1 |  |
| 3 | ? | 1000 | #FFFFFF | N | 3→1 | unmapped |
| 4 | 22 | 1000 | #000000 | N | 2→2 |  |
| 5 | 6 | 400 | #000000 | N | 1→1 |  |
| 6 | 7 | 300 | #000000 | N | 1→1 |  |
| 7 | ? | 1400 | #000000 | Y | 1→1 | unmapped |
| 8 | 0 | 1000 | #000000 | Y | 3→1 |  |
| 9 | ? | 1700 | #000000 | Y | 3→1 | unmapped |
| 10 | ? | 1200 | #000000 | Y | 3→1 | unmapped |
| 11 | ? | 2400 | #000000 | Y | 3→1 | unmapped |
| 12 | 25 | 100 | #000000 | N | 3→1 |  |
| 13 | 27 | 1000 | #0000FF | N | 2→2 |  |
| 14 | 24 | 100 | #000000 | N | 41→21 |  |
| 15 | 28 | 500 | #000000 | N | 2→2 |  |
| 16 | 0 | 1000 | #000000 | Y | 3→1 |  |
| 17 | 21 | 1000 | #000000 | Y | 2→2 |  |
| 18 | 22 | 1000 | #000000 | N | 2→2 |  |
| 19 | 25 | 100 | #000000 | N | 1→1 |  |
| 20 | 3 | 1000 | #000000 | N | 3→1 |  |

**Unmapped charPr (user idx)**: [3, 7, 9, 10, 11]


## borderFill (사용자 60개 → 우리 81개)

| user_idx | our_idx | L-type | R-type | T-type | B-type | fill_face | 비고 |
|----------|---------|--------|--------|--------|--------|-----------|------|
| 1 | 1 | NONE | NONE | NONE | NONE | none |  |
| 2 | 2 | NONE | NONE | NONE | NONE | none |  |
| 3 | 1 | NONE | NONE | NONE | NONE | none |  |
| 4 | 4 | SOLID | SOLID | SOLID | SOLID | none |  |
| 5 | ? | NONE | SOLID | SOLID | SOLID | #D9D9D9 | unmapped |
| 6 | 6 | NONE | NONE | NONE | NONE | none |  |
| 7 | 7 | SOLID | SOLID | SOLID | SOLID | none |  |
| 8 | 8 | SOLID | SOLID | NONE | SOLID | #FFFFFF |  |
| 9 | 9 | SOLID | SOLID | SOLID | DASH | none |  |
| 10 | 10 | SOLID | SOLID | DASH | SOLID | none |  |
| 11 | 1 | NONE | NONE | NONE | NONE | none |  |
| 12 | 12 | SOLID | SOLID | SOLID | SOLID | none |  |
| 13 | 13 | NONE | NONE | NONE | SOLID | none |  |
| 14 | 14 | SOLID | NONE | SOLID | NONE | none |  |
| 15 | 15 | SOLID | NONE | NONE | NONE | none |  |
| 16 | 16 | SOLID | SOLID | NONE | SOLID | none |  |
| 17 | 17 | NONE | SOLID | NONE | NONE | none |  |
| 18 | 18 | NONE | NONE | NONE | NONE | none |  |
| 19 | 19 | NONE | SOLID | SOLID | NONE | none |  |
| 20 | 20 | SOLID | SOLID | SOLID | SOLID | #FFFFFF |  |
| 21 | ? | SOLID | SOLID | SOLID | SOLID | none | unmapped |
| 22 | 22 | SOLID | NONE | SOLID | SOLID | none |  |
| 23 | 23 | SOLID | SOLID | SOLID | SOLID | none |  |
| 24 | 24 | SOLID | NONE | SOLID | SOLID | none |  |
| 25 | 25 | SOLID | SOLID | SOLID | SOLID | none |  |
| 26 | 26 | SOLID | NONE | SOLID | SOLID | none |  |
| 27 | 27 | SOLID | SOLID | SOLID | SOLID | none |  |
| 28 | 28 | SOLID | NONE | SOLID | SOLID | none |  |
| 29 | 29 | SOLID | SOLID | SOLID | SOLID | none |  |
| 30 | 30 | SOLID | NONE | SOLID | SOLID | none |  |
| 31 | 31 | SOLID | SOLID | SOLID | SOLID | none |  |
| 32 | 32 | SOLID | SOLID | SOLID | SOLID | none |  |
| 33 | 33 | SOLID | SOLID | SOLID | SOLID | none |  |
| 34 | ? | NONE | SOLID | SOLID | SOLID | #D9D9D9 | unmapped |
| 35 | ? | SOLID | SOLID | SOLID | SOLID | none | unmapped |
| 36 | ? | NONE | SOLID | SOLID | SOLID | #D9D9D9 | unmapped |
| 37 | 37 | NONE | SOLID | SOLID | SOLID | #D9D9D9 |  |
| 38 | 38 | NONE | SOLID | SOLID | SOLID | #D9D9D9 |  |
| 39 | 39 | NONE | SOLID | SOLID | SOLID | #D9D9D9 |  |
| 40 | ? | SOLID | SOLID | SOLID | SOLID | none | unmapped |
| 41 | 21 | NONE | NONE | NONE | NONE | none |  |
| 42 | 70 | NONE | NONE | NONE | NONE | #D9D9D9 |  |
| 43 | 43 | SOLID | SOLID | SOLID | SOLID | none |  |
| 44 | 44 | NONE | SOLID | SOLID | SOLID | #D9D9D9 |  |
| 45 | 45 | SOLID | SOLID | SOLID | SOLID | none |  |
| 46 | 46 | NONE | SOLID | SOLID | SOLID | #D9D9D9 |  |
| 47 | 47 | NONE | NONE | NONE | SOLID | none |  |
| 48 | 50 | NONE | SOLID | SOLID | SOLID | none |  |
| 49 | 51 | SOLID | NONE | SOLID | SOLID | none |  |
| 50 | 52 | NONE | SOLID | SOLID | SOLID | none |  |
| 51 | 53 | SOLID | NONE | SOLID | SOLID | none |  |
| 52 | 55 | NONE | SOLID | NONE | NONE | none |  |
| 53 | 56 | SOLID | NONE | NONE | NONE | none |  |
| 54 | 57 | SOLID | NONE | NONE | SOLID | none |  |
| 55 | 58 | NONE | NONE | NONE | SOLID | none |  |
| 56 | 59 | NONE | NONE | SOLID | NONE | none |  |
| 57 | 64 | NONE | SOLID | SOLID | SOLID | none |  |
| 58 | 65 | NONE | SOLID | SOLID | SOLID | #CCCCCC |  |
| 59 | 66 | SOLID | NONE | SOLID | SOLID | none |  |
| 60 | 67 | SOLID | NONE | SOLID | SOLID | #CCCCCC |  |

**Unmapped borderFill (user idx)**: [5, 21, 34, 35, 36, 40]


## Unmapped 상세

- paraPr user[3, 4, 8, 9]: our header에 동일 fingerprint 없음 → Phase 3에서 fallback 처리 필요

- charPr user[3, 7, 9, 10, 11]: our header에 동일 fingerprint 없음 → Phase 3에서 fallback 처리 필요

- borderFill user[5, 21, 34, 35, 36, 40]: our header에 동일 fingerprint 없음 → Phase 3에서 fallback 처리 필요

