import type { AcrResult, SearchType } from '@/features/search/types'

/**
 * 검색 API mock — 백엔드 search 도메인(M2) 구현 전 결과 화면 확인용.
 * dev 서버에서만 동작한다 (api.ts에서 import.meta.env.DEV 가드 + 동적 import
 * → 프로덕션 번들에는 포함되지 않음).
 *
 * 사용법: 아래 두 상수를 바꾸고 저장하면 HMR로 즉시 반영된다.
 */

/** false로 바꾸면 실제 백엔드(/api/search/*)를 호출한다 */
export const MOCK_SEARCH_ENABLED = false

/**
 * - 'hit'      : 정상 결과 (지문=히어로 1j / 허밍=Top-3 리스트 1i)
 * - 'nomatch'  : 빈 배열 → F2 무결과
 * - 'lowscore' : 허밍 전용, 전부 score<0.5 → F3 저신뢰 (지문이면 hit처럼 동작)
 * - 'error'    : 예외 발생 → F4 오류 ([재시도] 확인용)
 */
export const MOCK_SCENARIO: 'hit' | 'nomatch' | 'lowscore' | 'error' = 'hit'

/** 실제 인식 지연 흉내 (스켈레톤 확인용) */
const LATENCY_MS = 1200

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

/**
 * 커버 폴백 2단 체인(C2)을 전부 시연하도록 구성:
 * 1번곡 = cover_url 정상 · 2번곡 = cover_url 깨짐 → onError로 ytimg 폴백
 * 3번곡 = cover_url null → ytimg · (허밍 3번곡 = videoId도 없음 → 플레이스홀더 + 듣기 숨김)
 */
const GOOD_DAY: AcrResult = {
  acrid: 'mock-good-day',
  title: '좋은 날',
  artists: [{ name: '아이유' }],
  album: { name: 'Real' },
  release_date: '2010-12-09',
  youtube_video_id: 'jeqdYqsrsA0',
  youtube_url: yt('jeqdYqsrsA0'),
  cover_url: thumb('jeqdYqsrsA0'), // 정상 커버 (1순위 경로)
}

const DITTO: AcrResult = {
  acrid: 'mock-ditto',
  title: 'Ditto',
  artists: [{ name: 'NewJeans' }],
  album: { name: "OMG" },
  release_date: '2022-12-19',
  youtube_video_id: 'pSUydWEqKwE',
  youtube_url: yt('pSUydWEqKwE'),
  cover_url: 'https://covers.invalid/ditto.jpg', // 깨진 URL → onError → ytimg 폴백 확인
}

const DYNAMITE: AcrResult = {
  acrid: 'mock-dynamite',
  title: 'Dynamite',
  artists: [{ name: 'BTS' }],
  album: { name: 'Dynamite (DayTime Version)' },
  release_date: '2020-08-21',
  youtube_video_id: 'gdZLi9oWNZg',
  youtube_url: yt('gdZLi9oWNZg'),
  cover_url: null, // null → ytimg 폴백 (2순위 경로)
}

const NO_MEDIA: AcrResult = {
  acrid: 'mock-no-media',
  title: '이름 모를 인디곡',
  artists: [{ name: '미상 아티스트' }],
  album: { name: 'Demo' },
  release_date: '2019-03-01',
  // videoId·cover 둘 다 없음 → 음표 플레이스홀더 + 듣기 버튼 숨김 확인
  cover_url: null,
}

const FINGERPRINT_HIT: AcrResult[] = [GOOD_DAY, DITTO, DYNAMITE]

const HUMMING_HIT: AcrResult[] = [
  { ...GOOD_DAY, score: 0.92 },
  { ...DITTO, score: 0.71 },
  { ...NO_MEDIA, score: 0.58 },
]

const HUMMING_LOW: AcrResult[] = [
  { ...DYNAMITE, score: 0.43 },
  { ...DITTO, score: 0.31 },
]

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** mock 비활성 시 null 반환 → 호출부가 실제 API로 진행 */
export async function maybeMockRecognize(type: SearchType): Promise<AcrResult[] | null> {
  if (!MOCK_SEARCH_ENABLED) return null
  await delay(LATENCY_MS)

  switch (MOCK_SCENARIO) {
    case 'nomatch':
      return []
    case 'error':
      throw new Error('mock server error') // 화면에는 노출되지 않아야 한다(F4 규칙)
    case 'lowscore':
      return type === 'humming' ? HUMMING_LOW : FINGERPRINT_HIT
    case 'hit':
    default:
      return type === 'humming' ? HUMMING_HIT : FINGERPRINT_HIT
  }
}
