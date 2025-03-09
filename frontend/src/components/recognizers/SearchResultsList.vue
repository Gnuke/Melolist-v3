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

.low-score-message {
  color: orange;
  font-style: italic;
  margin-bottom: 10px;
}

@media (prefers-color-scheme: dark) {
  table {
    background-color: #222;
    color: black; /* 텍스트 검은색 */
  }

  th {
    background-color: #444;
    color: black;
  }

  tbody tr:nth-child(even) {
    background-color: #333;
  }

  .low-score-message {
    color: black;
  }
}

</style>