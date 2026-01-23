<!-- app/components/recognizers/HummingRecognizer.vue -->

<script setup lang="ts">
  import { ref } from 'vue'
  import SearchResultsList from './SearchResultsList.vue'
  import { blobUrlToBase64 } from '~/utils/audio'

  type AcrResult = {
    title?: string
    score?: number // ACRCloud는 보통 0~1
    [key: string]: any
  }

  const props = defineProps<{
    recordedAudio: string
  }>()

  const recognitionResults = ref<AcrResult[]>([])
  const noResultMessage = ref<string>('')
  const lowScoreMessage = ref<string>('')

  const minScore = 50 // 최소 일치율(0~100)
  const isLoading = ref(false)

  async function searchRequestForHumming() {
    if (isLoading.value) return
    if (!props.recordedAudio) return

    isLoading.value = true
    noResultMessage.value = ''
    lowScoreMessage.value = ''
    recognitionResults.value = []

    try {
      // 1) blob:url -> base64
      const audioBase64 = await blobUrlToBase64(props.recordedAudio)

      // 2) Nuxt server/api/humming.post.ts 로 호출
      const data = await $fetch<AcrResult[]>('/api/humming', {
        method: 'POST',
        body: { audio: audioBase64 },
      })

      // 3) 결과 처리
      if (Array.isArray(data) && data.length > 0) {
        // score 정규화 + 필터링
        const normalized = data.map((r) => ({
          ...r,
          score: typeof r.score === 'number' ? r.score : 0,
        }))

        const filtered = normalized.filter((r) => (r.score ?? 0) * 100 >= minScore)

        if (filtered.length > 0) {
          recognitionResults.value = filtered
          return
        }

        // 최소 점수 이상이 없다면 "가장 유사한 1개" 보여주기
        const best = normalized.reduce((prev, cur) =>
          (prev.score ?? 0) > (cur.score ?? 0) ? prev : cur
        )

        recognitionResults.value = [best]
        lowScoreMessage.value = '일치율이 낮지만, 가장 유사한 결과를 보여드립니다.'
        return
      }

      // data가 [] 또는 이상한 값이면
      recognitionResults.value = []
      noResultMessage.value = '일치하는 음악을 찾을 수 없습니다.'
    } catch (err: any) {
      console.error('HummingRecognizer 요청 실패:', err)
      recognitionResults.value = []
      noResultMessage.value =
        err?.data?.message || err?.message || '검색 중 오류가 발생했습니다.'
      lowScoreMessage.value = ''
    } finally {
      isLoading.value = false
    }
  }
</script>

<template>
  <div class="search-button-container">
    <button class="search-button" @click="searchRequestForHumming" :disabled="isLoading">
      <i class="fas fa-search search-icon"></i>
      <span>{{ isLoading ? '검색 중...' : '검색' }}</span>
    </button>
  </div>

  <SearchResultsList
    :results="recognitionResults"
    :noResultMessage="noResultMessage"
    :lowScoreMessage="lowScoreMessage"
    :isLoading="isLoading"
    searchType="humming"
  />
</template>

<style scoped>
  .search-button-container {
    margin-bottom: 40px;
  }

  .search-button {
    padding: 10px 20px;
    background-color: white;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  .search-button:hover {
    background-color: #f0f0f0;
  }

  .search-icon {
    margin-right: 8px;
  }
</style>
