import type {
  AdminIdentity,
  AdminMetrics,
  AdminRole,
  MusicAdminItem,
  MusicAdminPatch,
  MusicListParams,
  PageResponse,
  UserAdminItem,
  UserListParams,
} from '@/features/admin/types'

/**
 * 어드민 API mock — 백엔드(어드민 백 트리) 구현 전 전 화면 확인용(FR-009/SC-004).
 * searchMock.ts 패턴 계승: dev 서버에서만 동작(features/admin/api.ts 의
 * import.meta.env.DEV 가드 + 동적 import → 프로덕션 번들 미포함).
 *
 * 데이터는 specs/003-admin-page-front/contracts/admin-api.md 예시 응답과 동일하게
 * 유지한다(계약의 실행 가능한 사본 — data-model §6).
 *
 * 사용법: 아래 상수를 바꾸고 저장하면 HMR로 즉시 반영된다.
 */

/** false로 바꾸면 실제 백엔드(/api/admin/*)를 호출한다 */
export const MOCK_ADMIN_ENABLED = true

/**
 * 가드 시나리오 — 접근 제어 확인용(quickstart A-1·A-2)
 * - 'ADMIN' : 관리자로 진입(전 화면 확인)
 * - 'USER'  : 일반 사용자 → 홈 리다이렉트 확인
 * - null    : 게스트(비로그인) → 홈 리다이렉트 확인
 */
export const MOCK_ME_ROLE: AdminRole | null = 'ADMIN'

/**
 * 데이터 시나리오 — 대시보드·목록 상태 확인용(quickstart A-3~A-7)
 * - 'normal' : 계약 예시 데이터(KR2 통과·KR3 미달 혼재)
 * - 'empty'  : 데이터 없는 기간(분모 0 → "데이터 없음")
 * - 'error'  : 오류 throw → 정제 카피 + 재시도 확인
 * - 'slow'   : 4초 지연 → 로딩 상태(콜드스타트 흉내)
 */
export const MOCK_ADMIN_SCENARIO: 'normal' | 'empty' | 'error' | 'slow' = 'normal'

/** 자기 자신(관리자) — 사용자 목록의 self-demotion 선차단 확인용 id */
export const MOCK_ME_ID = 'admin-0000-me'

const LATENCY_MS = 400
const SLOW_MS = 4000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function scenarioGate(): Promise<void> {
  if (MOCK_ADMIN_SCENARIO === 'error') {
    await delay(LATENCY_MS)
    throw new Error('mock admin error') // 화면에는 노출되지 않아야 한다(FR-010)
  }
  await delay(MOCK_ADMIN_SCENARIO === 'slow' ? SLOW_MS : LATENCY_MS)
}

/** mock 비활성 시 undefined 반환 → 호출부(api.ts)가 실제 API로 진행 */
export function maybeMockIdentity(): AdminIdentity | null | undefined {
  if (!MOCK_ADMIN_ENABLED) return undefined
  if (MOCK_ME_ROLE === null) return null // 게스트
  return { id: MOCK_ME_ID, role: MOCK_ME_ROLE }
}

// ── metrics (계약 §1) ────────────────────────────────────────────────────────

