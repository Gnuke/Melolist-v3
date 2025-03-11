<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  results: {
    type: Array,
    required: true,
  },
  noResultMessage: {
    type: String,
    default: '',
  },
  lowScoreMessage: {
    type: String,
    default: '',
  },
  searchType:{ // 'fingerprint' or 'humming'
    type: String,
    default: 'fingerprint',
  },
  isLoading: {
    type: Boolean,
    default: false,
  }
});

const getArtistName = (artists) => {
  if (artists && artists.length > 0 && artists[0].name) {
    return artists[0].name;
  } else {
    return "미상";
  }
};
</script>

<template>
  <div v-if="isLoading">
    <!-- 로딩 스피너 표시 -->
    <i class="fas fa-spinner fa-spin"></i>
  </div>
  <div v-if="props.results.length > 0">
    <h3>검색 결과</h3>
    <p v-if="lowScoreMessage" class="low-score-message">{{ lowScoreMessage }}</p>
    <table>
      <thead>
      <tr>
        <th>제목</th>
        <th v-if="props.searchType === 'fingerprint'">아티스트</th>
        <th v-if="props.searchType === 'fingerprint'">앨범</th>
        <th v-if="props.searchType === 'fingerprint'">발매일</th>
        <th v-if="props.searchType === 'humming'">일치율</th>
        <th>링크</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="result in results" :key="result.acrid || Math.random().toString(36).substring(2, 15)">
        <td>{{ result.title }}</td>
        <td v-if="props.searchType === 'fingerprint'">{{ getArtistName(result.artists) }}</td>
        <td v-if="props.searchType === 'fingerprint'">{{ result.album && result.album.name ? result.album.name : '-' }}</td>
        <td v-if="props.searchType === 'fingerprint'">{{ result.release_date || '-' }}</td>
        <td v-if="props.searchType === 'humming'">{{ (result.score * 100).toFixed(0) + '%' }}</td>
        <td>
          <a v-if="result.youtube_url" :href="result.youtube_url" target="_blank" rel="noopener noreferrer">듣기</a> <!-- 링크 표시 -->
          <span v-else>-</span> <!-- 링크가 없을 경우 - 표시 -->
        </td>
      </tr>
      </tbody>
    </table>
  </div>
  <div v-else-if="props.noResultMessage">
    <p>{{ props.noResultMessage }}</p>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  min-width: 400px;
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

/* 제목 셀에 적용할 스타일 */
td:first-child {
  max-width: 200px; /* 적절한 최대 너비 설정 */
  white-space: nowrap; /* 텍스트를 한 줄에 표시 */
  overflow: hidden; /* 내용이 넘치면 숨김 */
  text-overflow: ellipsis; /* 넘치는 텍스트에 줄임표 표시 */
}

.low-score-message {
  color: orange;
  font-style: italic;
  margin-bottom: 10px;
}

@media (prefers-color-scheme: dark) {
  table, th, td, .low-score-message {
    color: black !important; /* 텍스트 검은색 */
  }
}
</style>