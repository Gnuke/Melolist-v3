<!-- app/components/recognizers/SearchResultsList.vue -->
 
<script setup lang="ts">
  type Artist = { name?: string }
  type Album = { name?: string }

  import RatingModal from '~/components/RatingModal.vue'
  export type SearchType = 'fingerprint' | 'humming'

  export type AcrResult = {
    acrid?: string
    title?: string
    artists?: Artist[]
    album?: Album
    release_date?: string
    score?: number // 0~1
    youtube_url?: string
    // 확장 가능
    [key: string]: any
  }

  const props = withDefaults(
    defineProps<{
      results: AcrResult[]
      noResultMessage?: string
      lowScoreMessage?: string
      searchType?: SearchType
      isLoading?: boolean
    }>(),
    {
      noResultMessage: '',
      lowScoreMessage: '',
      searchType: 'fingerprint',
      isLoading: false,
    }
  )

  function getArtistName(artists?: Artist[]) {
    const name = artists?.[0]?.name
    return name && name.trim().length > 0 ? name : '미상'
  }

  function rowKey(r: AcrResult, idx: number) {
    // 안정적인 key 우선순위: acrid > youtube_url > title+artist > idx
    if (r.acrid) return r.acrid
    if (r.youtube_url) return r.youtube_url
    const t = r.title ?? ''
    const a = getArtistName(r.artists)
    if (t || a) return `${t}-${a}`
    return `row-${idx}`
  }

  // 동일 사용자가 3번 이상 사용시 서비스 평가 Modal 호출
  const ratingModalRef = ref<any>(null);

  watch(() => props.results, (newResults) => {
    if (newResults.length > 0) {
      // 1. 카운트 증가
      const count = parseInt(localStorage.getItem('music_find_count') || '0') + 1;
      localStorage.setItem('music_find_count', count.toString());

      // 2. 모달 조건 확인 트리거
      nextTick(() => {
        ratingModalRef.value?.triggerCheck();
      });
    }
  });
</script>

<template>
  <!-- 1) 로딩이 최우선 -->
  <div v-if="isLoading" class="loading">
    <i class="fas fa-spinner fa-spin"></i>
  </div>

  <!-- 2) 결과가 있으면 테이블 -->
  <div v-else-if="results.length > 0">
    <h3>검색 결과</h3>

    <p v-if="lowScoreMessage" class="low-score-message">
      {{ lowScoreMessage }}
    </p>

    <table>
      <thead>
        <tr>
          <th>제목</th>
          <th v-if="searchType === 'fingerprint'">아티스트</th>
          <th v-if="searchType === 'fingerprint'">앨범</th>
          <th v-if="searchType === 'fingerprint'">발매일</th>
          <th v-if="searchType === 'humming'">일치율</th>
          <th>링크</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(result, idx) in results" :key="rowKey(result, idx)">
          <td>{{ result.title ?? '-' }}</td>

          <td v-if="searchType === 'fingerprint'">
            {{ getArtistName(result.artists) }}
          </td>

          <td v-if="searchType === 'fingerprint'">
            {{ result.album?.name ?? '-' }}
          </td>

          <td v-if="searchType === 'fingerprint'">
            {{ result.release_date ?? '-' }}
          </td>

          <td v-if="searchType === 'humming'">
            {{ Math.round(((result.score ?? 0) * 100)) + '%' }}
          </td>

          <td>
            <a
              v-if="result.youtube_url"
              :href="result.youtube_url"
              target="_blank"
              rel="noopener noreferrer"
            >
              듣기
            </a>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 3) 결과 없으면 메시지 -->
  <div v-else-if="noResultMessage">
    <p>{{ noResultMessage }}</p>
  </div>

  <RatingModal ref="ratingModalRef" />
</template>

<style scoped>
  .loading {
    display: flex;
    justify-content: center;
    padding: 16px 0;
  }

  table {
    width: 100%;
    min-width: 430px;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  th,
  td {
    padding: 12px;
    text-align: center;
    border-bottom: 1px solid #ddd;
  }

  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }

  tbody tr:nth-child(even) {
    background-color: #f9f9f9;
  }

  /* 제목 */
  td:nth-child(1) {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
  }

  /* 아티스트/앨범(테이블 구조가 fingerprint일 때만 의미 있음) */
  td:nth-child(2),
  td:nth-child(3) {
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .low-score-message {
    color: orange;
    font-style: italic;
    margin-bottom: 10px;
  }

  @media (prefers-color-scheme: dark) {
    table, th, td, .low-score-message {
      color: black !important;
    }
  }
</style>
