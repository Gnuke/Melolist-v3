import { api } from '@/lib/api'
import type { AcrResult, SearchType } from './types'

/**
 * 녹음 오디오를 백엔드 검색 도메인으로 보내 인식 결과를 받는다. (게스트 허용)
 * v3 백엔드 계약: POST /api/search/{fingerprint|humming}, multipart(audio).
 * ⚠️ 백엔드 search 도메인은 M2에서 구현 예정 — 그 전까지 이 호출은 에러/무결과로 처리된다.
 */
export async function recognize(type: SearchType, audio: Blob): Promise<AcrResult[]> {
  const form = new FormData()
  form.append('audio', audio, `recording.${extensionOf(audio)}`)

  const { data } = await api.post<AcrResult[]>(`/search/${type}`, form)
  return Array.isArray(data) ? data : []
}

function extensionOf(blob: Blob): string {
  if (blob.type.includes('ogg')) return 'ogg'
  if (blob.type.includes('mp4')) return 'mp4'
  return 'webm'
}
