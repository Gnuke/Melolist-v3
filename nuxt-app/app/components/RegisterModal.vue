<!-- app/components/RegisterModal.vue -->
<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>회원가입</h2>
        <button class="close-btn" @click="closeModal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="modal-body">
        <p class="description">
          소셜 계정으로 간편하게 회원가입하세요
        </p>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <div class="oauth-buttons">
          <button @click="handleGoogleRegister" class="oauth-btn google-btn">
            <i class="fab fa-google"></i>
            <span>Google 계정으로 회원가입</span>
          </button>
          
          <button @click="handleNaverRegister" class="oauth-btn naver-btn">
            <i class="fas fa-comment"></i>
            <span>네이버 계정으로 회원가입</span>
          </button>
        </div>
        
        <div class="terms">
          <p class="terms-text">
            회원가입 시 <a href="#" @click.prevent>이용약관</a> 및 
            <a href="#" @click.prevent>개인정보처리방침</a>에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const errorMessage = ref('')
const config = useRuntimeConfig()

const closeModal = () => {
  emit('close')
}

// 구글 회원가입 (OAuth)
const handleGoogleRegister = () => {
  const clientId = config.public.googleClientId || process.env.GOOGLE_CLIENT_ID
  
  if (!clientId) {
    errorMessage.value = 'Google 로그인 설정 오류가 발생했습니다.'
    return
  }
  
  const redirectUri = 'https://melolist-v2.vercel.app/api/auth/google/callback'
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15)
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state)
    sessionStorage.setItem('oauth_mode', 'register') // 회원가입 모드
  }
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=openid email profile&` +
    `state=${state}`
  
  window.location.href = googleAuthUrl
}

// 네이버 회원가입 (OAuth)
const handleNaverRegister = () => {
  const clientId = config.public.naverClientId || process.env.NAVER_CLIENT_ID
  
  if (!clientId) {
    errorMessage.value = '네이버 로그인 설정 오류가 발생했습니다.'
    return
  }
  
  const redirectUri = 'https://melolist-v2.vercel.app/api/auth/naver/callback'
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15)
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state)
    sessionStorage.setItem('oauth_mode', 'register') // 회원가입 모드
  }
  
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}`
  
  window.location.href = naverAuthUrl
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.close-btn:hover {
  background-color: #f0f0f0;
}

.modal-body {
  padding: 24px;
}

.description {
  text-align: center;
  color: #666;
  margin-bottom: 24px;
  font-size: 14px;
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

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.oauth-btn {
  width: 100%;
  padding: 14px 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.3s;
}

.oauth-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.google-btn {
  background-color: white;
  color: #333;
}

.google-btn:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

.naver-btn {
  background-color: #03C75A;
  color: white;
  border-color: #03C75A;
}

.naver-btn:hover {
  background-color: #02b350;
  border-color: #02b350;
}

.oauth-btn i {
  font-size: 20px;
}

.terms {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.terms-text {
  font-size: 12px;
  color: #999;
  margin: 0;
  line-height: 1.5;
}

.terms-text a {
  color: #667eea;
  text-decoration: underline;
}

.terms-text a:hover {
  color: #5568d3;
}
</style>
