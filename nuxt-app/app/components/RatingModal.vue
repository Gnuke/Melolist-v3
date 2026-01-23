<template>
  <ClientOnly>
    <Transition name="fade-slide">
      <div v-if="isVisible" class="modal-overlay">
        <div class="modal-content">
          <h3>🎵 음악 찾기가 도움이 되었나요?</h3>
          <p>사용자님의 소중한 의견은 큰 힘이 됩니다!</p>
          
          <div class="stars">
            <span>⭐⭐⭐⭐⭐</span>
          </div>

          <div class="button-group">
            <button @click="submitRating" class="btn-submit">평가하기</button>
            <button @click="delayRating" class="btn-later">나중에 하기</button>
          </div>
        </div>
      </div>
    </Transition>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isVisible = ref(true);

const checkCondition = () => {
  const isRated = localStorage.getItem('music_is_rated') === 'true';
  // 이미 평가를 완료했다면 다시는 띄우지 않음
  if (isRated) return;

  const count = parseInt(localStorage.getItem('music_find_count') || '0');
  const hideUntil = localStorage.getItem('rating_hide_until');
  const now = new Date().getTime();

  // 1. 검색 횟수가 3회 이상인가?
  // 2. '나중에 하기'로 설정한 유예 기간이 지났는가?
  if (count >= 3) {
    if (!hideUntil || now > parseInt(hideUntil)) {
      isVisible.value = true;
    }
  }
};

const delayRating = () => {
  // '나중에 하기' 클릭 시 7일 동안 숨김
  const delayTime = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
  localStorage.setItem('rating_hide_until', delayTime.toString());
  isVisible.value = false;
};

const submitRating = () => {
  // 새 창(새 탭)으로 리뷰 작성 페이지 열기
  window.open('/boards/write', '_blank');
  
  // 3. 모달 닫기
  isVisible.value = false;
};

// 외부에서 호출할 수 있도록 함수를 노출
const triggerCheck = () => {
  checkCondition();
};

defineExpose({ triggerCheck });

onMounted(() => {
  // 페이지 로드 후 조건 확인
  checkCondition();
});
</script>

<style scoped>
/* 배경 오버레이 */
.modal-overlay {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

/* 모달 본체 스타일 */
.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  width: 300px;
  text-align: center;
}

.button-group {
  margin-top: 1.5rem;
  display: flex;
  gap: 10px;
}

.btn-submit {
  background: #42b983;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  flex: 1;
  cursor: pointer;
}

.btn-later {
  background: #eee;
  border: none;
  padding: 10px;
  border-radius: 5px;
  flex: 1;
  cursor: pointer;
}

/* 애니메이션: 아래에서 위로 나타나며 페이드인 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>