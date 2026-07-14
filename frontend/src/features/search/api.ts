import { api } from '@/lib/api'
import type { AcrResult, SearchType } from './types'

interface RecognizeResponse {
  results?: AcrResult[]
}

/**
 * 인식 요청 타임아웃 — 서버 최악 경로(ACR 10s + meta 3s) + 전송 여유.
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
