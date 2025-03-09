<script setup>
import { defineProps, ref } from 'vue';
import SearchResultsList from "./SearchResultsList.vue";

const apiUrl = import.meta.env.VITE_API_BASE_URL + '/api/humming';

const props = defineProps({
  recordedAudio: {
    type: String,
    required: true
  },
});

const recognitionResults = ref([]);
const noResultMessage = ref('');
const lowScoreMessage = ref(''); // 낮은 점수에 대한 메시지
const minScore = 50; // 최소 일치율

const searchRequestForHumming = async () => {
  try {
    // 1. Blob URL을 이용하여 Blob 객체 가져오기
    const response = await fetch(props.recordedAudio);
    const blob = await response.blob();

    // 2. Blob을 ArrayBuffer로 변환
    const buffer = await blob.arrayBuffer();

    // 3. ArrayBuffer 인코딩
    const audioBase64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    console.log("aa + " + import.meta.env.VITE_API_BASE_URL);
    // 4. 백엔드 API 호출
    const searchResults = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio: audioBase64
      }) // Base64로 인코딩한 오디오 데이터
    });

    if (!searchResults.ok) {
      throw new Error('응답 결과 실패');
    }

    const data = await searchResults.json();
    // 개발 환경에서만 로그 출력
    if (import.meta.env.MODE === 'development') {
      console.log('검색 결과 : ' + JSON.stringify(data, null, 2));
    }

    // 5. 검색 결과 파싱
    if (data && data.status.code === 0 && data.metadata && data.metadata.humming) {
      recognitionResults.value = data.metadata.humming.filter(result => result.score * 100 >= minScore); // 일치율 필터링

      // 최소 점수 이상의 결과가 없으면 최고 점수 결과를 포함
      if (recognitionResults.value.length === 0 && data.metadata.humming.length > 0) {
        const highestScoreResult = data.metadata.humming.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        recognitionResults.value = [highestScoreResult];

        // 낮은 점수에 대한 메시지 설정
        lowScoreMessage.value = "일치율이 낮지만, 가장 유사한 결과를 보여드립니다.";
      }

      noResultMessage.value = ''; // 검색 결과가 있을 경우 noResultMessage 초기화
    } else if (data && data.status.msg === "No result") {
      recognitionResults.value = [];
      noResultMessage.value = "일치하는 음악을 찾을 수 없습니다."; // 메시지 설정
      lowScoreMessage.value = ''; // 초기화
    } else {
      recognitionResults.value = []; // 검색 결과가 없을 경우 빈 배열로 설정
      noResultMessage.value = ''; // 기본적으로 메시지 초기화
      lowScoreMessage.value = ''; // 초기화
    }
  } catch (error) {
    console.error('Recognizer -> 서버에 요청 실패 : ', error);
    recognitionResults.value = []; // 에러 발생 시 빈 배열로 설정
    noResultMessage.value = ''; // 에러 발생 시 메시지 초기화
  }
};
</script>

<template>
  <div class="search-button-container">
    <button @click="searchRequestForHumming" class="search-button">
      <i class="fas fa-search search-icon"></i>
      <span>검색</span>
    </button>
  </div>
  <div>
    <!-- SearchResultsList 컴포넌트 사용 -->
    <SearchResultsList :results="recognitionResults" :noResultMessage="noResultMessage" :lowScoreMessage="lowScoreMessage" searchType="humming"/>
  </div>
</template>

<style scoped>
.search-button-container {
  margin-bottom: 40px;
}

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