const METRICS_NORMAL: AdminMetrics = {
  period_days: 14,
  kr2: {
    target_ms: 6000,
    rows: [
      { mode: 'fingerprint', n: 42, matched_n: 38, p50_ms: 2100, p95_ms: 4800, max_ms: 7200, pass: true },
      { mode: 'humming', n: 17, matched_n: 11, p50_ms: 3900, p95_ms: 5708, max_ms: 9100, pass: true },
      { mode: null, n: 59, matched_n: 49, p50_ms: 2500, p95_ms: 5400, max_ms: 9100, pass: true },
    ],
  },
  kr2_breakdown: [
    { mode: 'fingerprint', n: 42, acr_p95_ms: 1500, meta_p95_ms: 3600, upsert_p95_ms: 900, total_p95_ms: 4800 },
    { mode: 'humming', n: 17, acr_p95_ms: 2100, meta_p95_ms: 3900, upsert_p95_ms: 2500, total_p95_ms: 5708 },
    { mode: null, n: 59, acr_p95_ms: 1700, meta_p95_ms: 3700, upsert_p95_ms: 1100, total_p95_ms: 5400 },
  ],
  kr3: { target_pct: 70, visit_sessions: 31, completed_sessions: 12, completion_pct: 38.7, pass: false },
  failures: [
    { mode: 'humming', reason: 'no_match', n: 6 },
    { mode: 'fingerprint', reason: 'timeout', n: 2 },
    { mode: 'humming', reason: 'low_score', n: 2 },
    { mode: null, reason: 'bad_audio', n: 1 },
  ],
  weekly: [
    { week: '2026-07-20', mode: 'fingerprint', n: 12, p95_ms: 4600 },
    { week: '2026-07-20', mode: 'humming', n: 5, p95_ms: 5100 },
    { week: '2026-07-13', mode: 'fingerprint', n: 18, p95_ms: 4900 },
    { week: '2026-07-13', mode: 'humming', n: 10, p95_ms: 5708 },
    { week: '2026-07-06', mode: 'fingerprint', n: 9, p95_ms: 5200 },
  ],
  totals: { search_count: 59, matched_count: 49, user_count: 8, music_count: 133 },
}

const METRICS_EMPTY: AdminMetrics = {
  period_days: 14,
  kr2: { target_ms: 6000, rows: [] },
  kr2_breakdown: [],
  kr3: { target_pct: 70, visit_sessions: 0, completed_sessions: 0, completion_pct: null, pass: false },
  failures: [],
  weekly: [],
  totals: { search_count: 0, matched_count: 0, user_count: 8, music_count: 133 },
}

export async function maybeMockMetrics(days: number): Promise<AdminMetrics | undefined> {
  if (!MOCK_ADMIN_ENABLED) return undefined
  await scenarioGate()
  const base = MOCK_ADMIN_SCENARIO === 'empty' ? METRICS_EMPTY : METRICS_NORMAL
  return { ...base, period_days: days }
}

// ── music 카탈로그 (계약 §2·§3) ──────────────────────────────────────────────

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function musicItem(partial: Partial<MusicAdminItem> & { id: number; title: string }): MusicAdminItem {
  return {
    acrid: `mock-acrid-${partial.id}`,
    artist: null,
    album: null,
    release_date: null,
    youtube_video_id: null,
    cover_url: null,
    duration_ms: null,
    source: 'ACRCLOUD',
    created_at: '2026-07-16T09:12:00Z',
    updated_at: '2026-07-16T09:12:00Z',
    ...partial,
  }
}

/** 메타 상태 조합(정상/커버 없음/영상 없음/둘 다 없음)을 모두 포함 — 필터 검증용 */
const MUSIC_STORE: MusicAdminItem[] = [
  musicItem({ id: 133, title: '좋은 날', artist: '아이유', album: 'Real', release_date: '2010-12-09', youtube_video_id: 'jeqdYqsrsA0', cover_url: thumb('jeqdYqsrsA0') }),
  musicItem({ id: 132, title: 'Ditto', artist: 'NewJeans', album: 'OMG', release_date: '2022-12-19', youtube_video_id: 'pSUydWEqKwE', cover_url: null }),
  musicItem({ id: 131, title: 'Dynamite', artist: 'BTS', album: 'Dynamite (DayTime Version)', release_date: '2020-08-21', youtube_video_id: 'gdZLi9oWNZg', cover_url: thumb('gdZLi9oWNZg') }),
  musicItem({ id: 130, title: '이름 모를 인디곡', artist: '미상 아티스트', album: 'Demo', release_date: '2019-03-01' }),
  ...Array.from({ length: 41 }, (_, i) =>
    musicItem({
      id: 129 - i,
      title: `샘플 곡 ${129 - i}`,
      artist: i % 3 === 0 ? '샘플 아티스트' : `가수 ${i}`,
      youtube_video_id: i % 4 === 0 ? null : 'jeqdYqsrsA0',
      cover_url: i % 5 === 0 ? null : thumb('jeqdYqsrsA0'),
    }),
  ),
]

function paginate<T>(rows: T[], page: number, size: number): PageResponse<T> {
  return {
    items: rows.slice(page * size, page * size + size),
    page,
    size,
    total_items: rows.length,
    total_pages: Math.max(1, Math.ceil(rows.length / size)),
  }
}

