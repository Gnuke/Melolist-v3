<script setup>
  import { defineProps, ref } from 'vue';
  import SearchResultsList from "./SearchResultsList.vue";

  const props = defineProps({
    recordedAudio: {
      type: String,
      required: true
    },
  });

  const recognitionResults = ref([]);

  const searchRequest = async () => {
    try {
      // 1. Blob URL을 이용하여 Blob 객체 가져오기
      const response = await fetch(props.recordedAudio);
      const blob = await response.blob();

      // 2. Blob을 ArrayBuffer로 변환
      const buffer = await blob.arrayBuffer();

      // 3. ArrayBuffer 인코딩
      const audioBase64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      // 4. 백엔드 API 호출
      const searchResults = await fetch('http://localhost:3000/acrcloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio: audioBase64
        }) // Base64로 인코딩한 오디오 데이터
      });

      if (!searchResults.ok){
        throw new Error('응답 결과 실패');
      }

      const data = await searchResults.json();
      console.log('검색 결과 : ' + JSON.stringify(data, null, 2));

      // 5. 검색 결과 저장 및 표시
      if (data && data.status.code === 0 && data.metadata && data.metadata.music) {
        recognitionResults.value = data.metadata.music;
      } else {
        recognitionResults.value = []; // 검색 결과가 없을 경우 빈 배열로 설정
      }
    } catch (error) {
      console.error('Recognizer -> 서버에 요청 실패 : ', error);
    }
  };
</script>

<template>
  <div>
    <button @click="searchRequest" class="search-button">
      <i class="fas fa-search search-icon"></i>
      <span>검색</span>
    </button>
  </div>
  <div>
    <!-- SearchResultsList 컴포넌트 사용 -->
    <SearchResultsList :results="recognitionResults" />
  </div>
</template>

<style scoped>
.search-button {
  padding: 10px 20px;
  background-color: white; /* 배경색을 흰색으로 변경 */
  color: #333; /* 텍스트 색상을 어두운 색으로 변경 (선택 사항) */
  border: 1px solid #ccc; /* 테두리 추가 */
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.3s ease, color 0.3s ease; /* transition에 color 추가 */
}

.search-button:hover {
  background-color: #f0f0f0; /* hover 시 배경색 변경 (선택 사항) */
  color: #333; /* hover 시 텍스트 색상 변경 (선택 사항) */
}

.search-icon {
  margin-right: 8px;
}
</style>