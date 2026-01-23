<template>
  <div class="container">
    <h1>서비스 평가 참여</h1>
    
    <form @submit.prevent="submitForm" class="write-form">
      <div class="form-group">
        <label for="writer">작성자</label>
        <input 
          type="text" 
          id="writer" 
          v-model="writerName"
          disabled
          class="disabled-input"
        />
      </div>
      
      <div class="form-group">
        <label for="title">별점 *</label>

        <div class="star-rating">
          <span 
            v-for="score in 5" 
            :key="score"
            class="star"
            :class="{ 'filled': score <= (hoverScore || formData.rating) }"
            @mouseenter="hoverScore = score"
            @mouseleave="hoverScore = 0"
            @click="setScore(score)"
          >
            ★
          </span>
        </div>

        <div 
          v-if="formData.rating > 0" 
          class="score-display"
        >
          <strong>{{ formData.rating }}점</strong>을 선택하셨습니다.
        </div>
      </div>
      
      <div class="form-group">
        <label for="content">내용 *</label>
        <textarea 
          id="content" 
          v-model="formData.content"
          placeholder="내용을 입력하세요"
          rows="15"
          required
        ></textarea>
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <div class="button-group">
        <button type="submit" class="submit-btn" :disabled="isSubmitting || formData.rating === 0">
          {{ isSubmitting ? '등록 중...' : '등록' }}
        </button>
        <button type="button" @click="goToList" class="cancel-btn">
          취소
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
const router = useRouter();

const writerName = ref('');
const hoverScore = ref(0);
const isSubmitting = ref(false);
const errorMessage = ref('');

const formData = ref({
  rating: 0,
  content: ''
});

const route = useRoute();

// 인증 체크: 페이지 진입 시 로그인 여부 확인
onMounted(async () => {
  try {
    // 1. 서버로부터 현재 로그인 유저 정보 가져오기
    const authData = await $fetch('/api/auth/me');

    if (!authData.isLoggedIn) {
      alert('평가를 위해 시간 내주셔서 감사합니다. \n평가 적용을 위해 로그인이 필요하여, 로그인 페이지로 이동합니다.');
      router.push({
        path: '/auth/login',
        query: { redirect: route.fullPath }
      });
      return;
    }

    // 2. 로그인되어 있다면 작성자 이름 채우기
    writerName.value = authData.userName;

    // 3. 소셜 로그인 리다이렉트 처리 (기존 로직 유지)
    const savedRedirectPath = sessionStorage.getItem('login_redirect');
    if (savedRedirectPath) {
      sessionStorage.removeItem('login_redirect');
      if (savedRedirectPath !== route.path && savedRedirectPath !== route.fullPath) {
        router.push(savedRedirectPath);
      }
    }
    
    // 4. URL에 별점 정보가 있다면 초기값으로 설정
    if (route.query.rating) {
      formData.value.rating = parseInt(route.query.rating);
    }

  } catch (error) {
    console.error('Auth check error:', error);
    router.push('/auth/login');
  }
});

const setScore = (score) => {
  formData.value.rating = score;
}

const submitForm = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  errorMessage.value = '';
  
  try {
    const response = await $fetch('/api/boards/create', {
      method: 'POST',
      body: {
        rating: formData.value.rating,
        content: formData.value.content
      }
    });
    
    if (response.success) {
      localStorage.setItem('music_is_rated', 'true');
      localStorage.removeItem('music_find_count');
      alert('서비스 평가가 등록되었습니다. 감사합니다!');
      router.push('/boards/reviews'); // 등록 후 목록 페이지로 이동
    } else {
      errorMessage.value = response.error || '서비스 평가 등록에 실패했습니다.';
    }
  } catch (error) {
    console.error('Submit error:', error);
    if (error.status === 401) {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      router.push('/auth/login');
    } else {
      errorMessage.value = '서비스 평가 등록 중 오류가 발생했습니다.';
    }
  } finally {
    isSubmitting.value = false;
  }
};

const goToList = () => {
  router.push('/boards/reviews');
};
</script>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
  margin-bottom: 30px;
}

.write-form {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: bold;
  font-size: 14px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4CAF50;
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.disabled-input {
  background-color: #f5f5f5;
  cursor: not-allowed;
  color: #666;
}

.error-message {
  padding: 12px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 30px;
}

.submit-btn,
.cancel-btn {
  padding: 12px 30px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-btn {
  background-color: #4CAF50;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.submit-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.cancel-btn:hover {
  background-color: #e0e0e0;
}

.star-rating {
  font-size: 2.5rem;
  margin: 10px 0; 
  display: flex;
  justify-content: flex-start; /* 왼쪽 정렬 */
  gap: 8px;
  cursor: pointer;
}

.star {
  color: #ddd; /* 빈 별 색상 */
  transition: color 0.2s, transform 0.1s;
}

.star.filled {
  color: #ffca28; /* 채워진 별 색상 (노란색) */
}

.star:hover {
  transform: scale(1.2); /* 마우스 올렸을 때 살짝 커지는 효과 */
}

.score-display {
  margin-bottom: 20px;
  color: #666;
}
</style>