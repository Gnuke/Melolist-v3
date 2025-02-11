<script setup>
  import { defineProps } from 'vue';

  const props = defineProps({
    recordedAudio: {
      type: String,
      required: true
    },
  });

  const apiKey = import.meta.env.VITE_ACRCLOUD_API_KEY;
  const apiSecret = import.meta.env.VITE_ACRCLOUD_API_SECRET;

  const searchRequest = async () => {
    try {
      // 1. Blob URL을 이용하여 Blob 객체 가져오기
      const response = await fetch(props.recordedAudio);
      const blob = await response.blob();

      // Blob 정보 확인 (선택 사항)
      // console.log('Blob Data:', blob);
      // console.log('Blob Size:', blob.size);
      //console.log('Blob Type:', blob.type);

      // 2. ForData 생성 및 Blob 데이터 추가
      const formData = new FormData();
      formData.append('file', blob, 'recorded_audio.mp3');

      // 3. ACRCloud API 설정
      const host = 'identify-ap-southeast-1.acrcloud.com';

      const timestamp = Math.floor(Date.now() / 1000 );
      const stringToSign = `POST\n/v1/identify\n${apiKey}\n${timestamp}`;

    } catch (error) {
      console.error('Error fetching Blob data:', error);
    }
  };
</script>

<template>
  <button @click="searchRequest" class="search-button">
    <i class="fas fa-search search-icon"></i>
    <span>검색</span>
  </button>
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