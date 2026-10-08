const SHOWN_KEY = 'melolist.review-prompt-shown'

/**
 * 리뷰 유도 판정 조회 게이트(spec 005 FR-010) — 로그인·비복원 결과 화면에서,
 * 이 세션에 아직 유도를 보여준 적 없을 때만 서버 판정을 조회한다.
 * 복원 진입(restored)은 이미 계측·판정된 결과라 제외(기존 search_result_shown 규칙과 동일).
 */
export function shouldCheckReviewPrompt(opts: { loggedIn: boolean; restored: boolean }): boolean {
  if (!opts.loggedIn || opts.restored) return false
  try {
    return !sessionStorage.getItem(SHOWN_KEY)
  } catch {
    return false
  }
}

/**
 * 유도 노출 순간의 세션 가드 마킹 — 선택 없이 닫아도(배경 탭·ESC) 같은 세션에서는
 * 재노출하지 않는다(FR-010). 유예 저장은 "나중에" 선택 시에만 별도로 일어난다.
 */
export function markReviewPromptShown(): void {
  try {
    sessionStorage.setItem(SHOWN_KEY, '1')
  } catch {
    // storage 불가 환경(사파리 프라이빗 등)은 가드 없이 진행 — 최악이 재노출 1회
  }
}