export async function maybeMockMusicList(params: MusicListParams): Promise<PageResponse<MusicAdminItem> | undefined> {
  if (!MOCK_ADMIN_ENABLED) return undefined
  await scenarioGate()
  const { query, missing, page = 0, size = 20 } = params
  let rows = MOCK_ADMIN_SCENARIO === 'empty' ? [] : [...MUSIC_STORE]
  if (query) {
    const q = query.toLowerCase()
    rows = rows.filter((m) => m.title.toLowerCase().includes(q) || (m.artist ?? '').toLowerCase().includes(q))
  }
  if (missing === 'video') rows = rows.filter((m) => m.youtube_video_id === null)
  if (missing === 'cover') rows = rows.filter((m) => m.cover_url === null)
  return paginate(rows, page, size)
}

export async function maybeMockMusicUpdate(id: number, patch: MusicAdminPatch): Promise<MusicAdminItem | undefined> {
  if (!MOCK_ADMIN_ENABLED) return undefined
  await delay(LATENCY_MS)
  const idx = MUSIC_STORE.findIndex((m) => m.id === id)
  if (idx < 0) throw new Error('mock: music not found')
  // 계약 §3 — 빈 문자열은 null 정규화(클라 폼에서도 수행하지만 mock도 방어)
  const normalized = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]),
  )
  MUSIC_STORE[idx] = { ...MUSIC_STORE[idx], ...normalized, updated_at: new Date().toISOString() }
  return MUSIC_STORE[idx]
}

// ── users (계약 §4·§5) ───────────────────────────────────────────────────────

const USER_STORE: UserAdminItem[] = [
  { id: MOCK_ME_ID, email: 'admin@melolist.dev', display_name: '운영자(나)', avatar_url: null, role: 'ADMIN', created_at: '2026-07-10T01:00:00Z' },
  { id: 'user-0001', email: 'user1@example.com', display_name: '홍길동', avatar_url: null, role: 'USER', created_at: '2026-07-14T02:00:00Z' },
  { id: 'user-0002', email: 'user2@example.com', display_name: null, avatar_url: null, role: 'USER', created_at: '2026-07-15T11:30:00Z' },
  { id: 'user-0003', email: 'user3@example.com', display_name: '멜로디', avatar_url: null, role: 'USER', created_at: '2026-07-16T09:00:00Z' },
  { id: 'user-0004', email: 'user4@example.com', display_name: '허밍이', avatar_url: null, role: 'USER', created_at: '2026-07-18T15:20:00Z' },
  { id: 'user-0005', email: 'user5@example.com', display_name: null, avatar_url: null, role: 'USER', created_at: '2026-07-20T08:45:00Z' },
  { id: 'user-0006', email: 'user6@example.com', display_name: '검색왕', avatar_url: null, role: 'USER', created_at: '2026-07-21T19:10:00Z' },
  { id: 'user-0007', email: 'user7@example.com', display_name: '베타테스터', avatar_url: null, role: 'USER', created_at: '2026-07-22T03:05:00Z' },
]

export async function maybeMockUserList(params: UserListParams): Promise<PageResponse<UserAdminItem> | undefined> {
  if (!MOCK_ADMIN_ENABLED) return undefined
  await scenarioGate()
  const { page = 0, size = 20 } = params
  const rows = [...USER_STORE].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return paginate(rows, page, size)
}

export async function maybeMockUserRoleUpdate(id: string, role: AdminRole): Promise<UserAdminItem | undefined> {
  if (!MOCK_ADMIN_ENABLED) return undefined
  await delay(LATENCY_MS)
  // 계약 §5 — 자기 자신 ADMIN 해제는 409 (클라 선차단이 있으므로 정상 경로에선 도달하지 않음)
  if (id === MOCK_ME_ID && role === 'USER') throw new Error('mock: SELF_DEMOTION_FORBIDDEN')
  const idx = USER_STORE.findIndex((u) => u.id === id)
  if (idx < 0) throw new Error('mock: user not found')
  USER_STORE[idx] = { ...USER_STORE[idx], role }
  return USER_STORE[idx]
}
