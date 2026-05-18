# Header 정의 매핑 — user → ours

## paraPr (사용자 12개 → 우리 30개)

| user_idx | our_idx | user_align | user_intent | user_borderFillRef→our | user_tabRef→our | 비고 |
|----------|---------|-----------|-------------|------------------------|----------------|------|
| 0 | 0 | LEFT | 0 | 3→3 | 0→0 |  |
| 1 | 1 | LEFT | 0 | 1→1 | 1→1 |  |
| 2 | 3 | CENTER | 0 | 3→3 | 0→0 |  |
| 3 | 6 | LEFT | -2056 | 3→3 | 0→0 |  |
| 4 | 5 | LEFT | -1695 | 3→3 | 0→0 |  |
| 5 | 11 | LEFT | 0 | 1→1 | 0→0 |  |
| 6 | 0 | LEFT | 0 | 3→3 | 0→0 |  |
| 7 | 10 | CENTER | 0 | 1→1 | 0→0 |  |
| 8 | 12 | LEFT | -1656 | 3→3 | 0→0 |  |
| 9 | 13 | CENTER | -1695 | 3→3 | 0→0 |  |
| 10 | 0 | LEFT | 0 | 3→3 | 0→0 |  |
| 11 | 29 | CENTER | 0 | 2→2 | 0→0 |  |

## charPr (사용자 21개 → 우리 42개)

| user_idx | our_idx | height | textColor | bold | borderFillRef→our | 비고 |
|----------|---------|--------|-----------|------|-------------------|------|
| 0 | 0 | 1000 | #000000 | Y | 1→1 |  |
| 1 | 1 | 1000 | #000000 | N | 3→3 |  |
| 2 | 3 | 1000 | #000000 | N | 1→1 |  |
| 3 | 4 | 1000 | #FFFFFF | N | 3→3 |  |
| 4 | 22 | 1000 | #000000 | N | 2→2 |  |
| 5 | 6 | 400 | #000000 | N | 1→1 |  |
| 6 | 7 | 300 | #000000 | N | 1→1 |  |
| 7 | ? | 1400 | #000000 | Y | 1→1 | unmapped |
| 8 | 17 | 1000 | #000000 | Y | 3→3 |  |
| 9 | 10 | 1700 | #000000 | Y | 3→3 |  |
| 10 | 11 | 1200 | #000000 | Y | 3→3 |  |
| 11 | 12 | 2400 | #000000 | Y | 3→3 |  |
| 12 | 23 | 100 | #000000 | N | 3→3 |  |
| 13 | 27 | 1000 | #0000FF | N | 2→2 |  |
| 14 | 24 | 100 | #000000 | N | 41→21 |  |
| 15 | 28 | 500 | #000000 | N | 2→2 |  |
| 16 | 17 | 1000 | #000000 | Y | 3→3 |  |
| 17 | 21 | 1000 | #000000 | Y | 2→2 |  |
| 18 | 22 | 1000 | #000000 | N | 2→2 |  |
| 19 | 25 | 100 | #000000 | N | 1→1 |  |
| 20 | 1 | 1000 | #000000 | N | 3→3 |  |

**Unmapped charPr (user idx)**: [7]


## borderFill (사용자 60개 → 우리 81개)

| user_idx | our_idx | L-type | R-type | T-type | B-type | fill_face | 비고 |
|----------|---------|--------|--------|--------|--------|-----------|------|
| 1 | 1 | NONE | NONE | NONE | NONE | SOLID |  |
| 2 | 2 | NONE | NONE | NONE | NONE | SOLID |  |
| 3 | 3 | NONE | NONE | NONE | NONE | SOLID |  |
| 4 | 4 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 5 | ? | NONE | SOLID | SOLID | SOLID | SOLID | unmapped |
| 6 | 6 | NONE | NONE | NONE | NONE | SOLID |  |
| 7 | 7 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 8 | 8 | SOLID | SOLID | NONE | SOLID | SOLID |  |
| 9 | 9 | SOLID | SOLID | SOLID | DASH | SOLID |  |
| 10 | 10 | SOLID | SOLID | DASH | SOLID | SOLID |  |
| 11 | 11 | NONE | NONE | NONE | NONE | SOLID |  |
| 12 | 12 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 13 | 13 | NONE | NONE | NONE | SOLID | SOLID |  |
| 14 | 14 | SOLID | NONE | SOLID | NONE | SOLID |  |
| 15 | 15 | SOLID | NONE | NONE | NONE | SOLID |  |
| 16 | 16 | SOLID | SOLID | NONE | SOLID | SOLID |  |
| 17 | 17 | NONE | SOLID | NONE | NONE | SOLID |  |
| 18 | 18 | NONE | NONE | NONE | NONE | SOLID |  |
| 19 | 19 | NONE | SOLID | SOLID | NONE | SOLID |  |
| 20 | 20 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 21 | ? | SOLID | SOLID | SOLID | SOLID | SOLID | unmapped |
| 22 | 22 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 23 | 23 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 24 | 24 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 25 | 25 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 26 | 26 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 27 | 27 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 28 | 28 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 29 | 29 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 30 | 30 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 31 | 31 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 32 | 32 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 33 | 33 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 34 | ? | NONE | SOLID | SOLID | SOLID | SOLID | unmapped |
| 35 | ? | SOLID | SOLID | SOLID | SOLID | SOLID | unmapped |
| 36 | ? | NONE | SOLID | SOLID | SOLID | SOLID | unmapped |
| 37 | 37 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 38 | 38 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 39 | 39 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 40 | ? | SOLID | SOLID | SOLID | SOLID | SOLID | unmapped |
| 41 | 21 | NONE | NONE | NONE | NONE | SOLID |  |
| 42 | 70 | NONE | NONE | NONE | NONE | SOLID |  |
| 43 | 43 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 44 | 44 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 45 | 45 | SOLID | SOLID | SOLID | SOLID | SOLID |  |
| 46 | 46 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 47 | 47 | NONE | NONE | NONE | SOLID | SOLID |  |
| 48 | 50 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 49 | 51 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 50 | 52 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 51 | 53 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 52 | 55 | NONE | SOLID | NONE | NONE | SOLID |  |
| 53 | 56 | SOLID | NONE | NONE | NONE | SOLID |  |
| 54 | 57 | SOLID | NONE | NONE | SOLID | SOLID |  |
| 55 | 58 | NONE | NONE | NONE | SOLID | SOLID |  |
| 56 | 59 | NONE | NONE | SOLID | NONE | SOLID |  |
| 57 | 64 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 58 | 65 | NONE | SOLID | SOLID | SOLID | SOLID |  |
| 59 | 66 | SOLID | NONE | SOLID | SOLID | SOLID |  |
| 60 | 67 | SOLID | NONE | SOLID | SOLID | SOLID |  |

**Unmapped borderFill (user idx)**: [5, 21, 34, 35, 36, 40]


## Unmapped 상세

- charPr user[7]: our header에 동일 fingerprint 없음 → Phase 3에서 fallback 처리 필요

- borderFill user[5, 21, 34, 35, 36, 40]: our header에 동일 fingerprint 없음 → Phase 3에서 fallback 처리 필요

