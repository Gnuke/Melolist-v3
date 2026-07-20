import { supabase } from '@/lib/supabase'

const BUCKET = 'avatars'
const MAX_EDGE = 512

/** 이미지를 512px 정사각(중앙 크롭) JPEG로 축소 — 버킷 2MB 상한을 항상 통과한다. */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const srcEdge = Math.min(bitmap.width, bitmap.height)
    const edge = Math.min(MAX_EDGE, srcEdge)
    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(
      bitmap,
      (bitmap.width - srcEdge) / 2,
      (bitmap.height - srcEdge) / 2,
      srcEdge,
      srcEdge,
      0,
      0,
      edge,
      edge,
    )
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    })
  } finally {
    bitmap.close()
  }
}

/**
 * Storage `avatars/{userId}/{ts}.jpg`에 업로드하고 public URL을 반환한다.
 * 파일명을 매번 바꾸는 이유: 같은 경로 덮어쓰기는 CDN 캐시 때문에 구 이미지가
 * 한동안 보일 수 있다. 대신 이전 파일은 지워 고아를 남기지 않는다(실패 무시).
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await toAvatarBlob(file)
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(userId)
    const stale = (files ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path)
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale)
  } catch {
    // 정리 실패는 무시 — 다음 업로드에서 다시 정리된다
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
