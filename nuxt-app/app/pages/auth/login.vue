<!-- app/pages/auth/login.vue -->
<template>
  <div>
    <div class="login-box">
      <h1>로그인</h1>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="userid">아이디</label>
          <input 
            type="text" 
            id="userid" 
            v-model="formData.userid"
            placeholder="아이디를 입력하세요"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="password">비밀번호</label>
          <input 
            type="password" 
            id="password" 
            v-model="formData.password"
            placeholder="비밀번호를 입력하세요"
            required
          />
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <button type="submit" class="login-btn" :disabled="isLoading">
          {{ isLoading ? '로그인 중...' : '로그인' }}
        </button>
      </form>
      
      <div class="register-link">
        <p>아직 회원이 아니신가요?</p>
        <button @click="openRegisterModal" class="register-btn">
          회원가입
        </button>
        <a class="register-btn" @click="handleGoogleLogin">구글계정</a>
        <a class="register-btn" @click="handleNaverLogin">네이버계정</a>
      </div>
    </div>
    
    <!-- 회원가입 팝업 -->
    <RegisterModal :isOpen="showRegisterModal" @close="closeRegisterModal" />
  </div>
</template>

<script setup>
import RegisterModal from "~/components/RegisterModal.vue";

//definePageMeta({
//  layout: false,
  //middleware: 'auth'  // 미들웨어 적용
//});


const router = useRouter();
const showRegisterModal = ref(false);

// 이미 로그인되어 있으면 게시판으로 리다이렉트
onMounted(() => {
  const token = useCookie('auth_token');
  if (token.value) {
    router.push('');
  }
});

const formData = ref({
  userid: '',
  password: ''
});

const isLoading = ref(false);
const errorMessage = ref('');

const route = useRoute();

const handleLogin = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: formData.value
    });
    
    if (response.success) {
      // 1. URL 쿼리에서 redirect 경로를 가져옴
      const redirectPath = route.query.redirect;
      // 2. redirect 경로가 있으면 그곳으로, 없으면 메인('/')으로 이동
      router.push(typeof redirectPath === 'string' ? redirectPath : '/');
    } else {
      errorMessage.value = response.error;
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.value = '로그인 중 오류가 발생했습니다.';
  } finally {
    isLoading.value = false;
  }
};


// 회원가입 팝업 열기
const openRegisterModal = () => {
  showRegisterModal.value = true;
};

// 회원가입 팝업 닫기
const closeRegisterModal = () => {
  showRegisterModal.value = false;
  errorMessage.value = '';
};

// 네이버 로그인 함수
const handleNaverLogin = () => {
  const config = useRuntimeConfig()
  
  // 환경 변수에서 Client ID 가져오기 (public으로 설정해야 클라이언트에서 사용 가능)
  const clientId = config.public.naverClientId || process.env.NAVER_CLIENT_ID
  
  if (!clientId) {
    console.error('Naver Client ID가 설정되지 않았습니다.')
    errorMessage.value = '네이버 로그인 설정 오류가 발생했습니다.'
    return
  }
  
  // Callback URL (네이버에 등록한 URL과 정확히 일치해야 함)
  const redirectUri = 'https://melolist-v2.vercel.app'

  
  // CSRF 방지를 위한 State 생성 (랜덤 문자열)
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15)
  
  // State를 세션 스토리지에 저장 (콜백에서 검증용)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state)
  }
  
  // 네이버 OAuth 인증 URL 생성
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}`
  
  // 네이버 인증 페이지로 리디렉션
  window.location.href = naverAuthUrl
};

const handleGoogleLogin = () => {
  const config = useRuntimeConfig()

  // Google Client ID
  const clientId =
    config.public.googleClientId || process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    console.error('Google Client ID가 설정되지 않았습니다.')
    errorMessage.value = '구글 로그인 설정 오류가 발생했습니다.'
    return
  }

  // Google에 등록한 Callback URL
  const redirectUri = 'https://melolist-v2.vercel.app'

  // CSRF 방지용 state
  const state =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state)
  }

  // Google OAuth URL
  const googleAuthUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `state=${state}&` +
    `access_type=offline&` +
    `prompt=consent`

  // Google 인증 페이지로 이동
  window.location.href = googleAuthUrl
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #a4a4a5;
}

.login-box {
  background: #a4a4a5;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  margin: auto;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
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

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  padding: 12px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background-color: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-btn:hover:not(:disabled) {
  background-color: #5568d3;
}

.login-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.register-link {
  margin-top: 30px;
  text-align: center;
}

.register-link p {
  color: #666;
  margin-bottom: 10px;
  font-size: 14px;
}

.register-btn {
  padding: 10px 20px;
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
  margin: 5px;
}

.register-btn:hover {
  background-color: #e0e0e0;
}
</style>