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
    <ul>
      <li v-for="result in results" :key="result.acrid || Math.random().toString(36).substring(2, 15)">
        <!-- Audio Fingerprinting 검색 결과 -->
        <template v-if="props.searchType === 'fingerprint'">
          <div v-if="result.title">
            {{ result.title }} - {{ getArtistName(result.artists) }}
            <span v-if="result.score"> (일치율: {{ result.score }})</span>
          </div>
          <div v-if="result.album && result.album.name">앨범: {{ result.album.name }}</div>
          <div v-if="result.release_date">발매일: {{ result.release_date }}</div>
        </template>
        <!-- Humming Identification 검색 결과 -->
        <template v-else-if="props.searchType === 'humming'">
          <div v-if="result.title">
            {{ result.title }} - {{ getArtistName(result.artists) }}
            <span v-if="result.score"> (일치율: {{ result.score * 100 }})</span>
          </div>
          <div v-if="result.album && result.album.name">앨범: {{ result.album.name }}</div>
          <div v-if="result.release_date">발매일: {{ result.release_date }}</div>
        </template>
      </li>
    </ul>
  </div>
  <div v-else-if="props.noResultMessage">
    <p>{{ props.noResultMessage }}</p>
  </div>
</template>

<style scoped>
ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 10px;
  border-bottom: 1px solid #eee;
  transition: background-color 0.2s ease;
}

li:hover {
  background-color: #f9f9f9;
}

div {
  margin-bottom: 5px; /* 각 데이터 항목 사이 간격 추가 */
}
</style>