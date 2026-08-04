import { api } from '@/lib/api'
import type { AcrResult, SearchType } from './types'

interface RecognizeResponse {
  results?: AcrResult[]
}

/**
 * 인식 요청 타임아웃 — 서버 최악 경로(ACR 10s + meta 4s) + 전송 여유.
 * 초과 시 axios가 ECONNABORTED로 던지고 F4(재시도, blob 보존)로 흘러간다.
 */
const RECOGNIZE_TIMEOUT_MS = 15_000

/**
 * 녹음 오디오를 백엔드 검색 도메인으로 보내 인식 결과를 받는다. (게스트 허용)
 * M2 계약: POST /api/search/{fingerprint|humming}, multipart(audio) → { results: [...] }
 * (과거 bare-array 응답도 방어적으로 수용)
 */
export async function recognize(type: SearchType, audio: Blob, signal?: AbortSignal): Promise<AcrResult[]> {
  // dev 전용 mock (src/mock/searchMock.ts) — 동적 import라 프로덕션 번들에서 제외된다
  if (import.meta.env.DEV) {
    const { maybeMockRecognize } = await import('@/mock/searchMock')
    const mocked = await maybeMockRecognize(type)
    if (mocked) return mocked
  }

  const form = new FormData()
  form.append('audio', audio, `recording.${extensionOf(audio)}`)

  const { data } = await api.post<RecognizeResponse | AcrResult[]>(`/search/${type}`, form, {
    timeout: RECOGNIZE_TIMEOUT_MS,
    signal,
  })
  const results = Array.isArray(data) ? data : data?.results
  return Array.isArray(results) ? results : []
}

function extensionOf(blob: Blob): string {
  if (blob.type.includes('ogg')) return 'ogg'
  if (blob.type.includes('mp4')) return 'mp4'
  return 'webm'
}

/** AI 폴백 선택 확정 응답 — 백엔드 MusicResponse(id가 music PK). */
export interface SelectedMusic {
  id: number
  title?: string
  youtube_url?: string | null
  [key: string]: unknown
}

/**
 * AI 자연어 폴백 검색(spec 002 contracts §1) — 후보 최대 5곡, 서버 저장 없음.
 * 타임아웃은 인식 검색과 동일 15s(서버 예산: LLM 10s + meta 4s).
 * 429(일일 한도)·502(AI 실패)는 호출부에서 상태로 분기한다.
 */
export async function textSearch(query: string, signal?: AbortSignal): Promise<AcrResult[]> {
  if (import.meta.env.DEV) {
    const { maybeMockTextSearch } = await import('@/mock/searchMock')
    const mocked = await maybeMockTextSearch()
    if (mocked) return mocked
  }

  const { data } = await api.post<RecognizeResponse>(
    '/search/text',
    { query },
    { timeout: RECOGNIZE_TIMEOUT_MS, signal },
  )
  return Array.isArray(data?.results) ? data.results : []
}

/** 심층 탐색 클라 하드컷(spec 004 R3) — 서버 예산 웹 22s + 메타 8s ≈ 30s + 전송 여유. */
const DEEP_TIMEOUT_MS = 35_000

/** 심층 탐색 잔여 횟수(spec 004 contracts §1) — 확인 단계 UI 원천. 로그인 전용(401). */
export interface DeepQuota {
  limit: number
  used: number
  remaining: number
  reset_at: string | null
}

export async function deepQuota(): Promise<DeepQuota> {
  const { data } = await api.get<DeepQuota>('/search/deep/quota')
  return data
}

/**
 * 웹검색 심층 탐색(spec 004 contracts §2) — 로그인 전용, 후보 최대 5곡(미확인 라벨 포함),
 * 서버 저장 없음. 발동 시 오래 걸린다(실측 19~21.5s) — 진행 표시·취소는 호출부 책임.
 * 429(일일 한도 2회)·502는 호출부에서 상태로 분기한다.
 */
export async function deepSearch(query: string, signal?: AbortSignal): Promise<AcrResult[]> {
  const { data } = await api.post<RecognizeResponse>(
    '/search/deep',
    { query },
    { timeout: DEEP_TIMEOUT_MS, signal },
  )
  return Array.isArray(data?.results) ? data.results : []
}

/**
 * 심층 후보 선택 확정(contracts §3) — 저장 시점. 미확인 곡도 웹 근거 링크·커버가
 * 후보 카드 값 그대로 저장까지 유지된다(FR-006).
 */
export async function selectDeepCandidate(candidate: AcrResult, rank: number): Promise<SelectedMusic> {
  const { data } = await api.post<SelectedMusic>('/search/deep/select', {
    candidate: {
      acrid: candidate.acrid,
      title: candidate.title,
      artists: candidate.artists ?? [],
      album: candidate.album ?? null,
      youtube_video_id: candidate.youtube_video_id ?? null,
      cover_url: candidate.cover_url ?? null,
      verified: candidate.verified ?? false,
    },
    rank,
  })
  return data
}

/**
 * AI 폴백 후보 선택 확정(contracts §2) — 유일한 저장 시점. 이후 즐겨찾기(acrid=ai-key)가
 * 기존 흐름 그대로 동작한다. rank는 1부터(후보 목록 순위, 계측용).
 */
export async function selectCandidate(candidate: AcrResult, rank: number): Promise<SelectedMusic> {
  if (import.meta.env.DEV) {
    const { maybeMockTextSelect } = await import('@/mock/searchMock')
    const mocked = await maybeMockTextSelect()
    if (mocked) return mocked
  }

  const { data } = await api.post<SelectedMusic>('/search/text/select', {
    candidate: {
      acrid: candidate.acrid,
      title: candidate.title,
      artists: candidate.artists ?? [],
      album: candidate.album ?? null,
      youtube_video_id: candidate.youtube_video_id ?? null,
      cover_url: candidate.cover_url ?? null,
    },
    rank,
  })
  return data
}
