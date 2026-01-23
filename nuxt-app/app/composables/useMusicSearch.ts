// app/composables/useMusicSearch.ts

import { blobUrlToBase64 } from '@/utils/audio'

export type RecognizerType = 'fingerprint' | 'humming'

export type MusicSearchItem = {
  title: string
  score: number
  youtube_url?: string
  artists?: { name: string }[]
  [key: string]: any
}

export function useMusicSearch() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const results = ref<MusicSearchItem[]>([])

  const search = async (type: RecognizerType, recordedAudioUrl: string) => {
    loading.value = true
    error.value = null
    results.value = []

    try {
      const audioBase64 = await blobUrlToBase64(recordedAudioUrl)

      const endpoint =
        type === 'fingerprint' ? '/api/fingerprints' : '/api/humming'

      const data = await $fetch<MusicSearchItem[]>(endpoint, {
        method: 'POST',
        body: { audio: audioBase64 },
      })

      results.value = Array.isArray(data) ? data : []
      return results.value
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.'
      error.value = msg
      return []
    } finally {
      loading.value = false
    }
  }

  return { loading, error, results, search }
}