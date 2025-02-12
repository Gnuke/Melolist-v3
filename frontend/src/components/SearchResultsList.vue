<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  results: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div v-if="results.length > 0">
    <h3>검색 결과</h3>
    <ul>
      <li v-for="result in results" :key="result.id">
        {{ result.title }} - {{ result.artists[0].name }}
      </li>
    </ul>
  </div>
  <div v-else-if="results.length === 0">
    <p>일치하는 음악을 찾을 수 없습니다.</p>
  </div>
</template>

<style scoped>

</style>