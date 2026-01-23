<!-- app/components/recognizers/FingerprintRecognizer.vue -->

<script setup lang="ts">
  import { ref } from 'vue'
  import SearchResultsList from './SearchResultsList.vue'
  import { blobUrlToBase64 } from '~/utils/audio'

  type AcrResult = Record<string, any> // 결과 타입 확정되면 구체화

  const props = defineProps<{
    recordedAudio: string
  }>()

  const recognitionResults = ref<AcrResult[]>([])
  const noResultMessage = ref<string>('')
  const isLoading = ref(false)

  async function searchRequestForAcrCloud() {
    if (isLoading.value) return
    if (!props.recordedAudio) return

    isLoading.value = true
    noResultMessage.value = ''
    recognitionResults.value = []

    try {
      // 1) blob:url -> base64
      const audioBase64 = await blobUrlToBase64(props.recordedAudio)

      // 2) Nuxt 서버 라우트로 호출 (server/api/fingerprints.post.ts)
      const data = await $fetch<AcrResult[]>('/api/fingerprints', {
        method: 'POST',
        body: { audio: audioBase64 },
      })

      // 3) 결과 처리
      if (Array.isArray(data) && data.length > 0) {
        recognitionResults.value = data
        noResultMessage.value = ''
      } else {
        recognitionResults.value = []
        noResultMessage.value = '일치하는 음악을 찾을 수 없습니다.'
      }
    } catch (err: any) {
      console.error('FingerprintRecognizer 요청 실패:', err)

      // 서버가 에러 메세지 내려주면 노출 (선택)
      noResultMessage.value =
        err?.data?.message || err?.message || '검색 중 오류가 발생했습니다.'
    } finally {
      isLoading.value = false
    }
  }
</script>

<template>
  <div class="search-button-container">
    <button
      class="search-button"
      @click="searchRequestForAcrCloud"
      :disabled="isLoading"
    >
      <i class="fas fa-search search-icon"></i>
      <span>{{ isLoading ? '검색 중...' : '검색' }}</span>
    </button>
  </div>

  <SearchResultsList
    :results="recognitionResults"
    :noResultMessage="noResultMessage"
    :isLoading="isLoading"
    searchType="fingerprint"
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